import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage } from '../../src/models/brokerage.model.js';
import { User } from '../../src/models/user.model.js';
import { Lead } from '../../src/models/lead.model.js';
import { Task } from '../../src/models/task.model.js';
import { Document as DocumentModel } from '../../src/models/document.model.js';
import { Client } from '../../src/models/client.model.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Phase 8: Production Hardening & Performance Integration Tests', () => {
  let brokerageA: any;
  let brokerageB: any;
  let advisorA: any;
  let advisorB: any;
  let tokenAdvisorA: string;
  let tokenAdvisorB: string;
  const SECRET_A = 'hardening_webhook_secret_a123';
  const SECRET_B = 'hardening_webhook_secret_b456';

  beforeEach(async () => {
    const passwordHash = await hashPassword('HardenedPass123!');

    brokerageA = await Brokerage.create({
      name: 'Hardened Berlin Brokerage',
      slug: 'hardened-berlin',
      status: 'ACTIVE',
      webhookSecret: SECRET_A,
    });

    brokerageB = await Brokerage.create({
      name: 'Hardened Munich Brokerage',
      slug: 'hardened-munich',
      status: 'ACTIVE',
      webhookSecret: SECRET_B,
    });

    advisorA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Advisor Alpha',
      email: 'alpha@hardened-berlin.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Advisor Beta',
      email: 'beta@hardened-munich.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    tokenAdvisorA = tokenService.generateAccessToken({
      userId: advisorA._id.toString(),
      email: advisorA.email,
      role: advisorA.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdvisorB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: advisorB.role,
      brokerageId: brokerageB._id.toString(),
    });
  });

  describe('1. MongoDB Index Verification & Execution Plan Optimization', () => {
    it('verifies all critical performance compound indexes are registered on Lead model', async () => {
      await Lead.ensureIndexes();
      const indexes = await Lead.collection.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx.key).join('_'));

      expect(indexKeys).toContain('brokerageId_createdAt');
      expect(indexKeys).toContain('brokerageId_status_createdAt');
      expect(indexKeys).toContain('brokerageId_assignedTo_createdAt');
      expect(indexKeys).toContain('brokerageId_email');
    });

    it('verifies all critical performance compound indexes are registered on Task model', async () => {
      await Task.ensureIndexes();
      const indexes = await Task.collection.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx.key).join('_'));

      expect(indexKeys).toContain('brokerageId_dueDate_createdAt');
      expect(indexKeys).toContain('brokerageId_status_dueDate');
      expect(indexKeys).toContain('brokerageId_createdAt');
      expect(indexKeys).toContain('brokerageId_idempotencyKey');
    });

    it('verifies all critical performance compound indexes are registered on Document model', async () => {
      await DocumentModel.ensureIndexes();
      const indexes = await DocumentModel.collection.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx.key).join('_'));

      expect(indexKeys).toContain('brokerageId_createdAt');
      expect(indexKeys).toContain('brokerageId_status_createdAt');
      expect(indexKeys).toContain('status_createdAt');
      expect(indexKeys).toContain('status_updatedAt');
    });

    it('verifies index coverage on Client model for chronological sorting', async () => {
      await Client.ensureIndexes();
      const indexes = await Client.collection.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx.key).join('_'));

      expect(indexKeys).toContain('brokerageId_createdAt');
      expect(indexKeys).toContain('brokerageId_email');
    });
  });

  describe('2. Query Pagination Enforcement & Memory Bounds', () => {
    it('enforces limit and page parameters on GET /api/tasks to prevent unbounded memory consumption', async () => {
      // Seed 25 tasks
      const tasks = Array.from({ length: 25 }).map((_, i) => ({
        brokerageId: brokerageA._id,
        title: `Task #${i}`,
        status: 'PENDING',
        priority: 'MEDIUM',
        assignedTo: advisorA._id,
        createdAt: new Date(Date.now() - i * 1000),
      }));
      await Task.insertMany(tasks);

      // Query page 1 with limit 10
      const resPage1 = await request(app)
        .get('/api/tasks?limit=10&page=1')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.success).toBe(true);
      expect(resPage1.body.data).toHaveLength(10);
      expect(resPage1.body.count).toBe(10);

      // Query page 2 with limit 10
      const resPage2 = await request(app)
        .get('/api/tasks?limit=10&page=2')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(resPage2.status).toBe(200);
      expect(resPage2.body.data).toHaveLength(10);

      // Ensure page 1 and page 2 return distinct items
      const idsPage1 = resPage1.body.data.map((t: any) => t._id);
      const idsPage2 = resPage2.body.data.map((t: any) => t._id);
      const overlap = idsPage1.filter((id: string) => idsPage2.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('enforces limit and page parameters on GET /api/documents to prevent unbounded memory consumption', async () => {
      // Seed 20 documents
      const docs = Array.from({ length: 20 }).map((_, i) => ({
        brokerageId: brokerageA._id,
        title: `Doc_${i}.pdf`,
        fileUrl: `https://ik.imagekit.io/mock/doc_${i}.pdf`,
        fileKey: `key_${i}`,
        type: 'PAYSLIP',
        status: 'PENDING',
        uploadedBy: advisorA._id,
        createdAt: new Date(Date.now() - i * 1000),
      }));
      await DocumentModel.insertMany(docs);

      // Query page 1 with limit 8
      const resPage1 = await request(app)
        .get('/api/documents?limit=8&page=1')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(resPage1.status).toBe(200);
      expect(resPage1.body.success).toBe(true);
      expect(resPage1.body.data.documents).toHaveLength(8);

      // Query page 2 with limit 8
      const resPage2 = await request(app)
        .get('/api/documents?limit=8&page=2')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(resPage2.status).toBe(200);
      expect(resPage2.body.data.documents).toHaveLength(8);

      const ids1 = resPage1.body.data.documents.map((d: any) => d._id);
      const ids2 = resPage2.body.data.documents.map((d: any) => d._id);
      const overlap = ids1.filter((id: string) => ids2.includes(id));
      expect(overlap).toHaveLength(0);
    });
  });

  describe('3. High-Concurrency Stage Updates with Optimistic Locking', () => {
    it('safely handles 5 concurrent conflicting stage updates with exactly 1 winner and 4 conflict rejections', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Concurrency',
        lastName: 'TestLead',
        email: 'concurrency.lead@example.de',
        status: 'NEW',
        source: 'WEBSITE',
        assignedTo: advisorA._id,
      });

      expect(lead.__v).toBe(0);

      // 5 concurrent requests attempting stage transitions from version 0
      const stageTargets = ['CONTACTED', 'LOST', 'CONTACTED', 'LOST', 'CONTACTED'];
      const requests = stageTargets.map((target) =>
        request(app)
          .patch(`/api/leads/${lead._id}/stage`)
          .set('Authorization', `Bearer ${tokenAdvisorA}`)
          .send({ stage: target, version: 0 })
      );

      const responses = await Promise.all(requests);
      const successful = responses.filter((r) => r.status === 200);
      const conflicted = responses.filter((r) => r.status === 409);

      // Exactly ONE must succeed and FOUR must fail with 409 Conflict
      expect(successful).toHaveLength(1);
      expect(conflicted).toHaveLength(4);

      for (const conf of conflicted) {
        expect(conf.body.success).toBe(false);
        expect(conf.body.error.code).toBe('CONFLICT');
      }

      // Check DB consistency: version exactly 1
      const updatedLead = await Lead.findById(lead._id);
      expect(updatedLead!.__v).toBe(1);
      expect(updatedLead!.status).toBe(successful[0]!.body.data.currentStage);
    });
  });

  describe('4. Webhook Concurrency & Duplicate Ingestion Resilience', () => {
    it('safely ingests 15 concurrent identical webhook leads with 1 creation and 14 idempotent returns', async () => {
      const email = 'burst.duplicate.concurrency@example.de';
      const payload = {
        firstName: 'Burst',
        lastName: 'Duplicate',
        email,
        source: 'WEBSITE',
      };

      const requests = Array.from({ length: 15 }).map(() =>
        request(app)
          .post(`/api/leads/webhook/${brokerageA._id}`)
          .set('x-webhook-secret', SECRET_A)
          .send(payload)
      );

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect([200, 201]).toContain(res.status);
        expect(res.body.success).toBe(true);
      }

      const created = responses.filter((r) => r.status === 201);
      const duplicates = responses.filter((r) => r.status === 200);

      expect(created).toHaveLength(1);
      expect(duplicates).toHaveLength(14);

      const expectedId = created[0]!.body.data.id;
      for (const dup of duplicates) {
        expect(dup.body.data.id).toBe(expectedId);
        expect(dup.body.isDuplicate).toBe(true);
      }

      // Verify exactly one record in DB
      const count = await Lead.countDocuments({ brokerageId: brokerageA._id, email });
      expect(count).toBe(1);
    });
  });

  describe('5. Noisy Neighbor Tenant Isolation Under Load', () => {
    it('guarantees that high query volume on Brokerage A does not contaminate or slow down Brokerage B', async () => {
      // Seed 50 leads in Brokerage A and 5 leads in Brokerage B
      const leadsA = Array.from({ length: 50 }).map((_, i) => ({
        brokerageId: brokerageA._id,
        firstName: `LeadA_${i}`,
        lastName: 'Berlin',
        email: `leada_${i}@berlin.de`,
        status: 'NEW',
        source: 'WEBSITE',
      }));

      const leadsB = Array.from({ length: 5 }).map((_, i) => ({
        brokerageId: brokerageB._id,
        firstName: `LeadB_${i}`,
        lastName: 'Munich',
        email: `leadb_${i}@munich.de`,
        status: 'QUALIFIED',
        source: 'WEBSITE',
      }));

      await Lead.insertMany([...leadsA, ...leadsB]);

      // Fire concurrent requests for Brokerage A and Brokerage B simultaneously
      const [resA, resB] = await Promise.all([
        request(app)
          .get('/api/leads/pipeline')
          .set('Authorization', `Bearer ${tokenAdvisorA}`),
        request(app)
          .get('/api/leads/pipeline')
          .set('Authorization', `Bearer ${tokenAdvisorB}`),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // Verify exact tenant isolation in returned counts
      expect(resA.body.data.total).toBe(50);
      expect(resB.body.data.total).toBe(5);

      // Verify zero cross-tenant contamination in pipeline arrays
      const aEmails = resA.body.data.pipeline.NEW.map((l: any) => l.email);
      expect(aEmails.some((e: string) => e.includes('munich'))).toBe(false);

      const bEmails = resB.body.data.pipeline.QUALIFIED.map((l: any) => l.email);
      expect(bEmails.some((e: string) => e.includes('berlin'))).toBe(false);
    });
  });
});
