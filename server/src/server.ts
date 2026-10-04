import http from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initSocketServer, closeSocketServer } from './sockets/index.js';
import { setupDocumentEventsSubscriber } from './queues/document-events.js';
import { setupAutomationEventsSubscriber } from './queues/automation-events.js';
import { startDocumentWorker, closeDocumentWorker } from './queues/document.worker.js';
import { closeDocumentQueue } from './queues/document.queue.js';
import { startEmailWorker, closeEmailWorker } from './queues/email.worker.js';
import { closeEmailQueue } from './queues/email.queue.js';
import { closeRedisConnections } from './queues/redis.connection.js';
import { documentRecoveryService } from './queues/document-recovery.service.js';
import { logger } from './utils/logger.js';

const httpServer = http.createServer(app);
const io = initSocketServer(httpServer);

let isShuttingDown = false;

/**
 * Unified graceful shutdown orchestrator:
 * 1. Stops accepting incoming HTTP requests
 * 2. Closes real-time Socket.IO server
 * 3. Stops periodic recovery sweeps & in-process workers/queues
 * 4. Disconnects Redis connections
 * 5. Disconnects MongoDB
 * 6. Hard-fails on 10s timeout if resources hang
 */
export async function gracefulShutdown(signal: string, exitCode = 0): Promise<void> {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Graceful shutdown already in progress, ignoring duplicate signal');
    return;
  }
  isShuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown sequence initiated');

  const forceExitTimer = setTimeout(() => {
    logger.fatal('Graceful shutdown timed out after 10s. Forcing process exit.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    // 1. Close HTTP server
    await new Promise<void>((resolve) => {
      httpServer.close((err) => {
        if (err) {
          logger.warn({ err }, 'Error closing HTTP server');
        } else {
          logger.info('HTTP server closed cleanly');
        }
        resolve();
      });
    });

    // 2. Close Socket.IO server
    try {
      await closeSocketServer();
      logger.info('Socket.IO server closed cleanly');
    } catch (err) {
      logger.warn({ err }, 'Error closing Socket.IO server');
    }

    // 3. Stop background workers & queues
    try {
      if (env.ENABLE_IN_PROCESS_WORKERS) {
        documentRecoveryService.stopPeriodicReconciliation();
        await closeDocumentWorker();
        await closeEmailWorker();
      }
      await closeDocumentQueue();
      await closeEmailQueue();
      logger.info('Queues and background workers stopped cleanly');
    } catch (err) {
      logger.warn({ err }, 'Error stopping workers and queues');
    }

    // 4. Close Redis connections
    try {
      await closeRedisConnections();
      logger.info('Redis connections closed cleanly');
    } catch (err) {
      logger.warn({ err }, 'Error closing Redis connections');
    }

    // 5. Disconnect MongoDB
    try {
      await disconnectDatabase();
      logger.info('Database disconnected cleanly');
    } catch (err) {
      logger.warn({ err }, 'Error disconnecting database');
    }

    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown completed successfully');

    if (process.env.NODE_ENV !== 'test') {
      process.exit(exitCode);
    }
  } catch (error) {
    logger.fatal({ err: error }, 'Critical error encountered during graceful shutdown');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
}

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    setupDocumentEventsSubscriber();
    setupAutomationEventsSubscriber();

    // Start in-process workers conditionally (disabled when running standalone worker replicas)
    if (env.ENABLE_IN_PROCESS_WORKERS) {
      startDocumentWorker();
      startEmailWorker();
      documentRecoveryService.startPeriodicReconciliation();
      logger.info('In-process workers and recovery sweeps active');
    } else {
      logger.info('In-process workers disabled (ENABLE_IN_PROCESS_WORKERS=false); running pure API service');
    }

    // Process-level OS signals
    process.once('SIGINT', () => void gracefulShutdown('SIGINT', 0));
    process.once('SIGTERM', () => void gracefulShutdown('SIGTERM', 0));

    // Process-level crash guards
    process.on('uncaughtException', (err: Error) => {
      logger.fatal({ err }, 'Uncaught exception at process level');
      void gracefulShutdown('uncaughtException', 1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.fatal({ err: reason }, 'Unhandled rejection at process level');
      void gracefulShutdown('unhandledRejection', 1);
    });

    httpServer.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, nodeEnv: env.NODE_ENV },
        `LeadFlow server listening on port ${env.PORT}`
      );
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  void startServer();
}

export { app, httpServer, io };
