import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { LEAD_STATUSES, type ILeadDocument, type LeadStatus } from '../models/lead.model.js';
import { leadRepository } from '../repositories/lead.repository.js';
import type { PipelineQuery } from '../validators/lead.validators.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { triggerService } from './trigger.service.js';
import { logger } from '../utils/logger.js';

export interface LeadStageChangedEvent {
  brokerageId: string;
  leadId: string;
  previousStage: LeadStatus;
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
  previousStage: LeadStatus;
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
}

export const leadPipelineService = new LeadPipelineService();
