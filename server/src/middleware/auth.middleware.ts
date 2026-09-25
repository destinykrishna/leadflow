import type { Request, Response, NextFunction } from 'express';
import { tokenService } from '../services/token.service.js';
import { User, type UserRole, type UserStatus } from '../models/user.model.js';
import { UnauthorizedError } from '../utils/errors.js';

export interface AuthUserContext {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  brokerageId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserContext;
    }
  }
}

/**
 * Authentication middleware that verifies JWT access token from Authorization header or cookie,
 * checks user active status, and establishes req.user context.
 * Strictly respects PLATFORM_ADMIN (brokerageId: null) vs brokerage-scoped users.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const payload = tokenService.verifyAccessToken(token);

    const user = await User.findById(payload.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is inactive or not found');
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      brokerageId: user.brokerageId ? user.brokerageId.toString() : null,
    };

    next();
  } catch (error) {
    next(error);
  }
}
