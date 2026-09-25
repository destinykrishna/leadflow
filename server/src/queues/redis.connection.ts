import { Redis, type RedisOptions } from 'ioredis';
import type { ConnectionOptions } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let sharedRedisClient: Redis | null = null;
let sharedSubscriberClient: Redis | null = null;

/**
 * Returns connection options configured for BullMQ.
 * BullMQ strictly requires `maxRetriesPerRequest: null`.
 */
export function getBullMQConnectionOptions(): ConnectionOptions {
  if (env.REDIS_URL) {
    const url = new URL(env.REDIS_URL);
    const opts: ConnectionOptions = {
      host: url.hostname,
      port: Number(url.port) || 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
    if (url.password) {
      opts.password = url.password;
    }
    if (url.pathname && url.pathname.length > 1) {
      opts.db = Number(url.pathname.slice(1)) || 0;
    }
    return opts;
  }

  const options: ConnectionOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (env.REDIS_PASSWORD) {
    options.password = env.REDIS_PASSWORD;
  }

  return options;
}

/**
 * Returns connection options configured for direct ioredis clients.
 */
export function getRedisConnectionOptions(): RedisOptions {
  if (env.REDIS_URL) {
    return {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }

  const options: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
  };

  if (env.REDIS_PASSWORD) {
    options.password = env.REDIS_PASSWORD;
  }

  return options;
}

/**
 * Creates a new dedicated Redis connection.
 * Useful for subscribers or custom Redis operations.
 */
export function createRedisConnection(customOptions?: Partial<RedisOptions>): Redis {
  const baseOptions = getRedisConnectionOptions();
  const mergedOptions = { ...baseOptions, ...customOptions };

  let client: Redis;
  if (env.REDIS_URL) {
    client = new (Redis as any)(env.REDIS_URL, mergedOptions);
  } else {
    client = new (Redis as any)(mergedOptions);
  }

  client.on('error', (err) => {
    logger.error({ err: err.message }, 'Redis client connection error');
  });

  return client;
}

/**
 * Returns or initializes a shared Redis client instance.
 */
export function getSharedRedisClient(): Redis {
  if (!sharedRedisClient) {
    sharedRedisClient = createRedisConnection();
  }
  return sharedRedisClient;
}

/**
 * Returns or initializes a dedicated subscriber Redis client instance.
 */
export function getSharedSubscriberClient(): Redis {
  if (!sharedSubscriberClient) {
    sharedSubscriberClient = createRedisConnection();
  }
  return sharedSubscriberClient;
}

/**
 * Gracefully closes all shared Redis connections.
 */
export async function closeRedisConnections(): Promise<void> {
  const closePromises: Promise<unknown>[] = [];

  if (sharedRedisClient) {
    closePromises.push(sharedRedisClient.quit().catch(() => sharedRedisClient?.disconnect()));
    sharedRedisClient = null;
  }

  if (sharedSubscriberClient) {
    closePromises.push(
      sharedSubscriberClient.quit().catch(() => sharedSubscriberClient?.disconnect())
    );
    sharedSubscriberClient = null;
  }

  await Promise.all(closePromises);
  logger.debug('Shared Redis connections closed cleanly');
}
