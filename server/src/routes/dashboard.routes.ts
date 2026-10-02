import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';

const router = Router();

// Retrieve high-performance consolidated operations dashboard summary
// Authorized roles: PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR
router.get(
  '/',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  dashboardController.getDashboardSummary.bind(dashboardController)
);

export const dashboardRouter = router;
