import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';
import type { UserRole } from '../models/user.model.js';

export interface AuthUserTokenClaims {
  userId: string;
  email: string;
  role: UserRole;
  brokerageId: string | null;
}

export interface AccessTokenPayload extends AuthUserTokenClaims {
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  family: string;
  tokenId: string;
  jti?: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export class TokenService {
  /**
   * Generates a short-lived access JWT containing user identity and tenant context.
   */
  generateAccessToken(user: AuthUserTokenClaims): string {
    const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
      ...user,
      type: 'access',
    };

    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as SignOptions);
  }

  /**
   * Generates a long-lived refresh token associated with a token rotation family.
   * Embeds a unique tokenId and RFC 7519 jwtid (jti) to guarantee distinct cryptographic
   * signatures even during sub-millisecond rotations.
   */
  generateRefreshToken(userId: string, family: string): string {
    const tokenId = crypto.randomUUID();
    const payload: Omit<RefreshTokenPayload, 'iat' | 'exp' | 'jti'> = {
      userId,
      family,
      tokenId,
      type: 'refresh',
    };

    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      jwtid: tokenId,
    } as SignOptions);
  }

  /**
   * Verifies and decodes an access token.
   * Throws UnauthorizedError on expiration or invalid signature.
   */
  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
      if (decoded.type !== 'access') {
        throw new UnauthorizedError('Invalid access token');
      }
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verifies and decodes a refresh token.
   * Throws UnauthorizedError on expiration or invalid signature.
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload & {
        jti?: string;
      };
      if (decoded.type !== 'refresh') {
        throw new UnauthorizedError('Invalid refresh token');
      }
      return {
        ...decoded,
        tokenId: decoded.tokenId || decoded.jti || '',
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Creates a cryptographically random UUID for refresh token family tracking.
   */
  generateFamilyId(): string {
    return crypto.randomUUID();
  }
}

export const tokenService = new TokenService();
