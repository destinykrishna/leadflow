import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User, Lead, Client } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Phase 4: Lead Spam/Abuse Protection & Lead Lifecycle Integration Tests', () => {
  const DEFAULT_PASSWORD = 'Password123!';
  const WEBHOOK_SECRET_A = 'secret-brokerage-a-spam-tests';
  const WEBHOOK_SECRET_B = 'secret-brokerage-b-spam-tests';

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let advisorA: InstanceType<typeof User>;
  let advisorB: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;

  let tokenAdvisorA: string;
  let tokenAdvisorB: string;
  let tokenClientA: string;

  beforeEach(async () => {
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Create two tenant brokerages
    brokerageA = await Brokerage.create({
      name: 'Alpha Mortgages GmbH',
      slug: 'alpha-mortgages',
      plan: 'GROWTH',
      status: 'ACTIVE',
      webhookSecret: WEBHOOK_SECRET_A,
    });

    brokerageB = await Brokerage.create({
      name: 'Beta Lending Corp',
      slug: 'beta-lending',
      plan: 'GROWTH',
      status: 'ACTIVE',
      webhookSecret: WEBHOOK_SECRET_B,
    });

    // 2. Users
    advisorA = await User.create({
      name: 'Advisor Alice',
      email: 'alice@alpha-mortgages.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
      brokerageId: brokerageA._id,
    });

    advisorB = await User.create({
      name: 'Advisor Bob',
      email: 'bob@beta-lending.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
      brokerageId: brokerageB._id,
    });

    clientUserA = await User.create({
      name: 'Client User',
      email: 'client@example.com',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
      brokerageId: brokerageA._id,
    });

    // 3. JWT Tokens
    tokenAdvisorA = tokenService.generateAccessToken({
      userId: advisorA._id.toString(),
      role: 'ADVISOR',
      brokerageId: brokerageA._id.toString(),
      email: advisorA.email,
    });

    tokenAdvisorB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      role: 'ADVISOR',
      brokerageId: brokerageB._id.toString(),
      email: advisorB.email,
    });

    tokenClientA = tokenService.generateAccessToken({
      userId: clientUserA._id.toString(),
      role: 'CLIENT',
      brokerageId: brokerageA._id.toString(),
      email: clientUserA.email,
    });
  });

  describe('1. Silent Honeypot Protection', () => {
    it('should silently ignore lead submission with populated _hp honeypot field without writing to DB', async () => {
      const email = 'spambot@example.com';
      const res = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', WEBHOOK_SECRET_A)
        .send({
          firstName: 'Bot',
          lastName: 'Spammer',
          email,
          _hp: 'http://spam-link.ru',
        });

      // Returns synthetic success so the bot is unaware
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify zero records were written to MongoDB
      const leadInDb = await Lead.findOne({ email, brokerageId: brokerageA._id });
      expect(leadInDb).toBeNull();
    });

    it('should silently ignore lead submission with populated hp_website honeypot field', async () => {
      const email = 'crawler@badbot.com';
      const res = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', WEBHOOK_SECRET_A)
        .send({
          firstName: 'Crawler',
          lastName: 'Bot',
          email,
          hp_website: 'https://crawler-trap.net',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const leadInDb = await Lead.findOne({ email, brokerageId: brokerageA._id });
      expect(leadInDb).toBeNull();
    });

    it('should allow legitimate leads when honeypot fields are omitted or empty', async () => {
      const email = 'legitimate.borrower@gmail.com';
      const res = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', WEBHOOK_SECRET_A)
        .send({
          firstName: 'Priya',
          lastName: 'Sharma',
          email,
          _hp: '',
          hp_website: '',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const leadInDb = await Lead.findOne({ email, brokerageId: brokerageA._id });
      expect(leadInDb).not.toBeNull();
      expect(leadInDb!.firstName).toBe('Priya');
    });
  });

  describe('2. Disposable Email Domain Blocklist', () => {
    it('should reject inquiries using obvious disposable mail domains with HTTP 400', async () => {
      const disposableEmails = [
        'test@mailinator.com',
        'throwaway@tempmail.com',
        'junk@10minutemail.com',
        'bot@guerrillamail.com',
        'fake@sharklasers.com',
        'spammer@yopmail.com',
      ];

      for (const email of disposableEmails) {
        const res = await request(app)
          .post(`/api/leads/webhook/${brokerageA._id}`)
          .set('x-webhook-secret', WEBHOOK_SECRET_A)
          .send({
            firstName: 'Temp',
            lastName: 'User',
            email,
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toContain('Disposable or temporary email addresses are not accepted');

        const leadInDb = await Lead.findOne({ email, brokerageId: brokerageA._id });
        expect(leadInDb).toBeNull();
      }
    });

    it('should accept valid non-disposable email domains', async () => {
      const validEmails = [
        'applicant@gmail.com',
        'homebuyer@yahoo.com',
        'borrower@outlook.com',
        'expat@siemens.de',
      ];

      for (const email of validEmails) {
        const res = await request(app)
          .post(`/api/leads/webhook/${brokerageA._id}`)
          .set('x-webhook-secret', WEBHOOK_SECRET_A)
          .send({
            firstName: 'Valid',
            lastName: 'Applicant',
            email,
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      }
    });
  });

  describe('3. Safe Re-inquiry Handling for LOST & Archived Leads', () => {
    it('should revive a LOST lead as a fresh NEW inquiry and preserve history', async () => {
      const email = 'lost.borrower@example.com';

      // 1. Create lead in LOST stage with existing notes
      const initialLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Rahul',
        lastName: 'Verma',
        email,
        phone: '+4915100000001',
        status: 'LOST',
        source: 'WEBSITE',
        score: 40,
        notes: 'Initial inquiry dropped off due to high interest rates in 2024.',
        isArchived: false,
      });

      // 2. Incoming fresh webhook inquiry with updated loan details and new notes
      const res = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', WEBHOOK_SECRET_A)
        .send({
          firstName: 'Rahul',
          lastName: 'Verma (Updated)',
          email,
          phone: '+4915199999999',
          notes: 'Rates improved, looking for a 500k loan now.',
          customFields: {
            loanAmount: 500000,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.isDuplicate).toBe(false);
      expect(res.body.isReInquiry).toBe(true);

      // Verify DB record was updated, not duplicated
      const count = await Lead.countDocuments({ email, brokerageId: brokerageA._id });
      expect(count).toBe(1);

      const revived = await Lead.findById(initialLead._id);
      expect(revived).not.toBeNull();
      expect(revived!.status).toBe('NEW');
      expect(revived!.lastName).toBe('Verma (Updated)');
      expect(revived!.phone).toBe('+4915199999999');
      expect(revived!.isArchived).toBe(false);
      // Verify historical notes preserved
      expect(revived!.notes).toContain('Rates improved, looking for a 500k loan now.');
      expect(revived!.notes).toContain('Initial inquiry dropped off due to high interest rates in 2024.');
      // Verify re-inquiry audit tracking
      expect((revived!.customFields as any).get('reInquiryCount')).toBe(1);
      expect((revived!.customFields as any).get('previousStageBeforeReInquiry')).toBe('LOST');
    });

    it('should revive an archived lead as a fresh NEW inquiry and unarchive it', async () => {
      const email = 'archived.borrower@example.com';

      const initialLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Ananya',
        lastName: 'Deshmukh',
        email,
        status: 'NEW',
        source: 'REFERRAL',
        score: 50,
        isArchived: true,
        archivedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', WEBHOOK_SECRET_A)
        .send({
          firstName: 'Ananya',
          lastName: 'Deshmukh',
          email,
          notes: 'Returning inquiry.',
        });

      expect(res.status).toBe(201);
      expect(res.body.isDuplicate).toBe(false);
      expect(res.body.isReInquiry).toBe(true);

      const revived = await Lead.findById(initialLead._id);
      expect(revived!.isArchived).toBe(false);
      expect(revived!.archivedAt).toBeNull();
      expect(revived!.status).toBe('NEW');
    });

    it('should return isDuplicate: true and preserve active stage when lead is in active progression', async () => {
      const email = 'active.borrower@example.com';

      const activeLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Vikram',
        lastName: 'Mehta',
        email,
        status: 'QUALIFIED',
        source: 'WEBSITE',
        score: 75,
        isArchived: false,
      });

      const res = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', WEBHOOK_SECRET_A)
        .send({
          firstName: 'Vikram',
          lastName: 'Mehta',
          email,
        });

      expect(res.status).toBe(200);
      expect(res.body.isDuplicate).toBe(true);

      const inDb = await Lead.findById(activeLead._id);
      expect(inDb!.status).toBe('QUALIFIED'); // Stage not overwritten
    });
  });

  describe('4. Staff Explicit Reopen Inquiry Action', () => {
    it('should allow an advisor to reopen a lead from LOST back to NEW with concurrency tracking', async () => {
      const lostLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Siddharth',
        lastName: 'Rao',
        email: 'sid.rao@example.com',
        status: 'LOST',
        score: 60,
      });

      const res = await request(app)
        .patch(`/api/leads/${lostLead._id}/reopen`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({
          version: lostLead.__v,
          reason: 'Client called back after finding a property.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentStage).toBe('NEW');
      expect(res.body.data.previousStage).toBe('LOST');

      const inDb = await Lead.findById(lostLead._id);
      expect(inDb!.status).toBe('NEW');
      expect(inDb!.notes).toContain('Client called back after finding a property.');
      expect(inDb!.__v).toBe(lostLead.__v + 1);
    });

    it('should reject reopening a lead that is not in LOST status', async () => {
      const activeLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Deepak',
        lastName: 'Nair',
        email: 'deepak.nair@example.com',
        status: 'QUALIFIED',
      });

      const res = await request(app)
        .patch(`/api/leads/${activeLead._id}/reopen`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ reason: 'Try to reopen' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain("Only leads in 'LOST' status can be reopened");
    });

    it('should reject reopening with HTTP 409 CONFLICT if expected version does not match', async () => {
      const lostLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Kavita',
        lastName: 'Patel',
        email: 'kavita@example.com',
        status: 'LOST',
      });

      const res = await request(app)
        .patch(`/api/leads/${lostLead._id}/reopen`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({
          version: 999, // Outdated version
          reason: 'Stale update attempt',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Stage update conflict');
    });

    it('should reject CLIENT role with HTTP 403 FORBIDDEN when attempting to reopen a lead', async () => {
      const lostLead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Target',
        lastName: 'Lead',
        email: 'target@example.com',
        status: 'LOST',
      });

      const res = await request(app)
        .patch(`/api/leads/${lostLead._id}/reopen`)
        .set('Authorization', `Bearer ${tokenClientA}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('should return HTTP 404 NOT_FOUND when an advisor attempts to reopen a lead from another brokerage (Anti-IDOR)', async () => {
      const lostLeadBrokerageB = await Lead.create({
        brokerageId: brokerageB._id,
        firstName: 'Beta',
        lastName: 'Borrower',
        email: 'beta.borrower@example.com',
        status: 'LOST',
      });

      // Advisor A tries to reopen Brokerage B's lead
      const res = await request(app)
        .patch(`/api/leads/${lostLeadBrokerageB._id}/reopen`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');

      // Lead in Brokerage B was untouched
      const inDb = await Lead.findById(lostLeadBrokerageB._id);
      expect(inDb!.status).toBe('LOST');
    });
  });
});
