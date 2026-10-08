import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load root .env first (monorepo single source of truth), with cwd fallback
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/leadflow'),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().int().positive().default(10),
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
  WEBHOOK_BASE_URL: z.string().url().optional(),
  LEADFLOW_WEBHOOK_SECRET: z.string().optional(),
  IMAGEKIT_PUBLIC_KEY: z.string().default('public_mock_imagekit_key'),
  IMAGEKIT_PRIVATE_KEY: z.string().default('private_mock_imagekit_key'),
  IMAGEKIT_URL_ENDPOINT: z.string().default('https://ik.imagekit.io/leadflow_test'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),
  REDIS_URL: z.string().optional(),
  DOCUMENT_PROCESSING_CONCURRENCY: z.coerce.number().int().positive().default(5),
  DOCUMENT_PROCESSING_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
  PENDING_DOCUMENT_RECOVERY_THRESHOLD_MS: z.coerce.number().int().nonnegative().default(15000),
  STALLED_DOCUMENT_RECOVERY_THRESHOLD_MS: z.coerce.number().int().nonnegative().default(300000),
  RECONCILIATION_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  ENABLE_IN_PROCESS_WORKERS: z.coerce.boolean().default(true),
  TRUST_PROXY: z.string().default('1'),
  EMAIL_PROVIDER: z.enum(['mock', 'resend']).default('mock'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SIGNING_SECRET: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().default('notifications@leadflow.io'),
  EMAIL_FROM_NAME: z.string().default('LeadFlow Notifications'),
  EMAIL_REPLY_TO: z.string().optional(),
});

export const DEV_DEFAULT_SECRETS = {
  JWT_SECRET: 'leadflow-jwt-super-secret-access-token-key-min32chars!',
  JWT_REFRESH_SECRET: 'leadflow-jwt-super-secret-refresh-token-key-min32chars!',
  COOKIE_SECRET: 'leadflow-secure-cookie-secret-key-development',
  IMAGEKIT_PUBLIC_KEY: 'public_mock_imagekit_key',
  IMAGEKIT_PRIVATE_KEY: 'private_mock_imagekit_key',
  RESEND_API_KEY: 're_dev_mock_key_0000000000000000',
  RESEND_WEBHOOK_SIGNING_SECRET: 'whsec_dev_mock_secret_00000000000000',
} as const;

/**
 * Validates security invariants when running in production mode:
 * - HARD-02: Fails startup if JWT, refresh-token, cookie, or ImageKit secrets use default development values
 * - HARD-05: Requires explicit HTTPS CORS origin, rejecting localhost/127.0.0.1/wildcard defaults
 * - EMAIL-01: Prohibits mock email provider in production, enforcing real Resend API credentials and webhook secret
 */
export function validateProductionSecurity(data: Partial<z.infer<typeof envSchema>>): void {
  if (data.NODE_ENV !== 'production') {
    return;
  }

  // 1. HARD-02: Production secret enforcement
  const secretViolations: string[] = [];
  if (data.JWT_SECRET === DEV_DEFAULT_SECRETS.JWT_SECRET) {
    secretViolations.push('JWT_SECRET');
  }
  if (data.JWT_REFRESH_SECRET === DEV_DEFAULT_SECRETS.JWT_REFRESH_SECRET) {
    secretViolations.push('JWT_REFRESH_SECRET');
  }
  if (data.COOKIE_SECRET === DEV_DEFAULT_SECRETS.COOKIE_SECRET) {
    secretViolations.push('COOKIE_SECRET');
  }
  if (data.IMAGEKIT_PRIVATE_KEY === DEV_DEFAULT_SECRETS.IMAGEKIT_PRIVATE_KEY) {
    secretViolations.push('IMAGEKIT_PRIVATE_KEY');
  }
  if (data.IMAGEKIT_PUBLIC_KEY === DEV_DEFAULT_SECRETS.IMAGEKIT_PUBLIC_KEY) {
    secretViolations.push('IMAGEKIT_PUBLIC_KEY');
  }

  // EMAIL-01: Production email provider validation
  if (data.EMAIL_PROVIDER === 'mock') {
    throw new Error(
      'Production startup aborted: Insecure EMAIL_PROVIDER mock is prohibited in production. Set EMAIL_PROVIDER=resend and configure valid credentials.'
    );
  }

  if (data.EMAIL_PROVIDER === 'resend') {
    if (
      !data.RESEND_API_KEY ||
      data.RESEND_API_KEY === DEV_DEFAULT_SECRETS.RESEND_API_KEY ||
      data.RESEND_API_KEY.length < 16
    ) {
      secretViolations.push('RESEND_API_KEY');
    }
    if (
      !data.RESEND_WEBHOOK_SIGNING_SECRET ||
      data.RESEND_WEBHOOK_SIGNING_SECRET === DEV_DEFAULT_SECRETS.RESEND_WEBHOOK_SIGNING_SECRET
    ) {
      secretViolations.push('RESEND_WEBHOOK_SIGNING_SECRET');
    }
  }

  if (secretViolations.length > 0) {
    throw new Error(
      `Production startup aborted: Insecure development/default secret detected for [${secretViolations.join(', ')}]. Provide dedicated, cryptographically strong secrets in production.`
    );
  }

  // 2. HARD-05: Production CORS origin validation
  const origins = (data.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0) {
    throw new Error(
      'Production startup aborted: CORS_ORIGIN is required in production. Must specify explicit HTTPS origin(s).'
    );
  }

  for (const origin of origins) {
    const lower = origin.toLowerCase();
    if (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('0.0.0.0') ||
      lower === '*'
    ) {
      throw new Error(
        'Production startup aborted: Insecure CORS_ORIGIN detected in production. Localhost, 127.0.0.1, 0.0.0.0, and wildcard * are prohibited in production.'
      );
    }

    if (!origin.startsWith('https://')) {
      throw new Error(
        'Production startup aborted: Insecure CORS_ORIGIN detected in production. Production origins must use HTTPS.'
      );
    }
  }
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

// Enforce production security rules
validateProductionSecurity(parsed.data);

/**
 * Resolves Express 'trust proxy' setting from string representation:
 * - 'true' -> true (trust all proxies)
 * - 'false' -> false (disabled)
 * - '1' or integer -> number of hops to trust from the front (standard reverse proxy)
 * - 'loopback' / CIDR / subnet -> trusted subnet string
 */
export function resolveTrustProxy(value: string): boolean | number | string {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const num = Number(trimmed);
  if (!Number.isNaN(num) && Number.isInteger(num) && num >= 0) {
    return num;
  }
  return trimmed;
}

/**
 * Resolves CORS origin configuration from string (supporting comma-separated origins).
 */
export function resolveCorsOrigin(corsOrigin: string): string | string[] {
  const list = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  return list.length === 1 ? list[0]! : list;
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
};

export type Env = typeof env;

