import { TelemetryPoint } from '../types';
import { fetchLatestTelemetry } from '../services/api';
import { subscribeToDroneTelemetry } from '../services/socket';

export type DataSource = 'REAL_HARDWARE' | 'SIMULATION' | 'MANUAL' | 'IMPORTED';

export interface TelemetryConnectionStatus {
  connected: boolean;
  dataSource: DataSource;
  latencyMs?: number;
  lastPacketTime?: Date;
  statusLabel: string;
}

export interface ITelemetryProvider {
  readonly dataSource: DataSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(droneId: string, handler: (telemetry: TelemetryPoint) => void): () => void;
  getLatest(droneId: string): Promise<TelemetryPoint | null>;
  getStatus(): TelemetryConnectionStatus;
}

export class SimulationTelemetryProvider implements ITelemetryProvider {
  public readonly dataSource: DataSource = 'SIMULATION';
  private _connected: boolean = false;
  private _lastPacketTime?: Date;
  private _simulatorServerUrl: string = 'http://127.0.0.1:5050';

  public async connect(): Promise<void> {
    this._connected = true;
  }

  public async disconnect(): Promise<void> {
    this._connected = false;
  }

  public subscribe(droneId: string, handler: (telemetry: TelemetryPoint) => void): () => void {
    return subscribeToDroneTelemetry(droneId, (packet: any) => {
      if (packet) {
        this._lastPacketTime = new Date();
        handler({ ...packet, source: 'SIMULATION', isSimulated: true });
      }
    });
  }

  public async getLatest(droneId: string): Promise<TelemetryPoint | null> {
    try {
      const res = await fetchLatestTelemetry(droneId);
      if (res?.telemetry) {
        this._lastPacketTime = new Date(res.telemetry.recordedAt || Date.now());
        return { ...res.telemetry, source: 'SIMULATION', isSimulated: true };
      }
    } catch {}
    return null;
  }

  public getStatus(): TelemetryConnectionStatus {
    const isOnline = this._connected && !!this._lastPacketTime && (Date.now() - this._lastPacketTime.getTime()) < 30000;
    return {
      connected: isOnline,
      dataSource: 'SIMULATION',
      lastPacketTime: this._lastPacketTime,
      statusLabel: isOnline ? 'Bench simulation stream active' : 'Simulation standby'
    };
  }

  public async setScenario(scenario: string): Promise<boolean> {
    try {
      const res = await fetch(`${this._simulatorServerUrl}/api/simulation/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async pauseSimulation(): Promise<boolean> {
    try {
      const res = await fetch(`${this._simulatorServerUrl}/api/simulation/pause`, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async resumeSimulation(): Promise<boolean> {
    try {
      const res = await fetch(`${this._simulatorServerUrl}/api/simulation/resume`, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async resetSimulation(): Promise<boolean> {
    try {
      const res = await fetch(`${this._simulatorServerUrl}/api/simulation/reset`, { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export class MavlinkTelemetryProvider implements ITelemetryProvider {
  public readonly dataSource: DataSource = 'REAL_HARDWARE';
  private _connected: boolean = false;
  private _lastPacketTime?: Date;

  public async connect(): Promise<void> {
    this._connected = true;
  }

  public async disconnect(): Promise<void> {
    this._connected = false;
  }

  public subscribe(droneId: string, handler: (telemetry: TelemetryPoint) => void): () => void {
    return subscribeToDroneTelemetry(droneId, (packet: any) => {
      if (packet) {
        this._lastPacketTime = new Date();
        handler({ ...packet, source: 'REAL_HARDWARE', isSimulated: false });
      }
    });
  }

  public async getLatest(droneId: string): Promise<TelemetryPoint | null> {
    try {
      const res = await fetchLatestTelemetry(droneId);
      if (res?.telemetry) {
        this._lastPacketTime = new Date(res.telemetry.recordedAt || Date.now());
        return { ...res.telemetry, source: 'REAL_HARDWARE', isSimulated: false };
      }
    } catch {}
    return null;
  }

  public getStatus(): TelemetryConnectionStatus {
    const isOnline = this._connected && !!this._lastPacketTime && (Date.now() - this._lastPacketTime.getTime()) < 15000;
    return {
      connected: isOnline,
      dataSource: 'REAL_HARDWARE',
      lastPacketTime: this._lastPacketTime,
      statusLabel: isOnline ? 'Pixhawk 2.4.8 connected' : 'Awaiting physical hardware'
    };
  }
}

const operationMode = import.meta.env.VITE_OPERATION_MODE || 'SIMULATION';
export const activeTelemetryProvider: ITelemetryProvider =
  operationMode === 'REAL_HARDWARE'
    ? new MavlinkTelemetryProvider()
    : new SimulationTelemetryProvider();
