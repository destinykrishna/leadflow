import { Worker, type Job, UnrecoverableError, type WorkerOptions } from 'bullmq';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { isDatabaseConnected } from '../config/database.js';
import { Document as DocumentModel, type DocumentStatus, type IDocumentExtractedData } from '../models/document.model.js';
import { withBrokerageScope } from '../repositories/base.repository.js';
import { getBullMQConnectionOptions } from './redis.connection.js';
import {
  DOCUMENT_PROCESSING_QUEUE_NAME,
  type DocumentJobPayload,
} from './document.queue.js';
import { emitDocumentStatusChanged } from './document-events.js';
import { documentRecoveryService } from './document-recovery.service.js';
import { ocrService } from '../services/ocr.service.js';
import { documentIntelligenceService } from '../services/document-intelligence.service.js';
import { logger } from '../utils/logger.js';

export interface DocumentProcessingResult {
  documentId: string;
  status: DocumentStatus;
  message: string;
}

let documentWorkerInstance: Worker<DocumentJobPayload, DocumentProcessingResult> | null = null;

/**
 * Core business processor for document verification jobs.
 * Enforces strict tenant boundary validation, atomic state progression,
 * simulated slow checks, and realistic retry/rejection outcomes.
 */
export async function processDocumentJob(
  job: Job<DocumentJobPayload>
): Promise<DocumentProcessingResult> {
  const payload = job.data;

  logger.info(
    {
      jobId: job.id,
      documentId: payload.documentId,
      brokerageId: payload.brokerageId,
      attempt: job.attemptsMade + 1,
    },
    'Processing document verification job'
  );

  // 0. Ensure database connection is ready before attempting operations
  if (!isDatabaseConnected()) {
    logger.warn(
      { jobId: job.id, documentId: payload.documentId },
      'Database is not connected; failing job as transient error for BullMQ retry'
    );
    throw new Error('Database is disconnected; cannot process document verification');
  }

  // 1. Validate payload identifier formats
  if (!payload.documentId || !Types.ObjectId.isValid(payload.documentId)) {
    throw new UnrecoverableError('Invalid or missing documentId in job payload');
  }
  if (!payload.brokerageId || !Types.ObjectId.isValid(payload.brokerageId)) {
    throw new UnrecoverableError('Invalid or missing brokerageId in job payload');
  }

  // 2. Validate tenant boundary against persisted document
  const doc = await DocumentModel.findOne(
    withBrokerageScope(payload.brokerageId, {
      _id: new Types.ObjectId(payload.documentId),
    })
  );

  if (!doc) {
    // Check if the document exists under another brokerage (cross-tenant tampering detection)
    const crossDoc = await DocumentModel.findById(payload.documentId);
    if (crossDoc) {
      logger.error(
        {
          jobBrokerageId: payload.brokerageId,
          persistedBrokerageId: crossDoc.brokerageId.toString(),
          documentId: payload.documentId,
          jobId: job.id,
        },
        'CRITICAL: Cross-brokerage tampering detected in document processing job'
      );
      throw new UnrecoverableError(
        'Brokerage isolation violation: Job brokerage context does not match persisted document context'
      );
    }

    logger.warn(
      { documentId: payload.documentId, jobId: job.id },
      'Document not found for processing job'
    );
    throw new UnrecoverableError('Document resource not found');
  }

  // 3. Idempotency Check: if document already reached terminal state or review queue, return immediately
  if (doc.status === 'VERIFIED' || doc.status === 'REJECTED' || doc.status === 'PENDING_REVIEW') {
    logger.info(
      { documentId: doc._id, status: doc.status },
      'Document has already reached terminal or reviewable status; skipping duplicate processing'
    );
    return {
      documentId: doc._id.toString(),
      status: doc.status,
      message: `Document already completed with status: ${doc.status}`,
    };
  }

  // 4. Atomic Concurrency Lock: Claim document and transition PENDING -> PROCESSING
  if (doc.status === 'PENDING') {
    const claimedDoc = await DocumentModel.findOneAndUpdate(
      withBrokerageScope(payload.brokerageId, {
        _id: doc._id,
        status: 'PENDING',
      }),
      {
        $set: { status: 'PROCESSING' },
        $inc: { __v: 1 },
      },
      { returnDocument: 'after' }
    );

    if (!claimedDoc) {
      // Another concurrent worker claimed the document first
      const currentDoc = await DocumentModel.findOne(
        withBrokerageScope(payload.brokerageId, { _id: doc._id })
      );
      logger.info(
        { documentId: doc._id, currentStatus: currentDoc?.status },
        'Concurrent worker won race to claim document'
      );
      return {
        documentId: doc._id.toString(),
        status: currentDoc?.status ?? 'PROCESSING',
        message: 'Document claimed by another concurrent worker',
      };
    }

    // Emit realtime event: PENDING -> PROCESSING
    emitDocumentStatusChanged({
      documentId: claimedDoc._id.toString(),
      brokerageId: claimedDoc.brokerageId.toString(),
      clientId: claimedDoc.clientId?.toString(),
      leadId: claimedDoc.leadId?.toString(),
      uploadedBy: claimedDoc.uploadedBy?.toString() || payload.uploadedBy,
      clientUserId: payload.clientUserId,
      previousStatus: 'PENDING',
      newStatus: 'PROCESSING',
      type: claimedDoc.type,
      title: claimedDoc.title,
      updatedAt: claimedDoc.updatedAt,
    });
  } else if (doc.status === 'PROCESSING') {
    // If it was already in PROCESSING:
    // If this is a retry attempt (job.attemptsMade > 0), we resume our previous attempt.
    // If this is attempt 0, another worker instance is actively processing it.
    if (job.attemptsMade === 0) {
      logger.info(
        { documentId: doc._id },
        'Document is actively being processed by another worker; skipping duplicate job'
      );
      return {
        documentId: doc._id.toString(),
        status: 'PROCESSING',
        message: 'Document actively being processed by another worker',
      };
    }
  }

  // 5. Support for Simulated Processing Failures & Rejections (Preserves Test Hooks)

  // 5a. Simulated Transient Failure (triggers bounded BullMQ retries with exponential backoff)
  const isSimulatedTransientFailure =
    payload.simulateFailure === true || doc.title.toLowerCase().includes('[fail-transient]');

  if (isSimulatedTransientFailure) {
    logger.warn(
      { documentId: doc._id, attempt: job.attemptsMade + 1, maxAttempts: job.opts.attempts },
      'Simulating transient document processing failure (OCR service timeout)'
    );
    throw new Error(
      `Transient verification service timeout on attempt ${job.attemptsMade + 1}`
    );
  }

  // 5b. Simulated Terminal Rejection (document is unreadable or fails compliance check)
  const isSimulatedTerminalRejection =
    payload.simulateTerminalRejection === true ||
    doc.title.toLowerCase().includes('[reject]') ||
    doc.title.toLowerCase().includes('[invalid]');

  if (isSimulatedTerminalRejection) {
    const rejectedDoc = await DocumentModel.findOneAndUpdate(
      withBrokerageScope(payload.brokerageId, {
        _id: doc._id,
        status: 'PROCESSING',
      }),
      {
        $set: {
          status: 'REJECTED',
          verificationNotes:
            'Automated verification check failed: Unreadable document scan or illegible text.',
        },
        $inc: { __v: 1 },
      },
      { returnDocument: 'after' }
    );

    if (rejectedDoc) {
      emitDocumentStatusChanged({
        documentId: rejectedDoc._id.toString(),
        brokerageId: rejectedDoc.brokerageId.toString(),
        clientId: rejectedDoc.clientId?.toString(),
        leadId: rejectedDoc.leadId?.toString(),
        uploadedBy: rejectedDoc.uploadedBy?.toString() || payload.uploadedBy,
        clientUserId: payload.clientUserId,
        previousStatus: 'PROCESSING',
        newStatus: 'REJECTED',
        type: rejectedDoc.type,
        title: rejectedDoc.title,
        verificationNotes: rejectedDoc.verificationNotes,
        updatedAt: rejectedDoc.updatedAt,
      });
    }

    logger.info(
      { documentId: doc._id, brokerageId: payload.brokerageId },
      'Document verification completed: REJECTED'
    );

    return {
      documentId: doc._id.toString(),
      status: 'REJECTED',
      message: 'Document rejected during automated verification check',
    };
  }

  // 5c. Optional Delay Hook (Preserves test hooks for intermediate status inspection)
  if (payload.processingDelayMs !== undefined && payload.processingDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, payload.processingDelayMs));
  }

  // 6. Real Tesseract OCR Execution (Replaces legacy simulated delay)
  let ocrResultText: string | null = null;
  let verificationNotes = 'Automated technical pre-checks passed. Awaiting human verification.';

  try {
    const ocrResult = await ocrService.processDocument(doc);
    if (ocrResult.ocrText) {
      ocrResultText = ocrResult.ocrText;
    }
    if (ocrResult.summary) {
      verificationNotes = ocrResult.summary;
    }
  } catch (ocrErr: any) {
    // If it is an explicit OCR timeout or download timeout, rethrow so BullMQ retries with exponential backoff
    if (
      ocrErr.code === 'STORAGE_DOWNLOAD_TIMEOUT' ||
      ocrErr.code === 'OCR_PROCESS_TIMEOUT' ||
      ocrErr.message?.includes('timed out')
    ) {
      logger.warn(
        { documentId: doc._id, err: ocrErr.message },
        'Transient OCR timeout encountered; failing job for bounded BullMQ retry'
      );
      throw ocrErr;
    }

    logger.warn(
      { documentId: doc._id, err: ocrErr.message },
      'OCR execution encountered non-fatal error; proceeding to human verification queue'
    );
    verificationNotes = `Automated OCR check incomplete (${ocrErr.message}). Queued for human verification.`;
  }

  // 7. Structured Document Intelligence (Classification & Extraction)
  let extractedData: IDocumentExtractedData | null = null;
  if (ocrResultText) {
    try {
      extractedData = documentIntelligenceService.process(ocrResultText, doc.type);
      if (
        extractedData.classification.status === 'RECOGNIZED' &&
        extractedData.classification.detectedType
      ) {
        verificationNotes = `Automated technical pre-checks passed. Classified as ${extractedData.classification.detectedType} (confidence: ${Math.round(extractedData.classification.confidence * 100)}%). Awaiting human verification.`;
      } else if (extractedData.classification.status === 'UNKNOWN') {
        verificationNotes =
          'Automated technical pre-checks passed. Document category unclassified. Awaiting human verification.';
      }
    } catch (intelErr: any) {
      logger.warn(
        { documentId: doc._id, err: intelErr.message },
        'Document intelligence extraction encountered non-fatal error'
      );
    }
  }

  // 7b. Cross-Document Consistency & Review Signals
  if (extractedData) {
    try {
      const siblingFilter: any = { _id: { $ne: doc._id } };
      if (doc.clientId) {
        siblingFilter.clientId = doc.clientId;
      } else if (doc.leadId) {
        siblingFilter.leadId = doc.leadId;
      }

      let siblingDocs: any[] = [];
      if (doc.clientId || doc.leadId) {
        siblingDocs = await DocumentModel.find(
          withBrokerageScope(payload.brokerageId, siblingFilter)
        );
      }

      const signals = documentIntelligenceService.evaluateConsistency(
        {
          _id: doc._id,
          brokerageId: payload.brokerageId,
          type: doc.type,
          title: doc.title,
          extractedData,
        },
        siblingDocs
      );

      extractedData.reviewSignals = signals;

      if (signals.length > 0) {
        logger.info(
          {
            documentId: doc._id,
            signalCount: signals.length,
            signalTypes: signals.map((s) => s.type),
          },
          'Cross-document review signals detected'
        );
      }
    } catch (consistencyErr: any) {
      logger.warn(
        { documentId: doc._id, err: consistencyErr.message },
        'Cross-document consistency evaluation encountered non-fatal error'
      );
    }
  }

  // 8. Successful Technical Pre-Checks -> PENDING_REVIEW
  const pendingReviewDoc = await DocumentModel.findOneAndUpdate(
    withBrokerageScope(payload.brokerageId, {
      _id: doc._id,
      status: 'PROCESSING',
    }),
    {
      $set: {
        status: 'PENDING_REVIEW',
        verificationNotes,
        ...(ocrResultText ? { ocrText: ocrResultText } : {}),
        ...(extractedData ? { extractedData } : {}),
      },
      $inc: { __v: 1 },
    },
    { returnDocument: 'after' }
  );

  if (pendingReviewDoc) {
    emitDocumentStatusChanged({
      documentId: pendingReviewDoc._id.toString(),
      brokerageId: pendingReviewDoc.brokerageId.toString(),
      clientId: pendingReviewDoc.clientId?.toString(),
      leadId: pendingReviewDoc.leadId?.toString(),
      uploadedBy: pendingReviewDoc.uploadedBy?.toString() || payload.uploadedBy,
      clientUserId: payload.clientUserId,
      previousStatus: 'PROCESSING',
      newStatus: 'PENDING_REVIEW',
      type: pendingReviewDoc.type,
      title: pendingReviewDoc.title,
      verificationNotes: pendingReviewDoc.verificationNotes,
      updatedAt: pendingReviewDoc.updatedAt,
    });
  } else {
    // If concurrent human review already modified status away from PROCESSING
    const currentDoc = await DocumentModel.findOne(
      withBrokerageScope(payload.brokerageId, { _id: doc._id })
    );
    logger.info(
      { documentId: doc._id, currentStatus: currentDoc?.status },
      'Document status changed during processing; skipping worker status transition'
    );
    return {
      documentId: doc._id.toString(),
      status: currentDoc?.status ?? 'PROCESSING',
      message: 'Document status changed concurrently',
    };
  }

  logger.info(
    { documentId: doc._id, brokerageId: payload.brokerageId },
    'Document technical pre-checks completed: PENDING_REVIEW'
  );

  return {
    documentId: doc._id.toString(),
    status: 'PENDING_REVIEW',
    message: 'Document technical pre-checks passed successfully; awaiting human review',
  };
}

/**
 * Handles exhausted job retries to ensure documents are never left stuck in PROCESSING.
 */
async function handleExhaustedJobFailure(
  job: Job<DocumentJobPayload> | undefined,
  err: Error
): Promise<void> {
  if (!job || !job.data?.documentId || !job.data?.brokerageId) {
    return;
  }

  // Do not mark document as REJECTED if failure was caused by database unavailability
  if (
    !isDatabaseConnected() ||
    err.message.includes('buffering timed out') ||
    err.message.includes('Database is disconnected') ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoServerSelectionError'
  ) {
    logger.warn(
      {
        documentId: job.data.documentId,
        err: err.message,
      },
      'Skipping document rejection on job failure: failure caused by database unavailability'
    );
    return;
  }

  const maxAttempts = job.opts.attempts ?? 3;
  const isExhausted = job.attemptsMade >= maxAttempts || err.name === 'UnrecoverableError';

  if (!isExhausted) {
    return;
  }

  try {
    const payload = job.data;
    const failedDoc = await DocumentModel.findOneAndUpdate(
      withBrokerageScope(payload.brokerageId, {
        _id: new Types.ObjectId(payload.documentId),
        status: 'PROCESSING',
      }),
      {
        $set: {
          status: 'REJECTED',
          verificationNotes: `Verification failed after ${job.attemptsMade} attempts: ${err.message}`,
        },
        $inc: { __v: 1 },
      },
      { returnDocument: 'after' }
    );

    if (failedDoc) {
      logger.warn(
        {
          documentId: failedDoc._id,
          attemptsMade: job.attemptsMade,
          reason: err.message,
        },
        'Exhausted job retries: transitioned document to REJECTED'
      );

      emitDocumentStatusChanged({
        documentId: failedDoc._id.toString(),
        brokerageId: failedDoc.brokerageId.toString(),
        clientId: failedDoc.clientId?.toString(),
        leadId: failedDoc.leadId?.toString(),
        uploadedBy: failedDoc.uploadedBy?.toString() || job.data.uploadedBy,
        clientUserId: job.data.clientUserId,
        previousStatus: 'PROCESSING',
        newStatus: 'REJECTED',
        type: failedDoc.type,
        title: failedDoc.title,
        verificationNotes: failedDoc.verificationNotes,
        updatedAt: failedDoc.updatedAt,
      });
    }
  } catch (cleanupError) {
    logger.error(
      { cleanupError, documentId: job.data.documentId },
      'Failed to clean up exhausted document job'
    );
  }
}

/**
 * Creates and configures a BullMQ Worker instance for document processing.
 */
export function createDocumentWorker(
  options?: Partial<WorkerOptions>
): Worker<DocumentJobPayload, DocumentProcessingResult> {
  const connection = getBullMQConnectionOptions();

  const worker = new Worker<DocumentJobPayload, DocumentProcessingResult>(
    DOCUMENT_PROCESSING_QUEUE_NAME,
    async (job: Job<DocumentJobPayload>) => {
      return processDocumentJob(job);
    },
    {
      connection,
      concurrency: env.DOCUMENT_PROCESSING_CONCURRENCY,
      lockDuration: 30000,
      stalledInterval: 15000,
      maxStalledCount: 2,
      ...options,
    }
  );

  worker.on('stalled', (jobId, prev) => {
    logger.warn(
      { jobId, prev },
      'Document processing job detected as stalled; BullMQ re-assigning'
    );
  });

  worker.on('failed', (job, err) => {
    logger.warn(
      {
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        err: err.message,
      },
      'Document processing job failed attempt'
    );
    void handleExhaustedJobFailure(job, err);
  });

  worker.on('error', (err) => {
    if (err.message?.includes('ECONNRESET')) {
      logger.warn({ err: err.message }, 'Document processing worker: transient Redis socket reset (reconnecting automatically)');
      return;
    }
    logger.error({ err: err.message }, 'Document processing worker error');
  });

  return worker;
}

/**
 * Starts the singleton Document Processing Worker.
 */
export function startDocumentWorker(
  options?: Partial<WorkerOptions>
): Worker<DocumentJobPayload, DocumentProcessingResult> {
  if (documentWorkerInstance) {
    return documentWorkerInstance;
  }

  documentWorkerInstance = createDocumentWorker(options);
  logger.info('Document processing worker started successfully');

  // Trigger non-blocking startup reconciliation for any documents queued while worker was offline
  void documentRecoveryService.reconcileAll().catch((err) => {
    logger.warn({ err }, 'Initial document reconciliation failed on worker start');
  });

  return documentWorkerInstance;
}

/**
 * Pauses the Document Processing Worker from taking new jobs (e.g. during DB outage).
 */
export async function pauseDocumentWorker(): Promise<void> {
  if (documentWorkerInstance && !documentWorkerInstance.isPaused()) {
    logger.warn('Pausing document worker due to database disconnection');
    await documentWorkerInstance.pause(true);
  }
}

/**
 * Resumes the Document Processing Worker once the database is available.
 */
export function resumeDocumentWorker(): void {
  if (documentWorkerInstance && documentWorkerInstance.isPaused()) {
    logger.info('Resuming document worker as database is reconnected');
    documentWorkerInstance.resume();
  }
}

/**
 * Gracefully shuts down the singleton Document Processing Worker.
 */
export async function closeDocumentWorker(): Promise<void> {
  if (documentWorkerInstance) {
    await documentWorkerInstance.close();
    documentWorkerInstance = null;
    logger.debug('Document processing worker closed cleanly');
  }
}
