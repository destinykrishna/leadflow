import type { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { logger } from '../utils/logger.js';

/**
 * Registers connection event handlers and enforces server-controlled room assignments.
 */
export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    logger.info(
      {
        socketId: socket.id,
        userId: user.id,
        role: user.role,
        brokerageId: user.brokerageId,
      },
      'Socket connection established and authenticated'
    );

    // 1. Strict Server-Side Room Assignment
    if (user.role === 'PLATFORM_ADMIN') {
      // Platform admins join platform-level admin room to receive platform-wide events
      socket.join('platform:admins');
    } else if (user.role === 'BROKERAGE_ADMIN' || user.role === 'ADVISOR') {
      // Tenant staff join ONLY their verified brokerage room
      socket.join(`brokerage:${user.brokerageId}`);
    } else if (user.role === 'CLIENT') {
      // CLIENT users join ONLY their private client room for personal portal events
      // They are STRICTLY excluded from internal brokerage pipeline rooms!
      socket.join(`client:${user.id}`);
    }

    // 2. Reject client-supplied room manipulation attempts
    socket.on('join', (_data: unknown) => {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Client-requested room joins are not permitted',
      });
    });

    socket.on('join_room', (_data: unknown) => {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Client-requested room joins are not permitted',
      });
    });

    socket.on('subscribe', (_data: unknown) => {
      socket.emit('error', {
        code: 'FORBIDDEN',
        message: 'Client-requested room subscriptions are not permitted',
      });
    });

    // 3. Server-controlled brokerage subscription (PLATFORM_ADMIN ONLY)
    socket.on('subscribe_brokerage', (data: { brokerageId?: string }) => {
      if (user.role !== 'PLATFORM_ADMIN') {
        socket.emit('error', {
          code: 'FORBIDDEN',
          message: 'Only platform admins may subscribe to specific brokerage rooms',
        });
        return;
      }

      if (!data?.brokerageId || !Types.ObjectId.isValid(data.brokerageId)) {
        socket.emit('error', {
          code: 'VALIDATION_ERROR',
          message: 'Valid brokerageId is required',
        });
        return;
      }

      const roomName = `brokerage:${data.brokerageId}`;
      socket.join(roomName);
      socket.emit('subscribed_brokerage', {
        brokerageId: data.brokerageId,
        room: roomName,
      });
    });

    // 4. Clean disconnect handling
    socket.on('disconnect', (reason) => {
      logger.debug(
        {
          socketId: socket.id,
          userId: user.id,
          role: user.role,
          reason,
        },
        'Socket disconnected cleanly'
      );
    });
  });
}
