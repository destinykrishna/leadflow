import { Router } from 'express';
import { documentController } from '../controllers/document.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireActiveUser } from '../middleware/rbac.middleware.js';

const router = Router();

// Get document by ID (Clients restricted to own uploads; Advisors/Admins restricted to own brokerage)
router.get(
  '/:id',
  authenticate,
  requireActiveUser,
  documentController.getDocumentById.bind(documentController)
);

export const documentRouter = router;
