import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User, Lead, Client } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Client Conversion & Case Foundation Integration Tests', () => {
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

    // 2. Provision Staff & Portal Users
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
      name: 'Existing Client User',
      email: 'existing.client@gmail.com',
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

    // 3. Issue Access Tokens
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
  });

  describe('1. Successful Lead-to-Client Conversion', () => {
    it('allows an ADVISOR to convert an eligible QUALIFIED lead into a Client and portal User', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@techcorp.de',
        phone: '+49 170 1111111',
        status: 'QUALIFIED',
        source: 'WEBSITE',
        score: 90,
        assignedTo: advisorA1._id,
      });

      const res = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          password: 'SecurePassword123!',
          type: 'BUYER',
          address: {
            street: 'Friedrichstrasse 100',
            city: 'Berlin',
            state: 'Berlin',
            postalCode: '10117',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.client).toBeDefined();
      expect(res.body.data.client.firstName).toBe('John');
      expect(res.body.data.client.lastName).toBe('Doe');
      expect(res.body.data.client.email).toBe('john.doe@techcorp.de');
      expect(res.body.data.client.status).toBe('ACTIVE');
      expect(res.body.data.client.type).toBe('BUYER');
      expect(res.body.data.client.address.city).toBe('Berlin');
      expect(res.body.data.client.address.postalCode).toBe('10117');

      // Verify relationship is preserved in both directions
      expect(res.body.data.client.leadId).toBe(lead._id.toString());
      expect(res.body.data.lead.convertedClientId).toBe(res.body.data.client._id);

      // Verify lead transitioned to WON
      expect(res.body.data.lead.status).toBe('WON');

      // Verify advisor assignment preserved
      expect(res.body.data.client.assignedTo).toBe(advisorA1._id.toString());

      // Verify portal user created and linked
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('john.doe@techcorp.de');
      expect(res.body.data.user.role).toBe('CLIENT');
      expect(res.body.data.user.isNew).toBe(true);
      expect(res.body.data.client.userId).toBe(res.body.data.user.id);

      // Verify database records
      const clientDoc = await Client.findById(res.body.data.client._id);
      expect(clientDoc).not.toBeNull();
      expect(clientDoc?.brokerageId.toString()).toBe(brokerageA._id.toString());

      const updatedLead = await Lead.findById(lead._id);
      expect(updatedLead?.status).toBe('WON');
      expect(updatedLead?.convertedClientId?.toString()).toBe(clientDoc?._id.toString());
    });

    it('allows conversion via the /api/clients/convert/:leadId alias endpoint', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Sarah',
        lastName: 'Connor',
        email: 'sarah.connor@sky.net',
        status: 'PROPOSAL',
        source: 'REFERRAL',
        score: 85,
        assignedTo: advisorA2._id,
      });

      const res = await request(app)
        .post(`/api/clients/convert/${lead._id}`)
        .set('Authorization', `Bearer ${tokenBrokerageAdminA}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.client.email).toBe('sarah.connor@sky.net');
      expect(res.body.data.client.assignedTo).toBe(advisorA2._id.toString());
      // Auto-generated temporary password returned when none provided
      expect(res.body.data.temporaryPassword).toBeDefined();
    });

    it('allows BROKERAGE_ADMIN to reassign advisor during conversion', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Tom',
        lastName: 'Hardy',
        email: 'tom.hardy@hollywood.com',
        status: 'NEGOTIATION',
        source: 'CAMPAIGN',
        score: 75,
        assignedTo: advisorA1._id,
      });

      const res = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenBrokerageAdminA}`)
        .send({
          assignedTo: advisorA2._id.toString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.client.assignedTo).toBe(advisorA2._id.toString());
    });

    it('allows converting a lead already in WON stage', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Anna',
        lastName: 'Karenina',
        email: 'anna.karenina@literature.org',
        status: 'WON',
        source: 'MANUAL',
        score: 95,
        assignedTo: advisorA1._id,
      });

      const res = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.data.lead.status).toBe('WON');
      expect(res.body.data.client.email).toBe('anna.karenina@literature.org');
    });
  });

  describe('2. Invalid Conversion Attempts', () => {
    it('rejects converting a lead marked as LOST with 400 ValidationError', async () => {
      const lostLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Lost',
        lastName: 'Opportunity',
        email: 'lost@nowhere.com',
        status: 'LOST',
        source: 'WEBSITE',
        score: 20,
      });

      const res = await request(app)
        .post(`/api/leads/${lostLead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('LOST');
    });

    it('rejects converting an un-qualified raw NEW lead with 400 ValidationError', async () => {
      const newLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Brand',
        lastName: 'New',
        email: 'brand.new@lead.com',
        status: 'NEW',
        source: 'WEBSITE',
        score: 50,
      });

      const res = await request(app)
        .post(`/api/leads/${newLead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('qualified stage');
    });

    it('rejects converting a CONTACTED lead before it is QUALIFIED with 400 ValidationError', async () => {
      const contactedLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Just',
        lastName: 'Contacted',
        email: 'contacted@lead.com',
        status: 'CONTACTED',
        source: 'WEBSITE',
        score: 60,
      });

      const res = await request(app)
        .post(`/api/leads/${contactedLead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('qualified stage');
    });

    it('rejects conversion with password shorter than 8 characters', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Short',
        lastName: 'Pass',
        email: 'shortpass@lead.com',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const res = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects conversion if assigned advisor belongs to another brokerage', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Wrong',
        lastName: 'Advisor',
        email: 'wrong.advisor@lead.com',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const res = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenBrokerageAdminA}`)
        .send({
          assignedTo: advisorB._id.toString(), // Belongs to Brokerage B!
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Assigned advisor not found in this brokerage');
    });
  });

  describe('3. Duplicate Conversion Prevention', () => {
    it('rejects converting the same lead twice with 409 ConflictError', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Double',
        lastName: 'Trouble',
        email: 'double.trouble@example.com',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      // 1st conversion succeeds
      const res1 = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});
      expect(res1.status).toBe(201);

      // 2nd conversion fails
      const res2 = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});
      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('CONFLICT');
      expect(res2.body.error.message).toContain('already been converted');
    });

    it('rejects converting a lead whose email already exists as a Client in the brokerage', async () => {
      // Pre-existing client in Brokerage A
      await Client.create({
        brokerageId: brokerageA._id,
        firstName: 'Pre',
        lastName: 'Existing',
        email: 'pre.existing@example.com',
        status: 'ACTIVE',
      });

      // New lead with same email
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Pre',
        lastName: 'Existing Lead',
        email: 'pre.existing@example.com',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const res = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('client with this email already exists');
    });
  });

  describe('4. Concurrent Conversion Race Conditions', () => {
    it('guarantees exactly one client is created under concurrent conversion requests', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Race',
        lastName: 'Condition',
        email: 'race.condition@test.com',
        status: 'QUALIFIED',
        source: 'WEBSITE',
        score: 80,
      });

      // Fire 5 concurrent conversion requests simultaneously
      const requests = Array.from({ length: 5 }).map(() =>
        request(app)
          .post(`/api/leads/${lead._id}/convert`)
          .set('Authorization', `Bearer ${tokenAdvisorA1}`)
          .send({
            password: 'RacePassword123!',
          })
      );

      const responses = await Promise.all(requests);
      const successes = responses.filter((r) => r.status === 201);
      const conflicts = responses.filter((r) => r.status === 409);

      // Exactly ONE request succeeds
      expect(successes).toHaveLength(1);
      // All other 4 requests receive HTTP 409 Conflict
      expect(conflicts).toHaveLength(4);

      // Exactly ONE Client document exists in DB
      const clientDocs = await Client.find({
        brokerageId: brokerageA._id,
        email: 'race.condition@test.com',
      });
      expect(clientDocs).toHaveLength(1);

      // Exactly ONE User document exists in DB
      const userDocs = await User.find({
        brokerageId: brokerageA._id,
        email: 'race.condition@test.com',
      });
      expect(userDocs).toHaveLength(1);
    });
  });

  describe('5. Client User Linkage & Portal Authentication', () => {
    it('links to an existing CLIENT user account if one already exists in the brokerage', async () => {
      // clientUserA already created in beforeEach with email 'existing.client@gmail.com'
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Existing',
        lastName: 'Client Person',
        email: 'existing.client@gmail.com',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const res = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.data.user.id).toBe(clientUserA._id.toString());
      expect(res.body.data.user.isNew).toBe(false);
      expect(res.body.data.client.userId).toBe(clientUserA._id.toString());
    });

    it('rejects conversion if user exists with non-client role (e.g. ADVISOR)', async () => {
      // advisorA1 has email 'elena@berlin-expat.de'
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Elena',
        lastName: 'Advisor-Lead',
        email: 'elena@berlin-expat.de',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const res = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenBrokerageAdminA}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('non-client role');
    });

    it('allows newly converted client to log in immediately via /api/auth/login', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Login',
        lastName: 'Test',
        email: 'login.test@client.com',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const convertRes = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({
          password: 'MyLoginPassword123!',
        });
      expect(convertRes.status).toBe(201);

      // Now log in as the newly converted client
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login.test@client.com',
          password: 'MyLoginPassword123!',
          brokerageSlug: brokerageA.slug,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.user.role).toBe('CLIENT');
      expect(loginRes.body.data.accessToken).toBeDefined();
    });
  });

  describe('6. Client Accessing Own Case', () => {
    it('allows authenticated CLIENT to retrieve their own case profile via GET /api/clients/me', async () => {
      // Create Client linked to clientUserA
      const clientDoc = await Client.create({
        brokerageId: brokerageA._id,
        userId: clientUserA._id,
        firstName: 'Alex',
        lastName: 'Client',
        email: clientUserA.email,
        status: 'ACTIVE',
        type: 'BUYER',
        assignedTo: advisorA1._id,
        address: {
          street: 'Alexanderplatz 1',
          city: 'Berlin',
          postalCode: '10178',
        },
      });

      const res = await request(app)
        .get('/api/clients/me')
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.client._id).toBe(clientDoc._id.toString());
      expect(res.body.data.client.email).toBe(clientUserA.email);
      expect(res.body.data.client.address.city).toBe('Berlin');
      // Populated advisor details
      expect(res.body.data.client.assignedTo.name).toBe(advisorA1.name);
      expect(res.body.data.client.assignedTo.email).toBe(advisorA1.email);
      // Populated brokerage details
      expect(res.body.data.client.brokerageId.slug).toBe(brokerageA.slug);
    });

    it('returns 403 when non-CLIENT user calls GET /api/clients/me', async () => {
      const res = await request(app)
        .get('/api/clients/me')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows CLIENT to fetch their own case by ID via GET /api/clients/:id', async () => {
      const clientDoc = await Client.create({
        brokerageId: brokerageA._id,
        userId: clientUserA._id,
        firstName: 'Alex',
        lastName: 'Client',
        email: clientUserA.email,
        status: 'ACTIVE',
      });

      const res = await request(app)
        .get(`/api/clients/${clientDoc._id}`)
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.client._id).toBe(clientDoc._id.toString());
    });
  });

  describe('7. CLIENT Attempting Another Client Case (Anti-IDOR)', () => {
    it('returns 404 when a CLIENT attempts to retrieve another client case in the SAME brokerage', async () => {
      // Another client user and client in Brokerage A
      const otherUser = await User.create({
        brokerageId: brokerageA._id,
        name: 'Bob Other',
        email: 'bob.other@gmail.com',
        passwordHash,
        role: 'CLIENT',
        status: 'ACTIVE',
      });

      const otherClient = await Client.create({
        brokerageId: brokerageA._id,
        userId: otherUser._id,
        firstName: 'Bob',
        lastName: 'Other',
        email: otherUser.email,
        status: 'ACTIVE',
      });

      // clientUserA tries to access otherClient's ID
      const res = await request(app)
        .get(`/api/clients/${otherClient._id}`)
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Client resource not found');
    });

    it('returns 404 when a CLIENT attempts to retrieve a client in ANOTHER brokerage', async () => {
      const clientB = await Client.create({
        brokerageId: brokerageB._id,
        firstName: 'Munich',
        lastName: 'Client',
        email: 'munich.client@test.de',
        status: 'ACTIVE',
      });

      const res = await request(app)
        .get(`/api/clients/${clientB._id}`)
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('8. Cross-Brokerage Tenant Boundary Isolation', () => {
    it('returns 404 when an Advisor in Brokerage A attempts to convert a Lead in Brokerage B', async () => {
      const leadB = await Lead.create({
        brokerageId: brokerageB._id,
        firstName: 'Secret',
        lastName: 'B-Lead',
        email: 'secret.b@munich.de',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const res = await request(app)
        .post(`/api/leads/${leadB._id}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Lead resource not found');
    });

    it('returns 404 when an Advisor in Brokerage A attempts to view a Client in Brokerage B', async () => {
      const clientB = await Client.create({
        brokerageId: brokerageB._id,
        firstName: 'Munich',
        lastName: 'Client',
        email: 'client.b@munich.de',
        status: 'ACTIVE',
      });

      const res = await request(app)
        .get(`/api/clients/${clientB._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('9. Role-Based Access Control', () => {
    it('strictly forbids CLIENT role from converting a lead with 403', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Test',
        lastName: 'Lead',
        email: 'test.lead@test.com',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const res = await request(app)
        .post(`/api/leads/${lead._id}/convert`)
        .set('Authorization', `Bearer ${tokenClientA}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('strictly forbids CLIENT role from listing clients with 403', async () => {
      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows PLATFORM_ADMIN to convert a lead and inspect clients across brokerages', async () => {
      const leadB = await Lead.create({
        brokerageId: brokerageB._id,
        firstName: 'Platform',
        lastName: 'Converted',
        email: 'platform.converted@munich.de',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const convertRes = await request(app)
        .post(`/api/leads/${leadB._id}/convert`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send({});

      expect(convertRes.status).toBe(201);
      expect(convertRes.body.data.client.brokerageId).toBe(brokerageB._id.toString());

      // PLATFORM_ADMIN can view the created client
      const getRes = await request(app)
        .get(`/api/clients/${convertRes.body.data.client._id}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.client.email).toBe('platform.converted@munich.de');
    });

    it('rejects unauthenticated requests to conversion with 401', async () => {
      const fakeId = new Types.ObjectId();
      const res = await request(app)
        .post(`/api/leads/${fakeId}/convert`)
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('10. Malformed & Nonexistent IDs', () => {
    it('returns 400 ValidationError on malformed lead ID during conversion', async () => {
      const res = await request(app)
        .post('/api/leads/not-a-valid-object-id/convert')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 NotFoundError on nonexistent valid lead ID during conversion', async () => {
      const nonExistentId = new Types.ObjectId();
      const res = await request(app)
        .post(`/api/leads/${nonExistentId}/convert`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 NotFoundError on malformed client ID in GET /api/clients/:id', async () => {
      const res = await request(app)
        .get('/api/clients/malformed-id-123')
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 NotFoundError on nonexistent client ID in GET /api/clients/:id', async () => {
      const nonExistentId = new Types.ObjectId();
      const res = await request(app)
        .get(`/api/clients/${nonExistentId}`)
        .set('Authorization', `Bearer ${tokenAdvisorA1}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
