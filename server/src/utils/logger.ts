import crypto from 'node:crypto';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { env } from '../config/env.js';

const isDev = env.isDevelopment && !env.isTest;

const loggerOptions: pino.LoggerOptions = {
  level: env.isTest ? (process.env['LOG_LEVEL'] ?? 'silent') : env.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
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
    : {
        base: {
          env: env.NODE_ENV,
        },
      }),
};

export const logger = pino(loggerOptions);

export type Logger = typeof logger;

/**
 * HTTP request logging middleware with X-Request-Id correlation.
 * Generates a unique UUID or propagates the incoming X-Request-Id header.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = (Array.isArray(existing) ? existing[0] : existing) || crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  autoLogging: {
    ignore: (req) => {
      // Avoid log clutter from periodic high-frequency liveness checks
      return req.url === '/health/live' || req.url === '/api/health/live';
    },
  },
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

