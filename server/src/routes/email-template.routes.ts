import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';
import { emailTemplateController } from '../controllers/email-template.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireActiveUser);

// Read endpoints: Advisors and Admins can view templates
router.get(
  '/',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  (req, res, next) => void emailTemplateController.listTemplates(req, res, next)
);

router.get(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  (req, res, next) => void emailTemplateController.getTemplateById(req, res, next)
);

// Mutating endpoints: Platform and Brokerage Admins only
router.post(
  '/',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void emailTemplateController.createTemplate(req, res, next)
);

router.patch(
  '/:id',
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'),
  (req, res, next) => void emailTemplateController.updateTemplate(req, res, next)
);

export const emailTemplateRouter = router;
