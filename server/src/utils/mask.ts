/**
 * Masks email address for safe logging without exposing PII.
 * Example: 'alex.expat@gmail.com' -> 'a***t@gmail.com'
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return '***@***';
  }
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return '***@***';
  }
  const name = parts[0];
  const domain = parts[1];
  const maskedLocal = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedLocal}@${domain}`;
}
