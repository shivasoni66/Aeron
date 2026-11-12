from typing import Optional, Dict, Any
from .base import TelemetryProvider, CameraProvider, LocationProvider
from ..mavlink.connection import MAVLinkConnection
from ..mavlink.parser import MAVLinkParser
from ..mavlink.health import SubsystemHealthTracker
from ..mavlink.telemetry import TelemetryAggregator
from ..camera.config import CameraConfig
from ..camera.health import CameraHealthTracker
from ..camera.frame_reader import ESP32CameraReader
from ..camera.models import CameraFrame

class MavlinkTelemetryProvider(TelemetryProvider):
    """Acquires real telemetry from Pixhawk 2.4.8 over MAVLink 2.0 (read-only)."""

    def __init__(self, connection_string: str, baud_rate: int = 57600, drone_id: str = "AERON-HEX-01"):
        self.connection_string = connection_string
        self.baud_rate = baud_rate
        self.drone_id = drone_id
        self.conn = MAVLinkConnection(connection_string, baud_rate)
        self.health = SubsystemHealthTracker()
        self.aggregator = TelemetryAggregator(drone_id=drone_id, health=self.health)

    @property
    def data_source(self) -> str:
        return "REAL_HARDWARE"

    def connect(self) -> bool:
        return self.conn.connect()

    def disconnect(self):
        self.conn.close()

    def read_telemetry(self) -> Optional[Dict[str, Any]]:
        msg = self.conn.receive_message()
        while msg:
            msg_type = msg.get_type()
            parsed = None
            if msg_type == "HEARTBEAT":
                self.conn.record_heartbeat(msg)
                parsed = MAVLinkParser.parse_heartbeat(msg)
            elif msg_type == "GLOBAL_POSITION_INT":
                parsed = MAVLinkParser.parse_global_position_int(msg)
            elif msg_type == "GPS_RAW_INT":
                parsed = MAVLinkParser.parse_gps_raw_int(msg)
            elif msg_type == "SYS_STATUS":
                parsed = MAVLinkParser.parse_sys_status(msg)
            elif msg_type == "BATTERY_STATUS":
                parsed = MAVLinkParser.parse_battery_status(msg)
            elif msg_type == "ATTITUDE":
                parsed = MAVLinkParser.parse_attitude(msg)

            if parsed:
                self.aggregator.update_from_message(parsed)
            msg = self.conn.receive_message()

        snap = self.aggregator.snapshot()
        snap["source"] = "REAL"
        snap["isSimulated"] = False
        return snap

    def get_status(self) -> Dict[str, Any]:
        return {
            "dataSource": self.data_source,
            "connected": self.conn.is_connected,
            "port": self.connection_string,
            "baud": self.baud_rate,
            "heartbeatStatus": self.health.pixhawk_heartbeat_status
        }


class ESP32CameraProvider(CameraProvider):
    """Acquires real video frames from physical ESP32-CAM HTTP endpoint."""

    def __init__(self, config: CameraConfig):
        self.config = config
        self.health = CameraHealthTracker()
        self.reader = ESP32CameraReader(config, self.health)

    @property
    def data_source(self) -> str:
        return "REAL_HARDWARE"

    def connect(self) -> bool:
        return True

    def disconnect(self):
        pass

    def capture_frame(
        self,
        telemetry_lat: Optional[float] = None,
        telemetry_lon: Optional[float] = None,
        telemetry_alt: Optional[float] = None,
        telemetry_heading: Optional[float] = None
    ) -> Optional[CameraFrame]:
        return self.reader.capture_frame(
            telemetry_lat=telemetry_lat,
            telemetry_lon=telemetry_lon,
            telemetry_alt=telemetry_alt,
            telemetry_heading=telemetry_heading
        )

    def get_status(self) -> Dict[str, Any]:
        snap = self.health.snapshot()
        snap["dataSource"] = self.data_source
        return snap


class HardwareGpsProvider(LocationProvider):
    """Extracts GNSS lock from the MAVLink telemetry provider."""

    def __init__(self, mavlink_provider: MavlinkTelemetryProvider):
        self.mavlink_provider = mavlink_provider

    @property
    def data_source(self) -> str:
        return "REAL_HARDWARE"

    def get_location(self) -> Optional[Dict[str, Any]]:
        snap = self.mavlink_provider.aggregator.snapshot()
        lat = snap.get("latitude")
        lon = snap.get("longitude")
        if lat is not None and lon is not None:
            return {
                "latitude": lat,
                "longitude": lon,
                "altitude": snap.get("altitude"),
                "heading": snap.get("heading"),
                "fixType": snap.get("gpsFixType", "3D_FIX"),
                "dataSource": self.data_source
            }
        return None

