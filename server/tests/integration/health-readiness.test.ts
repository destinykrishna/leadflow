import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import * as dbConfig from '../../src/config/database.js';
import * as redisConn from '../../src/queues/redis.connection.js';

describe('Production Readiness — Health Checks & Observability Integration Tests', () => {
  describe('Liveness Probe (/health/live & /api/health/live)', () => {
    it('should return 200 OK with uptime and timestamp', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('string');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('should support /api/health/live alias identically', async () => {
      const res = await request(app).get('/api/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
    });
  });

  describe('Request Correlation (X-Request-Id)', () => {
    it('should automatically generate and set X-Request-Id header on response if not provided', async () => {
      const res = await request(app).get('/health/live');

      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should preserve and propagate incoming X-Request-Id header', async () => {
      const customTraceId = 'trace-audit-corp-998877';
      const res = await request(app)
        .get('/health/live')
        .set('X-Request-Id', customTraceId);

      expect(res.headers['x-request-id']).toBe(customTraceId);
    });
  });

  describe('Readiness Probe (/health/ready & /api/health/ready)', () => {
    it('should return 200 OK with dependency statuses when dependencies are healthy', async () => {
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.services).toBeDefined();
      expect(res.body.services.database.status).toBe('up');
      expect(res.body.services.database.state).toBe('connected');
    });

    it('should return 503 degraded when database connection is down', async () => {
      const isDbConnectedSpy = vi.spyOn(dbConfig, 'isDatabaseConnected').mockReturnValue(false);
      const dbStateSpy = vi.spyOn(dbConfig, 'getDatabaseConnectionState').mockReturnValue('disconnected');

      try {
        const res = await request(app).get('/health/ready');

        expect(res.status).toBe(503);
        expect(res.body.status).toBe('degraded');
        expect(res.body.services.database.status).toBe('down');
        expect(res.body.services.database.state).toBe('disconnected');
      } finally {
        isDbConnectedSpy.mockRestore();
        dbStateSpy.mockRestore();
      }
    });

    it('should return 503 degraded when Redis is down in non-test mode', async () => {
      const redisHealthSpy = vi.spyOn(redisConn, 'checkRedisHealth').mockResolvedValue({
        ok: false,
        error: 'ECONNREFUSED 127.0.0.1:6379',
      });

      // Temporarily simulate non-test environment to test production behavior
      const envModule = await import('../../src/config/env.js');
      const originalIsTest = envModule.env.isTest;
      (envModule.env as any).isTest = false;

      try {
        const res = await request(app).get('/health/ready');

        expect(res.status).toBe(503);
        expect(res.body.status).toBe('degraded');
        expect(res.body.services.redis.status).toBe('down');
        expect(res.body.services.redis.error).toContain('ECONNREFUSED');
      } finally {
        (envModule.env as any).isTest = originalIsTest;
        redisHealthSpy.mockRestore();
      }
    });
  });

  describe('Backward-Compatible Endpoints (/health, /api/health, /)', () => {
    it('GET /health returns 200 with status ok and uptime', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
    });

    it('GET /api/health returns 200 with status ok and uptime', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
    });

    it('GET / returns 200 with diagnostics and links to live/ready/health', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('online');
      expect(res.body.live).toBe('/api/health/live');
      expect(res.body.ready).toBe('/api/health/ready');
      expect(res.body.health).toBe('/api/health');
    });
  });
});
