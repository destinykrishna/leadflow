import { Router } from 'express';
import { brokerageController } from '../controllers/brokerage.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireSameBrokerage, requireActiveUser } from '../middleware/rbac.middleware.js';

const router = Router();

// Platform admin only
router.get(
  '/',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN'),
  brokerageController.listBrokerages.bind(brokerageController)
);

// Scoped to own brokerage (or PLATFORM_ADMIN)
router.get(
  '/:brokerageId',
  authenticate,
  requireActiveUser,
  requireSameBrokerage('brokerageId'),
  brokerageController.getBrokerageById.bind(brokerageController)
);

export const brokerageRouter = router;
