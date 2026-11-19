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

/**
 * Simulation telemetry provider for deliberate local bench development.
 * Never silently relabels simulation packets as real hardware.
 */
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
    this._connected = true;
    return subscribeToDroneTelemetry(droneId, (packet: any) => {
      if (packet) {
        this._lastPacketTime = new Date(packet.recordedAt || Date.now());
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
    const ageMs = this._lastPacketTime ? Date.now() - this._lastPacketTime.getTime() : Infinity;
    const isOnline = this._connected && ageMs < 30000;
    return {
      connected: isOnline,
      dataSource: 'SIMULATION',
      latencyMs: ageMs < 60000 ? ageMs : undefined,
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

/**
 * Authentic MAVLink hardware telemetry provider.
 * Connects to the authoritative backend Socket.IO stream and REST endpoints.
 * Strictly preserves authentic packet provenance (never marks simulation as real).
 */
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
    this._connected = true;
    return subscribeToDroneTelemetry(droneId, (packet: any) => {
      if (packet) {
        this._lastPacketTime = new Date(packet.recordedAt || Date.now());
        const isSim = packet.isSimulated === true || packet.source === 'SIMULATION' || packet.source === 'SIMULATED';
        const point: TelemetryPoint = {
          ...packet,
          source: isSim ? 'SIMULATION' : (packet.source || 'REAL_HARDWARE'),
          isSimulated: isSim
        };
        handler(point);
      }
    });
  }

  public async getLatest(droneId: string): Promise<TelemetryPoint | null> {
    try {
      const res = await fetchLatestTelemetry(droneId);
      if (res?.telemetry) {
        this._lastPacketTime = new Date(res.telemetry.recordedAt || Date.now());
        const isSim = res.telemetry.isSimulated === true || res.telemetry.source === 'SIMULATION' || res.telemetry.source === 'SIMULATED';
        return {
          ...res.telemetry,
          source: isSim ? 'SIMULATION' : (res.telemetry.source || 'REAL_HARDWARE'),
          isSimulated: isSim
        };
      }
    } catch {}
    return null;
  }

  public getStatus(): TelemetryConnectionStatus {
    const ageMs = this._lastPacketTime ? Date.now() - this._lastPacketTime.getTime() : Infinity;
    const isOnline = this._connected && ageMs < 5000;
    const isStale = this._connected && ageMs >= 5000 && ageMs < 30000;

    let statusLabel = 'Awaiting physical hardware (Offline)';
    if (isOnline) {
      statusLabel = 'Pixhawk 2.4.8 MAVLink live';
    } else if (isStale) {
      statusLabel = `Telemetry stale (${Math.round(ageMs / 1000)}s ago)`;
    }

    return {
      connected: isOnline,
      dataSource: 'REAL_HARDWARE',
      latencyMs: ageMs < 60000 ? ageMs : undefined,
      lastPacketTime: this._lastPacketTime,
      statusLabel
    };
  }
}

// Production default: REAL_HARDWARE. Only uses simulation if explicitly set in environment.
const operationMode = (import.meta.env.VITE_OPERATION_MODE as string | undefined)?.toUpperCase() || 'REAL_HARDWARE';
export const activeTelemetryProvider: ITelemetryProvider =
  operationMode === 'SIMULATION'
    ? new SimulationTelemetryProvider()
    : new MavlinkTelemetryProvider();
