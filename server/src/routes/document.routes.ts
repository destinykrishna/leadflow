import { Router } from 'express';
import { documentController } from '../controllers/document.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireActiveUser, requireRoles } from '../middleware/rbac.middleware.js';
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

// Authorized document access/download (returns short-lived signed URL or redirects, enforcing tenant & client ownership)
router.get(
  '/:id/download',
  authenticate,
  requireActiveUser,
  documentController.getDownloadUrl.bind(documentController)
);

// Human document review (Approve / Reject) — Restricted to same-brokerage staff
router.patch(
  '/:id/review',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  documentController.reviewDocument.bind(documentController)
);

// Alias /:id/verify to review endpoint
router.patch(
  '/:id/verify',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  documentController.reviewDocument.bind(documentController)
);

export const documentRouter = router;

