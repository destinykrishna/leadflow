import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env, resolveTrustProxy, resolveCorsOrigin } from './config/env.js';
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
import { errorHandler } from './middleware/error.middleware.js';
import { NotFoundError } from './utils/errors.js';

export function createApp(): Express {
  const app = express();

  // Configure reverse proxy trust based on environment configuration
  // Defaults to 1 (trust immediate reverse proxy, e.g. Nginx, Docker network, Cloudflare, ALB)
  // Defends against IP spoofing by ignoring client-supplied forged X-Forwarded-For headers
  app.set('trust proxy', resolveTrustProxy(env.TRUST_PROXY));

  // Security headers
  app.use(helmet());

  // CORS configuration for SPA client with credentials (cookies)
  app.use(
    cors({
      origin: resolveCorsOrigin(env.CORS_ORIGIN),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
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

  // Root status endpoint for Render health checks and browser diagnostics
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'LeadFlow API',
      status: 'online',
      version: '1.0.0',
      health: '/api/health',
      timestamp: new Date().toISOString(),
    });
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
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

  // 404 Handler
  app.use((_req, _res, next) => {
    next(new NotFoundError('The requested resource was not found'));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
