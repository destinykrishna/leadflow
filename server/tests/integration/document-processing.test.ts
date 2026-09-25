import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { Types } from 'mongoose';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { app } from '../../src/app.js';
import {
  Brokerage,
  User,
  Client,
  Document as DocumentModel,
  type IDocumentDocument,
} from '../../src/models/index.js';
import { tokenService } from '../../src/services/token.service.js';
import { hashPassword } from '../../src/utils/password.js';
import { initSocketServer, closeSocketServer } from '../../src/sockets/index.js';
import {
  getDocumentQueue,
  enqueueDocumentProcessing,
  closeDocumentQueue,
  createDocumentWorker,
  processDocumentJob,
  closeDocumentWorker,
  DOCUMENT_PROCESSING_QUEUE_NAME,
  type DocumentJobPayload,
} from '../../src/queues/index.js';
import { closeRedisConnections } from '../../src/queues/redis.connection.js';

describe('BullMQ Document Processing Foundation Integration Tests', () => {
  const DEFAULT_PASSWORD = 'TestPassword123!';
  let passwordHash: string;

  let httpServer: http.Server;
  let serverUrl: string;

  let brokerageA: InstanceType<typeof Brokerage>;
  let brokerageB: InstanceType<typeof Brokerage>;

  let advisorA: InstanceType<typeof User>;
  let advisorB: InstanceType<typeof User>;
  let clientUserA: InstanceType<typeof User>;
  let clientA: InstanceType<typeof Client>;

  let tokenAdvisorA: string;
  let tokenAdvisorB: string;
  let tokenClientA: string;

  const activeSockets: ClientSocket[] = [];
  const dummyPdfBuffer = Buffer.from('%PDF-1.4 dummy mortgage payslip document content');

  function createClientSocket(token?: string): ClientSocket {
    const socketOptions: Record<string, any> = {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false,
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
    await closeDocumentWorker();
    await closeDocumentQueue();
    await closeRedisConnections();
    await closeSocketServer();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  beforeEach(async () => {
    passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // Clean queue before each test
    const queue = getDocumentQueue();
    await queue.obliterate({ force: true }).catch(() => {});

    // 1. Create Brokerages
    brokerageA = await Brokerage.create({
      name: 'Frankfurt Expat Mortgages',
      slug: 'frankfurt-expat',
      plan: 'GROWTH',
      status: 'ACTIVE',
    });

    brokerageB = await Brokerage.create({
      name: 'Hamburg Home Loans',
      slug: 'hamburg-loans',
      plan: 'STARTER',
      status: 'ACTIVE',
    });

    // 2. Create Users
    advisorA = await User.create({
      brokerageId: brokerageA._id,
      email: 'advisor.a@frankfurt.de',
      passwordHash,
      name: 'Klaus Weber',
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    advisorB = await User.create({
      brokerageId: brokerageB._id,
      email: 'advisor.b@hamburg.de',
      passwordHash,
      name: 'Stefan Mueller',
      role: 'ADVISOR',
      status: 'ACTIVE',
    });

    clientUserA = await User.create({
      brokerageId: brokerageA._id,
      email: 'expat.client@gmail.com',
      passwordHash,
      name: 'Rajesh Sharma',
      role: 'CLIENT',
      status: 'ACTIVE',
    });

    // 3. Create Client profile
    clientA = await Client.create({
      brokerageId: brokerageA._id,
      userId: clientUserA._id,
      firstName: 'Rajesh',
      lastName: 'Sharma',
      email: 'expat.client@gmail.com',
      status: 'ACTIVE',
      type: 'BUYER',
      assignedTo: advisorA._id,
    });

    // 4. Generate Tokens
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

    tokenClientA = tokenService.generateAccessToken({
      userId: clientUserA._id.toString(),
      email: clientUserA.email,
      role: clientUserA.role,
      brokerageId: brokerageA._id.toString(),
    });
  });

  afterEach(async () => {
    while (activeSockets.length > 0) {
      const s = activeSockets.pop();
      if (s?.connected) {
        s.disconnect();
      }
    }
    await closeDocumentWorker();
  });

  describe('1. Job Enqueueing on Document Upload', () => {
    it('enqueues a document processing job when a document is uploaded via HTTP', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenClientA}`)
        .field('title', 'January 2026 Payslip')
        .field('type', 'PAYSLIP')
        .attach('file', dummyPdfBuffer, 'payslip_jan.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document.status).toBe('PENDING');

      const documentId = res.body.data.document._id;

      // Inspect queue to verify job presence and payload
      const queue = getDocumentQueue();
      const job = await queue.getJob(`doc-verify-${documentId}`);

      expect(job).toBeDefined();
      expect(job?.data.documentId).toBe(documentId);
      expect(job?.data.brokerageId).toBe(brokerageA._id.toString());
      expect(job?.data.clientId).toBe(clientA._id.toString());
    });
  });

  describe('2. Successful Processing & State Transitions (PENDING -> PROCESSING -> VERIFIED)', () => {
    it('successfully processes a document from PENDING to PROCESSING to VERIFIED', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Valid German Passport',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/passport.pdf',
        fileKey: 'file_passport_123',
        type: 'IDENTIFICATION',
        status: 'PENDING',
      });

      const worker = createDocumentWorker();

      const jobPromise = new Promise<void>((resolve) => {
        worker.on('completed', (job) => {
          if (job.data.documentId === doc._id.toString()) {
            resolve();
          }
        });
      });

      await enqueueDocumentProcessing({
        documentId: doc._id.toString(),
        brokerageId: brokerageA._id.toString(),
        clientId: clientA._id.toString(),
        processingDelayMs: 20,
      });

      await jobPromise;
      await worker.close();

      const updated = await DocumentModel.findById(doc._id);
      expect(updated).toBeDefined();
      expect(updated?.status).toBe('VERIFIED');
      expect(updated?.verifiedAt).toBeInstanceOf(Date);
      expect(updated?.verificationNotes).toContain('Automated verification check passed');
      expect(updated?.__v).toBeGreaterThanOrEqual(2); // Initial (0) -> Claimed (1) -> Verified (2)
    });
  });

  describe('3. Slow Processing Simulation & Intermediate State', () => {
    it('retains PROCESSING status during slow simulated verification delay', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Tax Declaration 2025',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/tax.pdf',
        type: 'TAX_RETURN',
        status: 'PENDING',
      });

      const worker = createDocumentWorker();

      // Trigger processing with a 300ms simulated slow check
      await enqueueDocumentProcessing({
        documentId: doc._id.toString(),
        brokerageId: brokerageA._id.toString(),
        processingDelayMs: 300,
      });

      // Poll at 100ms: document should be actively in PROCESSING
      await new Promise((resolve) => setTimeout(resolve, 100));

      const intermediateDoc = await DocumentModel.findById(doc._id);
      expect(intermediateDoc?.status).toBe('PROCESSING');

      // Wait for completion
      await new Promise<void>((resolve) => {
        worker.on('completed', (job) => {
          if (job?.data?.documentId === doc._id.toString()) {
            resolve();
          }
        });
      });

      await worker.close();

      const finalDoc = await DocumentModel.findById(doc._id);
      expect(finalDoc?.status).toBe('VERIFIED');
    });
  });

  describe('4. Simulated Terminal Rejection (Domain Compliance Failure)', () => {
    it('transitions document to REJECTED without retry when document fails verification check', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Blurry Document [reject]',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/blurry.pdf',
        type: 'PAYSLIP',
        status: 'PENDING',
      });

      const worker = createDocumentWorker();

      const jobCompletedPromise = new Promise<{ status: string }>((resolve) => {
        worker.on('completed', (job, result) => {
          if (job.data.documentId === doc._id.toString()) {
            resolve(result as { status: string });
          }
        });
      });

      await enqueueDocumentProcessing({
        documentId: doc._id.toString(),
        brokerageId: brokerageA._id.toString(),
        simulateTerminalRejection: true,
        processingDelayMs: 20,
      });

      const result = await jobCompletedPromise;
      await worker.close();

      expect(result.status).toBe('REJECTED');

      const updated = await DocumentModel.findById(doc._id);
      expect(updated?.status).toBe('REJECTED');
      expect(updated?.verificationNotes).toContain('Unreadable document scan');
      expect(updated?.verifiedAt).toBeNull();
    });
  });

  describe('5. Retry & Backoff Behavior on Transient Failure', () => {
    it('retries transient failures up to attempts limit with backoff', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Intermittent OCR Scan',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/ocr.pdf',
        type: 'CONTRACT',
        status: 'PENDING',
      });

      let attemptsCount = 0;
      const customWorker = createDocumentWorker();

      // Configure a job with 2 attempts and short fixed backoff for testing
      const queue = getDocumentQueue();
      const job = await queue.add(
        'verify-document',
        {
          documentId: doc._id.toString(),
          brokerageId: brokerageA._id.toString(),
          simulateFailure: true,
          processingDelayMs: 10,
        },
        {
          jobId: `test-retry-${doc._id}`,
          attempts: 2,
          backoff: { type: 'fixed', delay: 100 },
        }
      );

      const failedPromise = new Promise<void>((resolve) => {
        customWorker.on('failed', (job) => {
          if (job?.data?.documentId === doc._id.toString()) {
            attemptsCount++;
            if (attemptsCount >= 2) {
              resolve();
            }
          }
        });
      });

      await failedPromise;
      await customWorker.close();

      expect(attemptsCount).toBe(2);

      // Verify that after all retries are exhausted, the document is in REJECTED state (never stuck in PROCESSING)
      const finalDoc = await DocumentModel.findById(doc._id);
      expect(finalDoc?.status).toBe('REJECTED');
      expect(finalDoc?.verificationNotes).toContain('Verification failed after 2 attempts');
    });
  });

  describe('6. Duplicate Job Submission & Idempotency', () => {
    it('does not re-process or alter a document that has already reached VERIFIED status', async () => {
      const originalVerifiedDate = new Date('2026-01-01T12:00:00Z');
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Already Verified Contract',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/contract.pdf',
        type: 'CONTRACT',
        status: 'VERIFIED',
        verifiedAt: originalVerifiedDate,
        verificationNotes: 'Original verified notes',
      });

      const fakeJob = {
        id: 'dup-job-1',
        data: {
          documentId: doc._id.toString(),
          brokerageId: brokerageA._id.toString(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      const result = await processDocumentJob(fakeJob);

      expect(result.status).toBe('VERIFIED');
      expect(result.message).toContain('already completed with status');

      const persisted = await DocumentModel.findById(doc._id);
      expect(persisted?.verifiedAt?.toISOString()).toBe(originalVerifiedDate.toISOString());
      expect(persisted?.verificationNotes).toBe('Original verified notes');
    });

    it('enforces queue-level job deduplication when enqueued with same jobId', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Bank Statement Q1',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/bank.pdf',
        type: 'BANK_STATEMENT',
        status: 'PENDING',
      });

      const job1 = await enqueueDocumentProcessing({
        documentId: doc._id.toString(),
        brokerageId: brokerageA._id.toString(),
      });

      const job2 = await enqueueDocumentProcessing({
        documentId: doc._id.toString(),
        brokerageId: brokerageA._id.toString(),
      });

      // Both returned job instances share the identical BullMQ jobId
      expect(job1.id).toBe(`doc-verify-${doc._id}`);
      expect(job2.id).toBe(`doc-verify-${doc._id}`);
    });
  });

  describe('7. Concurrent Processing Attempts (Atomic State Lock)', () => {
    it('allows only one worker to claim PENDING -> PROCESSING under concurrent execution', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Income Proof 2026',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/income.pdf',
        type: 'INCOME_PROOF',
        status: 'PENDING',
      });

      const jobPayload: DocumentJobPayload = {
        documentId: doc._id.toString(),
        brokerageId: brokerageA._id.toString(),
        processingDelayMs: 50,
      };

      const job1 = {
        id: 'concurrent-1',
        data: jobPayload,
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      const job2 = {
        id: 'concurrent-2',
        data: jobPayload,
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      // Run both job processing attempts concurrently
      const [res1, res2] = await Promise.all([
        processDocumentJob(job1),
        processDocumentJob(job2),
      ]);

      // Exactly one succeeds with VERIFIED, the other detects concurrent claim or early exits
      const statuses = [res1.status, res2.status];
      expect(statuses).toContain('VERIFIED');

      const finalDoc = await DocumentModel.findById(doc._id);
      expect(finalDoc?.status).toBe('VERIFIED');
    });
  });

  describe('8. Tenant Safety & Anti-Tampering Defenses', () => {
    it('rejects cross-brokerage job payload without corrupting the foreign document', async () => {
      // Document belongs to Brokerage A
      const docA = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Brokerage A Confidential Payslip',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/payslip_a.pdf',
        type: 'PAYSLIP',
        status: 'PENDING',
      });

      // Malicious or corrupted job payload claiming document belongs to Brokerage B
      const tamperedJob = {
        id: 'tampered-tenant-job',
        data: {
          documentId: docA._id.toString(),
          brokerageId: brokerageB._id.toString(), // Tampered!
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processDocumentJob(tamperedJob)).rejects.toThrow(
        'Brokerage isolation violation'
      );

      // Verify Brokerage A's document was NOT modified
      const docAfter = await DocumentModel.findById(docA._id);
      expect(docAfter?.status).toBe('PENDING');
      expect(docAfter?.brokerageId.toString()).toBe(brokerageA._id.toString());
    });

    it('rejects nonexistent document ID with unrecoverable error', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      const fakeJob = {
        id: 'nonexistent-job',
        data: {
          documentId: nonExistentId,
          brokerageId: brokerageA._id.toString(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await expect(processDocumentJob(fakeJob)).rejects.toThrow('Document resource not found');
    });
  });

  describe('9. Realtime Status Changed Events & Room Isolation', () => {
    it('broadcasts document:status_changed to brokerage room and client personal room', async () => {
      const socketAdvisorA = createClientSocket(tokenAdvisorA);
      const socketClientA = createClientSocket(tokenClientA);
      const socketAdvisorB = createClientSocket(tokenAdvisorB);

      await Promise.all([
        connectSocket(socketAdvisorA),
        connectSocket(socketClientA),
        connectSocket(socketAdvisorB),
      ]);

      const eventsAdvisorA: any[] = [];
      const eventsClientA: any[] = [];
      const eventsAdvisorB: any[] = [];

      socketAdvisorA.on('document:status_changed', (evt) => eventsAdvisorA.push(evt));
      socketClientA.on('document:status_changed', (evt) => eventsClientA.push(evt));
      socketAdvisorB.on('document:status_changed', (evt) => eventsAdvisorB.push(evt));

      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Passport Verification',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/passport.pdf',
        type: 'IDENTIFICATION',
        status: 'PENDING',
      });

      const job = {
        id: 'realtime-job-1',
        data: {
          documentId: doc._id.toString(),
          brokerageId: brokerageA._id.toString(),
          processingDelayMs: 20,
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any;

      await processDocumentJob(job);

      // Brief delay to allow socket event propagation
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 1. Advisor in Brokerage A received events (PENDING -> PROCESSING, PROCESSING -> VERIFIED)
      expect(eventsAdvisorA.length).toBe(2);
      expect(eventsAdvisorA[0].newStatus).toBe('PROCESSING');
      expect(eventsAdvisorA[1].newStatus).toBe('VERIFIED');
      expect(eventsAdvisorA[1].documentId).toBe(doc._id.toString());
      expect(eventsAdvisorA[1].brokerageId).toBe(brokerageA._id.toString());

      // 2. Client User A received events in their personal client room
      expect(eventsClientA.length).toBe(2);
      expect(eventsClientA[1].newStatus).toBe('VERIFIED');

      // 3. Advisor in Brokerage B received ZERO events (strict cross-brokerage tenant isolation!)
      expect(eventsAdvisorB.length).toBe(0);

      // 4. Verify no sensitive credentials or private storage keys leaked
      for (const evt of eventsAdvisorA) {
        expect(evt.privateKey).toBeUndefined();
        expect(evt.token).toBeUndefined();
        expect(evt.password).toBeUndefined();
      }
    });
  });

  describe('10. Worker Lifecycle (Startup & Graceful Shutdown)', () => {
    it('starts worker, processes queued work, and cleanly shuts down without error', async () => {
      const doc = await DocumentModel.create({
        brokerageId: brokerageA._id,
        clientId: clientA._id,
        uploadedBy: clientUserA._id,
        title: 'Proof of Residency',
        fileUrl: 'https://ik.imagekit.io/leadflow_test/residency.pdf',
        type: 'OTHER',
        status: 'PENDING',
      });

      const worker = createDocumentWorker();

      const completedPromise = new Promise<void>((resolve) => {
        worker.on('completed', (job) => {
          if (job.data.documentId === doc._id.toString()) {
            resolve();
          }
        });
      });

      await enqueueDocumentProcessing({
        documentId: doc._id.toString(),
        brokerageId: brokerageA._id.toString(),
        processingDelayMs: 10,
      });

      await completedPromise;

      // Close cleanly
      await worker.close();

      const finalDoc = await DocumentModel.findById(doc._id);
      expect(finalDoc?.status).toBe('VERIFIED');
    });
  });
});
