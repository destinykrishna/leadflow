import { Model, Types, type QueryFilter } from 'mongoose';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { withBrokerageScope } from './base.repository.js';
import { BrokerageIsolationError } from '../utils/errors.js';

/**
 * Generic repository guaranteeing tenant isolation by scoping all queries
 * and mutations strictly to the authenticated user's brokerageId.
 * PLATFORM_ADMIN is granted platform-level overrides.
 */
export class ScopedRepository<T, TDoc = T> {
  constructor(protected readonly model: Model<TDoc>) {}

  /**
   * Resolves a document by ID with automatic tenant boundary scoping.
   * Cross-tenant guessed IDs return null (yielding 404), preventing IDOR leakage.
   */
  async findById(
    userContext: AuthUserContext,
    id: string | Types.ObjectId
  ): Promise<TDoc | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    const objectId = id instanceof Types.ObjectId ? id : new Types.ObjectId(id);

    if (userContext.role === 'PLATFORM_ADMIN') {
      return this.model.findById(objectId);
    }

    if (!userContext.brokerageId) {
      throw new BrokerageIsolationError('Brokerage context missing for tenant user');
    }

    const filter = withBrokerageScope<T>(userContext.brokerageId, {
      _id: objectId,
    } as unknown as QueryFilter<T>);

    return this.model.findOne(filter as QueryFilter<TDoc>);
  }

  /**
   * Finds a single document matching filter with automatic tenant scoping.
   */
  async findOne(
    userContext: AuthUserContext,
    filter: QueryFilter<T>
  ): Promise<TDoc | null> {
    if (userContext.role === 'PLATFORM_ADMIN') {
      return this.model.findOne(filter as QueryFilter<TDoc>);
    }

    if (!userContext.brokerageId) {
      throw new BrokerageIsolationError('Brokerage context missing for tenant user');
    }

    const scopedFilter = withBrokerageScope<T>(userContext.brokerageId, filter);
    return this.model.findOne(scopedFilter as QueryFilter<TDoc>);
  }

  /**
   * Finds multiple documents matching filter with automatic tenant scoping.
   */
  async find(
    userContext: AuthUserContext,
    filter?: QueryFilter<T>
  ): Promise<TDoc[]> {
    if (userContext.role === 'PLATFORM_ADMIN') {
      return this.model.find((filter ?? {}) as QueryFilter<TDoc>);
    }

    if (!userContext.brokerageId) {
      throw new BrokerageIsolationError('Brokerage context missing for tenant user');
    }

    const scopedFilter = withBrokerageScope<T>(userContext.brokerageId, filter);
    return this.model.find(scopedFilter as QueryFilter<TDoc>);
  }

  /**
   * Creates a new document with automatic tenant scoping applied.
   */
  async create(userContext: AuthUserContext, data: Partial<T>): Promise<TDoc> {
    const payload = { ...data };

    if (userContext.role !== 'PLATFORM_ADMIN') {
      if (!userContext.brokerageId) {
        throw new BrokerageIsolationError('Brokerage context missing for tenant user');
      }
      (payload as Record<string, unknown>).brokerageId = new Types.ObjectId(
        userContext.brokerageId
      );
    }

    return this.model.create(payload as unknown as Partial<TDoc>);
  }
}
