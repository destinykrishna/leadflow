import type { Request, Response, NextFunction } from 'express';
import { EmailLog } from '../models/email-log.model.js';
import { EmailSuppression } from '../models/email-suppression.model.js';
import { TriggerExecution } from '../models/trigger-execution.model.js';
import { emitAutomationEvent } from '../queues/automation-events.js';
import { maskEmail } from '../utils/mask.js';
import { logger } from '../utils/logger.js';

export class EmailWebhookController {
  /**
   * POST /api/webhooks/email/resend
   * Processes inbound webhook delivery and bounce events from Resend.
   * Enforces strict tenant resolution, idempotency, monotonic state changes, and PII masking.
   */
  async handleResendWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type: eventType, data, created_at: createdAt } = req.body || {};

      if (!eventType || !data) {
        res.status(200).json({ success: false, message: 'Ignored malformed webhook payload' });
        return;
      }

      const providerMessageId = data.email_id || data.id;

      if (!providerMessageId) {
        logger.warn({ eventType }, 'Resend webhook: missing email_id identifier');
        res.status(200).json({ success: false, message: 'Missing email_id' });
        return;
      }

      logger.info(
        {
          eventType,
          providerMessageId,
        },
        'Resend webhook: Processing inbound email delivery event'
      );

      // 1. Resolve matching EmailLog record
      const emailLog = await EmailLog.findOne({ providerMessageId });

      if (!emailLog) {
        logger.warn(
          { providerMessageId, eventType },
          'Resend webhook: No existing EmailLog found for providerMessageId (late event or external email)'
        );
        res.status(200).json({ success: true, matched: false });
        return;
      }

      const maskedRecipient = maskEmail(emailLog.recipientEmail);
      const brokerageIdStr = emailLog.brokerageId.toString();
      const leadIdStr = emailLog.leadId ? emailLog.leadId.toString() : undefined;

      // 2. Handle event types with monotonic state progressions
      switch (eventType) {
        case 'email.delivered': {
          // Idempotency: Do not overwrite terminal bounce or spam complaint states
          if (emailLog.status === 'BOUNCED' || emailLog.status === 'COMPLAINED') {
            logger.info(
              { providerMessageId, currentStatus: emailLog.status },
              'Resend webhook: Ignoring delivered event for already terminal bounced/complained email'
            );
            break;
          }

          emailLog.status = 'DELIVERED';
          emailLog.deliveredAt = new Date(createdAt || Date.now());
          await emailLog.save();

          logger.info(
            {
              brokerageId: brokerageIdStr,
              providerMessageId,
              recipient: maskedRecipient,
            },
            'Resend webhook: Email delivery confirmed'
          );

          emitAutomationEvent({
            event: 'automation:email_delivered',
            payload: {
              brokerageId: brokerageIdStr,
              leadId: leadIdStr,
              messageId: providerMessageId,
              recipient: maskedRecipient,
              message: `Email delivered to ${maskedRecipient}.`,
            },
          });
          break;
        }

        case 'email.bounced': {
          const bounce = data.bounce || {};
          const isHard = bounce.type === 'hard_bounce' || data.bounce_type === 'hard';
          const bounceReason = bounce.message || 'Recipient mailbox rejected message';

          emailLog.status = 'BOUNCED';
          emailLog.bounceType = isHard ? 'HARD' : 'SOFT';
          emailLog.bounceReason = bounceReason;
          emailLog.bouncedAt = new Date(createdAt || Date.now());
          await emailLog.save();

          // Suppress recipient within this brokerage so future stage triggers do not email them
          await EmailSuppression.updateOne(
            {
              brokerageId: emailLog.brokerageId,
              email: emailLog.recipientEmail.toLowerCase(),
            },
            {
              $setOnInsert: {
                reason: 'BOUNCE',
                details: bounceReason,
              },
            },
            { upsert: true }
          );

          // Update linked trigger execution if present
          await TriggerExecution.updateMany(
            {
              brokerageId: emailLog.brokerageId,
              emailLogId: emailLog._id,
            },
            {
              $set: {
                status: 'FAILED',
                error: `Email bounced: ${bounceReason}`,
              },
            }
          ).catch(() => {});

          logger.warn(
            {
              brokerageId: brokerageIdStr,
              providerMessageId,
              recipient: maskedRecipient,
              bounceType: emailLog.bounceType,
              bounceReason,
            },
            'Resend webhook: Recipient bounce recorded and email added to suppression list'
          );

          emitAutomationEvent({
            event: 'automation:email_bounced',
            payload: {
              brokerageId: brokerageIdStr,
              leadId: leadIdStr,
              messageId: providerMessageId,
              recipient: maskedRecipient,
              reason: bounceReason,
              message: `Email delivery bounced for ${maskedRecipient}: ${bounceReason}`,
            },
          });
          break;
        }

        case 'email.complained': {
          emailLog.status = 'COMPLAINED';
          emailLog.bouncedAt = new Date(createdAt || Date.now());
          await emailLog.save();

          // Suppress recipient immediately
          await EmailSuppression.updateOne(
            {
              brokerageId: emailLog.brokerageId,
              email: emailLog.recipientEmail.toLowerCase(),
            },
            {
              $setOnInsert: {
                reason: 'COMPLAINT',
                details: 'Recipient registered spam complaint',
              },
            },
            { upsert: true }
          );

          logger.warn(
            {
              brokerageId: brokerageIdStr,
              providerMessageId,
              recipient: maskedRecipient,
            },
            'Resend webhook: Spam complaint recorded; recipient suppressed'
          );

          emitAutomationEvent({
            event: 'automation:email_bounced',
            payload: {
              brokerageId: brokerageIdStr,
              leadId: leadIdStr,
              messageId: providerMessageId,
              recipient: maskedRecipient,
              reason: 'Recipient spam complaint',
              message: `Spam complaint received for ${maskedRecipient}.`,
            },
          });
          break;
        }

        case 'email.sent': {
          if (emailLog.status === 'QUEUED') {
            emailLog.status = 'SENT';
            emailLog.sentAt = new Date(createdAt || Date.now());
            await emailLog.save();
          }
          break;
        }

        default:
          logger.debug({ eventType, providerMessageId }, 'Resend webhook: Unhandled event type');
          break;
      }

      res.status(200).json({ success: true, processed: true });
    } catch (error) {
      next(error);
    }
  }
}

export const emailWebhookController = new EmailWebhookController();
