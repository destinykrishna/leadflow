/**
 * bootstrap-platform-admin.ts
 *
 * Development / QA ONLY — never run in production.
 *
 * Creates exactly one PLATFORM_ADMIN in a fresh database.
 * Idempotent: if a PLATFORM_ADMIN already exists with the given email, exits cleanly.
 *
 * Required environment variables:
 *   PLATFORM_ADMIN_EMAIL     — e-mail address for the platform admin account
 *   PLATFORM_ADMIN_PASSWORD  — plaintext password (min 8 chars)
 *   MONGODB_URI              — MongoDB connection string (loaded from root .env by default)
 *   NODE_ENV                 — must NOT be "production"
 *
 * Usage:
 *   PLATFORM_ADMIN_EMAIL=admin@example.com \
 *   PLATFORM_ADMIN_PASSWORD=S3cur3Pa$$! \
 *   npm run bootstrap:admin
 */

import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/user.model.js';
import { hashPassword } from '../src/utils/password.js';

// ── Production guard ─────────────────────────────────────────────────────────
if (env.isProduction) {
  console.error(
    '[bootstrap-platform-admin] FATAL: This script must never run in production. ' +
      'Set NODE_ENV to "development" or "test".'
  );
  process.exit(1);
}

// ── Resolve credentials from environment ────────────────────────────────────
const adminEmail = process.env['PLATFORM_ADMIN_EMAIL'];
const adminPassword = process.env['PLATFORM_ADMIN_PASSWORD'];
const adminName = process.env['PLATFORM_ADMIN_NAME'] ?? 'Platform Admin';

if (!adminEmail || !adminEmail.includes('@')) {
  console.error(
    '[bootstrap-platform-admin] ERROR: PLATFORM_ADMIN_EMAIL is required and must be a valid email.'
  );
  process.exit(1);
}

if (!adminPassword || adminPassword.length < 8) {
  console.error(
    '[bootstrap-platform-admin] ERROR: PLATFORM_ADMIN_PASSWORD is required and must be at least 8 characters.'
  );
  process.exit(1);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrapPlatformAdmin(): Promise<void> {
  console.log(`[bootstrap-platform-admin] Connecting to: ${env.MONGODB_URI} …`);
  await mongoose.connect(env.MONGODB_URI);
  console.log('[bootstrap-platform-admin] Connected.');

  const existing = await User.findOne({
    email: adminEmail!.toLowerCase().trim(),
    role: 'PLATFORM_ADMIN',
  });

  if (existing) {
    console.log(
      `[bootstrap-platform-admin] PLATFORM_ADMIN already exists: ${existing.email} — nothing to do.`
    );
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await hashPassword(adminPassword!);

  await User.create({
    name: adminName,
    email: adminEmail!.toLowerCase().trim(),
    passwordHash,
    role: 'PLATFORM_ADMIN',
    status: 'ACTIVE',
    brokerageId: null,
  });

  console.log('\n======================================================');
  console.log('  PLATFORM_ADMIN bootstrap complete');
  console.log('======================================================');
  console.log(`  Email : ${adminEmail!.toLowerCase().trim()}`);
  console.log('  Login : POST /api/auth/login  (no brokerageId required)');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

bootstrapPlatformAdmin().catch((err: unknown) => {
  console.error('[bootstrap-platform-admin] Fatal error:', err);
  process.exit(1);
});
