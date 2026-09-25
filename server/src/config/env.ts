import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/leadflow'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  JWT_SECRET: z
    .string()
    .min(16)
    .default('leadflow-jwt-super-secret-access-token-key-min32chars!'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default('leadflow-jwt-super-secret-refresh-token-key-min32chars!'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('leadflow-secure-cookie-secret-key-development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  IMAGEKIT_PUBLIC_KEY: z.string().default('public_mock_imagekit_key'),
  IMAGEKIT_PRIVATE_KEY: z.string().default('private_mock_imagekit_key'),
  IMAGEKIT_URL_ENDPOINT: z.string().default('https://ik.imagekit.io/leadflow_test'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),
  REDIS_URL: z.string().optional(),
  DOCUMENT_PROCESSING_CONCURRENCY: z.coerce.number().int().positive().default(5),
  DOCUMENT_PROCESSING_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
};

export type Env = typeof env;
