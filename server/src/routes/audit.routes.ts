import { Router } from 'express';
import { auditController } from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';

const router = Router();

// Only administrative roles (PLATFORM_ADMIN, BROKERAGE_ADMIN) may access audit logs
router.get(
  '/',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  auditController.getAuditLogs.bind(auditController)
);

export const auditRouter = router;
