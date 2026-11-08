# AERON — Multi-Mission Autonomous Drone Platform
## System Architecture & Technical Specifications

**Version:** 1.0.0 (Production Blueprint)  
**Status:** Scaffolding & Core Infrastructure Established (Task 01)  

---

## 1. High-Level Architectural Topology

AERON operates on a centralized, multi-panel architecture sharing a single Node.js/Express backend with real-time Socket.IO synchronization and MongoDB Atlas persistence.

```
                           +--------------------------------------+
                           |          PHYSICAL QUADCOPTER         |
                           |   (Pixhawk 2.4.8 + U-Blox M8N GPS)   |
                           +--------------------------------------+
                                              |
                                              | MAVLink 2.0 (USB / Telemetry Radio)
                                              v
                           +--------------------------------------+
                           |     LOCAL DRONE TELEMETRY BRIDGE     |
                           |       (Python ground station)        |
                           +--------------------------------------+
                                              |
                                              | Authenticated HTTPS / WebSocket
                                              v
      +--------------------------------------------------------------------------------+
      |                                AERON BACKEND                                   |
      |                 (Node.js + Express + TypeScript + Socket.IO)                   |
      |                                                                                |
      |   - Central API Routing (/api/v1)              - Telemetry Normalization       |
      |   - Socket.IO Event Engine                     - Role-Based Access Control     |
      |   - Health & Dependency Monitors               - MongoDB Atlas Client          |
      +--------------------------------------------------------------------------------+
             |                                 |                                |
             | Real-time Telemetry             | Mission Operations             | Public Findings
             | (admin:drone)                   | (manager:drone / missions)     | & Civic Intake
             v                                 v                                v
+--------------------------+     +--------------------------+     +--------------------------+
|        ADMIN WEB         |     |       MANAGER WEB        |     |    CITIZEN MOBILE APP    |
|   (Drone Intelligence)   |     |  (Mission Intelligence)  |     |    (Citizen Services)    |
|                          |     |                          |     |                          |
|  - Pixhawk Hardware Bench|     |  - 4 Mission Matrix      |     |  - Citizen Contribution  |
|  - 8-Metric HUD Badges   |     |  - 8-Stage Pipeline      |     |  - Civic Issue Intake    |
|  - Airframe Vector Stage |     |  - Operator XP & Medals  |     |  - 6-Stage Report Track  |
|  - Sensor Status Cards   |     |  - Staged Outcome Review |     |  - Floating Bottom Dock  |
|  - Historical Charts     |     |  - Publishing Workflow   |     |  - Public Findings Stream|
|  - Live MAVLink Stream   |     |  - Tactical Map Grid     |     |                          |
|  [React + Vite + TS]     |     |  [React + Vite + TS]     |     |  [Flutter + Dart]        |
+--------------------------+     +--------------------------+     +--------------------------+
```

---

## 2. Core Application Roles & Responsibilities

### Screen 01 — Admin Web: Drone Intelligence
* **Purpose:** Physical quadcopter health monitoring, hardware connectivity, flight telemetry, GPS tracking, and system health.
* **Key Capabilities:**
  - Real-time 8-metric HUD (Lat/Lon, Altitude AGL, Speed, 4S Battery, GPS 3D fix, Flight mode, Arm state, Motor PWM).
  - Aircraft Readiness Gate (Stage 2 qualification gauge, pre-flight avionics audit).
  - Airframe schematic visualization (Quad-X motor ESC status).
  - MAVLink event log stream with circular memory buffer.

### Screen 02 — Manager Web: Mission Intelligence
* **Purpose:** Mission operations management, sorties ledger, incident triage, and verified outcome staging.
* **Key Capabilities:**
  - 4 Operational Modules:
    1. **M01 // Civic Issue Verification:** Tarmac fissure inspection, dumping detection, pothole rating (+150 XP).
    2. **M02 // Crowd Safety & Aerial Mesh:** Multi-drone peer mesh, choke-point density telemetry (+180 XP).
    3. **M03 // Micro-Climate & Heat Island:** Thermal contour mapping, VOC gas tracking (+140 XP).
    4. **M04 // Subterranean Search & Rescue:** Culvert navigation, mock survivor beacons, LiDAR point clouds (+200 XP).
  - 8-Stage Mission Lifecycle State Machine.
  - Tactical Achievements & Team Ethical Reliability Bento (zero reward for aggressive velocity).
  - Staged outcome publishing pipeline with celebratory operator feedback.

### Screen 03 — Citizen Mobile App: Citizen Services
* **Purpose:** Civic hazard reporting, photographic evidence capture, and exploration of verified public outcomes.
* **Key Capabilities:**
  - Citizen Contribution Score & Levels (Level 4 Civic Advocate, +25 to +50 points per action).
  - 6-Stage Active Report Progression Journey (`#AER-2026-1092`).
  - Mobile touch category dispatch grid (Road, Crowd, Climate, Search & Rescue).
  - Floating frosted pill bottom navigation dock.
  - Verified municipal outcomes registry feed with survey overlays.

---

## 3. Technology Stack Specifications

| Layer | Technology | Version | Role in AERON |
| :--- | :--- | :--- | :--- |
| **Backend API** | Node.js / Express | 24.11 / 4.21 | Central HTTP REST & Socket.IO server |
| **Language** | TypeScript | 5.7.3 | Type safety across backend and web clients |
| **Database** | MongoDB Atlas / Mongoose | 8.10 | Telemetry persistence, sorties, reports, outcomes |
| **Real-time** | Socket.IO | 4.8.1 | 10Hz telemetry streaming & mission alerts |
| **Admin Web** | React + Vite | 18.3 / 6.1 | Ground Control Station UI (Drone Intelligence) |
| **Manager Web** | React + Vite | 18.3 / 6.1 | Tactical Flight Deck UI (Mission Intelligence) |
| **Citizen App** | Flutter / Dart | 3.47 / 3.13 | Native cross-platform mobile application |
| **Telemetry Bridge** | Python / pymavlink | 3.14.2 | Ground station MAVLink parser & simulator |
| **Computer Vision** | PyTorch / YOLO | 2.14 / 8.4 | Edge defect detection & crowd density |
| **Design System** | Tailwind CSS / Custom | 3.4.17 | Aerospace Telemetry High-Voltage theme |

---

## 4. Visual Identity & Design Tokens

Established in `stitch_quadcopter_control_interface/aerospace_telemetry_high_voltage/DESIGN.md`:
* **Background:** `#131313`
* **Surface Container:** `#202020`
* **Surface Low:** `#1B1C1C` | **Surface High:** `#2A2A2A` | **Surface Highest:** `#353535`
* **Primary Accent:** `#BFF42E` (Electric Lime / `#C9FF3A`)
* **Typography:** `Anton` (Display Hero), `Manrope` (Body/Pills), `Space Mono` (Telemetry/Avionics)

