import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.routes.js';
import { brokerageRouter } from './routes/brokerage.routes.js';
import { clientRouter } from './routes/client.routes.js';
import { documentRouter } from './routes/document.routes.js';
import { leadRouter } from './routes/lead.routes.js';
import { taskRouter } from './routes/task.routes.js';
import { triggerRouter } from './routes/trigger.routes.js';
import { emailTemplateRouter } from './routes/email-template.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { NotFoundError } from './utils/errors.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration for SPA client with credentials (cookies)
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Cookie parser for HTTP-only refresh tokens
  app.use(cookieParser(env.COOKIE_SECRET));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Auth rate limiter to defend against brute force attempts (disabled during automated tests)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.isTest,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, please try again later.',
      },
    },
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

  // 404 Handler
  app.use((_req, _res, next) => {
    next(new NotFoundError('The requested resource was not found'));
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
