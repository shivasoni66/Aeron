from typing import Optional, Dict, Any
from .base import TelemetryProvider, CameraProvider, LocationProvider
from ..simulator import DroneTelemetrySimulator
from ..camera.config import CameraConfig
from ..camera.health import CameraHealthTracker
from ..camera.frame_reader import ESP32CameraReader
from ..camera.models import CameraFrame

class SimulationTelemetryProvider(TelemetryProvider):
    """Generates contract-valid simulated flight telemetry without physical hardware."""

    def __init__(
        self,
        drone_id: str = "AERON-HEX-01",
        rate_hz: float = 5.0,
        base_lat: float = 12.9716,
        base_lon: float = 77.5946,
        base_alt: float = 42.4,
        scenario: str = "SLOW_ROUTE"
    ):
        self.simulator = DroneTelemetrySimulator(
            drone_id=drone_id,
            rate_hz=rate_hz,
            base_lat=base_lat,
            base_lon=base_lon,
            base_alt=base_alt,
            scenario=scenario
        )

    @property
    def data_source(self) -> str:
        return "SIMULATION"

    def connect(self) -> bool:
        self.simulator.start()
        return True

    def disconnect(self):
        self.simulator.stop()

    def read_telemetry(self) -> Optional[Dict[str, Any]]:
        snapshot = self.simulator.generate_snapshot()
        payload = snapshot.to_dict()
        gps = payload.get("gps") or {}
        dynamics = payload.get("dynamics") or {}
        battery = payload.get("battery") or {}
        flight = payload.get("flight") or {}
        connection = payload.get("connection") or {}

        return {
            "droneId": payload.get("droneId", self.simulator.drone_id),
            "recordedAt": payload.get("timestamp"),
            "source": "SIMULATION",
            "isSimulated": True,
            "latitude": gps.get("latitude"),
            "longitude": gps.get("longitude"),
            "altitude": gps.get("altitudeMsl"),
            "relativeAltitude": gps.get("relativeAltitude"),
            "groundSpeed": dynamics.get("groundSpeed"),
            "heading": dynamics.get("heading"),
            "gpsFixType": gps.get("fixType"),
            "satellites": gps.get("satellitesVisible"),
            "hdop": gps.get("hdop"),
            "batteryVoltage": battery.get("voltage"),
            "batteryCurrent": battery.get("current"),
            "batteryPercentage": battery.get("remainingPercentage"),
            "flightMode": flight.get("flightMode"),
            "armed": flight.get("armed", False),
            "connectionStatus": connection.get("status", "CONNECTED")
        }

    def get_status(self) -> Dict[str, Any]:
        sim_status = self.simulator.get_status()
        sim_status["dataSource"] = self.data_source
        return sim_status


class SimulationCameraProvider(CameraProvider):
    """Generates contract-valid test JPEG frames with simulated HUD overlay."""

    def __init__(self, drone_id: str = "AERON-HEX-01", target_fps: float = 1.0):
        cfg = CameraConfig(
            drone_id=drone_id,
            enabled=True,
            protocol="MOCK",
            target_fps=target_fps
        )
        self.health = CameraHealthTracker(drone_id=drone_id)
        self.reader = ESP32CameraReader(cfg, self.health)
        self.drone_id = drone_id
        self._connected = False

    @property
    def data_source(self) -> str:
        return "SIMULATION"

    def connect(self) -> bool:
        self._connected = True
        return True

    def disconnect(self):
        self._connected = False

    def capture_frame(
        self,
        telemetry_lat: Optional[float] = None,
        telemetry_lon: Optional[float] = None,
        telemetry_alt: Optional[float] = None,
        telemetry_heading: Optional[float] = None
    ) -> Optional[CameraFrame]:
        if not self._connected:
            return None
        return self.reader.capture_frame(
            telemetry_lat=telemetry_lat,
            telemetry_lon=telemetry_lon,
            telemetry_alt=telemetry_alt,
            telemetry_heading=telemetry_heading,
            telemetry_age_seconds=0.05
        )

    def get_status(self) -> Dict[str, Any]:
        snap = self.health.snapshot()
        snap["dataSource"] = self.data_source
        snap["protocol"] = "SYNTHETIC_HUD_BENCH"
        return snap


class SimulationLocationProvider(LocationProvider):
    """Provides simulated GPS position from the telemetry simulator."""

    def __init__(self, telemetry_provider: SimulationTelemetryProvider):
        self.telemetry_provider = telemetry_provider

    @property
    def data_source(self) -> str:
        return "SIMULATION"

    def get_location(self) -> Optional[Dict[str, Any]]:
        pos = self.telemetry_provider.simulator.get_current_position()
        return {
            "latitude": pos[0],
            "longitude": pos[1],
            "altitude": pos[2],
            "heading": pos[3],
            "fixType": "3D DGPS FIX",
            "dataSource": self.data_source
        }
