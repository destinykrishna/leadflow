import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { verifyWebhookAuth } from '../middleware/webhook-auth.middleware.js';
import { leadIngestionController } from '../controllers/lead-ingestion.controller.js';
import { leadController } from '../controllers/lead.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';

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

// ==========================================
// Authenticated Pipeline Endpoints
// Authorized roles: PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR
// Role CLIENT is strictly forbidden.
// ==========================================

// Pipeline Kanban board view (grouped by all 7 stages with counts)
router.get(
  '/pipeline',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  leadController.getPipeline.bind(leadController)
);

// List pipeline leads for current brokerage (supports filtering, sorting, grouping)
router.get(
  '/',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  leadController.listLeads.bind(leadController)
);

// Retrieve lead details by ID (anti-IDOR: cross-brokerage returns 404)
router.get(
  '/:id',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  leadController.getLeadById.bind(leadController)
);

// Move lead stage (enforces state machine transitions, anti-IDOR, optimistic concurrency)
router.patch(
  '/:id/stage',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  leadController.updateLeadStage.bind(leadController)
);

// Alias endpoint for stage update
router.patch(
  '/:id/status',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  leadController.updateLeadStage.bind(leadController)
);

// Convert lead to client case (authorized staff only)
router.post(
  '/:id/convert',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  leadController.convertLeadToClient.bind(leadController)
);

export const leadRouter = router;

