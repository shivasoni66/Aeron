import { getAccessToken, getCsrfToken } from './auth';
import {
  DashboardData,
  MissionData,
  IncidentData,
  FlightSessionData,
  TelemetryPoint,
  MissionOutcomeData,
  AnalyticsOverviewData,
  DroneData,
  MissionEventData
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://aeron.onrender.com/api/v1';

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

// Health Check
export const checkApiHealth = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: err instanceof Error ? err.message : 'Unknown error' };
  }
};

// Operations Dashboard
export const fetchDashboard = async (): Promise<DashboardData> => {
  return authenticatedFetch<DashboardData>('/manager/dashboard');
};

// Missions
export const fetchMissions = async (params: {
  page?: number;
  limit?: number;
  category?: string;
  status?: string;
  search?: string;
} = {}): Promise<{ missions: MissionData[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
  const q = new URLSearchParams();
  if (params.page) q.append('page', params.page.toString());
  if (params.limit) q.append('limit', params.limit.toString());
  if (params.category) q.append('category', params.category);
  if (params.status) q.append('status', params.status);
  if (params.search) q.append('search', params.search);

  return authenticatedFetch(`/manager/missions?${q.toString()}`);
};

export const fetchMission = async (
  missionId: string
): Promise<{
  mission: MissionData;
  events: MissionEventData[];
  incidents: IncidentData[];
  outcomes: MissionOutcomeData[];
}> => {
  return authenticatedFetch(`/manager/missions/${missionId}`);
};

export const createMission = async (payload: {
  missionType: string;
  title: string;
  description: string;
  assignedDrones?: string[];
  plannedStart?: string;
  operationalArea?: any;
}): Promise<{ mission: MissionData }> => {
  return authenticatedFetch('/manager/missions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const updateMission = async (
  missionId: string,
  payload: {
    status?: string;
    stage?: number;
    stageLabel?: string;
    title?: string;
    description?: string;
    assignedDrones?: string[];
  }
): Promise<{ mission: MissionData }> => {
  return authenticatedFetch(`/manager/missions/${missionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
};

export const createMissionEvent = async (
  missionId: string,
  payload: {
    eventType: string;
    description: string;
    source?: string;
  }
): Promise<{ event: MissionEventData }> => {
  return authenticatedFetch(`/manager/missions/${missionId}/events`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

// Incidents
export const fetchIncidents = async (params: {
  page?: number;
  limit?: number;
  severity?: string;
  status?: string;
  category?: string;
  missionId?: string;
} = {}): Promise<{ incidents: IncidentData[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
  const q = new URLSearchParams();
  if (params.page) q.append('page', params.page.toString());
  if (params.limit) q.append('limit', params.limit.toString());
  if (params.severity) q.append('severity', params.severity);
  if (params.status) q.append('status', params.status);
  if (params.category) q.append('category', params.category);
  if (params.missionId) q.append('missionId', params.missionId);

  return authenticatedFetch(`/manager/incidents?${q.toString()}`);
};

export const fetchIncident = async (incidentId: string): Promise<{ incident: IncidentData }> => {
  return authenticatedFetch(`/manager/incidents/${incidentId}`);
};

export const updateIncident = async (
  incidentId: string,
  payload: {
    status?: string;
    severity?: string;
    description?: string;
    assignedManager?: string;
  }
): Promise<{ incident: IncidentData }> => {
  return authenticatedFetch(`/manager/incidents/${incidentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
};

// Flight Sessions & Route History
export const fetchFlights = async (params: {
  page?: number;
  limit?: number;
  source?: string;
  status?: string;
  search?: string;
} = {}): Promise<{ flights: FlightSessionData[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
  const q = new URLSearchParams();
  if (params.page) q.append('page', params.page.toString());
  if (params.limit) q.append('limit', params.limit.toString());
  if (params.source) q.append('source', params.source);
  if (params.status) q.append('status', params.status);
  if (params.search) q.append('search', params.search);

  return authenticatedFetch(`/manager/flights?${q.toString()}`);
};

export const fetchFlight = async (
  flightSessionId: string
): Promise<{ flight: FlightSessionData; telemetrySamples: TelemetryPoint[] }> => {
  return authenticatedFetch(`/manager/flights/${flightSessionId}`);
};

// Mission Outcomes & Citizen Publishing
export const fetchOutcomes = async (params: {
  page?: number;
  limit?: number;
  reviewStatus?: string;
  outcomeType?: string;
  isPublic?: boolean;
} = {}): Promise<{ outcomes: MissionOutcomeData[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> => {
  const q = new URLSearchParams();
  if (params.page) q.append('page', params.page.toString());
  if (params.limit) q.append('limit', params.limit.toString());
  if (params.reviewStatus) q.append('reviewStatus', params.reviewStatus);
  if (params.outcomeType) q.append('outcomeType', params.outcomeType);
  if (params.isPublic !== undefined) q.append('isPublic', params.isPublic.toString());

  return authenticatedFetch(`/manager/outcomes?${q.toString()}`);
};

export const fetchOutcome = async (outcomeId: string): Promise<{ outcome: MissionOutcomeData }> => {
  return authenticatedFetch(`/manager/outcomes/${outcomeId}`);
};

export const reviewOutcome = async (
  outcomeId: string,
  decision: 'APPROVED' | 'REJECTED',
  findings?: string
): Promise<{ outcome: MissionOutcomeData }> => {
  return authenticatedFetch(`/manager/outcomes/${outcomeId}/review`, {
    method: 'POST',
    body: JSON.stringify({ decision, findings })
  });
};

export const publishOutcome = async (outcomeId: string): Promise<{ outcome: MissionOutcomeData }> => {
  return authenticatedFetch(`/manager/outcomes/${outcomeId}/publish`, {
    method: 'POST',
    body: JSON.stringify({})
  });
};

// Analytics Overview
export const fetchAnalyticsOverview = async (): Promise<AnalyticsOverviewData> => {
  return authenticatedFetch<AnalyticsOverviewData>('/manager/analytics/overview');
};

// Drone Registry
export const fetchAvailableDrones = async (): Promise<{ drones: DroneData[] }> => {
  return authenticatedFetch<{ drones: DroneData[] }>('/manager/drones/available');
};
