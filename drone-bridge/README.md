# AERON — Pixhawk 2.4.8 MAVLink Drone Telemetry Bridge

The `drone-bridge` module runs locally on the ground-station laptop. It interfaces directly with the physical quadcopter flight controller (Pixhawk 2.4.8) via USB serial / MAVLink 2.0, parses incoming telemetry frames, normalizes data into the AERON telemetry schema, and securely transmits verified packets to the central backend (local or cloud-deployed on Render).

---

## 1. Architecture Flow

```
PHYSICAL QUADCOPTER (Pixhawk 2.4.8 + U-Blox GPS + 4S LiPo)
        │
        ▼ (MAVLink 2.0 @ 57600 baud via USB-Serial / 3DR Radio)
LOCAL DRONE BRIDGE (Python ground station daemon on development laptop)
        │
        ▼ (Authenticated HTTPS POST with x-drone-bridge-token)
AERON BACKEND (Node.js + Express + MongoDB Atlas + Socket.IO)
        │
        ├── ADMIN WEB (Drone Intelligence GCS: Live Telemetry, PFD, GPS Tracking)
        └── MANAGER WEB (Mission Intelligence Command Deck)
```

> [!IMPORTANT]
> The bridge runs locally because cloud-hosted environments (e.g., Render) cannot access physical USB ports on your laptop. The bridge acts as the secure, authenticated machine-to-machine telemetry gateway.

---

## 2. Key Capabilities

- **Real MAVLink Communication:** Implemented using `pymavlink` and `pyserial`.
- **Read-Only Safety Guarantee:** Strictly listens and parses packets. Contains no code to emit flight control commands (`ARM`, `TAKEOFF`, `PARAM_SET`, `RC_OVERRIDE`).
- **Decoupled Subsystem Health:** Independently monitors serial port, Pixhawk heartbeat, GPS fix, telemetry freshness, and backend delivery.
- **Strict Data Integrity:** Real hardware packets carry `source="REAL"` and `isSimulated=False`. Simulated packets carry `source="SIMULATION"` and `isSimulated=True`. They are never intermixed.
- **Bounded Transmission Queue:** Buffers up to 500 telemetry records during network blips and retries with backoff, dropping stale records gracefully if queue overflows.
- **ESP32-CAM Video Subsystem:** Authenticated frame reader supporting HTTP JPEG snapshots, synthetic bench patterns (`MOCK`), rate throttling, GPS telemetry synchronization, and zero-database-bloat in-memory backend relay.


---

## 3. Quickstart Guide (Windows PowerShell)

### 3.1 Install Dependencies
```powershell
cd drone-bridge
pip install -r requirements.txt
```

### 3.2 Identify Pixhawk COM Port
Connect the Pixhawk 2.4.8 to a USB port and run:
```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
Get-PnpDevice -Class 'Ports' | Where-Object { $_.Present -eq $true }
```
Note the assigned port (e.g. `COM9` or `COM8`).

### 3.3 Configure Environment
```powershell
Copy-Item .env.example .env
```
Ensure `MAVLINK_CONNECTION` matches your port, and `DRONE_BRIDGE_TOKEN` matches your backend.

### 3.4 Launch Bridge

**With Physical Pixhawk Connected:**
```powershell
python -m src.main --connection COM9 --baud 57600 --drone-id AERON-PX4-BENCH01
```

**Bench Simulation Fallback (When hardware is unplugged):**
```powershell
python -m src.main --simulator --drone-id AERON-PX4-BENCH01
```

**Bench Simulation with Mock Optical Camera Stream:**
```powershell
python -m src.main --simulator --camera --camera-protocol MOCK --drone-id AERON-PX4-BENCH01
```

**With Physical ESP32-CAM (OV2640) on Local Network:**
```powershell
python -m src.main --camera --camera-host 192.168.4.1 --camera-port 80 --camera-fps 2.0
```


---

## 4. Environment Variables Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `MAVLINK_CONNECTION` | `COM9` | Serial port (`COMx`) or network stream (`udpin:localhost:14550`). |
| `MAVLINK_BAUD` | `57600` | Serial connection baud rate (57600 or 115200). |
| `MAVLINK_SOURCE` | `REAL` | Telemetry source label (`REAL` or `SIMULATION`). |
| `DRONE_ID` | `AERON-PX4-BENCH01` | Airframe identifier. |
| `AERON_BACKEND_URL` | `http://localhost:5000/api/v1` | Base API URL (set to `https://aeron-api.sharprad-x.tech/api/v1` on Render). |
| `BACKEND_INGEST_URL` | `http://localhost:5000/api/v1/telemetry/ingest` | Telemetry ingestion endpoint. |
| `DRONE_BRIDGE_TOKEN` | `aeron_drone_bridge_secret_token_dev` | Secret M2M ingestion token. |
| `TELEMETRY_PERSIST_INTERVAL_MS`| `250` | Ingestion dispatch interval in milliseconds (4 Hz). |
| `HEARTBEAT_TIMEOUT_SECONDS` | `3.0` | Inactivity threshold before FC is marked disconnected. |
| `QUEUE_MAX_SIZE` | `500` | Maximum in-memory telemetry buffer. |
| `SIMULATOR_ENABLED` | `false` | Enable fallback simulation bench. |
| `LOG_LEVEL` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARN`, `ERROR`). |

---

## 5. MAVLink Message Decoder Reference

- **`HEARTBEAT` (#0):** Autopilot type, system/component ID, base mode, custom mode, armed state (`base_mode & 128`), and freshness reset.
- **`GLOBAL_POSITION_INT` (#33):** Latitude ($\text{degE7} \to \text{deg}$), Longitude, Altitude MSL ($\text{mm} \to \text{m}$), Relative Altitude AGL ($\text{mm} \to \text{m}$), Horizontal Ground Speed ($\frac{\sqrt{v_x^2 + v_y^2}}{100} \text{ m/s}$), Aircraft Heading ($\text{cdeg} \to \text{deg}$).
- **`GPS_RAW_INT` (#24):** Fix type (3D Fix, DGPS), Satellites visible, HDOP ($\text{eph}/100$), Course over ground (distinct from aircraft heading).
- **`SYS_STATUS` (#1):** 4S battery voltage ($\text{mV} \to \text{V}$), current draw ($\text{cA} \to \text{A}$), battery percentage ($0-100\%$), sensor health bitmaps.
- **`ATTITUDE` (#30):** Roll, Pitch, Yaw converted from radians to degrees.

---

## 6. Running Unit & Integration Tests

```powershell
cd drone-bridge
python -m unittest discover tests
```
Runs 23 tests covering MAVLink decoding, sentinel values, conversions, timeout transitions, queue capacity drops, camera JPEG validation, synthetic HUD generation, FPS sliding-window calculations, and transport retries.

---

## 7. Bench Safety Notice

> [!CAUTION]
> Always remove quadcopter propellers before conducting bench testing with a live battery attached. Keep the airframe securely placed on the bench and clear of bystanders.
