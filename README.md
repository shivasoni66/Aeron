# AERON — Multi-Mission Autonomous Drone Platform

AERON is a production-oriented, multi-mission autonomous drone platform providing unified airspace intelligence, hardware telemetry ground-control, mission operations command, and citizen-facing civic service intake.

---

## 1. Approved Three-Panel Architecture

AERON integrates three dedicated client interfaces powered by a single, shared backend:

1. **Admin Web — Drone Intelligence (`GCS-SYS`)**
   - Direct physical quadcopter telemetry monitoring, hardware bus verification, GPS 3D lock diagnostics, 4S LiPo battery health, airframe vector schematics, and raw MAVLink event logging.
2. **Manager Web — Mission Intelligence (`GCS v4.2 PRO`)**
   - Operational flight deck managing four mission verticals (Civic Issue Verification, Crowd Safety, Micro-Climate Monitoring, Subterranean Search & Rescue), 8-stage operational pipelines, operator XP progression, and municipal outcome publishing.
3. **Citizen Mobile App — Citizen Services**
   - Native mobile experience for public hazard reporting, GPS geotagging, photographic evidence uploads, 6-stage municipal inspection tracking, and verified civic findings.

---

## 2. Technology Stack

- **Backend:** Node.js v24, TypeScript, Express.js, MongoDB Atlas (Mongoose), Socket.IO.
- **Admin Web:** React 18, Vite, TypeScript, Tailwind CSS (`#131313` / `#BFF42E`).
- **Manager Web:** React 18, Vite, TypeScript, Tailwind CSS.
- **Citizen Mobile App:** Flutter SDK 3.47+, Dart 3.13+.
- **Drone Integration:** Python 3.14+, MAVLink 2.0 (`pymavlink`), Pixhawk 2.4.8 Autopilot.
- **AI Processing:** PyTorch, Torchvision, OpenCV, Ultralytics YOLO.
- **Design System Reference:** Locally preserved under `stitch_quadcopter_control_interface/`.

---

## 3. Directory Structure

```
AERON/
├── Backend/                            # Node.js + Express + TypeScript API Server
│   ├── src/
│   │   ├── config/                     # Environment and MongoDB configuration
│   │   ├── middleware/                 # CORS, Helmet, Logging, Error handling
│   │   ├── models/                     # 13 Mongoose schemas, GeoJSON types & indexes
│   │   ├── routes/                     # Health and API route endpoints
│   │   ├── controllers/                # Request handlers
│   │   ├── sockets/                    # Socket.IO real-time engine
│   │   ├── utils/                      # Structured logger
│   │   ├── app.ts                      # Express application assembly
│   │   └── server.ts                   # HTTP & Socket.IO server entry point
│   ├── tests/                          # Automated Vitest integration & model tests
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── admin/                              # React + Vite + TS Admin Web (Drone Intelligence)
│   ├── src/
│   │   ├── components/                 # Sidebar, Header, Footer, HUD widgets
│   │   ├── layouts/                    # Main GCS dashboard layout
│   │   ├── pages/                      # DroneOverviewPage matching Stitch design
│   │   └── styles/                     # Tailwind CSS design tokens
│   ├── package.json
│   └── vite.config.ts
│
├── manager/                            # React + Vite + TS Manager Web (Mission Intelligence)
│   ├── src/
│   │   ├── components/                 # Sidebar, Header, MissionCard (4 modules)
│   │   ├── layouts/                    # Mission command layout
│   │   ├── pages/                      # MissionDashboardPage matching Stitch design
│   │   └── styles/                     # Tailwind CSS design tokens
│   ├── package.json
│   └── vite.config.ts
│
├── userapp/                            # Genuine Flutter Mobile App (Citizen Services)
│   ├── lib/
│   │   ├── core/                       # App constants and configuration
│   │   ├── models/                     # CitizenReport and outcome models
│   │   ├── services/                   # Backend HTTP API client
│   │   ├── screens/                    # HomeScreen & MainShellScreen
│   │   ├── widgets/                    # Floating bottom pill dock
│   │   ├── theme/                      # AppColors and AppTheme matching DESIGN.md
│   │   └── main.dart                   # Application entry point
│   ├── test/                           # Flutter widget tests
│   └── pubspec.yaml
│
├── drone-bridge/                       # Local Python Telemetry Bridge & Simulator
│   ├── src/
│   │   ├── config.py                   # Simulator and bridge configuration
│   │   ├── models.py                   # Normalized telemetry data structures
│   │   ├── simulator.py                # 10Hz high-fidelity telemetry simulator
│   │   └── main.py                     # CLI launcher with graceful shutdown
│   ├── tests/                          # Automated Python test suite
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── documentation/                      # Architectural specifications
│   ├── architecture.md                 # System architecture overview
│   ├── database-architecture.md        # Database schemas, ER diagram & indexing
│   └── authentication-and-security.md  # RBAC, JWT, token rotation & Socket security
│
├── stitch_quadcopter_control_interface/# Approved Google Stitch UI Designs
│   ├── aeron_admin_hardware_telemetry_bench_readiness_refined/
│   ├── aeron_citizen_civic_reporting_verified_outcomes_refined/
│   ├── aeron_manager_mission_operations_outcome_command_refined/
│   └── aerospace_telemetry_high_voltage/
│
├── .gitignore                          # Production Git ignore rules
└── README.md                           # Master platform documentation
```

---

## 4. Database Architecture & Data Layer

AERON utilizes MongoDB with Mongoose ODM for operational flight and mission persistence. Full architectural details and ER diagrams are maintained in [`documentation/database-architecture.md`](file:///c:/Shiva/MORE/Projects/Aeron/documentation/database-architecture.md).

### 13 Core Collections
- `users`: Central RBAC user store (`admin`, `manager`, `citizen`) with hidden password hashes.
- `drones`: Airframe configurations, operational statuses (`READY`, `IN_FLIGHT`, etc.).
- `hardwaredevices`: Physical component bus registry (Pixhawk 2.4.8, Ublox GPS, cameras).
- `flightsessions`: Sortie tracking distinguishing `REAL` and `SIMULATION` flight sources.
- `telemetryrecords`: High-speed time-series MAVLink records with compound `[droneId, recordedAt]` and GeoJSON `2dsphere` indexes.
- `missions`: 8-stage operational missions constrained to 4 canonical categories:
  1. `CIVIC_ISSUE_VERIFICATION`
  2. `CROWD_SAFETY`
  3. `MICRO_CLIMATE`
  4. `SUBTERRANEAN_SEARCH_RESCUE`
- `missionevents`: Granular mission lifecycle audit events avoiding unbounded arrays.
- `incidents`: Operational and civic hazards with `isConfidential` flags protecting subterranean SAR data.
- `citizenreports`: 6-stage civic report intake with gamified citizen points.
- `mediaassets`: Decoupled media metadata records (raw binaries are stored on storage providers, not MongoDB).
- `missionoutcomes`: Verified findings and public municipal deliverables.
- `notifications`: User alert dispatch for flight events and civic updates.
- `auditlogs`: Immutable security and command execution audit logs.

---

## 5. Centralized Authentication & RBAC

AERON enforces centralized authentication and backend authorization across all three applications. Full specifications are documented in [`documentation/authentication-and-security.md`](file:///c:/Shiva/MORE/Projects/Aeron/documentation/authentication-and-security.md).

- **Roles:** `admin` (Admin Web), `manager` (Manager Web), `citizen` (Mobile App).
- **Public Registration:** Allowed exclusively for `citizen` accounts (`POST /api/v1/auth/register`). Privilege escalation attempts are strictly neutralized on the server.
- **Admin/Manager Provisioning:** Protected admin-only endpoint (`POST /api/v1/admin/users`).
- **One-Time Administrator Bootstrap (CLI):**
  ```powershell
  cd Backend
  $env:BOOTSTRAP_ADMIN_EMAIL="admin@aeron.gov"
  $env:BOOTSTRAP_ADMIN_PASSWORD="YourStrongPassword123!"
  npm run bootstrap:admin
  ```
- **JWT & Token Rotation:** Short-lived HS256 access tokens (15 minutes) + single-use opaque refresh tokens with automatic reuse detection and family revocation.
- **Socket.IO Security:** Handshake JWT authentication; citizens are strictly barred from joining raw telemetry or hardware command rooms.

---

## 6. Development & Startup Commands

### Prerequisites
- Node.js `v20+` (tested on `v24.11.0`)
- Python `3.10+` (tested on `3.14.2`)
- Flutter SDK `3.24+` (tested on `3.47.5`)

### A. Backend Server
```powershell
cd Backend
npm install
npm run build
npm test
npm run dev
# Health endpoint: http://localhost:5000/health
# Readiness endpoint: http://localhost:5000/health/ready
```

### B. Admin Web GCS
```powershell
cd admin
npm install
npm run build
npm run dev
# Runs on: http://localhost:5173
```

### C. Manager Web Flight Deck
```powershell
cd manager
npm install
npm run build
npm run dev
# Runs on: http://localhost:5174
```

### D. Citizen Mobile App (Flutter)
```powershell
cd userapp
flutter analyze
flutter test
flutter run -d chrome # Or target Android / Windows device
```

### E. Drone Telemetry Simulator (Python)
```powershell
cd drone-bridge
python -m unittest tests/test_simulator.py
python -m src.main
```

---

## 7. Security & Environment Configuration

Copy each service's `.env.example` to `.env` before running in production:
- `Backend/.env.example` -> `Backend/.env`
- `drone-bridge/.env.example` -> `drone-bridge/.env`

> [!CAUTION]
> Never commit actual `.env` files, JWT secrets, or MongoDB credentials to Git.

