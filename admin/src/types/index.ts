export type FlightMode =
  | 'MANUAL'
  | 'POSHOLD'
  | 'STABILIZE'
  | 'AUTO'
  | 'LOITER'
  | 'RTL'
  | 'POSHOLD TEST'
  | 'STANDBY / BENCH TEST'
  | 'UNKNOWN';

export type DroneOperationalStatus = 'READY' | 'IN_FLIGHT' | 'MAINTENANCE' | 'OFFLINE';
export type DeviceConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN' | 'ERROR' | 'AWAITING_DATA';
export type InstallationStatus = 'INSTALLED' | 'NOT_INSTALLED';
export type FlightSource = 'REAL' | 'SIMULATION';
export type FlightStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ABORTED';

export interface TelemetryData {
  droneId?: string;
  flightSessionId?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  relativeAltitude?: number;
  groundSpeed?: number;
  heading?: number;
  batteryVoltage?: number;
  batteryCurrent?: number;
  batteryPercentage?: number;
  satellites?: number;
  gpsFixType?: string;
  hdop?: number;
  flightMode?: FlightMode | string;
  armed?: boolean;
  isSimulated?: boolean;
  source?: string;
  recordedAt?: string;
  receivedAt?: string;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };
}

export interface DroneData {
  _id?: string;
  droneId: string;
  displayName: string;
  model: string;
  manufacturer: string;
  flightController: string;
  operationalStatus: DroneOperationalStatus;
  lastTelemetryAt?: string;
  hardwareIdentifiers?: Record<string, string>;
  createdAt?: string;
}

export interface HardwareDeviceData {
  _id?: string;
  deviceId: string;
  droneId: string;
  deviceType: 'FLIGHT_CONTROLLER' | 'GPS' | 'CAMERA' | 'POWER_MODULE' | 'ENVIRONMENTAL_SENSOR' | 'OTHER';
  manufacturer: string;
  model: string;
  serialNumber?: string;
  installationStatus: InstallationStatus;
  connectionStatus: DeviceConnectionStatus;
  lastSeenAt?: string;
  metadata?: Record<string, unknown>;
}

export interface FlightSessionData {
  _id?: string;
  flightSessionId: string;
  droneId: string;
  missionId?: string;
  startedAt: string;
  endedAt?: string;
  status: FlightStatus;
  source: FlightSource;
  startLocation?: { type: 'Point'; coordinates: [number, number] };
  endLocation?: { type: 'Point'; coordinates: [number, number] };
  durationSeconds: number;
  summary?: string;
}

export interface AuditEventData {
  _id?: string;
  action: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface ReadinessCheck {
  id: string;
  name: string;
  verified: boolean;
  details: string;
}

export interface AircraftReadiness {
  percentage: number;
  status: 'BENCH READY' | 'BENCH STAGE 2' | 'NOT READY' | 'UNKNOWN';
  verifiedCount: number;
  totalChecks: number;
  checks: ReadinessCheck[];
}

export interface OverviewData {
  drone: DroneData | null;
  droneCount: number;
  protocol: {
    mavlinkVersion: string;
    serialConnection: string;
    baudRate: number;
    targetFC: string;
    mode: string;
    sysId: number;
    compId: number;
    armed: boolean;
  };
  readiness: AircraftReadiness;
  latestTelemetry: TelemetryData | null;
  hardwareDevices: HardwareDeviceData[];
}

export interface SubsystemHealth {
  status: string;
  latencyMs?: number;
  readyState?: number;
  host?: string;
  lastPacketAt?: string;
  isSimulated?: boolean;
  model?: string;
  satellites?: number;
  protocol?: string;
}

export interface SystemHealthData {
  timestamp: string;
  subsystems: {
    apiBackend: SubsystemHealth;
    database: SubsystemHealth;
    socketServer: SubsystemHealth;
    droneBridge: SubsystemHealth;
    pixhawkFC: SubsystemHealth;
    gpsGNSS: SubsystemHealth;
    cameraModule: SubsystemHealth;
  };
}

export interface NavigationItem {
  path: string;
  label: string;
  icon: string;
}

export interface CameraStatusData {
  droneId: string;
  deviceId: string;
  installed: boolean;
  reachable: boolean;
  streaming: boolean;
  fps: number;
  lastFrameAt?: string;
  resolution?: string;
  rssi?: number;
  ipAddress?: string;
  errorMessage?: string;
  recordedAt: string;
}

export interface CameraFrameData {
  droneId: string;
  deviceId?: string;
  capturedAt: string;
  frameBase64: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
  telemetryLat?: number;
  telemetryLon?: number;
  telemetryAlt?: number;
  telemetryHeading?: number;
  telemetryAgeSeconds?: number;
  isSimulated?: boolean;
}

