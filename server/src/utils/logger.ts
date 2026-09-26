import pino from 'pino';
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
