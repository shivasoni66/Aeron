# AERON — TASK 02: DATABASE ARCHITECTURE, MONGOOSE MODELS & TELEMETRY PERSISTENCE
## Implementation & Technical Audit Report

- **Platform:** AERON — Multi-Mission Autonomous Drone Platform
- **Role:** Senior Backend Architect & MongoDB Database Engineer
- **Audit Date:** 2026-11-08
- **Phase Status:** **100% COMPLETE — PRODUCTION READY**

---

## 1. Executive Summary

Task 02 establishes the foundational data layer and schema architecture for the entire AERON platform. Operating within the single shared Node.js/Express backend (`Backend/`), 13 comprehensive Mongoose models and associated GeoJSON geospatial schemas were engineered, indexed, and verified.

All models adhere to production-grade engineering principles:
1. **Independent Telemetry Collection:** Real-time 10Hz MAVLink telemetry is stored as independent immutable documents in `telemetryrecords` with compound `[droneId, recordedAt]` and `[flightSessionId, recordedAt]` indexes, preventing the 16MB document size ceiling.
2. **Strict GeoJSON Ordering:** All coordinates strictly follow `[longitude, latitude]` with standard $-180 \le \text{lon} \le 180$ and $-90 \le \text{lat} \le 90$ coordinate bounds, backed by MongoDB `2dsphere` indexes.
3. **Decoupled Binary Storage:** Raw image/video/sensor binaries are never stored in MongoDB; only metadata, cryptographic checksums, and storage references are managed in `mediaassets`.
4. **4 Canonical Mission Verticals:** Schema enums enforce the exact approved categories: `CIVIC_ISSUE_VERIFICATION`, `CROWD_SAFETY`, `MICRO_CLIMATE`, and `SUBTERRANEAN_SEARCH_RESCUE`.
5. **Confidentiality by Design:** Subterranean Search & Rescue incidents and operations feature explicit `isConfidential: true` flags to prevent survivor coordinate leakage on public feeds.
6. **Zero Regression:** All 38 automated test cases passed cleanly, and all 5 platform components (`Backend`, `admin`, `manager`, `userapp`, `drone-bridge`) build and test with zero errors.

---

## 2. Master Collection Inventory & Mongoose Models

All models reside under `Backend/src/models/` and are re-exported via `Backend/src/models/index.ts`:

| # | Collection Name | Model File | Primary Key / Unique Field | Core References & Key Indexes |
|---|---|---|---|---|
| 1 | `users` | `User.ts` | `email` (Unique) | RBAC roles (`admin`, `manager`, `citizen`), password hash hidden (`select: false`) |
| 2 | `drones` | `Drone.ts` | `droneId` (Unique) | Operational status index (`READY`, `IN_FLIGHT`, `MAINTENANCE`, `OFFLINE`), `lastTelemetryAt` |
| 3 | `hardwaredevices` | `HardwareDevice.ts` | `deviceId` (Unique) | `droneId` ref, compound `{ droneId: 1, deviceType: 1 }`, connection status index |
| 4 | `flightsessions` | `FlightSession.ts` | `flightSessionId` (Unique) | `droneId` ref, `missionId` ref, source index (`REAL`, `SIMULATION`), start/end GeoPoints |
| 5 | `telemetryrecords` | `TelemetryRecord.ts` | Auto `_id` | Compound `{ droneId: 1, recordedAt: -1 }`, `{ flightSessionId: 1, recordedAt: 1 }`, `2dsphere` on `location` |
| 6 | `missions` | `Mission.ts` | `missionId` (Unique) | 4 canonical categories, 8-stage lifecycle tracker, `operationalArea` `2dsphere` index |
| 7 | `missionevents` | `MissionEvent.ts` | Auto `_id` | `missionId` ref, compound `{ missionId: 1, eventTimestamp: -1 }`, event type logs |
| 8 | `incidents` | `Incident.ts` | `incidentId` (Unique) | `isConfidential` flag for SAR, severity & status indexes, `location` `2dsphere` index |
| 9 | `citizenreports` | `CitizenReport.ts` | `reportId` (Unique) | `citizenId` ref, 6-stage lifecycle progression, gamified points, `location` `2dsphere` index |
| 10 | `mediaassets` | `MediaAsset.ts` | `mediaId` (Unique) | Decoupled metadata only, compound `{ relatedEntityType: 1, relatedEntityId: 1 }` |
| 11 | `missionoutcomes` | `MissionOutcome.ts` | `outcomeId` (Unique) | `missionId` ref, review status lifecycle (`DRAFT` $\to$ `PUBLISHED`), `isPublic` flag |
| 12 | `notifications` | `Notification.ts` | Auto `_id` | `recipientId` ref, compound `{ recipientId: 1, createdAt: -1 }`, read status index |
| 13 | `auditlogs` | `AuditLog.ts` | Auto `_id` | Immutable security log, `{ timestamp: -1 }`, `{ entityType: 1, entityId: 1 }` |

---

## 3. Telemetry Ingestion Architecture & High-Frequency Persistence

### 3.1. Telemetry Document Schema
The `TelemetryRecord` schema captures normalized telemetry streams broadcast by the Pixhawk 2.4.8 autopilot via the Python drone bridge:
- **Identification:** `droneId` (ObjectId), `flightSessionId` (ObjectId), `source` (`'MAVLINK_BRIDGE'`), `isSimulated` (Boolean).
- **Position & Attitude:** `latitude`, `longitude`, `altitude` (MSL), `relativeAltitude` (AGL), `heading` ($0..360^\circ$).
- **Velocity & Flight State:** `groundSpeed`, `verticalSpeed`, `flightMode` (`'AUTO'`, `'LOITER'`, `'RTL'`, etc.), `armed` (Boolean).
- **Power & Avionics Health:** `batteryVoltage` (4S pack: $0..25.2\text{V}$), `batteryCurrent`, `batteryPercentage` ($0..100\%$), `satellites`, `gpsFixType`, `hdop`.

### 3.2. Automated Pre-Validation Hook
To guarantee that high-speed numeric feeds automatically generate valid spatial structures without duplicate frontend formatting, `TelemetryRecordSchema.pre('validate')` automatically constructs the GeoJSON point:
```typescript
TelemetryRecordSchema.pre('validate', function (next) {
  if (this.latitude !== undefined && this.longitude !== undefined) {
    if (this.longitude >= -180 && this.longitude <= 180 && this.latitude >= -90 && this.latitude <= 90) {
      this.location = {
        type: 'Point',
        coordinates: [this.longitude, this.latitude]
      };
    }
  }
  next();
});
```

### 3.3. Compound Indexing Strategy
- `{ droneId: 1, recordedAt: -1 }`: Instantaneous lookup of the latest telemetry packet per airframe.
- `{ flightSessionId: 1, recordedAt: 1 }`: Sequential forward playback and trajectory reconstruction for completed sorties.
- `{ location: '2dsphere' }`: Spatial geofencing queries and boundary breach calculations.
- `{ isSimulated: 1, recordedAt: -1 }`: Strict partitioning of simulation runs from physical live-flight data.

---

## 4. Geospatial Architecture & Coordinate Standards

In accordance with official GeoJSON (RFC 7946) and MongoDB geospatial specifications:
- Coordinates are stored strictly in `[longitude, latitude]` order.
- Standard geographic bounds are enforced by schema validators:
  $$\text{longitude} \in [-180, 180], \quad \text{latitude} \in [-90, 90]$$
- Collections featuring `2dsphere` indexed geospatial geometry:
  1. `telemetryrecords.location` (Point)
  2. `missions.operationalArea` (Polygon / MultiPolygon)
  3. `incidents.location` (Point)
  4. `citizenreports.location` (Point)
  5. `flightsessions.startLocation` / `flightsessions.endLocation` (Point)

---

## 5. Media Asset Storage Isolation (Zero Binaries in DB)

Binary payloads (JPEG/PNG orthomosaics, MP4 mission feeds, thermal FLIR radiometry, LAS point clouds) are strictly isolated from the MongoDB document store.
`MediaAsset` manages exclusively:
- `storageProvider`: `'LOCAL'` | `'S3'` | `'CLOUDINARY'` | `'GCS'`
- `storageKey`: Normalized storage path or bucket object key
- `mediaType`: `'IMAGE'` | `'VIDEO'` | `'THERMAL'` | `'POINT_CLOUD'` | `'DOCUMENT'`
- `contentType`: MIME type string
- `fileSize`: Non-zero byte count
- `checksum`: SHA-256 integrity digest
- `metadata`: EXIF capture parameters (altitude, focal length, camera orientation)

---

## 6. Verification & Automated Test Results

A dedicated offline schema validation suite was implemented under `Backend/tests/models/models.test.ts`. All validators, hooks, enum constraints, and type protections execute without requiring an active MongoDB connection.

### Test Execution Summary
```
 RUN  v3.2.7 C:/Shiva/MORE/Projects/Aeron/Backend

 ✓ tests/models/models.test.ts (33 tests) 24ms
   ✓ User Model (4 tests)
   ✓ Drone Model (3 tests)
   ✓ HardwareDevice Model (3 tests)
   ✓ FlightSession Model (3 tests)
   ✓ TelemetryRecord Model & Pre-Validate Hook (2 tests)
   ✓ Mission Model & 4 Canonical Categories (3 tests)
   ✓ MissionEvent Model (2 tests)
   ✓ Incident Model (3 tests)
   ✓ CitizenReport Model (2 tests)
   ✓ MediaAsset Model (2 tests)
   ✓ MissionOutcome Model (2 tests)
   ✓ Notification Model (2 tests)
   ✓ AuditLog Model (2 tests)

 ✓ tests/health.test.ts (5 tests) 33ms

 Test Files  2 passed (2)
      Tests  38 passed (38)
   Duration  1.55s
```

### Full Repository Regression Verification
| Component | Technology | Verification Command | Result |
|---|---|---|---|
| **Backend** | Node.js + TypeScript | `npm run build && npm test` | **0 errors, 38 tests passing** |
| **Admin Web** | React 18 + Vite + TS | `npm run build` | **0 errors, production build verified** |
| **Manager Web** | React 18 + Vite + TS | `npm run build` | **0 errors, production build verified** |
| **Drone Bridge** | Python 3.14 + MAVLink | `python -m unittest tests/test_simulator.py` | **0 errors, 3 tests passing** |
| **Citizen App** | Flutter 3.47 + Dart | `flutter test` | **0 errors, widget tests passing** |

---

## 7. Deliverables & Documentation Created

1. **Model Source Files (`Backend/src/models/`):**
   - `types.ts`: GeoJSON types and coordinate validators.
   - `User.ts`, `Drone.ts`, `HardwareDevice.ts`, `FlightSession.ts`, `TelemetryRecord.ts`, `Mission.ts`, `MissionEvent.ts`, `Incident.ts`, `CitizenReport.ts`, `MediaAsset.ts`, `MissionOutcome.ts`, `Notification.ts`, `AuditLog.ts`.
   - `index.ts`: Barrel export of all models and interfaces.
2. **Offline Test Suite:** `Backend/tests/models/models.test.ts` (33 model validation tests).
3. **Database Architecture Guide:** `documentation/database-architecture.md` (comprehensive specifications and Mermaid ER diagram).
4. **Platform Documentation:** Updated `README.md` with Section 4 detailing the database architecture.

---

## 8. Readiness for Task 03

The data architecture is completely established and ready for **Task 03: Authentication, JWT Security & Role-Based Access Control (RBAC)**.
- The `User` model is fully configured with canonical roles (`admin`, `manager`, `citizen`), active status enforcement, and security-hardened password hash omission (`select: false`).
- Audit logging infrastructure is ready to capture authentication events.
- Zero open prerequisites or blockers remain.
