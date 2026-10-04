import { getSocketServer } from '../sockets/index.js';
import { getSharedRedisClient, getSharedSubscriberClient } from './redis.connection.js';
import { logger } from '../utils/logger.js';

export const AUTOMATION_EVENTS_CHANNEL = 'leadflow:events:automation_status';

export interface AutomationTaskCreatedPayload {
  brokerageId: string;
  leadId: string;
  taskId: string;
  taskTitle: string;
  assignedToName: string;
  message: string;
}

export interface AutomationEmailQueuedPayload {
  brokerageId: string;
  leadId: string;
  triggerId: string;
  recipient: string;
  message: string;
}

export interface AutomationEmailSentPayload {
  brokerageId: string;
  leadId: string;
  jobId: string;
  recipient: string;
  messageId: string;
  message: string;
}

export interface AutomationEmailFailedPayload {
  brokerageId: string;
  leadId: string;
  jobId: string;
  recipient: string;
  error: string;
  message: string;
}

export interface AutomationEmailDeliveredPayload {
  brokerageId: string;
  leadId?: string | undefined;
  messageId: string;
  recipient: string;
  message: string;
}

export interface AutomationEmailBouncedPayload {
  brokerageId: string;
  leadId?: string | undefined;
  messageId: string;
  recipient: string;
  reason?: string | undefined;
  message: string;
}

export type AutomationEventType =
  | 'automation:task_created'
  | 'automation:email_queued'
  | 'automation:email_sent'
  | 'automation:email_failed'
  | 'automation:email_delivered'
  | 'automation:email_bounced';

export interface AutomationEventEnvelope {
  event: AutomationEventType;
  payload:
    | AutomationTaskCreatedPayload
    | AutomationEmailQueuedPayload
    | AutomationEmailSentPayload
    | AutomationEmailFailedPayload
    | AutomationEmailDeliveredPayload
    | AutomationEmailBouncedPayload;
}

/**
 * Broadcasts an automation event to tenant-isolated Socket.IO rooms.
 */
function broadcastAutomationEvent(envelope: AutomationEventEnvelope): void {
  const io = getSocketServer();
  if (!io) return;

  const { event, payload } = envelope;

  // 1. Emit to tenant brokerage room (advisors and brokerage admins)
  io.to(`brokerage:${payload.brokerageId}`).emit(event, payload);

  // 2. Emit to platform admin room
  io.to('platform:admins').emit(event, payload);
}

/**
 * Emits an automation execution event both in-process via Socket.IO and
 * publishes to Redis pub/sub for cross-process worker synchronization.
 */
export function emitAutomationEvent(envelope: AutomationEventEnvelope): void {
  logger.info(
    { event: envelope.event, brokerageId: envelope.payload.brokerageId },
    'Automation execution event emitted'
  );

  // 1. In-process Socket.IO broadcast
  broadcastAutomationEvent(envelope);

  // 2. Redis Pub/Sub for multi-process worker / server setups
  try {
    const redis = getSharedRedisClient();
    redis
      .publish(AUTOMATION_EVENTS_CHANNEL, JSON.stringify(envelope))
      .catch((err) => {
        logger.debug({ err: err.message }, 'Failed to publish automation event to Redis');
      });
  } catch (err) {
    logger.debug({ err }, 'Redis publishing suppressed for automation event');
  }
}

let isSubscribed = false;

/**
 * Sets up Redis subscriber to listen for cross-process worker events
 * and broadcast them via Socket.IO.
 */
export function setupAutomationEventsSubscriber(): void {
  if (isSubscribed) return;

  try {
    const subscriber = getSharedSubscriberClient();
    subscriber.subscribe(AUTOMATION_EVENTS_CHANNEL, (err) => {
      if (err) {
        logger.error({ err: err.message }, 'Failed to subscribe to automation events channel');
        return;
      }
      isSubscribed = true;
      logger.info(`Subscribed to Redis channel: ${AUTOMATION_EVENTS_CHANNEL}`);
    });

    subscriber.on('message', (channel, message) => {
      if (channel !== AUTOMATION_EVENTS_CHANNEL) return;
      try {
        const envelope = JSON.parse(message) as AutomationEventEnvelope;
        if (envelope?.event && envelope?.payload) {
          broadcastAutomationEvent(envelope);
        }
      } catch (parseError) {
        logger.warn({ parseError }, 'Malformed automation event received on Redis pub/sub');
      }
    });
  } catch (error) {
    logger.warn({ error }, 'Could not initialize automation events Redis subscriber');
  }
}
