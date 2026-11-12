export type MissionType =
  | 'CIVIC_ISSUE_VERIFICATION'
  | 'CROWD_SAFETY'
  | 'MICRO_CLIMATE'
  | 'SUBTERRANEAN_SEARCH_RESCUE';

export type MissionStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ABORTED';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED' | 'CLOSED';

export type OutcomeType =
  | 'CIVIC_INFRASTRUCTURE'
  | 'PUBLIC_SAFETY'
  | 'ENVIRONMENTAL_AUDIT'
  | 'RESCUE_OPERATION';

export type OutcomeReviewStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED';

export type FlightSessionStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ABORTED';
export type FlightSessionSource = 'REAL' | 'SIMULATION';

export interface DroneData {
  _id: string;
  droneId: string;
  displayName: string;
  model: string;
  operationalStatus: 'READY' | 'IN_FLIGHT' | 'MAINTENANCE' | 'OFFLINE';
  flightController?: string;
  lastTelemetryAt?: string;
}

export interface UserSummary {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'citizen';
}

export interface MissionData {
  _id: string;
  missionId: string;
  missionType: MissionType;
  title: string;
  description: string;
  status: MissionStatus;
  stage: number;
  stageLabel: string;
  createdBy?: UserSummary;
  assignedManager?: UserSummary;
  assignedDrones?: DroneData[];
  plannedStart?: string;
  actualStart?: string;
  completedAt?: string;
  operationalArea?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface MissionEventData {
  _id: string;
  missionId: string | { _id: string; missionId: string; title: string; missionType: MissionType };
  eventType: string;
  actorId?: UserSummary;
  eventTimestamp: string;
  description: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface IncidentData {
  _id: string;
  incidentId: string;
  missionId?: { _id: string; missionId: string; title: string; missionType: MissionType };
  incidentType: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
  isConfidential: boolean;
  assignedManager?: UserSummary;
  reportedAt: string;
  resolvedAt?: string;
  evidenceAssets?: any[];
}

export interface MissionOutcomeData {
  _id: string;
  outcomeId: string;
  missionId: { _id: string; missionId: string; title: string; missionType: MissionType };
  outcomeType: OutcomeType;
  summary: string;
  findings: string;
  reviewStatus: OutcomeReviewStatus;
  isPublic: boolean;
  reviewedBy?: UserSummary;
  reviewedAt?: string;
  publishedAt?: string;
  evidenceAssets?: any[];
  createdAt?: string;
}

export interface FlightSessionData {
  _id: string;
  flightSessionId: string;
  droneId: DroneData;
  missionId?: { _id: string; missionId: string; title: string; missionType: MissionType };
  startedAt: string;
  endedAt?: string;
  status: FlightSessionStatus;
  source: FlightSessionSource;
  startLocation?: { type: 'Point'; coordinates: [number, number] };
  endLocation?: { type: 'Point'; coordinates: [number, number] };
  durationSeconds: number;
  summary?: string;
}

export interface TelemetryPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  relativeAltitude?: number;
  groundSpeed?: number;
  heading?: number;
  recordedAt: string;
  source?: string;
  isSimulated?: boolean;
}

export interface DashboardOverview {
  totalMissions: number;
  activeMissions: number;
  completedMissions: number;
  pendingReviews: number;
  openIncidents: number;
  availableDrones: number;
}

export interface ModuleSummary {
  id: string;
  code: MissionType;
  title: string;
  totalMissions: number;
  activeMissions: number;
  pendingReviews: number;
  currentStage: number;
  stageLabel: string;
  assignedDrone: DroneData | null;
  latestUpdate: string | null;
}

export interface MissionModuleData {
  id: string;
  code: string;
  title: string;
  description: string;
  stage: number;
  totalStages: number;
  stageLabel: string;
  progressPercent: number;
  asset: string;
  sortiesLogged: number;
  xpReward: number;
  icon: string;
}


export interface DashboardData {
  overview: DashboardOverview;
  modules: ModuleSummary[];
  timeline: MissionEventData[];
  pendingActions: {
    outcomesAwaitingReview: MissionOutcomeData[];
    urgentIncidents: IncidentData[];
  };
  dataFreshnessTimestamp: string;
}

export interface AnalyticsOverviewData {
  metrics: {
    missionsByCategory: Record<string, number>;
    missionsByStatus: Record<string, number>;
    flightsBySource: Record<string, number>;
    totalFlightDurationHours: number;
    incidentsBySeverity: Record<string, number>;
    incidentsByStatus: Record<string, number>;
    outcomesByReviewStatus: Record<string, number>;
  };
  dataFreshnessTimestamp: string;
}

export interface CitizenReportData {
  _id: string;
  reportId: string;
  citizenId?: {
    _id: string;
    name: string;
    email: string;
    reputationScore?: number;
  };
  category: string;
  description: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
  };
  mediaAssets?: Array<{
    _id: string;
    url?: string;
    filename?: string;
  }>;
  status:
    | 'SUBMITTED'
    | 'MUNICIPAL_REVIEW'
    | 'INSPECTION_SCHEDULED'
    | 'AERIAL_VERIFIED'
    | 'PUBLIC_WORKS_ASSIGNED'
    | 'RESOLVED'
    | 'REJECTED';
  currentStage: number;
  earnedPoints: number;
  submittedAt: string;
  reviewedAt?: string;
}
