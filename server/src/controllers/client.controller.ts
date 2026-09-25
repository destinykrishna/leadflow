import type { Request, Response, NextFunction } from 'express';
import { clientService } from '../services/client.service.js';
import { convertLeadSchema } from '../validators/client.validators.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';

export class ClientController {
  /**
   * Lists clients scoped to the authenticated user's brokerage.
   * Access restricted to PLATFORM_ADMIN, BROKERAGE_ADMIN, and ADVISOR.
   */
  async listClients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const clients = await clientService.listClients(req.user);
      res.status(200).json({
        success: true,
        data: { clients },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetches the personal client case for the authenticated CLIENT user.
   * Derives ownership strictly from session token (req.user.id), preventing IDOR.
   */
  async getMyClientCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const client = await clientService.getMyClientCase(req.user);
      res.status(200).json({
        success: true,
        data: { client },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetches a specific client by ID with strict tenant and ownership checks.
   * - Platform Admin, Brokerage Admin, Advisor: can view client within their brokerage.
   * - Client: can view ONLY their own client record (userId === req.user.id).
   * - Cross-tenant or non-owned returns 404 (IDOR protection without existence disclosure).
   */
  async getClientById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const client = await clientService.getClientById(req.user, id);

      res.status(200).json({
        success: true,
        data: { client },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Converts an eligible lead into a client case.
   * Supports leadId from route params (:leadId) or request body.
   */
  async convertLeadToClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const leadId = req.params.leadId || req.body.leadId;
      if (!leadId || typeof leadId !== 'string') {
        throw new ValidationError('Lead ID is required for client conversion');
      }

      const parsedBody = convertLeadSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ValidationError('Invalid conversion input', parsedBody.error.format());
      }

      const result = await clientService.convertLead(req.user, {
        ...parsedBody.data,
        leadId,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const clientController = new ClientController();
