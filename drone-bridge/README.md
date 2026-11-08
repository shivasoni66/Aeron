# AERON — Drone Telemetry Bridge & Ground Station

The `drone-bridge` module runs locally on the ground-station laptop. It interfaces with the physical quadcopter flight controller (Pixhawk 2.4.8) via USB serial / MAVLink, parses incoming telemetry, normalizes data structures, and transmits verified telemetry packets to the AERON central backend.

## Architectural Flow
```
PHYSICAL QUADCOPTER (Pixhawk 2.4.8 + GPS)
        │
        ▼ (MAVLink 2.0 via USB / Telemetry Radio)
LOCAL DRONE BRIDGE (Python ground station daemon)
        │
        ▼ (Authenticated HTTPS Ingestion / WebSocket)
AERON NODE.JS BACKEND (Express + MongoDB + Socket.IO)
        │
        ├── ADMIN WEB (Physical Drone Intelligence)
        └── MANAGER WEB (Mission Operations Intelligence)
```

## Features
- **USB Serial / MAVLink Ingestion:** Connects to Pixhawk COM ports at 57600 baud.
- **Heartbeat Freshness Tracking:** Monitors hardware responsiveness and link quality.
- **Explicit Telemetry Simulator:** Built-in 10Hz high-fidelity dynamics simulator for bench testing without physical hardware connected. All simulated payloads carry `source: "simulation"` and `isSimulated: true`.
- **Read-Only Safety Guarantee:** Strictly receives telemetry. Sends no arm, disarm, or flight override commands.

## Setup & Execution (Windows PowerShell)

### 1. Virtual Environment & Dependencies
```powershell
cd drone-bridge
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

### 3. Running the Simulator
```powershell
python -m src.main
```

### 4. Running Automated Tests
```powershell
python -m unittest tests/test_simulator.py
```

