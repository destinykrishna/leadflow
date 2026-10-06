import type { Request, Response, NextFunction } from 'express';
import { formService } from '../services/form.service.js';
import { validateData } from '../validators/common.validators.js';
import {
  createFormSchema,
  updateFormSchema,
  formQuerySchema,
  publicFormSubmissionSchema,
} from '../validators/form.validators.js';

export class FormController {
  /**
   * POST /api/forms
   * Creates a new brokerage-owned form in DRAFT status.
   */
  async createForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const input = validateData(createFormSchema, req.body);
      const form = await formService.createForm(user, input);

      res.status(201).json({
        success: true,
        data: form,
        message: 'Form created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/forms/:id
   * Resolves a form by ID with tenant scoping.
   */
  async getFormById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const formId = req.params.id as string;
      const form = await formService.getFormById(user, formId);

      res.status(200).json({
        success: true,
        data: form,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/forms
   * Lists forms for the authenticated user's brokerage.
   */
  async listForms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const query = validateData(formQuerySchema, req.query);
      const result = await formService.listForms(user, query);

      res.status(200).json({
        success: true,
        data: result.forms,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/forms/:id
   * Updates form details, fields, or lifecycle status.
   */
  async updateForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const formId = req.params.id as string;
      const input = validateData(updateFormSchema, req.body);
      const form = await formService.updateForm(user, formId, input);

      res.status(200).json({
        success: true,
        data: form,
        message: 'Form updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/forms/:id
   * Archives a form (lifecycle transition to ARCHIVED).
   */
  async archiveForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const formId = req.params.id as string;
      const form = await formService.archiveForm(user, formId);

      res.status(200).json({
        success: true,
        data: form,
        message: 'Form archived successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/forms/public/:brokerageIdentifier/:slug
   * Public endpoint retrieving published form definition.
   * Conceals non-published/draft/archived forms and suspended brokerages with uniform 404.
   */
  async getPublicForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brokerageIdentifier = req.params.brokerageIdentifier as string;
      const slug = req.params.slug as string;

      const { publicView } = await formService.resolvePublicForm(
        brokerageIdentifier,
        slug
      );

      res.status(200).json({
        success: true,
        data: publicView,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/forms/public/:brokerageIdentifier/:slug/submit
   * Public submission endpoint converting responses to Lead inquiries via existing ingestion flow.
   */
  async submitPublicForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const brokerageIdentifier = req.params.brokerageIdentifier as string;
      const slug = req.params.slug as string;

      const input = validateData(publicFormSubmissionSchema, req.body);
      const result = await formService.submitPublicForm(
        brokerageIdentifier,
        slug,
        input
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const formController = new FormController();
