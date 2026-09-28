import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User, Lead, Task, Session } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Phase 2 Prompt 1: Advisor & Team Management Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let platformAdmin: InstanceType<typeof User>;
  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let adminA: InstanceType<typeof User>;
  let adminB: InstanceType<typeof User>;
  let advisorA1: InstanceType<typeof User>;
  let advisorB1: InstanceType<typeof User>;
  let clientUser: InstanceType<typeof User>;

  let tokenPlatformAdmin: string;
  let tokenAdminA: string;
  let tokenAdminB: string;
  let tokenAdvisorA1: string;
  let tokenClient: string;

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Platform Superadmin
    platformAdmin = await User.create({
      name: 'Global Platform Admin',
      email: 'superadmin@leadflow.io',
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    });

    // 2. Two distinct brokerages
    brokerageA = await Brokerage.create({
      name: 'Alpha Mortgages Ltd',
      slug: 'alpha-mortgages',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Beta Finance Corp',
      slug: 'beta-finance',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    });

    // 3. Brokerage Admins
    adminA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Alice Admin',
      email: 'alice@alpha-mortgages.com',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    adminB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Bob Admin',
      email: 'bob@beta-finance.com',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    // 4. Initial Advisors
    advisorA1 = await User.create({
      brokerageId: brokerageA._id,
      name: 'Aaron Advisor',
      email: 'aaron@alpha-mortgages.com',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
      phone: '+1 555-0101',
    });

    advisorB1 = await User.create({
      brokerageId: brokerageB._id,
      name: 'Brian Advisor',
      email: 'brian@beta-finance.com',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
      phone: '+1 555-0202',
    });

    // 5. Expat Client
    clientUser = await User.create({
      brokerageId: brokerageA._id,
      name: 'Charlie Client',
      email: 'charlie@gmail.com',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    // 6. Access tokens
    tokenPlatformAdmin = tokenService.generateAccessToken({
      userId: platformAdmin._id.toString(),
      email: platformAdmin.email,
      role: platformAdmin.role,
      brokerageId: null,
    });

    tokenAdminA = tokenService.generateAccessToken({
      userId: adminA._id.toString(),
      email: adminA.email,
      role: adminA.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdminB = tokenService.generateAccessToken({
      userId: adminB._id.toString(),
      email: adminB.email,
      role: adminB.role,
      brokerageId: brokerageB._id.toString(),
    });

    tokenAdvisorA1 = tokenService.generateAccessToken({
      userId: advisorA1._id.toString(),
      email: advisorA1.email,
      role: advisorA1.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenClient = tokenService.generateAccessToken({
      userId: clientUser._id.toString(),
      email: clientUser.email,
      role: clientUser.role,
      brokerageId: brokerageA._id.toString(),
    });
  });

  describe('1. Advisor Creation & Safe Onboarding', () => {
    it('allows BROKERAGE_ADMIN to create an advisor with valid identity data', async () => {
      const res = await request(app)
        .post('/api/advisors')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          name: 'Sarah Connor',
          email: 'sarah@alpha-mortgages.com',
          phone: '+1 555-9999',
          password: 'SecureAdvisorPass123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.advisor).toBeDefined();
      expect(res.body.data.advisor.name).toBe('Sarah Connor');
      expect(res.body.data.advisor.email).toBe('sarah@alpha-mortgages.com');
      expect(res.body.data.advisor.role).toBe('ADVISOR');
      expect(res.body.data.advisor.status).toBe('ACTIVE');
      expect(res.body.data.advisor.brokerageId).toBe(brokerageA._id.toString());
      expect(res.body.data.advisor.phone).toBe('+1 555-9999');

      // Invariant: Zero password hash leakage
      expect(res.body.data.advisor.passwordHash).toBeUndefined();
      expect(res.body.data.advisor.password).toBeUndefined();

      // Newly created advisor can login with provided credentials
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sarah@alpha-mortgages.com',
          password: 'SecureAdvisorPass123!',
          brokerageSlug: 'alpha-mortgages',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.role).toBe('ADVISOR');
    });

    it('generates a secure default password if none is provided during advisor invitation', async () => {
      const res = await request(app)
        .post('/api/advisors')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          name: 'John Doe',
          email: 'john.doe@alpha-mortgages.com',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.advisor.email).toBe('john.doe@alpha-mortgages.com');
      expect(res.body.data.advisor.passwordHash).toBeUndefined();

      const createdUser = await User.findOne({ email: 'john.doe@alpha-mortgages.com' });
      expect(createdUser).not.toBeNull();
      expect(createdUser?.passwordHash).toBeDefined();
    });
  });

  describe('2. Advisor Listing & Scoping', () => {
    it('returns only advisors belonging to the caller brokerage for BROKERAGE_ADMIN', async () => {
      const res = await request(app)
        .get('/api/advisors')
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.advisors)).toBe(true);
      expect(res.body.data.advisors).toHaveLength(1);
      expect(res.body.data.advisors[0].email).toBe('aaron@alpha-mortgages.com');
      expect(res.body.data.advisors[0].brokerageId).toBe(brokerageA._id.toString());
      expect(res.body.data.advisors[0].passwordHash).toBeUndefined();
    });

    it('supports status filtering and search query', async () => {
      // Create an inactive advisor
      await User.create({
        brokerageId: brokerageA._id,
        name: 'Inactive Staff',
        email: 'inactive@alpha-mortgages.com',
        passwordHash,
        role: 'ADVISOR',
        status: 'INACTIVE',
      });

      // Filter by ACTIVE
      const activeRes = await request(app)
        .get('/api/advisors?status=ACTIVE')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.data.advisors).toHaveLength(1);
      expect(activeRes.body.data.advisors[0].email).toBe('aaron@alpha-mortgages.com');

      // Filter by INACTIVE
      const inactiveRes = await request(app)
        .get('/api/advisors?status=INACTIVE')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(inactiveRes.status).toBe(200);
      expect(inactiveRes.body.data.advisors).toHaveLength(1);
      expect(inactiveRes.body.data.advisors[0].email).toBe('inactive@alpha-mortgages.com');

      // Search by name
      const searchRes = await request(app)
        .get('/api/advisors?search=Aaron')
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.advisors).toHaveLength(1);
      expect(searchRes.body.data.advisors[0].name).toBe('Aaron Advisor');
    });
  });

  describe('3. Advisor Profile Updates & Historical Preservation', () => {
    it('updates advisor profile and status to INACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/advisors/${advisorA1._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          name: 'Aaron Advisor Updated',
          phone: '+1 555-7777',
          status: 'INACTIVE',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.advisor.name).toBe('Aaron Advisor Updated');
      expect(res.body.data.advisor.phone).toBe('+1 555-7777');
      expect(res.body.data.advisor.status).toBe('INACTIVE');

      // INACTIVE advisor is rejected on login attempts
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisorA1.email,
          password: DEFAULT_PASSWORD,
          brokerageSlug: 'alpha-mortgages',
        });
      expect(loginRes.status).toBe(401);
    });

    it('preserves historical leads and tasks when an advisor becomes INACTIVE', async () => {
      // Create a lead and task assigned to advisorA1
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Jane',
        lastName: 'Borrower',
        email: 'jane.borrower@example.com',
        phone: '+1 555-1234',
        status: 'NEW',
        source: 'WEBSITE',
        score: 85,
        assignedTo: advisorA1._id,
        customFields: {
          loanAmount: 350000,
          propertyValue: 450000,
        },
      });

      const task = await Task.create({
        brokerageId: brokerageA._id,
        leadId: lead._id,
        title: 'Initial Loan Review',
        assignedTo: advisorA1._id,
        priority: 'HIGH',
        dueDate: new Date(Date.now() + 86400000),
      });

      // Deactivate advisor
      await request(app)
        .patch(`/api/advisors/${advisorA1._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ status: 'INACTIVE' });

      // Invariant: Lead and Task still reference the advisor and populate properly
      const fetchedLead = await Lead.findById(lead._id).populate('assignedTo', 'name email status');
      expect(fetchedLead).not.toBeNull();
      expect((fetchedLead?.assignedTo as any).name).toBe('Aaron Advisor');
      expect((fetchedLead?.assignedTo as any).status).toBe('INACTIVE');

      const fetchedTask = await Task.findById(task._id).populate('assignedTo', 'name email status');
      expect(fetchedTask).not.toBeNull();
      expect((fetchedTask?.assignedTo as any).name).toBe('Aaron Advisor');
    });

    it('prohibits hard-deletion of advisor accounts', async () => {
      const res = await request(app)
        .delete(`/api/advisors/${advisorA1._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ADVISOR_DELETION_PROHIBITED');

      // Verify record still exists
      const userStillExists = await User.findById(advisorA1._id);
      expect(userStillExists).not.toBeNull();
    });
  });

  describe('4. RBAC & Cross-Role Access Control', () => {
    it('blocks CLIENT from listing, creating, or updating advisors', async () => {
      const listRes = await request(app)
        .get('/api/advisors')
        .set('Authorization', `Bearer ${tokenClient}`);
      expect(listRes.status).toBe(403);

      const createRes = await request(app)
        .post('/api/advisors')
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({
          name: 'Hacked Advisor',
          email: 'hacked@alpha-mortgages.com',
        });
      expect(createRes.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/advisors/${advisorA1._id}`)
        .set('Authorization', `Bearer ${tokenClient}`)
        .send({ name: 'Hacked Name' });
      expect(patchRes.status).toBe(403);
    });

    it('blocks ADVISOR from managing advisors', async () => {
      const listRes = await request(app)
        .get('/api/advisors')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);
      expect(listRes.status).toBe(403);

      const createRes = await request(app)
        .post('/api/advisors')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          name: 'Peer Advisor',
          email: 'peer@alpha-mortgages.com',
        });
      expect(createRes.status).toBe(403);

      const updateRes = await request(app)
        .patch(`/api/advisors/${advisorA1._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({ status: 'INACTIVE' });
      expect(updateRes.status).toBe(403);
    });

    it('preserves PLATFORM_ADMIN platform-level access', async () => {
      // Platform admin can list all advisors across brokerages
      const listRes = await request(app)
        .get('/api/advisors')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.advisors.length).toBeGreaterThanOrEqual(2);

      // Platform admin can create advisor in a specified brokerage
      const createRes = await request(app)
        .post('/api/advisors')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send({
          brokerageId: brokerageB._id.toString(),
          name: 'Platform Created Advisor',
          email: 'platform.advisor@beta-finance.com',
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.advisor.brokerageId).toBe(brokerageB._id.toString());
    });
  });

  describe('5. Tenant Isolation & Anti-IDOR Concealment', () => {
    it('returns 404 NotFound when BROKERAGE_ADMIN attempts to access or modify advisor from another brokerage', async () => {
      // Admin A tries to get Advisor B1 from Brokerage B
      const getRes = await request(app)
        .get(`/api/advisors/${advisorB1._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);
      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe('NOT_FOUND');

      // Admin A tries to update Advisor B1 from Brokerage B
      const patchRes = await request(app)
        .patch(`/api/advisors/${advisorB1._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ name: 'Cross Tenant Tampering' });
      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects cross-brokerage creation attempt with mismatched brokerageId', async () => {
      const res = await request(app)
        .post('/api/advisors')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          brokerageId: brokerageB._id.toString(),
          name: 'Illegitimate Advisor',
          email: 'illegitimate@beta-finance.com',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BROKERAGE_ISOLATION_VIOLATION');
    });
  });

  describe('6. Duplicate Identity & Conflict Handling', () => {
    it('returns 409 Conflict if an advisor with the same email already exists in the brokerage', async () => {
      const res = await request(app)
        .post('/api/advisors')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          name: 'Duplicate Aaron',
          email: 'aaron@alpha-mortgages.com', // Already exists in brokerage A
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 409 Conflict if email belongs to global PLATFORM_ADMIN', async () => {
      const res = await request(app)
        .post('/api/advisors')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          name: 'Admin Imposter',
          email: 'superadmin@leadflow.io', // Global platform admin email
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('allows identical email in a different brokerage without collision', async () => {
      // Invariant: Cross-brokerage duplicate tolerance supported by compound unique index
      const res = await request(app)
        .post('/api/advisors')
        .set('Authorization', `Bearer ${tokenAdminB}`)
        .send({
          name: 'Aaron in Beta',
          email: 'aaron@alpha-mortgages.com', // Exists in A, but registering in B
        });

      expect(res.status).toBe(201);
      expect(res.body.data.advisor.brokerageId).toBe(brokerageB._id.toString());
      expect(res.body.data.advisor.email).toBe('aaron@alpha-mortgages.com');
    });
  });

  describe('7. Nested Brokerage Route Compatibility', () => {
    it('supports listing advisors via GET /api/brokerages/:brokerageId/advisors', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerageA._id}/advisors`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.advisors).toHaveLength(1);
      expect(res.body.data.advisors[0].email).toBe('aaron@alpha-mortgages.com');
    });

    it('rejects cross-brokerage access to nested endpoint with 403 BROKERAGE_ISOLATION_VIOLATION', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerageB._id}/advisors`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BROKERAGE_ISOLATION_VIOLATION');
    });

    it('rejects nested POST when body.brokerageId conflicts with URL parameter', async () => {
      const res = await request(app)
        .post(`/api/brokerages/${brokerageA._id}/advisors`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          brokerageId: brokerageB._id.toString(), // Mismatch with URL param
          name: 'Spoofed Brokerage Advisor',
          email: 'spoofed@beta-finance.com',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BROKERAGE_ISOLATION_VIOLATION');
    });

    it('rejects nested GET when query.brokerageId conflicts with URL parameter', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerageA._id}/advisors?brokerageId=${brokerageB._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BROKERAGE_ISOLATION_VIOLATION');
    });

    it('supports retrieving nested advisor by ID via GET /api/brokerages/:brokerageId/advisors/:id', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerageA._id}/advisors/${advisorA1._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.advisor.id).toBe(advisorA1._id.toString());
    });

    it('returns 404 when querying an advisor belonging to another brokerage through nested URL', async () => {
      // Even for PLATFORM_ADMIN, an advisor from Brokerage B cannot be fetched through Brokerage A's nested URL
      const res = await request(app)
        .get(`/api/brokerages/${brokerageA._id}/advisors/${advisorB1._id}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('8. Advisor Lifecycle Hardening (Sessions, Concurrency, and Token Invalidation)', () => {
    it('immediately invalidates existing access tokens and revokes refresh sessions upon deactivation', async () => {
      // 1. Advisor logs in and gets active access & refresh token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: advisorA1.email,
          password: DEFAULT_PASSWORD,
          brokerageSlug: 'alpha-mortgages',
        });

      expect(loginRes.status).toBe(200);
      const activeAccessToken = loginRes.body.data.accessToken;
      const cookies: string[] = Array.isArray(loginRes.headers['set-cookie'])
        ? loginRes.headers['set-cookie']
        : [];

      // Verify active session exists in DB
      const sessionBefore = await Session.findOne({
        userId: advisorA1._id,
        isRevoked: false,
      });
      expect(sessionBefore).not.toBeNull();

      // 2. Brokerage admin deactivates the advisor
      const patchRes = await request(app)
        .patch(`/api/advisors/${advisorA1._id}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ status: 'INACTIVE' });
      expect(patchRes.status).toBe(200);

      // 3. Invariant: Database sessions are revoked
      const activeSessionsAfter = await Session.find({
        userId: advisorA1._id,
        isRevoked: false,
      });
      expect(activeSessionsAfter).toHaveLength(0);

      // 4. Invariant: Immediate protected HTTP access rejection with existing access token
      const protectedCallRes = await request(app)
        .get('/api/leads')
        .set('Authorization', `Bearer ${activeAccessToken}`);
      expect(protectedCallRes.status).toBe(401);
      expect(protectedCallRes.body.error.code).toBe('UNAUTHORIZED');

      // 5. Invariant: Token refresh rejection (session is revoked, user is inactive)
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookies);
      expect(refreshRes.status).toBe(401);
    });

    it('safely absorbs concurrent duplicate advisor creations under high concurrency', async () => {
      const email = 'concurrent.advisor@alpha-mortgages.com';

      // Fire 5 simultaneous creation requests with identical email
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/advisors')
          .set('Authorization', `Bearer ${tokenAdminA}`)
          .send({
            name: 'Concurrent Staff',
            email,
            password: 'SecurePassword123!',
          })
      );

      const responses = await Promise.all(requests);

      // Exactly 1 must succeed with 201 Created
      const successes = responses.filter((r) => r.status === 201);
      expect(successes).toHaveLength(1);

      // The other 4 must be absorbed idempotently/safely with 409 Conflict without crashes
      const conflicts = responses.filter((r) => r.status === 409);
      expect(conflicts).toHaveLength(4);
      conflicts.forEach((c) => {
        expect(c.body.error.code).toBe('CONFLICT');
      });

      // Verify only 1 User was created in MongoDB
      const createdCount = await User.countDocuments({
        brokerageId: brokerageA._id,
        email,
      });
      expect(createdCount).toBe(1);
    });
  });
});
