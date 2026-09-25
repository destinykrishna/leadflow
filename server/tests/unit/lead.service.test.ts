import { describe, it, expect, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { Brokerage, Lead } from '../../src/models/index.js';
import {
  normalizeIncomingLeadPayload,
  standardLeadPayloadSchema,
} from '../../src/validators/lead.validators.js';
import { leadRepository } from '../../src/repositories/lead.repository.js';
import { leadIngestionService } from '../../src/services/lead-ingestion.service.js';
import { ValidationError, BrokerageIsolationError } from '../../src/utils/errors.js';

describe('Lead Ingestion Service & Validator Unit Tests', () => {
  let brokerageAId: Types.ObjectId;
  let brokerageBId: Types.ObjectId;

  beforeEach(async () => {
    const brokerageA = await Brokerage.create({
      name: 'Berlin Expat Mortgages',
      slug: 'berlin-expat',
      status: 'ACTIVE',
    });
    brokerageAId = brokerageA._id as Types.ObjectId;

    const brokerageB = await Brokerage.create({
      name: 'Munich Home Loans',
      slug: 'munich-home',
      status: 'ACTIVE',
    });
    brokerageBId = brokerageB._id as Types.ObjectId;
  });

  describe('1. Payload Validation & Normalization', () => {
    it('should successfully normalize a valid standard lead payload', () => {
      const input = {
        firstName: '  Thomas  ',
        lastName: '  Mann  ',
        email: '  Thomas.Mann@Example.DE  ',
        phone: '+49 170 1234567',
        source: 'CAMPAIGN',
        score: 45,
        notes: 'Interested in Frankfurt residential property loan',
        customFields: { propertyValue: 500000 },
      };

      const normalized = normalizeIncomingLeadPayload(input);

      expect(normalized.firstName).toBe('Thomas');
      expect(normalized.lastName).toBe('Mann');
      expect(normalized.email).toBe('thomas.mann@example.de');
      expect(normalized.phone).toBe('+49 170 1234567');
      expect(normalized.source).toBe('CAMPAIGN');
      expect(normalized.score).toBe(45);
      expect(normalized.notes).toBe('Interested in Frankfurt residential property loan');
      expect(normalized.customFields).toEqual({ propertyValue: 500000 });
    });

    it('should assign defaults for optional fields', () => {
      const input = {
        firstName: 'Anna',
        lastName: 'Frank',
        email: 'anna.frank@example.de',
      };

      const normalized = normalizeIncomingLeadPayload(input);

      expect(normalized.source).toBe('WEBSITE');
      expect(normalized.score).toBe(0);
      expect(normalized.phone).toBeUndefined();
      expect(normalized.notes).toBeUndefined();
    });

    it('should never trust or include client-supplied brokerageId in normalized data', () => {
      const maliciousPayload = {
        firstName: 'Attacker',
        lastName: 'Injected',
        email: 'attacker@evil.com',
        brokerageId: new Types.ObjectId().toString(),
      };

      const normalized = normalizeIncomingLeadPayload(maliciousPayload);

      expect((normalized as any).brokerageId).toBeUndefined();
    });

    it('should throw ValidationError on missing required fields', () => {
      expect(() =>
        normalizeIncomingLeadPayload({ firstName: 'Solo' })
      ).toThrow(ValidationError);

      expect(() =>
        normalizeIncomingLeadPayload({
          firstName: 'Solo',
          lastName: 'Name',
          // missing email
        })
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError on invalid email format', () => {
      expect(() =>
        normalizeIncomingLeadPayload({
          firstName: 'John',
          lastName: 'Doe',
          email: 'not-a-valid-email',
        })
      ).toThrow(ValidationError);
    });

    it('should throw ValidationError on malformed non-object payload', () => {
      expect(() => normalizeIncomingLeadPayload(null)).toThrow(ValidationError);
      expect(() => normalizeIncomingLeadPayload('invalid-string')).toThrow(ValidationError);
    });

    it('should parse and normalize a Typeform webhook payload', () => {
      const typeformPayload = {
        event_id: 'evt_01HXYZ987',
        event_type: 'form_response',
        form_response: {
          form_id: 'expat_mortgage_inquiry',
          submitted_at: '2026-09-25T10:30:00Z',
          answers: [
            {
              field: { id: 'first_name', type: 'text' },
              type: 'text',
              text: 'Klaus',
            },
            {
              field: { id: 'last_name', type: 'text' },
              type: 'text',
              text: 'Kinski',
            },
            {
              field: { id: 'email_field', type: 'email' },
              type: 'email',
              email: 'klaus.kinski@example.de',
            },
            {
              field: { id: 'phone_field', type: 'phone_number' },
              type: 'phone_number',
              phone_number: '+491712345678',
            },
            {
              field: { id: 'loan_amount', type: 'number' },
              type: 'number',
              number: 350000,
            },
          ],
          hidden: {
            utm_source: 'campaign',
          },
        },
      };

      const normalized = normalizeIncomingLeadPayload(typeformPayload);

      expect(normalized.firstName).toBe('Klaus');
      expect(normalized.lastName).toBe('Kinski');
      expect(normalized.email).toBe('klaus.kinski@example.de');
      expect(normalized.phone).toBe('+491712345678');
      expect(normalized.source).toBe('CAMPAIGN');
      expect(normalized.customFields?.provider).toBe('TYPEFORM');
      expect(normalized.customFields?.eventId).toBe('evt_01HXYZ987');
      expect(normalized.customFields?.loan_amount).toBe(350000);
    });

    it('should split single full name field in Typeform payload if first/last not specified', () => {
      const typeformPayload = {
        event_type: 'form_response',
        form_response: {
          form_id: 'simple_form',
          answers: [
            {
              field: { id: 'full_name', type: 'text' },
              type: 'text',
              text: 'Wolfgang Amadeus Mozart',
            },
            {
              field: { id: 'email_addr', type: 'email' },
              type: 'email',
              email: 'mozart@salzburg.at',
            },
          ],
        },
      };

      const normalized = normalizeIncomingLeadPayload(typeformPayload);

      expect(normalized.firstName).toBe('Wolfgang');
      expect(normalized.lastName).toBe('Amadeus Mozart');
      expect(normalized.email).toBe('mozart@salzburg.at');
      expect(normalized.source).toBe('WEBSITE');
    });

    it('should reject Typeform payload if email answer is missing', () => {
      const typeformPayload = {
        event_type: 'form_response',
        form_response: {
          form_id: 'missing_email',
          answers: [
            {
              field: { id: 'full_name', type: 'text' },
              type: 'text',
              text: 'Anonymous Expat',
            },
          ],
        },
      };

      expect(() => normalizeIncomingLeadPayload(typeformPayload)).toThrow(
        /Typeform payload missing required email answer/
      );
    });
  });

  describe('2. Deterministic Duplicate Detection & Idempotent Ingestion', () => {
    it('should ingest a brand new lead with pipeline starting state NEW', async () => {
      const rawPayload = {
        firstName: 'Sophie',
        lastName: 'Scholl',
        email: 'sophie.scholl@example.de',
        phone: '+4989123456',
        source: 'WEBSITE',
      };

      const result = await leadIngestionService.processIngestion(
        brokerageAId,
        rawPayload
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.lead._id).toBeDefined();
      expect(result.lead.status).toBe('NEW');
      expect(result.lead.email).toBe('sophie.scholl@example.de');
      expect(result.lead.brokerageId.toString()).toBe(brokerageAId.toString());

      const count = await Lead.countDocuments({ brokerageId: brokerageAId });
      expect(count).toBe(1);
    });

    it('should idempotently return existing lead when duplicate delivery occurs within same brokerage', async () => {
      const rawPayload = {
        firstName: 'Sophie',
        lastName: 'Scholl',
        email: 'sophie.scholl@example.de',
        phone: '+4989123456',
        source: 'WEBSITE',
      };

      // First delivery
      const firstResult = await leadIngestionService.processIngestion(
        brokerageAId,
        rawPayload
      );
      expect(firstResult.isDuplicate).toBe(false);

      // Repeated delivery (e.g. webhook retry)
      const secondResult = await leadIngestionService.processIngestion(
        brokerageAId,
        rawPayload
      );

      expect(secondResult.isDuplicate).toBe(true);
      expect(secondResult.lead._id.toString()).toBe(firstResult.lead._id.toString());
      expect(secondResult.lead.email).toBe('sophie.scholl@example.de');

      // Database should still only have 1 lead
      const count = await Lead.countDocuments({ brokerageId: brokerageAId });
      expect(count).toBe(1);
    });

    it('should allow identical email to exist in two different brokerages independently', async () => {
      const leadEmail = 'expat.applicant@example.de';

      const payload = {
        firstName: 'Max',
        lastName: 'Mustermann',
        email: leadEmail,
        source: 'WEBSITE',
      };

      // Ingest for Brokerage A
      const resultA = await leadIngestionService.processIngestion(brokerageAId, payload);
      expect(resultA.isDuplicate).toBe(false);
      expect(resultA.lead.brokerageId.toString()).toBe(brokerageAId.toString());

      // Ingest for Brokerage B
      const resultB = await leadIngestionService.processIngestion(brokerageBId, payload);
      expect(resultB.isDuplicate).toBe(false);
      expect(resultB.lead.brokerageId.toString()).toBe(brokerageBId.toString());

      expect(resultA.lead._id.toString()).not.toBe(resultB.lead._id.toString());

      // Each brokerage has exactly 1 lead
      expect(await Lead.countDocuments({ brokerageId: brokerageAId })).toBe(1);
      expect(await Lead.countDocuments({ brokerageId: brokerageBId })).toBe(1);
    });

    it('should throw BrokerageIsolationError when brokerageId is missing', async () => {
      await expect(
        leadRepository.ingestLead(
          '' as any,
          {
            firstName: 'No',
            lastName: 'Tenant',
            email: 'notenant@example.de',
            source: 'WEBSITE',
            score: 0,
          }
        )
      ).rejects.toThrow(BrokerageIsolationError);
    });

    it('should detect when a new lead is a person the brokerage already knows as an existing Client', async () => {
      const assignedAdvisorId = new Types.ObjectId();
      const clientEmail = 'known.client@expat-finance.de';

      // Seed existing client in Brokerage A
      const existingClient = await (await import('../../src/models/client.model.js')).Client.create({
        brokerageId: brokerageAId,
        firstName: 'Heinrich',
        lastName: 'Heine',
        email: clientEmail,
        status: 'ACTIVE',
        type: 'BUYER',
        assignedTo: assignedAdvisorId,
      });

      const result = await leadIngestionService.processIngestion(brokerageAId, {
        firstName: 'Heinrich',
        lastName: 'Heine',
        email: clientEmail,
        source: 'WEBSITE',
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.isAlreadyKnown).toBe(true);
      expect(result.knownAs).toBe('CLIENT');
      expect(result.existingClientId).toBe(existingClient._id.toString());
      expect(result.lead.assignedTo?.toString()).toBe(assignedAdvisorId.toString());
      const customFields = result.lead.customFields instanceof Map
        ? Object.fromEntries(result.lead.customFields)
        : (result.lead.customFields as any);
      expect(customFields.alreadyKnown).toBe(true);
      expect(customFields.knownAs).toBe('CLIENT');
      expect(customFields.existingClientId).toBe(existingClient._id.toString());
    });

    it('should not detect a person as already known if they are a client of a DIFFERENT brokerage', async () => {
      const clientEmail = 'other.brokerage.client@example.de';

      // Seed client in Brokerage B
      await (await import('../../src/models/client.model.js')).Client.create({
        brokerageId: brokerageBId,
        firstName: 'Georg',
        lastName: 'Buechner',
        email: clientEmail,
        status: 'ACTIVE',
        type: 'BUYER',
      });

      // Ingest into Brokerage A
      const result = await leadIngestionService.processIngestion(brokerageAId, {
        firstName: 'Georg',
        lastName: 'Buechner',
        email: clientEmail,
        source: 'WEBSITE',
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.isAlreadyKnown).toBe(false);
      expect(result.knownAs).toBeNull();
      expect(result.existingClientId).toBeUndefined();
    });

    it('should handle concurrent duplicate lead submissions without crashing or creating duplicates (race condition)', async () => {
      const concurrentEmail = 'race.condition.lead@example.de';
      const rawPayload = {
        firstName: 'Concurrent',
        lastName: 'Applicant',
        email: concurrentEmail,
        source: 'WEBSITE',
      };

      // Launch 10 concurrent requests at the exact same millisecond
      const results = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          leadIngestionService.processIngestion(brokerageAId, rawPayload)
        )
      );

      // Verify that all 10 resolved cleanly
      expect(results).toHaveLength(10);

      // Exactly 1 should be isDuplicate: false, and 9 should be isDuplicate: true
      const createdCount = results.filter((r) => !r.isDuplicate).length;
      const duplicateCount = results.filter((r) => r.isDuplicate).length;
      expect(createdCount).toBe(1);
      expect(duplicateCount).toBe(9);

      // All 10 returned the exact same MongoDB lead _id
      const leadIds = new Set(results.map((r) => r.lead._id.toString()));
      expect(leadIds.size).toBe(1);

      // Exactly 1 lead document exists in database
      const dbCount = await Lead.countDocuments({
        brokerageId: brokerageAId,
        email: concurrentEmail,
      });
      expect(dbCount).toBe(1);
    });
  });
});
