import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { Types } from 'mongoose';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../../src/app.js';
import { Brokerage, User, Session, Lead } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { advisorService } from '../../src/services/advisor.service.js';
import { brokerageService } from '../../src/services/brokerage.service.js';
import { clientService } from '../../src/services/client.service.js';
import { hashPassword } from '../../src/utils/password.js';
import {
  initSocketServer,
  closeSocketServer,
  disconnectUserSockets,
  disconnectBrokerageSockets,
} from '../../src/sockets/socket.server.js';
import {
  validateProductionSecurity,
  DEV_DEFAULT_SECRETS,
  resolveCorsOrigin,
} from '../../src/config/env.js';

describe('LeadFlow — Final Security Hardening (HARD-01 through HARD-05)', () => {
  const app = createApp();
  let httpServer: http.Server;
  let serverUrl: string;

  let brokerage: InstanceType<typeof Brokerage>;
  let otherBrokerage: InstanceType<typeof Brokerage>;
  let platformAdmin: InstanceType<typeof User>;
  let brokerageAdmin: InstanceType<typeof User>;
  let advisor: InstanceType<typeof User>;
  let clientUser: InstanceType<typeof User>;

  let tokenPlatformAdmin: string;
  let tokenBrokerageAdmin: string;
  let tokenAdvisor: string;
  let tokenClient: string;

  const activeSockets: ClientSocket[] = [];

  function createClientSocket(token?: string): ClientSocket {
    const socketOpts: Record<string, any> = {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
    };
    if (token) {
      socketOpts.auth = { token };
    }
    const socket = ioClient(serverUrl, socketOpts);
    activeSockets.push(socket);
    return socket;
  }

  function waitForConnect(socket: ClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
  }

  function waitForDisconnect(socket: ClientSocket): Promise<string> {
    return new Promise((resolve) => {
      socket.once('disconnect', (reason) => resolve(reason));
    });
  }

  beforeAll(async () => {
    httpServer = http.createServer(app);
    initSocketServer(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (typeof addr === 'object' && addr !== null) {
          serverUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const socket of activeSockets) {
      if (socket.connected) socket.disconnect();
    }
    await closeSocketServer();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Brokerage.deleteMany({});
    await Session.deleteMany({});
    await Lead.deleteMany({});

    const passwordHash = await hashPassword('TestSecretPass123!');

    brokerage = await Brokerage.create({
      name: 'Alpha Lending GmbH',
      slug: 'alpha-lending',
      plan: 'GROWTH',
      status: 'ACTIVE',
      webhookSecret: 'secret_alpha_webhook_123',
    });

    otherBrokerage = await Brokerage.create({
      name: 'Beta Mortgages GmbH',
      slug: 'beta-mortgages',
      plan: 'STARTER',
      status: 'ACTIVE',
      webhookSecret: 'secret_beta_webhook_456',
    });

    platformAdmin = await User.create({
      name: 'Global Admin',
      email: 'platform@leadflow.internal',
      passwordHash,
      role: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
      brokerageId: null,
    });

    brokerageAdmin = await User.create({
      name: 'Broker Admin',
      email: 'admin@alpha-lending.de',
      passwordHash,
      role: 'BROKERAGE_ADMIN',
      status: 'ACTIVE',
      brokerageId: brokerage._id,
    });

    advisor = await User.create({
      name: 'Advisor Max',
      email: 'max@alpha-lending.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
      brokerageId: brokerage._id,
    });

    clientUser = await User.create({
      name: 'Client Erika',
      email: 'erika@example.de',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
      brokerageId: brokerage._id,
    });

    tokenPlatformAdmin = tokenService.generateAccessToken({
      userId: platformAdmin._id.toString(),
      email: platformAdmin.email,
      role: platformAdmin.role,
      brokerageId: null,
    });

    tokenBrokerageAdmin = tokenService.generateAccessToken({
      userId: brokerageAdmin._id.toString(),
      email: brokerageAdmin.email,
      role: brokerageAdmin.role,
      brokerageId: brokerage._id.toString(),
    });

    tokenAdvisor = tokenService.generateAccessToken({
      userId: advisor._id.toString(),
      email: advisor.email,
      role: advisor.role,
      brokerageId: brokerage._id.toString(),
    });

    tokenClient = tokenService.generateAccessToken({
      userId: clientUser._id.toString(),
      email: clientUser.email,
      role: clientUser.role,
      brokerageId: brokerage._id.toString(),
    });
  });

  afterEach(() => {
    for (const socket of activeSockets) {
      if (socket.connected) socket.disconnect();
    }
    activeSockets.length = 0;
  });

  // --------------------------------------------------------------------------
  // HARD-01: Socket.IO Revocation
  // --------------------------------------------------------------------------
  describe('HARD-01: Socket.IO Revocation on User Deactivation & Brokerage Suspension', () => {
    it('disconnects user socket when disconnectUserSockets is invoked', async () => {
      const client = createClientSocket(tokenAdvisor);
      await waitForConnect(client);
      expect(client.connected).toBe(true);

      const disconnectPromise = waitForDisconnect(client);
      await disconnectUserSockets(advisor._id.toString());

      const reason = await disconnectPromise;
      expect(client.connected).toBe(false);
      expect(reason).toBe('io server disconnect');
    });

    it('disconnects all tenant sockets when disconnectBrokerageSockets is invoked', async () => {
      const staffSocket = createClientSocket(tokenAdvisor);
      const clientSocket = createClientSocket(tokenClient);

      await Promise.all([waitForConnect(staffSocket), waitForConnect(clientSocket)]);
      expect(staffSocket.connected).toBe(true);
      expect(clientSocket.connected).toBe(true);

      const disconnectStaff = waitForDisconnect(staffSocket);
      const disconnectClient = waitForDisconnect(clientSocket);

      await disconnectBrokerageSockets(brokerage._id.toString());

      await Promise.all([disconnectStaff, disconnectClient]);
      expect(staffSocket.connected).toBe(false);
      expect(clientSocket.connected).toBe(false);
    });

    it('disconnects active socket when an advisor is marked INACTIVE via advisorService', async () => {
      const client = createClientSocket(tokenAdvisor);
      await waitForConnect(client);
      expect(client.connected).toBe(true);

      const disconnectPromise = waitForDisconnect(client);

      const caller = {
        id: brokerageAdmin._id.toString(),
        email: brokerageAdmin.email,
        name: brokerageAdmin.name,
        role: brokerageAdmin.role,
        status: brokerageAdmin.status,
        brokerageId: brokerage._id.toString(),
      };

      await advisorService.updateAdvisor(caller, advisor._id.toString(), {
        status: 'INACTIVE',
      });

      const reason = await disconnectPromise;
      expect(client.connected).toBe(false);
      expect(reason).toBe('io server disconnect');
    });

    it('disconnects active sockets and revokes sessions when brokerage is SUSPENDED via brokerageService', async () => {
      const staffSocket = createClientSocket(tokenBrokerageAdmin);
      const clientSocket = createClientSocket(tokenClient);

      await Promise.all([waitForConnect(staffSocket), waitForConnect(clientSocket)]);
      expect(staffSocket.connected).toBe(true);
      expect(clientSocket.connected).toBe(true);

      const disconnectStaff = waitForDisconnect(staffSocket);
      const disconnectClient = waitForDisconnect(clientSocket);

      await brokerageService.updateBrokerage(brokerage._id.toString(), {
        status: 'SUSPENDED',
      });

      await Promise.all([disconnectStaff, disconnectClient]);
      expect(staffSocket.connected).toBe(false);
      expect(clientSocket.connected).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // HARD-02: Production Secret Enforcement
  // --------------------------------------------------------------------------
  describe('HARD-02: Production Secret Enforcement', () => {
    const validProdBase = {
      NODE_ENV: 'production' as const,
      PORT: 5000,
      MONGODB_URI: 'mongodb://prod-cluster/leadflow',
      LOG_LEVEL: 'info' as const,
      JWT_SECRET: 'production-strong-jwt-secret-min32-chars-random12345!',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET: 'production-strong-refresh-secret-min32-chars-random12345!',
      JWT_REFRESH_EXPIRES_IN: '7d',
      COOKIE_SECRET: 'production-strong-cookie-secret-key-64chars-random-string-here!',
      CORS_ORIGIN: 'https://app.leadflow.com',
      IMAGEKIT_PUBLIC_KEY: 'public_prod_key_12345',
      IMAGEKIT_PRIVATE_KEY: 'private_prod_key_12345',
      IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/leadflow_prod',
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 6379,
      REDIS_DB: 0,
      DOCUMENT_PROCESSING_CONCURRENCY: 5,
      DOCUMENT_PROCESSING_DELAY_MS: 2000,
      PENDING_DOCUMENT_RECOVERY_THRESHOLD_MS: 15000,
      STALLED_DOCUMENT_RECOVERY_THRESHOLD_MS: 300000,
      RECONCILIATION_INTERVAL_MS: 60000,
      TRUST_PROXY: '1',
    };

    it('passes validation when production secrets are distinct, strong values', () => {
      expect(() => validateProductionSecurity(validProdBase)).not.toThrow();
    });

    it('fails startup if JWT_SECRET matches default dev fallback in production', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          JWT_SECRET: DEV_DEFAULT_SECRETS.JWT_SECRET,
        })
      ).toThrowError(/Insecure development\/default secret detected for \[JWT_SECRET\]/);
    });

    it('fails startup if JWT_REFRESH_SECRET matches default dev fallback in production', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          JWT_REFRESH_SECRET: DEV_DEFAULT_SECRETS.JWT_REFRESH_SECRET,
        })
      ).toThrowError(/Insecure development\/default secret detected for \[JWT_REFRESH_SECRET\]/);
    });

    it('fails startup if COOKIE_SECRET matches default dev fallback in production', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          COOKIE_SECRET: DEV_DEFAULT_SECRETS.COOKIE_SECRET,
        })
      ).toThrowError(/Insecure development\/default secret detected for \[COOKIE_SECRET\]/);
    });

    it('fails startup if ImageKit keys match default dev fallbacks in production', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          IMAGEKIT_PRIVATE_KEY: DEV_DEFAULT_SECRETS.IMAGEKIT_PRIVATE_KEY,
        })
      ).toThrowError(/Insecure development\/default secret detected for \[IMAGEKIT_PRIVATE_KEY\]/);
    });

    it('does not expose actual secret values in error messages', () => {
      try {
        validateProductionSecurity({
          ...validProdBase,
          JWT_SECRET: DEV_DEFAULT_SECRETS.JWT_SECRET,
        });
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err.message).not.toContain(DEV_DEFAULT_SECRETS.JWT_SECRET);
      }
    });

    it('permits default secrets when NODE_ENV is development or test', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          NODE_ENV: 'test' as const,
          JWT_SECRET: DEV_DEFAULT_SECRETS.JWT_SECRET,
          CORS_ORIGIN: 'http://localhost:5173',
        })
      ).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // HARD-03: Brokerage Metadata Authorization
  // --------------------------------------------------------------------------
  describe('HARD-03: Brokerage Metadata Authorization', () => {
    it('blocks CLIENT users with HTTP 403 Forbidden from accessing brokerage metadata', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerage._id}`)
        .set('Authorization', `Bearer ${tokenClient}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('permits BROKERAGE_ADMIN of own brokerage to read metadata', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerage._id}`)
        .set('Authorization', `Bearer ${tokenBrokerageAdmin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.brokerage.name).toBe('Alpha Lending GmbH');
      expect(res.body.data.brokerage.webhookSecret).toBeDefined();
    });

    it('permits ADVISOR of own brokerage to read metadata without leaking webhookSecret', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerage._id}`)
        .set('Authorization', `Bearer ${tokenAdvisor}`);

      expect(res.status).toBe(200);
      expect(res.body.data.brokerage.name).toBe('Alpha Lending GmbH');
      expect(res.body.data.brokerage.webhookSecret).toBeUndefined();
    });

    it('blocks cross-brokerage access with 403 BROKERAGE_ISOLATION_VIOLATION', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${otherBrokerage._id}`)
        .set('Authorization', `Bearer ${tokenBrokerageAdmin}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('BROKERAGE_ISOLATION_VIOLATION');
    });

    it('permits PLATFORM_ADMIN to view any brokerage metadata', async () => {
      const res = await request(app)
        .get(`/api/brokerages/${brokerage._id}`)
        .set('Authorization', `Bearer ${tokenPlatformAdmin}`);

      expect(res.status).toBe(200);
      const resId = res.body.data.brokerage._id || res.body.data.brokerage.id;
      expect(resId).toBe(brokerage._id.toString());
    });
  });

  // --------------------------------------------------------------------------
  // HARD-04: Temporary Credential Lifecycle & Password Change
  // --------------------------------------------------------------------------
  describe('HARD-04: Temporary Credential Lifecycle & Forced Password Change', () => {
    it('sets mustChangePassword: true on provisioned advisors', async () => {
      const caller = {
        id: brokerageAdmin._id.toString(),
        email: brokerageAdmin.email,
        name: brokerageAdmin.name,
        role: brokerageAdmin.role,
        status: brokerageAdmin.status,
        brokerageId: brokerage._id.toString(),
      };

      const newAdvisor = await advisorService.createAdvisor(caller, {
        name: 'New Advisor',
        email: 'newadvisor@alpha-lending.de',
      });

      expect(newAdvisor.mustChangePassword).toBe(true);

      const dbUser = await User.findById(newAdvisor.id);
      expect(dbUser?.mustChangePassword).toBe(true);
    });

    it('sets mustChangePassword: true on provisioned client portal users during conversion', async () => {
      const lead = await Lead.create({
        brokerageId: brokerage._id,
        firstName: 'Hans',
        lastName: 'Mueller',
        email: 'hans.mueller@example.de',
        phone: '+491512345678',
        status: 'QUALIFIED',
      });

      const caller = {
        id: advisor._id.toString(),
        email: advisor.email,
        name: advisor.name,
        role: advisor.role,
        status: advisor.status,
        brokerageId: brokerage._id.toString(),
      };

      await clientService.convertLead(caller, {
        leadId: lead._id.toString(),
      });

      const clientPortalUser = await User.findOne({ email: 'hans.mueller@example.de' });
      expect(clientPortalUser).not.toBeNull();
      expect(clientPortalUser?.mustChangePassword).toBe(true);
    });

    it('allows user to change password via POST /api/auth/change-password, clearing mustChangePassword', async () => {
      // 1. Create user with mustChangePassword: true
      const rawTempPass = 'TempPass123!Secure';
      const tempHash = await hashPassword(rawTempPass);

      const tempUser = await User.create({
        name: 'Onboarded Advisor',
        email: 'onboarded@alpha-lending.de',
        passwordHash: tempHash,
        role: 'ADVISOR',
        status: 'ACTIVE',
        brokerageId: brokerage._id,
        mustChangePassword: true,
      });

      // 2. User logs in with temporary password
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'onboarded@alpha-lending.de',
        password: rawTempPass,
        brokerageId: brokerage._id.toString(),
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.user.mustChangePassword).toBe(true);
      const userToken = loginRes.body.data.accessToken;

      // 3. User attempts password change with wrong current password -> rejected
      const failRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'WrongPassword!',
          newPassword: 'BrandNewStrongPassword123!',
        });

      expect(failRes.status).toBe(401);

      // 4. User provides valid current password and new password -> succeeds
      const successRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: rawTempPass,
          newPassword: 'BrandNewStrongPassword123!',
        });

      expect(successRes.status).toBe(200);
      expect(successRes.body.data.user.mustChangePassword).toBe(false);

      // Verify database state
      const updatedDbUser = await User.findById(tempUser._id);
      expect(updatedDbUser?.mustChangePassword).toBe(false);

      // 5. User can now log in with the new password
      const reLoginRes = await request(app).post('/api/auth/login').send({
        email: 'onboarded@alpha-lending.de',
        password: 'BrandNewStrongPassword123!',
        brokerageId: brokerage._id.toString(),
      });

      expect(reLoginRes.status).toBe(200);
      expect(reLoginRes.body.data.user.mustChangePassword).toBe(false);

      // 6. Old temporary password no longer works
      const oldLoginRes = await request(app).post('/api/auth/login').send({
        email: 'onboarded@alpha-lending.de',
        password: rawTempPass,
        brokerageId: brokerage._id.toString(),
      });

      expect(oldLoginRes.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // HARD-05: Production CORS
  // --------------------------------------------------------------------------
  describe('HARD-05: Production CORS Enforcement', () => {
    const validProdBase = {
      NODE_ENV: 'production' as const,
      PORT: 5000,
      MONGODB_URI: 'mongodb://prod-cluster/leadflow',
      LOG_LEVEL: 'info' as const,
      JWT_SECRET: 'production-strong-jwt-secret-min32-chars-random12345!',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_SECRET: 'production-strong-refresh-secret-min32-chars-random12345!',
      JWT_REFRESH_EXPIRES_IN: '7d',
      COOKIE_SECRET: 'production-strong-cookie-secret-key-64chars-random-string-here!',
      CORS_ORIGIN: 'https://app.leadflow.com',
      IMAGEKIT_PUBLIC_KEY: 'public_prod_key_12345',
      IMAGEKIT_PRIVATE_KEY: 'private_prod_key_12345',
      IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/leadflow_prod',
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: 6379,
      REDIS_DB: 0,
      DOCUMENT_PROCESSING_CONCURRENCY: 5,
      DOCUMENT_PROCESSING_DELAY_MS: 2000,
      PENDING_DOCUMENT_RECOVERY_THRESHOLD_MS: 15000,
      STALLED_DOCUMENT_RECOVERY_THRESHOLD_MS: 300000,
      RECONCILIATION_INTERVAL_MS: 60000,
      TRUST_PROXY: '1',
    };

    it('rejects localhost origins in production', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          CORS_ORIGIN: 'http://localhost:5173',
        })
      ).toThrowError(/Insecure CORS_ORIGIN detected in production/);
    });

    it('rejects 127.0.0.1 origins in production', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          CORS_ORIGIN: 'http://127.0.0.1:3000',
        })
      ).toThrowError(/Insecure CORS_ORIGIN detected in production/);
    });

    it('rejects wildcard * origin in production', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          CORS_ORIGIN: '*',
        })
      ).toThrowError(/Insecure CORS_ORIGIN detected in production/);
    });

    it('rejects plain HTTP origins in production', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          CORS_ORIGIN: 'http://app.leadflow.com',
        })
      ).toThrowError(/Production origins must use HTTPS/);
    });

    it('accepts single valid HTTPS production origin', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          CORS_ORIGIN: 'https://portal.leadflow.de',
        })
      ).not.toThrow();
    });

    it('accepts multiple comma-separated HTTPS production origins', () => {
      expect(() =>
        validateProductionSecurity({
          ...validProdBase,
          CORS_ORIGIN: 'https://portal.leadflow.de, https://admin.leadflow.de',
        })
      ).not.toThrow();
    });

    it('resolveCorsOrigin resolves string when single origin and array when multiple', () => {
      expect(resolveCorsOrigin('https://app.leadflow.com')).toBe('https://app.leadflow.com');
      expect(
        resolveCorsOrigin('https://app.leadflow.com, https://admin.leadflow.com')
      ).toEqual(['https://app.leadflow.com', 'https://admin.leadflow.com']);
    });
  });
});
