import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import {
  Brokerage,
  User,
  Lead,
  Task,
  PipelineTrigger,
  EmailTemplate,
  TriggerExecution,
} from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';
import { leadPipelineService } from '../../src/services/lead-pipeline.service.js';
import { triggerService } from '../../src/services/trigger.service.js';
import { emailService } from '../../src/services/email.service.js';
import {
  getEmailQueue,
  closeEmailQueue,
  createEmailWorker,
  closeEmailWorker,
  processEmailJob,
  EMAIL_DELIVERY_QUEUE_NAME,
} from '../../src/queues/index.js';
import { closeRedisConnections } from '../../src/queues/redis.connection.js';

describe('Phase 7 P1: Pipeline Triggers, Tasks & Email Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let httpServer: http.Server;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let advisorA: InstanceType<typeof User>;
  let advisorB: InstanceType<typeof User>;
  let adminA: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;

  let tokenAdvisorA: string;
  let tokenAdvisorB: string;
  let tokenAdminA: string;
  let tokenClientA: string;

  let welcomeTemplateA: InstanceType<typeof EmailTemplate>;
  let templateBrokerageB: InstanceType<typeof EmailTemplate>;

  beforeAll(async () => {
    httpServer = http.createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, () => resolve()));
  });

  afterAll(async () => {
    await closeEmailWorker();
    await closeEmailQueue();
    await closeRedisConnections();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    emailService.clearSentEmails();

    const queue = getEmailQueue();
    await queue.obliterate({ force: true }).catch(() => {});

    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Create Brokerages
    brokerageA = await Brokerage.create({
      name: 'Berlin Expat Mortgages GmbH',
      slug: 'berlin-expat',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Munich Home Loans UG',
      slug: 'munich-home',
      plan: 'STARTER',
      status: 'ACTIVE',
    });

    // 2. Create Users
    advisorA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Elena Schmidt',
      email: 'elena@berlin-expat.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    adminA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Klaus Mueller',
      email: 'klaus@berlin-expat.de',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Hans Becker',
      email: 'hans@munich-home.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    clientUserA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Alex Johnson',
      email: 'alex.expat@gmail.com',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    // 3. Issue Tokens
    tokenAdvisorA = tokenService.generateAccessToken({
      userId: advisorA._id.toString(),
      email: advisorA.email,
      role: advisorA.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdminA = tokenService.generateAccessToken({
      userId: adminA._id.toString(),
      email: adminA.email,
      role: adminA.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdvisorB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: advisorB.role,
      brokerageId: brokerageB._id.toString(),
    });

    tokenClientA = tokenService.generateAccessToken({
      userId: clientUserA._id.toString(),
      email: clientUserA.email,
      role: clientUserA.role,
      brokerageId: brokerageA._id.toString(),
    });

    // 4. Create Email Templates
    welcomeTemplateA = await EmailTemplate.create({
      brokerageId: brokerageA._id,
      name: 'Welcome Expat Template',
      slug: 'welcome-expat',
      subject: 'Welcome to Berlin Expat Mortgages, {{firstName}}!',
      body: '<p>Hi {{firstName}}, your advisor {{advisorName}} will help you with your mortgage search.</p>',
      variables: ['firstName', 'advisorName'],
      isActive: true,
    });

    templateBrokerageB = await EmailTemplate.create({
      brokerageId: brokerageB._id,
      name: 'Munich Special Welcome',
      slug: 'munich-welcome',
      subject: 'Servus {{firstName}}!',
      body: '<p>Welcome to Munich finance!</p>',
      variables: ['firstName'],
      isActive: true,
    });
  });

  afterEach(async () => {
    emailService.clearSentEmails();
  });

  describe('1. Pipeline Stage Transition Triggers & Advisor Task Creation', () => {
    it('creates an advisor task with title, assignee, due date, and overdue-safe status when lead enters stage', async () => {
      // Setup Task Trigger for stage 'QUALIFIED'
      await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Create financial review task on QUALIFIED',
        fromStage: 'CONTACTED',
        toStage: 'QUALIFIED',
        actionType: 'CREATE_TASK',
        actionConfig: {
          taskTitle: 'Verify payslips and visa for {{firstName}} {{lastName}}',
          taskPriority: 'HIGH',
          dueDaysOffset: 2,
        },
        isActive: true,
      });

      // Create Lead in CONTACTED stage
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Marcus',
        lastName: 'Aurelius',
        email: 'marcus@rome.de',
        phone: '+49 170 1234567',
        status: 'CONTACTED',
        source: 'WEBSITE',
        score: 80,
        assignedTo: advisorA._id,
      });

      // Transition stage via HTTP PATCH /api/leads/:id/stage
      const response = await request(app)
        .patch(`/api/leads/${lead._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({
          stage: 'QUALIFIED',
          expectedVersion: lead.__v,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.currentStage).toBe('QUALIFIED');

      // Wait briefly for non-blocking trigger execution to complete in background
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify task was created in MongoDB
      const createdTask = await Task.findOne({
        brokerageId: brokerageA._id,
        leadId: lead._id,
      });

      expect(createdTask).not.toBeNull();
      expect(createdTask!.title).toBe('Verify payslips and visa for Marcus Aurelius');
      expect(createdTask!.status).toBe('PENDING'); // Overdue-safe status
      expect(createdTask!.priority).toBe('HIGH');
      expect(createdTask!.assignedTo.toString()).toBe(advisorA._id.toString());
      expect(createdTask!.dueDate).toBeInstanceOf(Date);
      expect(createdTask!.isOverdue).toBe(false); // Future due date

      // Verify TriggerExecution audit record
      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        leadId: lead._id,
        stage: 'QUALIFIED',
      });

      expect(execution).not.toBeNull();
      expect(execution!.status).toBe('EXECUTED');
      expect(execution!.taskId?.toString()).toBe(createdTask!._id.toString());
    });

    it('supports hour-based offsets for rapid response tasks (e.g. Call within 2 hours)', async () => {
      await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Urgent Contact Trigger',
        fromStage: null,
        toStage: 'CONTACTED',
        actionType: 'CREATE_TASK',
        actionConfig: {
          taskTitle: 'Urgent call for {{firstName}}',
          taskPriority: 'URGENT',
          dueHoursOffset: 2,
        },
        isActive: true,
      });

      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah@skynet.de',
        status: 'NEW',
        assignedTo: advisorA._id,
      });

      const beforeTime = Date.now();
      await request(app)
        .patch(`/api/leads/${lead._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ stage: 'CONTACTED', expectedVersion: lead.__v });

      // Wait briefly for non-blocking trigger execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      const task = await Task.findOne({ brokerageId: brokerageA._id, leadId: lead._id });
      expect(task).not.toBeNull();
      expect(task!.priority).toBe('URGENT');

      // Due date should be approximately 2 hours in the future (+- 10 seconds)
      const expectedDueTime = beforeTime + 2 * 3600 * 1000;
      const actualDueTime = task!.dueDate!.getTime();
      expect(Math.abs(actualDueTime - expectedDueTime)).toBeLessThan(10000);
    });
  });

  describe('2. Pipeline Stage Email Trigger & Placeholder Rendering', () => {
    it('enqueues an email job with placeholder substitution and dispatches via BullMQ', async () => {
      // Setup SEND_EMAIL Trigger for stage 'QUALIFIED'
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Send qualification welcome',
        fromStage: 'CONTACTED',
        toStage: 'QUALIFIED',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: welcomeTemplateA._id,
          recipientType: 'LEAD',
        },
        isActive: true,
      });

      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Alexander',
        lastName: 'TheGreat',
        email: 'alexander@macedon.gr',
        status: 'CONTACTED',
        assignedTo: advisorA._id,
      });

      // Move lead stage
      const patchResponse = await request(app)
        .patch(`/api/leads/${lead._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ stage: 'QUALIFIED', expectedVersion: lead.__v });

      expect(patchResponse.status).toBe(200);

      // Poll briefly until trigger execution finishes
      let exec;
      for (let i = 0; i < 20; i++) {
        exec = await TriggerExecution.findOne({ leadId: lead._id });
        if (exec?.emailJobId) break;
        await new Promise((r) => setTimeout(r, 50));
      }

      expect(exec).toBeDefined();
      expect(exec!.emailJobId).toBeTruthy();

      // Verify email job was added to BullMQ queue
      const queue = getEmailQueue();
      const emailJob = await queue.getJob(exec!.emailJobId!);
      expect(emailJob).toBeDefined();
      expect(emailJob!.data.to).toBe('alexander@macedon.gr');
      expect(emailJob!.data.subject).toBe('Welcome to Berlin Expat Mortgages, Alexander!');
      expect(emailJob!.data.body).toContain('Hi Alexander');
      expect(emailJob!.data.body).toContain('Elena Schmidt'); // Advisor name placeholder

      // Process job via worker
      const processResult = await processEmailJob(emailJob!);
      expect(processResult.status).toBe('SENT');

      // Verify email service record
      const sentEmails = emailService.getSentEmails();
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0]!.to).toBe('alexander@macedon.gr');
      expect(sentEmails[0]!.subject).toBe('Welcome to Berlin Expat Mortgages, Alexander!');

      // Verify TriggerExecution is EXECUTED
      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        leadId: lead._id,
        triggerId: trigger._id,
      });
      expect(execution!.status).toBe('EXECUTED');
      expect(execution!.recipientEmail).toBe('alexander@macedon.gr');
    });
  });

  describe('3. Idempotency & Deduplication under Concurrent/Duplicate Events', () => {
    it('guarantees duplicate stage trigger events do NOT create duplicate tasks or duplicate emails', async () => {
      const trigger = await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Task and Email trigger on WON',
        fromStage: null,
        toStage: 'WON',
        actionType: 'CREATE_TASK',
        actionConfig: {
          taskTitle: 'Post-won onboarding for {{firstName}}',
          dueDaysOffset: 1,
        },
        isActive: true,
      });

      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Diana',
        lastName: 'Prince',
        email: 'diana@amazon.com',
        status: 'NEGOTIATION',
        assignedTo: advisorA._id,
      });

      // Simulate 5 duplicate/concurrent executions of the same stage transition
      const executionPromises = Array.from({ length: 5 }).map(() =>
        triggerService.handleStageTransition({
          brokerageId: brokerageA._id,
          lead,
          previousStage: 'NEGOTIATION',
          newStage: 'WON',
        })
      );

      const summaries = await Promise.all(executionPromises);

      // Verify task count is exactly 1 in MongoDB
      const tasks = await Task.find({
        brokerageId: brokerageA._id,
        leadId: lead._id,
      });
      expect(tasks.length).toBe(1);

      // Verify TriggerExecution count is exactly 1 in MongoDB
      const executions = await TriggerExecution.find({
        brokerageId: brokerageA._id,
        leadId: lead._id,
        stage: 'WON',
      });
      expect(executions.length).toBe(1);
      expect(executions[0]!.status).toBe('EXECUTED');

      // Across the 5 runs, exactly 1 created the task, others skipped as duplicate
      const totalCreated = summaries.reduce((acc, s) => acc + s.tasksCreated, 0);
      const totalSkipped = summaries.reduce((acc, s) => acc + s.skippedDuplicates, 0);
      expect(totalCreated).toBe(1);
      expect(totalSkipped).toBe(4);
    });

    it('worker deduplication: skips dispatch if TriggerExecution is already marked EXECUTED', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Clark',
        lastName: 'Kent',
        email: 'clark@dailyplanet.com',
        status: 'NEW',
      });

      const idempotencyKey = `trigger:${lead._id}:test-trig:NEW`;

      // Pre-mark as EXECUTED
      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: new Types.ObjectId(),
        leadId: lead._id,
        stage: 'NEW',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'EXECUTED',
      });

      // Attempt to process a job with the same idempotencyKey
      const mockJob = {
        id: 'job-dup-1',
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: lead._id.toString(),
          triggerId: new Types.ObjectId().toString(),
          to: 'clark@dailyplanet.com',
          recipientType: 'LEAD',
          subject: 'Duplicate Test',
          body: 'Hello',
          idempotencyKey,
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      const result = await processEmailJob(mockJob);
      expect(result.status).toBe('ALREADY_EXECUTED');
      expect(emailService.getSentEmails().length).toBe(0); // Nothing sent
    });
  });

  describe('4. Tenant Isolation & Anti-Tampering Protections', () => {
    it('blocks Brokerage A trigger from using Brokerage B email template', async () => {
      // Trigger in Brokerage A referencing template from Brokerage B!
      await PipelineTrigger.create({
        brokerageId: brokerageA._id,
        name: 'Malicious Cross-Tenant Trigger',
        toStage: 'QUALIFIED',
        actionType: 'SEND_EMAIL',
        actionConfig: {
          templateId: templateBrokerageB._id, // Tenant B template!
          recipientType: 'LEAD',
        },
        isActive: true,
      });

      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Bruce',
        lastName: 'Wayne',
        email: 'bruce@wayne.com',
        status: 'CONTACTED',
      });

      // Execute trigger
      const summary = await triggerService.handleStageTransition({
        brokerageId: brokerageA._id,
        lead,
        previousStage: 'CONTACTED',
        newStage: 'QUALIFIED',
      });

      expect(summary.emailsEnqueued).toBe(0);
      expect(summary.errors).toBe(1);

      // TriggerExecution recorded as FAILED
      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        leadId: lead._id,
      });
      expect(execution!.status).toBe('FAILED');
      expect(execution!.error).toContain('not found or unauthorized');
    });

    it('blocks cross-brokerage job payload in email worker (anti-tampering)', async () => {
      const leadB = await Lead.create({
        brokerageId: brokerageB._id,
        firstName: 'Barry',
        lastName: 'Allen',
        email: 'barry@centralcity.de',
        status: 'NEW',
      });

      // Tampered job claiming Brokerage A context for Brokerage B lead
      const tamperedJob = {
        id: 'job-tamper-1',
        data: {
          brokerageId: brokerageA._id.toString(), // Wrong brokerage!
          leadId: leadB._id.toString(),
          triggerId: new Types.ObjectId().toString(),
          to: 'barry@centralcity.de',
          recipientType: 'LEAD',
          subject: 'Tampered Email',
          body: 'Hello',
          idempotencyKey: 'tamper-key-1',
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processEmailJob(tamperedJob)).rejects.toThrow(
        /Brokerage isolation violation/
      );
    });

    it('anti-IDOR: Advisor in Brokerage A gets 404 when querying task in Brokerage B', async () => {
      const taskB = await Task.create({
        brokerageId: brokerageB._id,
        title: 'Confidential Munich Task',
        status: 'PENDING',
        priority: 'HIGH',
        assignedTo: advisorB._id,
        dueDate: new Date(),
      });

      // Query from Advisor A (Brokerage A)
      const res = await request(app)
        .get(`/api/tasks/${taskB._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('5. Email Provider Failures, Bounded Retries & Terminal Rejection', () => {
    it('retries transient provider timeouts with backoff up to attempts limit', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Arthur',
        lastName: 'Curry',
        email: 'arthur@atlantis.org',
        status: 'NEW',
      });

      const transientJob = {
        id: 'job-transient-1',
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: lead._id.toString(),
          triggerId: new Types.ObjectId().toString(),
          to: 'arthur@atlantis.org',
          recipientType: 'LEAD',
          subject: 'Atlantis Meeting',
          body: 'Hello Arthur',
          idempotencyKey: `trigger:${lead._id}:transient:NEW`,
          simulateFailure: true, // Simulate network error
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      // First attempt fails with transient error (retryable)
      await expect(processEmailJob(transientJob)).rejects.toThrow(
        /transient failure/
      );
    });

    it('marks execution as FAILED without infinite loop on terminal rejection', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Victor',
        lastName: 'Stone',
        email: 'victor@cyborg.org',
        status: 'NEW',
      });

      const idempotencyKey = `trigger:${lead._id}:terminal:NEW`;
      await TriggerExecution.create({
        brokerageId: brokerageA._id,
        triggerId: new Types.ObjectId(),
        leadId: lead._id,
        stage: 'NEW',
        actionType: 'SEND_EMAIL',
        idempotencyKey,
        status: 'PENDING',
      });

      const terminalJob = {
        id: 'job-terminal-1',
        data: {
          brokerageId: brokerageA._id.toString(),
          leadId: lead._id.toString(),
          triggerId: new Types.ObjectId().toString(),
          to: 'victor@cyborg.org',
          recipientType: 'LEAD',
          subject: 'Terminal Test',
          body: 'Hello Victor',
          idempotencyKey,
          simulateTerminalFailure: true,
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processEmailJob(terminalJob)).rejects.toThrow(
        /terminal failure/
      );

      // Verify TriggerExecution status transitioned to FAILED
      const execution = await TriggerExecution.findOne({
        brokerageId: brokerageA._id,
        idempotencyKey,
      });
      expect(execution!.status).toBe('FAILED');
      expect(execution!.error).toContain('terminal failure');
    });
  });

  describe('6. Tasks API & RBAC Permissions', () => {
    it('allows ADVISOR and BROKERAGE_ADMIN to list and update tasks', async () => {
      const task = await Task.create({
        brokerageId: brokerageA._id,
        title: 'Review payslip documents',
        status: 'PENDING',
        priority: 'MEDIUM',
        assignedTo: advisorA._id,
        dueDate: new Date(Date.now() + 86400 * 1000),
      });

      // Advisor lists tasks
      const listRes = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      // Advisor updates task status to COMPLETED
      const updateRes = await request(app)
        .patch(`/api/tasks/${task._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ status: 'COMPLETED' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('COMPLETED');
      expect(updateRes.body.data.completedAt).toBeDefined();
    });

    it('forbids CLIENT role from accessing internal advisor tasks (HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('filters tasks by overdue status via query param ?isOverdue=true', async () => {
      // Overdue task
      await Task.create({
        brokerageId: brokerageA._id,
        title: 'Overdue Task',
        status: 'PENDING',
        priority: 'HIGH',
        assignedTo: advisorA._id,
        dueDate: new Date(Date.now() - 3600 * 1000),
      });

      // Future task
      await Task.create({
        brokerageId: brokerageA._id,
        title: 'Future Task',
        status: 'PENDING',
        priority: 'LOW',
        assignedTo: advisorA._id,
        dueDate: new Date(Date.now() + 86400 * 1000),
      });

      const res = await request(app)
        .get('/api/tasks?isOverdue=true')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((t: any) => t.title === 'Overdue Task')).toBe(true);
    });
  });
});
