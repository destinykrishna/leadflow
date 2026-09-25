import { Router } from 'express';
import { clientController } from '../controllers/client.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRoles, requireActiveUser } from '../middleware/rbac.middleware.js';

const router = Router();

// Only staff (PLATFORM_ADMIN, BROKERAGE_ADMIN, ADVISOR) may list clients
router.get(
  '/',
  authenticate,
  requireActiveUser,
  requireRoles('PLATFORM_ADMIN', 'BROKERAGE_ADMIN', 'ADVISOR'),
  clientController.listClients.bind(clientController)
);

// Get client by ID (Clients restricted to own record; Advisors/Admins restricted to own brokerage)
router.get(
  '/:id',
  authenticate,
  requireActiveUser,
  clientController.getClientById.bind(clientController)
);

export const clientRouter = router;
