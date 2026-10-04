import { Types } from 'mongoose';
import {
  ActivityLog,
  type IActivityLogDocument,
  type ActivityAction,
  type ActivityEntityType,
  type IActivityActor,
} from '../models/activity-log.model.js';
import { Lead } from '../models/lead.model.js';
import { Client } from '../models/client.model.js';
import { withBrokerageScope } from '../repositories/base.repository.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const FORBIDDEN_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'valueOf',
  'toString',
  'toLocaleString',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'hasOwnProperty',
]);

const SENSITIVE_KEY_REGEX = /(password|token|secret|hash|apiKey|auth|creditCard|ssn)/i;

/**
 * Safely sanitizes arbitrary metadata before logging.
 * Defends against prototype pollution, internal method access, and credential leakage.
 */
export function sanitizeActivityMetadata(
  input: unknown,
  depth = 0,
  maxDepth = 3
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || depth > maxDepth) {
    return {};
  }

  const result: Record<string, unknown> = {};
  const entries = input instanceof Map ? Array.from(input.entries()) : Object.entries(input);

  for (const [rawKey, value] of entries) {
    const key = String(rawKey);
    if (FORBIDDEN_PROPERTIES.has(key) || SENSITIVE_KEY_REGEX.test(key)) {
      continue;
    }

    if (value === null || value === undefined) {
      continue;
    }

    if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (value instanceof Types.ObjectId) {
      result[key] = value.toString();
    } else if (Array.isArray(value)) {
      result[key] = value.slice(0, 10).map((item) => {
        if (item instanceof Types.ObjectId) return item.toString();
        if (item instanceof Date) return item.toISOString();
        if (typeof item === 'object' && item !== null) {
          return sanitizeActivityMetadata(item, depth + 1, maxDepth);
        }
        return item;
      });
    } else if (typeof value === 'object') {
      result[key] = sanitizeActivityMetadata(value, depth + 1, maxDepth);
    } else if (typeof value === 'string' && value.length > 500) {
      result[key] = `${value.slice(0, 500)}...`;
    } else {
      result[key] = value;
    }
  }

  return result;
}

export interface LogActivityInput {
  brokerageId: Types.ObjectId | string;
  entityType: ActivityEntityType;
  entityId: Types.ObjectId | string;
  action: ActivityAction;
  actor?: IActivityActor | null | undefined;
  leadId?: Types.ObjectId | string | null | undefined;
  clientId?: Types.ObjectId | string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface TimelineQueryOptions {
  page?: number | string | undefined;
  limit?: number | string | undefined;
}

export interface AuditLogQueryOptions extends TimelineQueryOptions {
  action?: ActivityAction | undefined;
  entityType?: ActivityEntityType | undefined;
  brokerageId?: string | undefined;
}

export interface PaginatedActivitiesResult {
  activities: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ActivityService {
  /**
   * Records an immutable activity log entry.
   * CRITICAL GUARANTEE: Never throws or interrupts the calling business operation.
   * If database persistence fails, it logs a warning with Pino and gracefully returns null.
   */
  async logActivity(input: LogActivityInput): Promise<IActivityLogDocument | null> {
    try {
      if (!input.brokerageId || !input.entityId) {
        return null;
      }

      const sanitizedMeta = sanitizeActivityMetadata(input.metadata);

      const parsedActor: IActivityActor = input.actor
        ? {
            id: input.actor.id ? input.actor.id.toString() : null,
            name: input.actor.name || 'System',
            role: input.actor.role || 'SYSTEM',
            email: input.actor.email || null,
          }
        : {
            id: null,
            name: 'System',
            role: 'SYSTEM',
            email: null,
          };

      const doc = await ActivityLog.create({
        brokerageId:
          typeof input.brokerageId === 'string'
            ? new Types.ObjectId(input.brokerageId)
            : input.brokerageId,
        entityType: input.entityType,
        entityId:
          typeof input.entityId === 'string'
            ? new Types.ObjectId(input.entityId)
            : input.entityId,
        action: input.action,
        actor: parsedActor,
        leadId:
          input.leadId && Types.ObjectId.isValid(input.leadId)
            ? new Types.ObjectId(input.leadId)
            : null,
        clientId:
          input.clientId && Types.ObjectId.isValid(input.clientId)
            ? new Types.ObjectId(input.clientId)
            : null,
        metadata: sanitizedMeta,
      });

      return doc;
    } catch (err: unknown) {
      logger.warn(
        {
          err: (err as Error).message,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId?.toString(),
          brokerageId: input.brokerageId?.toString(),
        },
        'Failed to record activity log; continuing primary business operation without error'
      );
      return null;
    }
  }

  /**
   * Retrieves paginated activity timeline for a lead.
   * Strictly enforces anti-IDOR 404 behavior and RBAC (CLIENT forbidden).
   */
  async getLeadTimeline(
    caller: AuthUserContext,
    leadId: string,
    options: TimelineQueryOptions = {}
  ): Promise<PaginatedActivitiesResult> {
    if (caller.role === 'CLIENT') {
      throw new ForbiddenError('Clients are not authorized to view internal activity logs');
    }

    if (!Types.ObjectId.isValid(leadId)) {
      throw new NotFoundError('Lead resource not found');
    }

    const leadObjectId = new Types.ObjectId(leadId);

    // Verify lead existence in caller's brokerage (anti-IDOR 404 concealment)
    const lead = await Lead.findOne(
      caller.role === 'PLATFORM_ADMIN'
        ? { _id: leadObjectId }
        : withBrokerageScope(caller.brokerageId!, { _id: leadObjectId })
    );

    if (!lead) {
      throw new NotFoundError('Lead resource not found');
    }

    const leadBrokerageId = lead.brokerageId;

    const filter: Record<string, unknown> = {
      brokerageId: leadBrokerageId,
      $or: [{ entityId: leadObjectId }, { leadId: leadObjectId }],
    };

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(filter),
    ]);

    return {
      activities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves paginated activity timeline for a client case.
   * Strictly enforces anti-IDOR 404 behavior and RBAC (CLIENT forbidden).
   */
  async getClientTimeline(
    caller: AuthUserContext,
    clientId: string,
    options: TimelineQueryOptions = {}
  ): Promise<PaginatedActivitiesResult> {
    if (caller.role === 'CLIENT') {
      throw new ForbiddenError('Clients are not authorized to view internal activity logs');
    }

    if (!Types.ObjectId.isValid(clientId)) {
      throw new NotFoundError('Client resource not found');
    }

    const clientObjectId = new Types.ObjectId(clientId);

    // Verify client existence in caller's brokerage (anti-IDOR 404 concealment)
    const client = await Client.findOne(
      caller.role === 'PLATFORM_ADMIN'
        ? { _id: clientObjectId }
        : withBrokerageScope(caller.brokerageId!, { _id: clientObjectId })
    );

    if (!client) {
      throw new NotFoundError('Client resource not found');
    }

    const clientBrokerageId = client.brokerageId;

    const filter: Record<string, unknown> = {
      brokerageId: clientBrokerageId,
      $or: [{ entityId: clientObjectId }, { clientId: clientObjectId }],
    };

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(filter),
    ]);

    return {
      activities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves brokerage-wide audit logs for administrative views.
   * Restricted to PLATFORM_ADMIN and BROKERAGE_ADMIN only.
   */
  async getBrokerageAuditLogs(
    caller: AuthUserContext,
    options: AuditLogQueryOptions = {}
  ): Promise<PaginatedActivitiesResult> {
    if (caller.role !== 'PLATFORM_ADMIN' && caller.role !== 'BROKERAGE_ADMIN') {
      throw new ForbiddenError(
        'Only Brokerage Admins and Platform Admins can view administrative audit logs'
      );
    }

    let targetBrokerageId: Types.ObjectId | null = null;
    if (caller.role === 'PLATFORM_ADMIN') {
      if (options.brokerageId && Types.ObjectId.isValid(options.brokerageId)) {
        targetBrokerageId = new Types.ObjectId(options.brokerageId);
      }
    } else {
      targetBrokerageId = new Types.ObjectId(caller.brokerageId!);
    }

    const filter: Record<string, unknown> = {};
    if (targetBrokerageId) {
      filter.brokerageId = targetBrokerageId;
    }

    if (options.action) {
      filter.action = options.action;
    }
    if (options.entityType) {
      filter.entityType = options.entityType;
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 25));
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(filter),
    ]);

    return {
      activities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const activityService = new ActivityService();
