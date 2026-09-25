import type { Request, Response, NextFunction } from 'express';
import { clientRepository } from '../repositories/client.repository.js';
import { authorizationService } from '../services/authorization.service.js';
import { NotFoundError } from '../utils/errors.js';

export class ClientController {
  /**
   * Lists clients scoped to the authenticated user's brokerage.
   * Access restricted to PLATFORM_ADMIN, BROKERAGE_ADMIN, and ADVISOR.
   */
  async listClients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const clients = await clientRepository.find(req.user!);
      res.status(200).json({
        success: true,
        data: { clients },
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
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      const client = await clientRepository.findById(req.user!, id);
      if (!client) {
        throw new NotFoundError('Client resource not found');
      }

      authorizationService.authorizeClientAccess(req.user!, client);

      res.status(200).json({
        success: true,
        data: { client },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const clientController = new ClientController();
