import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';
import { advisorController } from '../controllers/advisor.controller.js';

const router = Router();

// All advisor management routes require authentication, active user standing,
// and are restricted strictly to BROKERAGE_ADMIN and PLATFORM_ADMIN.
router.use(authenticate);
router.use(requireActiveUser);
router.use(requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN'));

// List advisors for current brokerage (or all/filtered for PLATFORM_ADMIN)
router.get('/', (req, res, next) => void advisorController.listAdvisors(req, res, next));

// Create/invite a new advisor with validated identity data
router.post('/', (req, res, next) => void advisorController.createAdvisor(req, res, next));

// Retrieve advisor by ID (enforces anti-IDOR HTTP 404 concealment)
router.get('/:id', (req, res, next) => void advisorController.getAdvisorById(req, res, next));

// Update advisor details and status (ACTIVE / INACTIVE)
router.patch('/:id', (req, res, next) => void advisorController.updateAdvisor(req, res, next));

// Hard-deletion prohibited to preserve historical leads, clients, tasks, and audit trail
router.delete('/:id', (req, res, next) => advisorController.deleteAdvisor(req, res, next));

export const advisorRouter = router;
