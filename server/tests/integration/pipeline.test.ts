import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User, Lead } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Lead Pipeline Integration Tests', () => {
  const DEFAULT_PASSWORD = 'Password123!';
  let passwordHash: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let platformAdmin: InstanceType<typeof User>;
  let brokerageAdminA: InstanceType<typeof User>;
  let advisorA1: InstanceType<typeof User>;
  let advisorA2: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;

  let brokerageAdminB: InstanceType<typeof User>;
  let advisorB: InstanceType<typeof User>;

  let tokenPlatformAdmin: string;
  let tokenBrokerageAdminA: string;
  let tokenAdvisorA1: string;
  let tokenAdvisorA2: string;
  let tokenClientA: string;
  let tokenBrokerageAdminB: string;
  let tokenAdvisorB: string;

  let leadA1: InstanceType<typeof Lead>;
  let leadA2: InstanceType<typeof Lead>;
  let leadB1: InstanceType<typeof Lead>;

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Create two separate brokerages
    brokerageA = await Brokerage.create({
      name: 'Berlin Expat Mortgages GmbH',
      slug: 'berlin-expat',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Munich Home Loans UG',
      slug: 'munich-loans',
      plan: 'STARTER',
      status: 'ACTIVE',
    });

    // 2. Users
    platformAdmin = await User.create({
      name: 'Platform Superadmin',
      email: 'admin@leadflow-platform.com',
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    });

    brokerageAdminA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Klaus Mueller',
      email: 'klaus@berlin-expat.de',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    advisorA1 = await User.create({
      brokerageId: brokerageA._id,
      name: 'Elena Schmidt',
      email: 'elena@berlin-expat.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    advisorA2 = await User.create({
      brokerageId: brokerageA._id,
      name: 'Markus Weber',
      email: 'markus@berlin-expat.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    clientUserA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Alex Client',
      email: 'alex.client@gmail.com',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    brokerageAdminB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Hans Gruber',
      email: 'hans@munich-loans.de',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Stefan Meyer',
      email: 'stefan@munich-loans.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    // 3. Generate Auth Tokens
    tokenPlatformAdmin = tokenService.generateAccessToken({
      userId: platformAdmin._id.toString(),
      email: platformAdmin.email,
      role: platformAdmin.role,
      brokerageId: null,
    });

    tokenBrokerageAdminA = tokenService.generateAccessToken({
      userId: brokerageAdminA._id.toString(),
      email: brokerageAdminA.email,
      role: brokerageAdminA.role,
      brokerageId: brokerageA._id.toString(),
    });

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

    tokenClientA = tokenService.generateAccessToken({
      userId: clientUserA._id.toString(),
      email: clientUserA.email,
      role: clientUserA.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenBrokerageAdminB = tokenService.generateAccessToken({
      userId: brokerageAdminB._id.toString(),
      email: brokerageAdminB.email,
      role: brokerageAdminB.role,
      brokerageId: brokerageB._id.toString(),
    });

    tokenAdvisorB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: advisorB.role,
      brokerageId: brokerageB._id.toString(),
    });

    // 4. Sample Leads
    leadA1 = await Lead.create({
      brokerageId: brokerageA._id,
      firstName: 'David',
      lastName: 'Chen',
      email: 'david.chen@expat-tech.com',
      phone: '+49 170 1234567',
      status: 'NEW',
      source: 'WEBSITE',
      score: 85,
      assignedTo: advisorA1._id,
      notes: 'EU Blue Card holder looking for Berlin condo mortgage',
    });

    leadA2 = await Lead.create({
      brokerageId: brokerageA._id,
      firstName: 'Sophie',
      lastName: 'Martin',
      email: 'sophie.martin@france-finance.com',
      phone: '+49 171 7654321',
      status: 'QUALIFIED',
      source: 'REFERRAL',
      score: 90,
      assignedTo: advisorA2._id,
    });

    leadB1 = await Lead.create({
      brokerageId: brokerageB._id,
      firstName: 'Lukas',
      lastName: 'Bauer',
      email: 'lukas.bauer@munich-tech.de',
      status: 'NEW',
      source: 'MANUAL',
      score: 60,
      assignedTo: advisorB._id,
    });
  });

  describe('1. Valid Stage Transitions', () => {
    it('should transition a lead through linear stages: NEW → CONTACTED → QUALIFIED → PROPOSAL → NEGOTIATION → WON', async () => {
      // 1. NEW -> CONTACTED
      const res1 = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'CONTACTED' });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data.previousStage).toBe('NEW');
      expect(res1.body.data.currentStage).toBe('CONTACTED');
      expect(res1.body.data.lead.status).toBe('CONTACTED');
      expect(res1.body.data.lead.__v).toBe(1);

      // 2. CONTACTED -> QUALIFIED
      const res2 = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'QUALIFIED' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.previousStage).toBe('CONTACTED');
      expect(res2.body.data.currentStage).toBe('QUALIFIED');
      expect(res2.body.data.lead.__v).toBe(2);

      // 3. QUALIFIED -> PROPOSAL
      const res3 = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'PROPOSAL' });

      expect(res3.status).toBe(200);
      expect(res3.body.data.previousStage).toBe('QUALIFIED');
      expect(res3.body.data.currentStage).toBe('PROPOSAL');

      // 4. PROPOSAL -> NEGOTIATION
      const res4 = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'NEGOTIATION' });

      expect(res4.status).toBe(200);
      expect(res4.body.data.previousStage).toBe('PROPOSAL');
      expect(res4.body.data.currentStage).toBe('NEGOTIATION');

      // 5. NEGOTIATION -> WON
      const res5 = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'WON' });

      expect(res5.status).toBe(200);
      expect(res5.body.data.previousStage).toBe('NEGOTIATION');
      expect(res5.body.data.currentStage).toBe('WON');

      // Verify DB persistence
      const leadInDb = await Lead.findById(leadA1._id);
      expect(leadInDb!.status).toBe('WON');
      expect(leadInDb!.__v).toBe(5);
    });

    it('should allow active stages to transition to LOST at any point (early drop-off)', async () => {
      // Transition from NEW directly to LOST
      const res = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'LOST' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.previousStage).toBe('NEW');
      expect(res.body.data.currentStage).toBe('LOST');

      const leadInDb = await Lead.findById(leadA1._id);
      expect(leadInDb!.status).toBe('LOST');
    });

    it('should accept either "stage" or "status" in request payload and support /status alias', async () => {
      // Using 'status' property in payload on /status route alias
      const res = await request(app)
        .patch(`/api/leads/${leadA1._id}/status`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ status: 'CONTACTED' });

      expect(res.status).toBe(200);
      expect(res.body.data.currentStage).toBe('CONTACTED');
    });
  });

  describe('2. Invalid Stage Transitions & State Machine Enforcement', () => {
    it('should reject skipping stages forward (e.g. NEW → QUALIFIED) with 400 ValidationError', async () => {
      const res = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'QUALIFIED' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain("Invalid stage transition from 'NEW' to 'QUALIFIED'");

      // Verify DB was NOT mutated
      const leadInDb = await Lead.findById(leadA1._id);
      expect(leadInDb!.status).toBe('NEW');
    });

    it('should reject skipping stages to WON from early stages (e.g. NEW → WON)', async () => {
      const res = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'WON' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("Invalid stage transition from 'NEW' to 'WON'");
    });

    it('should reject backward transitions (e.g. QUALIFIED → CONTACTED or QUALIFIED → NEW)', async () => {
      const res = await request(app)
        .patch(`/api/leads/${leadA2._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'CONTACTED' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain("Invalid stage transition from 'QUALIFIED' to 'CONTACTED'");
    });

    it('should reject transition to the same stage (e.g. NEW → NEW)', async () => {
      const res = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'NEW' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain("Lead is already in stage 'NEW'");
    });
  });

  describe('3. Final WON / LOST Behavior (Terminal Stages)', () => {
    it('should prevent any transition once a lead is in WON stage', async () => {
      // First move lead to WON
      await Lead.findByIdAndUpdate(leadA1._id, { status: 'WON' });

      // Attempt to move WON -> LOST
      const resLost = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'LOST' });

      expect(resLost.status).toBe(400);
      expect(resLost.body.error.code).toBe('VALIDATION_ERROR');
      expect(resLost.body.error.message).toContain("Invalid stage transition from 'WON'");

      // Attempt to move WON -> NEW
      const resNew = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'NEW' });

      expect(resNew.status).toBe(400);
      expect(resNew.body.error.code).toBe('VALIDATION_ERROR');

      // Attempt to move WON -> NEGOTIATION
      const resNeg = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'NEGOTIATION' });

      expect(resNeg.status).toBe(400);
    });

    it('should prevent any transition once a lead is in LOST stage', async () => {
      // First move lead to LOST
      await Lead.findByIdAndUpdate(leadA1._id, { status: 'LOST' });

      // Attempt to move LOST -> WON
      const resWon = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'WON' });

      expect(resWon.status).toBe(400);
      expect(resWon.body.error.code).toBe('VALIDATION_ERROR');
      expect(resWon.body.error.message).toContain("Invalid stage transition from 'LOST'");

      // Attempt to move LOST -> NEW
      const resNew = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'NEW' });

      expect(resNew.status).toBe(400);
    });
  });

  describe('4. Brokerage Tenant Isolation & Anti-IDOR Defense', () => {
    it('should return 404 NOT_FOUND when Advisor A attempts to retrieve Brokerage B lead details', async () => {
      const res = await request(app)
        .get(`/api/leads/${leadB1._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      // Anti-IDOR: returns 404 concealing cross-brokerage lead existence
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 NOT_FOUND when Advisor A attempts to move Brokerage B lead stage', async () => {
      const res = await request(app)
        .patch(`/api/leads/${leadB1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'CONTACTED' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');

      // Lead in Brokerage B was untouched
      const leadBInDb = await Lead.findById(leadB1._id);
      expect(leadBInDb!.status).toBe('NEW');
    });

    it('should list only leads belonging to the caller brokerage and never leak other brokerages', async () => {
      const res = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.leads).toBeDefined();

      const leadIds = res.body.data.leads.map((l: any) => l._id);
      expect(leadIds).toContain(leadA1._id.toString());
      expect(leadIds).toContain(leadA2._id.toString());
      expect(leadIds).not.toContain(leadB1._id.toString());
    });

    it('should ignore client-supplied brokerageId in query parameters for tenant users', async () => {
      // Advisor A tries to pass Brokerage B's ID in query
      const res = await request(app)
        .get(`/api/leads?brokerageId=${brokerageB._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      const leadIds = res.body.data.leads.map((l: any) => l._id);
      expect(leadIds).not.toContain(leadB1._id.toString());
      expect(leadIds).toContain(leadA1._id.toString());
    });
  });

  describe('5. Role-Based Access Control (RBAC)', () => {
    it('should allow PLATFORM_ADMIN to view and move leads across any brokerage', async () => {
      // Platform admin views Brokerage B's lead
      const resGet = await request(app)
        .get(`/api/leads/${leadB1._id}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);

      expect(resGet.status).toBe(200);
      expect(resGet.body.data.lead._id).toBe(leadB1._id.toString());

      // Platform admin moves Brokerage B's lead
      const resMove = await request(app)
        .patch(`/api/leads/${leadB1._id}/stage`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send({ stage: 'CONTACTED' });

      expect(resMove.status).toBe(200);
      expect(resMove.body.data.currentStage).toBe('CONTACTED');
    });

    it('should allow BROKERAGE_ADMIN to view and move leads in their brokerage', async () => {
      const res = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenBrokerageAdminA}`)
        .send({ stage: 'CONTACTED' });

      expect(res.status).toBe(200);
      expect(res.body.data.currentStage).toBe('CONTACTED');
    });

    it('should reject CLIENT role attempting to list leads with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject CLIENT role attempting to view pipeline board with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/leads/pipeline')
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject CLIENT role attempting to view a lead by ID with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/leads/${leadA1._id}`)
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject CLIENT role attempting to manipulate lead stage with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenClientA}`)
        .send({ stage: 'CONTACTED' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/leads');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('6. Nonexistent and Malformed Lead IDs', () => {
    it('should return 400 ValidationError for malformed lead ID', async () => {
      const res = await request(app)
        .get('/api/leads/invalid-not-an-id')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 ValidationError for malformed lead ID on stage update', async () => {
      const res = await request(app)
        .patch('/api/leads/bad-id-123/stage')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'CONTACTED' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 NotFoundError for nonexistent valid ObjectId', async () => {
      const nonexistentId = new Types.ObjectId();
      const res = await request(app)
        .get(`/api/leads/${nonexistentId}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 NotFoundError on stage update for nonexistent valid ObjectId', async () => {
      const nonexistentId = new Types.ObjectId();
      const res = await request(app)
        .patch(`/api/leads/${nonexistentId}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'CONTACTED' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('7. Concurrent Stage Updates & Lost-Update Prevention', () => {
    it('should reject update with 409 Conflict when expected version does not match', async () => {
      // First update lead to version 1
      await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ stage: 'CONTACTED' });

      // Advisor 2 was looking at stale version 0 and tries to move to QUALIFIED with version: 0
      const resConflict = await request(app)
        .patch(`/api/leads/${leadA1._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA2}`)
        .send({ stage: 'QUALIFIED', version: 0 });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.success).toBe(false);
      expect(resConflict.body.error.code).toBe('CONFLICT');
      expect(resConflict.body.error.message).toContain('Stage update conflict');
    });

    it('should prevent lost updates when two advisors concurrently update the same lead', async () => {
      // Initial state: leadA1 is NEW with __v: 0
      const initialLead = await Lead.findById(leadA1._id);
      expect(initialLead!.status).toBe('NEW');
      expect(initialLead!.__v).toBe(0);

      // Advisor 1 wants to move NEW -> CONTACTED (version 0)
      // Advisor 2 wants to move NEW -> LOST (version 0)
      // Both dispatch at the exact same moment
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`/api/leads/${leadA1._id}/stage`)
          .set('Authorization', `Bearer ${tokenAdvisorA1}`)
          .send({ stage: 'CONTACTED', version: 0 }),
        request(app)
          .patch(`/api/leads/${leadA1._id}/stage`)
          .set('Authorization', `Bearer ${tokenAdvisorA2}`)
          .send({ stage: 'LOST', version: 0 }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly ONE request must succeed (200) and ONE must fail with 409 Conflict
      expect(statuses).toEqual([200, 409]);

      const winningResponse = res1.status === 200 ? res1 : res2;
      const losingResponse = res1.status === 409 ? res1 : res2;

      expect(winningResponse.body.success).toBe(true);
      expect(losingResponse.body.error.code).toBe('CONFLICT');

      // The database must match the winner's stage with __v incremented to 1
      const leadAfter = await Lead.findById(leadA1._id);
      expect(leadAfter!.__v).toBe(1);
      expect(leadAfter!.status).toBe(winningResponse.body.data.currentStage);
    });
  });

  describe('8. Pipeline Grouping and Filtering', () => {
    it('should return leads grouped across all 7 pipeline stages via /api/leads/pipeline', async () => {
      const res = await request(app)
        .get('/api/leads/pipeline')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pipeline).toBeDefined();

      const pipeline = res.body.data.pipeline;
      expect(pipeline.NEW).toBeInstanceOf(Array);
      expect(pipeline.CONTACTED).toBeInstanceOf(Array);
      expect(pipeline.QUALIFIED).toBeInstanceOf(Array);
      expect(pipeline.PROPOSAL).toBeInstanceOf(Array);
      expect(pipeline.NEGOTIATION).toBeInstanceOf(Array);
      expect(pipeline.WON).toBeInstanceOf(Array);
      expect(pipeline.LOST).toBeInstanceOf(Array);

      expect(res.body.data.counts.NEW).toBe(1);
      expect(res.body.data.counts.QUALIFIED).toBe(1);
      expect(res.body.data.total).toBe(2);
    });

    it('should support groupBy=stage query parameter on /api/leads', async () => {
      const res = await request(app)
        .get('/api/leads?groupBy=stage')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.pipeline).toBeDefined();
      expect(res.body.data.counts).toBeDefined();
    });

    it('should filter leads by specific stage (e.g. ?stage=QUALIFIED)', async () => {
      const res = await request(app)
        .get('/api/leads?stage=QUALIFIED')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.leads).toHaveLength(1);
      expect(res.body.data.leads[0]._id).toBe(leadA2._id.toString());
      expect(res.body.data.leads[0].status).toBe('QUALIFIED');
    });

    it('should filter leads by assigned advisor (?assignedTo=<id>)', async () => {
      const res = await request(app)
        .get(`/api/leads?assignedTo=${advisorA1._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.leads).toHaveLength(1);
      expect(res.body.data.leads[0]._id).toBe(leadA1._id.toString());
    });

    it('should filter leads by search term matching firstName, lastName, or email', async () => {
      const res = await request(app)
        .get('/api/leads?search=Martin')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.leads).toHaveLength(1);
      expect(res.body.data.leads[0].lastName).toBe('Martin');
    });

    it('should populate assignedTo with _id, name, and email when retrieving lead details', async () => {
      const res = await request(app)
        .get(`/api/leads/${leadA1._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.lead.assignedTo).toBeDefined();
      expect(res.body.data.lead.assignedTo._id).toBe(advisorA1._id.toString());
      expect(res.body.data.lead.assignedTo.name).toBe('Elena Schmidt');
      expect(res.body.data.lead.assignedTo.email).toBe('elena@berlin-expat.de');
    });
  });
});
