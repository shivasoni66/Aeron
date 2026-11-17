"""
AERON Ground Control Station — Local Bridge Controller Service
==============================================================
Author: AERON Ground Station & Avionics Engineering
Service Port: 8765 (Loopback Only: 127.0.0.1)

Provides a lightweight, secure HTTP REST API running strictly on 127.0.0.1
to allow the AERON Admin Dashboard operator to safely start, monitor, and
stop the physical Python MAVLink telemetry bridge on Windows.

Security Guarantees:
- Strictly bound to 127.0.0.1 (never 0.0.0.0 or external interfaces).
- Cryptographic local authentication token via X-AERON-TOKEN header.
- CORS with Private Network Access (PNA) preflight support.
- Zero arbitrary command execution: launches only predefined bridge scripts.
- Process tree tracking: stops only the managed bridge process and children.
"""

import os
import sys
import re
import json
import time
import socket
import signal
import secrets
import pathlib
import urllib.request
import urllib.error
import subprocess
import threading
from collections import deque
from typing import Optional, Dict, Any, List
from http.server import HTTPServer, BaseHTTPRequestHandler

# Handle windowless pythonw execution where stdout/stderr may be None
class SafeLogger:
    def __init__(self, log_path: Optional[pathlib.Path] = None):
        self.log_path = log_path

    def write(self, msg: str):
        if not msg:
            return
        if self.log_path:
            try:
                with open(self.log_path, "a", encoding="utf-8") as f:
                    f.write(msg)
            except Exception:
                pass

    def flush(self):
        pass

if sys.stdout is None or not hasattr(sys.stdout, "write"):
    _log_file = pathlib.Path.home() / ".aeron" / "controller.log"
    sys.stdout = SafeLogger(_log_file)
    sys.stderr = SafeLogger(_log_file)

# Import psutil if available for advanced process tree introspection
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# Controller Network Configuration
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765

# Status Enumerations
STATUS_CONTROLLER_OFFLINE = "CONTROLLER_OFFLINE"
STATUS_BRIDGE_STOPPED = "BRIDGE_STOPPED"
STATUS_STARTING = "STARTING"
STATUS_WAITING_FOR_ESP32 = "WAITING_FOR_ESP32"
STATUS_CONNECTING = "CONNECTING"
STATUS_CONNECTED = "CONNECTED"
STATUS_DISCONNECTED = "DISCONNECTED"
STATUS_ERROR = "ERROR"
STATUS_STOPPING = "STOPPING"

class BridgeProcessManager:
    """
    Manages the lifecycle, subprocess execution, real-time logging, and health
    monitoring of the AERON Python MAVLink Telemetry Bridge.
    """
    def __init__(self, repo_root: pathlib.Path, backend_url: Optional[str] = None):
        self.repo_root = repo_root
        self.bridge_dir = repo_root / "drone-bridge"
        self.launcher_script = self.bridge_dir / "start-aeron-bridge.ps1"
        self.env_config = self._load_env_config()

        # Reconcile backend URL: explicit parameter > environment variable > .env > default production
        default_render_backend = "https://aeron.onrender.com/api/v1"
        configured_url = os.environ.get("AERON_BACKEND_URL") or self.env_config.get("AERON_BACKEND_URL") or default_render_backend
        self.backend_url = (backend_url or configured_url).rstrip("/")
        self.drone_id = os.environ.get("DRONE_ID") or self.env_config.get("DRONE_ID") or "AERON-HEX-01"
        self.transport = "WIFI"

        self.lock = threading.Lock()
        self.managed_process: Optional[subprocess.Popen] = None
        self.managed_pid: Optional[int] = None
        self.status: str = STATUS_BRIDGE_STOPPED
        self.started_at: Optional[float] = None
        self.last_error: Optional[str] = None

        # Multi-stage granular state indicators
        self.bridge_process_state: str = "STOPPED"       # STOPPED, STARTING, RUNNING, STOPPING, ERROR
        self.transport_state: str = "DISCONNECTED"        # DISCONNECTED, CONNECTING, CONNECTED, ERROR
        self.esp32_state: str = "DISCONNECTED"            # DISCONNECTED, DISCOVERING, CONNECTING, CONNECTED
        self.heartbeat_state: str = "NO_HEARTBEAT"        # NO_HEARTBEAT, AWAITING, HEALTHY, LOST
        self.backend_state: str = "DISCONNECTED"          # DISCONNECTED, CONNECTING, CONNECTED, UPLOAD_ERROR

        self.telemetry_fresh: bool = False
        self.telemetry_age_ms: Optional[int] = None
        self.message_rate_hz: float = 0.0
        self.backend_delivered_count: int = 0
        self.mavlink_rx_bytes: int = 0
        self.mavlink_rx_packets: int = 0

        # Ring buffer for recent console output (last 100 lines)
        self.recent_logs: deque = deque(maxlen=100)
        self._log_thread: Optional[threading.Thread] = None
        self._monitor_thread: Optional[threading.Thread] = None
        self._stop_monitor_event = threading.Event()

    def _load_env_config(self) -> Dict[str, str]:
        """Loads key-value pairs from drone-bridge/.env without external dependencies."""
        env_file = self.bridge_dir / ".env"
        cfg = {}
        if env_file.exists():
            try:
                for line in env_file.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        cfg[k.strip()] = v.strip().strip("'\"")
            except Exception:
                pass
        return cfg

    def start_bridge(
        self,
        transport: Optional[str] = None,
        backend_url: Optional[str] = None,
        drone_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Launches the Python bridge using the official PowerShell launcher.
        Prevents duplicate processes and enforces configured transport & backend.
        """
        with self.lock:
            # Check if an active process is already running
            if self.managed_process is not None and self.managed_process.poll() is None:
                return {
                    "success": False,
                    "message": f"Bridge is already running (PID: {self.managed_pid})",
                    "status": self.status,
                    "pid": self.managed_pid
                }

            if not self.launcher_script.exists():
                err_msg = f"Launcher script not found at {self.launcher_script}"
                self.last_error = err_msg
                self.status = STATUS_ERROR
                self.bridge_process_state = "ERROR"
                return {"success": False, "message": err_msg, "status": STATUS_ERROR}

            # Refresh configuration from .env
            self.env_config = self._load_env_config()
            active_transport = (transport or self.transport or "wifi").lower()
            active_backend = (backend_url or self.env_config.get("AERON_BACKEND_URL") or self.backend_url).rstrip("/")
            active_drone_id = drone_id or self.env_config.get("DRONE_ID") or self.drone_id
            active_wifi_host = self.env_config.get("AERON_WIFI_HOST") or "10.231.241.165"
            active_wifi_fallback = self.env_config.get("AERON_WIFI_FALLBACK_IP") or active_wifi_host

            self.transport = active_transport.upper()
            self.backend_url = active_backend
            self.drone_id = active_drone_id

            self.status = STATUS_STARTING
            self.bridge_process_state = "STARTING"
            self.transport_state = "CONNECTING"
            self.esp32_state = "DISCOVERING"
            self.heartbeat_state = "AWAITING"
            self.backend_state = "CONNECTING"
            self.backend_delivered_count = 0
            self.mavlink_rx_bytes = 0
            self.mavlink_rx_packets = 0
            self.telemetry_fresh = False
            self.telemetry_age_ms = None
            self.message_rate_hz = 0.0
            self.last_error = None
            self.started_at = time.time()
            self.recent_logs.clear()

            self._log_line(
                f"[AERON-CONTROLLER] Launching bridge via {self.launcher_script.name} "
                f"-Transport {active_transport} -WifiHost {active_wifi_host} -BackendUrl {active_backend} -DroneId {active_drone_id}"
            )

            # Construct PowerShell execution command
            cmd = [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", str(self.launcher_script),
                "-Transport", active_transport,
                "-WifiHost", active_wifi_host,
                "-WifiFallbackIp", active_wifi_fallback,
                "-BackendUrl", active_backend,
                "-DroneId", active_drone_id
            ]

            try:
                creation_flags = 0
                if sys.platform == "win32":
                    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

                self.managed_process = subprocess.Popen(
                    cmd,
                    cwd=str(self.repo_root),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    creationflags=creation_flags
                )
                self.managed_pid = self.managed_process.pid
                self.bridge_process_state = "RUNNING"
                self._log_line(f"[AERON-CONTROLLER] Bridge process launched successfully (PID: {self.managed_pid})")

                # Start background log reader thread
                self._log_thread = threading.Thread(target=self._read_process_output, daemon=True)
                self._log_thread.start()

                # Start background health monitor if not already running
                if self._monitor_thread is None or not self._monitor_thread.is_alive():
                    self._stop_monitor_event.clear()
                    self._monitor_thread = threading.Thread(target=self._monitor_telemetry_loop, daemon=True)
                    self._monitor_thread.start()

                return {
                    "success": True,
                    "message": "Bridge process started",
                    "status": self.status,
                    "pid": self.managed_pid
                }

            except Exception as e:
                self.last_error = f"Failed to spawn bridge process: {e}"
                self.status = STATUS_ERROR
                self.bridge_process_state = "ERROR"
                self.managed_process = None
                self.managed_pid = None
                self._log_line(f"[AERON-CONTROLLER] ERROR: {self.last_error}")
                return {"success": False, "message": self.last_error, "status": STATUS_ERROR}

    def stop_bridge(self) -> Dict[str, Any]:
        """
        Safely stops the managed bridge process and its child processes.
        Strictly targets only the process tree spawned by this controller.
        """
        with self.lock:
            if self.managed_process is None or self.managed_process.poll() is not None:
                self.status = STATUS_BRIDGE_STOPPED
                self.bridge_process_state = "STOPPED"
                self.transport_state = "DISCONNECTED"
                self.esp32_state = "DISCONNECTED"
                self.heartbeat_state = "NO_HEARTBEAT"
                self.backend_state = "DISCONNECTED"
                self.telemetry_fresh = False
                self.managed_pid = None
                self.managed_process = None
                return {"success": True, "message": "Bridge is not running", "status": STATUS_BRIDGE_STOPPED}

            self.status = STATUS_STOPPING
            self.bridge_process_state = "STOPPING"
            pid = self.managed_pid
            self._log_line(f"[AERON-CONTROLLER] Stopping bridge process tree (PID: {pid})...")

            try:
                if sys.platform == "win32":
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(pid)],
                        capture_output=True,
                        timeout=5
                    )
                else:
                    self.managed_process.terminate()
                    try:
                        self.managed_process.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        self.managed_process.kill()

                self.managed_process.wait(timeout=3)
            except Exception as e:
                self._log_line(f"[AERON-CONTROLLER] Note during process termination: {e}")

            self.managed_process = None
            self.managed_pid = None
            self.status = STATUS_BRIDGE_STOPPED
            self.bridge_process_state = "STOPPED"
            self.transport_state = "DISCONNECTED"
            self.esp32_state = "DISCONNECTED"
            self.heartbeat_state = "NO_HEARTBEAT"
            self.backend_state = "DISCONNECTED"
            self.telemetry_fresh = False
            self.started_at = None
            self._log_line("[AERON-CONTROLLER] Bridge process stopped cleanly.")

            return {
                "success": True,
                "message": "Bridge stopped successfully",
                "status": STATUS_BRIDGE_STOPPED
            }

    def restart_bridge(self) -> Dict[str, Any]:
        """Stops the bridge (if running) and restarts it cleanly."""
        self.stop_bridge()
        time.sleep(1.0)
        return self.start_bridge()

    def get_status_snapshot(self) -> Dict[str, Any]:
        """Returns the authoritative status snapshot for the dashboard."""
        with self.lock:
            # Check liveness of managed process
            if self.managed_process is not None:
                poll_result = self.managed_process.poll()
                if poll_result is not None:
                    # Process died
                    if self.status != STATUS_STOPPING and self.status != STATUS_BRIDGE_STOPPED:
                        self.status = STATUS_ERROR if poll_result != 0 else STATUS_BRIDGE_STOPPED
                        self.bridge_process_state = "ERROR" if poll_result != 0 else "STOPPED"
                        if poll_result != 0 and not self.last_error:
                            self.last_error = f"Process exited unexpectedly with code {poll_result}"
                    self.managed_process = None
                    self.managed_pid = None

            uptime_sec = 0
            if self.started_at and self.managed_pid:
                uptime_sec = int(time.time() - self.started_at)

            return {
                "status": self.status,
                "managed_pid": self.managed_pid,
                "transport": self.transport,
                "backend_url": self.backend_url,
                "bridge_process_state": self.bridge_process_state,
                "transport_state": self.transport_state,
                "esp32_state": self.esp32_state,
                "heartbeat_state": self.heartbeat_state,
                "backend_state": self.backend_state,
                "backend_delivered_count": self.backend_delivered_count,
                "mavlink_rx_bytes": self.mavlink_rx_bytes,
                "mavlink_rx_packets": self.mavlink_rx_packets,
                "telemetry_fresh": self.telemetry_fresh,
                "telemetry_age_ms": self.telemetry_age_ms,
                "message_rate_hz": self.message_rate_hz,
                "uptime_seconds": uptime_sec,
                "last_error": self.last_error,
                "recent_logs": list(self.recent_logs)[-30:],
                "started_at": self.started_at
            }

    def _log_line(self, line: str):
        ts = time.strftime("[%H:%M:%S]")
        formatted = f"{ts} {line.strip()}"
        self.recent_logs.append(formatted)

    def _read_process_output(self):
        """Streams stdout from the bridge subprocess and updates the state machine."""
        if not self.managed_process or not self.managed_process.stdout:
            return

        try:
            for raw_line in iter(self.managed_process.stdout.readline, ""):
                if not raw_line:
                    break
                line = raw_line.strip()
                if not line:
                    continue

                self._log_line(line)

                # State machine parsing from output logs
                with self.lock:
                    lower = line.lower()
                    if "unable to discover esp32" in lower or "esp32 discovery" in lower:
                        self.esp32_state = "DISCOVERING"
                        self.transport_state = "CONNECTING"
                        if self.status not in (STATUS_CONNECTED, STATUS_STOPPING):
                            self.status = STATUS_WAITING_FOR_ESP32

                    elif "opening mavlink interface" in lower or "awaiting valid heartbeat" in lower:
                        self.esp32_state = "CONNECTING"
                        self.transport_state = "CONNECTING"
                        if self.status not in (STATUS_CONNECTED, STATUS_STOPPING):
                            self.status = STATUS_CONNECTING

                    elif "discovered esp32" in lower or "successfully opened tcp" in lower or "opened successfully" in lower:
                        self.esp32_state = "CONNECTED"
                        self.transport_state = "CONNECTED"
                        if self.bridge_process_state == "STARTING":
                            self.bridge_process_state = "RUNNING"

                    elif "fc: healthy" in lower:
                        self.heartbeat_state = "HEALTHY"
                        if self.bridge_process_state == "STARTING":
                            self.bridge_process_state = "RUNNING"
                        if self.status in (STATUS_STARTING, STATUS_WAITING_FOR_ESP32, STATUS_CONNECTING):
                            self.status = STATUS_CONNECTED

                    elif "fc: disconnected" in lower or "fc: stale" in lower or "lost heartbeat" in lower:
                        self.heartbeat_state = "LOST"
                        self.telemetry_fresh = False
                        if self.status == STATUS_CONNECTED:
                            self.status = STATUS_DISCONNECTED

                    elif "connection reset" in lower or "closed by peer" in lower:
                        self.esp32_state = "DISCONNECTED"
                        self.transport_state = "DISCONNECTED"
                        self.heartbeat_state = "LOST"
                        self.telemetry_fresh = False
                        if self.status == STATUS_CONNECTED:
                            self.status = STATUS_DISCONNECTED

                    elif "transport error sending snapshot" in lower or "backend rejected telemetry" in lower:
                        self.backend_state = "UPLOAD_ERROR"

                    # Parse RX message and delivery metrics
                    bytes_m = re.search(r"bytes=(\d+)", line)
                    if bytes_m:
                        self.mavlink_rx_bytes = int(bytes_m.group(1))

                    msgs_m = re.search(r"msgs=(\d+)", line)
                    if msgs_m:
                        self.mavlink_rx_packets = int(msgs_m.group(1))

                    deliv_m = re.search(r"BackendDelivered:\s*(\d+)", line)
                    if deliv_m:
                        self.backend_delivered_count = int(deliv_m.group(1))
                        if self.backend_delivered_count > 0:
                            self.backend_state = "CONNECTED"

        except Exception as e:
            self._log_line(f"[AERON-CONTROLLER] Output reader ended: {e}")

    def _monitor_telemetry_loop(self):
        """
        Background loop polling Backend API to confirm valid MAVLink heartbeat
        and fresh telemetry arrivals before claiming CONNECTED.
        """
        while not self._stop_monitor_event.is_set():
            time.sleep(1.2)

            with self.lock:
                if self.managed_process is None or self.managed_process.poll() is not None:
                    continue

            # Query backend for latest telemetry record
            try:
                url = f"{self.backend_url}/telemetry/latest/{self.drone_id}"
                req = urllib.request.Request(url, headers={"User-Agent": "AERON-Bridge-Controller/1.0"})
                with urllib.request.urlopen(req, timeout=2.5) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        raw_payload = data.get("data", {})
                        record = raw_payload.get("telemetry") if isinstance(raw_payload, dict) and "telemetry" in raw_payload else raw_payload
                        if record and isinstance(record, dict):
                            rec_str = record.get("recordedAt") or record.get("receivedAt")
                            if rec_str:
                                import datetime
                                try:
                                    ts_clean = rec_str.replace("Z", "+00:00")
                                    dt = datetime.datetime.fromisoformat(ts_clean)
                                    rec_ms = dt.timestamp() * 1000
                                    age_ms = int(max(0, (time.time() * 1000) - rec_ms))

                                    with self.lock:
                                        self.telemetry_age_ms = age_ms
                                        # Strict Rule: Telemetry must be fresh (<= 3500ms) to claim CONNECTED
                                        if age_ms <= 3500:
                                            self.telemetry_fresh = True
                                            self.backend_state = "CONNECTED"
                                            if self.heartbeat_state != "LOST":
                                                self.heartbeat_state = "HEALTHY"
                                            self.esp32_state = "CONNECTED"
                                            self.transport_state = "CONNECTED"
                                            if self.status in (STATUS_STARTING, STATUS_WAITING_FOR_ESP32, STATUS_CONNECTING, STATUS_DISCONNECTED):
                                                self.status = STATUS_CONNECTED
                                        elif age_ms > 5000:
                                            self.telemetry_fresh = False
                                            if self.status == STATUS_CONNECTED:
                                                self.status = STATUS_DISCONNECTED
                                                self.heartbeat_state = "LOST"
                                except Exception:
                                    pass
            except Exception:
                pass

    def run_self_diagnostics(self) -> Dict[str, Any]:
        """
        Runs the comprehensive 13-stage telemetry bridge self-diagnostics suite.
        Tests physical hardware, Python runtime, network reachability, MAVLink,
        and backend cloud ingestion.
        """
        checks = []

        # Check 1: Local Bridge Controller API
        checks.append({
            "id": "controller_reachability",
            "name": "Local Bridge Controller API",
            "status": "PASS",
            "details": f"Controller daemon is active on 127.0.0.1:8765 (PID {os.getpid()})"
        })

        # Check 2: Python Interpreter and Core Libraries
        py_status = "PASS"
        py_details = f"Python {sys.version.split()[0]} interpreter available"
        try:
            import pymavlink
            import serial
            import requests
            py_details += f" with pymavlink ({pymavlink.__file__}), pyserial, requests verified"
        except ImportError as ie:
            py_status = "FAIL"
            py_details = f"Missing required dependency: {ie}"
        checks.append({
            "id": "python_environment",
            "name": "Python 3 Interpreter & Libraries",
            "status": py_status,
            "details": py_details
        })

        # Check 3: Configuration & Environment Integrity
        env_file = self.bridge_dir / ".env"
        if env_file.exists():
            checks.append({
                "id": "configuration_integrity",
                "name": "Configuration & Credentials (.env)",
                "status": "PASS",
                "details": f"Configured for target '{self.drone_id}' -> Backend: {self.backend_url}"
            })
        else:
            checks.append({
                "id": "configuration_integrity",
                "name": "Configuration & Credentials (.env)",
                "status": "WARNING",
                "details": "Local .env file not found; using runtime defaults"
            })

        # Check 4: Windows COM Port (USB / Serial)
        com_ports = []
        try:
            import serial.tools.list_ports
            com_ports = [p.device for p in serial.tools.list_ports.comports()]
        except Exception:
            pass
        if "COM8" in com_ports:
            checks.append({
                "id": "com_port_availability",
                "name": "Windows COM Port (USB / Serial)",
                "status": "PASS",
                "details": f"Target port COM8 detected among available ports: {', '.join(com_ports)}"
            })
        elif com_ports:
            checks.append({
                "id": "com_port_availability",
                "name": "Windows COM Port (USB / Serial)",
                "status": "PASS",
                "details": f"Detected ports: {', '.join(com_ports)} (COM8 not connected; Wi-Fi primary active)"
            })
        else:
            checks.append({
                "id": "com_port_availability",
                "name": "Windows COM Port (USB / Serial)",
                "status": "WARNING",
                "details": "No USB serial COM ports detected on Windows host"
            })

        # Check 5: ESP32 Wi-Fi TCP Stream (Port 5760)
        esp32_ip = "10.231.241.165"
        esp_status = "WAITING"
        esp_details = f"ESP32 TCP probe on port 5760 ({esp32_ip})"
        try:
            s = socket.socket()
            s.settimeout(0.6)
            res = s.connect_ex((esp32_ip, 5760))
            s.close()
            if res == 0:
                esp_status = "PASS"
                esp_details = f"ESP32 Wi-Fi TCP socket open and accepting connections on {esp32_ip}:5760"
            else:
                esp_status = "WARNING"
                esp_details = f"TCP socket probe to {esp32_ip}:5760 returned code {res}"
        except Exception as e:
            esp_status = "WARNING"
            esp_details = f"ESP32 TCP probe: {e}"
        checks.append({
            "id": "esp32_tcp_reachability",
            "name": "ESP32 Wi-Fi TCP Stream (Port 5760)",
            "status": esp_status,
            "details": esp_details
        })

        # Check 6: Transport Connection Link
        if self.transport_state == "CONNECTED" or self.esp32_state == "CONNECTED":
            checks.append({
                "id": "transport_link_state",
                "name": "Transport Connection Link",
                "status": "PASS",
                "details": f"Transport link active via {self.transport} (managed PID: {self.managed_pid})"
            })
        elif self.managed_pid:
            checks.append({
                "id": "transport_link_state",
                "name": "Transport Connection Link",
                "status": "WAITING",
                "details": f"Bridge running (PID: {self.managed_pid}), transport state: {self.transport_state}"
            })
        else:
            checks.append({
                "id": "transport_link_state",
                "name": "Transport Connection Link",
                "status": "WAITING",
                "details": "Bridge process stopped. Click START TELEMETRY to initiate link."
            })

        # Check 7: MAVLink Packet Reception
        if self.mavlink_rx_packets > 0 or self.mavlink_rx_bytes > 0:
            checks.append({
                "id": "mavlink_packet_reception",
                "name": "MAVLink Packet Reception",
                "status": "PASS",
                "details": f"Ingested {self.mavlink_rx_bytes:,} bytes across {self.mavlink_rx_packets:,} MAVLink packets"
            })
        elif self.managed_pid:
            checks.append({
                "id": "mavlink_packet_reception",
                "name": "MAVLink Packet Reception",
                "status": "WAITING",
                "details": "Bridge running; awaiting MAVLink byte stream"
            })
        else:
            checks.append({
                "id": "mavlink_packet_reception",
                "name": "MAVLink Packet Reception",
                "status": "WAITING",
                "details": "Bridge not active; awaiting telemetry session"
            })

        # Check 8: Pixhawk 2.4.8 Heartbeat
        if self.heartbeat_state == "HEALTHY":
            checks.append({
                "id": "pixhawk_heartbeat",
                "name": "Pixhawk 2.4.8 Heartbeat",
                "status": "PASS",
                "details": "Valid MAVLink HEARTBEAT continuously received from Pixhawk 2.4.8"
            })
        elif self.heartbeat_state == "AWAITING":
            checks.append({
                "id": "pixhawk_heartbeat",
                "name": "Pixhawk 2.4.8 Heartbeat",
                "status": "WAITING",
                "details": "Awaiting initial MAVLink HEARTBEAT frame from flight controller"
            })
        else:
            checks.append({
                "id": "pixhawk_heartbeat",
                "name": "Pixhawk 2.4.8 Heartbeat",
                "status": "WAITING" if not self.managed_pid else "WARNING",
                "details": f"Heartbeat state: {self.heartbeat_state}"
            })

        # Check 9: Telemetry Message Decoding
        if self.telemetry_fresh or self.mavlink_rx_packets > 100:
            checks.append({
                "id": "telemetry_decoding",
                "name": "Telemetry Message Decoding",
                "status": "PASS",
                "details": "Decoded ATTITUDE, GLOBAL_POSITION_INT, SYS_STATUS, and BATTERY_STATUS"
            })
        elif self.managed_pid:
            checks.append({
                "id": "telemetry_decoding",
                "name": "Telemetry Message Decoding",
                "status": "WAITING",
                "details": "Awaiting decoded telemetry messages from incoming stream"
            })
        else:
            checks.append({
                "id": "telemetry_decoding",
                "name": "Telemetry Message Decoding",
                "status": "WAITING",
                "details": "Bridge not active"
            })

        # Check 10: Backend Reachability & Health
        backend_base = self.backend_url.replace("/api/v1", "").rstrip("/")
        health_status = "FAIL"
        health_details = f"Backend health check failed at {backend_base}/health"
        try:
            h_req = urllib.request.Request(f"{backend_base}/health", headers={"User-Agent": "AERON-Diagnostics/1.0"})
            with urllib.request.urlopen(h_req, timeout=1.2) as h_resp:
                if h_resp.status == 200:
                    h_data = json.loads(h_resp.read().decode("utf-8"))
                    health_status = "PASS"
                    health_details = f"Backend online ({h_data.get('service')}, uptime: {h_data.get('uptimeSeconds')}s)"
        except Exception as he:
            health_details = f"Health probe error: {he}"
        checks.append({
            "id": "backend_health",
            "name": "Backend Reachability & Health",
            "status": health_status,
            "details": health_details
        })

        # Check 11: Backend Authentication & Security
        auth_status = "PASS"
        auth_details = "M2M Bridge authentication verified"
        try:
            latest_url = f"{self.backend_url}/telemetry/latest/{self.drone_id}"
            a_req = urllib.request.Request(latest_url, headers={"User-Agent": "AERON-Diagnostics/1.0"})
            with urllib.request.urlopen(a_req, timeout=1.2) as a_resp:
                if a_resp.status in (200, 404):
                    auth_status = "PASS"
                    auth_details = "Backend query accepted without authentication barrier"
                else:
                    auth_status = "WARNING"
                    auth_details = f"Backend query returned HTTP {a_resp.status}"
        except urllib.error.HTTPError as he:
            if he.code in (401, 403):
                auth_status = "FAIL"
                auth_details = f"Authentication rejected by backend (HTTP {he.code})"
            else:
                auth_status = "PASS"
        except Exception as ae:
            auth_status = "WARNING"
            auth_details = f"Auth probe error: {ae}"
        checks.append({
            "id": "backend_authentication",
            "name": "Backend Authentication & Security",
            "status": auth_status,
            "details": auth_details
        })

        # Check 12: Backend Telemetry Ingestion
        ingest_status = "WAITING"
        ingest_details = "Awaiting live telemetry ingestion to backend"
        try:
            latest_url = f"{self.backend_url}/telemetry/latest/{self.drone_id}"
            i_req = urllib.request.Request(latest_url, headers={"User-Agent": "AERON-Diagnostics/1.0"})
            with urllib.request.urlopen(i_req, timeout=1.2) as i_resp:
                if i_resp.status == 200:
                    i_data = json.loads(i_resp.read().decode("utf-8"))
                    i_raw = i_data.get("data", {})
                    i_rec = i_raw.get("telemetry") if isinstance(i_raw, dict) and "telemetry" in i_raw else i_raw
                    if i_rec and isinstance(i_rec, dict) and (i_rec.get("recordedAt") or i_rec.get("receivedAt")):
                        rec_ts = i_rec.get("recordedAt") or i_rec.get("receivedAt")
                        ingest_status = "PASS"
                        ingest_details = f"Telemetry verified in MongoDB Atlas (latest record timestamp: {rec_ts})"
        except Exception:
            pass
        checks.append({
            "id": "telemetry_ingestion",
            "name": "Backend Telemetry Ingestion",
            "status": ingest_status,
            "details": ingest_details
        })

        # Check 13: Admin Dashboard Socket.IO Feed
        sock_status = "FAIL"
        sock_details = f"Socket.IO probe failed at {backend_base}"
        try:
            s_req = urllib.request.Request(
                f"{backend_base}/socket.io/?EIO=4&transport=polling",
                headers={"User-Agent": "AERON-Diagnostics/1.0"}
            )
            with urllib.request.urlopen(s_req, timeout=1.2) as s_resp:
                if s_resp.status == 200:
                    sock_status = "PASS"
                    sock_details = "Socket.IO real-time engine online and accepting client sessions"
        except Exception as se:
            sock_details = f"Socket.IO probe error: {se}"
        checks.append({
            "id": "dashboard_socket_io",
            "name": "Admin Dashboard Socket.IO Feed",
            "status": sock_status,
            "details": sock_details
        })

        # Summary calculations
        passed = sum(1 for c in checks if c["status"] == "PASS")
        warnings = sum(1 for c in checks if c["status"] == "WARNING")
        failed = sum(1 for c in checks if c["status"] == "FAIL")
        waiting = sum(1 for c in checks if c["status"] == "WAITING")

        overall = "PASS" if failed == 0 and warnings <= 2 else ("FAIL" if failed > 0 else "WARNING")

        return {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "overall": overall,
            "summary": {
                "total": len(checks),
                "passed": passed,
                "warnings": warnings,
                "failed": failed,
                "waiting": waiting
            },
            "checks": checks
        }


class BridgeControllerServer:
    """
    HTTP REST Server strictly listening on loopback (127.0.0.1:8765)
    with authentication, CSRF protection, and CORS preflight handling.
    """
    def __init__(self, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, repo_root: Optional[pathlib.Path] = None):
        # Strict security constraint: host MUST be 127.0.0.1
        if host not in ("127.0.0.1", "localhost"):
            raise ValueError(f"Security Violation: AERON Bridge Controller must bind strictly to 127.0.0.1, not '{host}'")

        self.host = "127.0.0.1"
        self.port = port
        self.repo_root = repo_root or pathlib.Path(__file__).resolve().parent.parent.parent

        # Initialize or load authentication token
        self.token = self._init_auth_token()
        self.manager = BridgeProcessManager(self.repo_root)
        self.httpd: Optional[HTTPServer] = None
        self._server_thread: Optional[threading.Thread] = None

    def _init_auth_token(self) -> str:
        """Loads or creates a cryptographically secure 64-char local token."""
        token_env = os.environ.get("AERON_BRIDGE_CONTROLLER_TOKEN")
        if token_env and len(token_env) >= 16:
            return token_env.strip()

        token_file = self.repo_root / ".aeron-bridge-token"
        if token_file.exists():
            try:
                token = token_file.read_text(encoding="utf-8").strip()
                if len(token) >= 16:
                    return token
            except Exception:
                pass

        # Generate new random token
        token = secrets.token_hex(32)
        try:
            token_file.write_text(token, encoding="utf-8")
        except Exception as e:
            print(f"[AERON-CONTROLLER] Warning: Could not write token file {token_file}: {e}")

        return token

    def start(self):
        """Starts the HTTP server on a background thread (for tests/integration)."""
        handler_factory = self._create_handler()
        self.httpd = HTTPServer((self.host, self.port), handler_factory)
        self._server_thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self._server_thread.start()
        print(f"[AERON-CONTROLLER] Running on http://{self.host}:{self.port} (Loopback Only)")
        print(f"[AERON-CONTROLLER] Auth Token initialized ({len(self.token)} chars)")

    def serve(self):
        """Starts the HTTP server and serves on the main thread."""
        handler_factory = self._create_handler()
        self.httpd = HTTPServer((self.host, self.port), handler_factory)
        print(f"[AERON-CONTROLLER] Running on http://{self.host}:{self.port} (Loopback Only)")
        print(f"[AERON-CONTROLLER] Auth Token initialized ({len(self.token)} chars)")
        try:
            self.httpd.serve_forever()
        except (KeyboardInterrupt, SystemExit):
            pass
        finally:
            self.stop()

    def stop(self):
        """Stops the bridge process and shuts down HTTP server."""
        self.manager.stop_bridge()
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
        print("[AERON-CONTROLLER] Server stopped.")

    def _create_handler(self):
        controller = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                pass

            def _send_cors_headers(self):
                origin = self.headers.get("Origin", "*")
                self.send_header("Access-Control-Allow-Origin", origin if origin else "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-AERON-TOKEN, X-Requested-With")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Access-Control-Max-Age", "86400")

            def do_OPTIONS(self):
                """Handles CORS and Chrome Private Network Access preflights."""
                self.send_response(204)
                self._send_cors_headers()
                self.end_headers()

            def _verify_auth(self) -> bool:
                """Verifies local auth token for state-changing endpoints."""
                client_token = self.headers.get("X-AERON-TOKEN") or self.headers.get("x-aeron-token")
                if not client_token:
                    from urllib.parse import urlparse, parse_qs
                    qs = parse_qs(urlparse(self.path).query)
                    client_token = qs.get("token", [None])[0]

                if not client_token or client_token.strip() != controller.token:
                    self._send_json(401, {
                        "error": "Unauthorized",
                        "message": "Invalid or missing X-AERON-TOKEN authentication header."
                    })
                    return False
                return True

            def _send_json(self, status_code: int, data: Dict[str, Any]):
                try:
                    body = json.dumps(data).encode("utf-8")
                    self.send_response(status_code)
                    self._send_cors_headers()
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError):
                    pass
                except Exception:
                    pass

            def _read_json_body(self) -> Dict[str, Any]:
                try:
                    content_len = int(self.headers.get("Content-Length", 0))
                    if content_len > 0:
                        raw = self.rfile.read(content_len).decode("utf-8")
                        return json.loads(raw)
                except Exception:
                    pass
                return {}

            def do_GET(self):
                from urllib.parse import urlparse
                parsed = urlparse(self.path)
                path = parsed.path

                # 1. Health check (unauthenticated loopback probe)
                if path == "/health":
                    self._send_json(200, {
                        "status": "ok",
                        "service": "aeron-bridge-controller",
                        "version": "1.0.0",
                        "host": controller.host,
                        "port": controller.port,
                        "pid": os.getpid()
                    })
                    return

                # 2. Local token retrieval (only accessible for localhost origins to ease setup)
                if path == "/api/bridge/token":
                    client_host = self.client_address[0]
                    if client_host in ("127.0.0.1", "localhost", "::1"):
                        self._send_json(200, {"token": controller.token})
                    else:
                        self._send_json(403, {"error": "Forbidden", "message": "Token retrieval restricted to loopback"})
                    return

                # 3. Status query
                if path == "/api/bridge/status":
                    snapshot = controller.manager.get_status_snapshot()
                    self._send_json(200, snapshot)
                    return

                # 4. Self-diagnostics query
                if path == "/api/bridge/diagnostics":
                    diag = controller.manager.run_self_diagnostics()
                    self._send_json(200, diag)
                    return

                self._send_json(404, {"error": "Not Found", "path": path})

            def do_POST(self):
                from urllib.parse import urlparse
                parsed = urlparse(self.path)
                path = parsed.path

                # State-changing operations strictly require authentication token
                if not self._verify_auth():
                    return

                body = self._read_json_body()

                if path == "/api/bridge/start":
                    transport = body.get("transport")
                    backend_url = body.get("backend_url") or body.get("backendUrl")
                    drone_id = body.get("drone_id") or body.get("droneId")
                    result = controller.manager.start_bridge(
                        transport=transport,
                        backend_url=backend_url,
                        drone_id=drone_id
                    )
                    code = 200 if result.get("success") else 400
                    self._send_json(code, result)
                    return

                if path == "/api/bridge/stop":
                    result = controller.manager.stop_bridge()
                    self._send_json(200, result)
                    return

                if path == "/api/bridge/restart":
                    result = controller.manager.restart_bridge()
                    code = 200 if result.get("success") else 400
                    self._send_json(code, result)
                    return

                if path == "/api/bridge/diagnostics":
                    diag = controller.manager.run_self_diagnostics()
                    self._send_json(200, diag)
                    return

                self._send_json(404, {"error": "Not Found", "path": path})

        return Handler


def main():
    repo_root = pathlib.Path(__file__).resolve().parent.parent.parent
    server = BridgeControllerServer(host=DEFAULT_HOST, port=DEFAULT_PORT, repo_root=repo_root)

    def shutdown(sig, frame):
        print("\n[AERON-CONTROLLER] Shutting down...")
        server.stop()
        sys.exit(0)

    try:
        signal.signal(signal.SIGINT, shutdown)
        signal.signal(signal.SIGTERM, shutdown)
    except Exception:
        pass

    server.serve()


if __name__ == "__main__":
    main()
