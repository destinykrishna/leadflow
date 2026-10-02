import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User, Lead, Client, Task } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Dashboard Summary Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let advisorA: InstanceType<typeof User>;
  let advisorB: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;

  let tokenAdvisorA: string;
  let tokenAdvisorB: string;
  let tokenClientA: string;

  beforeAll(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);
  });

  beforeEach(async () => {
    brokerageA = await Brokerage.create({
      name: 'Brokerage Alpha',
      slug: `alpha-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: 'ACTIVE',
      plan: 'GROWTH',
    });

    brokerageB = await Brokerage.create({
      name: 'Brokerage Beta',
      slug: `beta-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: 'ACTIVE',
      plan: 'STARTER',
    });

    advisorA = await User.create({
      brokerageId: brokerageA._id,
      email: `advisor.a.${Date.now()}@alpha.com`,
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
      name: 'Advisor Alpha',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      email: `advisor.b.${Date.now()}@beta.com`,
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
      name: 'Advisor Beta',
    });

    clientUserA = await User.create({
      brokerageId: brokerageA._id,
      email: `client.a.${Date.now()}@gmail.com`,
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
      name: 'Client User A',
    });

    tokenAdvisorA = tokenService.generateAccessToken({
      userId: advisorA._id.toString(),
      email: advisorA.email,
      role: 'ADVISOR',
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdvisorB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: 'ADVISOR',
      brokerageId: brokerageB._id.toString(),
    });

    tokenClientA = tokenService.generateAccessToken({
      userId: clientUserA._id.toString(),
      email: clientUserA.email,
      role: 'CLIENT',
      brokerageId: brokerageA._id.toString(),
    });

    // Create seed leads for Brokerage A
    await Lead.create([
      {
        brokerageId: brokerageA._id,
        firstName: 'Lead',
        lastName: 'New',
        email: `new.${Date.now()}@test.com`,
        status: 'NEW',
        customFields: { loanAmount: 250000 },
        assignedTo: advisorA._id,
      },
      {
        brokerageId: brokerageA._id,
        firstName: 'Lead',
        lastName: 'Qualified',
        email: `qual.${Date.now()}@test.com`,
        status: 'QUALIFIED',
        customFields: { loanAmount: 400000 },
        assignedTo: advisorA._id,
      },
      {
        brokerageId: brokerageA._id,
        firstName: 'Lead',
        lastName: 'Won',
        email: `won.${Date.now()}@test.com`,
        status: 'WON',
        customFields: { loanAmount: 350000 },
        assignedTo: advisorA._id,
      },
    ]);

    // Create client profile for Brokerage A
    await Client.create({
      brokerageId: brokerageA._id,
      userId: clientUserA._id,
      firstName: 'Client',
      lastName: 'A',
      email: clientUserA.email,
      status: 'ACTIVE',
      type: 'BUYER',
    });

    // Create task for Brokerage A
    await Task.create({
      brokerageId: brokerageA._id,
      assignedTo: advisorA._id,
      title: 'Call Qualified Lead',
      status: 'PENDING',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 86400000),
    });

    // Create leads for Brokerage B (to verify isolation)
    await Lead.create([
      {
        brokerageId: brokerageB._id,
        firstName: 'Beta',
        lastName: 'Lead',
        email: `beta.${Date.now()}@test.com`,
        status: 'NEW',
        customFields: { loanAmount: 900000 },
        assignedTo: advisorB._id,
      },
    ]);
  });

  afterEach(async () => {
    await Promise.all([
      Task.deleteMany({}),
      Client.deleteMany({}),
      Lead.deleteMany({}),
      User.deleteMany({}),
      Brokerage.deleteMany({}),
    ]);
  });

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(401);
  });

  it('rejects CLIENT role users with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${tokenClientA}`);

    expect(res.status).toBe(403);
  });

  it('returns consolidated dashboard metrics strictly scoped to the tenant brokerage', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${tokenAdvisorA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toHaveProperty('metrics');
    expect(data).toHaveProperty('tasks');

    const metrics = data.metrics;
    expect(metrics.totalLeads).toBe(3);
    expect(metrics.activePipelineCount).toBe(2); // NEW + QUALIFIED
    expect(metrics.activePipelineValue).toBe(650000); // 250k + 400k
    expect(metrics.wonCasesCount).toBe(1);
    expect(metrics.wonPipelineValue).toBe(350000);
    expect(metrics.activeClientsCount).toBe(1);
    expect(metrics.qualifiedLeadsCount).toBe(1);

    expect(metrics.stageBreakdown).toBeInstanceOf(Array);
    expect(metrics.stageBreakdown.length).toBe(7);

    // Verify recent leads
    expect(metrics.recentLeads).toBeInstanceOf(Array);
    expect(metrics.recentLeads.length).toBe(3);

    // Verify tasks
    expect(data.tasks).toBeInstanceOf(Array);
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0].title).toBe('Call Qualified Lead');
    expect(data.tasks[0].brokerageId).toBe(brokerageA._id.toString());
  });

  it('preserves strict tenant isolation between brokerages', async () => {
    const resB = await request(app)
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${tokenAdvisorB}`);

    expect(resB.status).toBe(200);
    const metricsB = resB.body.data.metrics;
    expect(metricsB.totalLeads).toBe(1);
    expect(metricsB.activePipelineValue).toBe(900000);
    expect(metricsB.wonCasesCount).toBe(0);
    expect(resB.body.data.tasks.length).toBe(0);
  });
});
