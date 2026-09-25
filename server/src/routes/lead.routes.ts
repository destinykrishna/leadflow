import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { verifyWebhookAuth } from '../middleware/webhook-auth.middleware.js';
import { leadIngestionController } from '../controllers/lead-ingestion.controller.js';

const router = Router();

/**
 * Tenant-aware rate limiter for authenticated lead webhook ingestion.
 * - Placed AFTER verifyWebhookAuth so unauthenticated probes never consume quota.
 * - Keyed strictly by verified brokerage ID (req.webhookBrokerage._id), isolating tenants.
 * - Enforces 1,000 requests/minute per brokerage (supporting 500/min bursts with 2x headroom).
 * - Noisy Brokerage A exhausting its quota cannot throttle Brokerage B.
 * - Bypassed in normal test runs, activated when x-test-rate-limit header is present.
 */
export const brokerageIngestionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: (req) => {
    if (env.isTest && req.headers['x-test-rate-limit-max']) {
      return parseInt(req.headers['x-test-rate-limit-max'] as string, 10);
    }
    return 1000; // 1,000 req/min per verified brokerage
  },
  keyGenerator: (req) => {
    return req.webhookBrokerage ? req.webhookBrokerage._id.toString() : 'unauthenticated';
  },
  skip: (req) => env.isTest && req.headers['x-test-rate-limit'] !== 'true',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many lead ingestion requests, please try again later.',
      },
    });
  },
});

// Primary external lead webhook endpoint
router.post(
  '/webhook/:brokerageId',
  verifyWebhookAuth,
  brokerageIngestionLimiter,
  leadIngestionController.ingestWebhookLead.bind(leadIngestionController)
);

// Alias endpoint for generic lead integrations
router.post(
  '/ingest/:brokerageId',
  verifyWebhookAuth,
  brokerageIngestionLimiter,
  leadIngestionController.ingestWebhookLead.bind(leadIngestionController)
);

export const leadRouter = router;
