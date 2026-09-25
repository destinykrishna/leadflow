import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';
import { triggerController } from '../controllers/trigger.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireActiveUser);

// Read endpoints: Advisors and Admins can view triggers
router.get(
  '/',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  (req, res, next) => void triggerController.listTriggers(req, res, next)
);

router.get(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  (req, res, next) => void triggerController.getTriggerById(req, res, next)
);

// Mutating endpoints: Platform and Brokerage Admins only
router.post(
  '/',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void triggerController.createTrigger(req, res, next)
);

router.patch(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void triggerController.updateTrigger(req, res, next)
);

router.delete(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void triggerController.deleteTrigger(req, res, next)
);

export const triggerRouter = router;
