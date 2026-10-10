import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireActiveUser, requireRoles } from '../middleware/rbac.middleware.js';
import { translationController } from '../controllers/translation.controller.js';
import { env } from '../config/env.js';

const router = Router();

// Translation rate limiter: 60 requests per minute per authenticated user
const translationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.isTest,
  keyGenerator: (req) => req.user?.id || 'anonymous',
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many translation requests, please slow down.',
    },
  },
});

// All translation calls require an active authenticated advisor/admin user
router.use(authenticate);
router.use(requireActiveUser);
router.use(requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'));

router.post('/', translationLimiter, (req, res, next) =>
  void translationController.translate(req, res, next)
);

export const translationRouter = router;
