import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { Brokerage, User, Client, Document as DocumentModel } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';

describe('Brokerage Isolation, RBAC & IDOR Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let platformAdmin: InstanceType<typeof User>;
  let brokerageAdminA: InstanceType<typeof User>;
  let advisorA: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;
  let clientUserA2: InstanceType<typeof User>;

  let brokerageAdminB: InstanceType<typeof User>;
  let advisorB: InstanceType<typeof User>;
  let clientUserB: InstanceType<typeof User>;

  let clientRecordA: InstanceType<typeof Client>;
  let clientRecordA2: InstanceType<typeof Client>;
  let clientRecordB: InstanceType<typeof Client>;

  let documentA: InstanceType<typeof DocumentModel>;
  let documentA2: InstanceType<typeof DocumentModel>;
  let documentB: InstanceType<typeof DocumentModel>;

  let tokenPlatformAdmin: string;
  let tokenBrokerageAdminA: string;
  let tokenAdvisorA: string;
  let tokenClientA: string;
  let tokenClientA2: string;
  let tokenBrokerageAdminB: string;
  let tokenAdvisorB: string;
  let tokenClientB: string;

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

    // 2. Platform Admin (system-level)
    platformAdmin = await User.create({
      name: 'Platform Superadmin',
      email: 'admin@leadflow-platform.com',
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    });

    // 3. Brokerage A Users
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

    clientUserA = await User.create({
      brokerageId: brokerageA._id,
      name: 'Alex Expat',
      email: 'alex@expat.de',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    clientUserA2 = await User.create({
      brokerageId: brokerageA._id,
      name: 'Maria Garcia',
      email: 'maria@expat.de',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    // 4. Brokerage B Users
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

    clientUserB = await User.create({
      brokerageId: brokerageB._id,
      name: 'John Smith',
      email: 'john@munich-client.de',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    // 5. Client Profiles
    clientRecordA = await Client.create({
      brokerageId: brokerageA._id,
      userId: clientUserA._id,
      firstName: 'Alex',
      lastName: 'Expat',
      email: clientUserA.email,
      phone: '+49 170 1111111',
      status: 'ACTIVE',
      type: 'BUYER',
      assignedTo: advisorA._id,
    });

    clientRecordA2 = await Client.create({
      brokerageId: brokerageA._id,
      userId: clientUserA2._id,
      firstName: 'Maria',
      lastName: 'Garcia',
      email: clientUserA2.email,
      phone: '+49 170 2222222',
      status: 'ACTIVE',
      type: 'BUYER',
      assignedTo: advisorA._id,
    });

    clientRecordB = await Client.create({
      brokerageId: brokerageB._id,
      userId: clientUserB._id,
      firstName: 'John',
      lastName: 'Smith',
      email: clientUserB.email,
      phone: '+49 170 3333333',
      status: 'ACTIVE',
      type: 'BUYER',
      assignedTo: advisorB._id,
    });

    // 6. Documents
    documentA = await DocumentModel.create({
      brokerageId: brokerageA._id,
      title: 'Alex March 2026 Payslip',
      fileUrl: 'https://storage.internal/payslip_alex.pdf',
      type: 'PAYSLIP',
      status: 'PENDING',
      uploadedBy: clientUserA._id,
      clientId: clientRecordA._id,
    });

    documentA2 = await DocumentModel.create({
      brokerageId: brokerageA._id,
      title: 'Maria Bank Statement',
      fileUrl: 'https://storage.internal/statement_maria.pdf',
      type: 'BANK_STATEMENT',
      status: 'PENDING',
      uploadedBy: clientUserA2._id,
      clientId: clientRecordA2._id,
    });

    documentB = await DocumentModel.create({
      brokerageId: brokerageB._id,
      title: 'John ID Document',
      fileUrl: 'https://storage.internal/id_john.pdf',
      type: 'IDENTIFICATION',
      status: 'PENDING',
      uploadedBy: clientUserB._id,
      clientId: clientRecordB._id,
    });

    // 7. Generate Access Tokens
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

    tokenClientA = tokenService.generateAccessToken({
      userId: clientUserA._id.toString(),
      email: clientUserA.email,
      role: clientUserA.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenClientA2 = tokenService.generateAccessToken({
      userId: clientUserA2._id.toString(),
      email: clientUserA2.email,
      role: clientUserA2.role,
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

    tokenClientB = tokenService.generateAccessToken({
      userId: clientUserB._id.toString(),
      email: clientUserB.email,
      role: clientUserB.role,
      brokerageId: brokerageB._id.toString(),
    });
  });

  describe('1. Role-Based Access Control (Allowed vs Forbidden)', () => {
    it('PLATFORM_ADMIN can list all brokerages', async () => {
      const res = await request(app)
        .get('/api/brokerages')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.brokerages).toHaveLength(2);
    });

    it('BROKERAGE_ADMIN is forbidden from listing all platform brokerages', async () => {
      const res = await request(app)
        .get('/api/brokerages')
        .set('Authorization', `Bearer ${tokenBrokerageAdminA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('ADVISOR is forbidden from listing all platform brokerages', async () => {
      const res = await request(app)
        .get('/api/brokerages')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('CLIENT is forbidden from listing clients directory', async () => {
      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('ADVISOR and BROKERAGE_ADMIN can list clients in their own brokerage', async () => {
      const resAdvisor = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(resAdvisor.status).toBe(200);
      // Brokerage A has 2 clients (Alex and Maria)
      expect(resAdvisor.body.data.clients).toHaveLength(2);
      expect(
        resAdvisor.body.data.clients.every((c: { brokerageId: string }) => c.brokerageId === brokerageA._id.toString())
      ).toBe(true);
    });
  });

  describe('2. Cross-Brokerage Tenant Boundary Isolation', () => {
    it('ADVISOR can access their own brokerage details via parameter', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerageA._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.brokerage._id).toBe(brokerageA._id.toString());
    });

    it('ADVISOR is denied when accessing another brokerage ID with 403 BROKERAGE_ISOLATION_VIOLATION', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerageB._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BROKERAGE_ISOLATION_VIOLATION');
    });

    it('BROKERAGE_ADMIN is denied when accessing another brokerage ID with 403', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerageB._id}`)
        .set('Authorization', `Bearer ${tokenBrokerageAdminA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BROKERAGE_ISOLATION_VIOLATION');
    });

    it('PLATFORM_ADMIN can access any brokerage ID', async () => {
      const resA = await request(app)
        .get(`/api/brokerages/${brokerageA._id}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);
      expect(resA.status).toBe(200);

      const resB = await request(app)
        .get(`/api/brokerages/${brokerageB._id}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);
      expect(resB.status).toBe(200);
    });

    it('returns 404 on non-existent or malformed brokerage ID without 500 CastError', async () => {
      const nonExistentId = new Types.ObjectId();
      const res404 = await request(app)
        .get(`/api/brokerages/${nonExistentId}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);
      expect(res404.status).toBe(404);
      expect(res404.body.error.code).toBe('NOT_FOUND');

      const resMalformed = await request(app)
        .get('/api/brokerages/malformed-id-123')
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);
      expect(resMalformed.status).toBe(404);
      expect(resMalformed.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('3. Guessed & Cross-Tenant IDs (IDOR & Information Leakage Prevention)', () => {
    it('Advisor A requesting Client B (in Brokerage B) returns 404 Not Found without leaking existence', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientRecordB._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toMatch(/not found/i);
    });

    it('Advisor A requesting Document B (in Brokerage B) returns 404 Not Found', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentB._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Requesting a non-existent or malformed ID returns 404', async () => {
      const randomId = new Types.ObjectId();
      const resNotFound = await request(app)
        .get(`/api/clients/${randomId}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);
      expect(resNotFound.status).toBe(404);

      const resMalformed = await request(app)
        .get('/api/clients/malformed-id-123')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);
      expect(resMalformed.status).toBe(404);
    });

    it('PLATFORM_ADMIN can inspect clients across brokerages', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientRecordB._id}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.client._id).toBe(clientRecordB._id.toString());
    });
  });

  describe('4. Client-Level Ownership Isolation', () => {
    it('CLIENT can view their own client profile', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientRecordA._id}`)
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.client.userId).toBe(clientUserA._id.toString());
    });

    it('CLIENT is blocked with 404 when accessing another client profile in the SAME brokerage', async () => {
      const res = await request(app)
        .get(`/api/clients/${clientRecordA2._id}`)
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('CLIENT can view their own uploaded document', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentA._id}`)
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.document.title).toBe(documentA.title);
    });

    it('CLIENT is blocked with 404 when accessing another user document in the SAME brokerage', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentA2._id}`)
        .set('Authorization', `Bearer ${tokenClientA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('ADVISOR in Brokerage A can review any client document in Brokerage A', async () => {
      const resA = await request(app)
        .get(`/api/documents/${documentA._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);
      expect(resA.status).toBe(200);

      const resA2 = await request(app)
        .get(`/api/documents/${documentA2._id}`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`);
      expect(resA2.status).toBe(200);
    });
  });

  describe('5. Inactive / Suspended Authenticated Users & Unauthenticated Access', () => {
    it('rejects access if authenticated user account was suspended after token generation', async () => {
      await User.findByIdAndUpdate(advisorA._id, { status: 'SUSPENDED' });

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${tokenAdvisorA}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/inactive or not found/i);
    });

    it('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await request(app).get('/api/clients');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
