import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { EmailTemplate } from '../models/email-template.model.js';
import { withBrokerageScope } from '../repositories/base.repository.js';
import {
  createEmailTemplateSchema,
  updateEmailTemplateSchema,
} from '../validators/email-template.validators.js';
import { validateData } from '../validators/common.validators.js';
import { NotFoundError, BrokerageIsolationError } from '../utils/errors.js';

export class EmailTemplateController {
  /**
   * GET /api/email-templates
   * Lists email templates for the authenticated brokerage.
   */
  async listTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const filter =
        user.role === 'PLATFORM_ADMIN'
          ? {}
          : withBrokerageScope(user.brokerageId!, {});

      const templates = await EmailTemplate.find(filter).sort({ name: 1 });

      res.status(200).json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/email-templates/:id
   * Resolves a single email template by ID with tenant scoping.
   */
  async getTemplateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const templateId = req.params.id as string;

      if (!Types.ObjectId.isValid(templateId)) {
        throw new NotFoundError('Email template not found');
      }

      const filter =
        user.role === 'PLATFORM_ADMIN'
          ? { _id: new Types.ObjectId(templateId) }
          : withBrokerageScope(user.brokerageId!, {
              _id: new Types.ObjectId(templateId),
            });

      const template = await EmailTemplate.findOne(filter);
      if (!template) {
        throw new NotFoundError('Email template not found');
      }

      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/email-templates
   * Creates an email template scoped to the authenticated brokerage.
   */
  async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const input = validateData(createEmailTemplateSchema, req.body);

      const brokerageId =
        user.role === 'PLATFORM_ADMIN'
          ? (req.body.brokerageId ? new Types.ObjectId(req.body.brokerageId) : null)
          : new Types.ObjectId(user.brokerageId!);

      if (!brokerageId) {
        throw new BrokerageIsolationError('Brokerage context required to create email template');
      }

      const template = await EmailTemplate.create({
        brokerageId,
        name: input.name,
        slug: input.slug,
        subject: input.subject,
        body: input.body,
        variables: input.variables,
        isActive: input.isActive ?? true,
      });

      res.status(201).json({
        success: true,
        data: template,
        message: 'Email template created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/email-templates/:id
   * Updates an email template.
   */
  async updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const templateId = req.params.id as string;
      const input = validateData(updateEmailTemplateSchema, req.body);

      if (!Types.ObjectId.isValid(templateId)) {
        throw new NotFoundError('Email template not found');
      }

      const filter =
        user.role === 'PLATFORM_ADMIN'
          ? { _id: new Types.ObjectId(templateId) }
          : withBrokerageScope(user.brokerageId!, {
              _id: new Types.ObjectId(templateId),
            });

      const updated = await EmailTemplate.findOneAndUpdate(
        filter,
        { $set: input },
        { returnDocument: 'after' }
      );

      if (!updated) {
        throw new NotFoundError('Email template not found');
      }

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Email template updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const emailTemplateController = new EmailTemplateController();
