# AERON — Demonstration Runbook & Simulation Workflow

**Document Version:** 1.0.0  
**Classification:** Operational Demo Procedure  
**Platform Identity:** AERON — Multi-Mission Autonomous Drone Platform  

---

## 1. Demonstration Philosophy & Honesty Rules

The AERON platform enforces strict demonstration integrity standards:
1. **Explicit Simulation Labeling:** All synthetic airframes, test sorties, mock camera frames, and time-series telemetry packets are explicitly tagged `[SIMULATION]`, `[DEMO]`, `source: 'SIMULATION'`, and `isSimulated: true`.
2. **Never Mix Simulation with Physical Flight History:** Simulated telemetry records are partitioned and filtered from genuine hardware flight sessions.
3. **Zero Fabricated Sensor Telemetry:** When physical hardware (such as Pixhawk or ESP32-CAM) is disconnected, the system honestly reports `NOT_CONNECTED` and `STANDBY`. It never fabricates simulated telemetry masquerading as real hardware (`source=REAL` with simulated payloads is rejected with HTTP 400).
4. **Zero Client-Side Gamification:** Civic points, levels, and badges in the mobile app are calculated strictly from persisted MongoDB submission records.
5. **Production Immunity:** Demonstration seed scripts strictly refuse to run when `NODE_ENV === 'production'`.

---

## 2. Demonstration Seed Command

To reset and populate a deterministic demonstration environment in local development:

```bash
cd Backend
npm run seed:demo
```

### 2.1 Demo Accounts Generated
| Role | Email | Password | Display Name |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin.demo@aeron.gov` | `AeronDemo@2026!Secure` | `[DEMO] Systems Administrator` |
| **Manager** | `manager.demo@aeron.gov` | `AeronDemo@2026!Secure` | `[DEMO] Mission Director` |
| **Citizen** | `citizen.demo@aeron.gov` | `AeronDemo@2026!Secure` | `[DEMO] Civic Observer` |

### 2.2 Seeded Demonstration Assets
* **Airframes:**
  * `DRONE-SIM-01`: `[SIMULATION] AERON Alpha Demo Quadcopter` (`operationalStatus: READY`, `isSimulated: true`).
  * `AERON-PX4-BENCH01`: `AERON PX4 Bench Unit` (`operationalStatus: STANDBY`, `Pixhawk 2.4.8 Hardware`).
* **Missions (4 Verticals):**
  * `MIS-DEMO-001` (M01): `[DEMO] Asphalt Fissure Survey - 8th Main Road` (`ACTIVE`, Stage 3).
  * `MIS-DEMO-002` (M02): `[DEMO] Central Plaza Crowd Density Surveillance` (`ACTIVE`, Stage 2).
  * `MIS-DEMO-003` (M03): `[DEMO] Urban Heat Island Micro-Climate Mapping` (`COMPLETED`, Stage 8).
  * `MIS-DEMO-004` (M04): `[DEMO] Sector 7 Subterranean Search & Rescue Drill` (`ACTIVE`, Stage 4, `isConfidential: true`).
* **Civic Reports:**
  * `AER-2026-0001`: Road fissure (Stage 6: `RESOLVED`, 50 points).
  * `AER-2026-0002`: Storm drain blockage (Stage 4: `AERIAL_VERIFIED`, 25 points).
  * `AER-2026-0003`: Hazardous sidewalk paving (Stage 1: `SUBMITTED`, 25 points).
* **Public Outcomes:**
  * `OUT-DEMO-001`: Road fissure inspection findings published to citizen explore feed.
  * `OUT-DEMO-003`: SAR confidential drill outcome (quarantined from public view).

---

## 3. Step-by-Step Operator Demonstration Script

### Step 1: Start Backend API Server
```bash
cd Backend
npm run dev
# Server listening on http://localhost:5000
```

### Step 2: Seed Demonstration Database
```bash
cd Backend
npm run seed:demo
# Outputs clean confirmation of seeded users, airframes, and missions
```

### Step 3: Admin Web GCS Demonstration (`admin/`)
1. Open `http://localhost:5173` in browser.
2. Sign in with `admin.demo@aeron.gov` / `AeronDemo@2026!Secure`.
3. Navigate to **Drone Overview**:
   * Inspect airframe status (`DRONE-SIM-01` clearly labelled `[SIMULATION]`).
   * Observe Aircraft Readiness Calculation: 100% Bench Ready (Telemetry Fresh, GPS 3D Fix, 4S Battery 15.4V).
   * Note telemetry freshness timestamp updating in real-time.
4. Navigate to **Live Camera Preview**:
   * Inspect live camera frame stream or standby badge.
   * Verify source label displays `SIMULATION`.

### Step 4: Manager Web Mission Command Demonstration (`manager/`)
1. Open `http://localhost:5174` in browser.
2. Sign in with `manager.demo@aeron.gov` / `AeronDemo@2026!Secure`.
3. Inspect **Operations Dashboard**:
   * Module cards displaying M01 Civic, M02 Crowd, M03 Micro-Climate, M04 SAR.
4. Open **M01 // Civic Issue Verification**:
   * View pending municipal road fissure reports.
   * Click **LAUNCH CIVIC SORTIE +** to initialize a new defect inspection mission.
5. Open **M04 // Search & Rescue**:
   * Observe high-contrast coral alert: `RESTRICTED SURVIVOR DATA QUARANTINE`.
   * Verify zero confidential GPS coordinates are exposed to external streams.
6. Open **Mission Outcomes**:
   * Review pending outcomes in queue.
   * Click **Review Outcome** to approve verified findings.
   * Note that attempting to publish confidential SAR drill `OUT-DEMO-003` is strictly disabled by backend security policy.

### Step 5: Citizen Mobile App Demonstration (`userapp/`)
1. Launch mobile app on Android Emulator or physical device:
   ```bash
   cd userapp
   flutter run -d chrome  # Or flutter run -d android
   ```
2. Log in with `citizen.demo@aeron.gov` / `AeronDemo@2026!Secure`.
3. **Home Tab:**
   * View authentic civic points badge (derived from persisted MongoDB count).
   * Observe active report timeline showing 6-stage lifecycle progression.
4. **Report Tab (Center Floating Pill):**
   * Select category: `ROAD_STRUCTURAL`.
   * Enter description: `Pavement subsidence near junction`.
   * Acquire observation GPS coordinates.
   * Submit report -> Receive genuine server-assigned `AER-2026-XXXX` ID.
5. **My Reports Tab:**
   * View submitted report in Stage 1 (`SUBMITTED`).
6. **Explore Tab:**
   * View published municipal outcomes (`OUT-DEMO-001`).
   * Note complete absence of private or confidential SAR mission records.

