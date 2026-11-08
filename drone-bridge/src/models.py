from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Optional, Dict, Any

@dataclass
class ConnectionTelemetry:
    status: str
    heartbeat_age_ms: int

@dataclass
class FlightTelemetry:
    armed: bool
    flight_mode: str
    system_status: str

@dataclass
class GPSTelemetry:
    latitude: float
    longitude: float
    altitude_msl: float
    relative_altitude: float
    fix_type: str
    satellites_visible: int
    hdop: float

@dataclass
class DynamicsTelemetry:
    ground_speed: float
    heading: float
    vertical_speed: float
    roll_deg: float
    pitch_deg: float
    yaw_deg: float

@dataclass
class BatteryTelemetry:
    voltage: float
    current: float
    remaining_percentage: int

@dataclass
class SimulatedTelemetryPayload:
    drone_id: str
    timestamp: str
    source: str = "simulation"
    is_simulated: bool = True
    connection: Optional[ConnectionTelemetry] = None
    flight: Optional[FlightTelemetry] = None
    gps: Optional[GPSTelemetry] = None
    dynamics: Optional[DynamicsTelemetry] = None
    battery: Optional[BatteryTelemetry] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert the telemetry structure into camelCase dictionary for JSON transport."""
        data = asdict(self)
        return {
            "droneId": data["drone_id"],
            "source": "simulation",
            "isSimulated": True,
            "timestamp": data["timestamp"],
            "connection": {
                "status": data["connection"]["status"],
                "heartbeatAgeMs": data["connection"]["heartbeat_age_ms"]
            } if data["connection"] else None,
            "flight": {
                "armed": data["flight"]["armed"],
                "flightMode": data["flight"]["flight_mode"],
                "systemStatus": data["flight"]["system_status"]
            } if data["flight"] else None,
            "gps": {
                "latitude": data["gps"]["latitude"],
                "longitude": data["gps"]["longitude"],
                "altitudeMsl": data["gps"]["altitude_msl"],
                "relativeAltitude": data["gps"]["relative_altitude"],
                "fixType": data["gps"]["fix_type"],
                "satellitesVisible": data["gps"]["satellites_visible"],
                "hdop": data["gps"]["hdop"]
            } if data["gps"] else None,
            "dynamics": {
                "groundSpeed": data["dynamics"]["ground_speed"],
                "heading": data["dynamics"]["heading"],
                "verticalSpeed": data["dynamics"]["vertical_speed"],
                "rollDeg": data["dynamics"]["roll_deg"],
                "pitchDeg": data["dynamics"]["pitch_deg"],
                "yawDeg": data["dynamics"]["yaw_deg"]
            } if data["dynamics"] else None,
            "battery": {
                "voltage": data["battery"]["voltage"],
                "current": data["battery"]["current"],
                "remainingPercentage": data["battery"]["remaining_percentage"]
            } if data["battery"] else None
        }

