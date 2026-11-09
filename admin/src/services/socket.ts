import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './auth';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/v1\/?$/, '') ||
  import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') ||
  'http://localhost:5000';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  const token = getAccessToken();

  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: {
        token: token || undefined
      }
    });
  } else {
    // Keep auth token fresh
    if (socket.auth && typeof socket.auth === 'object') {
      (socket.auth as Record<string, unknown>).token = token || undefined;
    }
  }

  return socket;
};

export const connectSocket = (): Socket => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = (): void => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

export const subscribeToDroneTelemetry = (
  droneId: string,
  onTelemetry: (data: unknown) => void
): (() => void) => {
  const s = connectSocket();
  const roomName = `drone:telemetry:${droneId}`;

  // Join authorized room
  s.emit('join_room', { room: roomName }, (res: { success: boolean; error?: string }) => {
    if (!res?.success) {
      console.warn(`[Socket.IO] Failed to subscribe to ${roomName}:`, res?.error);
    }
  });

  s.on(`telemetry:${droneId}`, onTelemetry);
  s.on('telemetry', onTelemetry);

  return () => {
    s.off(`telemetry:${droneId}`, onTelemetry);
    s.off('telemetry', onTelemetry);
  };
};

export const subscribeToCameraFeed = (
  droneId: string,
  onFrame: (frame: any) => void,
  onStatus?: (status: any) => void
): (() => void) => {
  const s = connectSocket();
  const roomName = `drone:camera:${droneId}`;

  // Join authorized room
  s.emit('join_room', { room: roomName }, (res: { success: boolean; error?: string }) => {
    if (!res?.success) {
      console.warn(`[Socket.IO] Failed to subscribe to ${roomName}:`, res?.error);
    }
  });

  s.on('drone:camera:frame', onFrame);
  s.on('camera:frame', onFrame);
  if (onStatus) {
    s.on('drone:camera:status', onStatus);
    s.on('camera:status', onStatus);
  }

  return () => {
    s.off('drone:camera:frame', onFrame);
    s.off('camera:frame', onFrame);
    if (onStatus) {
      s.off('drone:camera:status', onStatus);
      s.off('camera:status', onStatus);
    }
  };
};

