import { Router } from 'express';
import { verifyResendWebhookAuth } from '../middleware/email-webhook-auth.middleware.js';
import { emailWebhookController } from '../controllers/email-webhook.controller.js';

const router = Router();

// Inbound Resend delivery and bounce tracking webhook
router.post(
  '/resend',
  verifyResendWebhookAuth,
  (req, res, next) => void emailWebhookController.handleResendWebhook(req, res, next)
);

export const emailWebhookRouter = router;
