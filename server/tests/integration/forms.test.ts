import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Form, Brokerage, User, Lead } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';

describe('Forms Domain & API Integration Tests', () => {
  let httpServer: http.Server;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let adminA: InstanceType<typeof User>;
  let advisorA: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;
  let platformAdmin: InstanceType<typeof User>;
  let adminB: InstanceType<typeof User>;

  let tokenAdminA: string;
  let tokenAdvisorA: string;
  let tokenClientA: string;
  let tokenPlatformAdmin: string;
  let tokenAdminB: string;

  beforeAll(async () => {
    httpServer = http.createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, () => resolve()));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(async () => {
    await Form.deleteMany({});
    await Lead.deleteMany({});
    await User.deleteMany({});
    await Brokerage.deleteMany({});

    brokerageA = await Brokerage.create({
      name: 'Berlin Capital Mortgages',
      slug: 'berlin-capital',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Munich Expat Finance',
      slug: 'munich-finance',
      plan: 'STARTER',
      status: 'ACTIVE',
    });

    platformAdmin = await User.create({
      name: 'System Admin',
      email: 'platform@leadflow.io',
      passwordHash: '$2b$10$testhash',
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    });

    adminA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Admin Berlin',
      email: 'admin@berlin-capital.de',
      passwordHash: '$2b$10$testhash',
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    advisorA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Advisor Berlin',
      email: 'advisor@berlin-capital.de',
      passwordHash: '$2b$10$testhash',
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    clientUserA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Client User',
      email: 'client@berlin-capital.de',
      passwordHash: '$2b$10$testhash',
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    adminB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Admin Munich',
      email: 'admin@munich-finance.de',
      passwordHash: '$2b$10$testhash',
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    const tokenPayload = (user: InstanceType<typeof User>) => ({
      userId: user._id.toString(),
      role: user.role,
      brokerageId: user.brokerageId ? user.brokerageId.toString() : null,
      email: user.email,
    });

    tokenPlatformAdmin = tokenService.generateAccessToken(tokenPayload(platformAdmin));
    tokenAdminA = tokenService.generateAccessToken(tokenPayload(adminA));
    tokenAdvisorA = tokenService.generateAccessToken(tokenPayload(advisorA));
    tokenClientA = tokenService.generateAccessToken(tokenPayload(clientUserA));
    tokenAdminB = tokenService.generateAccessToken(tokenPayload(adminB));
  });

  describe('RBAC & Tenant Isolation', () => {
    it('allows BROKERAGE_ADMIN and PLATFORM_ADMIN to create forms, defaults to DRAFT', async () => {
      const res = await request(httpServer)
        .post('/api/forms')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          title: 'Expat Mortgage Intake',
          slug: 'expat-mortgage',
          description: 'Initial inquiry form',
          fields: [
            { fieldKey: 'firstName', label: 'First Name', type: 'text', required: true, order: 0 },
            { fieldKey: 'email', label: 'Email', type: 'email', required: true, order: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.slug).toBe('expat-mortgage');
      expect(res.body.data.brokerageId).toBe(brokerageA._id.toString());
    });

    it('denies ADVISOR and CLIENT roles from creating or modifying forms (403 Forbidden)', async () => {
      // ADVISOR cannot create
      const advisorRes = await request(httpServer)
        .post('/api/forms')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({
          title: 'Advisor Form',
          slug: 'advisor-form',
          fields: [],
        });
      expect(advisorRes.status).toBe(403);

      // CLIENT cannot create
      const clientRes = await request(httpServer)
        .post('/api/forms')
        .set('Authorization', `Bearer ${tokenClientA}`)
        .send({
          title: 'Client Form',
          slug: 'client-form',
          fields: [],
        });
      expect(clientRes.status).toBe(403);
    });

    it('allows ADVISOR to read forms for their own brokerage', async () => {
      await Form.create({
        brokerageId: brokerageA._id,
        title: 'Mortgage Form',
        slug: 'mortgage-form',
        status: 'PUBLISHED',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      const listRes = await request(httpServer)
        .get('/api/forms')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
    });

    it('enforces anti-IDOR isolation across brokerages (returns 404)', async () => {
      const formB = await Form.create({
        brokerageId: brokerageB._id,
        title: 'Munich Exclusive',
        slug: 'munich-exclusive',
        status: 'DRAFT',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      // Admin A attempts to view Munich's form
      const res = await request(httpServer)
        .get(`/api/forms/${formB._id.toString()}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Form Lifecycle (DRAFT, PUBLISHED, ARCHIVED)', () => {
    it('manages transition from DRAFT to PUBLISHED to ARCHIVED', async () => {
      const createRes = await request(httpServer)
        .post('/api/forms')
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({
          title: 'Lifecycle Form',
          slug: 'lifecycle',
          fields: [],
        });

      const formId = createRes.body.data._id;
      expect(createRes.body.data.status).toBe('DRAFT');

      // Publish
      const pubRes = await request(httpServer)
        .patch(`/api/forms/${formId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`)
        .send({ status: 'PUBLISHED' });

      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe('PUBLISHED');

      // Archive via DELETE endpoint
      const archRes = await request(httpServer)
        .delete(`/api/forms/${formId}`)
        .set('Authorization', `Bearer ${tokenAdminA}`);

      expect(archRes.status).toBe(200);
      expect(archRes.body.data.status).toBe('ARCHIVED');
    });
  });

  describe('Public Endpoints (Rendering & Submission)', () => {
    let publishedForm: InstanceType<typeof Form>;

    beforeEach(async () => {
      publishedForm = await Form.create({
        brokerageId: brokerageA._id,
        title: 'Mortgage Pre-Qualification',
        slug: 'pre-qual',
        description: 'Get pre-qualified in minutes',
        status: 'PUBLISHED',
        fields: [
          { fieldKey: 'firstName', label: 'First Name', type: 'text', required: true, order: 0 },
          { fieldKey: 'lastName', label: 'Last Name', type: 'text', required: false, order: 1 },
          { fieldKey: 'email', label: 'Email', type: 'email', required: true, order: 2 },
          { fieldKey: 'phone', label: 'Phone', type: 'phone', required: false, order: 3 },
          { fieldKey: 'loanAmount', label: 'Desired Loan Amount', type: 'number', required: false, order: 4 },
        ],
        submitButtonText: 'Submit Inquiry',
        successMessage: 'Thank you! We will contact you soon.',
        submissionCount: 0,
      });
    });

    it('retrieves published form schema via public endpoint without authentication', async () => {
      const res = await request(httpServer).get('/api/forms/public/berlin-capital/pre-qual');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Mortgage Pre-Qualification');
      expect(res.body.data.fields).toHaveLength(5);
      expect(res.body.data.submitButtonText).toBe('Submit Inquiry');
      // Verify internal admin fields are NOT exposed
      expect(res.body.data.submissionCount).toBeUndefined();
    });

    it('supports public lookup using 24-character brokerage ObjectId', async () => {
      const res = await request(httpServer).get(
        `/api/forms/public/${brokerageA._id.toString()}/pre-qual`
      );

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Mortgage Pre-Qualification');
    });

    it('conceals DRAFT forms and returns 404 to public requests', async () => {
      await Form.create({
        brokerageId: brokerageA._id,
        title: 'Draft Survey',
        slug: 'draft-survey',
        status: 'DRAFT',
        fields: [],
        submitButtonText: 'Submit',
        successMessage: 'Done',
      });

      const res = await request(httpServer).get('/api/forms/public/berlin-capital/draft-survey');
      expect(res.status).toBe(404);
    });

    it('processes public submission, creates Lead via existing ingestion, and increments count', async () => {
      const submitRes = await request(httpServer)
        .post('/api/forms/public/berlin-capital/pre-qual/submit')
        .send({
          responses: {
            firstName: 'Maria',
            lastName: 'Weber',
            email: 'maria.weber@expat.de',
            phone: '+491701234567',
            loanAmount: 320000,
          },
        });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.message).toBe('Thank you! We will contact you soon.');
      // Verify NO internal Lead details are leaked to submitter
      expect(submitRes.body.leadId).toBeUndefined();
      expect(submitRes.body.data).toBeUndefined();

      // Verify Lead was created in the database
      const lead = await Lead.findOne({
        brokerageId: brokerageA._id,
        email: 'maria.weber@expat.de',
      });

      expect(lead).toBeDefined();
      expect(lead?.firstName).toBe('Maria');
      expect(lead?.lastName).toBe('Weber');
      expect(lead?.status).toBe('NEW');
      expect(lead?.source).toBe('WEBSITE');
      const custom = lead?.customFields as any;
      const getCustomVal = (key: string) => (typeof custom?.get === 'function' ? custom.get(key) : custom?.[key]);
      expect(getCustomVal('loanAmount')).toBe(320000);
      expect(getCustomVal('formId')).toBe(publishedForm._id.toString());

      // Verify Form submission count incremented
      const updatedForm = await Form.findById(publishedForm._id);
      expect(updatedForm?.submissionCount).toBe(1);
    });

    it('deduplicates subsequent submissions idempotently via existing lead ingestion flow', async () => {
      // First submission
      await request(httpServer)
        .post('/api/forms/public/berlin-capital/pre-qual/submit')
        .send({
          responses: {
            firstName: 'Lukas',
            email: 'lukas@example.de',
          },
        });

      // Second submission with same email
      const dupRes = await request(httpServer)
        .post('/api/forms/public/berlin-capital/pre-qual/submit')
        .send({
          responses: {
            firstName: 'Lukas',
            email: 'lukas@example.de',
          },
        });

      expect(dupRes.status).toBe(200);
      expect(dupRes.body.success).toBe(true);

      // Verify exactly ONE lead document exists in the collection (no duplicate created)
      const count = await Lead.countDocuments({
        brokerageId: brokerageA._id,
        email: 'lukas@example.de',
      });
      expect(count).toBe(1);
    });

    it('rejects submissions with missing required fields (400)', async () => {
      const res = await request(httpServer)
        .post('/api/forms/public/berlin-capital/pre-qual/submit')
        .send({
          responses: {
            // firstName is required on this form but omitted
            email: 'someone@example.de',
          },
        });

      expect(res.status).toBe(400);
    });

    it('drops honeypot submissions silently without database writes', async () => {
      const res = await request(httpServer)
        .post('/api/forms/public/berlin-capital/pre-qual/submit')
        .send({
          responses: {
            firstName: 'Bot',
            email: 'bot@spam.com',
          },
          _hp: 'honey-trap-triggered',
        });

      expect(res.status).toBe(200);

      const count = await Lead.countDocuments({
        brokerageId: brokerageA._id,
        email: 'bot@spam.com',
      });
      expect(count).toBe(0);
    });
  });
});
