import { Types, type QueryFilter } from 'mongoose';
import { Form, type IForm, type IFormDocument, type FormStatus } from '../models/form.model.js';
import { ScopedRepository } from './scoped.repository.js';
import { withBrokerageScope } from './base.repository.js';
import { BrokerageIsolationError } from '../utils/errors.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import type { FormQuery } from '../validators/form.validators.js';

export class FormRepository extends ScopedRepository<IForm, IFormDocument> {
  constructor() {
    super(Form);
  }

  /**
   * Resolves a form by slug strictly within a brokerage boundary.
   */
  async findBySlug(
    brokerageId: string | Types.ObjectId,
    slug: string
  ): Promise<IFormDocument | null> {
    const filter = withBrokerageScope<IForm>(brokerageId, {
      slug: slug.toLowerCase().trim(),
    });
    return this.model.findOne(filter);
  }

  /**
   * Resolves a PUBLISHED form by slug strictly within a brokerage boundary.
   */
  async findPublishedBySlug(
    brokerageId: string | Types.ObjectId,
    slug: string
  ): Promise<IFormDocument | null> {
    const filter = withBrokerageScope<IForm>(brokerageId, {
      slug: slug.toLowerCase().trim(),
      status: 'PUBLISHED',
    });
    return this.model.findOne(filter);
  }

  /**
   * Atomically increments a form's submission count.
   */
  async incrementSubmissionCount(
    brokerageId: string | Types.ObjectId,
    formId: string | Types.ObjectId
  ): Promise<IFormDocument | null> {
    const validFormId =
      formId instanceof Types.ObjectId ? formId : new Types.ObjectId(formId);

    const filter = withBrokerageScope<IForm>(brokerageId, {
      _id: validFormId,
    } as unknown as QueryFilter<IForm>);

    return this.model.findOneAndUpdate(
      filter,
      { $inc: { submissionCount: 1 } },
      { returnDocument: 'after' }
    );
  }

  /**
   * Retrieves paginated forms for the authenticated user's brokerage with total count.
   */
  async listForms(
    userContext: AuthUserContext,
    options: FormQuery
  ): Promise<{
    forms: IFormDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const filter: Record<string, unknown> = {};

    if (userContext.role === 'PLATFORM_ADMIN') {
      // Platform admin can see across or filter if desired
    } else {
      if (!userContext.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for tenant user');
      }
      filter.brokerageId = new Types.ObjectId(userContext.brokerageId);
    }

    if (options.status) {
      filter.status = options.status;
    }

    if (options.search) {
      const searchRegex = new RegExp(
        options.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
      filter.$or = [{ title: searchRegex }, { slug: searchRegex }];
    }

    const sortField = options.sort ?? 'createdAt';
    const sortDir = options.order === 'asc' ? 1 : -1;
    const sortQuery: Record<string, 1 | -1> = { [sortField]: sortDir };

    const limit = Math.min(options.limit ?? 20, 100);
    const page = Math.max(options.page ?? 1, 1);
    const skip = (page - 1) * limit;

    const [forms, total] = await Promise.all([
      this.model.find(filter).sort(sortQuery).skip(skip).limit(limit),
      this.model.countDocuments(filter),
    ]);

    return {
      forms,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}

export const formRepository = new FormRepository();
