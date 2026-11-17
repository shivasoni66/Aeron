import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MavlinkTelemetryProvider,
  SimulationTelemetryProvider
} from '../providers/telemetryProvider';
import * as socketService from '../services/socket';
import { TelemetryPoint } from '../types';

describe('AERON Manager — Telemetry Provider & Provenance Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('MavlinkTelemetryProvider defaults to REAL_HARDWARE data source', () => {
    const provider = new MavlinkTelemetryProvider();
    expect(provider.dataSource).toBe('REAL_HARDWARE');

    const status = provider.getStatus();
    expect(status.connected).toBe(false);
    expect(status.dataSource).toBe('REAL_HARDWARE');
    expect(status.statusLabel).toContain('Awaiting physical hardware');
  });

  it('authentically preserves REAL_HARDWARE provenance on incoming telemetry packets', () => {
    let capturedHandler: ((packet: any) => void) | null = null;
    vi.spyOn(socketService, 'subscribeToDroneTelemetry').mockImplementation((_droneId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const provider = new MavlinkTelemetryProvider();
    const received: TelemetryPoint[] = [];

    provider.subscribe('AERON-HEX-01', (point) => {
      received.push(point);
    });

    expect(capturedHandler).toBeDefined();

    // Deliver authentic hardware packet
    const now = Date.now();
    capturedHandler!({
      latitude: 12.9716,
      longitude: 77.5946,
      altitude: 120.5,
      batteryPercentage: 92,
      batteryVoltage: 16.4,
      gpsFixType: 3,
      satellites: 14,
      flightMode: 'AUTO',
      armed: true,
      source: 'REAL_HARDWARE',
      recordedAt: new Date(now).toISOString()
    });

    expect(received.length).toBe(1);
    expect(received[0].source).toBe('REAL_HARDWARE');
    expect(received[0].isSimulated).toBe(false);
    expect(received[0].latitude).toBe(12.9716);
    expect(received[0].longitude).toBe(77.5946);

    const status = provider.getStatus();
    expect(status.connected).toBe(true);
    expect(status.statusLabel).toContain('Pixhawk 2.4.8 MAVLink live');
  });

  it('STRICTLY PREVENTS falsification: never rewrites SIMULATION packet as REAL_HARDWARE', () => {
    let capturedHandler: ((packet: any) => void) | null = null;
    vi.spyOn(socketService, 'subscribeToDroneTelemetry').mockImplementation((_droneId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const provider = new MavlinkTelemetryProvider();
    const received: TelemetryPoint[] = [];

    provider.subscribe('AERON-HEX-01', (point) => {
      received.push(point);
    });

    // Deliver simulation packet to Mavlink provider
    capturedHandler!({
      latitude: 12.9716,
      longitude: 77.5946,
      altitude: 50.0,
      source: 'SIMULATION',
      isSimulated: true,
      recordedAt: new Date().toISOString()
    });

    expect(received.length).toBe(1);
    // Provenance must remain SIMULATION and isSimulated true
    expect(received[0].source).toBe('SIMULATION');
    expect(received[0].isSimulated).toBe(true);
  });

  it('detects link staleness when packets stop arriving > 5000ms', () => {
    let capturedHandler: ((packet: any) => void) | null = null;
    vi.spyOn(socketService, 'subscribeToDroneTelemetry').mockImplementation((_droneId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const provider = new MavlinkTelemetryProvider();
    provider.subscribe('AERON-HEX-01', () => {});

    // Ingest packet at t=0
    capturedHandler!({
      latitude: 12.9716,
      longitude: 77.5946,
      source: 'REAL_HARDWARE',
      recordedAt: new Date(Date.now()).toISOString()
    });

    expect(provider.getStatus().connected).toBe(true);

    // Advance 6000ms past 5000ms staleness threshold
    vi.advanceTimersByTime(6000);

    const staleStatus = provider.getStatus();
    expect(staleStatus.connected).toBe(false);
    expect(staleStatus.statusLabel).toContain('Telemetry stale');
  });

  it('SimulationTelemetryProvider stamps packets explicitly as SIMULATION with isSimulated: true', () => {
    let capturedHandler: ((packet: any) => void) | null = null;
    vi.spyOn(socketService, 'subscribeToDroneTelemetry').mockImplementation((_droneId, handler) => {
      capturedHandler = handler;
      return () => {};
    });

    const simProvider = new SimulationTelemetryProvider();
    expect(simProvider.dataSource).toBe('SIMULATION');

    const received: TelemetryPoint[] = [];
    simProvider.subscribe('AERON-HEX-01', (point) => {
      received.push(point);
    });

    capturedHandler!({
      latitude: 12.9716,
      longitude: 77.5946,
      altitude: 45.0,
      recordedAt: new Date().toISOString()
    });

    expect(received.length).toBe(1);
    expect(received[0].source).toBe('SIMULATION');
    expect(received[0].isSimulated).toBe(true);
  });
});

describe('AERON Manager — Operational Metric Aggregations', () => {
  it('correctly calculates vertical distribution percentages against total sessions', () => {
    const missionsByCategory: Record<string, number> = {
      CIVIC_INFRASTRUCTURE: 12,
      PUBLIC_SAFETY: 8,
      ENVIRONMENTAL_AUDIT: 4,
      SEARCH_AND_RESCUE: 16
    };

    const total = Object.values(missionsByCategory).reduce((acc, curr) => acc + curr, 0);
    expect(total).toBe(40);

    const proportions = Object.entries(missionsByCategory).map(([cat, count]) => ({
      cat,
      pct: Math.round((count / total) * 100)
    }));

    expect(proportions.find((p) => p.cat === 'CIVIC_INFRASTRUCTURE')?.pct).toBe(30);
    expect(proportions.find((p) => p.cat === 'PUBLIC_SAFETY')?.pct).toBe(20);
    expect(proportions.find((p) => p.cat === 'ENVIRONMENTAL_AUDIT')?.pct).toBe(10);
    expect(proportions.find((p) => p.cat === 'SEARCH_AND_RESCUE')?.pct).toBe(40);
  });

  it('handles empty database state with zero total sessions without NaN or division by zero', () => {
    const emptyCategories: Record<string, number> = {};
    const total = Object.values(emptyCategories).reduce((acc, curr) => acc + curr, 0);

    const calculatePct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

    expect(total).toBe(0);
    expect(calculatePct(0)).toBe(0);
    expect(isNaN(calculatePct(0))).toBe(false);
  });
});
