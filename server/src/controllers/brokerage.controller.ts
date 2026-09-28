import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Brokerage } from '../models/brokerage.model.js';
import { authorizationService } from '../services/authorization.service.js';
import { brokerageService } from '../services/brokerage.service.js';
import {
  createBrokerageSchema,
  updateBrokerageSchema,
} from '../validators/brokerage.validators.js';
import { NotFoundError } from '../utils/errors.js';

export class BrokerageController {
  /**
   * Creates a new brokerage and provisions its initial BROKERAGE_ADMIN account atomically.
   * Strictly restricted to PLATFORM_ADMIN.
   */
  async createBrokerage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = createBrokerageSchema.parse(req.body);
      const result = await brokerageService.createBrokerage(input);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lists all brokerages across the platform.
   * Strictly restricted to PLATFORM_ADMIN.
   */
  async listBrokerages(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brokerages = await Brokerage.find().select('-webhookSecret').sort({ createdAt: -1 });
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
   * Webhook secret is strictly withheld from non-platform admin roles.
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

      const brokerageObj = brokerage.toObject();
      if (req.user?.role !== 'PLATFORM_ADMIN' && req.user?.role !== 'BROKERAGE_ADMIN') {
        delete (brokerageObj as any).webhookSecret;
      }

      res.status(200).json({
        success: true,
        data: { brokerage: brokerageObj },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Updates brokerage lifecycle details (status, plan, name, slug).
   * Restricted to PLATFORM_ADMIN.
   */
  async updateBrokerage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brokerageId = typeof req.params.brokerageId === 'string' ? req.params.brokerageId : '';
      if (!Types.ObjectId.isValid(brokerageId)) {
        throw new NotFoundError('Brokerage resource not found');
      }

      const input = updateBrokerageSchema.parse(req.body);
      const brokerage = await brokerageService.updateBrokerage(brokerageId, input);

      res.status(200).json({
        success: true,
        data: { brokerage },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rotates a brokerage's webhook secret.
   * Restricted to PLATFORM_ADMIN.
   */
  async rotateWebhookSecret(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brokerageId = typeof req.params.brokerageId === 'string' ? req.params.brokerageId : '';
      if (!Types.ObjectId.isValid(brokerageId)) {
        throw new NotFoundError('Brokerage resource not found');
      }

      const result = await brokerageService.rotateWebhookSecret(brokerageId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const brokerageController = new BrokerageController();
