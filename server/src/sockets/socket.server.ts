import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { env, resolveCorsOrigin } from '../config/env.js';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketHandlers } from './socket.handlers.js';
import { logger } from '../utils/logger.js';

let ioInstance: SocketIOServer | null = null;

/**
 * Initializes and configures the Socket.IO server on top of an existing HTTP server.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  if (ioInstance) {
    return ioInstance;
  }

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: resolveCorsOrigin(env.CORS_ORIGIN),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Apply authentication middleware
  io.use(socketAuthMiddleware);

  // Register connection lifecycle & room handlers
  registerSocketHandlers(io);

  ioInstance = io;
  logger.info('Socket.IO server initialized successfully');

  return io;
}

/**
 * Resolves the active Socket.IO server instance.
 * Returns null if the socket server has not been initialized.
 */
export function getSocketServer(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Forcefully disconnects all authenticated sockets belonging to a specific user.
 * Invoked upon user deactivation/suspension or security revocation (HARD-01).
 */
export async function disconnectUserSockets(userId: string): Promise<void> {
  if (!ioInstance) return;
  try {
    const userRoom = `user:${userId}`;
    const sockets = await ioInstance.in(userRoom).fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }
    logger.info(
      { userId, disconnectedCount: sockets.length },
      'User sockets forcefully disconnected on account status change'
    );
  } catch (error) {
    logger.error({ userId, error }, 'Error disconnecting user sockets');
  }
}

/**
 * Forcefully disconnects all authenticated sockets belonging to a specific brokerage.
 * Invoked upon brokerage suspension (HARD-01).
 */
export async function disconnectBrokerageSockets(brokerageId: string): Promise<void> {
  if (!ioInstance) return;
  try {
    const tenantRoom = `tenant-all:${brokerageId}`;
    const sockets = await ioInstance.in(tenantRoom).fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }
    logger.info(
      { brokerageId, disconnectedCount: sockets.length },
      'Brokerage sockets forcefully disconnected on brokerage suspension'
    );
  } catch (error) {
    logger.error({ brokerageId, error }, 'Error disconnecting brokerage sockets');
  }
}

/**
 * Gracefully shuts down the active Socket.IO server instance.
 */
export async function closeSocketServer(): Promise<void> {
  if (ioInstance) {
    await new Promise<void>((resolve) => {
      ioInstance!.close(() => {
        ioInstance = null;
        logger.info('Socket.IO server closed cleanly');
        resolve();
      });
    });
  }
}

