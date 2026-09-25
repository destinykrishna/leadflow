import { Queue, type JobsOptions, type Job } from 'bullmq';
import { getBullMQConnectionOptions } from './redis.connection.js';
import { logger } from '../utils/logger.js';

export const DOCUMENT_PROCESSING_QUEUE_NAME = 'document-processing';
export const DOCUMENT_VERIFY_JOB_NAME = 'verify-document';

export interface DocumentJobPayload {
  documentId: string;
  brokerageId: string;
  clientId?: string | undefined;
  leadId?: string | undefined;
  simulateFailure?: boolean | undefined;
  simulateTerminalRejection?: boolean | undefined;
  processingDelayMs?: number | undefined;
}

let documentQueueInstance: Queue<DocumentJobPayload, unknown, string> | null = null;

/**
 * Resolves or initializes the BullMQ Document Processing Queue.
 */
export function getDocumentQueue(): Queue<DocumentJobPayload, unknown, string> {
  if (documentQueueInstance) {
    return documentQueueInstance;
  }

  const connection = getBullMQConnectionOptions();

  const queue = new Queue<DocumentJobPayload, unknown, string>(DOCUMENT_PROCESSING_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s, 2s, 4s
      },
      removeOnComplete: {
        age: 24 * 3600, // keep for 24h
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // keep failed for 7 days for audit
        count: 5000,
      },
    },
  });

  queue.on('error', (err) => {
    logger.error({ err: err.message }, 'Document processing queue error');
  });

  documentQueueInstance = queue;
  logger.info(`Initialized BullMQ queue: ${DOCUMENT_PROCESSING_QUEUE_NAME}`);
  return documentQueueInstance;
}

/**
 * Enqueues a document for background verification.
 * Automatically enforces queue-level deduplication via deterministic jobId.
 */
export async function enqueueDocumentProcessing(
  payload: DocumentJobPayload,
  options?: JobsOptions
): Promise<Job<DocumentJobPayload, unknown, string>> {
  const queue = getDocumentQueue();

  const jobId = options?.jobId ?? `doc-verify-${payload.documentId}`;

  const job = await queue.add(DOCUMENT_VERIFY_JOB_NAME, payload, {
    jobId,
    ...options,
  });

  logger.info(
    {
      jobId: job.id,
      documentId: payload.documentId,
      brokerageId: payload.brokerageId,
    },
    'Document verification job successfully enqueued'
  );

  return job;
}

/**
 * Gracefully shuts down the Document Processing Queue.
 */
export async function closeDocumentQueue(): Promise<void> {
  if (documentQueueInstance) {
    await documentQueueInstance.close();
    documentQueueInstance = null;
    logger.debug('Document processing queue closed cleanly');
  }
}
