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

export { mongoose };

type ConnectionCallback = () => void | Promise<void>;

const connectCallbacks: Set<ConnectionCallback> = new Set();
const disconnectCallbacks: Set<ConnectionCallback> = new Set();

/**
 * Registers a callback invoked when the database connects or reconnects.
 * If already connected, the callback is invoked immediately.
 */
export function onDatabaseConnected(callback: ConnectionCallback): () => void {
  connectCallbacks.add(callback);
  if (isDatabaseConnected()) {
    try {
      void callback();
    } catch (err) {
      logger.error({ err }, 'Error in onDatabaseConnected callback');
    }
  }
  return () => {
    connectCallbacks.delete(callback);
  };
}

/**
 * Registers a callback invoked when the database disconnects or errors.
 */
export function onDatabaseDisconnected(callback: ConnectionCallback): () => void {
  disconnectCallbacks.add(callback);
  return () => {
    disconnectCallbacks.delete(callback);
  };
}

let listenersRegistered = false;

/**
 * Register connection lifecycle listeners for monitoring and diagnostics.
 */
function registerConnectionListeners(): void {
  if (listenersRegistered) return;

  mongoose.connection.on('connected', () => {
    logger.info({ host: mongoose.connection.host, name: mongoose.connection.name }, 'MongoDB connected');
    for (const cb of connectCallbacks) {
      try {
        void cb();
      } catch (err) {
        logger.error({ err }, 'Error in database connected callback');
      }
    }
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error({ err }, 'MongoDB connection error');
    for (const cb of disconnectCallbacks) {
      try {
        void cb();
      } catch (cbErr) {
        logger.error({ err: cbErr }, 'Error in database error callback');
      }
    }
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
    for (const cb of disconnectCallbacks) {
      try {
        void cb();
      } catch (err) {
        logger.error({ err }, 'Error in database disconnected callback');
      }
    }
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
    for (const cb of connectCallbacks) {
      try {
        void cb();
      } catch (err) {
        logger.error({ err }, 'Error in database reconnected callback');
      }
    }
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

  if (mongoose.connection.readyState === 2) {
    logger.debug('MongoDB connection already in progress, awaiting ready state');
    await new Promise<void>((resolve, reject) => {
      if (mongoose.connection.readyState === 1) return resolve();
      const onConnected = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        mongoose.connection.off('connected', onConnected);
        mongoose.connection.off('error', onError);
      };
      mongoose.connection.once('connected', onConnected);
      mongoose.connection.once('error', onError);
    });
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
