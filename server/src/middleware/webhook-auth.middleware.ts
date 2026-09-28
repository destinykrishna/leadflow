import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { Brokerage, type IBrokerageDocument } from '../models/brokerage.model.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request {
      webhookBrokerage?: IBrokerageDocument;
      rawBody?: Buffer;
    }
  }
}

// Dummy constant secret used for timing-safe comparison on invalid/missing brokerage lookups
const DUMMY_SECRET = '000000000000000000000000000000000000000000000000';

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000; // 5 minutes freshness window
const MAX_FUTURE_DRIFT_MS = 60 * 1000; // 1 minute allowed future drift

/**
 * Constant-time string comparison to prevent timing attacks.
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
 * Validates webhook timestamp freshness to defend against replay attacks.
 * Supports Unix epoch seconds, epoch milliseconds, or ISO strings.
 * Rejects requests outside the 5-minute freshness window or more than 1 minute in the future.
 */
function validateWebhookTimestamp(rawTimestamp: string): number {
  const trimmed = rawTimestamp.trim();
  if (!trimmed) {
    throw new UnauthorizedError('Malformed or invalid webhook timestamp');
  }

  let timestampMs: number;
  const num = Number(trimmed);
  if (!Number.isNaN(num) && Number.isFinite(num)) {
    if (num <= 0) {
      throw new UnauthorizedError('Malformed or invalid webhook timestamp');
    }
    // Unix epoch seconds (e.g. 10 digits) vs epoch milliseconds (13 digits)
    timestampMs = num < 1e11 ? num * 1000 : num;
  } else {
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed) || parsed <= 0) {
      throw new UnauthorizedError('Malformed or invalid webhook timestamp');
    }
    timestampMs = parsed;
  }

  const now = Date.now();
  const age = now - timestampMs;

  if (age > MAX_TIMESTAMP_AGE_MS) {
    throw new UnauthorizedError('Webhook timestamp expired (replay detected)');
  }
  if (age < -MAX_FUTURE_DRIFT_MS) {
    throw new UnauthorizedError('Webhook timestamp is in the future');
  }

  return timestampMs;
}

/**
 * Verifies webhook secret or HMAC signature for incoming lead webhook requests.
 * Supports standard SHA256 hex signatures, timestamped replay-protected HMAC signatures,
 * and Typeform base64-encoded signatures.
 * Prevents brokerage-ID enumeration and status disclosure to unauthenticated callers.
 */
export async function verifyWebhookAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Extract credentials and timestamp from headers
    const headerSignature =
      (req.headers['typeform-signature'] as string | undefined) ||
      (req.headers['x-typeform-signature'] as string | undefined) ||
      (req.headers['x-signature-sha256'] as string | undefined) ||
      (req.headers['x-hub-signature-256'] as string | undefined);

    let rawTimestamp =
      (req.headers['x-webhook-timestamp'] as string | undefined) ||
      (req.headers['x-signature-timestamp'] as string | undefined) ||
      (req.headers['x-request-timestamp'] as string | undefined);

    let cleanSignature = headerSignature;

    // Support embedded timestamp in signature string: e.g. "t=1727520000,v1=<sig>"
    if (headerSignature && headerSignature.includes('t=') && headerSignature.includes('v1=')) {
      const parts = headerSignature.split(',');
      for (const part of parts) {
        const [k, v] = part.split('=').map((s) => s.trim());
        if (k === 't' && !rawTimestamp) {
          rawTimestamp = v;
        } else if (k === 'v1') {
          cleanSignature = v;
        }
      }
    }

    let providedSecret = req.headers['x-webhook-secret'] as string | undefined;
    if (!providedSecret && req.headers.authorization?.startsWith('Bearer ')) {
      providedSecret = req.headers.authorization.substring(7).trim();
    }

    // 2. Reject unauthenticated callers immediately before DB query to prevent enumeration and DB exhaustion
    if (!cleanSignature && !providedSecret) {
      throw new UnauthorizedError('Missing or invalid webhook authentication');
    }

    const paramVal = req.params.brokerageId;
    const rawBrokerageId = Array.isArray(paramVal) ? paramVal[0] : paramVal;

    // 3. Validate ObjectId format
    if (!rawBrokerageId || typeof rawBrokerageId !== 'string' || !Types.ObjectId.isValid(rawBrokerageId)) {
      safeCompare(providedSecret || cleanSignature || '', DUMMY_SECRET);
      throw new UnauthorizedError('Missing or invalid webhook authentication');
    }

    // 4. Resolve target brokerage
    const brokerage = await Brokerage.findById(rawBrokerageId);
    if (!brokerage || !brokerage.webhookSecret) {
      safeCompare(providedSecret || cleanSignature || '', DUMMY_SECRET);
      throw new UnauthorizedError('Missing or invalid webhook authentication');
    }

    const brokerageSecret = brokerage.webhookSecret;
    let isAuthenticated = false;

    // 5. Validate timestamp freshness if timestamp is present
    if (rawTimestamp) {
      validateWebhookTimestamp(rawTimestamp);
    }

    // 6. Verify HMAC-SHA256 signature if provided
    if (cleanSignature) {
      const providedSig = cleanSignature.replace(/^sha256=/, '').trim();
      const rawBuffer =
        req.rawBody ??
        (typeof req.body === 'string'
          ? Buffer.from(req.body, 'utf8')
          : Buffer.from(JSON.stringify(req.body ?? {}), 'utf8'));

      if (rawTimestamp) {
        // Timestamp-bound signed request payload (replay protection)
        const dotPayload = Buffer.concat([Buffer.from(`${rawTimestamp.trim()}.`), rawBuffer]);
        const colonPayload = Buffer.concat([Buffer.from(`${rawTimestamp.trim()}:`), rawBuffer]);

        const computedHexDot = crypto.createHmac('sha256', brokerageSecret).update(dotPayload).digest('hex');
        const computedHexColon = crypto.createHmac('sha256', brokerageSecret).update(colonPayload).digest('hex');
        const computedBase64Dot = crypto.createHmac('sha256', brokerageSecret).update(dotPayload).digest('base64');
        const computedBase64Colon = crypto.createHmac('sha256', brokerageSecret).update(colonPayload).digest('base64');

        isAuthenticated =
          safeCompare(providedSig, computedHexDot) ||
          safeCompare(providedSig, computedHexColon) ||
          safeCompare(providedSig, computedBase64Dot) ||
          safeCompare(providedSig, computedBase64Colon);
      } else {
        // Legacy HMAC / Typeform signature verification without timestamp
        const computedHex = crypto.createHmac('sha256', brokerageSecret).update(rawBuffer).digest('hex');
        const computedBase64 = crypto.createHmac('sha256', brokerageSecret).update(rawBuffer).digest('base64');

        isAuthenticated =
          safeCompare(providedSig, computedHex) ||
          safeCompare(providedSig, computedBase64);
      }
    } else if (providedSecret) {
      // 7. Verify shared webhook secret
      isAuthenticated = safeCompare(providedSecret.trim(), brokerageSecret);
    }

    if (!isAuthenticated) {
      throw new UnauthorizedError('Missing or invalid webhook authentication');
    }

    // 8. Verified caller: check operational status of the brokerage
    if (brokerage.status !== 'ACTIVE') {
      throw new ForbiddenError('Brokerage account is suspended or inactive');
    }

    req.webhookBrokerage = brokerage;
    next();
  } catch (error) {
    next(error);
  }
}
