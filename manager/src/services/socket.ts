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
    // Keep auth token in sync
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

/**
 * Subscribes to mission lifecycle and event updates.
 */
export const subscribeToMissionEvents = (
  missionId: string,
  onEvent: (event: unknown) => void
): (() => void) => {
  const s = connectSocket();
  const roomName = `mission:${missionId}`;

  s.emit('join_room', { room: roomName }, (res: { success: boolean; error?: string }) => {
    if (!res?.success) {
      console.warn(`[Socket.IO] Failed to subscribe to ${roomName}:`, res?.error);
    }
  });

  s.on('mission:event', onEvent);
  s.on('mission:updated', onEvent);
  s.on('mission:stage_changed', onEvent);

  return () => {
    s.off('mission:event', onEvent);
    s.off('mission:updated', onEvent);
    s.off('mission:stage_changed', onEvent);
  };
};

/**
 * Subscribes to global manager-level operational updates (new missions, incidents, outcomes).
 */
export const subscribeToManagerBroadcasts = (callbacks: {
  onMissionCreated?: (mission: any) => void;
  onMissionUpdated?: (mission: any) => void;
  onIncidentUpdated?: (incident: any) => void;
  onOutcomeReviewed?: (outcome: any) => void;
  onOutcomePublished?: (outcome: any) => void;
}): (() => void) => {
  const s = connectSocket();

  if (callbacks.onMissionCreated) s.on('mission:created', callbacks.onMissionCreated);
  if (callbacks.onMissionUpdated) s.on('mission:updated', callbacks.onMissionUpdated);
  if (callbacks.onIncidentUpdated) s.on('incident:updated', callbacks.onIncidentUpdated);
  if (callbacks.onOutcomeReviewed) s.on('outcome:review_updated', callbacks.onOutcomeReviewed);
  if (callbacks.onOutcomePublished) s.on('outcome:published', callbacks.onOutcomePublished);

  return () => {
    if (callbacks.onMissionCreated) s.off('mission:created', callbacks.onMissionCreated);
    if (callbacks.onMissionUpdated) s.off('mission:updated', callbacks.onMissionUpdated);
    if (callbacks.onIncidentUpdated) s.off('incident:updated', callbacks.onIncidentUpdated);
    if (callbacks.onOutcomeReviewed) s.off('outcome:review_updated', callbacks.onOutcomeReviewed);
    if (callbacks.onOutcomePublished) s.off('outcome:published', callbacks.onOutcomePublished);
  };
};
