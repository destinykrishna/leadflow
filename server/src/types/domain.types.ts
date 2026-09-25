import type { Types } from 'mongoose';

/**
 * Contract for any domain entity or document scoped to a brokerage tenant.
 * Crucial for enforcing multi-tenant isolation across all data access patterns.
 */
export interface IBrokerageScoped {
  brokerageId: Types.ObjectId | string;
}

/**
 * Base domain entity interface with audit timestamps and ID.
 */
export interface IBaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Combines base entity attributes with strict brokerage tenant scoping.
 */
export interface IBrokerageScopedEntity extends IBaseEntity, IBrokerageScoped {
  brokerageId: Types.ObjectId;
}

/**
 * Standard pagination and sorting query parameters.
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Standard paginated response envelope.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
