import { describe, it, expect, vi, afterEach } from 'vitest';
import { getBullMQConnectionOptions, getRedisConnectionOptions } from '../../src/queues/redis.connection.js';
import { env } from '../../src/config/env.js';

describe('Redis & BullMQ Connection Options Unit Tests', () => {
  const originalRedisUrl = env.REDIS_URL;
  const originalIsTest = env.isTest;
  const originalRedisUsername = env.REDIS_USERNAME;
  const originalRedisPassword = env.REDIS_PASSWORD;

  afterEach(() => {
    (env as any).REDIS_URL = originalRedisUrl;
    (env as any).isTest = originalIsTest;
    (env as any).REDIS_USERNAME = originalRedisUsername;
    (env as any).REDIS_PASSWORD = originalRedisPassword;
  });

  describe('getBullMQConnectionOptions', () => {
    it('should correctly parse ACL username, password, db, and TLS from REDIS_URL', () => {
      (env as any).isTest = false;
      (env as any).REDIS_URL = 'rediss://custom_user:secret_pass@redis.example.com:6380/2';

      const opts = getBullMQConnectionOptions() as any;

      expect(opts.host).toBe('redis.example.com');
      expect(opts.port).toBe(6380);
      expect(opts.username).toBe('custom_user');
      expect(opts.password).toBe('secret_pass');
      expect(opts.db).toBe(2);
      expect(opts.tls).toEqual({ rejectUnauthorized: false });
      expect(opts.maxRetriesPerRequest).toBeNull();
    });

    it('should handle password-only REDIS_URL without setting an empty username', () => {
      (env as any).isTest = false;
      (env as any).REDIS_URL = 'redis://:only_password@cache.local:6379/1';

      const opts = getBullMQConnectionOptions() as any;

      expect(opts.host).toBe('cache.local');
      expect(opts.port).toBe(6379);
      expect(opts.password).toBe('only_password');
      expect(opts.username).toBeUndefined();
      expect(opts.db).toBe(1);
      expect(opts.tls).toBeUndefined();
    });

    it('should support discrete REDIS_USERNAME and REDIS_PASSWORD env vars in fallback mode', () => {
      (env as any).isTest = false;
      (env as any).REDIS_URL = undefined;
      (env as any).REDIS_USERNAME = 'broker_acl_user';
      (env as any).REDIS_PASSWORD = 'strong_password';

      const opts = getBullMQConnectionOptions() as any;

      expect(opts.username).toBe('broker_acl_user');
      expect(opts.password).toBe('strong_password');
      expect(opts.host).toBe(env.REDIS_HOST);
      expect(opts.port).toBe(env.REDIS_PORT);
      expect(opts.maxRetriesPerRequest).toBeNull();
    });
  });

  describe('getRedisConnectionOptions', () => {
    it('should support discrete REDIS_USERNAME in fallback mode', () => {
      (env as any).isTest = false;
      (env as any).REDIS_URL = undefined;
      (env as any).REDIS_USERNAME = 'direct_user';
      (env as any).REDIS_PASSWORD = 'direct_password';

      const opts = getRedisConnectionOptions();

      expect(opts.username).toBe('direct_user');
      expect(opts.password).toBe('direct_password');
    });
  });
});
