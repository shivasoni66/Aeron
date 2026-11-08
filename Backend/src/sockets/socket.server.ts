import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { User, UserRole, AccountStatus } from '../models/User.js';
import { recordAuthAudit } from '../utils/audit.js';

export interface AuthenticatedSocketUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountStatus: AccountStatus;
}

export interface SocketData {
  user?: AuthenticatedSocketUser;
}

let ioInstance: SocketIOServer | null = null;

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new SocketIOServer<never, never, never, SocketData>(httpServer, {
    cors: {
      origin: env.isDevelopment ? true : env.corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling']
  });

  // =========================================================================
  // 1. HANDSHAKE AUTHENTICATION MIDDLEWARE
  // =========================================================================
  ioInstance.use(async (socket, next) => {
    try {
      // Extract token from handshake auth or headers
      const rawToken =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null);

      if (!rawToken) {
        logger.warn(`[Socket.IO] Connection rejected: No auth token provided from ${socket.handshake.address}`);
        return next(new Error('AUTHENTICATION_REQUIRED'));
      }

      // Verify JWT signature and claims
      const payload = verifyAccessToken(rawToken);

      // Verify authoritative user state from MongoDB
      const user = await User.findById(payload.sub);
      if (!user) {
        logger.warn(`[Socket.IO] Connection rejected: User not found for ID ${payload.sub}`);
        return next(new Error('USER_NOT_FOUND'));
      }

      if (user.accountStatus !== 'active') {
        logger.warn(`[Socket.IO] Connection rejected: User account ${user._id} is ${user.accountStatus}`);
        return next(new Error('ACCOUNT_SUSPENDED'));
      }

      // Attach typed user context to socket instance
      socket.data.user = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        accountStatus: user.accountStatus
      };

      next();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid token';
      logger.warn(`[Socket.IO] Authentication failed: ${msg}`);
      return next(new Error('AUTHENTICATION_FAILED'));
    }
  });

  // =========================================================================
  // 2. CONNECTION & AUTHORIZED ROOM MANAGEMENT
  // =========================================================================
  ioInstance.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    logger.info(
      `[Socket.IO] User authenticated: ${user.email} (${user.role}) connected on socket ${socket.id}`
    );

    // Auto-join personal room
    socket.join(`user:${user.id}`);
    if (user.role === 'citizen') {
      socket.join(`citizen:user:${user.id}`);
    }

    // Ping / heartbeat event
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Explicit room subscription with server-enforced role authorization
    socket.on('join_room', async (data: { room: string; assignedDroneIds?: string[] }, callback) => {
      const room = data?.room?.trim();
      const sendResponse = (success: boolean, error?: string) => {
        if (typeof callback === 'function') {
          callback({ success, error });
        } else {
          socket.emit(success ? 'room_joined' : 'room_join_error', { room, error });
        }
      };

      if (!room) {
        sendResponse(false, 'Room name is required');
        return;
      }

      // -----------------------------------------------------------------------
      // Room Authorization Policy
      // -----------------------------------------------------------------------

      // Telemetry & Hardware Feeds: Strictly Admin & authorized Managers
      if (room.startsWith('drone:telemetry:') || room.startsWith('drone:command:')) {
        if (user.role === 'citizen') {
          await recordAuthAudit({
            action: 'SOCKET_UNAUTHORIZED_ROOM_ACCESS',
            actorId: user.id,
            entityType: 'SocketRoom',
            entityId: room,
            source: 'CITIZEN_APP',
            metadata: { attemptedRoom: room, reason: 'Citizen denied raw telemetry' }
          });
          sendResponse(false, 'Citizens are strictly prohibited from accessing raw drone telemetry');
          return;
        }

        if (user.role === 'manager') {
          const droneId = room.split(':')[2];
          const isAssigned = data.assignedDroneIds && data.assignedDroneIds.includes(droneId);
          if (!isAssigned) {
            sendResponse(false, 'Manager not assigned to this drone airframe');
            return;
          }
        }
      }

      // Admin Management Rooms
      if (room.startsWith('admin:')) {
        if (user.role !== 'admin') {
          sendResponse(false, 'Administrative rooms restricted to admin users');
          return;
        }
      }

      // Mission Command Rooms
      if (room.startsWith('mission:')) {
        if (user.role === 'citizen') {
          sendResponse(false, 'Citizens are not permitted to access operational mission rooms');
          return;
        }
      }

      // Citizen Private Rooms: Citizen can only join their own room
      if (room.startsWith('citizen:user:')) {
        const targetUserId = room.replace('citizen:user:', '');
        if (user.role === 'citizen' && user.id !== targetUserId) {
          sendResponse(false, 'Cannot join another citizen private channel');
          return;
        }
      }

      // Join authorized room
      socket.join(room);
      logger.info(`[Socket.IO] ${user.email} (${user.role}) joined authorized room: ${room}`);
      sendResponse(true);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id} (user: ${user.email}, reason: ${reason})`);
    });
  });

  logger.info('[Socket.IO] Real-time engine initialized with JWT authentication & room guards');
  return ioInstance;
};

export const getSocketServer = (): SocketIOServer => {
  if (!ioInstance) {
    throw new Error('Socket.IO server has not been initialized yet');
  }
  return ioInstance;
};
