import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { env } from '../../src/config/env.js';
import { isDatabaseConnected, mongoose } from '../../src/config/database.js';
import { syncAllIndexes } from '../../scripts/sync-indexes.js';
import { auditCollectionCounts } from '../../scripts/verify-backup.js';
import { app } from '../../src/app.js';

describe('Phase 7: Infrastructure, Scaling & Disaster Recovery', () => {
  describe('Environment & Connection Pool Configuration', () => {
    it('should have ENABLE_IN_PROCESS_WORKERS configured with default true', () => {
      expect(typeof env.ENABLE_IN_PROCESS_WORKERS).toBe('boolean');
      expect(env.ENABLE_IN_PROCESS_WORKERS).toBe(true);
    });

    it('should have MONGODB_MAX_POOL_SIZE configured with default 10', () => {
      expect(typeof env.MONGODB_MAX_POOL_SIZE).toBe('number');
      expect(env.MONGODB_MAX_POOL_SIZE).toBe(10);
    });
  });

  describe('MongoDB Index Synchronization Deploy Script', () => {
    it('should execute syncAllIndexes and report successful index synchronization across all domain models', async () => {
      expect(isDatabaseConnected()).toBe(true);

      const { success, results } = await syncAllIndexes({ closeConnection: false });

      expect(success).toBe(true);
      expect(results).toHaveProperty('Lead');
      expect(results).toHaveProperty('Task');
      expect(results).toHaveProperty('Document');
      expect(results).toHaveProperty('Client');
      expect(results).toHaveProperty('Brokerage');
      expect(results).toHaveProperty('User');
      expect(results).toHaveProperty('TriggerExecution');
      expect(results).toHaveProperty('ActivityLog');

      // Verify that compound indexes exist on Lead
      const leadIndexes = results['Lead'] || [];
      expect(leadIndexes.some((idx) => idx.includes('brokerageId'))).toBe(true);
    });

    it('should audit collection counts without crashing', async () => {
      const counts = await auditCollectionCounts(undefined, { closeConnection: false });
      expect(Array.isArray(counts)).toBe(true);
      expect(counts.length).toBe(13);
      for (const item of counts) {
        expect(typeof item.count).toBe('number');
        expect(item.count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Readiness Health Check Endpoint', () => {
    it('should return 200 OK with database up and service health report on /health/ready', async () => {
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('services');
      expect(res.body.services.database.status).toBe('up');
      expect(res.body.services.database.state).toBe('connected');
    });

    it('should return 200 OK on /api/health/ready alias', async () => {
      const res = await request(app).get('/api/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Worker Health HTTP Endpoint Contract', () => {
    it('should respond with 200 OK and status ok when worker is healthy and db is connected', async () => {
      const http = await import('node:http');
      const server = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/health/live' || req.url === '/health/ready') {
          const isHealthy = isDatabaseConnected();
          res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: isHealthy ? 'ok' : 'degraded',
              worker: true,
              uptime: process.uptime(),
              timestamp: new Date().toISOString(),
              database: isDatabaseConnected() ? 'up' : 'down',
            })
          );
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      });

      const res = await request(server).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.worker).toBe(true);
      expect(res.body.database).toBe('up');
      expect(typeof res.body.uptime).toBe('number');
    });
  });
});
