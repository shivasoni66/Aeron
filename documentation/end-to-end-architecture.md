# AERON — End-to-End System Architecture

**Document Version:** 1.0.0  
**Classification:** Core System Integration Specification  
**Platform Identity:** AERON — Multi-Mission Autonomous Drone Platform  

---

## 1. Executive Architectural Overview

The AERON platform is a unified, multi-tier autonomous aerial intelligence system designed to coordinate civic defect verification, municipal crowd perimeter monitoring, environmental sensor mapping, and emergency search & rescue drills. 

The platform connects three specialized front-end applications, a high-throughput Python flight and camera bridge, and a central secure API server backboned by MongoDB Atlas and Socket.IO real-time channels:

```
                                  ┌────────────────────────────────────────┐
                                  │      Pixhawk 2.4.8 Flight Controller   │
                                  │   (MAVLink 2.0 / Serial COM / SITL)    │
                                  └───────────────────┬────────────────────┘
                                                      │ MAVLink Telemetry
                                                      ▼
┌─────────────────────────┐       ┌────────────────────────────────────────┐
│     ESP32-CAM Sensor    │       │          Python Drone Bridge           │
│  (HTTP JPEG / 1-5 FPS)  ├──────►│   (mavlink_parser + camera_transport)  │
└─────────────────────────┘       └───────────────────┬────────────────────┘
                                                      │ M2M Token Ingest
                                                      │ (/telemetry/ingest, /camera/frames)
                                                      ▼
                                  ┌────────────────────────────────────────┐
                                  │        AERON Central Backend API       │
                                  │ (Node.js + Express + TypeScript + JWT) │
                                  └───────┬──────────────────────┬─────────┘
                                          │                      │
                   ┌──────────────────────┴───────┐              │ Socket.IO
                   ▼                              ▼              │ Broadcasts
        ┌─────────────────────┐        ┌──────────────────┐      │
        │ MongoDB Atlas (MDB) │        │ Local / S3 Media │      │
        │ 13 Persisted Models │        │ Evidence Staging │      │
        └─────────────────────┘        └──────────────────┘      │
                   │                              │              │
                   └──────────────────────┬───────┴──────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│     ADMIN WEB GCS     │     │   MANAGER WEB GCS     │     │  CITIZEN MOBILE APP   │
│  [Drone Intelligence] │     │ [Mission Intelligence]│     │  [Citizen Services]   │
│  React + Vite + TS    │     │  React + Vite + TS    │     │  Flutter 3.47+ + Dart │
│  - Pixhawk Telemetry  │     │  - M01 Civic Sorties  │     │  - Civic Reporting    │
│  - Live Camera Preview│     │  - M02 Crowd Safety   │     │  - 6-Stage Tracking   │
│  - Battery / 3D Fix   │     │  - M03 Micro-Climate  │     │  - Verified Outcomes  │
│  - Aircraft Readiness │     │  - M04 Subterranean   │     │  - Civic Achievements │
│  - Flight History Logs│     │  - Outcome Publishing │     │  - Secure Token Vault │
└───────────────────────┘     └───────────────────────┘     └───────────────────────┘
```

---

## 2. Tri-Tier Application Responsibilities

### 2.1 Admin Web — Drone Intelligence (`admin/`)
* **Purpose:** Dedicated hardware telemetry, flight controller diagnostics, and airframe operational readiness monitoring.
* **Core Capabilities:**
  * Pixhawk 2.4.8 protocol diagnostics (baud rate 57600, sysId/compId 1, MAVLink 2.0).
  * Real-time GPS 3D fix tracking, satellite constellation counters, and battery voltage degradation curve.
  * Live camera FPV preview (Admin-only restricted bounded frame buffer).
  * Dynamic 5-point aircraft readiness calculator (FC Init, 3D Fix, 4S Power, Telemetry Freshness, Sensor Port Bypass).
  * System event log auditing and historical flight replay.

### 2.2 Manager Web — Mission Intelligence (`manager/`)
* **Purpose:** Operational mission coordinator and incident command dashboard.
* **Core Capabilities:**
  * 4 core operational verticals:
    * **M01 — Civic Issue Verification:** Road fissures, illegal dumping, municipal triage.
    * **M02 — Crowd Safety & Mesh:** Density threshold observations (zero fabricated panic metrics).
    * **M03 — Micro-Climate:** Environmental sensor surveys (optical visible-spectrum, non-FLIR).
    * **M04 — Subterranean Search & Rescue:** Culvert drills with strict survivor quarantine.
  * Sortie creation, airframe dispatch, and 8-stage operational progression.
  * Outcome review queue (`APPROVED`, `REJECTED`, `REQUIRES_REINSPECTION`).
  * Authorized public publication gate with automatic SAR confidentiality quarantine.

### 2.3 Citizen Mobile App — Citizen Services (`userapp/`)
* **Purpose:** Civic participation, hazard logging, and public outcome verification for residents.
* **Core Capabilities:**
  * Civic reporting intake with observation GPS coordinates and photo evidence attachment.
  * Transparent 6-stage lifecycle progression tracking (Submitted → Review → Scheduled → Aerial Verified → Works Assigned → Resolved).
  * Public verified outcomes explorer (strictly filters published findings; excludes internal missions and confidential SAR).
  * Authentic achievement badges derived strictly from persisted MongoDB submission records.
  * Secure KeyStore/Keychain AES-GCM token vault.

---

## 3. Security Boundaries, Role Matrix & Air-Gaps

The AERON security model enforces role separation strictly at the backend HTTP route and Socket.IO room level:

| Resource / Action | Administrator (`admin`) | Mission Manager (`manager`) | Citizen (`citizen`) |
| :--- | :---: | :---: | :---: |
| **Admin Overview & Readiness** | **ALLOWED** | BLOCKED (403) | BLOCKED (403) |
| **Drone Telemetry Ingest (M2M)** | Machine Token | Machine Token | BLOCKED (401/403) |
| **Raw Telemetry Stream (Socket)** | **ALLOWED** | Assigned Only | BLOCKED |
| **Live Camera Room (`drone:camera:*`)** | **ALLOWED** | BLOCKED | BLOCKED |
| **Mission Planning & Dispatch** | **ALLOWED** | **ALLOWED** | BLOCKED (403) |
| **Outcome Review & Publish** | **ALLOWED** | **ALLOWED** | BLOCKED (403) |
| **Confidential SAR Publish** | BLOCKED (403) | BLOCKED (403) | BLOCKED (403) |
| **Submit Civic Report** | **ALLOWED** | BLOCKED (403) | **ALLOWED** |
| **View Own Private Reports** | **ALLOWED** | BLOCKED (403) | Own Only (404 for others) |
| **Public Published Outcomes** | **ALLOWED** | **ALLOWED** | **ALLOWED** |

### 3.1 Strict System Air-Gaps
1. **Camera Feed Air-Gap:** Real-time raw FPV frames (`drone:camera:*`) are strictly restricted to the Admin GCS (`admin/`). Managers and Citizens attempting to subscribe are disconnected or denied with audit logging.
2. **Telemetry Read Air-Gap:** Citizens cannot query raw GPS waypoints, IMU accelerometer metrics, battery voltages, or flight logs.
3. **Confidential SAR Quarantine:** Subterranean Search & Rescue operations containing sensitive ingress coordinates or survivor identities are flagged `isConfidential = true`. The backend publishing controller strictly denies public release (`403 SAR_CONFIDENTIAL_PROTECTED`).
4. **Flight Control Air-Gap:** Zero armed flight-control commands (ARM, DISARM, TAKEOFF, LAND, RTL, or RC Override) are implemented across the Web or Mobile interfaces. Flight operations are read-only diagnostics and mission tracking.

---

## 4. End-to-End Data Flows

### 4.1 Telemetry Data Flow
```
[Pixhawk 2.4.8 / SITL Simulator]
               │ (MAVLink Heartbeat & GLOBAL_POSITION_INT)
               ▼
   [Python MAVLink Bridge]
               │ (Batched JSON + X-Drone-Bridge-Token)
               ▼
[POST /api/v1/telemetry/ingest]
               │ (Zod Validation & Allowlist Check)
               ▼
    [MongoDB TelemetryRecord]
               │
               ▼
  [Socket.IO Broadcast -> drone:telemetry:DRONE_ID]
               │
               ▼
    [Admin Web Dashboard & Leaflet Map]
```

### 4.2 Camera Data Flow
```
[ESP32-CAM (OV2640) / Mock Reader]
               │ (JPEG Capture 320x240 / 640x480)
               ▼
   [Python Camera Bridge]
               │ (X-Drone-Bridge-Token + Base64 JPEG)
               ▼
   [POST /api/v1/camera/frames]
               │ (SOI/EOI Magic Byte Check + 1MB Bound)
               ▼
  [In-Memory Bounded Frame Store (latestFrames)]
               │ (Zero database bloat)
               ▼
  [Socket.IO Broadcast -> drone:camera:DRONE_ID]
               │ (Admin-only restricted room)
               ▼
     [Admin Live Camera Page Preview]
```

### 4.3 Civic Issue & Verification Lifecycle Flow
```
1. [Citizen Mobile App]: User captures asphalt fissure -> Submits GPS observation.
2. [POST /api/v1/citizen/reports]: Backend persists report AER-2026-XXXX (Stage 1: SUBMITTED).
3. [Manager Web]: Incident flagged in M01 module -> Manager launches sortie (Stage 3: INSPECTION_SCHEDULED).
4. [Admin Web / Drone Bridge]: Quadcopter flies sortie over waypoint.
5. [Manager Web]: Outcome reviewed and approved (Stage 4: AERIAL_VERIFIED).
6. [POST /api/v1/manager/outcomes/:id/publish]: Manager authorizes public summary release.
7. [Citizen Mobile App]: Report advances to Stage 6 (RESOLVED), earning +50 Civic Points; public outcome appears in Explore tab.
```

