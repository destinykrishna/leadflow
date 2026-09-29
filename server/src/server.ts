import http from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, registerDatabaseShutdownHook } from './config/database.js';
import { initSocketServer } from './sockets/index.js';
import { setupDocumentEventsSubscriber } from './queues/document-events.js';
import { setupAutomationEventsSubscriber } from './queues/automation-events.js';
import { startDocumentWorker, closeDocumentWorker } from './queues/document.worker.js';
import { startEmailWorker, closeEmailWorker } from './queues/email.worker.js';
import { documentRecoveryService } from './queues/document-recovery.service.js';
import { logger } from './utils/logger.js';

const httpServer = http.createServer(app);
const io = initSocketServer(httpServer);

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    registerDatabaseShutdownHook();
    setupDocumentEventsSubscriber();
    setupAutomationEventsSubscriber();

    // Start in-process workers so all document processing & email automations run seamlessly on free single-service hosting
    startDocumentWorker();
    startEmailWorker();
    documentRecoveryService.startPeriodicReconciliation();

    const shutdownWorkers = async (signal: string) => {
      logger.info({ signal }, 'Graceful shutdown initiated for in-process workers');
      documentRecoveryService.stopPeriodicReconciliation();
      await closeDocumentWorker();
      await closeEmailWorker();
    };
    process.on('SIGINT', () => void shutdownWorkers('SIGINT'));
    process.on('SIGTERM', () => void shutdownWorkers('SIGTERM'));

    httpServer.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, nodeEnv: env.NODE_ENV },
        `LeadFlow server listening on port ${env.PORT}`
      );
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  void startServer();
}

export { app, httpServer, io };

