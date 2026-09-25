import type { Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

export const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
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
