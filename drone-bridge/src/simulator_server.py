import json
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Optional

from .simulator import DroneTelemetrySimulator, SCENARIOS
from .camera.config import CameraConfig
from .camera.health import CameraHealthTracker
from .camera.frame_reader import ESP32CameraReader

logger = logging.getLogger("AERON-SIMULATOR-SERVER")

class SimulatorServerHandler(BaseHTTPRequestHandler):
    """HTTP request handler for local drone simulator control and introspection."""

    simulator: Optional[DroneTelemetrySimulator] = None
    camera_reader: Optional[ESP32CameraReader] = None

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body_json(self) -> dict:
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        try:
            return json.loads(self.rfile.read(content_len).decode("utf-8"))
        except Exception:
            return {}

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path

        if path in ("/api/simulation/status", "/api/v1/simulation/status"):
            if not self.simulator:
                return self._send_json(503, {"error": "Simulator not initialized"})
            return self._send_json(200, self.simulator.get_status())

        elif path in ("/api/simulation/telemetry", "/api/v1/simulation/telemetry"):
            if not self.simulator:
                return self._send_json(503, {"error": "Simulator not initialized"})
            pos = self.simulator.get_current_position()
            return self._send_json(200, {
                "droneId": self.simulator.drone_id,
                "currentPosition": {
                    "latitude": pos[0],
                    "longitude": pos[1],
                    "altitude": pos[2],
                    "heading": pos[3]
                },
                "history": self.simulator.get_telemetry_history(30)
            })

        elif path in ("/api/camera/test-frame", "/api/v1/camera/test-frame"):
            if not self.camera_reader:
                cfg = CameraConfig(drone_id="AERON-HEX-01", protocol="MOCK")
                self.__class__.camera_reader = ESP32CameraReader(cfg, CameraHealthTracker(drone_id="AERON-HEX-01"))

            pos = self.simulator.get_current_position() if self.simulator else (12.9716, 77.5946, 42.4, 0.0)
            raw_jpeg = self.camera_reader.generate_synthetic_frame(
                drone_id="AERON-HEX-01",
                lat=pos[0],
                lon=pos[1],
                alt=pos[2]
            )
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(raw_jpeg)))
            self.end_headers()
            self.wfile.write(raw_jpeg)
            return

        elif path == "/health":
            return self._send_json(200, {"status": "ok", "service": "AERON-SIMULATOR-SERVER"})

        else:
            return self._send_json(404, {"error": f"Endpoint '{path}' not found"})

    def do_POST(self):
        url = urlparse(self.path)
        path = url.path

        if not self.simulator:
            return self._send_json(503, {"error": "Simulator not initialized"})

        body = self._read_body_json()

        if path in ("/api/simulation/start", "/api/v1/simulation/start"):
            self.simulator.start()
            return self._send_json(200, {"message": "Simulation started", "status": self.simulator.get_status()})

        elif path in ("/api/simulation/pause", "/api/v1/simulation/pause"):
            self.simulator.pause()
            return self._send_json(200, {"message": "Simulation paused", "status": self.simulator.get_status()})

        elif path in ("/api/simulation/resume", "/api/v1/simulation/resume"):
            self.simulator.resume()
            return self._send_json(200, {"message": "Simulation resumed", "status": self.simulator.get_status()})

        elif path in ("/api/simulation/stop", "/api/v1/simulation/stop"):
            self.simulator.stop()
            return self._send_json(200, {"message": "Simulation stopped", "status": self.simulator.get_status()})

        elif path in ("/api/simulation/reset", "/api/v1/simulation/reset"):
            self.simulator.reset()
            return self._send_json(200, {"message": "Simulation reset to baseline", "status": self.simulator.get_status()})

        elif path in ("/api/simulation/scenario", "/api/v1/simulation/scenario"):
            scenario = body.get("scenario")
            if not scenario:
                return self._send_json(400, {"error": "Field 'scenario' is required", "available": SCENARIOS})
            success = self.simulator.select_scenario(scenario)
            if success:
                return self._send_json(200, {"message": f"Scenario changed to {scenario}", "status": self.simulator.get_status()})
            else:
                return self._send_json(400, {"error": f"Invalid scenario '{scenario}'", "available": SCENARIOS})

        elif path in ("/api/simulation/interval", "/api/v1/simulation/interval"):
            rate_hz = body.get("rateHz") or body.get("rate_hz")
            if not rate_hz:
                return self._send_json(400, {"error": "Field 'rateHz' is required"})
            try:
                self.simulator.set_rate_hz(float(rate_hz))
                return self._send_json(200, {"message": f"Rate set to {self.simulator.rate_hz} Hz", "status": self.simulator.get_status()})
            except Exception as e:
                return self._send_json(400, {"error": str(e)})

        else:
            return self._send_json(404, {"error": f"Endpoint '{path}' not found"})

    def log_message(self, format, *args):
        # Quiet default access log to avoid flooding console during polling
        pass


def start_simulator_http_server(
    simulator: DroneTelemetrySimulator,
    port: int = 5050,
    host: str = "127.0.0.1",
    camera_reader: Optional[ESP32CameraReader] = None
) -> HTTPServer:
    """Spawns background HTTP server for local simulator control."""
    SimulatorServerHandler.simulator = simulator
    SimulatorServerHandler.camera_reader = camera_reader

    server = HTTPServer((host, port), SimulatorServerHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info(f"Simulator Control HTTP API listening on http://{host}:{port}")
    return server
