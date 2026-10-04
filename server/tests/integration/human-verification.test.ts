import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User, Client, Document as DocumentModel } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';
import { processDocumentJob } from '../../src/queues/document.worker.js';

describe('Human Document Verification Integration Tests', () => {
  const DEFAULT_PASSWORD = 'Password123!';
  let passwordHash: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let platformAdmin: InstanceType<typeof User>;
  let brokerageAdminA: InstanceType<typeof User>;
  let advisorA: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;
  let clientA: InstanceType<typeof Client>;

  let advisorB: InstanceType<typeof User>;

  let tokenPlatformAdmin: string;
  let tokenBrokerageAdminA: string;
  let tokenAdvisorA: string;
  let tokenClientA: string;
  let tokenAdvisorB: string;

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Create Brokerages
    brokerageA = await Brokerage.create({
      name: 'Alpha Mortgages Ltd',
      slug: 'alpha-mortgages',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Beta Mortgages Ltd',
      slug: 'beta-mortgages',
      plan: 'STARTER',
      status: 'ACTIVE',
    });

    // 2. Create Users
    platformAdmin = await User.create({
      name: 'Platform Admin',
      email: 'superadmin@leadflow.test',
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    });

    brokerageAdminA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Alice Admin',
      email: 'admin@alpha.test',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
    });

    advisorA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Adam Advisor',
      email: 'advisor@alpha.test',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    clientUserA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Charlie Client',
      email: 'client@alpha.test',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    clientA = await Client.create({
      brokerageId: brokerageA._id,
      userId: clientUserA._id,
      firstName: 'Charlie',
      lastName: 'Client',
      email: 'client@alpha.test',
      status: 'ACTIVE',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Bob Advisor',
      email: 'advisor@beta.test',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    // 3. Generate Auth Tokens
    tokenPlatformAdmin = tokenService.generateAccessToken({
      userId: platformAdmin._id.toString(),
      email: platformAdmin.email,
      role: 'PLATFORM_ADMIN',
      brokerageId: null,
    });

    tokenBrokerageAdminA = tokenService.generateAccessToken({
      userId: brokerageAdminA._id.toString(),
      email: brokerageAdminA.email,
      role: 'BROKERAGE_ADMIN',
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdvisorA = tokenService.generateAccessToken({
      userId: advisorA._id.toString(),
      email: advisorA.email,
      role: 'ADVISOR',
      brokerageId: brokerageA._id.toString(),
    });

    tokenClientA = tokenService.generateAccessToken({
      userId: clientUserA._id.toString(),
      email: clientUserA.email,
      role: 'CLIENT',
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdvisorB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: 'ADVISOR',
      brokerageId: brokerageB._id.toString(),
    });
  });

  describe('1. Advisor Approval Flow', () => {
    it('allows an authorized advisor to approve a PENDING_REVIEW document', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Salary Slips 3M',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/payslip.pdf',
        type: 'PAYSLIP',
        status: 'PENDING_REVIEW',
      });

      const res = await request(app)
        .patch(`/api/documents/${doc._id}/review`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({
          status: 'VERIFIED',
          verificationNotes: 'All 3 salary slips verified against net bank credits.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document.status).toBe('VERIFIED');
      expect(res.body.data.document.verifiedBy).toBe(advisorA._id.toString());
      expect(res.body.data.document.verifiedAt).toBeDefined();
      expect(res.body.data.document.verificationNotes).toBe(
        'All 3 salary slips verified against net bank credits.'
      );

      const persisted = await DocumentModel.findById(doc._id);
      expect(persisted?.status).toBe('VERIFIED');
      expect(persisted?.verifiedBy?.toString()).toBe(advisorA._id.toString());
      expect(persisted?.verifiedAt).toBeInstanceOf(Date);
      expect(persisted?.__v).toBe(1);
    });

    it('allows BROKERAGE_ADMIN and PLATFORM_ADMIN to approve documents', async () => {
      const doc1 = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'PAN Card',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/pan.pdf',
        type: 'IDENTIFICATION',
        status: 'PENDING_REVIEW',
      });

      const resAdmin = await request(app)
        .patch(`/api/documents/${doc1._id}/review`)
        .set('Authorization', `Bearer ${tokenBrokerageAdminA}`)
        .send({ status: 'VERIFIED' });

      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.data.document.status).toBe('VERIFIED');

      const doc2 = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Bank Statement',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/statement.pdf',
        type: 'BANK_STATEMENT',
        status: 'PENDING_REVIEW',
      });

      const resPlatform = await request(app)
        .patch(`/api/documents/${doc2._id}/verify`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .send({ status: 'VERIFIED' });

      expect(resPlatform.status).toBe(200);
      expect(resPlatform.body.data.document.status).toBe('VERIFIED');
    });
  });

  describe('2. Advisor Rejection Flow', () => {
    it('allows an advisor to reject a document with mandatory rejection reason', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Blurry PAN Card Scan',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/pan_blurry.pdf',
        type: 'IDENTIFICATION',
        status: 'PENDING_REVIEW',
      });

      const res = await request(app)
        .patch(`/api/documents/${doc._id}/review`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({
          status: 'REJECTED',
          rejectionReason: 'Date of birth and PAN number are illegible.',
          verificationNotes: 'Please upload a 300 DPI clear color scan.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document.status).toBe('REJECTED');
      expect(res.body.data.document.rejectionReason).toBe('Date of birth and PAN number are illegible.');
      expect(res.body.data.document.verifiedBy).toBe(advisorA._id.toString());
      expect(res.body.data.document.verifiedAt).toBeDefined();

      const persisted = await DocumentModel.findById(doc._id);
      expect(persisted?.status).toBe('REJECTED');
      expect(persisted?.rejectionReason).toBe('Date of birth and PAN number are illegible.');
    });

    it('returns 400 ValidationError when rejecting without a rejection reason', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Document Missing Reason',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/doc.pdf',
        type: 'OTHER',
        status: 'PENDING_REVIEW',
      });

      const res = await request(app)
        .patch(`/api/documents/${doc._id}/review`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({
          status: 'REJECTED',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Rejection reason is required');
    });
  });

  describe('3. RBAC & IDOR Tenant Isolation', () => {
    it('blocks CLIENT users from reviewing documents with 403 Forbidden', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Client Self Review Attempt',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/self.pdf',
        type: 'IDENTIFICATION',
        status: 'PENDING_REVIEW',
      });

      const res = await request(app)
        .patch(`/api/documents/${doc._id}/review`)
        .set('Authorization', `Bearer ${tokenClientA}`)
        .send({ status: 'VERIFIED' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 NotFound when advisor from another brokerage attempts to review', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Alpha Secret Document',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/secret.pdf',
        type: 'CONTRACT',
        status: 'PENDING_REVIEW',
      });

      // Advisor B is from Brokerage B
      const res = await request(app)
        .patch(`/api/documents/${doc._id}/review`)
        .set('Authorization', `Bearer ${tokenAdvisorB}`)
        .send({ status: 'VERIFIED' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('4. Concurrency Protection & Stale Reviews', () => {
    it('returns 409 Conflict when attempting to review an already VERIFIED document', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Already Verified Doc',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/verified.pdf',
        type: 'IDENTIFICATION',
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: advisorA._id,
      });

      const res = await request(app)
        .patch(`/api/documents/${doc._id}/review`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({
          status: 'REJECTED',
          rejectionReason: 'Second thoughts',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('already reached terminal status');
    });

    it('returns 409 Conflict when expectedVersion does not match current document __v', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Versioned Document',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/versioned.pdf',
        type: 'BANK_STATEMENT',
        status: 'PENDING_REVIEW',
      });

      const res = await request(app)
        .patch(`/api/documents/${doc._id}/review`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({
          status: 'VERIFIED',
          expectedVersion: 99, // Stale version
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('modified by another process');
    });

    it('ensures worker does not overwrite a human review verdict', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Document with Concurrently Arriving Worker',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/race.pdf',
        type: 'PAYSLIP',
        status: 'PROCESSING',
      });

      // 1. Advisor reviews and approves the document first
      const res = await request(app)
        .patch(`/api/documents/${doc._id}/review`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ status: 'VERIFIED', verificationNotes: 'Human advisor approval' });

      expect(res.status).toBe(200);

      // 2. Delayed BullMQ worker completes its processing run
      const job = {
        id: `doc-verify-${doc._id}`,
        data: {
          documentId: doc._id.toString(),
          brokerageId: brokerageA._id.toString(),
          processingDelayMs: 0,
        },
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as any;

      const workerResult = await processDocumentJob(job);

      // 3. Document state is preserved; worker did not overwrite status or verifiedBy
      const after = await DocumentModel.findById(doc._id);
      expect(after?.status).toBe('VERIFIED');
      expect(after?.verifiedBy?.toString()).toBe(advisorA._id.toString());
      expect(after?.verificationNotes).toBe('Human advisor approval');
    });
  });
});
