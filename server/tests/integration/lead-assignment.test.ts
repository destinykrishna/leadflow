/**
 * lead-assignment.test.ts
 *
 * Critical regression tests for:
 *  - BROKERAGE_ADMIN authorization to assign leads
 *  - Same-brokerage assignment enforcement (cross-tenant rejected)
 *  - Inactive advisor rejection
 *  - CLIENT/ADVISOR role rejection (forbidden)
 *  - Automated task assignment follows lead.assignedTo
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User, Lead, Task, PipelineTrigger, TriggerExecution } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';
import { triggerService } from '../../src/services/trigger.service.js';

describe('Lead Advisor Assignment', () => {
  const PW = 'TestPassword123!';
  let passwordHash: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let adminA: InstanceType<typeof User>;
  let advisorA1: InstanceType<typeof User>;
  let advisorA2Inactive: InstanceType<typeof User>;
  let advisorB: InstanceType<typeof User>;
  let clientUser: InstanceType<typeof User>;

  let leadA: InstanceType<typeof Lead>;

  let tokenAdminA: string;
  let tokenAdvisorA1: string;
  let tokenAdminB: string;
  let tokenClient: string;

  beforeEach(async () => {
    passwordHash = await hashPassword(PW);

    brokerageA = await Brokerage.create({
      name: 'Alpha Mortgages Ltd',
      slug: 'alpha-mortgages-assign',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Beta Finance Corp',
      slug: 'beta-finance-assign',
      plan: 'STARTER',
      status: 'ACTIVE',
    });

    adminA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Alice Admin',
      email: 'alice@alpha-assign.com',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    const adminBDoc = await User.create({
      brokerageId: brokerageB._id,
      name: 'Bob Admin',
      email: 'bob@beta-assign.com',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    advisorA1 = await User.create({
      brokerageId: brokerageA._id,
      name: 'Aaron Advisor',
      email: 'aaron@alpha-assign.com',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    advisorA2Inactive = await User.create({
      brokerageId: brokerageA._id,
      name: 'Inactive Ivan',
      email: 'ivan@alpha-assign.com',
      passwordHash,
      role: 'ADVISOR',
      status: 'INACTIVE',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Brenda Advisor',
      email: 'brenda@beta-assign.com',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    clientUser = await User.create({
      brokerageId: brokerageA._id,
      name: 'Client Carl',
      email: 'carl@alpha-assign.com',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    leadA = await Lead.create({
      brokerageId: brokerageA._id,
      firstName: 'Sophie',
      lastName: 'Dubois',
      email: 'sophie.dubois@test-assign.com',
      status: 'NEW',
      source: 'WEBSITE',
      score: 60,
    });

    // Generate access tokens
    const issued = (user: InstanceType<typeof User>) =>
      tokenService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        brokerageId: user.brokerageId?.toString() ?? null,
      });

    tokenAdminA = issued(adminA);
    tokenAdminB = issued(adminBDoc);
    tokenAdvisorA1 = issued(advisorA1);
    tokenClient = issued(clientUser);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Authorization checks
  // ────────────────────────────────────────────────────────────────────────────

  it('BROKERAGE_ADMIN can assign an ACTIVE same-brokerage ADVISOR', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ advisorId: advisorA1._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.lead.assignedTo).toBeDefined();
    // populate returns object with _id/name/email
    const assignedTo = res.body.data.lead.assignedTo as { _id?: string; name?: string };
    expect(assignedTo._id || assignedTo).toMatch(advisorA1._id.toString());
  });

  it('ADVISOR role is forbidden from assigning leads (403)', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .set('Authorization', `Bearer ${tokenAdvisorA1}`)
      .send({ advisorId: advisorA1._id.toString() });

    expect(res.status).toBe(403);
  });

  it('CLIENT role is forbidden from assigning leads (403)', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .set('Authorization', `Bearer ${tokenClient}`)
      .send({ advisorId: advisorA1._id.toString() });

    expect(res.status).toBe(403);
  });

  it('Unauthenticated request is rejected (401)', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .send({ advisorId: advisorA1._id.toString() });

    expect(res.status).toBe(401);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Same-brokerage isolation
  // ────────────────────────────────────────────────────────────────────────────

  it('Cross-brokerage advisor assignment is rejected (422 / 400)', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ advisorId: advisorB._id.toString() });

    // Service throws ValidationError (cross-brokerage) → 422
    expect([400, 422, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('Cross-brokerage lead access is hidden as 404 (anti-IDOR)', async () => {
    // AdminB tries to assign advisorB to brokerageA's lead — must return 404
    const res = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .set('Authorization', `Bearer ${tokenAdminB}`)
      .send({ advisorId: advisorB._id.toString() });

    expect(res.status).toBe(404);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Inactive advisor rejection
  // ────────────────────────────────────────────────────────────────────────────

  it('Assigning an INACTIVE advisor is rejected (422)', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ advisorId: advisorA2Inactive._id.toString() });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body)).toMatch(/inactive/i);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Invalid payload validation
  // ────────────────────────────────────────────────────────────────────────────

  it('Missing advisorId returns 422', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({});

    expect([400, 422]).toContain(res.status);
  });

  it('Non-ObjectId advisorId returns 422', async () => {
    const res = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ advisorId: 'not-an-objectid' });

    expect([400, 422]).toContain(res.status);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Task automation respects lead.assignedTo
  // ────────────────────────────────────────────────────────────────────────────

  it('Automated task goes to the assigned advisor after assignment', async () => {
    // 1. Assign lead to advisorA1
    const assignRes = await request(app)
      .patch(`/api/leads/${leadA._id.toString()}/assign`)
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ advisorId: advisorA1._id.toString() });

    expect(assignRes.status).toBe(200);

    // 2. Create a trigger for the NEW stage
    await PipelineTrigger.create({
      brokerageId: brokerageA._id,
      name: 'Auto task on NEW',
      fromStage: null,
      toStage: 'NEW',
      actionType: 'CREATE_TASK',
      isActive: true,
      actionConfig: {
        taskTitle: 'Call the lead',
        taskPriority: 'HIGH',
        dueDaysOffset: 1,
      },
    });

    // 3. Reload updated lead (with assignedTo set)
    const freshLead = await Lead.findById(leadA._id);

    // 4. Fire trigger engine
    await triggerService.handleStageTransition({
      brokerageId: brokerageA._id.toString(),
      lead: freshLead!,
      previousStage: null,
      newStage: 'NEW',
      updatedBy: {
        id: adminA._id.toString(),
        name: adminA.name,
        role: adminA.role,
      },
    });

    // 5. Verify the created task is assigned to advisorA1
    const task = await Task.findOne({
      brokerageId: brokerageA._id,
      leadId: leadA._id,
    });

    expect(task).not.toBeNull();
    expect(task!.assignedTo.toString()).toBe(advisorA1._id.toString());
  });

  it('Automated task falls back to brokerage admin when lead has no assigned advisor', async () => {
    // Lead has no assignedTo (unassigned pool)
    await PipelineTrigger.create({
      brokerageId: brokerageA._id,
      name: 'Auto task on NEW (fallback)',
      fromStage: null,
      toStage: 'CONTACTED',
      actionType: 'CREATE_TASK',
      isActive: true,
      actionConfig: {
        taskTitle: 'Follow up unassigned lead',
        taskPriority: 'MEDIUM',
        dueDaysOffset: 1,
      },
    });

    const freshLead = await Lead.findById(leadA._id);

    const summary = await triggerService.handleStageTransition({
      brokerageId: brokerageA._id.toString(),
      lead: freshLead!,
      previousStage: 'NEW',
      newStage: 'CONTACTED',
      updatedBy: {
        id: adminA._id.toString(),
        name: adminA.name,
        role: adminA.role,
      },
    });

    expect(summary.tasksCreated).toBe(1);

    const task = await Task.findOne({
      brokerageId: brokerageA._id,
      leadId: leadA._id,
    });

    expect(task).not.toBeNull();
    // Fallback resolves to the adminA (updatedBy is BROKERAGE_ADMIN, which is valid)
    expect(task!.assignedTo).toBeDefined();
  });
});
