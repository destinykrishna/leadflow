import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { pino } from 'pino';
import { startDocumentWorker, closeDocumentWorker } from '../../server/src/queues/document.worker.js';
import { closeDocumentQueue } from '../../server/src/queues/document.queue.js';
import { startEmailWorker, closeEmailWorker } from '../../server/src/queues/email.worker.js';
import { closeEmailQueue } from '../../server/src/queues/email.queue.js';
import { closeRedisConnections } from '../../server/src/queues/redis.connection.js';
import { documentRecoveryService } from '../../server/src/queues/document-recovery.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load root .env first (monorepo single source of truth), with cwd fallback
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadflow';

async function startWorkerProcess(): Promise<void> {
  try {
    logger.info('Starting LeadFlow Background Worker process...');

    await mongoose.connect(MONGODB_URI);
    logger.info('Worker MongoDB connected successfully');

    startDocumentWorker();
    startEmailWorker();
    documentRecoveryService.startPeriodicReconciliation();
    logger.info('Document & email processing workers actively polling for jobs with periodic reconciliation');

    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Graceful shutdown initiated for background worker');
      try {
        documentRecoveryService.stopPeriodicReconciliation();
        await closeDocumentWorker();
        await closeDocumentQueue();
        await closeEmailWorker();
        await closeEmailQueue();
        await closeRedisConnections();
        await mongoose.disconnect();
        logger.info('Worker shutdown completed cleanly');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during worker shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
  } catch (error) {
    logger.error({ err: error }, 'Worker process startup failed');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  void startWorkerProcess();
}

export { startWorkerProcess };
