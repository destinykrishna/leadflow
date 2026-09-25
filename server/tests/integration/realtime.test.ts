import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { Types } from 'mongoose';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { app } from '../../src/app.js';
import { Brokerage, User, Lead } from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';
import { initSocketServer, closeSocketServer, getSocketServer } from '../../src/sockets/index.js';

describe('Realtime Pipeline Socket.IO Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let httpServer: http.Server;
  let serverUrl: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;
  let suspendedBrokerage: InstanceType<typeof Brokerage>;

  let platformAdmin: InstanceType<typeof User>;
  let brokerageAdminA: InstanceType<typeof User>;
  let advisorA: InstanceType<typeof User>;
  let advisorA2: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;
  let inactiveUser: InstanceType<typeof User>;

  let advisorB: InstanceType<typeof User>;

  let tokenPlatformAdmin: string;
  let tokenBrokerageAdminA: string;
  let tokenAdvisorA: string;
  let tokenAdvisorA2: string;
  let tokenClientA: string;
  let tokenInactiveUser: string;
  let tokenAdvisorB: string;
  let tokenSuspendedBrokerageAdvisor: string;

  let leadA: InstanceType<typeof Lead>;
  let leadB: InstanceType<typeof Lead>;

  const activeSockets: ClientSocket[] = [];

  function createClientSocket(token?: string, options: Record<string, any> = {}): ClientSocket {
    const socketOptions: Record<string, any> = {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
      ...options,
    };
    if (token !== undefined) {
      socketOptions.auth = { token };
    }
    const socket = ioClient(serverUrl, socketOptions);
    activeSockets.push(socket);
    return socket;
  }

  function connectSocket(socket: ClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (err) => reject(err));
      socket.connect();
    });
  }

  beforeAll(async () => {
    httpServer = http.createServer(app);
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          serverUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const socket of activeSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    await closeSocketServer();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  afterEach(() => {
    for (const socket of activeSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    activeSockets.length = 0;
  });

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // 1. Brokerages
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

    suspendedBrokerage = await Brokerage.create({
      name: 'Defunct Financial Services',
      slug: 'defunct-loans',
      plan: 'STARTER',
      status: 'SUSPENDED',
    });

    // 2. Users
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
      name: 'Alex Expat',
      email: 'alex@client.de',
      passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    inactiveUser = await User.create({
      brokerageId: brokerageA._id,
      name: 'Suspended Advisor',
      email: 'suspended@berlin-expat.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'SUSPENDED',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      name: 'Stefan Meyer',
      email: 'stefan@munich-loans.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    const suspendedAdvisor = await User.create({
      brokerageId: suspendedBrokerage._id,
      name: 'Advisor at Suspended Brokerage',
      email: 'advisor@defunct.de',
      passwordHash,
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    // 3. Tokens
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

    tokenInactiveUser = tokenService.generateAccessToken({
      userId: inactiveUser._id.toString(),
      email: inactiveUser.email,
      role: inactiveUser.role,
      brokerageId: brokerageA._id.toString(),
    });

    tokenAdvisorB = tokenService.generateAccessToken({
      userId: advisorB._id.toString(),
      email: advisorB.email,
      role: advisorB.role,
      brokerageId: brokerageB._id.toString(),
    });

    tokenSuspendedBrokerageAdvisor = tokenService.generateAccessToken({
      userId: suspendedAdvisor._id.toString(),
      email: suspendedAdvisor.email,
      role: suspendedAdvisor.role,
      brokerageId: suspendedBrokerage._id.toString(),
    });

    // 4. Sample Leads
    leadA = await Lead.create({
      brokerageId: brokerageA._id,
      firstName: 'David',
      lastName: 'Chen',
      email: 'david.chen@expat.com',
      phone: '+49 170 1234567',
      status: 'NEW',
      source: 'WEBSITE',
      score: 85,
      assignedTo: advisorA._id,
    });

    leadB = await Lead.create({
      brokerageId: brokerageB._id,
      firstName: 'Lukas',
      lastName: 'Bauer',
      email: 'lukas.bauer@munich.de',
      status: 'NEW',
      source: 'MANUAL',
      score: 70,
      assignedTo: advisorB._id,
    });
  });

  describe('1. Socket Authentication & Rejection', () => {
    it('should authenticate successfully with valid token in auth payload', async () => {
      const socket = createClientSocket(tokenAdvisorA);
      await expect(connectSocket(socket)).resolves.toBeUndefined();
      expect(socket.connected).toBe(true);
    });

    it('should authenticate successfully with Bearer token in authorization header', async () => {
      const socket = createClientSocket(undefined, {
        extraHeaders: {
          authorization: `Bearer ${tokenAdvisorA}`,
        },
      });
      await expect(connectSocket(socket)).resolves.toBeUndefined();
      expect(socket.connected).toBe(true);
    });

    it('should authenticate successfully with accessToken in cookie header', async () => {
      const socket = createClientSocket(undefined, {
        extraHeaders: {
          cookie: `accessToken=${tokenAdvisorA}`,
        },
      });
      await expect(connectSocket(socket)).resolves.toBeUndefined();
      expect(socket.connected).toBe(true);
    });

    it('should reject connection when no authentication token is provided', async () => {
      const socket = createClientSocket();
      await expect(connectSocket(socket)).rejects.toThrow('Authentication required');
      expect(socket.connected).toBe(false);
    });

    it('should reject connection when invalid or malformed token is provided', async () => {
      const socket = createClientSocket('completely-invalid-jwt-token');
      await expect(connectSocket(socket)).rejects.toThrow('Invalid or expired authentication token');
      expect(socket.connected).toBe(false);
    });

    it('should reject connection when user account is inactive/suspended', async () => {
      const socket = createClientSocket(tokenInactiveUser);
      await expect(connectSocket(socket)).rejects.toThrow('User account is inactive or not found');
      expect(socket.connected).toBe(false);
    });

    it('should reject connection when user brokerage is inactive/suspended', async () => {
      const socket = createClientSocket(tokenSuspendedBrokerageAdvisor);
      await expect(connectSocket(socket)).rejects.toThrow('Brokerage account is inactive or suspended');
      expect(socket.connected).toBe(false);
    });
  });

  describe('2. Room Membership & Brokerage Isolation', () => {
    it('should place advisor into their specific brokerage room on connection', async () => {
      const socketAdvisorA = createClientSocket(tokenAdvisorA);
      await connectSocket(socketAdvisorA);

      const io = getSocketServer();
      expect(io).not.toBeNull();

      const serverSocket = io!.sockets.sockets.get(socketAdvisorA.id!);
      expect(serverSocket).toBeDefined();

      // Check rooms
      const rooms = Array.from(serverSocket!.rooms);
      expect(rooms).toContain(`brokerage:${brokerageA._id}`);
      expect(rooms).not.toContain(`brokerage:${brokerageB._id}`);
      expect(rooms).not.toContain('platform:admins');
    });

    it('should place platform admin into platform:admins room', async () => {
      const socketPlatformAdmin = createClientSocket(tokenPlatformAdmin);
      await connectSocket(socketPlatformAdmin);

      const io = getSocketServer();
      const serverSocket = io!.sockets.sockets.get(socketPlatformAdmin.id!);
      expect(serverSocket).toBeDefined();

      const rooms = Array.from(serverSocket!.rooms);
      expect(rooms).toContain('platform:admins');
      expect(rooms).not.toContain(`brokerage:${brokerageA._id}`);
    });

    it('should place client into private client room and strictly exclude them from brokerage room', async () => {
      const socketClientA = createClientSocket(tokenClientA);
      await connectSocket(socketClientA);

      const io = getSocketServer();
      const serverSocket = io!.sockets.sockets.get(socketClientA.id!);
      expect(serverSocket).toBeDefined();

      const rooms = Array.from(serverSocket!.rooms);
      expect(rooms).toContain(`client:${clientUserA._id}`);
      expect(rooms).not.toContain(`brokerage:${brokerageA._id}`);
      expect(rooms).not.toContain('platform:admins');
    });

    it('should reject client-requested room manipulation attempts (join/subscribe)', async () => {
      const socketAdvisorA = createClientSocket(tokenAdvisorA);
      await connectSocket(socketAdvisorA);

      // Attempt to join Brokerage B's room
      const errorPromise = new Promise<{ code: string; message: string }>((resolve) => {
        socketAdvisorA.once('error', (err) => resolve(err));
      });

      socketAdvisorA.emit('join', { room: `brokerage:${brokerageB._id}` });
      const err = await errorPromise;

      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toContain('Client-requested room joins are not permitted');

      // Verify the socket was NOT added to Brokerage B's room
      const io = getSocketServer();
      const serverSocket = io!.sockets.sockets.get(socketAdvisorA.id!);
      expect(serverSocket!.rooms.has(`brokerage:${brokerageB._id}`)).toBe(false);
    });
  });

  describe('3. Pipeline Stage Events & Realtime Broadcasting', () => {
    it('should broadcast pipeline:stage_changed to brokerage room on successful stage transition', async () => {
      const socketAdvisorA = createClientSocket(tokenAdvisorA);
      await connectSocket(socketAdvisorA);

      // Listen for pipeline stage changed event
      const eventPromise = new Promise<any>((resolve) => {
        socketAdvisorA.once('pipeline:stage_changed', (payload) => resolve(payload));
      });

      // Move lead from NEW to CONTACTED via HTTP API
      const res = await request(app)
        .patch(`/api/leads/${leadA._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ stage: 'CONTACTED' });

      expect(res.status).toBe(200);

      // Await socket broadcast
      const event = await eventPromise;
      expect(event).toBeDefined();
      expect(event.leadId).toBe(leadA._id.toString());
      expect(event.brokerageId).toBe(brokerageA._id.toString());
      expect(event.previousStage).toBe('NEW');
      expect(event.newStage).toBe('CONTACTED');
      expect(event.version).toBe(1);
      expect(event.timestamp).toBeDefined();
      expect(event.updatedBy.id).toBe(advisorA._id.toString());
      expect(event.updatedBy.name).toBe('Elena Schmidt');

      // Verify PII is NOT exposed in the socket broadcast payload
      expect(event.email).toBeUndefined();
      expect(event.phone).toBeUndefined();
      expect(event.token).toBeUndefined();
      expect(event.notes).toBeUndefined();
    });

    it('should NOT emit socket events when a stage transition fails (validation error)', async () => {
      const socketAdvisorA = createClientSocket(tokenAdvisorA);
      await connectSocket(socketAdvisorA);

      let eventReceived = false;
      socketAdvisorA.on('pipeline:stage_changed', () => {
        eventReceived = true;
      });

      // Invalid transition: NEW -> QUALIFIED (skipping CONTACTED)
      const res = await request(app)
        .patch(`/api/leads/${leadA._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ stage: 'QUALIFIED' });

      expect(res.status).toBe(400);

      // Wait 150ms to ensure no delayed event was emitted
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(eventReceived).toBe(false);
    });

    it('should NOT emit socket events when a stage transition fails (concurrency conflict)', async () => {
      const socketAdvisorA = createClientSocket(tokenAdvisorA);
      await connectSocket(socketAdvisorA);

      // First move lead to CONTACTED (version is now 1)
      await request(app)
        .patch(`/api/leads/${leadA._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ stage: 'CONTACTED' });

      let conflictEventReceived = false;
      socketAdvisorA.on('pipeline:stage_changed', () => {
        conflictEventReceived = true;
      });

      // Second update attempts with stale version 0 -> 409 Conflict
      const resConflict = await request(app)
        .patch(`/api/leads/${leadA._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA2}`)
        .send({ stage: 'QUALIFIED', version: 0 });

      expect(resConflict.status).toBe(409);

      // Wait 150ms to ensure zero socket events emitted on conflict
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(conflictEventReceived).toBe(false);
    });
  });

  describe('4. Cross-Brokerage Event Isolation & CLIENT Exclusions', () => {
    it('should never deliver Brokerage A pipeline events to Brokerage B sockets', async () => {
      const socketAdvisorA = createClientSocket(tokenAdvisorA);
      const socketAdvisorB = createClientSocket(tokenAdvisorB);

      await connectSocket(socketAdvisorA);
      await connectSocket(socketAdvisorB);

      let advisorBReceived = false;
      socketAdvisorB.on('pipeline:stage_changed', () => {
        advisorBReceived = true;
      });

      const advisorAReceivedPromise = new Promise<any>((resolve) => {
        socketAdvisorA.once('pipeline:stage_changed', (payload) => resolve(payload));
      });

      // Advisor A transitions Lead A in Brokerage A
      await request(app)
        .patch(`/api/leads/${leadA._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ stage: 'CONTACTED' });

      // Advisor A receives the event
      const eventA = await advisorAReceivedPromise;
      expect(eventA.leadId).toBe(leadA._id.toString());

      // Advisor B in Brokerage B must NEVER receive Brokerage A's event
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(advisorBReceived).toBe(false);
    });

    it('should never deliver internal pipeline stage events to CLIENT users', async () => {
      const socketClientA = createClientSocket(tokenClientA);
      await connectSocket(socketClientA);

      let clientReceivedEvent = false;
      socketClientA.on('pipeline:stage_changed', () => {
        clientReceivedEvent = true;
      });
      socketClientA.on('lead:stage_changed', () => {
        clientReceivedEvent = true;
      });

      // Advisor A moves a lead in Brokerage A
      await request(app)
        .patch(`/api/leads/${leadA._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ stage: 'CONTACTED' });

      await new Promise((resolve) => setTimeout(resolve, 150));
      // Expat client must never receive internal brokerage pipeline board events
      expect(clientReceivedEvent).toBe(false);
    });

    it('should deliver pipeline events to PLATFORM_ADMIN in platform:admins room', async () => {
      const socketPlatformAdmin = createClientSocket(tokenPlatformAdmin);
      await connectSocket(socketPlatformAdmin);

      const eventPromise = new Promise<any>((resolve) => {
        socketPlatformAdmin.once('pipeline:stage_changed', (payload) => resolve(payload));
      });

      // Advisor A moves a lead in Brokerage A
      await request(app)
        .patch(`/api/leads/${leadA._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ stage: 'CONTACTED' });

      const event = await eventPromise;
      expect(event).toBeDefined();
      expect(event.brokerageId).toBe(brokerageA._id.toString());
      expect(event.leadId).toBe(leadA._id.toString());
    });
  });

  describe('5. Platform Admin Brokerage Subscription & Disconnect Lifecycle', () => {
    it('should allow PLATFORM_ADMIN to subscribe to specific brokerage room dynamically', async () => {
      const socketPlatformAdmin = createClientSocket(tokenPlatformAdmin);
      await connectSocket(socketPlatformAdmin);

      const subscriptionPromise = new Promise<any>((resolve) => {
        socketPlatformAdmin.once('subscribed_brokerage', (res) => resolve(res));
      });

      socketPlatformAdmin.emit('subscribe_brokerage', { brokerageId: brokerageB._id.toString() });
      const confirmation = await subscriptionPromise;

      expect(confirmation.brokerageId).toBe(brokerageB._id.toString());

      // Verify the platform admin socket is now in Brokerage B room
      const io = getSocketServer();
      const serverSocket = io!.sockets.sockets.get(socketPlatformAdmin.id!);
      expect(serverSocket!.rooms.has(`brokerage:${brokerageB._id}`)).toBe(true);
    });

    it('should reject non-platform-admins attempting to use subscribe_brokerage', async () => {
      const socketAdvisorA = createClientSocket(tokenAdvisorA);
      await connectSocket(socketAdvisorA);

      const errorPromise = new Promise<any>((resolve) => {
        socketAdvisorA.once('error', (err) => resolve(err));
      });

      socketAdvisorA.emit('subscribe_brokerage', { brokerageId: brokerageB._id.toString() });
      const err = await errorPromise;

      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toContain('Only platform admins may subscribe');

      const io = getSocketServer();
      const serverSocket = io!.sockets.sockets.get(socketAdvisorA.id!);
      expect(serverSocket!.rooms.has(`brokerage:${brokerageB._id}`)).toBe(false);
    });

    it('should handle disconnect and reconnect cleanly without duplicate event delivery', async () => {
      let socket = createClientSocket(tokenAdvisorA);
      await connectSocket(socket);

      // Disconnect
      socket.disconnect();
      expect(socket.connected).toBe(false);

      // Reconnect with new socket connection
      socket = createClientSocket(tokenAdvisorA);
      await connectSocket(socket);
      expect(socket.connected).toBe(true);

      let eventCount = 0;
      socket.on('pipeline:stage_changed', () => {
        eventCount++;
      });

      // Move stage
      await request(app)
        .patch(`/api/leads/${leadA._id}/stage`)
        .set('Authorization', `Bearer ${tokenAdvisorA}`)
        .send({ stage: 'CONTACTED' });

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Must receive exactly ONE event (no duplicate listeners or lingering subscriptions)
      expect(eventCount).toBe(1);
    });
  });
});
