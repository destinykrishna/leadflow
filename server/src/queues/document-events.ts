import { getSocketServer } from '../sockets/index.js';
import { getSharedRedisClient, getSharedSubscriberClient } from './redis.connection.js';
import type { DocumentStatus, DocumentType } from '../models/document.model.js';
import { logger } from '../utils/logger.js';

export const DOCUMENT_EVENTS_CHANNEL = 'leadflow:events:document_status';

export interface DocumentStatusChangedEvent {
  documentId: string;
  brokerageId: string;
  clientId?: string | null | undefined;
  leadId?: string | null | undefined;
  uploadedBy?: string | null | undefined;
  clientUserId?: string | null | undefined;
  previousStatus: DocumentStatus;
  newStatus: DocumentStatus;
  type: DocumentType;
  title: string;
  verificationNotes?: string | null | undefined;
  verifiedAt?: Date | null | undefined;
  updatedAt?: Date | null | undefined;
}

export interface DocumentStatusChangedBroadcastPayload {
  documentId: string;
  brokerageId: string;
  clientId?: string | null | undefined;
  leadId?: string | null | undefined;
  previousStatus: DocumentStatus;
  newStatus: DocumentStatus;
  type: DocumentType;
  title: string;
  verificationNotes?: string | null | undefined;
  verifiedAt?: string | null | undefined;
  updatedAt: string;
}

/**
 * Broadcasts document status changed event to appropriate Socket.IO rooms.
 * Strictly respects tenant isolation and does NOT leak internal credentials or storage keys.
 */
function broadcastToSocketRooms(
  event: DocumentStatusChangedEvent,
  payload: DocumentStatusChangedBroadcastPayload
): void {
  const io = getSocketServer();
  if (!io) {
    return;
  }

  // 1. Emit to tenant brokerage room (advisors & brokerage admins)
  io.to(`brokerage:${event.brokerageId}`).emit('document:status_changed', payload);

  // 2. Emit to platform admin room
  io.to('platform:admins').emit('document:status_changed', payload);

  // 3. Emit to expat client user room if known
  if (event.uploadedBy) {
    io.to(`client:${event.uploadedBy}`).emit('document:status_changed', payload);
  }
  if (event.clientUserId && event.clientUserId !== event.uploadedBy) {
    io.to(`client:${event.clientUserId}`).emit('document:status_changed', payload);
  }
}

/**
 * Realtime Event Seam:
 * Broadcasts document status transition to isolated Socket.IO rooms and publishes
 * to Redis pub/sub channel for cross-process synchronization.
 * Guaranteed to be called strictly after database state changes are committed.
 */
export function emitDocumentStatusChanged(event: DocumentStatusChangedEvent): void {
  const broadcastPayload: DocumentStatusChangedBroadcastPayload = {
    documentId: event.documentId,
    brokerageId: event.brokerageId,
    clientId: event.clientId || undefined,
    leadId: event.leadId || undefined,
    previousStatus: event.previousStatus,
    newStatus: event.newStatus,
    type: event.type,
    title: event.title,
    verificationNotes: event.verificationNotes || undefined,
    verifiedAt: event.verifiedAt ? event.verifiedAt.toISOString() : undefined,
    updatedAt: (event.updatedAt || new Date()).toISOString(),
  };

  logger.info(
    {
      event: 'document:status_changed',
      documentId: event.documentId,
      brokerageId: event.brokerageId,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
    },
    'Document verification status transitioned'
  );

  // 1. Direct in-process Socket.IO broadcast
  broadcastToSocketRooms(event, broadcastPayload);

  // 2. Redis Pub/Sub for multi-process worker / server setups
  try {
    const redis = getSharedRedisClient();
    redis
      .publish(
        DOCUMENT_EVENTS_CHANNEL,
        JSON.stringify({ event, payload: broadcastPayload })
      )
      .catch((err) => {
        logger.debug({ err: err.message }, 'Failed to publish document event to Redis');
      });
  } catch (err) {
    logger.debug({ err }, 'Redis publishing suppressed');
  }
}

let isSubscribed = false;

/**
 * Sets up Redis subscriber to listen for cross-process worker events
 * and broadcast them via Socket.IO.
 */
export function setupDocumentEventsSubscriber(): void {
  if (isSubscribed) {
    return;
  }

  try {
    const subscriber = getSharedSubscriberClient();
    subscriber.subscribe(DOCUMENT_EVENTS_CHANNEL, (err) => {
      if (err) {
        logger.error({ err: err.message }, 'Failed to subscribe to document events channel');
        return;
      }
      isSubscribed = true;
      logger.info(`Subscribed to Redis channel: ${DOCUMENT_EVENTS_CHANNEL}`);
    });

    subscriber.on('message', (channel, message) => {
      if (channel !== DOCUMENT_EVENTS_CHANNEL) {
        return;
      }
      try {
        const parsed = JSON.parse(message);
        if (parsed?.event && parsed?.payload) {
          broadcastToSocketRooms(parsed.event, parsed.payload);
        }
      } catch (parseError) {
        logger.warn({ parseError }, 'Malformed document status event received on Redis pub/sub');
      }
    });
  } catch (error) {
    logger.warn({ error }, 'Could not initialize document events Redis subscriber');
  }
}
