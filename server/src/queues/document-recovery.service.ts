import { Document as DocumentModel } from '../models/document.model.js';
import { getDocumentQueue, enqueueDocumentProcessing } from './document.queue.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface ReconciliationOptions {
  olderThanMs?: number | undefined;
  batchSize?: number | undefined;
}

export interface ReconciliationSummary {
  recoveredPending: number;
  recoveredStalled: number;
  timestamp: string;
}

let periodicTimer: NodeJS.Timeout | null = null;

export class DocumentRecoveryService {
  /**
   * Recovers documents that were saved as PENDING in MongoDB but whose BullMQ
   * job enqueueing failed (e.g. temporary Redis outage during HTTP upload).
   *
   * Consistency Tradeoff:
   * Eventual consistency over distributed transactions. We use MongoDB as the durable
   * intent log; whenever Redis becomes available, this sweeper ensures no document
   * remains permanently stuck in PENDING.
   */
  async reconcilePendingDocuments(
    options?: ReconciliationOptions
  ): Promise<number> {
    const olderThanMs =
      options?.olderThanMs !== undefined
        ? options.olderThanMs
        : env.isTest
          ? 0
          : env.PENDING_DOCUMENT_RECOVERY_THRESHOLD_MS;

    const cutoff = new Date(Date.now() - olderThanMs);
    const batchSize = options?.batchSize ?? 100;

    const pendingDocs = await DocumentModel.find({
      status: 'PENDING',
      createdAt: { $lte: cutoff },
    })
      .sort({ createdAt: 1 })
      .limit(batchSize);

    if (pendingDocs.length === 0) {
      return 0;
    }

    let recoveredCount = 0;
    const queue = getDocumentQueue();

    for (const doc of pendingDocs) {
      try {
        const jobId = `doc-verify-${doc._id}`;
        const existingJob = await queue.getJob(jobId);

        let needsEnqueue = false;

        if (!existingJob) {
          needsEnqueue = true;
        } else {
          const state = await existingJob.getState();
          // If job was previously marked failed or unknown, re-enqueue
          if (state === 'failed' || state === 'unknown') {
            await existingJob.remove().catch(() => {});
            needsEnqueue = true;
          }
        }

        if (needsEnqueue) {
          await enqueueDocumentProcessing({
            documentId: doc._id.toString(),
            brokerageId: doc.brokerageId.toString(),
            clientId: doc.clientId?.toString(),
            leadId: doc.leadId?.toString(),
          });

          recoveredCount++;
          logger.info(
            {
              documentId: doc._id.toString(),
              brokerageId: doc.brokerageId.toString(),
              createdAt: doc.createdAt,
            },
            'Recovered and enqueued stale PENDING document'
          );
        }
      } catch (err) {
        logger.error(
          {
            err: (err as Error)?.message,
            documentId: doc._id.toString(),
            brokerageId: doc.brokerageId.toString(),
          },
          'Failed to recover PENDING document during reconciliation sweep'
        );
      }
    }

    return recoveredCount;
  }

  /**
   * Recovers documents that were left in PROCESSING state after a catastrophic
   * worker crash or unhandled process termination.
   */
  async reconcileStalledDocuments(
    options?: ReconciliationOptions
  ): Promise<number> {
    const olderThanMs =
      options?.olderThanMs !== undefined
        ? options.olderThanMs
        : env.isTest
          ? 100
          : env.STALLED_DOCUMENT_RECOVERY_THRESHOLD_MS;

    const cutoff = new Date(Date.now() - olderThanMs);
    const batchSize = options?.batchSize ?? 50;

    const stalledDocs = await DocumentModel.find({
      status: 'PROCESSING',
      updatedAt: { $lte: cutoff },
    })
      .sort({ updatedAt: 1 })
      .limit(batchSize);

    if (stalledDocs.length === 0) {
      return 0;
    }

    let recoveredCount = 0;
    const queue = getDocumentQueue();

    for (const doc of stalledDocs) {
      try {
        const jobId = `doc-verify-${doc._id}`;
        const existingJob = await queue.getJob(jobId);

        let isJobActive = false;
        if (existingJob) {
          const state = await existingJob.getState();
          if (state === 'active') {
            isJobActive = true;
          }
        }

        // If no active worker holds the job, reset to PENDING and re-enqueue
        if (!isJobActive) {
          const resetDoc = await DocumentModel.findOneAndUpdate(
            {
              _id: doc._id,
              status: 'PROCESSING',
            },
            {
              $set: {
                status: 'PENDING',
                verificationNotes:
                  'Re-queued by background reconciliation (previous processing attempt stalled).',
              },
              $inc: { __v: 1 },
            },
            { returnDocument: 'after' }
          );

          if (resetDoc) {
            if (existingJob) {
              await existingJob.remove().catch(() => {});
            }

            await enqueueDocumentProcessing({
              documentId: resetDoc._id.toString(),
              brokerageId: resetDoc.brokerageId.toString(),
              clientId: resetDoc.clientId?.toString(),
              leadId: resetDoc.leadId?.toString(),
            });

            recoveredCount++;
            logger.warn(
              {
                documentId: resetDoc._id.toString(),
                brokerageId: resetDoc.brokerageId.toString(),
                stalledSince: doc.updatedAt,
              },
              'Recovered stalled PROCESSING document: reset to PENDING and re-enqueued'
            );
          }
        }
      } catch (err) {
        logger.error(
          {
            err: (err as Error)?.message,
            documentId: doc._id.toString(),
          },
          'Failed to recover stalled PROCESSING document during sweep'
        );
      }
    }

    return recoveredCount;
  }

  /**
   * Executes a full reconciliation sweep across both PENDING and stalled PROCESSING documents.
   */
  async reconcileAll(
    options?: ReconciliationOptions
  ): Promise<ReconciliationSummary> {
    const recoveredPending = await this.reconcilePendingDocuments(options);
    const recoveredStalled = await this.reconcileStalledDocuments(options);

    return {
      recoveredPending,
      recoveredStalled,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Starts periodic background reconciliation loop.
   */
  startPeriodicReconciliation(intervalMs?: number): void {
    if (periodicTimer) {
      return;
    }

    const interval =
      intervalMs ?? env.RECONCILIATION_INTERVAL_MS;

    periodicTimer = setInterval(async () => {
      try {
        await this.reconcileAll();
      } catch (err) {
        logger.error({ err }, 'Error during periodic document reconciliation');
      }
    }, interval);

    // Allow process to exit cleanly without unref holding the loop
    if (periodicTimer.unref) {
      periodicTimer.unref();
    }

    logger.info(
      { intervalMs: interval },
      'Started periodic document reconciliation sweeper'
    );
  }

  /**
   * Stops the periodic background reconciliation loop.
   */
  stopPeriodicReconciliation(): void {
    if (periodicTimer) {
      clearInterval(periodicTimer);
      periodicTimer = null;
      logger.debug('Stopped periodic document reconciliation sweeper');
    }
  }
}

export const documentRecoveryService = new DocumentRecoveryService();

export const reconcilePendingDocuments = (
  options?: ReconciliationOptions
): Promise<number> => documentRecoveryService.reconcilePendingDocuments(options);

export const reconcileStalledDocuments = (
  options?: ReconciliationOptions
): Promise<number> => documentRecoveryService.reconcileStalledDocuments(options);

export const reconcileAll = (
  options?: ReconciliationOptions
): Promise<ReconciliationSummary> =>
  documentRecoveryService.reconcileAll(options);

export const startPeriodicReconciliation = (intervalMs?: number): void =>
  documentRecoveryService.startPeriodicReconciliation(intervalMs);

export const stopPeriodicReconciliation = (): void =>
  documentRecoveryService.stopPeriodicReconciliation();
