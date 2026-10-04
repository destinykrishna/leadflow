import { Types } from 'mongoose';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { LEAD_STATUSES, type ILeadDocument, type LeadStatus } from '../models/lead.model.js';
import { Lead } from '../models/lead.model.js';
import { User } from '../models/user.model.js';
import { leadRepository } from '../repositories/lead.repository.js';
import { withBrokerageScope } from '../repositories/base.repository.js';
import type { PipelineQuery } from '../validators/lead.validators.js';
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from '../utils/errors.js';
import { triggerService } from './trigger.service.js';
import { activityService } from './activity.service.js';
import { logger } from '../utils/logger.js';

export interface LeadStageChangedEvent {
  brokerageId: string;
  leadId: string;
  previousStage: LeadStatus | null;
  newStage: LeadStatus;
  updatedBy: {
    id: string;
    name: string;
    role: string;
  };
  lead: ILeadDocument;
  timestamp: Date;
}

import { getSocketServer } from '../sockets/index.js';

export interface PipelineStageChangedBroadcastPayload {
  leadId: string;
  brokerageId: string;
  previousStage: LeadStatus | null;
  newStage: LeadStatus;
  version: number;
  timestamp: string;
  updatedBy: {
    id: string;
    name: string;
    role: string;
  };
}

/**
 * Realtime Event Seam:
 * Broadcasts minimal, safe pipeline stage update event to the brokerage's isolated
 * Socket.IO room (`brokerage:<brokerageId>`) and to platform admins (`platform:admins`).
 * Guaranteed to run only after database persistence succeeds.
 */
export function emitPipelineStageChanged(event: LeadStageChangedEvent): void {
  logger.info(
    {
      event: 'pipeline:stage_changed',
      brokerageId: event.brokerageId,
      leadId: event.leadId,
      previousStage: event.previousStage,
      newStage: event.newStage,
      updatedBy: event.updatedBy.id,
    },
    'Pipeline lead stage transitioned'
  );

  const io = getSocketServer();
  if (!io) {
    return;
  }

  const broadcastPayload: PipelineStageChangedBroadcastPayload = {
    leadId: event.leadId,
    brokerageId: event.brokerageId,
    previousStage: event.previousStage,
    newStage: event.newStage,
    version: event.lead.__v,
    timestamp: (event.timestamp || new Date()).toISOString(),
    updatedBy: {
      id: event.updatedBy.id,
      name: event.updatedBy.name,
      role: event.updatedBy.role,
    },
  };

  // 1. Emit to tenant brokerage room
  io.to(`brokerage:${event.brokerageId}`).emit('pipeline:stage_changed', broadcastPayload);
  io.to(`brokerage:${event.brokerageId}`).emit('lead:stage_changed', broadcastPayload);

  // 2. Emit to platform admin room
  io.to('platform:admins').emit('pipeline:stage_changed', broadcastPayload);
  io.to('platform:admins').emit('lead:stage_changed', broadcastPayload);
}

export interface PipelineGroupedResponse {
  pipeline: Record<LeadStatus, ILeadDocument[]>;
  counts: Record<LeadStatus, number>;
  total: number;
  hasMore?: Record<LeadStatus, boolean>;
}

export interface PipelineListResponse {
  leads: ILeadDocument[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export class LeadPipelineService {
  /**
   * Retrieves leads for the authenticated brokerage.
   * If groupBy is 'stage' or 'status', returns a Kanban-ready grouped structure with accurate counts and stage-level limits.
   * Otherwise returns a paginated flat array of leads with true total counts.
   */
  async listLeads(
    userContext: AuthUserContext,
    query: PipelineQuery
  ): Promise<PipelineGroupedResponse | PipelineListResponse> {
    if (query.groupBy === 'stage' || query.groupBy === 'status') {
      return leadRepository.getPipelineGrouped(userContext, query);
    }

    return leadRepository.findPipelineLeadsWithCount(userContext, query);
  }

  /**
   * Archives a lead (soft-delete), excluding it from active pipeline and list queries.
   */
  async archiveLead(userContext: AuthUserContext, leadId: string): Promise<ILeadDocument> {
    const lead = await leadRepository.archiveLead(userContext, leadId);
    if (!lead) {
      throw new NotFoundError('Lead resource not found');
    }
    return lead;
  }

  /**
   * Restores an archived lead back to active status.
   */
  async unarchiveLead(userContext: AuthUserContext, leadId: string): Promise<ILeadDocument> {
    const lead = await leadRepository.unarchiveLead(userContext, leadId);
    if (!lead) {
      throw new NotFoundError('Lead resource not found');
    }
    return lead;
  }

  /**
   * Resolves a single lead by ID with tenant boundary isolation and populated advisor details.
   */
  async getLeadById(userContext: AuthUserContext, leadId: string): Promise<ILeadDocument> {
    const lead = await leadRepository.findLeadById(userContext, leadId);
    if (!lead) {
      throw new NotFoundError('Lead resource not found');
    }
    return lead;
  }

  /**
   * Transitions a lead to a new stage enforcing:
   * 1. Tenant boundary scoping (cross-tenant IDs return 404).
   * 2. State machine stage progression (WON/LOST terminal, no backward moves or skipping).
   * 3. Database-level optimistic concurrency control (prevents concurrent overwrite/lost updates).
   */
  async moveLeadStage(
    userContext: AuthUserContext,
    leadId: string,
    targetStage: LeadStatus,
    expectedVersion?: number
  ): Promise<{
    lead: ILeadDocument;
    previousStage: LeadStatus;
    currentStage: LeadStatus;
  }> {
    const result = await leadRepository.atomicUpdateStage(
      userContext,
      leadId,
      targetStage,
      expectedVersion
    );

    if (!result.success) {
      if (result.error === 'NOT_FOUND') {
        throw new NotFoundError(result.message || 'Lead resource not found');
      }
      if (result.error === 'INVALID_TRANSITION') {
        throw new ValidationError(result.message || 'Invalid stage transition');
      }
      if (result.error === 'CONFLICT') {
        throw new ConflictError(
          result.message || 'Stage update conflict: Lead has been modified concurrently'
        );
      }
      throw new ValidationError(result.message || 'Stage transition failed');
    }

    // Trigger realtime broadcast seam hook
    emitPipelineStageChanged({
      brokerageId: userContext.brokerageId || result.lead!.brokerageId.toString(),
      leadId: result.lead!._id.toString(),
      previousStage: result.previousStage!,
      newStage: result.currentStage!,
      updatedBy: {
        id: userContext.id,
        name: userContext.name,
        role: userContext.role,
      },
      lead: result.lead!,
      timestamp: new Date(),
    });

    // Record immutable activity log (failure isolated, never throws)
    void activityService.logActivity({
      brokerageId: userContext.brokerageId || result.lead!.brokerageId.toString(),
      entityType: 'LEAD',
      entityId: result.lead!._id,
      leadId: result.lead!._id,
      action: 'STAGE_CHANGED',
      actor: {
        id: userContext.id,
        name: userContext.name,
        role: userContext.role,
        email: userContext.email,
      },
      metadata: {
        previousStage: result.previousStage,
        newStage: result.currentStage,
      },
    });

    // Execute configured stage automation triggers (tasks & emails) non-blocking
    triggerService
      .handleStageTransition({
        brokerageId: userContext.brokerageId || result.lead!.brokerageId.toString(),
        lead: result.lead!,
        previousStage: result.previousStage!,
        newStage: result.currentStage!,
        updatedBy: {
          id: userContext.id,
          name: userContext.name,
          role: userContext.role,
        },
      })
      .catch((triggerErr) => {
        logger.error(
          {
            err: (triggerErr as Error).message,
            leadId: result.lead!._id.toString(),
            targetStage,
          },
          'Error executing background stage transition triggers'
        );
      });

    return {
      lead: result.lead!,
      previousStage: result.previousStage!,
      currentStage: result.currentStage!,
    };
  }

  /**
   * Assigns or reassigns an ACTIVE ADVISOR from the same brokerage to a lead.
   * Only BROKERAGE_ADMIN and PLATFORM_ADMIN may call this.
   * Validates:
   *  - Lead exists and belongs to caller's brokerage (anti-IDOR).
   *  - Target advisor exists, has role=ADVISOR, status=ACTIVE, same brokerageId.
   *  - Rejects CLIENT, PLATFORM_ADMIN, BROKERAGE_ADMIN, or cross-tenant targets.
   * Emits realtime `lead:assigned` event after successful DB write.
   */
  async assignAdvisor(
    userContext: AuthUserContext,
    leadId: string,
    advisorId: string
  ): Promise<ILeadDocument> {
    if (userContext.role !== 'PLATFORM_ADMIN' && userContext.role !== 'BROKERAGE_ADMIN') {
      throw new ForbiddenError(
        'Only Brokerage Admins and Platform Admins can assign leads to advisors'
      );
    }

    if (!Types.ObjectId.isValid(leadId)) {
      throw new NotFoundError('Lead resource not found');
    }
    if (!Types.ObjectId.isValid(advisorId)) {
      throw new ValidationError('Invalid advisorId format');
    }

    const brokerageIdStr =
      userContext.role === 'PLATFORM_ADMIN' ? null : userContext.brokerageId;

    // 1. Resolve lead with tenant isolation (anti-IDOR: cross-tenant returns 404)
    const lead = await leadRepository.findLeadById(userContext, leadId);
    if (!lead) {
      throw new NotFoundError('Lead resource not found');
    }

    const leadBrokerageId = lead.brokerageId.toString();

    // 2. Resolve and validate target advisor
    const advisor = await User.findOne(
      withBrokerageScope(leadBrokerageId, {
        _id: new Types.ObjectId(advisorId),
        role: 'ADVISOR',
      })
    );

    if (!advisor) {
      // Distinguish cross-brokerage tampering from not-found for clear error messaging
      const anyAdvisor = await User.findById(new Types.ObjectId(advisorId));
      if (anyAdvisor && anyAdvisor.brokerageId?.toString() !== leadBrokerageId) {
        throw new ValidationError('Cannot assign an advisor from another brokerage to this lead');
      }
      throw new NotFoundError('Advisor not found in this brokerage');
    }

    if (advisor.status !== 'ACTIVE') {
      throw new ValidationError(
        `Advisor ${advisor.name} is ${advisor.status.toLowerCase()} and cannot be assigned new leads`
      );
    }

    // 3. Atomic update
    const updatedLead = await Lead.findOneAndUpdate(
      {
        _id: new Types.ObjectId(leadId),
        brokerageId: lead.brokerageId,
      },
      { $set: { assignedTo: advisor._id } },
      { returnDocument: 'after' }
    ).populate('assignedTo', '_id name email');

    if (!updatedLead) {
      throw new NotFoundError('Lead resource not found');
    }

    // 4. Realtime broadcast
    const io = getSocketServer();
    if (io) {
      const payload = {
        leadId: updatedLead._id.toString(),
        brokerageId: leadBrokerageId,
        advisorId: advisor._id.toString(),
        advisorName: advisor.name,
        timestamp: new Date().toISOString(),
        updatedBy: { id: userContext.id, name: userContext.name, role: userContext.role },
      };
      io.to(`brokerage:${leadBrokerageId}`).emit('lead:assigned', payload);
      io.to('platform:admins').emit('lead:assigned', payload);
    }

    logger.info(
      {
        leadId,
        advisorId: advisor._id.toString(),
        brokerageId: leadBrokerageId,
        assignedBy: userContext.id,
      },
      'Lead advisor assignment updated'
    );

    // Record immutable activity log (failure isolated, never throws)
    void activityService.logActivity({
      brokerageId: leadBrokerageId,
      entityType: 'LEAD',
      entityId: updatedLead._id,
      leadId: updatedLead._id,
      action: 'ADVISOR_ASSIGNED',
      actor: {
        id: userContext.id,
        name: userContext.name,
        role: userContext.role,
        email: userContext.email,
      },
      metadata: {
        advisorId: advisor._id.toString(),
        advisorName: advisor.name,
      },
    });

    return updatedLead;
  }

  /**
   * Reopens a lead currently in LOST status back to NEW stage.
   * Enforces tenant boundary scoping, LOST status verification, and optimistic concurrency version matching.
   */
  async reopenLead(
    userContext: AuthUserContext,
    leadId: string,
    expectedVersion?: number,
    reason?: string
  ): Promise<{
    lead: ILeadDocument;
    previousStage: LeadStatus;
    currentStage: LeadStatus;
  }> {
    const result = await leadRepository.reopenLead(
      userContext,
      leadId,
      expectedVersion,
      reason
    );

    if (!result.success) {
      if (result.error === 'NOT_FOUND') {
        throw new NotFoundError(result.message || 'Lead resource not found');
      }
      if (result.error === 'INVALID_TRANSITION') {
        throw new ValidationError(result.message || "Only leads in 'LOST' status can be reopened");
      }
      if (result.error === 'CONFLICT') {
        throw new ConflictError(
          result.message || 'Stage update conflict: Lead has been modified concurrently'
        );
      }
      throw new ValidationError(result.message || 'Reopening lead failed');
    }

    // Trigger realtime broadcast seam hook
    emitPipelineStageChanged({
      brokerageId: userContext.brokerageId || result.lead!.brokerageId.toString(),
      leadId: result.lead!._id.toString(),
      previousStage: 'LOST',
      newStage: 'NEW',
      updatedBy: {
        id: userContext.id,
        name: userContext.name,
        role: userContext.role,
      },
      lead: result.lead!,
      timestamp: new Date(),
    });

    // Record immutable activity log (failure isolated, never throws)
    void activityService.logActivity({
      brokerageId: userContext.brokerageId || result.lead!.brokerageId.toString(),
      entityType: 'LEAD',
      entityId: result.lead!._id,
      leadId: result.lead!._id,
      action: 'LEAD_REOPENED',
      actor: {
        id: userContext.id,
        name: userContext.name,
        role: userContext.role,
        email: userContext.email,
      },
      metadata: {
        previousStage: 'LOST',
        newStage: 'NEW',
        reason: reason || null,
      },
    });

    // Execute configured stage automation triggers for NEW stage non-blocking
    triggerService
      .handleStageTransition({
        brokerageId: userContext.brokerageId || result.lead!.brokerageId.toString(),
        lead: result.lead!,
        previousStage: 'LOST',
        newStage: 'NEW',
        updatedBy: {
          id: userContext.id,
          name: userContext.name,
          role: userContext.role,
        },
      })
      .catch((triggerErr) => {
        logger.error(
          {
            err: (triggerErr as Error).message,
            leadId: result.lead!._id.toString(),
            targetStage: 'NEW',
          },
          'Error executing background stage transition triggers on reopen'
        );
      });

    return {
      lead: result.lead!,
      previousStage: 'LOST',
      currentStage: 'NEW',
    };
  }
}

export const leadPipelineService = new LeadPipelineService();
