import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export type DatabaseConnectionState =
  | 'disconnected'
  | 'connected'
  | 'connecting'
  | 'disconnecting'
  | 'uninitialized';

const stateMap: Record<number, DatabaseConnectionState> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let listenersRegistered = false;

/**
 * Register connection lifecycle listeners for monitoring and diagnostics.
 */
function registerConnectionListeners(): void {
  if (listenersRegistered) return;

  mongoose.connection.on('connected', () => {
    logger.info({ host: mongoose.connection.host, name: mongoose.connection.name }, 'MongoDB connected');
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error({ err }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });

  listenersRegistered = true;
}

/**
 * Connect to MongoDB with sensible defaults.
 * Idempotent: if already connected or connecting, returns existing connection.
 */
export async function connectDatabase(
  uri?: string,
  options?: mongoose.ConnectOptions
): Promise<typeof mongoose> {
  const targetUri = uri ?? env.MONGODB_URI;

  if (mongoose.connection.readyState === 1) {
    logger.debug('MongoDB already connected');
    return mongoose;
  }

  registerConnectionListeners();

  const defaultOptions: mongoose.ConnectOptions = {
    autoIndex: !env.isProduction,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    ...options,
  };

  try {
    const conn = await mongoose.connect(targetUri, defaultOptions);
    logger.info({ uri: targetUri.replace(/\/\/[^@]+@/, '//***@') }, 'Connected to MongoDB');
    return conn;
  } catch (error) {
    logger.error({ err: error, uri: targetUri.replace(/\/\/[^@]+@/, '//***@') }, 'Failed to connect to MongoDB');
    throw error;
  }
}

/**
 * Disconnect from MongoDB gracefully.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error({ err: error }, 'Error disconnecting from MongoDB');
    throw error;
  }
}

/**
 * Check whether the database is actively connected.
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Get human-readable connection state.
 */
export function getDatabaseConnectionState(): DatabaseConnectionState {
  return stateMap[mongoose.connection.readyState] ?? 'uninitialized';
}

/**
 * Registers process signal handlers to ensure clean DB shutdown.
 */
export function registerDatabaseShutdownHook(): void {
  const handleShutdown = async (signal: string) => {
    logger.info({ signal }, 'Closing database connection on shutdown signal');
    try {
      await disconnectDatabase();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  };

  process.once('SIGINT', () => handleShutdown('SIGINT'));
  process.once('SIGTERM', () => handleShutdown('SIGTERM'));
}
