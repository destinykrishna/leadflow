import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../models/user.model.js';
import { ForbiddenError, UnauthorizedError, BrokerageIsolationError } from '../utils/errors.js';

/**
 * Role-Based Access Control (RBAC) guard.
 * Verifies that the authenticated user possesses one of the allowed roles.
 */
export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied: Role ${req.user.role} is not authorized for this operation`
        )
      );
    }

    next();
  };
}

/**
 * Route parameter tenant boundary guard.
 * Validates that an explicit URL parameter (e.g. :brokerageId) matches
 * the authenticated user's brokerageId context.
 * PLATFORM_ADMIN is granted platform-level cross-brokerage access.
 */
export function requireSameBrokerage(paramKey = 'brokerageId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    // Platform admins have platform-wide access
    if (req.user.role === 'PLATFORM_ADMIN') {
      return next();
    }

    const targetBrokerageId = req.params[paramKey];
    if (!targetBrokerageId || !req.user.brokerageId || req.user.brokerageId.toString() !== targetBrokerageId) {
      return next(
        new BrokerageIsolationError(
          'Access denied: Cross-brokerage tenant boundary violation'
        )
      );
    }

    next();
  };
}

/**
 * Guard ensuring that the authenticated user's account is ACTIVE.
 */
export function requireActiveUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (req.user.status !== 'ACTIVE') {
    return next(new UnauthorizedError('User account is inactive or suspended'));
  }

  next();
}
