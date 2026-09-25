import { Worker, type Job, UnrecoverableError, type WorkerOptions } from 'bullmq';
import { Types } from 'mongoose';
import { Lead } from '../models/lead.model.js';
import { TriggerExecution } from '../models/trigger-execution.model.js';
import { withBrokerageScope } from '../repositories/base.repository.js';
import { isDatabaseConnected } from '../config/database.js';
import { getBullMQConnectionOptions } from './redis.connection.js';
import { EMAIL_DELIVERY_QUEUE_NAME, type EmailJobPayload } from './email.queue.js';
import { emailService } from '../services/email.service.js';
import { maskEmail } from '../utils/mask.js';
import { logger } from '../utils/logger.js';

export interface EmailProcessingResult {
  jobId: string;
  leadId: string;
  recipient: string;
  status: 'SENT' | 'ALREADY_EXECUTED' | 'FAILED';
  messageId?: string | undefined;
}

let emailWorkerInstance: Worker<EmailJobPayload, EmailProcessingResult> | null = null;

/**
 * Core business processor for email delivery jobs.
 * Enforces strict tenant boundary checks, idempotency, bounded retries, and sanitized logging.
 */
export async function processEmailJob(
  job: Job<EmailJobPayload>
): Promise<EmailProcessingResult> {
  const payload = job.data;
  const maskedRecipient = maskEmail(payload.to);

  logger.info(
    {
      jobId: job.id,
      brokerageId: payload.brokerageId,
      leadId: payload.leadId,
      recipient: maskedRecipient,
      attempt: job.attemptsMade + 1,
    },
    'Processing email delivery job'
  );

  // 0. Ensure database connection is ready before attempting operations
  if (!isDatabaseConnected()) {
    logger.warn(
      { jobId: job.id, leadId: payload.leadId },
      'Database is not connected; failing email job as transient error for BullMQ retry'
    );
    throw new Error('Database is disconnected; cannot process email delivery');
  }

  // 1. Validate payload identifier formats
  if (!payload.brokerageId || !Types.ObjectId.isValid(payload.brokerageId)) {
    throw new UnrecoverableError('Invalid or missing brokerageId in email job payload');
  }
  if (!payload.leadId || !Types.ObjectId.isValid(payload.leadId)) {
    throw new UnrecoverableError('Invalid or missing leadId in email job payload');
  }

  // 2. Validate tenant boundary against persisted Lead
  const lead = await Lead.findOne(
    withBrokerageScope(payload.brokerageId, {
      _id: new Types.ObjectId(payload.leadId),
    })
  );

  if (!lead) {
    // Check if lead belongs to a different brokerage (cross-tenant tampering detection)
    const crossLead = await Lead.findById(payload.leadId);
    if (crossLead) {
      logger.error(
        {
          jobBrokerageId: payload.brokerageId,
          persistedBrokerageId: crossLead.brokerageId.toString(),
          leadId: payload.leadId,
          jobId: job.id,
        },
        'CRITICAL: Cross-brokerage tampering detected in email job payload'
      );
      throw new UnrecoverableError(
        'Brokerage isolation violation: Job brokerage context does not match persisted lead'
      );
    }

    logger.warn(
      { leadId: payload.leadId, jobId: job.id },
      'Lead resource not found for email job processing'
    );
    throw new UnrecoverableError('Lead resource not found');
  }

  // 3. Idempotency Check: if execution already marked EXECUTED, skip duplicate dispatch
  const existingExecution = await TriggerExecution.findOne(
    withBrokerageScope(payload.brokerageId, {
      idempotencyKey: payload.idempotencyKey,
    })
  );

  if (existingExecution && existingExecution.status === 'EXECUTED') {
    logger.info(
      {
        jobId: job.id,
        idempotencyKey: payload.idempotencyKey,
        recipient: maskedRecipient,
      },
      'Email has already been successfully delivered; skipping duplicate execution'
    );
    return {
      jobId: job.id ?? '',
      leadId: payload.leadId,
      recipient: maskedRecipient,
      status: 'ALREADY_EXECUTED',
    };
  }

  // 4. Dispatch email via EmailService
  try {
    const sendResult = await emailService.sendEmail({
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      brokerageId: payload.brokerageId,
      leadId: payload.leadId,
      recipientName: payload.recipientName,
      recipientType: payload.recipientType,
      templateId: payload.templateId,
      simulateFailure: payload.simulateFailure,
      simulateTerminalFailure: payload.simulateTerminalFailure,
    });

    // 5. Update TriggerExecution to EXECUTED atomically
    await TriggerExecution.findOneAndUpdate(
      withBrokerageScope(payload.brokerageId, {
        idempotencyKey: payload.idempotencyKey,
      }),
      {
        $set: {
          status: 'EXECUTED',
          emailJobId: job.id,
          recipientEmail: payload.to,
          executedAt: sendResult.sentAt,
          error: null,
        },
      }
    );

    return {
      jobId: job.id ?? '',
      leadId: payload.leadId,
      recipient: maskedRecipient,
      status: 'SENT',
      messageId: sendResult.messageId,
    };
  } catch (error) {
    const isUnrecoverable = error instanceof UnrecoverableError;
    const isExhausted = job.attemptsMade + 1 >= (job.opts.attempts || 3);
    const isDbUnavailable =
      !isDatabaseConnected() ||
      (error as Error)?.message?.includes('buffering timed out') ||
      (error as Error)?.message?.includes('Database is disconnected') ||
      (error as Error)?.name === 'MongoNetworkError' ||
      (error as Error)?.name === 'MongoServerSelectionError';

    if (!isDbUnavailable && (isUnrecoverable || isExhausted)) {
      await TriggerExecution.findOneAndUpdate(
        withBrokerageScope(payload.brokerageId, {
          idempotencyKey: payload.idempotencyKey,
        }),
        {
          $set: {
            status: 'FAILED',
            emailJobId: job.id,
            recipientEmail: payload.to,
            error: (error as Error).message,
          },
        }
      ).catch(() => {});
    }

    throw error;
  }
}

/**
 * Creates and initializes an Email Worker instance.
 */
export function createEmailWorker(
  options?: Partial<WorkerOptions>
): Worker<EmailJobPayload, EmailProcessingResult> {
  const connection = getBullMQConnectionOptions();

  const worker = new Worker<EmailJobPayload, EmailProcessingResult>(
    EMAIL_DELIVERY_QUEUE_NAME,
    processEmailJob,
    {
      connection,
      concurrency: 5,
      lockDuration: 30000,
      stalledInterval: 15000,
      maxStalledCount: 2,
      ...options,
    }
  );

  worker.on('completed', (job, result) => {
    logger.info(
      {
        jobId: job.id,
        recipient: result.recipient,
        status: result.status,
      },
      'Email worker: Job completed successfully'
    );
  });

  worker.on('failed', (job, err) => {
    if (!job) {
      logger.error({ err: err.message }, 'Email worker: Stalled or unknown job failed');
      return;
    }

    const isTerminal = job.attemptsMade >= (job.opts.attempts || 3);
    const maskedRecipient = maskEmail(job.data?.to || '');

    if (isTerminal || err.name === 'UnrecoverableError') {
      logger.error(
        {
          jobId: job.id,
          recipient: maskedRecipient,
          attemptsMade: job.attemptsMade,
          err: err.message,
        },
        'Email worker: Job failed terminally; retries exhausted or unrecoverable'
      );
    } else {
      logger.warn(
        {
          jobId: job.id,
          recipient: maskedRecipient,
          attempt: job.attemptsMade,
          err: err.message,
        },
        'Email worker: Transient failure; retrying with exponential backoff'
      );
    }
  });

  worker.on('error', (err) => {
    logger.error({ err: err.message }, 'Email worker internal error');
  });

  return worker;
}

/**
 * Starts the global email delivery worker.
 */
export function startEmailWorker(): Worker<EmailJobPayload, EmailProcessingResult> {
  if (emailWorkerInstance) {
    return emailWorkerInstance;
  }

  emailWorkerInstance = createEmailWorker();
  logger.info('Email delivery worker started and actively listening for jobs');
  return emailWorkerInstance;
}

/**
 * Pauses the email worker from taking new jobs (e.g. during DB outage).
 */
export async function pauseEmailWorker(): Promise<void> {
  if (emailWorkerInstance && !emailWorkerInstance.isPaused()) {
    logger.warn('Pausing email worker due to database disconnection');
    await emailWorkerInstance.pause(true);
  }
}

/**
 * Resumes the email worker once the database is available.
 */
export function resumeEmailWorker(): void {
  if (emailWorkerInstance && emailWorkerInstance.isPaused()) {
    logger.info('Resuming email worker as database is reconnected');
    emailWorkerInstance.resume();
  }
}

/**
 * Gracefully shuts down the global email delivery worker.
 */
export async function closeEmailWorker(): Promise<void> {
  if (emailWorkerInstance) {
    await emailWorkerInstance.close();
    emailWorkerInstance = null;
    logger.debug('Email delivery worker closed cleanly');
  }
}
