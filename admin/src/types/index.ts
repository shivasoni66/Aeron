export type FlightMode = 'MANUAL' | 'POSHOLD' | 'STABILIZE' | 'AUTO' | 'RTL' | 'POSHOLD TEST';

export interface TelemetryMatrixData {
  lat: number;
  lon: number;
  altMsl: number;
  altAgl: number;
  groundSpeed: number;
  batteryVoltage: number;
  batteryPercentage: number;
  satellites: number;
  fixType: string;
  flightMode: FlightMode;
  armed: boolean;
  pwmOutput: number;
}

export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

