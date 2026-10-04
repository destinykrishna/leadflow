import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes freshness window
const MAX_FUTURE_DRIFT_MS = 60 * 1000; // 1 minute allowed future drift

/**
 * Constant-time comparison of two string buffers.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies Resend (Svix standard) webhook HMAC signatures:
 * - Checks svix-id, svix-timestamp, svix-signature headers (with fallback to webhook-* headers)
 * - Verifies timestamp freshness to defend against replay attacks (5 minute window)
 * - Computes HMAC-SHA256 over `${id}.${timestamp}.${rawBody}` using RESEND_WEBHOOK_SIGNING_SECRET
 * - Uses constant-time comparison to prevent timing side-channel attacks
 */
export function verifyResendWebhookAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const secret = env.RESEND_WEBHOOK_SIGNING_SECRET;

    // Allow test bypass only when explicitly running tests without configured webhook secret
    if (!secret && env.isTest) {
      return next();
    }

    if (!secret) {
      logger.error('Resend webhook received but RESEND_WEBHOOK_SIGNING_SECRET is not configured');
      throw new UnauthorizedError('Webhook authentication is not configured');
    }

    const id =
      (req.headers['svix-id'] as string | undefined) ||
      (req.headers['webhook-id'] as string | undefined);

    const timestamp =
      (req.headers['svix-timestamp'] as string | undefined) ||
      (req.headers['webhook-timestamp'] as string | undefined);

    const signature =
      (req.headers['svix-signature'] as string | undefined) ||
      (req.headers['webhook-signature'] as string | undefined);

    if (!id || !timestamp || !signature) {
      throw new UnauthorizedError('Missing required webhook verification headers');
    }

    // 1. Replay attack defense: Verify timestamp freshness
    const timestampSec = Number(timestamp);
    if (Number.isNaN(timestampSec) || timestampSec <= 0) {
      throw new UnauthorizedError('Malformed webhook timestamp');
    }

    const timestampMs = timestampSec * 1000;
    const now = Date.now();
    const age = now - timestampMs;

    if (age > MAX_TIMESTAMP_AGE_MS) {
      throw new UnauthorizedError('Webhook timestamp expired (replay attack detected)');
    }
    if (age < -MAX_FUTURE_DRIFT_MS) {
      throw new UnauthorizedError('Webhook timestamp is in the future');
    }

    // 2. Decode secret key (base64 if prefixed with whsec_, otherwise raw)
    const key = secret.startsWith('whsec_')
      ? Buffer.from(secret.slice(6), 'base64')
      : Buffer.from(secret, 'utf8');

    // 3. Resolve raw body buffer
    const rawBodyBuffer =
      req.rawBody ??
      (typeof req.body === 'string'
        ? Buffer.from(req.body, 'utf8')
        : Buffer.from(JSON.stringify(req.body ?? {}), 'utf8'));

    const rawBodyStr = rawBodyBuffer.toString('utf8');
    const toSign = `${id}.${timestamp}.${rawBodyStr}`;

    // 4. Compute expected base64 signature
    const computedSig = crypto.createHmac('sha256', key).update(toSign).digest('base64');

    // 5. Check against signatures in header (header can contain space-separated "v1,<sig>" entries)
    const passedSigs = signature.split(' ');
    let isValid = false;

    for (const item of passedSigs) {
      const parts = item.split(',');
      if (parts[0] === 'v1' && parts[1]) {
        if (safeCompare(parts[1], computedSig)) {
          isValid = true;
          break;
        }
      }
    }

    if (!isValid) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    next();
  } catch (error) {
    next(error);
  }
}
