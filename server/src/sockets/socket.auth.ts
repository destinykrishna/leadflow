import type { Socket } from 'socket.io';
import { tokenService } from '../services/token.service.js';
import { User, type UserRole, type UserStatus } from '../models/user.model.js';
import { Brokerage } from '../models/brokerage.model.js';
import { logger } from '../utils/logger.js';

export interface SocketUserContext {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  brokerageId: string | null;
}

declare module 'socket.io' {
  interface SocketData {
    user?: SocketUserContext;
  }
}

/**
 * Extracts authentication token from socket handshake:
 * 1. socket.handshake.auth.token (e.g. { auth: { token: '...' } })
 * 2. socket.handshake.headers.authorization (Bearer token)
 * 3. socket.handshake.headers.cookie (accessToken cookie)
 */
export function extractSocketToken(socket: Socket): string | null {
  // 1. Auth payload (standard Socket.IO client auth option)
  if (socket.handshake.auth && typeof socket.handshake.auth.token === 'string') {
    const raw = socket.handshake.auth.token.trim();
    return raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw;
  }

  // 2. Authorization header
  const authHeader = socket.handshake.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 3. Cookie header
  const cookieHeader = socket.handshake.headers.cookie;
  if (typeof cookieHeader === 'string') {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [key, ...val] = part.trim().split('=');
      if (key === 'accessToken') {
        return decodeURIComponent(val.join('='));
      }
    }
  }

  return null;
}

/**
 * Socket.IO authentication middleware.
 * Verifies JWT token, ensures user account is ACTIVE, and enforces active brokerage checks for tenant users.
 * Rejects unauthenticated connections before room assignment.
 */
export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const token = extractSocketToken(socket);
    if (!token) {
      return next(new Error('Authentication required'));
    }

    let payload;
    try {
      payload = tokenService.verifyAccessToken(token);
    } catch {
      return next(new Error('Invalid or expired authentication token'));
    }

    // Enforce active-user status in database
    const user = await User.findById(payload.userId);
    if (!user || user.status !== 'ACTIVE') {
      return next(new Error('User account is inactive or not found'));
    }

    // For tenant roles, enforce active-brokerage validation
    let brokerageIdStr: string | null = null;
    if (user.role !== 'PLATFORM_ADMIN') {
      if (!user.brokerageId) {
        return next(new Error('Brokerage context missing for tenant user'));
      }

      const brokerage = await Brokerage.findById(user.brokerageId);
      if (!brokerage || brokerage.status !== 'ACTIVE') {
        return next(new Error('Brokerage account is inactive or suspended'));
      }

      brokerageIdStr = user.brokerageId.toString();
    }

    socket.data.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      brokerageId: brokerageIdStr,
    };

    next();
  } catch (error) {
    logger.error({ err: error }, 'Socket authentication error');
    next(new Error('Internal server error during socket authentication'));
  }
}
