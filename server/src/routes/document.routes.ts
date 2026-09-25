import { Router } from 'express';
import { documentController } from '../controllers/document.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireActiveUser } from '../middleware/rbac.middleware.js';
import { handleFileUpload } from '../middleware/upload.middleware.js';

const router = Router();

// Upload a document (Clients restricted to own case; Staff restricted to own brokerage)
router.post(
  '/upload',
  authenticate,
  requireActiveUser,
  handleFileUpload,
  documentController.uploadDocument.bind(documentController)
);

// List documents (Clients restricted to own case; Staff restricted to own brokerage)
router.get(
  '/',
  authenticate,
  requireActiveUser,
  documentController.listDocuments.bind(documentController)
);

// Get document by ID (Clients restricted to own case; Advisors/Admins restricted to own brokerage)
router.get(
  '/:id',
  authenticate,
  requireActiveUser,
  documentController.getDocumentById.bind(documentController)
);

export const documentRouter = router;
