import { Router } from 'express';
import { brokerageController } from '../controllers/brokerage.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  requireRoles,
  requireSameBrokerage,
  requireActiveUser,
} from '../middleware/rbac.middleware.js';

const router = Router();

// Platform admin only: create a new brokerage + initial admin
router.post(
  '/',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN'),
  brokerageController.createBrokerage.bind(brokerageController)
);

// Platform admin only: list all brokerages
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

// Platform admin only: update brokerage lifecycle (status, plan, name, slug)
router.patch(
  '/:brokerageId',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN'),
  brokerageController.updateBrokerage.bind(brokerageController)
);

// Platform admin only: rotate webhook secret
router.post(
  '/:brokerageId/webhook-secret/rotate',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN'),
  brokerageController.rotateWebhookSecret.bind(brokerageController)
);

export const brokerageRouter = router;
