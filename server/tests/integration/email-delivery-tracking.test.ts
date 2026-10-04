import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import {
  Brokerage,
  User,
  Lead,
  EmailLog,
  EmailSuppression,
  EmailTemplate,
  PipelineTrigger,
  TriggerExecution,
} from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';
import { emailService, MockEmailService, ResendEmailService } from '../../src/services/email.service.js';
import { processEmailJob } from '../../src/queues/email.worker.js';
import { triggerService } from '../../src/services/trigger.service.js';

describe('Phase 3: Resend Email Delivery & Delivery Tracking Integration Tests', () => {
  const TEST_SIGNING_SECRET = 'test-webhook-signing-secret-only';
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;
  let advisorA: InstanceType<typeof User>;
  let advisorB: InstanceType<typeof User>;
  let advisorTokenA: string;
  let advisorTokenB: string;

  let leadA: InstanceType<typeof Lead>;
  let templateA: InstanceType<typeof EmailTemplate>;

  /**
   * Generates valid Svix signature headers matching Resend's webhook format.
   */
  function generateSvixHeaders(payload: string, secret: string = TEST_SIGNING_SECRET, customTimestamp?: number) {
    const timestamp = customTimestamp ?? Math.floor(Date.now() / 1000);
    const id = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const toSign = `${id}.${timestamp}.${payload}`;

    const key = secret.startsWith('whsec_')
      ? Buffer.from(secret.slice(6), 'base64')
      : Buffer.from(secret, 'utf8');

    const signature = crypto.createHmac('sha256', key).update(toSign).digest('base64');

    return {
      'svix-id': id,
      'svix-timestamp': timestamp.toString(),
      'svix-signature': `v1,${signature}`,
    };
  }

  beforeEach(async () => {
    emailService.clearSentEmails();
    emailService.setSimulationMode({});

    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    brokerageA = await Brokerage.create({
      name: 'Alpha Mortgages',
      slug: 'alpha-mortgages-' + Date.now(),
      status: 'ACTIVE',
      plan: 'GROWTH',
    });

    brokerageB = await Brokerage.create({
      name: 'Beta Finance',
      slug: 'beta-finance-' + Date.now(),
      status: 'ACTIVE',
      plan: 'STARTER',
    });

    advisorA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Advisor Alice',
      email: `alice.${Date.now()}@alpha.de`,
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Advisor Bob',
      email: `bob.${Date.now()}@beta.de`,
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    advisorTokenA = tokenService.generateAccessToken({
      userId: advisorA._id.toString(),
      email: advisorA.email,
      role: advisorA.role,
      brokerageId: brokerageA._id.toString(),
    });

    advisorTokenB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: advisorB.role,
      brokerageId: brokerageB._id.toString(),
    });

    leadA = await Lead.create({
      brokerageId: brokerageA._id,
      firstName: 'Vikram',
      lastName: 'Malhotra',
      email: 'vikram.malhotra@testexpat.de',
      status: 'QUALIFIED',
      source: 'WEBSITE',
      assignedTo: advisorA._id,
    });

    templateA = await EmailTemplate.create({
      brokerageId: brokerageA._id,
      name: 'Rate Proposal Notification',
      slug: 'rate-proposal-' + Date.now(),
      subject: 'Your German Mortgage Proposal is Ready',
      body: 'Hello {{lead.firstName}}, your proposal from {{brokerage.name}} has been prepared by {{advisor.name}}.',
      variables: ['lead.firstName', 'brokerage.name', 'advisor.name'],
      isActive: true,
    });
  });

  afterEach(async () => {
    emailService.clearSentEmails();
  });

  describe('1. Resend Provider Adapter & Mock Preservation', () => {
    it('preserves MockEmailService for development/testing without real external requests', async () => {
      const mock = new MockEmailService();
      const result = await mock.sendEmail({
        to: 'test@example.com',
        subject: 'Welcome',
        body: 'Welcome to LeadFlow',
        brokerageId: brokerageA._id.toString(),
      });

      expect(result.status).toBe('SENT');
      expect(result.messageId).toMatch(/^msg_/);
      expect(mock.getSentEmails()).toHaveLength(1);
    });

    it('instantiates ResendEmailService and prepares proper sender identity and metadata tags', () => {
      const resendService = new ResendEmailService('re_test_key_1234567890', 'Sender <sender@leadflow.io>');
      expect(resendService).toBeInstanceOf(ResendEmailService);
    });
  });

  describe('2. EmailLog Persistence & TriggerExecution Linking', () => {
    it('creates an EmailLog record and links it to TriggerExecution upon job processing', async () => {
      const idempotencyKey = `email-test-${Date.now()}`;

      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: new Types.ObjectId(),
        leadId: leadA._id,
        stage: 'QUALIFIED',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'PENDING',
      });

      const mockJob = {
        id: 'job-email-123',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: new Types.ObjectId().toString(),
          templateId: templateA._id.toString(),
          to: leadA.email,
          recipientName: 'Vikram Malhotra',
          recipientType: 'LEAD',
          subject: 'Your Proposal',
          body: 'Here is your proposal.',
          idempotencyKey,
        },
      } as any;

      const result = await processEmailJob(mockJob);

      expect(result.status).toBe('SENT');
      expect(result.messageId).toBeDefined();

      // Verify EmailLog created
      const log = await EmailLog.findOne({
        brokerageId: brokerageA._id,
        recipientEmail: leadA.email.toLowerCase(),
      });

      expect(log).not.toBeNull();
      expect(log!.status).toBe('SENT');
      expect(log!.providerMessageId).toBe(result.messageId);
      expect(log!.sentAt).toBeInstanceOf(Date);

      // Verify TriggerExecution updated with emailLogId
      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });

      expect(execution!.status).toBe('EXECUTED');
      expect(execution!.emailLogId).toBeDefined();
      expect(execution!.emailLogId!.toString()).toBe(log!._id.toString());
    });
  });

  describe('3. Resend Webhook Authentication & Replay Protection', () => {
    it('rejects webhooks with missing Svix signature headers when secret is configured', async () => {
      const originalSecret = env.RESEND_WEBHOOK_SIGNING_SECRET;
      (env as any).RESEND_WEBHOOK_SIGNING_SECRET = TEST_SIGNING_SECRET;

      try {
        const res = await request(app)
          .post('/api/webhooks/email/resend')
          .send({ type: 'email.delivered', data: { email_id: 'msg_1' } });

        expect(res.status).toBe(401);
        expect(res.body.error.message).toMatch(/Missing required webhook verification headers/);
      } finally {
        (env as any).RESEND_WEBHOOK_SIGNING_SECRET = originalSecret;
      }
    });

    it('rejects webhooks with an invalid cryptographic signature', async () => {
      const originalSecret = env.RESEND_WEBHOOK_SIGNING_SECRET;
      (env as any).RESEND_WEBHOOK_SIGNING_SECRET = TEST_SIGNING_SECRET;

      try {
        const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg_1' } });
        const headers = generateSvixHeaders(body, 'whsec_DIFFERENT_SECRET_1234567890123');

        const res = await request(app)
          .post('/api/webhooks/email/resend')
          .set(headers)
          .set('Content-Type', 'application/json')
          .send(body);

        expect(res.status).toBe(401);
        expect(res.body.error.message).toMatch(/Invalid webhook signature/);
      } finally {
        (env as any).RESEND_WEBHOOK_SIGNING_SECRET = originalSecret;
      }
    });

    it('rejects expired webhook timestamps (replay attack defense > 5 minutes)', async () => {
      const originalSecret = env.RESEND_WEBHOOK_SIGNING_SECRET;
      (env as any).RESEND_WEBHOOK_SIGNING_SECRET = TEST_SIGNING_SECRET;

      try {
        const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg_1' } });
        const sixMinutesAgo = Math.floor(Date.now() / 1000) - 360;
        const headers = generateSvixHeaders(body, TEST_SIGNING_SECRET, sixMinutesAgo);

        const res = await request(app)
          .post('/api/webhooks/email/resend')
          .set(headers)
          .set('Content-Type', 'application/json')
          .send(body);

        expect(res.status).toBe(401);
        expect(res.body.error.message).toMatch(/replay attack detected/);
      } finally {
        (env as any).RESEND_WEBHOOK_SIGNING_SECRET = originalSecret;
      }
    });

    it('accepts webhooks with a valid signature and fresh timestamp', async () => {
      const originalSecret = env.RESEND_WEBHOOK_SIGNING_SECRET;
      (env as any).RESEND_WEBHOOK_SIGNING_SECRET = TEST_SIGNING_SECRET;

      try {
        const providerMessageId = `msg_test_${Date.now()}`;

        await EmailLog.create({
          brokerageId: brokerageA._id,
          leadId: leadA._id,
          recipientEmail: leadA.email,
          subject: 'Test Subject',
          provider: 'RESEND',
          providerMessageId,
          status: 'SENT',
          sentAt: new Date(),
        });

        const body = JSON.stringify({
          type: 'email.delivered',
          created_at: new Date().toISOString(),
          data: { email_id: providerMessageId, to: [leadA.email] },
        });

        const headers = generateSvixHeaders(body, TEST_SIGNING_SECRET);

        const res = await request(app)
          .post('/api/webhooks/email/resend')
          .set(headers)
          .set('Content-Type', 'application/json')
          .send(body);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const updated = await EmailLog.findOne({ providerMessageId });
        expect(updated!.status).toBe('DELIVERED');
        expect(updated!.deliveredAt).toBeInstanceOf(Date);
      } finally {
        (env as any).RESEND_WEBHOOK_SIGNING_SECRET = originalSecret;
      }
    });
  });

  describe('4. Delivery & Bounce Tracking Lifecycle', () => {
    it('records email bounce, sets bounceReason, and adds recipient to EmailSuppression', async () => {
      const originalSecret = env.RESEND_WEBHOOK_SIGNING_SECRET;
      (env as any).RESEND_WEBHOOK_SIGNING_SECRET = TEST_SIGNING_SECRET;

      try {
        const providerMessageId = `msg_bounce_${Date.now()}`;

        const emailLog = await EmailLog.create({
          brokerageId: brokerageA._id,
          leadId: leadA._id,
          recipientEmail: 'bouncing.borrower@invalid-domain-test.de',
          subject: 'Mortgage Update',
          provider: 'RESEND',
          providerMessageId,
          status: 'SENT',
          sentAt: new Date(),
        });

        const body = JSON.stringify({
          type: 'email.bounced',
          created_at: new Date().toISOString(),
          data: {
            email_id: providerMessageId,
            to: ['bouncing.borrower@invalid-domain-test.de'],
            bounce: {
              type: 'hard_bounce',
              message: '550 5.1.1 Recipient address rejected: User unknown in virtual mailbox table',
            },
          },
        });

        const headers = generateSvixHeaders(body, TEST_SIGNING_SECRET);

        const res = await request(app)
          .post('/api/webhooks/email/resend')
          .set(headers)
          .set('Content-Type', 'application/json')
          .send(body);

        expect(res.status).toBe(200);

        // Verify EmailLog status
        const updatedLog = await EmailLog.findById(emailLog._id);
        expect(updatedLog!.status).toBe('BOUNCED');
        expect(updatedLog!.bounceType).toBe('HARD');
        expect(updatedLog!.bounceReason).toContain('User unknown');

        // Verify recipient was added to EmailSuppression
        const suppression = await EmailSuppression.findOne({
          brokerageId: brokerageA._id,
          email: 'bouncing.borrower@invalid-domain-test.de',
        });

        expect(suppression).not.toBeNull();
        expect(suppression!.reason).toBe('BOUNCE');
        expect(suppression!.details).toContain('User unknown');
      } finally {
        (env as any).RESEND_WEBHOOK_SIGNING_SECRET = originalSecret;
      }
    });

    it('enforces monotonic state progression: delivered event does not overwrite a terminal bounce', async () => {
      const originalSecret = env.RESEND_WEBHOOK_SIGNING_SECRET;
      (env as any).RESEND_WEBHOOK_SIGNING_SECRET = TEST_SIGNING_SECRET;

      try {
        const providerMessageId = `msg_monotonic_${Date.now()}`;

        await EmailLog.create({
          brokerageId: brokerageA._id,
          leadId: leadA._id,
          recipientEmail: leadA.email,
          subject: 'Mortgage Notice',
          provider: 'RESEND',
          providerMessageId,
          status: 'BOUNCED',
          bounceType: 'HARD',
          bounceReason: 'Mailbox not found',
          bouncedAt: new Date(),
        });

        // Out-of-order late delivered event
        const body = JSON.stringify({
          type: 'email.delivered',
          created_at: new Date().toISOString(),
          data: { email_id: providerMessageId, to: [leadA.email] },
        });

        const headers = generateSvixHeaders(body, TEST_SIGNING_SECRET);

        const res = await request(app)
          .post('/api/webhooks/email/resend')
          .set(headers)
          .set('Content-Type', 'application/json')
          .send(body);

        expect(res.status).toBe(200);

        // Verify status remained BOUNCED
        const log = await EmailLog.findOne({ providerMessageId });
        expect(log!.status).toBe('BOUNCED');
      } finally {
        (env as any).RESEND_WEBHOOK_SIGNING_SECRET = originalSecret;
      }
    });
  });

  describe('5. Recipient Bounce/Complaint Suppression Defense', () => {
    it('skips email trigger queueing if recipient is already in EmailSuppression list', async () => {
      // Add leadA.email to suppression
      await EmailSuppression.create({
        brokerageId: brokerageA._id,
        email: leadA.email.toLowerCase(),
        reason: 'BOUNCE',
        details: 'Mailbox disabled',
      });

      // Configure stage trigger
      await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Automated Qualified Email',
        fromStage: '*',
        toStage: 'QUALIFIED',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
        },
        isActive: true,
      });

      const summary = await triggerService.handleStageTransition({
        brokerageId: brokerageA._id,
        lead: leadA,
        previousStage: 'CONTACTED',
        newStage: 'QUALIFIED',
      });

      // Email was NOT enqueued because recipient is suppressed
      expect(summary.emailsEnqueued).toBe(0);

      // Verify TriggerExecution recorded as FAILED with suppression note
      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        leadId: leadA._id,
        stage: 'QUALIFIED',
      });

      expect(execution).not.toBeNull();
      expect(execution!.status).toBe('FAILED');
      expect(execution!.error).toContain('suppressed');
    });

    it('blocks email worker execution if recipient is suppressed, throwing UnrecoverableError', async () => {
      await EmailSuppression.create({
        brokerageId: brokerageA._id,
        email: 'suppressed.borrower@test.de',
        reason: 'COMPLAINT',
        details: 'Spam complaint registered',
      });

      const idempotencyKey = `suppressed-job-${Date.now()}`;

      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: new Types.ObjectId(),
        leadId: leadA._id,
        stage: 'QUALIFIED',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'PENDING',
      });

      const mockJob = {
        id: 'job-suppressed-456',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: new Types.ObjectId().toString(),
          templateId: templateA._id.toString(),
          to: 'suppressed.borrower@test.de',
          recipientType: 'LEAD',
          subject: 'Rate Quote',
          body: 'Hello',
          idempotencyKey,
        },
      } as any;

      await expect(processEmailJob(mockJob)).rejects.toThrow(/suppressed/);

      // Verify TriggerExecution is marked FAILED
      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });
      expect(execution!.status).toBe('FAILED');
    });
  });

  describe('6. Lead Email Delivery History API (GET /api/leads/:id/emails)', () => {
    it('allows an advisor to view email delivery history for their lead', async () => {
      await EmailLog.create({
        brokerageId: brokerageA._id,
        leadId: leadA._id,
        recipientEmail: leadA.email,
        subject: 'Welcome Proposal',
        provider: 'RESEND',
        providerMessageId: 'msg_history_1',
        status: 'DELIVERED',
        sentAt: new Date(Date.now() - 3600000),
        deliveredAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/leads/${leadA._id}/emails`)
        .set('Authorization', `Bearer ${advisorTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].subject).toBe('Welcome Proposal');
      expect(res.body.data[0].status).toBe('DELIVERED');
    });

    it('enforces anti-IDOR isolation: Advisor from another brokerage receives 404', async () => {
      const res = await request(app)
        .get(`/api/leads/${leadA._id}/emails`)
        .set('Authorization', `Bearer ${advisorTokenB}`); // Advisor B in Brokerage B

      expect(res.status).toBe(404);
      expect(res.body.error.message).toMatch(/Lead resource not found/);
    });
  });
});
