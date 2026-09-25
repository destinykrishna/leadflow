import { Queue, type JobsOptions, type Job } from 'bullmq';
import { env } from '../config/env.js';
import { getBullMQConnectionOptions } from './redis.connection.js';
import { logger } from '../utils/logger.js';
import { maskEmail } from '../utils/mask.js';

export const EMAIL_DELIVERY_QUEUE_NAME = env.isTest
  ? 'email-delivery-test'
  : 'email-delivery';
export const EMAIL_SEND_JOB_NAME = 'send-email';

export interface EmailJobPayload {
  brokerageId: string;
  leadId: string;
  triggerId: string;
  templateId?: string | undefined;
  to: string;
  recipientName?: string | undefined;
  recipientType: string;
  subject: string;
  body: string;
  idempotencyKey: string;
  simulateFailure?: boolean | undefined;
  simulateTerminalFailure?: boolean | undefined;
}

let emailQueueInstance: Queue<EmailJobPayload, unknown, string> | null = null;

/**
 * Resolves or initializes the BullMQ Email Delivery Queue.
 */
export function getEmailQueue(): Queue<EmailJobPayload, unknown, string> {
  if (emailQueueInstance) {
    return emailQueueInstance;
  }

  const connection = getBullMQConnectionOptions();

  const queue = new Queue<EmailJobPayload, unknown, string>(EMAIL_DELIVERY_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s, 2s, 4s
      },
      removeOnComplete: {
        age: 24 * 3600, // 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // 7 days for audit
        count: 5000,
      },
    },
  });

  queue.on('error', (err) => {
    logger.error({ err: err.message }, 'Email delivery queue error');
  });

  emailQueueInstance = queue;
  logger.info(`Initialized BullMQ queue: ${EMAIL_DELIVERY_QUEUE_NAME}`);
  return emailQueueInstance;
}

/**
 * Enqueues an email dispatch job into the background queue.
 * Automatically enforces queue-level deduplication via deterministic jobId derived from idempotencyKey.
 */
export async function enqueueEmailJob(
  payload: EmailJobPayload,
  options?: JobsOptions
): Promise<Job<EmailJobPayload, unknown, string> | null> {
  try {
    const queue = getEmailQueue();
    const rawJobId = options?.jobId ?? `email-${payload.idempotencyKey}`;
    const jobId = rawJobId.replace(/:/g, '-');

    const job = await queue.add(EMAIL_SEND_JOB_NAME, payload, {
      jobId,
      ...options,
    });

    logger.info(
      {
        jobId: job.id,
        brokerageId: payload.brokerageId,
        leadId: payload.leadId,
        recipient: maskEmail(payload.to),
        idempotencyKey: payload.idempotencyKey,
      },
      'Email delivery job successfully enqueued'
    );

    return job;
  } catch (err) {
    // Isolate enqueue failure so stage transitions are never blocked if Redis is temporarily unreachable
    logger.error(
      {
        err: (err as Error).message,
        brokerageId: payload.brokerageId,
        leadId: payload.leadId,
        idempotencyKey: payload.idempotencyKey,
      },
      'Failed to enqueue email delivery job to Redis'
    );
    return null;
  }
}

/**
 * Gracefully shuts down the Email Delivery Queue.
 */
export async function closeEmailQueue(): Promise<void> {
  if (emailQueueInstance) {
    await emailQueueInstance.close();
    emailQueueInstance = null;
    logger.debug('Email delivery queue closed cleanly');
  }
}
