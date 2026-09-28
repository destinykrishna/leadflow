import { Router } from 'express';
import { brokerageController } from '../controllers/brokerage.controller.js';
import { advisorController } from '../controllers/advisor.controller.js';
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

// Scoped to own brokerage operational staff (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR)
// CLIENT role is strictly forbidden (403) from accessing internal brokerage metadata (HARD-03)
router.get(
  '/:brokerageId',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
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

// Advisors nested under brokerage (BROKERAGE_ADMIN of own brokerage, or PLATFORM_ADMIN)
router.get(
  '/:brokerageId/advisors',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  requireSameBrokerage('brokerageId'),
  (req, res, next) => void advisorController.listAdvisors(req, res, next)
);

router.post(
  '/:brokerageId/advisors',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  requireSameBrokerage('brokerageId'),
  (req, res, next) => void advisorController.createAdvisor(req, res, next)
);

router.get(
  '/:brokerageId/advisors/:id',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  requireSameBrokerage('brokerageId'),
  (req, res, next) => void advisorController.getAdvisorById(req, res, next)
);

router.patch(
  '/:brokerageId/advisors/:id',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  requireSameBrokerage('brokerageId'),
  (req, res, next) => void advisorController.updateAdvisor(req, res, next)
);

router.delete(
  '/:brokerageId/advisors/:id',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  requireSameBrokerage('brokerageId'),
  (req, res, next) => advisorController.deleteAdvisor(req, res, next)
);

export const brokerageRouter = router;
