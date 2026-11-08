import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import {
  User,
  Drone,
  HardwareDevice,
  FlightSession,
  TelemetryRecord,
  Mission,
  MissionEvent,
  Incident,
  CitizenReport,
  MediaAsset,
  MissionOutcome,
  Notification,
  AuditLog
} from '../../src/models/index.js';

describe('AERON Database Models — Offline Schema & Validation Suite', () => {
  const dummyObjectId = () => new mongoose.Types.ObjectId();

  // ==========================================
  // 1. USER MODEL
  // ==========================================
  describe('User Model', () => {
    it('validates a correct user document', () => {
      const user = new User({
        name: 'Chief Pilot John',
        email: 'pilot.john@aeron.gov',
        passwordHash: '$2b$12$eX4mpleH4shValu3ForT3stingPurp0sesOnly!',
        role: 'admin',
        accountStatus: 'active'
      });

      const err = user.validateSync();
      expect(err).toBeUndefined();
    });

    it('rejects invalid email formats', () => {
      const user = new User({
        name: 'Invalid Email User',
        email: 'not-an-email',
        passwordHash: 'dummyhash',
        role: 'citizen'
      });

      const err = user.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.email).toBeDefined();
    });

    it('rejects unauthorized roles', () => {
      const user = new User({
        name: 'Hacker User',
        email: 'hacker@darkweb.org',
        passwordHash: 'dummyhash',
        // @ts-expect-error Testing invalid role assignment
        role: 'superadmin'
      });

      const err = user.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.role).toBeDefined();
    });

    it('enforces required fields', () => {
      const user = new User({});
      const err = user.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.name).toBeDefined();
      expect(err?.errors.email).toBeDefined();
      expect(err?.errors.passwordHash).toBeDefined();
    });
  });

  // ==========================================
  // 2. DRONE MODEL
  // ==========================================
  describe('Drone Model', () => {
    it('validates a correct drone document', () => {
      const drone = new Drone({
        droneId: 'AERON-HEX-01',
        displayName: 'Apex-Leader',
        model: 'Tarot 680 Pro Hexacopter',
        manufacturer: 'AERON Aerospace',
        flightController: 'Pixhawk 2.4.8 Autopilot',
        operationalStatus: 'READY'
      });

      const err = drone.validateSync();
      expect(err).toBeUndefined();
    });

    it('rejects invalid operational status', () => {
      const drone = new Drone({
        droneId: 'AERON-QUAD-02',
        displayName: 'Ghost',
        model: 'S500 Quad',
        flightController: 'Pixhawk 2.4.8',
        // @ts-expect-error Testing invalid operational status
        operationalStatus: 'IN_THE_AIR'
      });

      const err = drone.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.operationalStatus).toBeDefined();
    });

    it('enforces unique and required droneId and core specs', () => {
      const drone = new Drone({
        manufacturer: 'Generic Drone Corp'
      });

      const err = drone.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.droneId).toBeDefined();
      expect(err?.errors.displayName).toBeDefined();
      expect(err?.errors.model).toBeDefined();
      expect(err?.errors.flightController).toBeDefined();
    });
  });

  // ==========================================
  // 3. HARDWARE DEVICE MODEL
  // ==========================================
  describe('HardwareDevice Model', () => {
    it('validates a correct hardware device specification', () => {
      const device = new HardwareDevice({
        deviceId: 'FC-PIXHAWK-248-01',
        droneId: dummyObjectId(),
        deviceType: 'FLIGHT_CONTROLLER',
        manufacturer: 'Holybro / CUAV Standard',
        model: 'Pixhawk 2.4.8 Autopilot',
        serialNumber: 'SN-PX4-998811',
        installationStatus: 'INSTALLED',
        connectionStatus: 'CONNECTED'
      });

      const err = device.validateSync();
      expect(err).toBeUndefined();
    });

    it('rejects unauthorized installation status', () => {
      const device = new HardwareDevice({
        deviceId: 'GPS-M8N-01',
        droneId: dummyObjectId(),
        deviceType: 'GPS',
        manufacturer: 'Ublox',
        model: 'NEO-M8N',
        // @ts-expect-error Testing invalid installation status
        installationStatus: 'PARTIAL'
      });

      const err = device.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.installationStatus).toBeDefined();
    });

    it('rejects unauthorized connection status', () => {
      const device = new HardwareDevice({
        deviceId: 'CAM-4K-01',
        droneId: dummyObjectId(),
        deviceType: 'CAMERA',
        manufacturer: 'Sony',
        model: 'Exmor R',
        installationStatus: 'INSTALLED',
        // @ts-expect-error Testing invalid connection status
        connectionStatus: 'HALF_OPEN'
      });

      const err = device.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.connectionStatus).toBeDefined();
    });
  });

  // ==========================================
  // 4. FLIGHT SESSION MODEL
  // ==========================================
  describe('FlightSession Model', () => {
    it('validates a real flight session document', () => {
      const session = new FlightSession({
        flightSessionId: 'FS-2026-001',
        droneId: dummyObjectId(),
        source: 'REAL',
        status: 'ACTIVE',
        startedAt: new Date()
      });

      const err = session.validateSync();
      expect(err).toBeUndefined();
    });

    it('validates a simulation flight session document', () => {
      const session = new FlightSession({
        flightSessionId: 'FS-SIM-999',
        droneId: dummyObjectId(),
        source: 'SIMULATION',
        status: 'COMPLETED',
        startedAt: new Date(),
        endedAt: new Date()
      });

      const err = session.validateSync();
      expect(err).toBeUndefined();
    });

    it('rejects unknown flight session sources', () => {
      const session = new FlightSession({
        flightSessionId: 'FS-ERR-001',
        droneId: dummyObjectId(),
        // @ts-expect-error Testing invalid source
        source: 'MOCK_TEST'
      });

      const err = session.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.source).toBeDefined();
    });
  });

  // ==========================================
  // 5. TELEMETRY RECORD MODEL & HOOKS
  // ==========================================
  describe('TelemetryRecord Model', () => {
    it('validates a realistic MAVLink telemetry record and auto-generates GeoJSON location', async () => {
      const record = new TelemetryRecord({
        droneId: dummyObjectId(),
        flightSessionId: dummyObjectId(),
        source: 'MAVLINK_BRIDGE',
        isSimulated: false,
        latitude: 12.9716,
        longitude: 77.5946,
        relativeAltitude: 45.2,
        altitude: 965.2,
        heading: 180,
        groundSpeed: 12.4,
        batteryPercentage: 88,
        batteryVoltage: 22.4,
        batteryCurrent: 14.8,
        gpsFixType: '3D_FIX',
        satellites: 14,
        flightMode: 'AUTO',
        armed: true,
        recordedAt: new Date()
      });

      // Triggers pre-validation hook for location auto-population
      await record.validate();

      expect(record.location).toBeDefined();
      expect(record.location?.type).toBe('Point');
      // GeoJSON standard: [longitude, latitude]
      expect(record.location?.coordinates[0]).toBe(77.5946);
      expect(record.location?.coordinates[1]).toBe(12.9716);
    });

    it('rejects out-of-range coordinates and metrics', async () => {
      const record = new TelemetryRecord({
        droneId: dummyObjectId(),
        source: 'MAVLINK_BRIDGE',
        recordedAt: new Date(),
        armed: true,
        latitude: 95.5, // Invalid: > 90
        longitude: 190.2, // Invalid: > 180
        batteryPercentage: 115, // Invalid: > 100
        heading: 400 // Invalid: > 360
      });

      let validationError: mongoose.Error.ValidationError | null = null;
      try {
        await record.validate();
      } catch (err) {
        validationError = err as mongoose.Error.ValidationError;
      }

      expect(validationError).toBeDefined();
      expect(validationError?.errors.latitude).toBeDefined();
      expect(validationError?.errors.longitude).toBeDefined();
      expect(validationError?.errors.batteryPercentage).toBeDefined();
      expect(validationError?.errors.heading).toBeDefined();
    });
  });

  // ==========================================
  // 6. MISSION MODEL & 4 CANONICAL CATEGORIES
  // ==========================================
  describe('Mission Model', () => {
    const validArea = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [77.59, 12.97],
          [77.60, 12.97],
          [77.60, 12.98],
          [77.59, 12.98],
          [77.59, 12.97]
        ]
      ]
    };

    it('accepts all 4 canonical mission categories', () => {
      const missionTypes = [
        'CIVIC_ISSUE_VERIFICATION',
        'CROWD_SAFETY',
        'MICRO_CLIMATE',
        'SUBTERRANEAN_SEARCH_RESCUE'
      ] as const;

      missionTypes.forEach((type, idx) => {
        const mission = new Mission({
          missionId: `MSN-2026-00${idx + 1}`,
          title: `Mission ${type}`,
          description: `Comprehensive operational details for ${type}`,
          missionType: type,
          operationalArea: validArea,
          stage: 1,
          status: 'PLANNED',
          createdBy: dummyObjectId()
        });

        const err = mission.validateSync();
        expect(err).toBeUndefined();
      });
    });

    it('rejects an invalid mission category', () => {
      const mission = new Mission({
        missionId: 'MSN-INVALID-01',
        title: 'Unauthorized Mission',
        description: 'Testing unauthorized type rejection',
        // @ts-expect-error Testing invalid missionType
        missionType: 'MILITARY_ATTACK',
        operationalArea: validArea,
        createdBy: dummyObjectId()
      });

      const err = mission.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.missionType).toBeDefined();
    });

    it('rejects out-of-range lifecycle stages (< 1 or > 8)', () => {
      const mission = new Mission({
        missionId: 'MSN-STAGE-ERR',
        title: 'Stage Error Mission',
        description: 'Testing stage boundaries',
        missionType: 'CROWD_SAFETY',
        operationalArea: validArea,
        stage: 9, // Invalid: max 8
        createdBy: dummyObjectId()
      });

      const err = mission.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.stage).toBeDefined();
    });
  });

  // ==========================================
  // 7. MISSION EVENT MODEL
  // ==========================================
  describe('MissionEvent Model', () => {
    it('validates a correct mission event document', () => {
      const event = new MissionEvent({
        missionId: dummyObjectId(),
        eventType: 'WAYPOINT_REACHED',
        description: 'Drone reached Waypoint WP-03 at altitude 40m',
        eventTimestamp: new Date(),
        source: 'DRONE_BRIDGE',
        metadata: {
          waypointIndex: 3,
          batteryRemaining: 74
        }
      });

      const err = event.validateSync();
      expect(err).toBeUndefined();
    });

    it('enforces required mission event fields', () => {
      const event = new MissionEvent({});
      const err = event.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.missionId).toBeDefined();
      expect(err?.errors.eventType).toBeDefined();
      expect(err?.errors.description).toBeDefined();
    });
  });

  // ==========================================
  // 8. INCIDENT MODEL
  // ==========================================
  describe('Incident Model', () => {
    it('validates a public civic incident', () => {
      const incident = new Incident({
        incidentId: 'INC-2026-001',
        incidentType: 'ROAD_DAMAGE',
        description: 'Large pothole observed near outer ring road junction',
        severity: 'MEDIUM',
        status: 'OPEN',
        location: {
          type: 'Point',
          coordinates: [77.625, 12.935]
        },
        isConfidential: false
      });

      const err = incident.validateSync();
      expect(err).toBeUndefined();
    });

    it('protects subterranean SAR incidents with confidentiality flag', () => {
      const incident = new Incident({
        incidentId: 'INC-SAR-009',
        incidentType: 'SURVIVOR_HEAT_SIGNATURE',
        description: 'Thermal anomaly in collapsed tunnel section',
        severity: 'CRITICAL',
        status: 'INVESTIGATING',
        location: {
          type: 'Point',
          coordinates: [77.63, 12.94]
        },
        isConfidential: true
      });

      const err = incident.validateSync();
      expect(err).toBeUndefined();
      expect(incident.isConfidential).toBe(true);
    });

    it('rejects invalid incident status', () => {
      const incident = new Incident({
        incidentId: 'INC-STATUS-ERR',
        incidentType: 'FIRE_HAZARD',
        description: 'Fire spotted in scrubland',
        severity: 'HIGH',
        // @ts-expect-error Testing invalid status
        status: 'CONFIRMED'
      });

      const err = incident.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.status).toBeDefined();
    });
  });

  // ==========================================
  // 9. CITIZEN REPORT MODEL
  // ==========================================
  describe('CitizenReport Model', () => {
    it('validates a valid citizen report with stage progression', () => {
      const report = new CitizenReport({
        reportId: 'REP-2026-001',
        citizenId: dummyObjectId(),
        category: 'ROAD_STRUCTURAL',
        description: 'Major road subsidence noticed after water pipeline burst',
        location: {
          type: 'Point',
          coordinates: [77.58, 12.95]
        },
        status: 'SUBMITTED',
        currentStage: 1,
        earnedPoints: 25
      });

      const err = report.validateSync();
      expect(err).toBeUndefined();
    });

    it('rejects invalid categories in citizen report', () => {
      const report = new CitizenReport({
        reportId: 'REP-ERR-01',
        citizenId: dummyObjectId(),
        // @ts-expect-error Testing invalid category
        category: 'SPAM_REPORT',
        description: 'Test report',
        location: {
          type: 'Point',
          coordinates: [77.58, 12.95]
        }
      });

      const err = report.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.category).toBeDefined();
    });
  });

  // ==========================================
  // 10. MEDIA ASSET MODEL (METADATA ONLY)
  // ==========================================
  describe('MediaAsset Model', () => {
    it('validates a media asset metadata record (no raw binary in DB)', () => {
      const media = new MediaAsset({
        mediaId: 'MED-2026-001',
        storageProvider: 'LOCAL',
        storageKey: 'uploads/2026/03/flight_aerial_ortho.jpg',
        mediaType: 'IMAGE',
        contentType: 'image/jpeg',
        fileSize: 4520100, // 4.5MB
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        uploadedBy: dummyObjectId(),
        relatedEntityType: 'MISSION',
        relatedEntityId: dummyObjectId(),
        source: 'DRONE_PAYLOAD',
        metadata: {
          altitudeMeters: 45,
          focalLengthMm: 24,
          iso: 100
        }
      });

      const err = media.validateSync();
      expect(err).toBeUndefined();
    });

    it('rejects invalid file size (<= 0 bytes)', () => {
      const media = new MediaAsset({
        mediaId: 'MED-ZERO-01',
        storageProvider: 'LOCAL',
        storageKey: 'empty.bin',
        mediaType: 'DOCUMENT',
        contentType: 'application/octet-stream',
        fileSize: 0,
        uploadedBy: dummyObjectId(),
        relatedEntityType: 'CITIZEN_REPORT',
        relatedEntityId: dummyObjectId(),
        source: 'CITIZEN_UPLOAD'
      });

      const err = media.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.fileSize).toBeDefined();
    });
  });

  // ==========================================
  // 11. MISSION OUTCOME MODEL
  // ==========================================
  describe('MissionOutcome Model', () => {
    it('validates a mission outcome document through its review lifecycle', () => {
      const outcome = new MissionOutcome({
        outcomeId: 'OUT-2026-001',
        missionId: dummyObjectId(),
        outcomeType: 'CIVIC_INFRASTRUCTURE',
        summary: 'Road structural stability verified via multispectral scan',
        findings: 'Sub-surface degradation detected between chainage 12+400 and 12+800.',
        reviewStatus: 'APPROVED',
        isPublic: true,
        reviewedBy: dummyObjectId(),
        reviewedAt: new Date()
      });

      const err = outcome.validateSync();
      expect(err).toBeUndefined();
    });

    it('rejects excessive summary length (> 200 chars)', () => {
      const outcome = new MissionOutcome({
        outcomeId: 'OUT-TOOLONG-01',
        missionId: dummyObjectId(),
        outcomeType: 'PUBLIC_SAFETY',
        summary: 'A'.repeat(250),
        findings: 'Short findings'
      });

      const err = outcome.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.summary).toBeDefined();
    });
  });

  // ==========================================
  // 12. NOTIFICATION MODEL
  // ==========================================
  describe('Notification Model', () => {
    it('validates a user notification document', () => {
      const notification = new Notification({
        recipientId: dummyObjectId(),
        title: 'Mission Flight Initiated',
        message: 'Drone AERON-HEX-01 has taken off for Civic Inspection #44',
        category: 'MISSION',
        relatedEntityType: 'MISSION',
        relatedEntityId: dummyObjectId()
      });

      const err = notification.validateSync();
      expect(err).toBeUndefined();
    });

    it('rejects unauthorized notification categories', () => {
      const notification = new Notification({
        recipientId: dummyObjectId(),
        title: 'Spam Alert',
        message: 'You won a lottery!',
        // @ts-expect-error Testing invalid category
        category: 'MARKETING_PROMO'
      });

      const err = notification.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.category).toBeDefined();
    });
  });

  // ==========================================
  // 13. AUDIT LOG MODEL
  // ==========================================
  describe('AuditLog Model', () => {
    it('validates an immutable audit log record', () => {
      const log = new AuditLog({
        actorId: dummyObjectId(),
        action: 'MISSION_ABORT_COMMAND',
        entityType: 'MISSION',
        entityId: 'MSN-2026-001',
        source: 'ADMIN_WEB',
        metadata: {
          reason: 'Geofence breach contingency activated by operator',
          ipAddress: '192.168.1.100'
        }
      });

      const err = log.validateSync();
      expect(err).toBeUndefined();
    });

    it('rejects unauthorized audit sources', () => {
      const log = new AuditLog({
        action: 'INTRUSION_ATTEMPT',
        entityType: 'SYSTEM',
        entityId: 'AUTH_GATEWAY',
        // @ts-expect-error Testing invalid source
        source: 'UNKNOWN_EXTERNAL_SCRIPT'
      });

      const err = log.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors.source).toBeDefined();
    });
  });
});
