import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
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
import { emailService } from '../../src/services/email.service.js';
import { processEmailJob } from '../../src/queues/email.worker.js';
import { triggerService, calculateTriggerDelayMs } from '../../src/services/trigger.service.js';
import * as emailQueueModule from '../../src/queues/email.queue.js';

describe('Delayed Email Automation Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;
  let adminA: InstanceType<typeof User>;
  let adminB: InstanceType<typeof User>;
  let adminTokenA: string;
  let adminTokenB: string;

  let leadA: InstanceType<typeof Lead>;
  let templateA: InstanceType<typeof EmailTemplate>;

  beforeEach(async () => {
    emailService.clearSentEmails();
    emailService.setSimulationMode({});

    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    brokerageA = await Brokerage.create({
      name: 'Alpha Mortgages',
      slug: `alpha-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: 'ACTIVE',
      plan: 'GROWTH',
    });

    brokerageB = await Brokerage.create({
      name: 'Beta Mortgages',
      slug: `beta-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: 'ACTIVE',
      plan: 'STARTER',
    });

    adminA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Admin Alice',
      email: `alice.${Date.now()}@alpha.de`,
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    adminB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Admin Bob',
      email: `bob.${Date.now()}@beta.de`,
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    adminTokenA = tokenService.generateAccessToken({
      userId: adminA._id.toString(),
      email: adminA.email,
      role: adminA.role,
      brokerageId: brokerageA._id.toString(),
    });

    adminTokenB = tokenService.generateAccessToken({
      userId: adminB._id.toString(),
      email: adminB.email,
      role: adminB.role,
      brokerageId: brokerageB._id.toString(),
    });

    templateA = await EmailTemplate.create({
      brokerageId: brokerageA._id,
      name: 'Follow-up Consultation',
      slug: `follow-up-${Date.now()}`,
      subject: 'Hello {{firstName}}, review your options',
      body: '<p>Hi {{firstName}}, let us talk about your mortgage.</p>',
      variables: ['firstName'],
      isActive: true,
    });

    leadA = await Lead.create({
      brokerageId: brokerageA._id,
      firstName: 'Vikram',
      lastName: 'Malhotra',
      email: `vikram.${Date.now()}@example.com`,
      phone: '+491761234567',
      status: 'QUALIFIED',
      source: 'MANUAL',
    });
  });

  afterEach(() => {
    emailService.clearSentEmails();
    vi.restoreAllMocks();
  });

  describe('1. API Validation (POST /api/triggers)', () => {
    it('creates an email trigger with valid delay configuration', async () => {
      const payload = {
        name: 'Delayed Follow-up on Proposal',
        fromStage: 'QUALIFIED',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id.toString(),
          recipientType: 'LEAD',
          delayAmount: 2,
          delayUnit: 'HOURS',
          cancelOnStageChange: true,
        },
      };

      const res = await request(app)
        .post('/api/triggers')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Delayed Follow-up on Proposal');
      expect(res.body.data.actionConfig.delayAmount).toBe(2);
      expect(res.body.data.actionConfig.delayUnit).toBe('HOURS');
      expect(res.body.data.actionConfig.cancelOnStageChange).toBe(true);

      const saved = await PipelineTrigger.findById(res.body.data._id);
      expect(saved).not.toBeNull();
      expect(saved!.actionConfig.delayAmount).toBe(2);
      expect(saved!.actionConfig.delayUnit).toBe('HOURS');
      expect(saved!.actionConfig.cancelOnStageChange).toBe(true);
    });

    it('creates an immediate trigger with IMMEDIATE delay unit', async () => {
      const payload = {
        name: 'Immediate Welcome Email',
        fromStage: 'NEW',
        toStage: 'CONTACTED',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id.toString(),
          recipientType: 'LEAD',
          delayUnit: 'IMMEDIATE',
        },
      };

      const res = await request(app)
        .post('/api/triggers')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.actionConfig.delayUnit).toBe('IMMEDIATE');
      expect(res.body.data.actionConfig.delayAmount).toBe(0);
    });

    it('rejects invalid delayUnit', async () => {
      const payload = {
        name: 'Invalid Unit Trigger',
        toStage: 'QUALIFIED',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id.toString(),
          recipientType: 'LEAD',
          delayAmount: 5,
          delayUnit: 'WEEKS', // Invalid unit
        },
      };

      const res = await request(app)
        .post('/api/triggers')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('rejects invalid delayAmount (negative or zero when unit is specified)', async () => {
      const payload = {
        name: 'Negative Delay Trigger',
        toStage: 'QUALIFIED',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id.toString(),
          recipientType: 'LEAD',
          delayAmount: -3,
          delayUnit: 'HOURS',
        },
      };

      const res = await request(app)
        .post('/api/triggers')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('rejects delayAmount exceeding 30-day ceiling for DAYS unit', async () => {
      const payload = {
        name: 'Excessive Delay Trigger',
        toStage: 'QUALIFIED',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id.toString(),
          recipientType: 'LEAD',
          delayAmount: 45, // Exceeds 30 days
          delayUnit: 'DAYS',
        },
      };

      const res = await request(app)
        .post('/api/triggers')
        .set('Authorization', `Bearer ${adminTokenA}`)
        .send(payload);

      expect(res.status).toBe(400);
    });
  });

  describe('2. Delayed vs Immediate Trigger Scheduling & Enqueueing', () => {
    it('schedules delayed email with SCHEDULED status and passes delay option to BullMQ', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: '2-Hour Follow-up on Proposal',
        fromStage: 'QUALIFIED',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
          delayAmount: 2,
          delayUnit: 'HOURS',
          cancelOnStageChange: true,
        },
        isActive: true,
      });

      let enqueuedDelay: number | undefined;
      let enqueuedPayload: any;

      vi.spyOn(emailQueueModule, 'enqueueEmailJob').mockImplementation(async (payload, opts) => {
        enqueuedPayload = payload;
        enqueuedDelay = opts?.delay;
        return { id: 'mock-job-1' } as any;
      });

      const summary = await triggerService.handleStageTransition({
        brokerageId: brokerageA._id,
        lead: leadA,
        previousStage: 'QUALIFIED',
        newStage: 'PROPOSAL',
      });

      expect(summary.emailsEnqueued).toBe(1);
      expect(enqueuedDelay).toBe(2 * 3600 * 1000); // Exactly 2 hours in ms
      expect(enqueuedPayload.expectedStage).toBe('PROPOSAL');
      expect(enqueuedPayload.cancelOnStageChange).toBe(true);
      expect(enqueuedPayload.scheduledFor).toBeDefined();

      // Check TriggerExecution status
      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        triggerId: trigger._id,
        leadId: leadA._id,
      });

      expect(execution).not.toBeNull();
      expect(execution!.status).toBe('SCHEDULED');
      expect(execution!.scheduledFor).toBeDefined();
      expect(execution!.scheduledFor!.getTime()).toBeGreaterThan(Date.now() + 7100 * 1000);
    });

    it('preserves immediate send behavior with PENDING status and delay: 0 / undefined', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Immediate Notification',
        fromStage: 'QUALIFIED',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
          delayUnit: 'IMMEDIATE',
        },
        isActive: true,
      });

      let enqueuedDelay: number | undefined;

      vi.spyOn(emailQueueModule, 'enqueueEmailJob').mockImplementation(async (payload, opts) => {
        enqueuedDelay = opts?.delay;
        return { id: 'mock-job-immediate' } as any;
      });

      const summary = await triggerService.handleStageTransition({
        brokerageId: brokerageA._id,
        lead: leadA,
        previousStage: 'QUALIFIED',
        newStage: 'PROPOSAL',
      });

      expect(summary.emailsEnqueued).toBe(1);
      expect(enqueuedDelay).toBeUndefined(); // Immediate send does not set delay option

      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        triggerId: trigger._id,
        leadId: leadA._id,
      });

      expect(execution).not.toBeNull();
      expect(execution!.status).toBe('PENDING');
      expect(execution!.scheduledFor).toBeFalsy();
    });

    it('enforces idempotency and skips duplicate execution scheduling', async () => {
      await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Unique Stage Notification',
        fromStage: 'QUALIFIED',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
          delayAmount: 15,
          delayUnit: 'MINUTES',
        },
        isActive: true,
      });

      let enqueueCalls = 0;
      vi.spyOn(emailQueueModule, 'enqueueEmailJob').mockImplementation(async () => {
        enqueueCalls++;
        return { id: `mock-job-${enqueueCalls}` } as any;
      });

      const firstSummary = await triggerService.handleStageTransition({
        brokerageId: brokerageA._id,
        lead: leadA,
        previousStage: 'QUALIFIED',
        newStage: 'PROPOSAL',
      });

      expect(firstSummary.emailsEnqueued).toBe(1);
      expect(enqueueCalls).toBe(1);

      // Repeat the same stage transition
      const secondSummary = await triggerService.handleStageTransition({
        brokerageId: brokerageA._id,
        lead: leadA,
        previousStage: 'QUALIFIED',
        newStage: 'PROPOSAL',
      });

      expect(secondSummary.emailsEnqueued).toBe(0);
      expect(secondSummary.skippedDuplicates).toBe(1);
      expect(enqueueCalls).toBe(1); // Enqueue was not called a second time
    });
  });

  describe('3. Worker-Side Validation & Dispatch Rules', () => {
    it('executes delayed job successfully when lead remains at expected stage', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Follow-up Email',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
          delayAmount: 1,
          delayUnit: 'HOURS',
          cancelOnStageChange: true,
        },
        isActive: true,
      });

      leadA.status = 'PROPOSAL';
      await leadA.save();

      const idempotencyKey = `email-delay-test-${Date.now()}`;
      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: trigger._id,
        leadId: leadA._id,
        stage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'SCHEDULED',
        scheduledFor: new Date(Date.now() + 3600 * 1000),
      });

      const mockJob = {
        id: 'job-delay-success',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: trigger._id.toString(),
          templateId: templateA._id.toString(),
          to: leadA.email,
          recipientName: 'Vikram Malhotra',
          recipientType: 'LEAD',
          subject: 'Review proposal',
          body: 'Hello Vikram, review proposal.',
          idempotencyKey,
          expectedStage: 'PROPOSAL',
          cancelOnStageChange: true,
        },
      } as any;

      const result = await processEmailJob(mockJob);

      expect(result.status).toBe('SENT');
      expect(emailService.getSentEmails()).toHaveLength(1);

      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });

      expect(execution!.status).toBe('EXECUTED');
      expect(execution!.emailLogId).toBeDefined();
    });

    it('cancels scheduled email when lead stage has changed and cancelOnStageChange is true', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Proposal Reminder',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
          delayAmount: 1,
          delayUnit: 'DAYS',
          cancelOnStageChange: true,
        },
        isActive: true,
      });

      // Lead has moved to LOST before the delayed job executes!
      leadA.status = 'LOST';
      await leadA.save();

      const idempotencyKey = `email-stage-change-${Date.now()}`;
      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: trigger._id,
        leadId: leadA._id,
        stage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'SCHEDULED',
      });

      const mockJob = {
        id: 'job-stage-change-cancel',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: trigger._id.toString(),
          templateId: templateA._id.toString(),
          to: leadA.email,
          recipientName: 'Vikram Malhotra',
          recipientType: 'LEAD',
          subject: 'Proposal Follow-up',
          body: 'Checking in',
          idempotencyKey,
          expectedStage: 'PROPOSAL',
          cancelOnStageChange: true,
        },
      } as any;

      const result = await processEmailJob(mockJob);

      expect(result.status).toBe('CANCELLED');
      expect(emailService.getSentEmails()).toHaveLength(0); // Email was NOT sent

      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });

      expect(execution!.status).toBe('CANCELLED');
      expect(execution!.cancellationReason).toContain('Lead transitioned from PROPOSAL to LOST');
    });

    it('sends email even if stage changed when cancelOnStageChange is false', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Guaranteed Update Email',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
          delayAmount: 1,
          delayUnit: 'HOURS',
          cancelOnStageChange: false, // Do NOT cancel
        },
        isActive: true,
      });

      leadA.status = 'NEGOTIATION';
      await leadA.save();

      const idempotencyKey = `email-no-cancel-${Date.now()}`;
      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: trigger._id,
        leadId: leadA._id,
        stage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'SCHEDULED',
      });

      const mockJob = {
        id: 'job-no-cancel',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: trigger._id.toString(),
          templateId: templateA._id.toString(),
          to: leadA.email,
          recipientName: 'Vikram Malhotra',
          recipientType: 'LEAD',
          subject: 'Guaranteed Information',
          body: 'Information content',
          idempotencyKey,
          expectedStage: 'PROPOSAL',
          cancelOnStageChange: false,
        },
      } as any;

      const result = await processEmailJob(mockJob);

      expect(result.status).toBe('SENT');
      expect(emailService.getSentEmails()).toHaveLength(1);

      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });

      expect(execution!.status).toBe('EXECUTED');
    });

    it('cancels scheduled email when trigger was deactivated before job executes', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Deactivated Trigger',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
          delayAmount: 2,
          delayUnit: 'HOURS',
        },
        isActive: false, // Deactivated!
      });

      leadA.status = 'PROPOSAL';
      await leadA.save();

      const idempotencyKey = `email-trigger-deactivated-${Date.now()}`;
      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: trigger._id,
        leadId: leadA._id,
        stage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'SCHEDULED',
      });

      const mockJob = {
        id: 'job-trigger-deactivated',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: trigger._id.toString(),
          templateId: templateA._id.toString(),
          to: leadA.email,
          subject: 'Test',
          body: 'Test',
          recipientType: 'LEAD',
          idempotencyKey,
          expectedStage: 'PROPOSAL',
        },
      } as any;

      const result = await processEmailJob(mockJob);

      expect(result.status).toBe('CANCELLED');
      expect(emailService.getSentEmails()).toHaveLength(0);

      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });

      expect(execution!.status).toBe('CANCELLED');
      expect(execution!.cancellationReason).toContain('Trigger was deactivated');
    });

    it('cancels scheduled email when trigger was deleted before job executes', async () => {
      const nonExistentTriggerId = new Types.ObjectId();
      leadA.status = 'PROPOSAL';
      await leadA.save();

      const idempotencyKey = `email-trigger-deleted-${Date.now()}`;
      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: nonExistentTriggerId,
        leadId: leadA._id,
        stage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'SCHEDULED',
      });

      const mockJob = {
        id: 'job-trigger-deleted',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: nonExistentTriggerId.toString(),
          templateId: templateA._id.toString(),
          to: leadA.email,
          subject: 'Test',
          body: 'Test',
          recipientType: 'LEAD',
          idempotencyKey,
          expectedStage: 'PROPOSAL',
        },
      } as any;

      const result = await processEmailJob(mockJob);

      expect(result.status).toBe('CANCELLED');
      expect(emailService.getSentEmails()).toHaveLength(0);

      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });

      expect(execution!.status).toBe('CANCELLED');
      expect(execution!.cancellationReason).toContain('Trigger was deleted');
    });

    it('cancels scheduled email when lead was deleted before job executes', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Deleted Lead Trigger',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
        },
        isActive: true,
      });

      const nonExistentLeadId = new Types.ObjectId();
      const idempotencyKey = `email-lead-deleted-${Date.now()}`;

      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: trigger._id,
        leadId: nonExistentLeadId,
        stage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'SCHEDULED',
      });

      const mockJob = {
        id: 'job-lead-deleted',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: nonExistentLeadId.toString(),
          triggerId: trigger._id.toString(),
          templateId: templateA._id.toString(),
          to: 'deleted@example.com',
          subject: 'Test',
          body: 'Test',
          recipientType: 'LEAD',
          idempotencyKey,
        },
      } as any;

      await expect(processEmailJob(mockJob)).rejects.toThrow(/Lead resource not found/i);
      expect(emailService.getSentEmails()).toHaveLength(0);

      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });

      expect(execution!.status).toBe('CANCELLED');
      expect(execution!.cancellationReason).toContain('Lead not found or has been deleted');
    });

    it('cancels scheduled email when recipient is on email suppression list', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Suppressed Email Trigger',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
        },
        isActive: true,
      });

      leadA.status = 'PROPOSAL';
      await leadA.save();

      // Suppress lead's email
      await EmailSuppression.create({
        brokerageId: brokerageA._id,
        email: leadA.email.toLowerCase(),
        reason: 'BOUNCE',
      });

      const idempotencyKey = `email-suppressed-${Date.now()}`;
      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: trigger._id,
        leadId: leadA._id,
        stage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'SCHEDULED',
      });

      const mockJob = {
        id: 'job-suppressed',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: trigger._id.toString(),
          templateId: templateA._id.toString(),
          to: leadA.email,
          subject: 'Test',
          body: 'Test',
          recipientType: 'LEAD',
          idempotencyKey,
          expectedStage: 'PROPOSAL',
        },
      } as any;

      await expect(processEmailJob(mockJob)).rejects.toThrow(/suppress/i);
      expect(emailService.getSentEmails()).toHaveLength(0);

      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });

      expect(execution!.status).toBe('FAILED');
      expect(execution!.error).toContain('Recipient email is suppressed');
    });

    it('enforces tenant isolation and throws UnrecoverableError on cross-tenant tampering', async () => {
      const triggerInBrokerageB = await PipelineTrigger.create({
        brokerageId: brokerageB._id, // Tenant B
        name: 'Tenant B Trigger',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
        },
        isActive: true,
      });

      const idempotencyKey = `cross-tenant-${Date.now()}`;

      // Job claiming brokerageA but referencing trigger from brokerageB
      const mockJob = {
        id: 'job-cross-tenant-tampering',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: triggerInBrokerageB._id.toString(),
          templateId: templateA._id.toString(),
          to: leadA.email,
          subject: 'Tampering Attempt',
          body: 'Content',
          recipientType: 'LEAD',
          idempotencyKey,
          expectedStage: 'PROPOSAL',
        },
      } as any;

      // Because trigger is scoped to Brokerage B, withBrokerageScope(BrokerageA) returns null
      // Worker cancels cleanly as 'Trigger was deleted or cross-tenant access attempted'
      const result = await processEmailJob(mockJob);

      expect(result.status).toBe('CANCELLED');
      expect(emailService.getSentEmails()).toHaveLength(0);
    });

    it('marks TriggerExecution as FAILED on terminal delivery failure after retries exhausted', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Failing Email Trigger',
        toStage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateA._id,
          recipientType: 'LEAD',
        },
        isActive: true,
      });

      leadA.status = 'PROPOSAL';
      await leadA.save();

      const idempotencyKey = `email-terminal-failure-${Date.now()}`;
      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: trigger._id,
        leadId: leadA._id,
        stage: 'PROPOSAL',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'SCHEDULED',
      });

      const mockJob = {
        id: 'job-terminal-failure',
        attemptsMade: 2, // 3rd and final attempt (attempts = 3)
        opts: { attempts: 3 },
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: leadA._id.toString(),
          triggerId: trigger._id.toString(),
          templateId: templateA._id.toString(),
          to: leadA.email,
          subject: 'Will Fail',
          body: 'Will Fail',
          recipientType: 'LEAD',
          idempotencyKey,
          expectedStage: 'PROPOSAL',
          simulateTerminalFailure: true,
        },
      } as any;

      await expect(processEmailJob(mockJob)).rejects.toThrow();

      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });

      expect(execution!.status).toBe('FAILED');
      expect(execution!.error).toBeDefined();
    });
  });
});
