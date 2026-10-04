import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env, resolveTrustProxy, resolveCorsOrigin } from './config/env.js';
import { httpLogger } from './utils/logger.js';
import { isDatabaseConnected, getDatabaseConnectionState } from './config/database.js';
import { checkRedisHealth } from './queues/redis.connection.js';
import { authRouter } from './routes/auth.routes.js';
import { brokerageRouter } from './routes/brokerage.routes.js';
import { clientRouter } from './routes/client.routes.js';
import { documentRouter } from './routes/document.routes.js';
import { leadRouter } from './routes/lead.routes.js';
import { taskRouter } from './routes/task.routes.js';
import { triggerRouter } from './routes/trigger.routes.js';
import { emailTemplateRouter } from './routes/email-template.routes.js';
import { advisorRouter } from './routes/advisor.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { emailWebhookRouter } from './routes/email-webhook.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { NotFoundError } from './utils/errors.js';

export function createApp(): Express {
  const app = express();

  // Configure reverse proxy trust based on environment configuration
  // Defaults to 1 (trust immediate reverse proxy, e.g. Nginx, Docker network, Cloudflare, ALB)
  // Defends against IP spoofing by ignoring client-supplied forged X-Forwarded-For headers
  app.set('trust proxy', resolveTrustProxy(env.TRUST_PROXY));

  // Request correlation and structured HTTP logging
  app.use(httpLogger);

  // Security headers
  app.use(helmet());

  // CORS configuration for SPA client with credentials (cookies)
  app.use(
    cors({
      origin: resolveCorsOrigin(env.CORS_ORIGIN),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    })
  );

  // Cookie parser for HTTP-only refresh tokens
  app.use(cookieParser(env.COOKIE_SECRET));

  // Body parsing (preserves raw buffer for cryptographic webhook HMAC verification)
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Auth rate limiter to defend against brute force attempts (disabled during automated tests)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => env.isTest || (env.isDevelopment && req.headers['x-qa-bypass-rate-limit'] === 'true'),
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later.',
      },
    },
  });

  // --- Health & Diagnostic Endpoints ---

  // Liveness probe: verifies process is alive and accepting connections
  const handleLiveness = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/health/live', handleLiveness);
  app.get('/api/health/live', handleLiveness);

  // Readiness probe: verifies MongoDB and Redis dependencies
  const handleReadiness = async (_req: express.Request, res: express.Response) => {
    const isDbReady = isDatabaseConnected();
    const dbState = getDatabaseConnectionState();
    const redisHealth = await checkRedisHealth();

    // In unit/integration tests running without Redis, permit passing unless explicitly required
    const isRedisReady = redisHealth.ok || (env.isTest && !process.env['REQUIRE_REDIS_FOR_TESTS']);
    const isHealthy = isDbReady && isRedisReady;

    const payload = {
      status: isHealthy ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: isDbReady ? 'up' : 'down',
          state: dbState,
        },
        redis: {
          status: redisHealth.ok ? 'up' : 'down',
          ...(redisHealth.latencyMs !== undefined ? { latencyMs: redisHealth.latencyMs } : {}),
          ...(redisHealth.error ? { error: redisHealth.error } : {}),
        },
      },
    };

    res.status(isHealthy ? 200 : 503).json(payload);
  };

  app.get('/health/ready', handleReadiness);
  app.get('/api/health/ready', handleReadiness);

  // Backward-compatible standard health check endpoints (default to readiness)
  app.get('/health', handleReadiness);
  app.get('/api/health', handleReadiness);

  // Root status endpoint for Render health checks and browser diagnostics
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'LeadFlow API',
      status: 'online',
      version: '1.0.0',
      health: '/api/health',
      live: '/api/health/live',
      ready: '/api/health/ready',
      timestamp: new Date().toISOString(),
    });
  });


  // Auth routes
  app.use('/api/auth', authLimiter, authRouter);

  // Brokerage & Multi-tenant resource routes
  app.use('/api/brokerages', brokerageRouter);
  app.use('/api/leads', leadRouter);
  app.use('/api/clients', clientRouter);
  app.use('/api/documents', documentRouter);
  app.use('/api/tasks', taskRouter);
  app.use('/api/triggers', triggerRouter);
  app.use('/api/email-templates', emailTemplateRouter);
  app.use('/api/advisors', advisorRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/webhooks/email', emailWebhookRouter);

  // 404 Handler
  app.use((_req, _res, next) => {
    next(new NotFoundError('The requested resource was not found'));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
