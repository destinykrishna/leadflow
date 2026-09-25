import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { PipelineTrigger } from '../models/pipeline-trigger.model.js';
import { withBrokerageScope } from '../repositories/base.repository.js';
import { createTriggerSchema, updateTriggerSchema } from '../validators/trigger.validators.js';
import { validateData } from '../validators/common.validators.js';
import { NotFoundError, BrokerageIsolationError } from '../utils/errors.js';

export class TriggerController {
  /**
   * GET /api/triggers
   * Lists pipeline triggers for the authenticated brokerage.
   */
  async listTriggers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const filter =
        user.role === 'PLATFORM_ADMIN'
          ? {}
          : withBrokerageScope(user.brokerageId!, {});

      const triggers = await PipelineTrigger.find(filter)
        .populate('actionConfig.templateId', 'name slug subject')
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: triggers,
        count: triggers.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/triggers/:id
   * Resolves a single trigger by ID with tenant scoping and anti-IDOR 404.
   */
  async getTriggerById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const triggerId = req.params.id as string;

      if (!Types.ObjectId.isValid(triggerId)) {
        throw new NotFoundError('Trigger resource not found');
      }

      const filter =
        user.role === 'PLATFORM_ADMIN'
          ? { _id: new Types.ObjectId(triggerId) }
          : withBrokerageScope(user.brokerageId!, {
              _id: new Types.ObjectId(triggerId),
            });

      const trigger = await PipelineTrigger.findOne(filter).populate(
        'actionConfig.templateId',
        'name slug subject'
      );

      if (!trigger) {
        throw new NotFoundError('Trigger resource not found');
      }

      res.status(200).json({
        success: true,
        data: trigger,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/triggers
   * Creates a new pipeline trigger scoped to the authenticated brokerage.
   */
  async createTrigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const input = validateData(createTriggerSchema, req.body);

      const brokerageId =
        user.role === 'PLATFORM_ADMIN'
          ? (req.body.brokerageId ? new Types.ObjectId(req.body.brokerageId) : null)
          : new Types.ObjectId(user.brokerageId!);

      if (!brokerageId) {
        throw new BrokerageIsolationError('Brokerage context required to create trigger');
      }

      const actionConfig: Record<string, unknown> = { ...input.actionConfig };
      if (input.actionConfig?.templateId) {
        actionConfig.templateId = new Types.ObjectId(input.actionConfig.templateId);
      }

      const trigger = await PipelineTrigger.create({
        brokerageId,
        name: input.name,
        fromStage: input.fromStage || null,
        toStage: input.toStage,
        actionType: input.actionType,
        actionConfig,
        isActive: input.isActive ?? true,
      });

      res.status(201).json({
        success: true,
        data: trigger,
        message: 'Pipeline trigger created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/triggers/:id
   * Updates an existing trigger with tenant scoping.
   */
  async updateTrigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const triggerId = req.params.id as string;
      const input = validateData(updateTriggerSchema, req.body);

      if (!Types.ObjectId.isValid(triggerId)) {
        throw new NotFoundError('Trigger resource not found');
      }

      const filter =
        user.role === 'PLATFORM_ADMIN'
          ? { _id: new Types.ObjectId(triggerId) }
          : withBrokerageScope(user.brokerageId!, {
              _id: new Types.ObjectId(triggerId),
            });

      const updateData: Record<string, unknown> = { ...input };
      if (input.actionConfig) {
        const actionConfig: Record<string, unknown> = { ...input.actionConfig };
        if (input.actionConfig.templateId) {
          actionConfig.templateId = new Types.ObjectId(input.actionConfig.templateId);
        }
        updateData.actionConfig = actionConfig;
      }

      const updated = await PipelineTrigger.findOneAndUpdate(
        filter,
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!updated) {
        throw new NotFoundError('Trigger resource not found');
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Pipeline trigger updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/triggers/:id
   * Deletes a pipeline trigger with tenant scoping.
   */
  async deleteTrigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const triggerId = req.params.id as string;

      if (!Types.ObjectId.isValid(triggerId)) {
        throw new NotFoundError('Trigger resource not found');
      }

      const filter =
        user.role === 'PLATFORM_ADMIN'
          ? { _id: new Types.ObjectId(triggerId) }
          : withBrokerageScope(user.brokerageId!, {
              _id: new Types.ObjectId(triggerId),
            });

      const deleted = await PipelineTrigger.findOneAndDelete(filter);
      if (!deleted) {
        throw new NotFoundError('Trigger resource not found');
      }

      res.status(200).json({
        success: true,
        message: 'Pipeline trigger deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const triggerController = new TriggerController();
