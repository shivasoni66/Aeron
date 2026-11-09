# AERON — System Health, Observability & Troubleshooting Guide

**Document Version:** 1.0.0  
**Classification:** Site Reliability & Hardware Diagnostics Guide  
**Platform Identity:** AERON — Multi-Mission Autonomous Drone Platform  

---

## 1. Unified Subsystem Observability Matrix

The AERON platform monitors each subsystem independently. Hardware connectivity is **never** inferred from backend health alone.

| Subsystem | Metric / Indicator | Endpoint / Source | Healthy Threshold | Stale / Degraded Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | Process uptime, HTTP status | `GET /health` | Uptime > 0, HTTP 200 | HTTP 500 / Crash |
| **MongoDB Database** | Connection readyState | `GET /health/ready` | `readyState: 1` (`connected`) | `readyState: 0/2/3` (503 Degraded) |
| **Socket.IO Engine** | Engine active, ping/pong | `GET /health/ready` | `status: 'active'` | Unresponsive ping (> 5s) |
| **Drone Bridge** | Packet arrival timestamp | `GET /api/v1/admin/system/health` | Packet received < 45s | Age > 45s (`STANDBY`) |
| **Pixhawk 2.4.8 FC**| MAVLink heartbeat packet | Serial COM / Telemetry record | MAVLink heartbeat verified | Missing heartbeat (`NOT_CONNECTED_USB`)|
| **GNSS / GPS Lock** | `gpsFixType`, satellites | Telemetry record | `gpsFixType: '3D_FIX'`, sats >= 6 | `NO_FIX` or sats < 6 |
| **Camera Relay** | JPEG frame freshness | `GET /api/v1/admin/drones/:id/camera/preview/latest` | Frame received < 5s | Age > 5s (`STALE`) / No frames |
| **Media Storage** | Cloud provider availability | `GET /health/integrated` | Provider active (`LOCAL` / `S3`) | Cloud unconfigured in prod (503) |

---

## 2. Health & Diagnostic Endpoints

### 2.1 Public Health Endpoints (Non-Sensitive)
* **Liveness:** `GET /health`
  ```json
  {
    "status": "healthy",
    "service": "aeron-backend",
    "version": "1.0.0",
    "uptimeSeconds": 3600,
    "environment": "development"
  }
  ```
* **Dependency Readiness:** `GET /health/ready`
  * Returns HTTP `200` when MongoDB Atlas is connected and Socket.IO engine is active.
  * Returns HTTP `503 Service Unavailable` with `status: 'degraded'` if MongoDB is unreachable.
* **Integrated Subsystem Status:** `GET /health/integrated`
  * Provides consolidated readiness metrics across API, database, socket server, telemetry pipeline, camera relay, and media storage.

### 2.2 Operator Technical Health (`GET /api/v1/admin/system/health`)
* Requires `Authorization: Bearer <ADMIN_TOKEN>`.
* Returns detailed diagnostic payload including:
  * Telemetry packet age in milliseconds.
  * Serial connection state and baud rate (57600).
  * Flight controller model (`Pixhawk 2.4.8 STM32F427`).
  * GNSS satellite count and 3D lock state.
  * Live camera stream latency, frame resolution, and source type (`REAL` vs `SIMULATION`).

---

## 3. Physical Hardware Bench Procedure (Pixhawk 2.4.8)

> [!CAUTION]
> **MANDATORY SAFETY PROTOCOL BEFORE CONNECTING HARDWARE:**
> 1. **REMOVE ALL PROPELLERS** from the quadcopter before connecting any USB or telemetry cable.
> 2. **DO NOT ARM MOTORS** or run motor spin tests on the bench.
> 3. Zero flight-control commands (ARM, DISARM, TAKEOFF, LAND, RTL, RC override) are transmitted by the software.

### 3.1 Step-by-Step Bench Hardware Verification
1. **Physical Inspection:**
   * Verify Pixhawk 2.4.8 is mounted securely with vibration damping.
   * Verify GPS module is connected to `GPS` port and power module connected to `POWER` port.
2. **USB Serial Connection:**
   * Connect Micro-USB cable from Pixhawk to development host.
   * Open Windows Device Manager (`devmgmt.msc`) -> **Ports (COM & LPT)**.
   * Identify allocated COM port (e.g., `COM9` or `COM3`).
3. **Configure Drone Bridge:**
   * In `drone-bridge/.env`:
     ```ini
     MAVLINK_CONNECTION=COM9
     MAVLINK_BAUD=57600
     MAVLINK_SOURCE=REAL
     SIMULATOR_ENABLED=false
     ```
4. **Launch Bridge:**
   ```bash
   cd drone-bridge
   python src/main.py
   ```
5. **Observe Diagnostics:**
   * Check console for `[MAVLINK-PARSER] Heartbeat received from SysId 1, CompId 1`.
   * Check Admin Web Overview (`http://localhost:5173`) -> Serial Connection: `CONNECTED`.

---

## 4. ESP32-CAM Discovery & Verification Procedure

1. **Power Up Module:**
   * Connect ESP32-CAM to 5V power supply via FTDI programmer or onboard regulator.
   * Verify camera sensor (OV2640) is firmly seated in FPC connector.
2. **Network Discovery:**
   * By default, the ESP32-CAM connects to local Wi-Fi or broadcasts AP `ESP32-CAM-AERON`.
   * Test network reachability:
     ```powershell
     Test-Connection -ComputerName 192.168.4.1 -Count 2
     ```
3. **Verify HTTP Frame Snapshot:**
   * Open browser to `http://192.168.4.1/capture`.
   * Verify JPEG frame downloads cleanly (magic bytes `0xFF 0xD8`).
4. **Launch Camera Bridge:**
   ```bash
   cd drone-bridge
   python -c "from src.camera.transport import CameraTransport; print('Camera transport module verified')"
   ```

---

## 5. Current Hardware Availability Status

Audit executed during Task 09 verification:
* **Pixhawk 2.4.8 Serial COM:** **NOT DETECTED** (Host reports no active serial COM devices).
* **ESP32-CAM Network AP:** **UNREACHABLE** (`192.168.4.1` ping returned `False`).
* **Hardware Status Classification:** **BLOCKED (Hardware Disconnected / Unavailable)**.
* **Software Integration Status:** **COMPLETED AND VERIFIED** via robust SITL simulator and mock JPEG camera stream.

---

## 6. Operator Troubleshooting Runbook

### Issue A: MongoDB Connection Deferred / Degraded (503)
* **Symptom:** `GET /health/ready` returns 503; logs show `Could not connect to any servers in your MongoDB Atlas cluster`.
* **Remedy:**
  1. Verify outbound Internet connectivity.
  2. Verify your current public IP address is added to the MongoDB Atlas Network Access IP Whitelist (`0.0.0.0/0` for development or specific static egress IP).
  3. Verify `MONGODB_URI` contains correct credentials and cluster address.

### Issue B: Telemetry Packet Ingestion Rejected (401 / 403)
* **Symptom:** `POST /api/v1/telemetry/ingest` returns 401 or 403.
* **Remedy:**
  1. If `401 DRONE_BRIDGE_TOKEN_REQUIRED`: Verify `X-Drone-Bridge-Token` header matches `DRONE_BRIDGE_TOKEN` in `.env`.
  2. If `403 UNAUTHORIZED_DRONE_ID`: The ingested drone ID is not recognized. Airframe must either be pre-registered by an Administrator or added to the pre-authorized allowlist (`AERON-PX4-BENCH01`, `DRONE-SIM-01`, etc.).

### Issue C: CORS Origin Denied in Browser
* **Symptom:** Browser console displays `Origin http://localhost:5173 not allowed by AERON CORS policy`.
* **Remedy:**
  1. Check `CORS_ORIGIN` in `Backend/.env`.
  2. In development, localhost ports are permitted automatically; for production, pass exact origin without trailing slash (e.g. `https://aeron-admin.sharprad-x.tech,https://aeron-manager.sharprad-x.tech`).

### Issue D: Camera Frame Stream Stale
* **Symptom:** Admin Live Camera page displays `STALE // NO LIVE FRAMES`.
* **Remedy:**
  1. Check ESP32-CAM power and Wi-Fi signal.
  2. Verify `python src/main.py` camera thread is running without queue-overflow warnings.
  3. If using mock preview in development, set `CAMERA_PROTOCOL=MOCK` in `drone-bridge/.env`.

