import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, Lead } from '../../src/models/index.js';

describe('External Lead Ingestion Integration Tests', () => {
  const SECRET_A = 'secret-key-brokerage-a-leadflow-2026';
  const SECRET_B = 'secret-key-brokerage-b-leadflow-2026';

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;
  let suspendedBrokerage: InstanceType<typeof Brokerage>;

  beforeEach(async () => {
    // 1. Active Brokerage A
    brokerageA = await Brokerage.create({
      name: 'Berlin Expat Mortgages GmbH',
      slug: 'berlin-expat-mortgages',
      plan: 'GROWTH',
      status: 'ACTIVE',
      webhookSecret: SECRET_A,
    });

    // 2. Active Brokerage B
    brokerageB = await Brokerage.create({
      name: 'Munich Expat Finance UG',
      slug: 'munich-expat-finance',
      plan: 'STARTER',
      status: 'ACTIVE',
      webhookSecret: SECRET_B,
    });

    // 3. Suspended Brokerage
    suspendedBrokerage = await Brokerage.create({
      name: 'Defunct Loans Corp',
      slug: 'defunct-loans',
      plan: 'STARTER',
      status: 'SUSPENDED',
      webhookSecret: 'secret-defunct',
    });
  });

  describe('1. Valid External Lead Ingestion', () => {
    it('should ingest a valid standard lead via x-webhook-secret header', async () => {
      const payload = {
        firstName: 'Maximilian',
        lastName: 'Weber',
        email: 'max.weber@example.de',
        phone: '+49 170 9988776',
        source: 'WEBSITE',
        score: 80,
        notes: 'Needs 450,000 EUR mortgage for Berlin Mitte apartment',
        customFields: {
          residencyStatus: 'EU_BLUE_CARD',
          downPayment: 90000,
        },
      };

      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.isDuplicate).toBe(false);
      expect(response.body.message).toContain('Lead ingested successfully');
      expect(response.body.data.email).toBe('max.weber@example.de');
      expect(response.body.data.status).toBe('NEW');
      expect(response.body.data.id).toBeDefined();

      // Verify in DB
      const leadInDb = await Lead.findById(response.body.data.id);
      expect(leadInDb).not.toBeNull();
      expect(leadInDb!.brokerageId.toString()).toBe(brokerageA._id.toString());
      expect(leadInDb!.status).toBe('NEW');
    });

    it('should ingest a valid lead via Bearer token authorization header', async () => {
      const payload = {
        firstName: 'Hanna',
        lastName: 'Arendt',
        email: 'hanna.arendt@example.de',
      };

      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('Authorization', `Bearer ${SECRET_A}`)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.isDuplicate).toBe(false);
      expect(response.body.data.email).toBe('hanna.arendt@example.de');
    });

    it('should ingest a valid lead via HMAC-SHA256 signature verification', async () => {
      const payload = {
        firstName: 'Ludwig',
        lastName: 'Wittgenstein',
        email: 'ludwig.wittgenstein@cambridge.ac.uk',
        source: 'CAMPAIGN',
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', SECRET_A)
        .update(payloadString, 'utf8')
        .digest('hex');

      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-signature-sha256', `sha256=${signature}`)
        .set('Content-Type', 'application/json')
        .send(payloadString);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('ludwig.wittgenstein@cambridge.ac.uk');
    });

    it('should ingest Typeform webhook format with custom field mapping', async () => {
      const typeformPayload = {
        event_id: 'evt_typeform_999',
        event_type: 'form_response',
        form_response: {
          form_id: 'berlin_mortgage_lead_gen',
          submitted_at: '2026-09-25T11:45:00Z',
          answers: [
            { field: { id: 'first_name', type: 'text' }, type: 'text', text: 'Friedrich' },
            { field: { id: 'last_name', type: 'text' }, type: 'text', text: 'Nietzsche' },
            { field: { id: 'email', type: 'email' }, type: 'email', email: 'nietzsche@basel.ch' },
            { field: { id: 'phone', type: 'phone_number' }, type: 'phone_number', phone_number: '+4122334455' },
          ],
          hidden: {
            utm_source: 'campaign',
          },
        },
      };

      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send(typeformPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('Friedrich');
      expect(response.body.data.lastName).toBe('Nietzsche');
      expect(response.body.data.email).toBe('nietzsche@basel.ch');
      expect(response.body.data.source).toBe('CAMPAIGN');
    });

    it('should support the /api/leads/ingest/:brokerageId endpoint alias', async () => {
      const payload = {
        firstName: 'Walter',
        lastName: 'Benjamin',
        email: 'walter.benjamin@example.de',
      };

      const response = await request(app)
        .post(`/api/leads/ingest/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send(payload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('walter.benjamin@example.de');
    });
  });

  describe('2. Authentication & Authorization Enforcement', () => {
    it('should reject webhook request when authentication is completely missing (401)', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .send({
          firstName: 'No',
          lastName: 'Auth',
          email: 'noauth@example.de',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject webhook request with invalid secret (401)', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', 'completely-wrong-secret')
        .send({
          firstName: 'Fake',
          lastName: 'Secret',
          email: 'fake@example.de',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject webhook request with invalid HMAC signature (401)', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-signature-sha256', 'sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
        .send({
          firstName: 'Bad',
          lastName: 'Signature',
          email: 'bad.sig@example.de',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject webhook request when target brokerage ID does not exist with 401 Unauthorized (enumeration defense)', async () => {
      const nonExistentId = new Types.ObjectId();

      const response = await request(app)
        .post(`/api/leads/webhook/${nonExistentId}`)
        .set('x-webhook-secret', SECRET_A)
        .send({
          firstName: 'Ghost',
          lastName: 'Tenant',
          email: 'ghost@example.de',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return uniform 401 Unauthorized for unauthenticated callers probing non-existent, suspended, or active IDs (anti-enumeration)', async () => {
      const nonExistentId = new Types.ObjectId();

      // Probe non-existent brokerage without credentials
      const resNonExistent = await request(app)
        .post(`/api/leads/webhook/${nonExistentId}`)
        .send({ firstName: 'Probe', lastName: 'NonExistent', email: 'probe1@example.de' });
      expect(resNonExistent.status).toBe(401);
      expect(resNonExistent.body.error.code).toBe('UNAUTHORIZED');

      // Probe suspended brokerage without credentials
      const resSuspended = await request(app)
        .post(`/api/leads/webhook/${suspendedBrokerage._id}`)
        .send({ firstName: 'Probe', lastName: 'Suspended', email: 'probe2@example.de' });
      expect(resSuspended.status).toBe(401);
      expect(resSuspended.body.error.code).toBe('UNAUTHORIZED');

      // Probe active brokerage without credentials
      const resActive = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .send({ firstName: 'Probe', lastName: 'Active', email: 'probe3@example.de' });
      expect(resActive.status).toBe(401);
      expect(resActive.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject webhook for suspended brokerage with 403 Forbidden only when valid secret is provided', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${suspendedBrokerage._id}`)
        .set('x-webhook-secret', 'secret-defunct')
        .send({
          firstName: 'Suspended',
          lastName: 'Brokerage',
          email: 'suspended@example.de',
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject webhook for suspended brokerage with 401 Unauthorized if secret is wrong', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${suspendedBrokerage._id}`)
        .set('x-webhook-secret', 'wrong-secret-for-suspended')
        .send({
          firstName: 'Suspended',
          lastName: 'Brokerage',
          email: 'suspended@example.de',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('3. Strict Tenant Ownership & Anti-Injection', () => {
    it('should never trust client-supplied brokerageId in the payload', async () => {
      // Attacker sends request to Brokerage A endpoint, but specifies Brokerage B's id in body
      const injectedPayload = {
        firstName: 'Trojan',
        lastName: 'Lead',
        email: 'trojan@example.de',
        brokerageId: brokerageB._id.toString(), // Attacker tries to inject into Brokerage B
      };

      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send(injectedPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify the lead is strictly owned by Brokerage A, not Brokerage B
      const lead = await Lead.findOne({ email: 'trojan@example.de' });
      expect(lead).not.toBeNull();
      expect(lead!.brokerageId.toString()).toBe(brokerageA._id.toString());
      expect(lead!.brokerageId.toString()).not.toBe(brokerageB._id.toString());

      // Ensure zero leads were injected into Brokerage B
      const countInB = await Lead.countDocuments({ brokerageId: brokerageB._id });
      expect(countInB).toBe(0);
    });

    it('should reject attempt to use Brokerage A secret against Brokerage B endpoint', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageB._id}`)
        .set('x-webhook-secret', SECRET_A) // Wrong secret for Brokerage B
        .send({
          firstName: 'Cross',
          lastName: 'Caller',
          email: 'cross@example.de',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('4. Duplicate Lead Detection & Idempotent Ingestion', () => {
    it('should handle repeated webhook delivery idempotently without creating duplicate leads', async () => {
      const payload = {
        firstName: 'Immanuel',
        lastName: 'Kant',
        email: 'immanuel.kant@koenigsberg.de',
        phone: '+49 170 5544332',
      };

      // 1. Initial ingestion (201 Created)
      const res1 = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.body.isDuplicate).toBe(false);
      const leadId = res1.body.data.id;

      // 2. Webhook retry / duplicate delivery (200 OK with isDuplicate: true)
      const res2 = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.isDuplicate).toBe(true);
      expect(res2.body.data.id).toBe(leadId);
      expect(res2.body.message).toContain('idempotently');

      // Database check: exactly 1 lead in DB
      const count = await Lead.countDocuments({
        brokerageId: brokerageA._id,
        email: 'immanuel.kant@koenigsberg.de',
      });
      expect(count).toBe(1);
    });

    it('should allow identical lead email in two different brokerages independently', async () => {
      const commonEmail = 'expat.applicant@berlin.de';
      const payload = {
        firstName: 'Arthur',
        lastName: 'Schopenhauer',
        email: commonEmail,
      };

      // Ingest for Brokerage A
      const resA = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send(payload);
      expect(resA.status).toBe(201);

      // Ingest for Brokerage B
      const resB = await request(app)
        .post(`/api/leads/webhook/${brokerageB._id}`)
        .set('x-webhook-secret', SECRET_B)
        .send(payload);
      expect(resB.status).toBe(201);

      expect(resA.body.data.id).not.toBe(resB.body.data.id);

      // Verify both leads exist under their respective brokerages
      const leadA = await Lead.findOne({ brokerageId: brokerageA._id, email: commonEmail });
      const leadB = await Lead.findOne({ brokerageId: brokerageB._id, email: commonEmail });
      expect(leadA).not.toBeNull();
      expect(leadB).not.toBeNull();
      expect(leadA!._id.toString()).not.toBe(leadB!._id.toString());
    });

    it('should detect an already-known Client and return 201 with isAlreadyKnown: true and knownAs: CLIENT', async () => {
      const assignedAdvisorId = new Types.ObjectId();
      const clientEmail = 'returning.client@expat-finance.de';

      // Seed existing client in Brokerage A
      const existingClient = await (await import('../../src/models/client.model.js')).Client.create({
        brokerageId: brokerageA._id,
        firstName: 'Gottfried',
        lastName: 'Leibniz',
        email: clientEmail,
        status: 'ACTIVE',
        type: 'BUYER',
        assignedTo: assignedAdvisorId,
      });

      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send({
          firstName: 'Gottfried',
          lastName: 'Leibniz',
          email: clientEmail,
          source: 'WEBSITE',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.isDuplicate).toBe(false);
      expect(response.body.isAlreadyKnown).toBe(true);
      expect(response.body.knownAs).toBe('CLIENT');
      expect(response.body.existingClientId).toBe(existingClient._id.toString());
      expect(response.body.message).toContain('Existing brokerage client recognized');

      // Verify DB state
      const lead = await Lead.findById(response.body.data.id);
      expect(lead).not.toBeNull();
      expect(lead!.assignedTo?.toString()).toBe(assignedAdvisorId.toString());
      const customFields = lead!.customFields instanceof Map
        ? Object.fromEntries(lead!.customFields)
        : (lead!.customFields as any);
      expect(customFields.alreadyKnown).toBe(true);
      expect(customFields.knownAs).toBe('CLIENT');
      expect(customFields.existingClientId).toBe(existingClient._id.toString());
    });

    it('should not detect already-known if client belongs to a different brokerage', async () => {
      const clientEmail = 'munich.client@expat-finance.de';

      // Seed existing client in Brokerage B
      await (await import('../../src/models/client.model.js')).Client.create({
        brokerageId: brokerageB._id,
        firstName: 'Johannes',
        lastName: 'Kepler',
        email: clientEmail,
        status: 'ACTIVE',
        type: 'BUYER',
      });

      // Ingest into Brokerage A
      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send({
          firstName: 'Johannes',
          lastName: 'Kepler',
          email: clientEmail,
          source: 'WEBSITE',
        });

      expect(response.status).toBe(201);
      expect(response.body.isDuplicate).toBe(false);
      expect(response.body.isAlreadyKnown).toBe(false);
      expect(response.body.knownAs).toBeNull();
      expect(response.body.existingClientId).toBeUndefined();
    });

    it('should safely handle concurrent duplicate webhook deliveries without creating duplicate leads', async () => {
      const concurrentEmail = 'concurrent.burst.lead@example.de';
      const payload = {
        firstName: 'Concurrent',
        lastName: 'Delivery',
        email: concurrentEmail,
        source: 'CAMPAIGN',
      };

      // Fire 10 concurrent webhook deliveries at the same time
      const responses = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          request(app)
            .post(`/api/leads/webhook/${brokerageA._id}`)
            .set('x-webhook-secret', SECRET_A)
            .send(payload)
        )
      );

      // All 10 requests should succeed (status 201 or 200)
      for (const res of responses) {
        expect([200, 201]).toContain(res.status);
        expect(res.body.success).toBe(true);
      }

      const createdResponses = responses.filter((r) => r.status === 201);
      const duplicateResponses = responses.filter((r) => r.status === 200);

      expect(createdResponses).toHaveLength(1);
      expect(duplicateResponses).toHaveLength(9);

      // All responses should reference the same lead ID
      const firstCreated = createdResponses[0]!;
      const leadId = firstCreated.body.data.id;
      for (const dup of duplicateResponses) {
        expect(dup.body.data.id).toBe(leadId);
        expect(dup.body.isDuplicate).toBe(true);
      }

      // MongoDB count check: exactly 1 lead in database
      const dbCount = await Lead.countDocuments({
        brokerageId: brokerageA._id,
        email: concurrentEmail,
      });
      expect(dbCount).toBe(1);
    });

    it('should handle a realistic burst of concurrent leads across multiple brokerages while preserving tenant isolation', async () => {
      const burstSize = 10;

      const requestsA = Array.from({ length: burstSize }).map((_, i) =>
        request(app)
          .post(`/api/leads/webhook/${brokerageA._id}`)
          .set('x-webhook-secret', SECRET_A)
          .send({
            firstName: `LeadA_${i}`,
            lastName: 'Expat',
            email: `lead.a.${i}@berlin.de`,
            source: 'WEBSITE',
          })
      );

      const requestsB = Array.from({ length: burstSize }).map((_, i) =>
        request(app)
          .post(`/api/leads/webhook/${brokerageB._id}`)
          .set('x-webhook-secret', SECRET_B)
          .send({
            firstName: `LeadB_${i}`,
            lastName: 'Expat',
            email: `lead.b.${i}@munich.de`,
            source: 'WEBSITE',
          })
      );

      // Execute all 20 requests concurrently
      const responses = await Promise.all([...requestsA, ...requestsB]);

      // All 20 should succeed with 201 Created
      for (const res of responses) {
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.isDuplicate).toBe(false);
      }

      // Check counts strictly scoped to each brokerage
      const countA = await Lead.countDocuments({ brokerageId: brokerageA._id, email: /^lead\.a\./ });
      const countB = await Lead.countDocuments({ brokerageId: brokerageB._id, email: /^lead\.b\./ });

      expect(countA).toBe(burstSize);
      expect(countB).toBe(burstSize);

      // Confirm zero cross-leakage
      const crossLeakA = await Lead.countDocuments({ brokerageId: brokerageA._id, email: /^lead\.b\./ });
      const crossLeakB = await Lead.countDocuments({ brokerageId: brokerageB._id, email: /^lead\.a\./ });

      expect(crossLeakA).toBe(0);
      expect(crossLeakB).toBe(0);
    });
  });

  describe('5. Input Validation & Error Responses', () => {
    it('should reject payload missing required email (400)', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send({
          firstName: 'No',
          lastName: 'Email',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject payload with invalid email address format (400)', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send({
          firstName: 'Bad',
          lastName: 'Email',
          email: 'invalid-email-address',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject payload with empty string firstName (400)', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send({
          firstName: '   ',
          lastName: 'ValidLast',
          email: 'test@example.de',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject payload exceeding notes maximum length (400)', async () => {
      const response = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .send({
          firstName: 'Long',
          lastName: 'Notes',
          email: 'notes@example.de',
          notes: 'A'.repeat(5001),
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('6. Tenant-Aware Ingestion Rate Limiting & High-Volume Bursts', () => {
    it('should handle a 500-request burst for a single brokerage without hitting the rate limiter', async () => {
      const burstCount = 500;
      const requests = Array.from({ length: burstCount }).map((_, i) =>
        request(app)
          .post(`/api/leads/webhook/${brokerageA._id}`)
          .set('x-webhook-secret', SECRET_A)
          .set('x-test-rate-limit', 'true')
          .set('x-test-rate-limit-max', '1000')
          .send({
            firstName: `BurstLead_${i}`,
            lastName: 'Expat',
            email: `burst.500.${i}@berlin-expat.de`,
            source: 'WEBSITE',
          })
      );

      const responses = await Promise.all(requests);
      expect(responses).toHaveLength(burstCount);

      // Verify all 500 succeeded with 201 Created (none throttled with 429)
      for (const res of responses) {
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      }

      const totalIngested = await Lead.countDocuments({
        brokerageId: brokerageA._id,
        email: /^burst\.500\./,
      });
      expect(totalIngested).toBe(burstCount);
    });

    it('should return 429 RATE_LIMIT_EXCEEDED when a brokerage exceeds its rate limit', async () => {
      const testMax = 5;
      const uniqueSuffix = Date.now();

      // First testMax requests succeed
      for (let i = 0; i < testMax; i++) {
        const res = await request(app)
          .post(`/api/leads/webhook/${brokerageA._id}`)
          .set('x-webhook-secret', SECRET_A)
          .set('x-test-rate-limit', 'true')
          .set('x-test-rate-limit-max', testMax.toString())
          .send({
            firstName: `RateLimit_${i}`,
            lastName: 'User',
            email: `ratelimit.${uniqueSuffix}.${i}@example.de`,
          });
        expect(res.status).toBe(201);
      }

      // Next request exceeding limit is throttled
      const throttledRes = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .set('x-test-rate-limit', 'true')
        .set('x-test-rate-limit-max', testMax.toString())
        .send({
          firstName: 'Excess',
          lastName: 'User',
          email: `excess.${uniqueSuffix}@example.de`,
        });

      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body.success).toBe(false);
      expect(throttledRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(throttledRes.body.error.message).toContain('Too many lead ingestion requests');
    });

    it('should ensure Brokerage A exhausting its rate limit does NOT throttle Brokerage B (noisy-brokerage isolation)', async () => {
      const testMax = 4;
      const uniqueSuffix = Date.now();

      // Exhaust Brokerage A limit
      for (let i = 0; i < testMax; i++) {
        await request(app)
          .post(`/api/leads/webhook/${brokerageA._id}`)
          .set('x-webhook-secret', SECRET_A)
          .set('x-test-rate-limit', 'true')
          .set('x-test-rate-limit-max', testMax.toString())
          .send({
            firstName: `ExhaustA_${i}`,
            lastName: 'User',
            email: `exhaust.a.${uniqueSuffix}.${i}@example.de`,
          });
      }

      // Brokerage A is now throttled
      const resAThrottled = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .set('x-test-rate-limit', 'true')
        .set('x-test-rate-limit-max', testMax.toString())
        .send({
          firstName: 'Blocked',
          lastName: 'User',
          email: `blocked.a.${uniqueSuffix}@example.de`,
        });
      expect(resAThrottled.status).toBe(429);
      expect(resAThrottled.body.error.code).toBe('RATE_LIMIT_EXCEEDED');

      // Brokerage B sends request from same test runner / IP
      const resB = await request(app)
        .post(`/api/leads/webhook/${brokerageB._id}`)
        .set('x-webhook-secret', SECRET_B)
        .set('x-test-rate-limit', 'true')
        .set('x-test-rate-limit-max', testMax.toString())
        .send({
          firstName: 'ActiveB',
          lastName: 'User',
          email: `active.b.${uniqueSuffix}@munich.de`,
        });

      // Brokerage B succeeds with 201 (isolated quota)
      expect(resB.status).toBe(201);
      expect(resB.body.success).toBe(true);
      expect(resB.body.data.email).toBe(`active.b.${uniqueSuffix}@munich.de`);
    });

    it('should reject unauthenticated requests with 401 without allowing rate limiter to bypass auth', async () => {
      // Unauthenticated request
      const resNoAuth = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-test-rate-limit', 'true')
        .set('x-test-rate-limit-max', '5')
        .send({
          firstName: 'Unauth',
          lastName: 'Caller',
          email: 'unauth.ratelimit@example.de',
        });

      expect(resNoAuth.status).toBe(401);
      expect(resNoAuth.body.error.code).toBe('UNAUTHORIZED');

      // Invalid secret
      const resWrongSecret = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', 'completely-wrong-secret')
        .set('x-test-rate-limit', 'true')
        .set('x-test-rate-limit-max', '5')
        .send({
          firstName: 'BadSecret',
          lastName: 'Caller',
          email: 'badsecret.ratelimit@example.de',
        });

      expect(resWrongSecret.status).toBe(401);
      expect(resWrongSecret.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should preserve duplicate detection and idempotency under rate-limited configuration', async () => {
      const commonEmail = `idempotent.ratelimit.${Date.now()}@example.de`;
      const payload = {
        firstName: 'Idempotent',
        lastName: 'RateLimit',
        email: commonEmail,
      };

      // First delivery -> 201 Created
      const res1 = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .set('x-test-rate-limit', 'true')
        .set('x-test-rate-limit-max', '1000')
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.body.isDuplicate).toBe(false);

      // Second delivery -> 200 OK with isDuplicate: true
      const res2 = await request(app)
        .post(`/api/leads/webhook/${brokerageA._id}`)
        .set('x-webhook-secret', SECRET_A)
        .set('x-test-rate-limit', 'true')
        .set('x-test-rate-limit-max', '1000')
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.isDuplicate).toBe(true);
      expect(res2.body.data.id).toBe(res1.body.data.id);
    });
  });
});
