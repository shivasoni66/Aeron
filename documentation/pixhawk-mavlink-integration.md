# AERON — Pixhawk 2.4.8 MAVLink Integration & Ground Station Telemetry Bridge
**System Component:** Ground Station Local Telemetry Bridge (`drone-bridge`)  
**Target Autopilot:** Pixhawk 2.4.8 (STM32F427 Cortex-M4 + STM32F100 Failover Coprocessor)  
**Protocol:** MAVLink 2.0 (Read-Only)  
**Safety Classification:** Strictly Ground Read-Only Telemetry (No Remote Flight Control)

---

## 1. Architectural Overview

```
+-------------------------------------------------------+
|              AERON PHYSICAL QUADCOPTER                |
|  - Pixhawk 2.4.8 (ArduPilot Copter / PX4 Autopilot)   |
|  - U-Blox NEO-M8N GPS + HMC5883L Compass (I2C)       |
|  - 4S LiPo Power Module (Analog Hall Sensor)          |
+-------------------------------------------------------+
                           |
                           | USB Virtual COM Port / 3DR Telemetry Radio (TELEM1)
                           | Baud: 57600 (or 115200) | MAVLink 2.0
                           v
+-------------------------------------------------------+
|             LOCAL GROUND STATION LAPTOP               |
|                                                       |
|   Windows COM Port (e.g. COM9, COM8)                  |
|                           |                           |
|   AERON Python Drone Bridge (drone-bridge/)          |
|   ├── MAVLinkConnection   (pySerial + pymavlink)      |
|   ├── MAVLinkParser       (Read-only decoder)         |
|   ├── SubsystemHealth     (Decoupled state monitors)  |
|   ├── TelemetryAggregator (Normalized state builder)  |
|   └── BackendTransport    (HTTPS / Bounded queue)     |
+-------------------------------------------------------+
                           |
                           | Authenticated HTTPS POST /api/v1/telemetry/ingest
                           | Header: x-drone-bridge-token: <DRONE_BRIDGE_TOKEN>
                           v
+-------------------------------------------------------+
|              AERON NODE.JS BACKEND                    |
|   - Express.js Telemetry Ingestion Controller         |
|   - Machine-to-Machine Timing-Safe Auth Middleware    |
|   - Schema Boundary Validation (Zod)                  |
|   - MongoDB Atlas (telemetryrecords collection)       |
|   - Authenticated Socket.IO Server                    |
+-------------------------------------------------------+
                           |
                           | WebSocket Room: drone:telemetry:<droneId>
                           v
+-------------------------------------------------------+
|           AERON ADMIN GCS WEB INTERFACE               |
|   - Tactical HUD, PFD Artificial Horizon, Altitude    |
|   - CartoDB Dark Matter Leaflet GPS Radar Tracking    |
|   - Ground Safety Interlocks (Read-only GCS mode)     |
+-------------------------------------------------------+
```

> [!IMPORTANT]
> The Python bridge runs locally on the ground-station laptop where the physical Pixhawk or 3DR telemetry radio is connected. Cloud-deployed backends (e.g., on Render) cannot directly bind to a local laptop's COM port; the local bridge forwards telemetry securely over authenticated HTTPS.

---

## 2. Windows USB Serial Setup & COM Port Identification

### 2.1 Identifying the Active COM Port
Connect the Pixhawk 2.4.8 to a USB port on the Windows laptop. Open PowerShell and run:

```powershell
# List all active serial ports recognized by Windows
[System.IO.Ports.SerialPort]::GetPortNames()

# Inspect detailed PnP device identifiers and status
Get-PnpDevice -Class 'Ports' | Where-Object { $_.Present -eq $true } | Select-Object FriendlyName, InstanceId
```

Expected hardware signatures:
- **Direct USB Virtual COM Port:** `USB Serial Device (COMx)` with hardware ID `USB\VID_1209&PID_5741` or `USB\VID_26AC&PID_0011`.
- **3DR Telemetry Radio (Silicon Labs CP2102):** `Silicon Labs CP210x USB to UART Bridge (COMx)` with hardware ID `USB\VID_10C4&PID_EA60`.
- **FTDI Serial Adapter:** `USB Serial Port (COMx)` with hardware ID `FTDIBUS\VID_0403+PID_6001`.

### 2.2 Baud Rate Configuration
- **USB Virtual COM Port (Direct USB Cable):** 57600 or 115200 baud.
- **3DR Telemetry Radio (TELEM1 Port):** Standard 57600 baud.

---

## 3. Environment Configuration

Copy the example environment file in `drone-bridge/`:
```powershell
cd drone-bridge
Copy-Item .env.example .env
```

Key configuration variables:
```ini
# Hardware Serial Link
MAVLINK_CONNECTION=COM9
MAVLINK_BAUD=57600
MAVLINK_SOURCE=REAL

# Airframe Identity
DRONE_ID=AERON-PX4-BENCH01

# Backend Ingestion Endpoint
# Local Development:
AERON_BACKEND_URL=http://localhost:5000/api/v1
BACKEND_INGEST_URL=http://localhost:5000/api/v1/telemetry/ingest

# Render Cloud Deployment (When targeting cloud backend):
# AERON_BACKEND_URL=https://aeron-api.sharprad-x.tech/api/v1
# BACKEND_INGEST_URL=https://aeron-api.sharprad-x.tech/api/v1/telemetry/ingest

# Machine Authentication Token
DRONE_BRIDGE_TOKEN=your_secure_m2m_token_here

# Tuning
TELEMETRY_PERSIST_INTERVAL_MS=250
HEARTBEAT_TIMEOUT_SECONDS=3.0
QUEUE_MAX_SIZE=500

# Software Simulation Fallback
SIMULATOR_ENABLED=false
```

---

## 4. Launching the Bridge

### 4.1 Running with Physical Pixhawk Hardware
```powershell
cd drone-bridge
python -m src.main --connection COM9 --baud 57600 --drone-id AERON-PX4-BENCH01
```

### 4.2 Running in Bench Simulation Mode (Fallback when Pixhawk is Unplugged)
```powershell
python -m src.main --simulator --drone-id AERON-PX4-BENCH01
```

---

## 5. MAVLink Message Specification & Conversions

The bridge strictly performs **read-only parsing** of incoming MAVLink packets:

### 1. `HEARTBEAT` (Message #0)
- **Armed State:** Extracted from `base_mode & 128` (`MAV_MODE_FLAG_SAFETY_ARMED`). If bit 7 is set, `armed = True`; otherwise `armed = False`.
- **Flight Mode:** Mapped from `custom_mode` using the ArduPilot Copter lookup table (0=STABILIZE, 2=ALT_HOLD, 3=AUTO, 5=LOITER, 6=RTL, 16=POSHOLD).
- **Heartbeat Freshness:** Each received heartbeat timestamp resets the heartbeat timer. If no heartbeat arrives for > 3.0 seconds, Pixhawk status transitions to `STALE`, and after 9.0 seconds to `DISCONNECTED`.

### 2. `GLOBAL_POSITION_INT` (Message #33)
- **Latitude / Longitude:** `lat / 1e7`, `lon / 1e7` (degrees). Checked for valid ranges ($-90 \le \text{lat} \le 90$, $-180 \le \text{lon} \le 180$).
- **Altitude MSL:** `alt / 1000.0` (meters).
- **Relative Altitude AGL:** `relative_alt / 1000.0` (meters).
- **Ground Speed:** Calculated from horizontal velocity vectors: $\frac{\sqrt{v_x^2 + v_y^2}}{100.0}\text{ m/s}$.
- **Heading:** `hdg / 100.0` (degrees, $0^\circ \text{ to } 360^\circ$). Sentinel `65535` is treated as `None`.

### 3. `GPS_RAW_INT` (Message #24)
- **GPS Fix Type:** Mapped to string (`NO_GPS`, `NO_FIX`, `2D_FIX`, `3D_FIX`, `DGPS`, `RTK_FLOAT`, `RTK_FIXED`).
- **Satellites Visible:** `satellites_visible`.
- **HDOP:** `eph / 100.0` (ratio/meters).
- **Course Over Ground:** `cog / 100.0` (degrees). **Course over ground is NOT substituted for aircraft heading.**

### 4. `SYS_STATUS` (Message #1)
- **Battery Voltage:** `voltage_battery / 1000.0` (mV $\to$ V).
- **Battery Current:** `current_battery / 100.0` (cA $\to$ A).
- **Remaining Percentage:** `battery_remaining` ($0\% \text{ to } 100\%$).
- **Sensor Health:** Bitmap decoded into discrete sensor states (IMU, Barometer, Compass, GPS).

### 5. `ATTITUDE` (Message #30)
- **Euler Angles:** Roll, Pitch, and Yaw converted from radians to degrees: $\text{deg} = \text{rad} \times \frac{180}{\pi}$.
- Yaw is normalized to $0^\circ \text{ to } 360^\circ$.

---

## 6. Decoupled Subsystem Health

The bridge maintains **strictly independent health statuses** across all 6 subsystems:

1. **Serial Port:** `OPEN` / `FAILED` / `CLOSED` (indicates whether laptop COM port is open).
2. **Pixhawk FC:** `HEALTHY` / `STALE` / `DISCONNECTED` (indicates whether valid MAVLink HEARTBEAT is arriving).
3. **GPS Fix:** `3D_FIX` / `2D_FIX` / `NO_FIX` (indicates satellite lock state).
4. **Telemetry Freshness:** `FRESH` / `STALE` / `EXPIRED` (indicates MAVLink stream age).
5. **Backend Transport:** `ONLINE` / `RETRYING` / `FAILED` (indicates HTTP delivery status).
6. **Camera Module:** `NOT_CONNECTED` / `STANDBY` (indicates RTSP payload link).

> [!CAUTION]
> A serial port being open does not mean the Pixhawk is connected. A valid Pixhawk heartbeat does not mean GPS has a fix. A working backend does not mean the drone is online. Subsystems are never collapsed into a single misleading status.

---

## 7. Bench Safety & Prohibited Operations

> [!CAUTION]
> **MANDATORY BENCH SAFETY PROTOCOL:**
> 1. Remove ALL propellers before connecting the battery on the bench.
> 2. Secure the quadcopter airframe to the bench.
> 3. Verify physical serial cable cannot snag motor shafts.
> 4. Keep bystanders clear of the test area.

### Strictly Prohibited Operations
The bridge is strictly **READ-ONLY**. The software bridge contains NO code to emit any of the following outbound MAVLink commands:
- `ARM` / `DISARM`
- `TAKEOFF` / `LAND` / `RTL`
- `PARAM_SET` / `PARAM_WRITE`
- `RC_OVERRIDE`
- `MOTOR_TEST`
- Stream-rate configuration overrides

---

## 8. Troubleshooting Guide

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| `SerialException: could not open port 'COM9'` | Cable disconnected or port occupied by another app (e.g. Mission Planner). | Close Mission Planner / QGroundControl, replug USB cable, verify COM port with `Get-PnpDevice -Class 'Ports'`. |
| `FC: AWAITING_FIRST_HEARTBEAT` | Serial baud rate mismatch or telemetry stream disabled in ArduPilot parameters. | Verify `MAVLINK_BAUD` matches ArduPilot `SERIAL0_BAUD` (typically 57600 or 115200). |
| `Backend rejected telemetry with HTTP 401` | `DRONE_BRIDGE_TOKEN` does not match backend configuration. | Ensure `DRONE_BRIDGE_TOKEN` in `drone-bridge/.env` matches `Backend/.env`. |
| `GPS: NO_FIX (0 satellites)` | Indoor bench testing attenuates satellite GNSS signals. | Normal indoors. Bench origin coordinates are displayed by GCS until 3D fix is acquired. |
| `Queue capacity exceeded: Dropped X records` | Backend is unreachable or network connection to Render is lagging. | Verify backend health at `/health/ready`. Queue buffers up to 500 items before safely dropping oldest records to prevent memory exhaustion. |

