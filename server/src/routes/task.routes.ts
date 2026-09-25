import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';
import { taskController } from '../controllers/task.controller.js';

const router = Router();

// All task routes require authentication and active user standing
router.use(authenticate);
router.use(requireActiveUser);

// Internal operations roles only (CLIENT excluded)
router.use(requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'));

// Task endpoints
router.get('/', (req, res, next) => void taskController.listTasks(req, res, next));
router.get('/:id', (req, res, next) => void taskController.getTaskById(req, res, next));
router.patch('/:id', (req, res, next) => void taskController.updateTaskStatus(req, res, next));

export const taskRouter = router;
