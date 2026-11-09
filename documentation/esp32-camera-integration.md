# AERON — ESP32-CAM Video Subsystem & Secure Live Preview Architecture

**Platform:** AERON — Multi-Mission Autonomous Drone Platform  
**Subsystem:** Optical Payload & FPV Video Relay  
**Sensor & Module:** ESP32-CAM (OV2640 Image Sensor, 2.4 GHz 802.11b/g/n Wi-Fi, microSD slot)  
**Status:** Software Architecture Complete & Verified // Physical Hardware `BLOCKED (UNPLUGGED)`  

---

## 1. Executive Summary & Hardware Verification

During the Task 06 hardware discovery audit on the operator's Windows workstation:
- **USB Interface:** Neither an FTDI nor CP2102/CH340 USB-UART bridge was attached to any host COM port (`Get-PnpDevice -Class 'Ports'` returned empty).
- **Wi-Fi Subnet:** Local adapter (`192.168.43.52`) scan showed only the local gateway (`192.168.43.1`). The default ESP32-CAM Access Point (`192.168.4.1`) was not present or reachable.
- **Authoritative Physical Status:** **`BLOCKED (UNPLUGGED)`**.

In strict accordance with the AERON engineering integrity mandate, **no physical connection is claimed**. Instead, the complete end-to-end video acquisition pipeline, zero-database-bloat memory relay, security guards, telemetry synchronization, and Admin Web preview have been implemented and verified using mock and bench synthetic frame generators.

---

## 2. End-to-End Architectural Topology

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

## 3. Why Cloud Backends Cannot Connect Directly to the ESP32-CAM

Cloud services (such as Render, AWS EC2, or Google Cloud Run) execute in remote data centers and have no private route into local network subnets (`192.168.4.1`, `192.168.1.0/24`, or `10.0.0.0/8`). 

The local development laptop acts as the **Edge Gateway**:
1. It connects to the quadcopter's local Wi-Fi access point or local router.
2. It fetches the raw frames from the ESP32-CAM over HTTP/MJPEG.
3. It packages each frame with synchronized flight telemetry from the Pixhawk.
4. It initiates an **outbound HTTPS connection** to the backend, transmitting frames over TLS authenticated with `x-drone-bridge-token`.
5. The cloud backend receives the outbound stream and broadcasts it to authorized Admin Web sessions via Socket.IO.

---

## 4. Zero-Database-Bloat Policy

Video streaming generates hundreds of megabytes of binary image data per hour. Persisting high-frequency video frames to MongoDB would rapidly exhaust document storage quotas, increase database I/O latency, and degrade telemetry query performance.

### Implementation Standard:
- **Memory-Only Relay:** Incoming video frames are validated, cached in a volatile `Map<string, CameraFrame>` (`latestFrames`) on the backend server, and immediately broadcast over Socket.IO to connected admin clients.
- **Authoritative Database Records:** Only hardware metadata (device ID, IP address, firmware version, connection status, last seen timestamp) is persisted in the MongoDB `HardwareDevice` collection.
- **Snapshots:** Explicit administrative snapshot captures may be saved as file assets or stored with mission metadata, but continuous video streams never touch database storage.

---

## 5. Geospatial Telemetry Synchronization & Ground Target Disclaimer

Every frame ingested by the bridge is tagged with synchronized flight coordinates captured at the same epoch:
- `telemetryLat`: Aircraft GNSS latitude (-90.0 to +90.0).
- `telemetryLon`: Aircraft GNSS longitude (-180.0 to +180.0).
- `telemetryAlt`: Altitude MSL / AGL in meters.
- `telemetryHeading`: Aircraft compass orientation (0° to 360°).
- `telemetryAgeSeconds`: Latency between MAVLink position fix and optical frame exposure.

### Engineering & Geospatial Disclaimer:
> [!IMPORTANT]
> **Aircraft GPS is NOT Ground Target Geolocation:**
> The coordinates displayed on the Live Camera HUD represent the **physical position of the drone's GNSS receiver at the moment of camera shutter exposure**. 
> 
> Calculating the exact latitude/longitude of a point on the ground in the video frame requires ray-casting using:
> 1. Exact aircraft 3D position (latitude, longitude, altitude).
> 2. Aircraft attitude (roll, pitch, yaw).
> 3. Camera gimbal angles (pan, tilt).
> 4. Camera lens intrinsic parameters (horizontal/vertical Field of View, focal length, distortion matrix).
> 5. A Digital Elevation Model (DEM) of the ground terrain.
> 
> The AERON system explicitly documents this distinction in both backend metadata and the Admin Web interface to prevent pilot or operator misinterpretation during reconnaissance missions.

---

## 6. Access Control & Role-Based Security

Live video feeds and optical payloads can expose sensitive geographical, surveillance, or tactical imagery. AERON enforces strict security controls:

| Path / Channel | Protocol | Auth Requirement | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `POST /api/v1/camera/frames` | HTTPS | `x-drone-bridge-token` | Machine-to-Machine Bridge |
| `POST /api/v1/camera/status` | HTTPS | `x-drone-bridge-token` | Machine-to-Machine Bridge |
| `GET /api/v1/admin/drones/:droneId/camera/status` | HTTPS | JWT Bearer | `admin` |
| `GET /api/v1/admin/drones/:droneId/camera/preview/latest` | HTTPS | JWT Bearer | `admin` |
| Room: `drone:camera:*` | Socket.IO | Handshake JWT | `admin` |

Citizens and Managers attempting to join the video streaming room are immediately rejected, disconnected, and a security audit event is logged.

---

## 7. Verification & Bench Testing Procedures

### Running Synthetic Bench Stream:
When physical hardware is unplugged, run the Python drone bridge with mock camera generation:
```powershell
python -m src.main --simulator --camera --camera-protocol MOCK --drone-id AERON-PX4-BENCH01
```
The bridge will:
1. Generate valid 640x480 JPEG test frames with real-time crosshairs and timestamps.
2. Synchronize simulated GPS coordinates from the flight dynamics engine.
3. Deliver frames to `http://localhost:5000/api/v1/camera/frames`.
4. Display the live feed on the Admin Web interface at `http://localhost:5173/camera`.

### Running Verification Test Suites:
- **Backend Tests (116 tests):**
  ```powershell
  cd Backend
  npm test
  ```
- **Python Bridge Tests (23 tests):**
  ```powershell
  cd drone-bridge
  python -m unittest discover tests
  ```

