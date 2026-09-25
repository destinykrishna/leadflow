import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.isTest ? (process.env['LOG_LEVEL'] ?? 'silent') : env.LOG_LEVEL,
  base: {
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
