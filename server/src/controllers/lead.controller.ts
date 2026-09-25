import type { Request, Response, NextFunction } from 'express';
import { leadPipelineService } from '../services/lead-pipeline.service.js';
import {
  pipelineQuerySchema,
  leadIdParamSchema,
  updateLeadStageSchema,
} from '../validators/lead.validators.js';
import { ValidationError, UnauthorizedError } from '../utils/errors.js';

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
}

export const leadController = new LeadController();
