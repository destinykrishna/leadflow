import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { loginSchema } from '../validators/auth.validators.js';
import { setRefreshTokenCookie, clearRefreshTokenCookie, REFRESH_TOKEN_COOKIE_NAME } from '../utils/cookie.js';
import { UnauthorizedError } from '../utils/errors.js';

export class AuthController {
  /**
   * Handles user login for all 4 roles, issuing access token and setting HTTP-only cookie.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const meta = {
        userAgent: req.get('user-agent') ?? null,
        ipAddress: req.ip ?? null,
      };

      const result = await authService.login(input, meta);

      setRefreshTokenCookie(res, result.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles refresh token rotation, issuing new access & refresh token pair.
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;

      if (!rawToken || typeof rawToken !== 'string') {
        throw new UnauthorizedError('Refresh token required');
      }

      const meta = {
        userAgent: req.get('user-agent') ?? null,
        ipAddress: req.ip ?? null,
      };

      const result = await authService.refreshTokens(rawToken, meta);

      setRefreshTokenCookie(res, result.refreshToken);

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles user logout by revoking the refresh session and clearing the cookie.
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;

      if (rawToken && typeof rawToken === 'string') {
        await authService.logout(rawToken);
      }

      clearRefreshTokenCookie(res);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Returns current authenticated user context.
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
