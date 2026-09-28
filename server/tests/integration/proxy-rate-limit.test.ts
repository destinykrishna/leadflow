import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { resolveTrustProxy } from '../../src/config/env.js';

describe('Security Remediation VULN-04: Proxy Configuration & Auth Rate Limiting', () => {
  describe('1. resolveTrustProxy Configuration Parser', () => {
    it('correctly parses hop counts as integers', () => {
      expect(resolveTrustProxy('1')).toBe(1);
      expect(resolveTrustProxy('2')).toBe(2);
      expect(resolveTrustProxy(' 1 ')).toBe(1);
    });

    it('correctly parses boolean strings', () => {
      expect(resolveTrustProxy('true')).toBe(true);
      expect(resolveTrustProxy('false')).toBe(false);
    });

    it('preserves subnet or keyword strings', () => {
      expect(resolveTrustProxy('loopback')).toBe('loopback');
      expect(resolveTrustProxy('10.0.0.0/8')).toBe('10.0.0.0/8');
      expect(resolveTrustProxy('linklocal, uniquelocal')).toBe('linklocal, uniquelocal');
    });
  });

  describe('2. Client IP Derivation & Anti-Spoofing Defense', () => {
    it('derives real client IP behind a single reverse proxy (trust proxy = 1)', async () => {
      const app = express();
      app.set('trust proxy', resolveTrustProxy('1'));

      app.get('/test-ip', (req, res) => {
        res.json({ ip: req.ip, ips: req.ips });
      });

      const clientIp = '203.0.113.195';
      const res = await request(app)
        .get('/test-ip')
        .set('X-Forwarded-For', clientIp);

      expect(res.status).toBe(200);
      expect(res.body.ip).toBe(clientIp);
    });

    it('defends against client-injected X-Forwarded-For spoofing with trust proxy = 1', async () => {
      const app = express();
      app.set('trust proxy', resolveTrustProxy('1'));

      app.get('/test-ip', (req, res) => {
        res.json({ ip: req.ip, ips: req.ips });
      });

      // An attacker at 198.51.100.5 injects spoofed IP 1.2.3.4 into X-Forwarded-For.
      // The reverse proxy appends the real caller's IP to the header.
      // Header received by Express: "1.2.3.4, 198.51.100.5"
      const res = await request(app)
        .get('/test-ip')
        .set('X-Forwarded-For', '1.2.3.4, 198.51.100.5');

      expect(res.status).toBe(200);
      // Express with trust proxy = 1 trusts only 1 hop from right, selecting 198.51.100.5 (real client IP),
      // and completely ignores the spoofed 1.2.3.4!
      expect(res.body.ip).toBe('198.51.100.5');
      expect(res.body.ip).not.toBe('1.2.3.4');
    });

    it('falls back to local connection address when no proxy header is present (local development)', async () => {
      const app = express();
      app.set('trust proxy', resolveTrustProxy('1'));

      app.get('/test-ip', (req, res) => {
        res.json({ ip: req.ip });
      });

      const res = await request(app).get('/test-ip');
      expect(res.status).toBe(200);
      // Local supertest socket
      expect(['127.0.0.1', '::1', '::ffff:127.0.0.1']).toContain(res.body.ip);
    });
  });

  describe('3. IP-Based Rate Limiting with Proxy Support', () => {
    it('applies rate limiting based on the derived client IP behind a reverse proxy', async () => {
      const app = express();
      app.set('trust proxy', 1);

      const testLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 2, // max 2 requests per IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'TOO_MANY_REQUESTS' },
      });

      app.use('/auth/test-limit', testLimiter, (_req, res) => {
        res.json({ ok: true });
      });

      const clientA = '198.51.100.10';
      const clientB = '198.51.100.20';

      // Client A: Request 1 -> 200
      const resA1 = await request(app)
        .get('/auth/test-limit')
        .set('X-Forwarded-For', clientA);
      expect(resA1.status).toBe(200);

      // Client A: Request 2 -> 200
      const resA2 = await request(app)
        .get('/auth/test-limit')
        .set('X-Forwarded-For', clientA);
      expect(resA2.status).toBe(200);

      // Client A: Request 3 -> 429
      const resA3 = await request(app)
        .get('/auth/test-limit')
        .set('X-Forwarded-For', clientA);
      expect(resA3.status).toBe(429);
      expect(resA3.body.error).toBe('TOO_MANY_REQUESTS');

      // Client B: Request 1 -> 200 (not affected by Client A's rate exhaustion)
      const resB1 = await request(app)
        .get('/auth/test-limit')
        .set('X-Forwarded-For', clientB);
      expect(resB1.status).toBe(200);
    });
  });
});
