import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import {
  Brokerage,
  User,
  Lead,
  Client,
  ActivityLog,
} from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';
import { activityService, sanitizeActivityMetadata } from '../../src/services/activity.service.js';
import { leadPipelineService } from '../../src/services/lead-pipeline.service.js';

describe('Phase 5: Persistent Audit Logs & Activity Timeline Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let adminA: InstanceType<typeof User>;
  let advisorA: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;
  let advisorB: InstanceType<typeof User>;

  let adminTokenA: string;
  let advisorTokenA: string;
  let clientTokenA: string;
  let advisorTokenB: string;

  let leadA: InstanceType<typeof Lead>;
  let leadB: InstanceType<typeof Lead>;
  let clientA: InstanceType<typeof Client>;

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Seed two isolated brokerages
    brokerageA = await Brokerage.create({
      name: 'Apex Finance Brokerage',
      slug: `apex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
      webhookSecret: 'sec_apex_test',
    });

    brokerageB = await Brokerage.create({
      name: 'Beacon Capital Brokerage',
      slug: `beacon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'ACTIVE',
      plan: 'STARTER',
      webhookSecret: 'sec_beacon_test',
    });

    // 2. Seed Users across roles
    adminA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Admin Apex',
      email: `admin-apex-${Date.now()}@apex.com`,
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    advisorA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Advisor Priya',
      email: `priya-${Date.now()}@apex.com`,
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    clientUserA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Borrower Rahul',
      email: `rahul-${Date.now()}@gmail.com`,
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Advisor Beacon',
      email: `advisor-b-${Date.now()}@beacon.com`,
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    // 3. Issue JWT Auth Tokens
    adminTokenA = tokenService.generateAccessToken({
      userId: adminA._id.toString(),
      email: adminA.email,
      role: adminA.role,
      brokerageId: brokerageA._id.toString(),
    });

    advisorTokenA = tokenService.generateAccessToken({
      userId: advisorA._id.toString(),
      email: advisorA.email,
      role: advisorA.role,
      brokerageId: brokerageA._id.toString(),
    });

    clientTokenA = tokenService.generateAccessToken({
      userId: clientUserA._id.toString(),
      email: clientUserA.email,
      role: clientUserA.role,
      brokerageId: brokerageA._id.toString(),
    });

    advisorTokenB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: advisorB.role,
      brokerageId: brokerageB._id.toString(),
    });

    // 4. Seed Leads & Clients
    leadA = await Lead.create({
      brokerageId: brokerageA._id,
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: `rahul-${Date.now()}@gmail.com`,
      status: 'NEW',
      source: 'WEBSITE',
      score: 75,
      assignedTo: advisorA._id,
    });

    leadB = await Lead.create({
      brokerageId: brokerageB._id,
      firstName: 'Sunita',
      lastName: 'Verma',
      email: `sunita-${Date.now()}@gmail.com`,
      status: 'NEW',
      source: 'REFERRAL',
      score: 80,
      assignedTo: advisorB._id,
    });

    clientA = await Client.create({
      brokerageId: brokerageA._id,
      userId: clientUserA._id,
      leadId: leadA._id,
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: leadA.email,
      status: 'ACTIVE',
      type: 'BUYER',
      assignedTo: advisorA._id,
    });
  });

  describe('1. Tenant Isolation & Anti-IDOR Enforcement', () => {
    it('returns 404 NotFoundError when querying timeline for a lead from another brokerage', async () => {
      // Advisor B tries to access Lead A's timeline
      const response = await request(app)
        .get(`/api/leads/${leadA._id}/timeline`)
        .set('Authorization', `Bearer ${advisorTokenB}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 NotFoundError when querying timeline for a client from another brokerage', async () => {
      // Advisor B tries to access Client A's timeline
      const response = await request(app)
        .get(`/api/clients/${clientA._id}/timeline`)
        .set('Authorization', `Bearer ${advisorTokenB}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('strictly isolates brokerage audit logs between tenants', async () => {
      // Record activity in Brokerage A
      await activityService.logActivity({
        brokerageId: brokerageA._id,
        entityType: 'LEAD',
        entityId: leadA._id,
        leadId: leadA._id,
        action: 'STAGE_CHANGED',
        actor: { id: adminA._id, name: adminA.name, role: adminA.role },
        metadata: { fromStage: 'NEW', toStage: 'CONTACTED' },
      });

      // Record activity in Brokerage B
      await activityService.logActivity({
        brokerageId: brokerageB._id,
        entityType: 'LEAD',
        entityId: leadB._id,
        leadId: leadB._id,
        action: 'STAGE_CHANGED',
        actor: { id: advisorB._id, name: advisorB.name, role: advisorB.role },
        metadata: { fromStage: 'NEW', toStage: 'CONTACTED' },
      });

      // Admin A queries audit logs
      const resA = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminTokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.success).toBe(true);
      expect(resA.body.data.length).toBe(1);
      expect(resA.body.data[0].brokerageId).toBe(brokerageA._id.toString());
      expect(resA.body.data[0].entityId).toBe(leadA._id.toString());
    });
  });

  describe('2. RBAC Access Control', () => {
    it('blocks CLIENT users from accessing lead timeline with 403 Forbidden', async () => {
      const response = await request(app)
        .get(`/api/leads/${leadA._id}/timeline`)
        .set('Authorization', `Bearer ${clientTokenA}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('blocks CLIENT users from accessing client timeline with 403 Forbidden', async () => {
      const response = await request(app)
        .get(`/api/clients/${clientA._id}/timeline`)
        .set('Authorization', `Bearer ${clientTokenA}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('blocks CLIENT users from accessing brokerage audit logs with 403 Forbidden', async () => {
      const response = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${clientTokenA}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('blocks ADVISOR users from accessing administrative audit logs with 403 Forbidden', async () => {
      const response = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${advisorTokenA}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('allows ADVISORS and BROKERAGE_ADMINS to access lead timeline', async () => {
      const resAdvisor = await request(app)
        .get(`/api/leads/${leadA._id}/timeline`)
        .set('Authorization', `Bearer ${advisorTokenA}`);

      expect(resAdvisor.status).toBe(200);
      expect(resAdvisor.body.success).toBe(true);

      const resAdmin = await request(app)
        .get(`/api/leads/${leadA._id}/timeline`)
        .set('Authorization', `Bearer ${adminTokenA}`);

      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.success).toBe(true);
    });
  });

  describe('3. Metadata Sanitization & Prototype Pollution Defense', () => {
    it('strips credentials, secrets, tokens, and prototype pollution keys', () => {
      const dirtyMeta = {
        loanAmount: 5000000,
        password: 'PlainTextPassword123!',
        userToken: 'jwt-access-token-secret',
        apiKey: 'sk_live_1234567890',
        authSecret: 'super-secret',
        creditCard: '4111111111111111',
        ssn: '123-45-6789',
        __proto__: { polluted: true },
        constructor: { evil: true },
        nested: {
          safeProp: 'ok',
          nestedSecret: 'secret_value',
        },
      };

      const clean = sanitizeActivityMetadata(dirtyMeta);

      expect(clean.loanAmount).toBe(5000000);
      expect(clean.password).toBeUndefined();
      expect(clean.userToken).toBeUndefined();
      expect(clean.apiKey).toBeUndefined();
      expect(clean.authSecret).toBeUndefined();
      expect(clean.creditCard).toBeUndefined();
      expect(clean.ssn).toBeUndefined();
      expect((clean as any).polluted).toBeUndefined();
      expect((clean as any).evil).toBeUndefined();
      expect((clean.nested as any)?.safeProp).toBe('ok');
      expect((clean.nested as any)?.nestedSecret).toBeUndefined();
    });
  });

  describe('4. Pagination Controls', () => {
    it('correctly pages through activities with limit, page, and total count', async () => {
      // Seed 7 activities for leadA
      for (let i = 1; i <= 7; i++) {
        await ActivityLog.create({
          brokerageId: brokerageA._id,
          entityType: 'LEAD',
          entityId: leadA._id,
          leadId: leadA._id,
          action: 'STAGE_CHANGED',
          actor: { id: adminA._id, name: adminA.name, role: adminA.role },
          metadata: { step: i },
          createdAt: new Date(Date.now() + i * 1000),
        });
      }

      // Page 1 with limit 3
      const resPage1 = await request(app)
        .get(`/api/leads/${leadA._id}/timeline?page=1&limit=3`)
        .set('Authorization', `Bearer ${advisorTokenA}`);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.data.length).toBe(3);
      expect(resPage1.body.pagination.total).toBe(7);
      expect(resPage1.body.pagination.page).toBe(1);
      expect(resPage1.body.pagination.totalPages).toBe(3);

      // Page 3 with limit 3 (should have 1 item left)
      const resPage3 = await request(app)
        .get(`/api/leads/${leadA._id}/timeline?page=3&limit=3`)
        .set('Authorization', `Bearer ${advisorTokenA}`);

      expect(resPage3.status).toBe(200);
      expect(resPage3.body.data.length).toBe(1);
      expect(resPage3.body.pagination.page).toBe(3);
    });
  });

  describe('5. Activity-Write Failure Isolation', () => {
    it('catches ActivityLog database errors gracefully without throwing', async () => {
      // Temporarily mock ActivityLog.create to throw
      const createSpy = vi.spyOn(ActivityLog, 'create').mockRejectedValueOnce(new Error('Simulated Mongo Timeout'));

      const result = await activityService.logActivity({
        brokerageId: brokerageA._id,
        entityType: 'LEAD',
        entityId: leadA._id,
        leadId: leadA._id,
        action: 'STAGE_CHANGED',
        actor: { id: adminA._id, name: adminA.name, role: adminA.role },
        metadata: { from: 'NEW', to: 'CONTACTED' },
      });

      // Guaranteed to return null and not crash
      expect(result).toBeNull();
      createSpy.mockRestore();
    });

    it('ensures primary stage transition completes even if activity logging fails', async () => {
      // Mock ActivityLog.create to throw
      const createSpy = vi.spyOn(ActivityLog, 'create').mockRejectedValueOnce(new Error('Simulated Activity DB Failure'));

      const userContext = {
        id: adminA._id.toString(),
        name: adminA.name,
        role: adminA.role,
        email: adminA.email,
        brokerageId: brokerageA._id.toString(),
        status: 'ACTIVE' as const,
      };

      // Transition lead from NEW to CONTACTED
      const transitionResult = await leadPipelineService.moveLeadStage(
        userContext,
        leadA._id.toString(),
        'CONTACTED',
        leadA.__v
      );

      // Primary business operation succeeded!
      expect(transitionResult.currentStage).toBe('CONTACTED');
      expect(transitionResult.lead.status).toBe('CONTACTED');

      createSpy.mockRestore();
    });
  });
});
