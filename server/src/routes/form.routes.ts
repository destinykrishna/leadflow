import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { formController } from '../controllers/form.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';

const router = Router();

/**
 * Public rate limiter for public form viewing and submission.
 * Defends against spam and denial-of-service abuse.
 * Bypassed in tests unless specifically enabled.
 */
export const publicFormLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req) => {
    if (env.isTest && req.headers['x-test-rate-limit-max']) {
      return parseInt(req.headers['x-test-rate-limit-max'] as string, 10);
    }
    return 60; // 60 req/min
  },
  skip: (req) => env.isTest && req.headers['x-test-rate-limit'] !== 'true',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many form requests, please try again later.',
      },
    });
  },
});

// ==========================================
// Public Form Endpoints (Unauthenticated)
// ==========================================

// Retrieve published form schema for public rendering
router.get(
  '/public/:brokerageIdentifier/:slug',
  publicFormLimiter,
  (req, res, next) => void formController.getPublicForm(req, res, next)
);

// Submit public form responses
router.post(
  '/public/:brokerageIdentifier/:slug/submit',
  publicFormLimiter,
  (req, res, next) => void formController.submitPublicForm(req, res, next)
);

// ==========================================
// Authenticated Admin Endpoints
// ==========================================

router.use(authenticate);
router.use(requireActiveUser);

// List brokerage forms (Advisors and Admins)
router.get(
  '/',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  (req, res, next) => void formController.listForms(req, res, next)
);

// Retrieve form by ID (Advisors and Admins)
router.get(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  (req, res, next) => void formController.getFormById(req, res, next)
);

// Create new form (Platform and Brokerage Admins only)
router.post(
  '/',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void formController.createForm(req, res, next)
);

// Update form, fields, or lifecycle status (Platform and Brokerage Admins only)
router.patch(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void formController.updateForm(req, res, next)
);

// Archive form (Platform and Brokerage Admins only)
router.delete(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void formController.archiveForm(req, res, next)
);

export const formRouter = router;
