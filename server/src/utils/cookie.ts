import type { Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

// In decoupled deployments (Frontend on Vercel, Backend on Render),
// cookies are cross-site and require SameSite=None and Secure=true over HTTPS.
const isCrossSite =
  !env.isTest &&
  (env.isProduction ||
    (env.CORS_ORIGIN && !env.CORS_ORIGIN.includes('localhost') && !env.CORS_ORIGIN.includes('127.0.0.1')));

export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: isCrossSite || env.isProduction,
  sameSite: isCrossSite || env.isProduction ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days matching JWT_REFRESH_EXPIRES_IN default
};

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, REFRESH_TOKEN_COOKIE_OPTIONS);
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    ...REFRESH_TOKEN_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
