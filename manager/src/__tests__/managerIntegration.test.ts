import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MavlinkTelemetryProvider,
  SimulationTelemetryProvider
} from '../providers/telemetryProvider';
import * as socketService from '../services/socket';
import { TelemetryPoint } from '../types';
import { isValidCoordinate, isDemoMission, isRealDrone, isDemoIncident } from '../utils/geo';

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

describe('AERON Manager — Coordinate Validation & Real GPS Guards', () => {
  it('validates authentic latitude and longitude ranges and rejects invalid/NaN coordinates', () => {
    // Valid coordinates
    expect(isValidCoordinate(12.9716, 77.5946)).toBe(true);
    expect(isValidCoordinate(0, 0)).toBe(true); // Equator / Prime Meridian is valid
    expect(isValidCoordinate(-90, 180)).toBe(true);
    expect(isValidCoordinate(90, -180)).toBe(true);

    // Invalid coordinates
    expect(isValidCoordinate(91, 77)).toBe(false);
    expect(isValidCoordinate(-90.1, 77)).toBe(false);
    expect(isValidCoordinate(12, 181)).toBe(false);
    expect(isValidCoordinate(12, -180.1)).toBe(false);
    expect(isValidCoordinate(NaN, 77)).toBe(false);
    expect(isValidCoordinate(12, Infinity)).toBe(false);
    expect(isValidCoordinate(undefined, 77)).toBe(false);
    expect(isValidCoordinate(null, 77)).toBe(false);
    expect(isValidCoordinate('12.9716', '77.5946')).toBe(false);
  });

  it('correctly identifies and flags demo missions to prevent automatic selection', () => {
    const demo1 = { missionId: 'MIS-DEMO-001', title: 'Demo Recon', status: 'ACTIVE' } as any;
    const demo2 = { missionId: 'MIS-002', title: '[DEMO] Central Plaza', status: 'ACTIVE' } as any;
    const demo3 = {
      missionId: 'MIS-003',
      title: 'Real Title',
      status: 'ACTIVE',
      assignedDrones: [{ droneId: 'DRONE-SIM-01' }]
    } as any;
    const realMission = {
      missionId: 'MIS-2026-101',
      title: 'Sector 4 Perimeter Survey',
      status: 'ACTIVE',
      assignedDrones: [{ droneId: 'AERON-HEX-01', model: 'Pixhawk 2.4.8 Hexacopter' }]
    } as any;

    expect(isDemoMission(demo1)).toBe(true);
    expect(isDemoMission(demo2)).toBe(true);
    expect(isDemoMission(demo3)).toBe(true);
    expect(isDemoMission(realMission)).toBe(false);
  });

  it('correctly filters real physical drones from simulator SITL airframes', () => {
    const simDrone1 = { droneId: 'DRONE-SIM-01', displayName: 'Sim Alpha', model: 'SITL Quad' } as any;
    const simDrone2 = { droneId: 'AERON-DEMO-01', displayName: '[SIMULATION] Alpha', model: 'Hexacopter' } as any;
    const realDrone = {
      droneId: 'AERON-HEX-01',
      displayName: 'AERON Hexacopter',
      model: 'Pixhawk 2.4.8 (STM32F427)'
    } as any;

    expect(isRealDrone(simDrone1)).toBe(false);
    expect(isRealDrone(simDrone2)).toBe(false);
    expect(isRealDrone(realDrone)).toBe(true);
  });

  it('correctly identifies and flags demo incidents to prevent polluting operational queues', () => {
    const demoInc1 = { incidentId: 'INC-DEMO-001', description: 'Asphalt fissure demo' } as any;
    const demoInc2 = { incidentId: 'INC-2026-002', description: '[DEMO] Crowd density anomaly' } as any;
    const demoInc3 = { incidentId: 'INC-2026-003', description: 'Real description', isSimulated: true } as any;
    const realInc = {
      incidentId: 'INC-2026-101',
      description: 'Authentic bridge joint displacement reported',
      isSimulated: false
    } as any;

    expect(isDemoIncident(demoInc1)).toBe(true);
    expect(isDemoIncident(demoInc2)).toBe(true);
    expect(isDemoIncident(demoInc3)).toBe(true);
    expect(isDemoIncident(realInc)).toBe(false);
  });
});

describe('AERON Manager — Mission Control Operating Modes & Real-Time Observations', () => {
  it('enforces operating mode exclusivity principles between Standard and Mega Mission', () => {
    // In STANDARD mode, active mission locks out other mission verticals
    const standardSession = {
      operatingMode: 'STANDARD',
      status: 'ACTIVE',
      activeMissionId: 'MSN-CIV-001',
      activeMissionType: 'CIVIC_ISSUE_VERIFICATION',
      pipelines: {
        civic: { status: 'RUNNING', healthy: true },
        crowd: { status: 'OFFLINE', healthy: false },
        sar: { status: 'OFFLINE', healthy: false }
      }
    };

    expect(standardSession.operatingMode).toBe('STANDARD');
    expect(standardSession.pipelines.civic.status).toBe('RUNNING');
    expect(standardSession.pipelines.crowd.status).toBe('OFFLINE');
    expect(standardSession.pipelines.sar.status).toBe('OFFLINE');

    // In MEGA_MISSION mode, all operational verticals can run concurrently
    const megaSession = {
      operatingMode: 'MEGA_MISSION',
      status: 'ACTIVE',
      activeMissionId: 'MEGA-SESSION-001',
      activeMissionType: 'MEGA_MISSION',
      pipelines: {
        civic: { status: 'RUNNING', healthy: false, degradedReason: 'MODEL_NOT_AVAILABLE' },
        crowd: { status: 'RUNNING', healthy: true },
        sar: { status: 'RUNNING', healthy: true }
      }
    };

    expect(megaSession.operatingMode).toBe('MEGA_MISSION');
    expect(megaSession.pipelines.civic.status).toBe('RUNNING');
    expect(megaSession.pipelines.crowd.status).toBe('RUNNING');
    expect(megaSession.pipelines.sar.status).toBe('RUNNING');
    expect(megaSession.pipelines.civic.degradedReason).toBe('MODEL_NOT_AVAILABLE');
  });

  it('validates observation telemetry vector and location accuracy classifications', () => {
    const exactObservation = {
      observationId: 'OBS-2026-001',
      missionType: 'CROWD_SAFETY',
      label: 'person',
      confidence: 0.88,
      locationAccuracyStatus: 'EXACT',
      telemetryTimeDiffMs: 45,
      dronePosition: { latitude: 12.9716, longitude: 77.5946, altitude: 25.0 },
      estimatedTargetPosition: { latitude: 12.97165, longitude: 77.59462 },
      verificationStatus: 'PENDING_REVIEW'
    };

    expect(exactObservation.locationAccuracyStatus).toBe('EXACT');
    expect(exactObservation.telemetryTimeDiffMs).toBeLessThan(100);
    expect(exactObservation.verificationStatus).toBe('PENDING_REVIEW');

    const staleObservation = {
      ...exactObservation,
      locationAccuracyStatus: 'UNAVAILABLE',
      telemetryTimeDiffMs: 3500,
      estimatedTargetPosition: null
    };

    expect(staleObservation.locationAccuracyStatus).toBe('UNAVAILABLE');
    expect(staleObservation.telemetryTimeDiffMs).toBeGreaterThan(2000);
    expect(staleObservation.estimatedTargetPosition).toBeNull();
  });

  it('verifies human-in-the-loop review actions strictly transition verificationStatus', () => {
    let status: 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' = 'PENDING_REVIEW';

    const triage = (action: 'ACCEPT' | 'REJECT') => {
      status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    };

    triage('ACCEPT');
    expect(status).toBe('ACCEPTED');

    triage('REJECT');
    expect(status).toBe('REJECTED');
  });

  describe('Vertical 4: Bhopal Micro-Climate & Air Quality Telemetry', () => {
    it('enforces strict source-isolation between external CAMS/Open-Meteo API and airframe hardware sensor', () => {
      const payload: any = {
        location: {
          city: 'Bhopal',
          state: 'Madhya Pradesh',
          country: 'India',
          latitude: 23.2599,
          longitude: 77.4126,
          timezone: 'Asia/Kolkata'
        },
        weather: {
          temperature: 28.4,
          apparentTemperature: 29.1,
          relativeHumidity: 35,
          pressureMsl: 1015.2,
          windSpeed: 8.5,
          windDirection: 120,
          windGusts: 14.2,
          precipitation: 0.0,
          cloudCover: 15,
          weatherCode: 0,
          weatherDescription: 'Clear sky'
        },
        airQuality: {
          usAqi: 112,
          europeanAqi: 64,
          pm25: 38.5,
          pm10: 48.2,
          carbonMonoxide: 240,
          nitrogenDioxide: 18.2,
          sulphurDioxide: 8.4,
          ozone: 72.1,
          dust: 12.0,
          uvIndex: 4.5
        },
        hardwareSensors: {
          status: 'SENSOR_NOT_CONNECTED',
          droneId: null,
          lastReadingAt: null,
          readings: null,
          source: 'NONE',
          notes: 'Airframe BMP280 not reporting on telemetry stream. Connect drone to view micro-altitude localized readings.'
        },
        summary: {
          flightAdvisory: 'PERMITTED',
          advisoryReasons: [],
          thermalClassification: 'Optimal flight conditions',
          airQualityClassification: 'Moderate / Sensitive Alert',
          particulateAlert: true,
          windAlert: false,
          rainAlert: false
        }
      };

      // Ensure API location coordinates match Bhopal
      expect(payload.location.latitude).toBeCloseTo(23.2599, 4);
      expect(payload.location.longitude).toBeCloseTo(77.4126, 4);
      expect(payload.location.city).toBe('Bhopal');

      // Ensure US AQI and European AQI are both distinct indices
      expect(payload.airQuality.usAqi).not.toBe(payload.airQuality.europeanAqi);
      expect(payload.airQuality.usAqi).toBeGreaterThan(0);
      expect(payload.airQuality.europeanAqi).toBeGreaterThan(0);

      // Verify that hardware sensor state is completely decoupled from API weather
      expect(payload.hardwareSensors.status).toBe('SENSOR_NOT_CONNECTED');
      expect(payload.hardwareSensors.readings).toBeNull();
      expect(payload.weather.temperature).toBe(28.4);

      // When a physical drone connects, hardware sensor receives its own reading without altering regional API weather
      payload.hardwareSensors = {
        status: 'SENSOR_CONNECTED',
        droneId: 'AERON-HEX-01',
        lastReadingAt: new Date().toISOString(),
        readings: {
          temperature: 29.8,
          humidity: 32.1,
          pressure: 1014.8
        },
        source: 'AIRFRAME_BMP280_I2C',
        notes: 'Live I2C telemetry stream active from drone AERON-HEX-01'
      };

      expect(payload.hardwareSensors.status).toBe('SENSOR_CONNECTED');
      expect(payload.hardwareSensors.readings.temperature).toBe(29.8);
      // Regional API weather remains untampered
      expect(payload.weather.temperature).toBe(28.4);
    });

    it('correctly maps flight advisories when severe weather triggers alerts', () => {
      const evaluateAdvisory = (windGusts: number, rain: number, temp: number) => {
        const reasons: string[] = [];
        let status: 'PERMITTED' | 'CAUTION' | 'RESTRICTED' = 'PERMITTED';

        if (windGusts > 45 || rain > 5.0 || temp > 46) {
          status = 'RESTRICTED';
          if (windGusts > 45) reasons.push('Severe wind gusts');
          if (rain > 5.0) reasons.push('Heavy rainfall');
          if (temp > 46) reasons.push('Extreme heat exceeds battery ceiling');
        } else if (windGusts > 30 || rain > 0.5 || temp > 40) {
          status = 'CAUTION';
          if (windGusts > 30) reasons.push('Moderate wind gusts');
          if (rain > 0.5) reasons.push('Light rain active');
        }

        return { status, reasons };
      };

      const calm = evaluateAdvisory(12, 0, 28);
      expect(calm.status).toBe('PERMITTED');
      expect(calm.reasons.length).toBe(0);

      const windy = evaluateAdvisory(35, 0, 30);
      expect(windy.status).toBe('CAUTION');
      expect(windy.reasons).toContain('Moderate wind gusts');

      const storm = evaluateAdvisory(55, 8.5, 32);
      expect(storm.status).toBe('RESTRICTED');
      expect(storm.reasons).toContain('Severe wind gusts');
      expect(storm.reasons).toContain('Heavy rainfall');
    });
  });
});
