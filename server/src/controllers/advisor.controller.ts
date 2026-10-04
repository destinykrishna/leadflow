import type { Request, Response, NextFunction } from 'express';
import { advisorService } from '../services/advisor.service.js';
import {
  createAdvisorSchema,
  updateAdvisorSchema,
  listAdvisorsQuerySchema,
} from '../validators/advisor.validators.js';
import { AppError, BrokerageIsolationError } from '../utils/errors.js';

export class AdvisorController {
  /**
   * Creates/invites a new advisor within the current brokerage.
   * Access strictly restricted to BROKERAGE_ADMIN and PLATFORM_ADMIN.
   */
  async createAdvisor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramBrokerageId =
        typeof req.params.brokerageId === 'string' ? req.params.brokerageId : undefined;

      // Defend against payload vs route parameter tenant spoofing
      if (
        paramBrokerageId &&
        req.body.brokerageId &&
        req.body.brokerageId.toString() !== paramBrokerageId
      ) {
        throw new BrokerageIsolationError(
          'Access denied: Cross-brokerage tenant boundary violation between route parameter and payload'
        );
      }

      // Default to caller.brokerageId while preserving any explicitly supplied body.brokerageId
      // so AdvisorService can detect cross-tenant tampering attempts.
      const bodyWithBrokerage = {
        ...(req.user?.role === 'BROKERAGE_ADMIN' && req.user.brokerageId
          ? { brokerageId: req.user.brokerageId }
          : paramBrokerageId
            ? { brokerageId: paramBrokerageId }
            : {}),
        ...req.body,
        ...(paramBrokerageId ? { brokerageId: paramBrokerageId } : {}),
      };

      const input = createAdvisorSchema.parse(bodyWithBrokerage);
      const advisor = await advisorService.createAdvisor(req.user!, input);

      res.status(201).json({
        success: true,
        data: { advisor },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lists advisors for the current brokerage.
   * Scoped to caller's brokerage for BROKERAGE_ADMIN.
   */
  async listAdvisors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramBrokerageId =
        typeof req.params.brokerageId === 'string' ? req.params.brokerageId : undefined;

      // Defend against query vs route parameter tenant spoofing
      if (
        paramBrokerageId &&
        req.query.brokerageId &&
        req.query.brokerageId.toString() !== paramBrokerageId
      ) {
        throw new BrokerageIsolationError(
          'Access denied: Cross-brokerage tenant boundary violation between route parameter and query filter'
        );
      }

      const queryWithBrokerage = {
        ...req.query,
        ...(paramBrokerageId ? { brokerageId: paramBrokerageId } : {}),
      };

      const query = listAdvisorsQuerySchema.parse(queryWithBrokerage);
      const result = await advisorService.listAdvisors(req.user!, query);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieves an advisor by ID.
   * Enforces anti-IDOR HTTP 404 concealment across brokerages.
   */
  async getAdvisorById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramBrokerageId =
        typeof req.params.brokerageId === 'string' ? req.params.brokerageId : undefined;
      const advisorId =
        typeof req.params.id === 'string'
          ? req.params.id
          : typeof req.params.advisorId === 'string'
            ? req.params.advisorId
            : '';
      const advisor = await advisorService.getAdvisorById(req.user!, advisorId, paramBrokerageId);

      res.status(200).json({
        success: true,
        data: { advisor },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates an advisor's profile or status (ACTIVE / INACTIVE).
   * Enforces anti-IDOR HTTP 404 concealment across brokerages.
   */
  async updateAdvisor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramBrokerageId =
        typeof req.params.brokerageId === 'string' ? req.params.brokerageId : undefined;
      const advisorId =
        typeof req.params.id === 'string'
          ? req.params.id
          : typeof req.params.advisorId === 'string'
            ? req.params.advisorId
            : '';
      const input = updateAdvisorSchema.parse(req.body);
      const advisor = await advisorService.updateAdvisor(
        req.user!,
        advisorId,
        input,
        paramBrokerageId
      );

      res.status(200).json({
        success: true,
        data: { advisor },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Explicitly disallows hard-deletion of advisor accounts to preserve historical
   * leads, client cases, tasks, and audit trail references.
   */
  deleteAdvisor(_req: Request, _res: Response, next: NextFunction): void {
    next(
      new AppError(
        'Advisors cannot be deleted to preserve historical leads, clients, tasks, and audit integrity. Update advisor status to INACTIVE instead.',
        400,
        'ADVISOR_DELETION_PROHIBITED'
      )
    );
  }

  /**
   * Retrieves aggregated advisor workload metrics across the brokerage.
   * Computes active leads, pending tasks, overdue tasks, and won cases.
   */
  async getAdvisorWorkload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramBrokerageId =
        typeof req.params.brokerageId === 'string' ? req.params.brokerageId : undefined;
      const queryBrokerageId =
        typeof req.query.brokerageId === 'string' ? req.query.brokerageId : paramBrokerageId;

      const workload = await advisorService.getAdvisorWorkload(req.user!, queryBrokerageId);

      res.status(200).json({
        success: true,
        data: workload,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const advisorController = new AdvisorController();
