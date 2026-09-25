import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const DEFAULT_SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt with standard salt rounds.
 */
export async function hashPassword(
  password: string,
  saltRounds: number = DEFAULT_SALT_ROUNDS
): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Securely hashes an opaque token or refresh token using SHA-256
 * to avoid storing plaintext tokens in persistent storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
