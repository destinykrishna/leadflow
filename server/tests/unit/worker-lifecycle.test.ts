import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import * as databaseModule from '../../src/config/database.js';
import {
  processDocumentJob,
  pauseDocumentWorker,
  resumeDocumentWorker,
} from '../../src/queues/document.worker.js';
import {
  processEmailJob,
  pauseEmailWorker,
  resumeEmailWorker,
} from '../../src/queues/email.worker.js';
import {
  reconcilePendingDocuments,
  reconcileStalledDocuments,
  reconcileAll,
} from '../../src/queues/document-recovery.service.js';

describe('Worker & Database Lifecycle Hardening', () => {
  describe('Connection Lifecycle Callbacks', () => {
    it('should register and trigger onDatabaseConnected callback', async () => {
      let triggered = false;
      const unsubscribe = databaseModule.onDatabaseConnected(() => {
        triggered = true;
      });

      expect(triggered).toBe(true); // Since test DB is already connected, invokes immediately
      unsubscribe();
    });

    it('should register onDatabaseDisconnected callback and allow unsubscribe', () => {
      let triggered = false;
      const unsubscribe = databaseModule.onDatabaseDisconnected(() => {
        triggered = true;
      });

      expect(triggered).toBe(false);
      unsubscribe();
    });
  });

  describe('Reconciliation Disconnection Safety', () => {
    it('should safely skip pending document sweep without buffering when DB is disconnected', async () => {
      const isConnectedSpy = vi.spyOn(databaseModule, 'isDatabaseConnected').mockReturnValue(false);

      const recovered = await reconcilePendingDocuments();
      expect(recovered).toBe(0);

      isConnectedSpy.mockRestore();
    });

    it('should safely skip stalled document sweep without buffering when DB is disconnected', async () => {
      const isConnectedSpy = vi.spyOn(databaseModule, 'isDatabaseConnected').mockReturnValue(false);

      const recovered = await reconcileStalledDocuments();
      expect(recovered).toBe(0);

      isConnectedSpy.mockRestore();
    });

    it('should return empty summary on reconcileAll when DB is disconnected', async () => {
      const isConnectedSpy = vi.spyOn(databaseModule, 'isDatabaseConnected').mockReturnValue(false);

      const summary = await reconcileAll();
      expect(summary.recoveredPending).toBe(0);
      expect(summary.recoveredStalled).toBe(0);

      isConnectedSpy.mockRestore();
    });
  });

  describe('Job Processor Disconnection Safety', () => {
    it('should fail document job as transient retryable error immediately when DB is disconnected', async () => {
      const isConnectedSpy = vi.spyOn(databaseModule, 'isDatabaseConnected').mockReturnValue(false);

      const fakeJob = {
        id: 'job-123',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          documentId: new Types.ObjectId().toHexString(),
          brokerageId: new Types.ObjectId().toHexString(),
        },
      } as any;

      await expect(processDocumentJob(fakeJob)).rejects.toThrow('Database is disconnected');

      isConnectedSpy.mockRestore();
    });

    it('should fail email job as transient retryable error immediately when DB is disconnected', async () => {
      const isConnectedSpy = vi.spyOn(databaseModule, 'isDatabaseConnected').mockReturnValue(false);

      const fakeJob = {
        id: 'job-456',
        attemptsMade: 0,
        opts: { attempts: 3 },
        data: {
          leadId: new Types.ObjectId().toHexString(),
          brokerageId: new Types.ObjectId().toHexString(),
          to: 'test@example.com',
          subject: 'Test Subject',
          body: 'Test Body',
          idempotencyKey: 'idem-123',
        },
      } as any;

      await expect(processEmailJob(fakeJob)).rejects.toThrow('Database is disconnected');

      isConnectedSpy.mockRestore();
    });
  });

  describe('Worker Pause & Resume Controls', () => {
    it('should expose pause and resume controls without crashing', async () => {
      await expect(pauseDocumentWorker()).resolves.toBeUndefined();
      expect(() => resumeDocumentWorker()).not.toThrow();

      await expect(pauseEmailWorker()).resolves.toBeUndefined();
      expect(() => resumeEmailWorker()).not.toThrow();
    });
  });
});
