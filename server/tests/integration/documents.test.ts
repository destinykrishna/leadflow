import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User, Lead, Client, Document as DocumentModel } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';
import { storageService } from '../../src/services/storage.service.js';

describe('Document Upload & Storage Foundation Integration Tests', () => {
  const DEFAULT_PASSWORD = 'Password123!';
  let passwordHash: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let platformAdmin: InstanceType<typeof User>;
  let brokerageAdminA: InstanceType<typeof User>;
  let advisorA: InstanceType<typeof User>;
  let clientUserA1: InstanceType<typeof User>;
  let clientUserA2: InstanceType<typeof User>;
  let clientA1: InstanceType<typeof Client>;
  let clientA2: InstanceType<typeof Client>;

  let advisorB: InstanceType<typeof User>;
  let clientUserB: InstanceType<typeof User>;
  let clientB: InstanceType<typeof Client>;

  let tokenPlatformAdmin: string;
  let tokenBrokerageAdminA: string;
  let tokenAdvisorA: string;
  let tokenClientA1: string;
  let tokenClientA2: string;
  let tokenAdvisorB: string;
  let tokenClientB: string;

  // Sample dummy PDF buffer (100 bytes)
  const dummyPdfBuffer = Buffer.from('%PDF-1.4 dummy pdf content for leadflow document tests');
  // Sample dummy PNG buffer
  const dummyPngBuffer = Buffer.from('\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR dummy png');

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Create Brokerages
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

    // 2. Create Users
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

    advisorA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Elena Schmidt',
      email: 'elena@berlin-expat.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    clientUserA1 = await User.create({
      brokerageId: brokerageA._id,
      name: 'Alex Expat 1',
      email: 'alex1@expat.de',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    clientUserA2 = await User.create({
      brokerageId: brokerageA._id,
      name: 'Maria Expat 2',
      email: 'maria2@expat.de',
      passwordHash,
      role: 'CLIENT',
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

    clientUserB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Johannes Expat B',
      email: 'johannes@expat-b.de',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    // 3. Create Clients
    clientA1 = await Client.create({
      brokerageId: brokerageA._id,
      userId: clientUserA1._id,
      firstName: 'Alex',
      lastName: 'Expat 1',
      email: clientUserA1.email,
      status: 'ACTIVE',
      assignedTo: advisorA._id,
    });

    clientA2 = await Client.create({
      brokerageId: brokerageA._id,
      userId: clientUserA2._id,
      firstName: 'Maria',
      lastName: 'Expat 2',
      email: clientUserA2.email,
      status: 'ACTIVE',
      assignedTo: advisorA._id,
    });

    clientB = await Client.create({
      brokerageId: brokerageB._id,
      userId: clientUserB._id,
      firstName: 'Johannes',
      lastName: 'Expat B',
      email: clientUserB.email,
      status: 'ACTIVE',
      assignedTo: advisorB._id,
    });

    // 4. Generate Tokens
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

    tokenAdvisorA = tokenService.generateAccessToken({
      userId: advisorA._id.toString(),
      email: advisorA.email,
      role: advisorA.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenClientA1 = tokenService.generateAccessToken({
      userId: clientUserA1._id.toString(),
      email: clientUserA1.email,
      role: clientUserA1.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenClientA2 = tokenService.generateAccessToken({
      userId: clientUserA2._id.toString(),
      email: clientUserA2.email,
      role: clientUserA2.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdvisorB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: advisorB.role,
      brokerageId: brokerageB._id.toString(),
    });

    tokenClientB = tokenService.generateAccessToken({
      userId: clientUserB._id.toString(),
      email: clientUserB.email,
      role: clientUserB.role,
      brokerageId: brokerageB._id.toString(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Successful Authorized Upload', () => {
    it('allows an ADVISOR to upload a document for a client in their brokerage', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .attach('file', dummyPdfBuffer, 'payslip_january.pdf')
        .field('type', 'PAYSLIP')
        .field('title', 'January 2026 Payslip')
        .field('clientId', clientA1._id.toString())
        .field('notes', 'Verified salary transfer');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document).toBeDefined();

      const doc = res.body.data.document;
      expect(doc.title).toBe('January 2026 Payslip');
      expect(doc.type).toBe('PAYSLIP');
      expect(doc.status).toBe('PENDING');
      expect(doc.brokerageId).toBe(brokerageA._id.toString());
      expect(doc.clientId).toBe(clientA1._id.toString());
      expect(doc.uploadedBy).toBe(advisorA._id.toString());
      expect(doc.fileUrl).toContain('payslip_january');
      expect(doc.fileKey).toBeDefined();

      // Verify stored in DB
      const dbDoc = await DocumentModel.findById(doc._id);
      expect(dbDoc).not.toBeNull();
      expect(dbDoc?.status).toBe('PENDING');
      expect(dbDoc?.fileSize).toBe(dummyPdfBuffer.length);
    });

    it('allows a BROKERAGE_ADMIN to upload a contract document', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenBrokerageAdminA}`)
        .attach('file', dummyPdfBuffer, 'purchase_contract.pdf')
        .field('type', 'CONTRACT')
        .field('clientId', clientA1._id.toString());

      expect(res.status).toBe(201);
      expect(res.body.data.document.type).toBe('CONTRACT');
      expect(res.body.data.document.brokerageId).toBe(brokerageA._id.toString());
    });

    it('allows an ADVISOR to upload a document tied to a lead before conversion', async () => {
      const lead = await Lead.create({
        brokerageId: brokerageA._id,
        firstName: 'Potential',
        lastName: 'Buyer',
        email: 'potential@gmail.com',
        status: 'QUALIFIED',
        source: 'WEBSITE',
      });

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .attach('file', dummyPngBuffer, 'id_card.png')
        .field('type', 'IDENTIFICATION')
        .field('leadId', lead._id.toString());

      expect(res.status).toBe(201);
      expect(res.body.data.document.leadId).toBe(lead._id.toString());
      expect(res.body.data.document.type).toBe('IDENTIFICATION');
    });
  });

  describe('2. CLIENT Uploading to Own Case', () => {
    it('allows CLIENT user to upload document to their own case without specifying clientId', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenClientA1}`)
        .attach('file', dummyPdfBuffer, 'my_passport.pdf')
        .field('type', 'IDENTIFICATION')
        .field('title', 'My German Passport');

      expect(res.status).toBe(201);
      const doc = res.body.data.document;
      expect(doc.title).toBe('My German Passport');
      expect(doc.type).toBe('IDENTIFICATION');
      expect(doc.clientId).toBe(clientA1._id.toString());
      expect(doc.uploadedBy).toBe(clientUserA1._id.toString());
      expect(doc.brokerageId).toBe(brokerageA._id.toString());
    });

    it('allows CLIENT user to provide their own clientId matching their profile', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenClientA1}`)
        .attach('file', dummyPdfBuffer, 'bank_statement.pdf')
        .field('type', 'BANK_STATEMENT')
        .field('clientId', clientA1._id.toString());

      expect(res.status).toBe(201);
      expect(res.body.data.document.clientId).toBe(clientA1._id.toString());
    });
  });

  describe('3. CLIENT Attempting Another Client Case (Anti-IDOR)', () => {
    it('strictly forbids CLIENT from uploading to another client case within the same brokerage (403)', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenClientA1}`)
        .attach('file', dummyPdfBuffer, 'malicious.pdf')
        .field('type', 'PAYSLIP')
        .field('clientId', clientA2._id.toString()); // Attempting clientA2's case!

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Clients may only upload documents to their own case');

      // Verify no document created
      const doc = await DocumentModel.findOne({ title: 'malicious.pdf' });
      expect(doc).toBeNull();
    });

    it('strictly blocks CLIENT from uploading to a client case in another brokerage (403)', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenClientA1}`)
        .attach('file', dummyPdfBuffer, 'cross_tenant_probe.pdf')
        .field('type', 'OTHER')
        .field('clientId', clientB._id.toString()); // Brokerage B client

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Cross-Brokerage Upload & Access Isolation', () => {
    it('returns 404 when an Advisor in Brokerage A attempts to upload for a Client in Brokerage B', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .attach('file', dummyPdfBuffer, 'doc_b.pdf')
        .field('clientId', clientB._id.toString());

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Client resource not found');
    });

    it('returns 404 when an Advisor in Brokerage A attempts to retrieve a document belonging to Brokerage B', async () => {
      const docB = await DocumentModel.create({
        brokerageId: brokerageB._id,
        clientId: clientB._id,
        uploadedBy: advisorB._id,
        title: 'Munich Secret Doc',
        fileUrl: 'https://ik.imagekit.io/mock/secret.pdf',
        fileKey: 'secret_key_b',
        fileSize: 1024,
        mimeType: 'application/pdf',
        type: 'CONTRACT',
        status: 'PENDING',
      });

      const res = await request(app)
        .get(`/api/documents/${docB._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Document resource not found');
    });
  });

  describe('5. Role Authorization & Authentication Guards', () => {
    it('returns 401 when uploading without authentication token', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .attach('file', dummyPdfBuffer, 'unauth.pdf');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when user is inactive or suspended', async () => {
      await User.findByIdAndUpdate(clientUserA1._id, { status: 'SUSPENDED' });

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenClientA1}`)
        .attach('file', dummyPdfBuffer, 'suspended.pdf');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('allows PLATFORM_ADMIN to upload a document to any brokerage client', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`)
        .attach('file', dummyPdfBuffer, 'admin_audit.pdf')
        .field('clientId', clientB._id.toString())
        .field('type', 'OTHER');

      expect(res.status).toBe(201);
      expect(res.body.data.document.brokerageId).toBe(brokerageB._id.toString());
    });
  });

  describe('6. Validation: Invalid Document Type & MIME Types', () => {
    it('rejects unsupported file MIME type (e.g. .exe / text/plain) with 400 ValidationError', async () => {
      const textBuffer = Buffer.from('plain text file');

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .attach('file', textBuffer, 'notes.txt');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Unsupported file format');
    });

    it('rejects invalid document type with 400 ValidationError', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .attach('file', dummyPdfBuffer, 'contract.pdf')
        .field('type', 'INVALID_TYPE_XYZ');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects request with missing file payload with 400 ValidationError', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .field('type', 'PAYSLIP');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('File is required');
    });
  });

  describe('7. Validation: Oversized Uploads', () => {
    it('rejects file exceeding 10MB limit with 400 ValidationError', async () => {
      // Create an 11MB buffer
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024, 0x61);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .attach('file', oversizedBuffer, 'huge_scan.pdf')
        .field('type', 'BANK_STATEMENT');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('exceeds maximum allowed limit');
    });
  });

  describe('8. ImageKit Storage Failure Handling', () => {
    it('handles storage provider failure gracefully without creating database record', async () => {
      // Mock storageService.uploadFile throwing an upstream error
      vi.spyOn(storageService, 'uploadFile').mockRejectedValueOnce(
        new Error('ImageKit network connection timeout')
      );

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .attach('file', dummyPdfBuffer, 'fail_upload.pdf')
        .field('type', 'PAYSLIP')
        .field('clientId', clientA1._id.toString());

      // Should return 500 without crashing
      expect(res.status).toBe(500);

      // Verify no document was saved in database
      const dbDoc = await DocumentModel.findOne({ title: 'fail_upload.pdf' });
      expect(dbDoc).toBeNull();
    });
  });

  describe('9. Database Failure Compensation Rollback', () => {
    it('invokes storage delete compensation when MongoDB document persistence fails', async () => {
      const deleteSpy = vi.spyOn(storageService, 'deleteFile');
      // Mock DocumentModel.create to throw a database connection or constraint error
      vi.spyOn(DocumentModel, 'create').mockRejectedValueOnce(
        new Error('MongoDB connection lost during write')
      );

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .attach('file', dummyPdfBuffer, 'rollback_test.pdf')
        .field('type', 'PAYSLIP')
        .field('clientId', clientA1._id.toString());

      expect(res.status).toBe(500);
      // Verify compensation rollback was invoked to delete the orphaned ImageKit file
      expect(deleteSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('10. Document Retrieval and Listing Authorization', () => {
    let docClientA1: InstanceType<typeof DocumentModel>;
    let docClientA2: InstanceType<typeof DocumentModel>;
    let docBrokerageB: InstanceType<typeof DocumentModel>;

    beforeEach(async () => {
      docClientA1 = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA1._id,
        uploadedBy: clientUserA1._id,
        title: 'Client A1 Payslip',
        fileUrl: 'https://ik.imagekit.io/mock/a1_payslip.pdf',
        fileKey: 'key_a1',
        fileSize: 2048,
        mimeType: 'application/pdf',
        type: 'PAYSLIP',
        status: 'PENDING',
      });

      docClientA2 = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA2._id,
        uploadedBy: clientUserA2._id,
        title: 'Client A2 Tax Return',
        fileUrl: 'https://ik.imagekit.io/mock/a2_tax.pdf',
        fileKey: 'key_a2',
        fileSize: 4096,
        mimeType: 'application/pdf',
        type: 'TAX_RETURN',
        status: 'VERIFIED',
      });

      docBrokerageB = await DocumentModel.create({
        brokerageId: brokerageB._id,
        clientId: clientB._id,
        uploadedBy: clientUserB._id,
        title: 'Client B Payslip',
        fileUrl: 'https://ik.imagekit.io/mock/b_payslip.pdf',
        fileKey: 'key_b',
        fileSize: 3000,
        mimeType: 'application/pdf',
        type: 'PAYSLIP',
        status: 'PENDING',
      });
    });

    it('allows ADVISOR to list documents for their brokerage with optional filters', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .query({ type: 'PAYSLIP' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toHaveLength(1);
      expect(res.body.data.documents[0]._id).toBe(docClientA1._id.toString());
    });

    it('allows CLIENT user to list ONLY documents belonging to their own case', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${tokenClientA1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.documents).toHaveLength(1);
      expect(res.body.data.documents[0]._id).toBe(docClientA1._id.toString());
      // Must not contain clientA2's document
      const ids = res.body.data.documents.map((d: any) => d._id);
      expect(ids).not.toContain(docClientA2._id.toString());
    });

    it('allows CLIENT user to retrieve their own document by ID', async () => {
      const res = await request(app)
        .get(`/api/documents/${docClientA1._id}`)
        .set('Authorization', `Bearer ${tokenClientA1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.document._id).toBe(docClientA1._id.toString());
      expect(res.body.data.document.title).toBe('Client A1 Payslip');
    });

    it('returns 404 when CLIENT attempts to retrieve another client document by ID', async () => {
      const res = await request(app)
        .get(`/api/documents/${docClientA2._id}`)
        .set('Authorization', `Bearer ${tokenClientA1}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 404 for malformed or non-existent document ID', async () => {
      const invalidId = 'not-a-valid-id';
      const nonExistentId = new Types.ObjectId().toString();

      const res1 = await request(app)
        .get(`/api/documents/${invalidId}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);
      expect(res1.status).toBe(404);

      const res2 = await request(app)
        .get(`/api/documents/${nonExistentId}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);
      expect(res2.status).toBe(404);
    });
  });

  describe('11. Security: Zero ImageKit Credentials Exposure', () => {
    it('never leaks ImageKit private keys or sensitive credentials in upload responses', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .attach('file', dummyPdfBuffer, 'safe_doc.pdf')
        .field('clientId', clientA1._id.toString());

      expect(res.status).toBe(201);
      const responseText = JSON.stringify(res.body);

      // Verify no sensitive keys leaked
      expect(responseText).not.toContain('privateKey');
      expect(responseText).not.toContain('mock-private-key');
      expect(responseText).not.toContain('IMAGEKIT');
    });

    it('never leaks ImageKit private keys in retrieval responses', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA1._id,
        uploadedBy: advisorA._id,
        title: 'Confidential Doc',
        fileUrl: 'https://ik.imagekit.io/mock/confidential.pdf',
        fileKey: 'key_confidential',
        fileSize: 1024,
        mimeType: 'application/pdf',
        type: 'CONTRACT',
        status: 'PENDING',
      });

      const res = await request(app)
        .get(`/api/documents/${doc._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(200);
      const responseText = JSON.stringify(res.body);
      expect(responseText).not.toContain('privateKey');
      expect(responseText).not.toContain('mock-private-key');
    });
  });
});
