import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { leadPipelineService } from '../services/lead-pipeline.service.js';
import { clientService } from '../services/client.service.js';
import {
  pipelineQuerySchema,
  leadIdParamSchema,
  updateLeadStageSchema,
  reopenLeadSchema,
} from '../validators/lead.validators.js';
import { convertLeadSchema } from '../validators/client.validators.js';
import { ValidationError, UnauthorizedError, NotFoundError } from '../utils/errors.js';
import { EmailLog } from '../models/email-log.model.js';
import { withBrokerageScope } from '../repositories/base.repository.js';

export class LeadController {
  /**
   * Lists leads for the current brokerage.
   * Supports filtering by stage, assigned advisor, search terms, and optional grouping by stage.
   */
  async listLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedQuery = pipelineQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError('Invalid pipeline query parameters', parsedQuery.error.format());
      }

      const result = await leadPipelineService.listLeads(req.user, parsedQuery.data);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pipeline board convenience endpoint.
   * Always groups leads across all 7 pipeline stages with summary counts.
   */
  async getPipeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedQuery = pipelineQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ValidationError('Invalid pipeline query parameters', parsedQuery.error.format());
      }

      const result = await leadPipelineService.listLeads(req.user, {
        ...parsedQuery.data,
        groupBy: 'stage',
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves a single lead by ID with populated advisor details.
   */
  async getLeadById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedParam = leadIdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        throw new ValidationError('Invalid lead ID format', parsedParam.error.format());
      }

      const lead = await leadPipelineService.getLeadById(req.user, parsedParam.data.id);

      res.status(200).json({
        success: true,
        data: { lead },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Transitions a lead to a new stage enforcing:
   * 1. State machine rules (linear progress, WON/LOST are terminal).
   * 2. Brokerage tenant boundary (cross-tenant IDs return 404).
   * 3. Database optimistic concurrency (matching __v and status).
   */
  async updateLeadStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedParam = leadIdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        throw new ValidationError('Invalid lead ID format', parsedParam.error.format());
      }

      const parsedBody = updateLeadStageSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError('Invalid stage update payload', parsedBody.error.format());
      }

      const targetStage = (parsedBody.data.stage ?? parsedBody.data.status)!;
      const result = await leadPipelineService.moveLeadStage(
        req.user,
        parsedParam.data.id,
        targetStage,
        parsedBody.data.version
      );

      res.status(200).json({
        success: true,
        message: 'Lead stage updated successfully',
        data: {
          lead: result.lead,
          previousStage: result.previousStage,
          currentStage: result.currentStage,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Converts an eligible lead to a client case.
   */
  async convertLeadToClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedParam = leadIdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        throw new ValidationError('Invalid lead ID format', parsedParam.error.format());
      }

      const parsedBody = convertLeadSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError('Invalid conversion input', parsedBody.error.format());
      }

      const result = await clientService.convertLead(req.user, {
        ...parsedBody.data,
        leadId: parsedParam.data.id,
      });

      res.status(201).json({
        success: true,
        message: 'Lead successfully converted to client case',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Archives a lead (soft-delete). Excludes the lead from active pipeline and list views.
   */
  async archiveLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedParam = leadIdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        throw new ValidationError('Invalid lead ID format', parsedParam.error.format());
      }

      const lead = await leadPipelineService.archiveLead(req.user, parsedParam.data.id);

      res.status(200).json({
        success: true,
        message: 'Lead archived successfully',
        data: { lead },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Restores an archived lead back to active status.
   */
  async unarchiveLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedParam = leadIdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        throw new ValidationError('Invalid lead ID format', parsedParam.error.format());
      }

      const lead = await leadPipelineService.unarchiveLead(req.user, parsedParam.data.id);

      res.status(200).json({
        success: true,
        message: 'Lead restored successfully',
        data: { lead },
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Assigns or reassigns an ACTIVE ADVISOR from the same brokerage to a lead.
   * Restricted to BROKERAGE_ADMIN and PLATFORM_ADMIN.
   */
  async assignAdvisor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedParam = leadIdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        throw new ValidationError('Invalid lead ID format', parsedParam.error.format());
      }

      const { advisorId } = req.body as { advisorId?: unknown };
      if (!advisorId || typeof advisorId !== 'string' || !Types.ObjectId.isValid(advisorId)) {
        throw new ValidationError('advisorId must be a valid ObjectId');
      }

      const lead = await leadPipelineService.assignAdvisor(
        req.user,
        parsedParam.data.id,
        advisorId
      );

      res.status(200).json({
        success: true,
        message: 'Advisor assigned to lead successfully',
        data: { lead },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves email delivery history for a lead.
   * Scoped to the authenticated brokerage, anti-IDOR protected.
   */
  async getLeadEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedParam = leadIdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        throw new ValidationError('Invalid lead ID format', parsedParam.error.format());
      }

      const lead = await leadPipelineService.getLeadById(req.user, parsedParam.data.id);
      if (!lead) {
        throw new NotFoundError('Lead resource not found');
      }

      const emails = await EmailLog.find(
        req.user.role === 'PLATFORM_ADMIN'
          ? { leadId: new Types.ObjectId(parsedParam.data.id) }
          : withBrokerageScope(req.user.brokerageId!, {
              leadId: new Types.ObjectId(parsedParam.data.id),
            })
      ).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: emails,
        count: emails.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reopens a lead from LOST stage back to NEW stage.
   * Restricted to staff roles (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR).
   */
  async reopenLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const parsedParam = leadIdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        throw new ValidationError('Invalid lead ID format', parsedParam.error.format());
      }

      const parsedBody = reopenLeadSchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        throw new ValidationError('Invalid reopen payload', parsedBody.error.format());
      }

      const result = await leadPipelineService.reopenLead(
        req.user,
        parsedParam.data.id,
        parsedBody.data.version,
        parsedBody.data.reason
      );

      res.status(200).json({
        success: true,
        message: 'Lead reopened successfully',
        data: {
          lead: result.lead,
          previousStage: result.previousStage,
          currentStage: result.currentStage,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const leadController = new LeadController();
