# AERON — TASK 06 IMPLEMENTATION REPORT: ESP32-CAM INTEGRATION, SECURE CAMERA BRIDGE & ADMIN LIVE PREVIEW

**Platform:** AERON — Multi-Mission Autonomous Drone Platform  
**Task:** Task 06 — ESP32-CAM Integration, Secure Camera Bridge & Admin Live Preview  
**Engineer Roles:** Senior Embedded Systems Engineer, ESP32 Developer, Python Streaming Engineer, Full-Stack IoT Architect  
**Date:** 2026-11-08  
**Physical Hardware Status:** **`BLOCKED (UNPLUGGED)`**  
**Software Subsystems Status:** **`COMPLETE, INTEGRATED & VERIFIED`**  

---

## 1. Executive Summary & Hardware Precondition Audit

In accordance with strict AERON engineering integrity standards, a thorough physical discovery audit of the Windows development workstation was conducted prior to implementing the video subsystem.

### Hardware Discovery Audit Findings:
- **Serial / USB Bridges:** A query of all present serial devices (`Get-PnpDevice -Class 'Ports' -PresentOnly`) returned **zero connected COM ports**. Neither an FTDI, CP2102, nor CH340 USB-to-UART module was connected.
- **Local Network Subnet:** An ARP and network interface inspection revealed the local host is assigned IP `192.168.43.52` on gateway `192.168.43.1`. The default ESP32-CAM ad-hoc Access Point (`192.168.4.1`) was not present in the ARP cache and not reachable via TCP port 80/8554.
- **Physical Integration Verdict:** **`BLOCKED (UNPLUGGED)`**. No physical ESP32-CAM hardware is currently connected.

> [!IMPORTANT]
> **No False Claims:** We strictly refuse to report physical video streaming as "connected" when the hardware is absent. The entire end-to-end video acquisition architecture, zero-database-bloat memory relay, security authorization guards, telemetry synchronization, and Admin Web preview have been fully engineered and validated using mock and synthetic bench generators.

---

## 2. End-to-End Architectural Topology

Because the AERON backend is hosted in a cloud environment (Render), it has no route to reach private IP addresses (`192.168.4.1` or internal Wi-Fi). The local operator laptop acts as the **Edge Gateway**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHYSICAL AIRFRAME / BENCH                       │
│                                                                        │
│   ┌────────────────────┐                   ┌────────────────────────┐  │
│   │    Pixhawk 2.4.8   │                   │       ESP32-CAM        │  │
│   │  Flight Controller │                   │    (OV2640 Sensor)     │  │
│   └─────────┬──────────┘                   └───────────┬────────────┘  │
└─────────────┼──────────────────────────────────────────┼───────────────┘
              │ MAVLink 2.0 (USB Serial)                 │ HTTP / MJPEG (Wi-Fi 802.11)
              ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    OPERATOR LAPTOP (GROUND STATION)                    │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               drone-bridge (Python 3.14 Daemon)                │   │
│   │                                                                │   │
│   │  ┌──────────────────────┐         ┌─────────────────────────┐  │   │
│   │  │ TelemetryAggregator  │◄────────┤ ESP32CameraReader       │  │   │
│   │  │ (Pixhawk GPS, Alt)   │  Sync   │ (JPEG Validator, Rates) │  │   │
│   │  └──────────┬───────────┘         └───────────┬─────────────┘  │   │
│   │             │                                 │                │   │
│   │             ▼                                 ▼                │   │
│   │  ┌──────────────────────┐         ┌─────────────────────────┐  │   │
│   │  │ BackendClient        │         │ CameraTransportClient   │  │   │
│   │  └──────────┬───────────┘         └───────────┬─────────────┘  │   │
│   └─────────────┼─────────────────────────────────┼────────────────┘   │
└─────────────────┼─────────────────────────────────┼────────────────────┘
                  │                                 │
                  │ HTTPS POST                      │ HTTPS POST
                  │ /api/v1/telemetry/ingest        │ /api/v1/camera/frames
                  │ (x-drone-bridge-token)          │ (x-drone-bridge-token)
                  ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│               AERON BACKEND (Node.js + Express + Render)               │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ In-Memory Bounded Frame Relay (latestFrames Map)               │   │
│   │  • Zero-Database-Bloat: Video frames NEVER persisted in Mongo  │   │
│   │  • HardwareDevice collection: metadata & operational status    │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼ Socket.IO Broadcast                │
│                      (Room: drone:camera:AERON-HEX-01)                 │
│                      [Strict RBAC: Admin Role ONLY]                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ WebSocket / TLS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   ADMIN WEB (Drone Intelligence GCS)                   │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ LiveCameraPage (Tactical HUD & Optical Stream Preview)         │   │
│   │  • Real-time base64 frame display                              │   │
│   │  • Synchronized aircraft GPS altitude/position display         │   │
│   │  • Honest Standby UI when hardware camera is unplugged         │   │
│   │  • One-click snapshot capture & diagnostic telemetry           │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Video & Status Subsystem

Implemented in `Backend/src/`:

### 3.1 Validation Schemas (`src/validators/camera.validator.ts`)
- `CameraFrameSchema`:
  - `droneId`: String identifier.
  - `deviceId`: Defaults to `ESP32-CAM-01`.
  - `capturedAt`: ISO 8601 string.
  - `frameBase64`: Validates base64 encoding and strictly verifies the JPEG Start of Image (SOI) signature `\xff\xd8` (`/9j/`).
  - `mimeType`: Exactly `image/jpeg`.
  - `sizeBytes`: Enforces maximum frame size limit of 1,048,576 bytes (1 MB).
  - Telemetry fields: `telemetryLat` ([-90, 90]), `telemetryLon` ([-180, 180]), `telemetryAlt`, `telemetryHeading` ([0, 360]), `telemetryAgeSeconds` (>= 0).
- `CameraStatusSchema`:
  - Validates operational health payloads (`installed`, `reachable`, `streaming`, `fps`, `resolution`, `rssi`, `ipAddress`, `errorMessage`).

### 3.2 Ingest & Relay Controller (`src/controllers/camera.controller.ts`)
- **Zero-Database-Bloat Bounded Memory Cache:** A server-side `Map<string, CameraFramePayload>` (`latestFrames`) holds only the most recent frame per drone. Video streaming frames are **never written to MongoDB**, protecting database I/O and storage quotas.
- **Hardware Metadata Persistence:** Persists and updates device metadata (IP address, MAC, connection status, last seen timestamp) in the `HardwareDevice` collection.
- **Socket.IO Real-time Distribution:** Emits `drone:camera:frame` and `camera:frame` to the dedicated room `drone:camera:${droneId}`. Emits status updates to `drone:camera:status`.
- **Admin REST Preview Endpoints:**
  - `GET /api/v1/admin/drones/:droneId/camera/status`: Returns current operational and hardware status.
  - `GET /api/v1/admin/drones/:droneId/camera/preview/latest`: Returns the cached preview frame for instant rendering.

### 3.3 Strict Security & RBAC Protection (`src/routes/` & `src/sockets/socket.server.ts`)
- Machine routes (`POST /api/v1/camera/frames`, `POST /api/v1/camera/status`) require the pre-shared `x-drone-bridge-token`.
- Read routes (`GET /api/v1/admin/drones/:droneId/camera/*`) are strictly restricted to authenticated users with the `admin` role.
- Socket.IO room guard rejects and logs audit warnings for Citizens and Managers attempting to join `drone:camera:*` rooms.

---

## 4. Python Ground Station Camera Subsystem

Implemented in `drone-bridge/src/camera/`:

### 4.1 Modules Created
- `config.py`: `CameraConfig` reading environment settings (`CAMERA_ENABLED`, `CAMERA_PROTOCOL`, `CAMERA_HOST`, `CAMERA_PORT`, `CAMERA_TARGET_FPS`, `CAMERA_MAX_FRAME_BYTES`).
- `models.py`: Data models `CameraFrame` and `CameraStatus` with `to_backend_dict()` formatting.
- `health.py`: `CameraHealthTracker` tracking reachability, consecutive error counts, sliding-window FPS over the last 20 frames, and stale timeout detection (marking streaming false if no frame arrives within 5 seconds).
- `frame_reader.py`: `ESP32CameraReader` supporting:
  - `HTTP_JPEG`: Snapshot polling with connection pooling and timeouts.
  - `MOCK`: Synthetic 640x480 test JPEG generator with crosshairs, timestamps, and flight telemetry overlays.
  - `validate_jpeg()`: Verifies SOI `0xFFD8` and EOI `0xFFD9`.
  - Rate limiting: Throttles acquisition to target FPS (e.g. 2.0 to 5.0 Hz).
- `transport.py`: `CameraTransportClient` with bounded queue (`frame_queue_max = 5`), automatic stale frame dropping to prevent preview lag, and retry handling.

### 4.2 Telemetry Synchronization & Ground Target Disclaimer
In `drone-bridge/src/main.py`, the camera loop queries `TelemetryAggregator.snapshot()` and attaches nearest GPS coordinates to each frame:
- `telemetryLat`, `telemetryLon`, `telemetryAlt`, `telemetryHeading`, `telemetryAgeSeconds`.

> [!CAUTION]
> **Aircraft Position vs. Ground Target Coordinates:**  
> The telemetry attached to camera frames represents the **quadcopter's GNSS antenna position at shutter time**, NOT the ground target's coordinates. Converting image coordinates into ground geospatial locations requires ray-tracing against a Digital Elevation Model (DEM) and gimbal orientation vectors. This distinction is explicitly surfaced on the Admin UI.

---

## 5. Admin Web Integration

Implemented in `admin/`:
- **API Services (`admin/src/services/api.ts`):** Added `fetchCameraStatus` and `fetchLatestCameraPreview`.
- **Socket Services (`admin/src/services/socket.ts`):** Added `subscribeToCameraFeed` for room `drone:camera:${droneId}`.
- **Tactical Live Camera Page (`admin/src/pages/LiveCameraPage.tsx`):**
  - **Live Optical Stream:** Renders incoming base64 JPEG frames with low latency.
  - **Tactical HUD:** Real-time tactical crosshairs, corner brackets, and synchronized flight telemetry overlay (`ALT`, `SPD`, `HDG`, `POS`, `BATT`).
  - **Honest Standby UI:** When the camera is unplugged or offline, clearly displays `STANDBY // UNPLUGGED` with diagnostics and bench testing guidance.
  - **Measured FPS:** Calculates sliding-window client FPS.
  - **Snapshot Download:** Allows one-click JPEG snapshot downloads.
  - **Auditing Note:** Prominently displays the geospatial notice explaining aircraft GPS vs. ground target coordinates.

---

## 6. Monorepo Verification & Regression Test Results

| Subsystem | Test Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Backend** | `npm test` | **116 / 116 PASS** | All 8 camera tests pass (auth, JPEG validation, relay, RBAC room guards). |
| **Backend Build** | `npm run build` | **0 ERRORS** | TypeScript compilation clean. |
| **drone-bridge** | `python -m unittest discover tests` | **23 / 23 PASS** | 6 camera unit tests pass (JPEG integrity, mock generator, throttling, health, queue drops). |
| **Admin Web** | `npm run build` | **0 ERRORS** | Production Vite build clean. |
| **Manager Web** | `npm run build` | **0 ERRORS** | Production Vite build clean. |
| **Citizen User App** | `flutter test` & `flutter analyze` | **PASS (0 issues)** | Widget tests pass, 0 analyzer issues. |

---

## 7. Deliverables & Documentation

1. `Backend/src/validators/camera.validator.ts`
2. `Backend/src/controllers/camera.controller.ts`
3. `Backend/src/routes/camera.routes.ts`
4. `Backend/src/routes/admin.routes.ts`
5. `Backend/src/sockets/socket.server.ts`
6. `Backend/tests/camera/camera.test.ts`
7. `drone-bridge/src/camera/config.py`
8. `drone-bridge/src/camera/models.py`
9. `drone-bridge/src/camera/health.py`
10. `drone-bridge/src/camera/frame_reader.py`
11. `drone-bridge/src/camera/transport.py`
12. `drone-bridge/src/camera/__init__.py`
13. `drone-bridge/src/main.py`
14. `drone-bridge/tests/test_camera.py`
15. `drone-bridge/README.md`
16. `admin/src/types/index.ts`
17. `admin/src/services/api.ts`
18. `admin/src/services/socket.ts`
19. `admin/src/pages/LiveCameraPage.tsx`
20. `documentation/esp32-camera-integration.md`
21. `AERON_TASK_06_IMPLEMENTATION_REPORT.md` (root and artifact directory)

