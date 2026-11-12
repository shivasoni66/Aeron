import { getAccessToken, getCsrfToken } from './auth';
import {
  OverviewData,
  DroneData,
  TelemetryData,
  HardwareDeviceData,
  FlightSessionData,
  AuditEventData,
  SystemHealthData,
  CameraStatusData,
  CameraFrameData
} from '../types';

// Resolve base origin from environment or default to deployed Render backend
const RAW_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  'https://aeron.onrender.com';

// Base host without trailing slashes or /api/v1 (e.g. "https://aeron.onrender.com")
export const BACKEND_ROOT_URL = RAW_URL.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');

// Guaranteed exactly one /api/v1 prefix (e.g. "https://aeron.onrender.com/api/v1")
export const API_BASE_URL = `${BACKEND_ROOT_URL}/api/v1`;

const authenticatedFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = getAccessToken();
  const csrf = getCsrfToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.message || `Request failed with status ${res.status}`);
  }
  return body.data;
};

export const checkApiHealth = async () => {
  try {
    const res = await fetch(`${BACKEND_ROOT_URL}/health`);
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: err instanceof Error ? err.message : 'Unknown error' };
  }
};

export const checkApiReadiness = async () => {
  try {
    const res = await fetch(`${BACKEND_ROOT_URL}/health/ready`);
    return await res.json();
  } catch (err) {
    return { status: 'degraded', error: err instanceof Error ? err.message : 'Unknown error' };
  }
};

export const fetchOverview = async (): Promise<OverviewData> => {
  return authenticatedFetch<OverviewData>('/admin/overview');
};

export const fetchDrones = async (): Promise<{ drones: DroneData[] }> => {
  return authenticatedFetch<{ drones: DroneData[] }>('/admin/drones');
};

export const fetchDrone = async (droneId: string): Promise<{ drone: DroneData }> => {
  return authenticatedFetch<{ drone: DroneData }>(`/admin/drones/${droneId}`);
};

export const fetchLatestTelemetry = async (droneId: string): Promise<{ telemetry: TelemetryData | null }> => {
  return authenticatedFetch<{ telemetry: TelemetryData | null }>(`/admin/drones/${droneId}/telemetry/latest`);
};

export const fetchTelemetryHistory = async (
  droneId: string,
  limit: number = 50,
  flightSessionId?: string
): Promise<{ history: TelemetryData[]; count: number }> => {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (flightSessionId) params.append('flightSessionId', flightSessionId);
  return authenticatedFetch<{ history: TelemetryData[]; count: number }>(
    `/admin/drones/${droneId}/telemetry/history?${params.toString()}`
  );
};

export const fetchDroneHardware = async (droneId: string): Promise<{ devices: HardwareDeviceData[] }> => {
  return authenticatedFetch<{ devices: HardwareDeviceData[] }>(`/admin/drones/${droneId}/hardware`);
};

export const fetchFlights = async (
  page: number = 1,
  limit: number = 20,
  source?: string
): Promise<{
  flights: FlightSessionData[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (source) params.append('source', source);
  return authenticatedFetch<{
    flights: FlightSessionData[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/admin/flights?${params.toString()}`);
};

export const fetchFlightDetails = async (
  flightSessionId: string
): Promise<{ flight: FlightSessionData; telemetrySamples: TelemetryData[] }> => {
  return authenticatedFetch<{ flight: FlightSessionData; telemetrySamples: TelemetryData[] }>(
    `/admin/flights/${flightSessionId}`
  );
};

export const fetchEvents = async (limit: number = 30): Promise<{ events: AuditEventData[] }> => {
  return authenticatedFetch<{ events: AuditEventData[] }>(`/admin/events?limit=${limit}`);
};

export const fetchSystemHealth = async (): Promise<SystemHealthData> => {
  return authenticatedFetch<SystemHealthData>('/admin/system/health');
};

export const fetchCameraStatus = async (
  droneId: string
): Promise<{ camera: CameraStatusData | null }> => {
  return authenticatedFetch<{ camera: CameraStatusData | null }>(
    `/admin/drones/${droneId}/camera/status`
  );
};

export const fetchLatestCameraPreview = async (
  droneId: string
): Promise<{ frame: CameraFrameData | null }> => {
  return authenticatedFetch<{ frame: CameraFrameData | null }>(
    `/admin/drones/${droneId}/camera/preview/latest`
  );
};

