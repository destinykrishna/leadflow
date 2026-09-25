import { Types, type QueryFilter, type UpdateQuery } from 'mongoose';
import { BrokerageIsolationError } from '../utils/errors.js';
import type { PaginationParams } from '../types/domain.types.js';

/**
 * Enforces that a MongoDB query filter is scoped strictly to a brokerage.
 * Validates and converts the brokerageId into a Types.ObjectId.
 * Throws BrokerageIsolationError if brokerageId is absent or invalid.
 */
export function withBrokerageScope<T>(
  brokerageId: string | Types.ObjectId,
  filter?: QueryFilter<T>
): QueryFilter<T> & { brokerageId: Types.ObjectId } {
  if (!brokerageId) {
    throw new BrokerageIsolationError('Brokerage ID is required for tenant isolation');
  }

  const validBrokerageId =
    brokerageId instanceof Types.ObjectId
      ? brokerageId
      : Types.ObjectId.isValid(brokerageId)
        ? new Types.ObjectId(brokerageId)
        : null;

  if (!validBrokerageId) {
    throw new BrokerageIsolationError('Invalid Brokerage ID provided for tenant isolation');
  }

  return {
    ...(filter ?? {}),
    brokerageId: validBrokerageId,
  } as QueryFilter<T> & { brokerageId: Types.ObjectId };
}

/**
 * Contract for brokerage-scoped repositories.
 * Repositories are intentionally lightweight and focused on tenant-isolated queries.
 */
export interface IBrokerageScopedRepository<T, TDoc = T> {
  findById(
    brokerageId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<TDoc | null>;

  findOne(
    brokerageId: string | Types.ObjectId,
    filter: QueryFilter<T>
  ): Promise<TDoc | null>;

  find(
    brokerageId: string | Types.ObjectId,
    filter: QueryFilter<T>,
    pagination?: PaginationParams
  ): Promise<TDoc[]>;

  count(
    brokerageId: string | Types.ObjectId,
    filter: QueryFilter<T>
  ): Promise<number>;

  create(
    brokerageId: string | Types.ObjectId,
    data: Partial<T>
  ): Promise<TDoc>;

  updateById(
    brokerageId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    update: UpdateQuery<TDoc>
  ): Promise<TDoc | null>;

  deleteById(
    brokerageId: string | Types.ObjectId,
    id: string | Types.ObjectId
  ): Promise<boolean>;
}
