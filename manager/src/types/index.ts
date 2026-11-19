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
  roll?: number;
  pitch?: number;
  yaw?: number;
  climbRate?: number;
  batteryVoltage?: number;
  batteryCurrent?: number;
  batteryPercentage?: number | null;
  batteryCellVoltage?: number | null;
  batteryRemainingMah?: number | null;
  gpsFixType?: string;
  satellites?: number;
  hdop?: number;
  flightMode?: string;
  armed?: boolean;
  connectionStatus?: string;
  recordedAt: string;
  receivedAt?: string;
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

export type OperatingMode = 'STANDARD' | 'MEGA_MISSION';
export type PipelineHealth = 'HEALTHY' | 'DEGRADED' | 'FAILED' | 'STOPPED' | 'UNAVAILABLE';

export interface PipelineState {
  missionId?: string;
  status: 'IDLE' | 'ACTIVE' | 'PAUSED' | 'STOPPED';
  pipelineHealth: PipelineHealth;
  lastInferenceAt?: string;
  details?: string;
  modelName?: string;
}

export interface EnvironmentalServiceState {
  status: 'ONLINE' | 'OFFLINE' | 'STALE' | 'NOT_CONNECTED';
  lastReadingAt?: string;
  sensorCount?: number;
  details?: string;
}

export interface MissionSessionData {
  _id?: string;
  sessionId: string;
  operatingMode: OperatingMode;
  status: 'IDLE' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  activeMissionId?: string | null;
  activeMissionType?: MissionType | null;
  sessionStartedAt?: string | null;
  sessionEndedAt?: string | null;
  childSessions: {
    civic: PipelineState;
    crowd: PipelineState;
    sar: PipelineState;
  };
  environmentalService: EnvironmentalServiceState;
}

export interface ObservationData {
  _id: string;
  observationId: string;
  missionId: string;
  sessionId?: string;
  missionType: MissionType;
  droneId: string;
  category: string;
  confidence: number;
  detectedAt: string;
  evidenceImageUrl: string;
  cropImageUrl?: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dronePosition: {
    latitude: number;
    longitude: number;
    altitude?: number;
    heading?: number;
  };
  estimatedTargetPosition?: {
    latitude: number;
    longitude: number;
  } | null;
  locationAccuracyStatus: 'EXACT' | 'ESTIMATED' | 'APPROXIMATE' | 'UNAVAILABLE';
  gpsQuality?: {
    fixType?: string;
    satellites?: number;
    hdop?: number;
  };
  telemetryTimeDiffMs?: number;
  metrics?: Record<string, any>;
  modelInfo: {
    name: string;
    version: string;
    framework?: string;
  };
  verificationStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reviewedBy?: UserSummary;
  reviewedAt?: string;
  reviewNotes?: string;
  metadata?: Record<string, any>;
}

// Bhopal Micro-Climate & Atmospheric Types
export interface LocationMetadata {
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  elevationMeters?: number;
  timezone: string;
  localTime: string;
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  relativeHumidity: number;
  pressureMsl: number;
  surfacePressure?: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  precipitation: number;
  rain: number;
  showers: number;
  cloudCover: number;
  weatherCode: number;
  weatherDescription: string;
  isDay: boolean;
  timestamp: string;
}

export interface CurrentAirQuality {
  usAqi: number;
  europeanAqi: number;
  pm25: number;
  pm10: number;
  carbonMonoxide: number;
  nitrogenDioxide: number;
  sulphurDioxide: number;
  ozone: number;
  dust: number;
  uvIndex: number;
  timestamp: string;
}

export interface HourlyWeatherForecast {
  time: string;
  temperature: number;
  relativeHumidity: number;
  precipitationProbability: number;
  precipitation: number;
  weatherCode: number;
  weatherDescription: string;
  windSpeed: number;
  windDirection: number;
  uvIndex: number;
}

export interface DailyWeatherForecast {
  date: string;
  weatherCode: number;
  weatherDescription: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  sunrise: string;
  sunset: string;
}

export interface HourlyAirQualityForecast {
  time: string;
  usAqi: number;
  europeanAqi: number;
  pm25: number;
  pm10: number;
  carbonMonoxide: number;
  nitrogenDioxide: number;
  sulphurDioxide: number;
  ozone: number;
  dust: number;
  uvIndex: number;
}

export interface HardwareSensorState {
  status: 'SENSOR_NOT_CONNECTED' | 'SENSOR_CONNECTED' | 'SENSOR_STALE';
  droneId: string | null;
  lastReadingAt: string | null;
  readings: {
    temperature?: number;
    humidity?: number;
    pressure?: number;
  } | null;
  source: 'AIRFRAME_BMP280_I2C' | 'NONE';
  notes: string;
}

export interface EnvironmentalSources {
  weather: {
    provider: string;
    model: string;
    license: string;
    attribution: string;
    url: string;
  };
  airQuality: {
    provider: string;
    model: string;
    domain: string;
    spatialResolution: string;
    temporalResolution: string;
    license: string;
    attribution: string;
    url: string;
  };
}

export interface EnvironmentalStatusSummary {
  flightAdvisory: 'PERMITTED' | 'CAUTION' | 'RESTRICTED';
  advisoryReasons: string[];
  thermalClassification: string;
  airQualityClassification: string;
  particulateAlert: boolean;
  windAlert: boolean;
  rainAlert: boolean;
}

export interface BhopalMicroClimateData {
  location: LocationMetadata;
  weather: CurrentWeather;
  airQuality: CurrentAirQuality;
  forecast: {
    hourly: HourlyWeatherForecast[];
    daily: DailyWeatherForecast[];
    airQualityHourly: HourlyAirQualityForecast[];
  };
  sources: EnvironmentalSources;
  hardwareSensors: HardwareSensorState;
  status: 'API_CONNECTED' | 'API_LOADING' | 'API_DELAYED' | 'API_STALE' | 'API_OFFLINE' | 'API_ERROR';
  summary: EnvironmentalStatusSummary;
  lastFetchedAt: string;
  cache: {
    weatherCached: boolean;
    airQualityCached: boolean;
    weatherAgeSeconds: number;
    airQualityAgeSeconds: number;
    weatherExpiresInSeconds: number;
    airQualityExpiresInSeconds: number;
  };
}
