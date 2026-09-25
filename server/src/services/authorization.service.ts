import { Types } from 'mongoose';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { BrokerageIsolationError, NotFoundError } from '../utils/errors.js';
import type { IDomainService } from './base.service.js';

export interface ScopedEntity {
  _id: Types.ObjectId | string;
  brokerageId: Types.ObjectId | string;
}

export interface ClientEntity extends ScopedEntity {
  userId?: Types.ObjectId | string | null;
}

export interface DocumentEntity extends ScopedEntity {
  uploadedBy: Types.ObjectId | string;
  clientId?: Types.ObjectId | string | null;
}

/**
 * Centralized authorization policy service enforcing multi-tenant isolation,
 * role boundaries, and resource ownership (preventing IDOR and cross-tenant leakage).
 */
export class AuthorizationService implements IDomainService {
  readonly serviceName = 'AuthorizationService';

  /**
   * Determines if a user has authority to access a target brokerage.
   * PLATFORM_ADMIN has system-level cross-brokerage access.
   * All other roles are strictly confined to their own brokerageId.
   */
  canAccessBrokerage(
    user: AuthUserContext,
    targetBrokerageId: string | Types.ObjectId
  ): boolean {
    if (user.role === 'PLATFORM_ADMIN') {
      return true;
    }

    if (!user.brokerageId) {
      return false;
    }

    return user.brokerageId.toString() === targetBrokerageId.toString();
  }

  /**
   * Asserts brokerage boundary access, throwing BrokerageIsolationError on violation.
   */
  assertBrokerageAccess(
    user: AuthUserContext,
    targetBrokerageId: string | Types.ObjectId
  ): void {
    if (!this.canAccessBrokerage(user, targetBrokerageId)) {
      throw new BrokerageIsolationError(
        'Access denied: Cross-brokerage tenant boundary violation'
      );
    }
  }

  /**
   * Validates access to a Client entity.
   * - Cross-brokerage access returns NotFoundError (hiding existence to prevent cross-tenant IDOR).
   * - ADVISOR and BROKERAGE_ADMIN can access any client in their brokerage.
   * - CLIENT role may ONLY access their own client record (userId === user.id).
   */
  authorizeClientAccess(user: AuthUserContext, client: ClientEntity): void {
    // 1. Cross-brokerage boundary check
    if (user.role !== 'PLATFORM_ADMIN') {
      if (
        !user.brokerageId ||
        user.brokerageId.toString() !== client.brokerageId.toString()
      ) {
        // Return 404 to avoid leaking cross-tenant existence of guessed IDs
        throw new NotFoundError('Client resource not found');
      }
    }

    // 2. Client role ownership check
    if (user.role === 'CLIENT') {
      const clientUserId = client.userId ? client.userId.toString() : null;
      if (clientUserId !== user.id) {
        // Return 404 to avoid leaking existence of other clients in same brokerage
        throw new NotFoundError('Client resource not found');
      }
    }
  }

  /**
   * Validates access to a Document entity.
   * - Cross-brokerage access returns NotFoundError (preventing cross-tenant IDOR).
   * - ADVISOR and BROKERAGE_ADMIN can access documents in their brokerage.
   * - CLIENT role may ONLY access documents uploaded by them (uploadedBy === user.id).
   */
  authorizeDocumentAccess(user: AuthUserContext, doc: DocumentEntity): void {
    // 1. Cross-brokerage boundary check
    if (user.role !== 'PLATFORM_ADMIN') {
      if (!user.brokerageId || user.brokerageId.toString() !== doc.brokerageId.toString()) {
        throw new NotFoundError('Document resource not found');
      }
    }

    // 2. Client role ownership check
    if (user.role === 'CLIENT') {
      const uploaderId = doc.uploadedBy ? doc.uploadedBy.toString() : null;
      if (uploaderId !== user.id) {
        throw new NotFoundError('Document resource not found');
      }
    }
  }
}

export const authorizationService = new AuthorizationService();
