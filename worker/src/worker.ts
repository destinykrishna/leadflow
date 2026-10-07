process.env.IS_WORKER = 'true';

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http, { type Server as HttpServer } from 'node:http';
import dotenv from 'dotenv';
import { pino, type LoggerOptions } from 'pino';
import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  onDatabaseConnected,
  onDatabaseDisconnected,
} from '../../server/src/config/database.js';
import {
  startDocumentWorker,
  closeDocumentWorker,
  pauseDocumentWorker,
  resumeDocumentWorker,
} from '../../server/src/queues/document.worker.js';
import { closeDocumentQueue } from '../../server/src/queues/document.queue.js';
import {
  startEmailWorker,
  closeEmailWorker,
  pauseEmailWorker,
  resumeEmailWorker,
} from '../../server/src/queues/email.worker.js';
import { closeEmailQueue } from '../../server/src/queues/email.queue.js';
import { closeRedisConnections, checkRedisHealth } from '../../server/src/queues/redis.connection.js';
import { documentRecoveryService } from '../../server/src/queues/document-recovery.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load root .env first (monorepo single source of truth), with cwd fallback
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const isDev = (process.env.NODE_ENV || 'development') === 'development';

const workerLoggerOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
};

const logger = pino(workerLoggerOptions);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadflow';

async function startWorkerProcess(): Promise<void> {
  try {
    logger.info('Starting LeadFlow Background Worker process...');

    // 1. Connect using shared database connection manager so all models share the connected instance
    await connectDatabase(MONGODB_URI);

    if (!isDatabaseConnected()) {
      throw new Error('Worker MongoDB connection failed: database readyState is not connected');
    }
    logger.info('Worker MongoDB connected and verified successfully');

    // 2. Register lifecycle event handlers for connection loss and recovery
    onDatabaseDisconnected(() => {
      logger.warn('MongoDB connection lost in worker process: pausing BullMQ workers');
      void pauseDocumentWorker();
      void pauseEmailWorker();
    });

    onDatabaseConnected(() => {
      logger.info('MongoDB connected/reconnected in worker process: resuming BullMQ workers and catching up reconciliation');
      resumeDocumentWorker();
      resumeEmailWorker();
      void documentRecoveryService.reconcileAll().catch((err) => {
        logger.warn({ err }, 'Catch-up reconciliation after DB reconnection failed');
      });
    });

    // 3. Start workers and periodic reconciliation only after DB is verified ready
    startDocumentWorker();
    startEmailWorker();
    documentRecoveryService.startPeriodicReconciliation();
    logger.info('Document & email processing workers actively polling for jobs with periodic reconciliation');

    // Render injects PORT dynamically; prioritize process.env.PORT over legacy WORKER_HEALTH_PORT
    const WORKER_HEALTH_PORT = Number(process.env.PORT || process.env.WORKER_HEALTH_PORT || 5001);
    let isShuttingDown = false;

    // 4. Lightweight HTTP healthcheck endpoint for Render / Docker orchestration probes
    const healthServer: HttpServer = http.createServer(async (req, res) => {
      if (req.url === '/health' || req.url === '/health/live' || req.url === '/health/ready') {
        const dbConnected = isDatabaseConnected();
        let redisHealthy = true;
        let redisLatencyMs: number | undefined;

        if (req.url === '/health/ready' || req.url === '/health') {
          const redisCheck = await checkRedisHealth(1500);
          redisHealthy = redisCheck.ok;
          redisLatencyMs = redisCheck.latencyMs;
        }

        const isHealthy = !isShuttingDown && dbConnected && redisHealthy;
        res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: isHealthy ? 'ok' : 'degraded',
            worker: true,
            uptime: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
            database: dbConnected ? 'up' : 'down',
            redis: redisHealthy ? 'up' : 'down',
            ...(redisLatencyMs !== undefined ? { redisLatencyMs } : {}),
          })
        );
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    // Explicitly bind to 0.0.0.0 for seamless container and Render reverse proxy routing
    healthServer.listen(WORKER_HEALTH_PORT, '0.0.0.0', () => {
      logger.info(
        { port: WORKER_HEALTH_PORT, host: '0.0.0.0' },
        `Worker health check endpoint listening on 0.0.0.0:${WORKER_HEALTH_PORT}`
      );
    });

    const shutdown = async (signal: string, exitCode = 0) => {
      if (isShuttingDown) {
        logger.warn({ signal }, 'Worker shutdown already in progress, ignoring duplicate signal');
        return;
      }
      isShuttingDown = true;
      logger.info({ signal }, 'Graceful shutdown initiated for background worker');

      const forceExitTimer = setTimeout(() => {
        logger.fatal('Worker graceful shutdown timed out after 10s. Forcing exit.');
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      try {
        await new Promise<void>((resolve) => healthServer.close(() => resolve()));
        documentRecoveryService.stopPeriodicReconciliation();
        await closeDocumentWorker();
        await closeDocumentQueue();
        await closeEmailWorker();
        await closeEmailQueue();
        await closeRedisConnections();
        await disconnectDatabase();
        clearTimeout(forceExitTimer);
        logger.info('Worker shutdown completed cleanly');
        if (process.env.NODE_ENV !== 'test') {
          process.exit(exitCode);
        }
      } catch (err) {
        logger.error({ err }, 'Error during worker shutdown');
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
      }
    };

    process.once('SIGINT', () => void shutdown('SIGINT', 0));
    process.once('SIGTERM', () => void shutdown('SIGTERM', 0));

    process.on('uncaughtException', (err: Error) => {
      logger.fatal({ err }, 'Uncaught exception detected in worker process');
      void shutdown('uncaughtException', 1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.fatal({ err: reason }, 'Unhandled promise rejection detected in worker process');
      void shutdown('unhandledRejection', 1);
    });
  } catch (error) {
    logger.error({ err: error }, 'Worker process startup failed');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  void startWorkerProcess();
}

export { startWorkerProcess };
