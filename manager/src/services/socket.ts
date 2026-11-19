import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './auth';
import { BACKEND_ROOT_URL } from './api';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  BACKEND_ROOT_URL ||
  'https://aeron.onrender.com';

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
 * Subscribes to global manager-level operational updates (missions, incidents, outcomes, drones, flights, reports).
 */
export const subscribeToManagerBroadcasts = (callbacks: {
  onMissionCreated?: (mission: any) => void;
  onMissionUpdated?: (mission: any) => void;
  onMissionStageChanged?: (data: any) => void;
  onIncidentCreated?: (incident: any) => void;
  onIncidentUpdated?: (incident: any) => void;
  onOutcomeReviewed?: (outcome: any) => void;
  onOutcomePublished?: (outcome: any) => void;
  onDroneRegistered?: (drone: any) => void;
  onDroneUpdated?: (drone: any) => void;
  onFlightCreated?: (flight: any) => void;
  onFlightUpdated?: (flight: any) => void;
  onReportUpdated?: (report: any) => void;
  onReconnect?: () => void;
}): (() => void) => {
  const s = connectSocket();

  if (callbacks.onMissionCreated) s.on('mission:created', callbacks.onMissionCreated);
  if (callbacks.onMissionUpdated) s.on('mission:updated', callbacks.onMissionUpdated);
  if (callbacks.onMissionStageChanged) s.on('mission:stage_changed', callbacks.onMissionStageChanged);
  if (callbacks.onIncidentCreated) s.on('incident:created', callbacks.onIncidentCreated);
  if (callbacks.onIncidentUpdated) s.on('incident:updated', callbacks.onIncidentUpdated);
  if (callbacks.onOutcomeReviewed) s.on('outcome:review_updated', callbacks.onOutcomeReviewed);
  if (callbacks.onOutcomePublished) s.on('outcome:published', callbacks.onOutcomePublished);
  if (callbacks.onDroneRegistered) s.on('drone:registered', callbacks.onDroneRegistered);
  if (callbacks.onDroneUpdated) s.on('drone:updated', callbacks.onDroneUpdated);
  if (callbacks.onFlightCreated) s.on('flight:created', callbacks.onFlightCreated);
  if (callbacks.onFlightUpdated) s.on('flight:updated', callbacks.onFlightUpdated);
  if (callbacks.onReportUpdated) s.on('citizen:report_updated', callbacks.onReportUpdated);

  const handleReconnect = () => {
    if (callbacks.onReconnect) {
      callbacks.onReconnect();
    }
  };
  s.on('reconnect', handleReconnect);
  s.on('connect', handleReconnect);

  return () => {
    if (callbacks.onMissionCreated) s.off('mission:created', callbacks.onMissionCreated);
    if (callbacks.onMissionUpdated) s.off('mission:updated', callbacks.onMissionUpdated);
    if (callbacks.onMissionStageChanged) s.off('mission:stage_changed', callbacks.onMissionStageChanged);
    if (callbacks.onIncidentCreated) s.off('incident:created', callbacks.onIncidentCreated);
    if (callbacks.onIncidentUpdated) s.off('incident:updated', callbacks.onIncidentUpdated);
    if (callbacks.onOutcomeReviewed) s.off('outcome:review_updated', callbacks.onOutcomeReviewed);
    if (callbacks.onOutcomePublished) s.off('outcome:published', callbacks.onOutcomePublished);
    if (callbacks.onDroneRegistered) s.off('drone:registered', callbacks.onDroneRegistered);
    if (callbacks.onDroneUpdated) s.off('drone:updated', callbacks.onDroneUpdated);
    if (callbacks.onFlightCreated) s.off('flight:created', callbacks.onFlightCreated);
    if (callbacks.onFlightUpdated) s.off('flight:updated', callbacks.onFlightUpdated);
    if (callbacks.onReportUpdated) s.off('citizen:report_updated', callbacks.onReportUpdated);
    s.off('reconnect', handleReconnect);
    s.off('connect', handleReconnect);
  };
};

/**
 * Subscribes to live telemetry stream for a specific airframe.
 */
export const subscribeToDroneTelemetry = (
  droneId: string,
  onTelemetry: (data: unknown) => void
): (() => void) => {
  const s = connectSocket();
  const roomName = `drone:telemetry:${droneId}`;

  s.emit('join_room', { room: roomName, assignedDroneIds: [droneId] }, (res: { success: boolean; error?: string }) => {
    if (!res?.success) {
      console.warn(`[Socket.IO] Failed to subscribe to ${roomName}:`, res?.error);
    }
  });

  const handleTelemetry = (packet: any) => {
    if (packet) {
      onTelemetry(packet);
    }
  };

  s.on(`telemetry:${droneId}`, handleTelemetry);
  s.on('telemetry', handleTelemetry);
  s.on('drone:gps', (gps: any) => {
    if (gps && (!gps.droneId || gps.droneId === droneId)) {
      handleTelemetry(gps);
    }
  });
  s.on('drone:battery', (bat: any) => {
    if (bat && (!bat.droneId || bat.droneId === droneId)) {
      handleTelemetry(bat);
    }
  });
  s.on('drone:attitude', (att: any) => {
    if (att && (!att.droneId || att.droneId === droneId)) {
      handleTelemetry(att);
    }
  });

  return () => {
    s.off(`telemetry:${droneId}`, handleTelemetry);
    s.off('telemetry', handleTelemetry);
    s.off('drone:gps');
    s.off('drone:battery');
    s.off('drone:attitude');
  };
};
