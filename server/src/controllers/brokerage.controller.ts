import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Brokerage } from '../models/brokerage.model.js';
import { authorizationService } from '../services/authorization.service.js';
import { NotFoundError } from '../utils/errors.js';

export class BrokerageController {
  /**
   * Lists all brokerages across the platform.
   * Strictly restricted to PLATFORM_ADMIN.
   */
  async listBrokerages(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brokerages = await Brokerage.find().sort({ createdAt: -1 });
      res.status(200).json({
        success: true,
        data: { brokerages },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Fetches a specific brokerage by ID.
   * Access bounded by requireSameBrokerage guard and authorizationService.
   */
  async getBrokerageById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brokerageId = typeof req.params.brokerageId === 'string' ? req.params.brokerageId : '';
      if (!Types.ObjectId.isValid(brokerageId)) {
        throw new NotFoundError('Brokerage resource not found');
      }

      const brokerage = await Brokerage.findById(brokerageId);
      if (!brokerage) {
        throw new NotFoundError('Brokerage resource not found');
      }

      authorizationService.assertBrokerageAccess(req.user!, brokerage._id);

      res.status(200).json({
        success: true,
        data: { brokerage },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const brokerageController = new BrokerageController();
