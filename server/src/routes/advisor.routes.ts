import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';
import { advisorController } from '../controllers/advisor.controller.js';

const router = Router();

// All advisor management routes require authentication and active user standing
router.use(authenticate);
router.use(requireActiveUser);

// Workload metrics - internal operations roles (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR)
router.get(
  '/workload',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  (req, res, next) => void advisorController.getAdvisorWorkload(req, res, next)
);

// List advisors for current brokerage (or all/filtered for PLATFORM_ADMIN)
router.get(
  '/',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  (req, res, next) => void advisorController.listAdvisors(req, res, next)
);

// Create/invite a new advisor with validated identity data
router.post(
  '/',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void advisorController.createAdvisor(req, res, next)
);

// Retrieve advisor by ID (enforces anti-IDOR HTTP 404 concealment)
router.get(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  (req, res, next) => void advisorController.getAdvisorById(req, res, next)
);

// Update advisor details and status (ACTIVE / INACTIVE)
router.patch(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void advisorController.updateAdvisor(req, res, next)
);

// Hard-deletion prohibited to preserve historical leads, clients, tasks, and audit trail
router.delete(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => advisorController.deleteAdvisor(req, res, next)
);

export const advisorRouter = router;
