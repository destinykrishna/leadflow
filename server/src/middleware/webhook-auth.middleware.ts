import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { Brokerage, type IBrokerageDocument } from '../models/brokerage.model.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request {
      webhookBrokerage?: IBrokerageDocument;
    }
  }
}

// Dummy constant secret used for timing-safe comparison on invalid/missing brokerage lookups
const DUMMY_SECRET = '000000000000000000000000000000000000000000000000';

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
 * Verifies webhook secret or HMAC signature for incoming lead webhook requests.
 * Prevents brokerage-ID enumeration and status disclosure to unauthenticated callers.
 */
export async function verifyWebhookAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Extract credentials from headers first
    const rawSignature =
      (req.headers['x-signature-sha256'] as string | undefined) ||
      (req.headers['x-hub-signature-256'] as string | undefined);

    let providedSecret = req.headers['x-webhook-secret'] as string | undefined;
    if (!providedSecret && req.headers.authorization?.startsWith('Bearer ')) {
      providedSecret = req.headers.authorization.substring(7).trim();
    }

    // 2. Reject unauthenticated callers immediately before DB query to prevent enumeration and DB exhaustion
    if (!rawSignature && !providedSecret) {
      throw new UnauthorizedError('Missing or invalid webhook authentication');
    }

    const paramVal = req.params.brokerageId;
    const rawBrokerageId = Array.isArray(paramVal) ? paramVal[0] : paramVal;

    // 3. Validate ObjectId format
    if (!rawBrokerageId || typeof rawBrokerageId !== 'string' || !Types.ObjectId.isValid(rawBrokerageId)) {
      safeCompare(providedSecret || rawSignature || '', DUMMY_SECRET);
      throw new UnauthorizedError('Missing or invalid webhook authentication');
    }

    // 4. Resolve target brokerage
    const brokerage = await Brokerage.findById(rawBrokerageId);
    if (!brokerage || !brokerage.webhookSecret) {
      safeCompare(providedSecret || rawSignature || '', DUMMY_SECRET);
      throw new UnauthorizedError('Missing or invalid webhook authentication');
    }

    const brokerageSecret = brokerage.webhookSecret;
    let isAuthenticated = false;

    // 5. Verify HMAC-SHA256 signature if provided
    if (rawSignature) {
      const providedHex = rawSignature.replace(/^sha256=/, '').trim();
      const payloadString =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

      const computedHex = crypto
        .createHmac('sha256', brokerageSecret)
        .update(payloadString, 'utf8')
        .digest('hex');

      isAuthenticated = safeCompare(providedHex, computedHex);
    } else if (providedSecret) {
      // 6. Verify shared webhook secret
      isAuthenticated = safeCompare(providedSecret.trim(), brokerageSecret);
    }

    if (!isAuthenticated) {
      throw new UnauthorizedError('Missing or invalid webhook authentication');
    }

    // 7. Verified caller: check operational status of the brokerage
    if (brokerage.status !== 'ACTIVE') {
      throw new ForbiddenError('Brokerage account is suspended or inactive');
    }

    req.webhookBrokerage = brokerage;
    next();
  } catch (error) {
    next(error);
  }
}
