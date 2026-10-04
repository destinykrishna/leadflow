import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import {
  Brokerage,
  User,
  Lead,
  Client,
  Task,
  ActivityLog,
} from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Phase 6: CRM / Workflow Maturity & Reporting Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;
  let httpServer: http.Server;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let advisorA1: InstanceType<typeof User>;
  let advisorA2: InstanceType<typeof User>;
  let inactiveAdvisorA: InstanceType<typeof User>;
  let adminA: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;

  let advisorB: InstanceType<typeof User>;
  let platformAdmin: InstanceType<typeof User>;

  let tokenAdvisorA1: string;
  let tokenAdvisorA2: string;
  let tokenAdminA: string;
  let tokenClientUserA: string;
  let tokenAdvisorB: string;
  let tokenPlatformAdmin: string;

  beforeAll(async () => {
    httpServer = http.createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, () => resolve()));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Create Brokerages
    brokerageA = await Brokerage.create({
      name: 'Frankfurt Hypothek GmbH',
      slug: 'frankfurt-hypo',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Hamburg Finance AG',
      slug: 'hamburg-finance',
      plan: 'STARTER',
      status: 'ACTIVE',
    });

    // 2. Create Users
    advisorA1 = await User.create({
      brokerageId: brokerageA._id,
      name: 'Maximilian Bauer',
      email: 'max@frankfurt-hypo.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    advisorA2 = await User.create({
      brokerageId: brokerageA._id,
      name: 'Sophie Wagner',
      email: 'sophie@frankfurt-hypo.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    inactiveAdvisorA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Inactive Ex-Advisor',
      email: 'ex@frankfurt-hypo.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'INACTIVE',
    });

    adminA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Admin Frankfurt',
      email: 'admin@frankfurt-hypo.de',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    clientUserA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Borrower Expat',
      email: 'borrower@expat.com',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Lukas Meyer',
      email: 'lukas@hamburg-finance.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    platformAdmin = await User.create({
      brokerageId: null,
      name: 'System Root',
      email: 'root@leadflow.system',
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    });

    // 3. Tokens
    tokenAdvisorA1 = tokenService.generateAccessToken({
      userId: advisorA1._id.toString(),
      email: advisorA1.email,
      role: advisorA1.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdvisorA2 = tokenService.generateAccessToken({
      userId: advisorA2._id.toString(),
      email: advisorA2.email,
      role: advisorA2.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdminA = tokenService.generateAccessToken({
      userId: adminA._id.toString(),
      email: adminA.email,
      role: adminA.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenClientUserA = tokenService.generateAccessToken({
      userId: clientUserA._id.toString(),
      email: clientUserA.email,
      role: clientUserA.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdvisorB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: advisorB.role,
      brokerageId: brokerageB._id.toString(),
    });

    tokenPlatformAdmin = tokenService.generateAccessToken({
      userId: platformAdmin._id.toString(),
      email: platformAdmin.email,
      role: platformAdmin.role,
      brokerageId: null,
    });
  });

  afterEach(async () => {
    await ActivityLog.deleteMany({});
    await Task.deleteMany({});
    await Lead.deleteMany({});
    await Client.deleteMany({});
    await User.deleteMany({});
    await Brokerage.deleteMany({});
  });

  describe('1. PATCH /api/leads/:id (Lead Details, Notes & Concurrency)', () => {
    it('successfully updates notes, phone, and financial customFields by advisor', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Stefan',
        lastName: 'Zweig',
        email: 'stefan.zweig@wien.at',
        phone: '+4312345678',
        source: 'WEBSITE',
        status: 'NEW',
        assignedTo: advisorA1._id,
      });

      const res = await request(httpServer)
        .patch(`/api/leads/${lead._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          notes: 'Spoke with borrower on phone; needs 400k mortgage for Frankfurt apartment.',
          phone: '+491701234567',
          financials: {
            loanAmount: 400000,
            propertyValue: 500000,
            monthlyGrossIncome: 6500,
            downPayment: 100000,
          },
          version: lead.__v,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.lead.notes).toContain('Spoke with borrower');
      expect(res.body.data.lead.phone).toBe('+491701234567');
      expect(res.body.data.lead.customFields.loanAmount).toBe(400000);
      expect(res.body.data.lead.customFields.propertyValue).toBe(500000);
      expect(res.body.data.lead.customFields.monthlyGrossIncome).toBe(6500);

      // Verify NOTE_ADDED activity log was recorded
      const activity = await ActivityLog.findOne({
        leadId: lead._id,
        action: 'NOTE_ADDED',
      });
      expect(activity).not.toBeNull();
      expect(activity?.brokerageId.toString()).toBe(brokerageA._id.toString());
      expect(activity?.actor?.id?.toString()).toBe(advisorA1._id.toString());
    });

    it('enforces tenant isolation and conceals cross-brokerage lead with 404', async () => {
      const leadB = await Lead.create({
        brokerageId: brokerageB._id,
        firstName: 'Hamburg',
        lastName: 'Borrower',
        email: 'hb@hamburg.de',
        source: 'WEBSITE',
        status: 'NEW',
      });

      // Advisor from brokerage A tries to update lead of brokerage B
      const res = await request(httpServer)
        .patch(`/api/leads/${leadB._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          notes: 'Malicious modification probe',
          version: leadB.__v,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects CLIENT role with 403 Forbidden', async () => {
      const leadA = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Expat',
        lastName: 'Client',
        email: 'client@expat.com',
        source: 'WEBSITE',
        status: 'NEW',
      });

      const res = await request(httpServer)
        .patch(`/api/leads/${leadA._id}`)
        .set('Authorization', `Bearer ${tokenClientUserA}`)
        .send({
          notes: 'Trying to update own lead as client',
          version: leadA.__v,
        });

      expect(res.status).toBe(403);
    });

    it('detects optimistic concurrency conflict (409) when version does not match', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Conflict',
        lastName: 'Tester',
        email: 'conflict@test.de',
        source: 'WEBSITE',
        status: 'NEW',
      });

      const res = await request(httpServer)
        .patch(`/api/leads/${lead._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          notes: 'First attempt with stale version',
          version: lead.__v + 99,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('2. POST /api/tasks (Manual Follow-Up Task Creation & Entity Linkage)', () => {
    it('creates manual follow-up task linked to a lead with active advisor', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Anna',
        lastName: 'Frank',
        email: 'anna@frank.de',
        source: 'WEBSITE',
        status: 'QUALIFIED',
      });

      const dueDate = new Date(Date.now() + 86400000 * 2).toISOString();

      const res = await request(httpServer)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          title: 'Request 3 months bank statements',
          description: 'Borrower indicated salary increase last month.',
          priority: 'HIGH',
          leadId: lead._id.toString(),
          assignedTo: advisorA2._id.toString(),
          dueDate,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const task = res.body.data.task;
      expect(task.title).toBe('Request 3 months bank statements');
      expect((task.brokerageId?._id || task.brokerageId).toString()).toBe(brokerageA._id.toString());
      expect((task.leadId?._id || task.leadId).toString()).toBe(lead._id.toString());
      expect((task.assignedTo?._id || task.assignedTo).toString()).toBe(advisorA2._id.toString());

      // Verify TASK_CREATED activity entry
      const activity = await ActivityLog.findOne({
        leadId: lead._id,
        action: 'TASK_CREATED',
      });
      expect(activity).not.toBeNull();
    });

    it('rejects cross-brokerage lead linkage with 404 IDOR concealment', async () => {
      const leadB = await Lead.create({
        brokerageId: brokerageB._id,
        firstName: 'Foreign',
        lastName: 'Lead',
        email: 'foreign@hamburg.de',
        source: 'WEBSITE',
        status: 'NEW',
      });

      const res = await request(httpServer)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          title: 'Tamper lead across tenants',
          leadId: leadB._id.toString(),
          assignedTo: advisorA1._id.toString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects cross-brokerage advisor assignment', async () => {
      const leadA = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Local',
        lastName: 'Lead',
        email: 'local@frankfurt.de',
        source: 'WEBSITE',
        status: 'NEW',
      });

      // Advisor B belongs to Brokerage B
      const res = await request(httpServer)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          title: 'Assign to competitor advisor',
          leadId: leadA._id.toString(),
          assignedTo: advisorB._id.toString(),
        });

      expect([400, 403, 404]).toContain(res.status);
    });

    it('rejects assignment to an INACTIVE advisor', async () => {
      const leadA = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Local',
        lastName: 'Lead',
        email: 'local2@frankfurt.de',
        source: 'WEBSITE',
        status: 'NEW',
      });

      const res = await request(httpServer)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          title: 'Assign to deactivated staff',
          leadId: leadA._id.toString(),
          assignedTo: inactiveAdvisorA._id.toString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('active');
    });

    it('blocks CLIENT users from creating tasks with 403 Forbidden', async () => {
      const res = await request(httpServer)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tokenClientUserA}`)
        .send({
          title: 'Client trying to create internal task',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. GET /api/advisors/workload (Server-Side Aggregation)', () => {
    it('aggregates active leads, pending tasks, overdue tasks, and won cases per advisor', async () => {
      // Create leads for Advisor A1: 2 active, 1 won
      await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Active1',
        lastName: 'User',
        email: 'a1@test.com',
        source: 'WEBSITE',
        status: 'QUALIFIED',
        assignedTo: advisorA1._id,
        customFields: { loanAmount: 300000 },
      });
      await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Active2',
        lastName: 'User',
        email: 'a2@test.com',
        source: 'WEBSITE',
        status: 'PROPOSAL',
        assignedTo: advisorA1._id,
        customFields: { loanAmount: 200000 },
      });
      await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Won',
        lastName: 'User',
        email: 'w1@test.com',
        source: 'REFERRAL',
        status: 'WON',
        assignedTo: advisorA1._id,
        customFields: { loanAmount: 500000 },
      });

      // Tasks for Advisor A1: 1 pending future, 1 overdue, 1 completed
      await Task.create({
        brokerageId: brokerageA._id,
        title: 'Pending Future Task',
        status: 'PENDING',
        assignedTo: advisorA1._id,
        dueDate: new Date(Date.now() + 86400000 * 5),
      });
      await Task.create({
        brokerageId: brokerageA._id,
        title: 'Overdue Task',
        status: 'PENDING',
        assignedTo: advisorA1._id,
        dueDate: new Date(Date.now() - 86400000 * 2), // 2 days in the past
      });
      await Task.create({
        brokerageId: brokerageA._id,
        title: 'Completed Task',
        status: 'COMPLETED',
        assignedTo: advisorA1._id,
      });

      // Data in Brokerage B (should NOT leak into Brokerage A aggregation)
      await Lead.create({
        brokerageId: brokerageB._id,
        firstName: 'Foreign',
        lastName: 'Lead',
        email: 'foreign@test.com',
        source: 'WEBSITE',
        status: 'QUALIFIED',
        assignedTo: advisorB._id,
      });

      const res = await request(httpServer)
        .get('/api/advisors/workload')
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.summary.totalActiveAssignedLeads).toBe(2);
      expect(data.summary.totalWonCases).toBe(1);
      expect(data.summary.totalPendingTasks).toBe(2);
      expect(data.summary.totalOverdueTasks).toBe(1);

      const metricA1 = data.advisors.find(
        (a: any) => a.advisorId === advisorA1._id.toString()
      );
      expect(metricA1).toBeDefined();
      expect(metricA1.activeLeadsCount).toBe(2);
      expect(metricA1.wonCasesCount).toBe(1);
      expect(metricA1.pendingTasksCount).toBe(2);
      expect(metricA1.overdueTasksCount).toBe(1);
      expect(metricA1.completedTasksCount).toBe(1);
      expect(metricA1.activeLoanVolume).toBe(500000); // 300k + 200k active leads
    });

    it('rejects CLIENT role with 403 Forbidden', async () => {
      const res = await request(httpServer)
        .get('/api/advisors/workload')
        .set('Authorization', `Bearer ${tokenClientUserA}`);

      expect(res.status).toBe(403);
    });
  });

  describe('4. Server-Side Lead Filtering by Source and Advisor', () => {
    beforeEach(async () => {
      await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Website',
        lastName: 'Lead',
        email: 'web@test.com',
        source: 'WEBSITE',
        status: 'NEW',
        assignedTo: advisorA1._id,
      });

      await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Referral',
        lastName: 'Lead',
        email: 'ref@test.com',
        source: 'REFERRAL',
        status: 'QUALIFIED',
        assignedTo: advisorA2._id,
      });

      await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Manual',
        lastName: 'Lead',
        email: 'man@test.com',
        source: 'MANUAL',
        status: 'CONTACTED',
        assignedTo: advisorA1._id,
      });
    });

    it('filters leads by source parameter server-side', async () => {
      const res = await request(httpServer)
        .get('/api/leads?source=WEBSITE')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.leads.length).toBe(1);
      expect(res.body.data.leads[0].source).toBe('WEBSITE');
    });

    it('filters leads by assignedTo advisor parameter server-side', async () => {
      const res = await request(httpServer)
        .get(`/api/leads?assignedTo=${advisorA2._id.toString()}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.leads.length).toBe(1);
      expect(res.body.data.leads[0].email).toBe('ref@test.com');
    });
  });

  describe('5. Dashboard Source Conversion Breakdown & Stale Leads Metric', () => {
    it('returns source breakdown and stale leads count in dashboard metrics', async () => {
      // 1 fresh website lead (created today)
      await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Fresh',
        lastName: 'Lead',
        email: 'fresh@test.com',
        source: 'WEBSITE',
        status: 'NEW',
      });

      // 1 won website lead
      await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'WonWeb',
        lastName: 'Lead',
        email: 'wonweb@test.com',
        source: 'WEBSITE',
        status: 'WON',
      });

      // 1 stale referral lead (updatedAt > 7 days ago)
      const staleDate = new Date(Date.now() - 86400000 * 10);
      const staleLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Stale',
        lastName: 'Lead',
        email: 'stale@test.com',
        source: 'REFERRAL',
        status: 'CONTACTED',
      });
      // Force update timestamp backwards
      await Lead.updateOne({ _id: staleLead._id }, { $set: { updatedAt: staleDate } }, { timestamps: false });

      const res = await request(httpServer)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const metrics = res.body.data.metrics;
      expect(metrics.staleLeadsCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(metrics.sourceBreakdown)).toBe(true);

      const webStats = metrics.sourceBreakdown.find((s: any) => s.source === 'WEBSITE');
      expect(webStats).toBeDefined();
      expect(webStats.count).toBe(2);
      expect(webStats.wonCount).toBe(1);
      expect(webStats.conversionRate).toBe(50);
    });
  });
});
