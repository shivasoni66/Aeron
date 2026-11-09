from datetime import datetime, timezone
from typing import Dict, Any, Optional
from ..config import config
from .health import SubsystemHealthTracker

class TelemetryAggregator:
    """
    Maintains an authoritative normalized vehicle state by aggregating incoming
    MAVLink messages and transforming them to the backend TelemetryRecord schema.
    """

    def __init__(
        self,
        drone_id: Optional[str] = None,
        source: Optional[str] = None,
        health_tracker: Optional[SubsystemHealthTracker] = None
    ):
        self.drone_id = drone_id or config.drone_id
        self.source = (source or config.mavlink_source).upper()
        self.is_simulated = self.source != "REAL"
        self.health = health_tracker or SubsystemHealthTracker()

        # Telemetry state
        self.armed: bool = False
        self.flight_mode: str = "STANDBY"
        self.latitude: Optional[float] = None
        self.longitude: Optional[float] = None
        self.altitude: Optional[float] = None
        self.relative_altitude: Optional[float] = None
        self.ground_speed: Optional[float] = None
        self.heading: Optional[float] = None
        self.gps_fix_type: str = "NO_FIX"
        self.satellites: Optional[int] = None
        self.hdop: Optional[float] = None
        self.battery_voltage: Optional[float] = None
        self.battery_current: Optional[float] = None
        self.battery_percentage: Optional[int] = None
        self.sensor_health: Dict[str, Any] = {}
        self.last_update_iso: Optional[str] = None

    def update_from_message(self, parsed: Dict[str, Any]):
        """Integrates a parsed MAVLink message into the vehicle state."""
        msg_type = parsed.get("type")
        self.health.record_telemetry_packet()

        if msg_type == "HEARTBEAT":
            self.armed = parsed["armed"]
            self.flight_mode = parsed["flightMode"]
            self.health.record_heartbeat()

        elif msg_type == "GLOBAL_POSITION_INT":
            if parsed.get("latitude") is not None:
                self.latitude = parsed["latitude"]
                self.longitude = parsed["longitude"]
            if parsed.get("altitude") is not None:
                self.altitude = parsed["altitude"]
            if parsed.get("relativeAltitude") is not None:
                self.relative_altitude = parsed["relativeAltitude"]
            if parsed.get("groundSpeed") is not None:
                self.ground_speed = parsed["groundSpeed"]
            if parsed.get("heading") is not None:
                self.heading = parsed["heading"]

        elif msg_type == "GPS_RAW_INT":
            self.gps_fix_type = parsed.get("gpsFixType", "NO_FIX")
            self.satellites = parsed.get("satellites")
            self.hdop = parsed.get("hdop")
            self.health.record_gps_state(self.gps_fix_type, self.satellites or 0, self.hdop)
            # If GLOBAL_POSITION_INT hasn't populated coordinates yet, use raw if valid
            if self.latitude is None and parsed.get("latitude") is not None:
                self.latitude = parsed["latitude"]
                self.longitude = parsed["longitude"]

        elif msg_type in ("SYS_STATUS", "BATTERY_STATUS"):
            if parsed.get("batteryVoltage") is not None:
                self.battery_voltage = parsed["batteryVoltage"]
            if parsed.get("batteryCurrent") is not None:
                self.battery_current = parsed["batteryCurrent"]
            if parsed.get("batteryPercentage") is not None:
                self.battery_percentage = parsed["batteryPercentage"]
            if parsed.get("sensorHealth"):
                self.sensor_health = parsed["sensorHealth"]

        elif msg_type == "ATTITUDE":
            # Heading can be supplemented by yaw if not provided by GPS/compass
            if self.heading is None and parsed.get("yaw") is not None:
                self.heading = parsed["yaw"]

        self.last_update_iso = datetime.now(timezone.utc).isoformat()

    def snapshot(self) -> Dict[str, Any]:
        """Constructs a normalized telemetry record ready for backend HTTP ingestion."""
        now_iso = datetime.now(timezone.utc).isoformat()
        heartbeat_status = self.health.pixhawk_heartbeat_status

        connection_status = "CONNECTED" if heartbeat_status == "HEALTHY" else "STANDBY"

        return {
            "droneId": self.drone_id,
            "recordedAt": now_iso,
            "source": self.source,
            "isSimulated": self.is_simulated,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "altitude": self.altitude,
            "relativeAltitude": self.relative_altitude,
            "groundSpeed": self.ground_speed,
            "heading": self.heading,
            "gpsFixType": self.gps_fix_type,
            "satellites": self.satellites,
            "hdop": self.hdop,
            "batteryVoltage": self.battery_voltage,
            "batteryCurrent": self.battery_current,
            "batteryPercentage": self.battery_percentage,
            "flightMode": self.flight_mode,
            "armed": self.armed,
            "sensorHealth": self.sensor_health,
            "connectionStatus": connection_status
        }

