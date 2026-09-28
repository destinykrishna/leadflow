import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Phase 1 Prompt 1: Brokerage Lifecycle & Onboarding Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let platformAdmin: InstanceType<typeof User>;
  let existingBrokerage: InstanceType<typeof Brokerage>;
  let existingBrokerageAdmin: InstanceType<typeof User>;
  let existingAdvisor: InstanceType<typeof User>;

  let tokenPlatformAdmin: string;
  let tokenBrokerageAdmin: string;
  let tokenAdvisor: string;

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Existing platform admin
    platformAdmin = await User.create({
      name: 'System Superadmin',
      email: 'admin@leadflow-platform.com',
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    });

    // 2. Existing brokerage
    existingBrokerage = await Brokerage.create({
      name: 'Berlin Expat Mortgages GmbH',
      slug: 'berlin-expat',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    // 3. Existing brokerage users
    existingBrokerageAdmin = await User.create({
      brokerageId: existingBrokerage._id,
      name: 'Klaus Mueller',
      email: 'klaus@berlin-expat.de',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    existingAdvisor = await User.create({
      brokerageId: existingBrokerage._id,
      name: 'Elena Schmidt',
      email: 'elena@berlin-expat.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    // 4. Tokens
    tokenPlatformAdmin = tokenService.generateAccessToken({
      userId: platformAdmin._id.toString(),
      email: platformAdmin.email,
      role: platformAdmin.role,
      brokerageId: null,
    });

    tokenBrokerageAdmin = tokenService.generateAccessToken({
      userId: existingBrokerageAdmin._id.toString(),
      email: existingBrokerageAdmin.email,
      role: existingBrokerageAdmin.role,
      brokerageId: existingBrokerage._id.toString(),
    });

    tokenAdvisor = tokenService.generateAccessToken({
      userId: existingAdvisor._id.toString(),
      email: existingAdvisor.email,
      role: existingAdvisor.role,
      brokerageId: existingBrokerage._id.toString(),
    });
  });

  describe('1. Brokerage Creation & Initial Admin Onboarding', () => {
    it('allows PLATFORM_ADMIN to create a brokerage and atomically provision initial BROKERAGE_ADMIN', async () => {
      const payload = {
        name: 'Frankfurt Finance UG',
        slug: 'frankfurt-finance',
        plan: 'GROWTH',
        admin: {
          name: 'Hans Becker',
          email: 'hans@frankfurt-finance.de',
          password: 'SecurePassword123!',
          phone: '+49 69 123456',
        },
      };

      const res = await request(app)
        .post('/api/brokerages')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const { brokerage, admin } = res.body.data;

      // Verify brokerage details
      expect(brokerage.id).toBeDefined();
      expect(brokerage.name).toBe('Frankfurt Finance UG');
      expect(brokerage.slug).toBe('frankfurt-finance');
      expect(brokerage.plan).toBe('GROWTH');
      expect(brokerage.status).toBe('ACTIVE');
      expect(brokerage.webhookSecret).toBeDefined();
      expect(typeof brokerage.webhookSecret).toBe('string');
      expect(brokerage.webhookSecret.length).toBe(48); // 24 bytes hex = 48 chars

      // Verify initial admin details
      expect(admin.id).toBeDefined();
      expect(admin.name).toBe('Hans Becker');
      expect(admin.email).toBe('hans@frankfurt-finance.de');
      expect(admin.role).toBe('BROKERAGE_ADMIN');
      expect(admin.status).toBe('ACTIVE');
      expect(admin.brokerageId).toBe(brokerage.id);

      // Verify NO password hash or internal secrets leaked
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(admin.passwordHash).toBeUndefined();
      expect(brokerage.passwordHash).toBeUndefined();

      // Verify persisted in DB
      const dbBrokerage = await Brokerage.findById(brokerage.id);
      expect(dbBrokerage).not.toBeNull();
      expect(dbBrokerage?.name).toBe('Frankfurt Finance UG');

      const dbAdmin = await User.findById(admin.id);
      expect(dbAdmin).not.toBeNull();
      expect(dbAdmin?.brokerageId?.toString()).toBe(brokerage.id);
      expect(dbAdmin?.role).toBe('BROKERAGE_ADMIN');

      // Verify initial admin can authenticate
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'hans@frankfurt-finance.de',
          password: 'SecurePassword123!',
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.role).toBe('BROKERAGE_ADMIN');
      expect(loginRes.body.data.user.brokerageId).toBe(brokerage.id);
    });

    it('supports flat admin fields and auto-generates slug when omitted', async () => {
      const payload = {
        name: 'Hamburg Port Real Estate',
        adminName: 'Gretchen Weber',
        adminEmail: 'gretchen@hamburg-port.de',
        adminPassword: 'Password123!',
      };

      const res = await request(app)
        .post('/api/brokerages')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.data.brokerage.name).toBe('Hamburg Port Real Estate');
      expect(res.body.data.brokerage.slug).toMatch(/^hamburg-port-real-estate/);
      expect(res.body.data.brokerage.plan).toBe('STARTER');
      expect(res.body.data.admin.name).toBe('Gretchen Weber');
      expect(res.body.data.admin.role).toBe('BROKERAGE_ADMIN');
    });

    it('rejects creation from non-platform admin roles with 403 FORBIDDEN', async () => {
      const payload = {
        name: 'Unauthorized Brokerage',
        admin: {
          name: 'Hacker Joe',
          email: 'joe@hack.de',
          password: 'Password123!',
        },
      };

      const resBrokerageAdmin = await request(app)
        .post('/api/brokerages')
        .set('Authorization', `Bearer ${tokenBrokerageAdmin}`)
        .send(payload);
      expect(resBrokerageAdmin.status).toBe(403);
      expect(resBrokerageAdmin.body.error.code).toBe('FORBIDDEN');

      const resAdvisor = await request(app)
        .post('/api/brokerages')
        .set('Authorization', `Bearer ${tokenAdvisor}`)
        .send(payload);
      expect(resAdvisor.status).toBe(403);
      expect(resAdvisor.body.error.code).toBe('FORBIDDEN');

      const resUnauth = await request(app).post('/api/brokerages').send(payload);
      expect(resUnauth.status).toBe(401);
      expect(resUnauth.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('2. Atomicity, Conflicts & Validation', () => {
    it('returns 409 CONFLICT if brokerage slug already exists', async () => {
      const payload = {
        name: 'Duplicate Berlin Office',
        slug: 'berlin-expat', // conflicts with existingBrokerage
        admin: {
          name: 'New Admin',
          email: 'admin2@berlin-expat.de',
          password: 'Password123!',
        },
      };

      const res = await request(app)
        .post('/api/brokerages')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/slug already exists/i);
    });

    it('returns 409 CONFLICT if admin email conflicts with PLATFORM_ADMIN', async () => {
      const payload = {
        name: 'Stuttgart Advisory',
        slug: 'stuttgart-advisory',
        admin: {
          name: 'Conflicting Admin',
          email: 'admin@leadflow-platform.com', // existing platform admin
          password: 'Password123!',
        },
      };

      const res = await request(app)
        .post('/api/brokerages')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/platform administrator/i);

      // Verify Stuttgart Advisory was not created in DB
      const brokerageCheck = await Brokerage.findOne({ slug: 'stuttgart-advisory' });
      expect(brokerageCheck).toBeNull();
    });

    it('returns 400 VALIDATION_ERROR on invalid input (missing admin password)', async () => {
      const payload = {
        name: 'Incomplete Brokerage',
        admin: {
          name: 'Admin Name',
          email: 'admin@incomplete.de',
          // password missing
        },
      };

      const res = await request(app)
        .post('/api/brokerages')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('3. Lifecycle Management & Anti-IDOR Protections', () => {
    it('allows PLATFORM_ADMIN to update brokerage status and plan via PATCH /api/brokerages/:id', async () => {
      const res = await request(app)
        .patch(`/api/brokerages/${existingBrokerage._id}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send({
          status: 'SUSPENDED',
          plan: 'ENTERPRISE',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.brokerage.status).toBe('SUSPENDED');
      expect(res.body.data.brokerage.plan).toBe('ENTERPRISE');

      const updatedDb = await Brokerage.findById(existingBrokerage._id);
      expect(updatedDb?.status).toBe('SUSPENDED');
      expect(updatedDb?.plan).toBe('ENTERPRISE');
    });

    it('allows PLATFORM_ADMIN to rotate brokerage webhook secret', async () => {
      const originalSecret = existingBrokerage.webhookSecret;

      const res = await request(app)
        .post(`/api/brokerages/${existingBrokerage._id}/webhook-secret/rotate`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.webhookSecret).toBeDefined();
      expect(res.body.data.webhookSecret).not.toBe(originalSecret);
      expect(res.body.data.webhookSecret.length).toBe(48);

      const updatedDb = await Brokerage.findById(existingBrokerage._id);
      expect(updatedDb?.webhookSecret).toBe(res.body.data.webhookSecret);
    });

    it('returns 404 NOT_FOUND for non-existent or malformed brokerage ID', async () => {
      const nonExistentId = new Types.ObjectId();
      const resNotFound = await request(app)
        .patch(`/api/brokerages/${nonExistentId}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send({ status: 'TRIAL' });

      expect(resNotFound.status).toBe(404);
      expect(resNotFound.body.error.code).toBe('NOT_FOUND');

      const resMalformed = await request(app)
        .patch('/api/brokerages/malformed-id-999')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send({ status: 'TRIAL' });

      expect(resMalformed.status).toBe(404);
      expect(resMalformed.body.error.code).toBe('NOT_FOUND');
    });

    it('blocks non-platform admin from updating brokerage lifecycle', async () => {
      const res = await request(app)
        .patch(`/api/brokerages/${existingBrokerage._id}`)
        .set('Authorization', `Bearer ${tokenBrokerageAdmin}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Hardening Invariants: Secret Suppression & Suspension Enforcement', () => {
    it('withholds webhookSecret from non-platform admin in GET /api/brokerages/:id', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${existingBrokerage._id}`)
        .set('Authorization', `Bearer ${tokenAdvisor}`);

      expect(res.status).toBe(200);
      expect(res.body.data.brokerage.name).toBe('Berlin Expat Mortgages GmbH');
      expect(res.body.data.brokerage.webhookSecret).toBeUndefined();
    });

    it('returns webhookSecret to PLATFORM_ADMIN in GET /api/brokerages/:id', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${existingBrokerage._id}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.brokerage.webhookSecret).toBe(existingBrokerage.webhookSecret);
    });

    it('suppresses webhookSecret in bulk GET /api/brokerages listing', async () => {
      const res = await request(app)
        .get('/api/brokerages')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.brokerages.length).toBeGreaterThan(0);
      for (const b of res.body.data.brokerages) {
        expect(b.webhookSecret).toBeUndefined();
      }
    });

    it('immediately rejects authenticated HTTP requests from users of a SUSPENDED brokerage with 401', async () => {
      // 1. Suspend the brokerage
      await Brokerage.updateOne({ _id: existingBrokerage._id }, { status: 'SUSPENDED' });

      // 2. Existing advisor tries to query with their existing token
      const res = await request(app)
        .get(`/api/brokerages/${existingBrokerage._id}`)
        .set('Authorization', `Bearer ${tokenAdvisor}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/inactive or suspended/i);
    });

    it('rejects lead webhook ingestion when brokerage is SUSPENDED with 403', async () => {
      // 1. Suspend the brokerage
      await Brokerage.updateOne({ _id: existingBrokerage._id }, { status: 'SUSPENDED' });

      // 2. Attempt lead webhook with valid webhookSecret
      const res = await request(app)
        .post(`/api/leads/webhook/${existingBrokerage._id}`)
        .set('x-webhook-secret', existingBrokerage.webhookSecret!)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@test.com',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
