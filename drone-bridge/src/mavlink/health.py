import time
from typing import Dict, Any, Optional
from ..config import config

class SubsystemHealthTracker:
    """
    Maintains discrete, decoupled health indicators across all aircraft subsystems.
    Strictly prevents combining separate hardware signals into a false unified status.
    """

    def __init__(self, heartbeat_timeout: Optional[float] = None):
        self.heartbeat_timeout = heartbeat_timeout or config.heartbeat_timeout_seconds

        # Individual subsystem states
        self.serial_port_status: str = "CLOSED"
        self.last_heartbeat_timestamp: Optional[float] = None
        self.last_telemetry_timestamp: Optional[float] = None
        self.last_backend_success_timestamp: Optional[float] = None

        self.gps_fix_type: str = "NO_FIX"
        self.satellites: int = 0
        self.hdop: Optional[float] = None

        self.backend_status: str = "UNTESTED"
        self.camera_status: str = "NOT_CONNECTED"

    def record_port_state(self, open_success: bool):
        self.serial_port_status = "OPEN" if open_success else "FAILED"

    def record_heartbeat(self):
        self.last_heartbeat_timestamp = time.time()

    def record_telemetry_packet(self):
        self.last_telemetry_timestamp = time.time()

    def record_backend_delivery(self, success: bool):
        if success:
            self.backend_status = "ONLINE"
            self.last_backend_success_timestamp = time.time()
        else:
            self.backend_status = "RETRYING"

    def record_gps_state(self, fix_type: str, sats: int, hdop: Optional[float]):
        self.gps_fix_type = fix_type
        self.satellites = sats
        self.hdop = hdop

    @property
    def pixhawk_heartbeat_status(self) -> str:
        """Determines Pixhawk flight-controller state based strictly on heartbeat recency."""
        if self.serial_port_status != "OPEN":
            return "PORT_NOT_OPEN"
        if self.last_heartbeat_timestamp is None:
            return "AWAITING_FIRST_HEARTBEAT"

        elapsed = time.time() - self.last_heartbeat_timestamp
        if elapsed <= self.heartbeat_timeout:
            return "HEALTHY"
        elif elapsed <= (self.heartbeat_timeout * 3):
            return "STALE"
        else:
            return "DISCONNECTED"

    @property
    def telemetry_freshness(self) -> str:
        """Determines freshness of streaming telemetry frames."""
        if self.last_telemetry_timestamp is None:
            return "NO_DATA"
        elapsed = time.time() - self.last_telemetry_timestamp
        if elapsed <= 2.0:
            return "FRESH"
        elif elapsed <= 10.0:
            return "STALE"
        else:
            return "EXPIRED"

    def snapshot(self) -> Dict[str, Any]:
        """Returns the decoupled health breakdown for all 6 discrete subsystems."""
        return {
            "serialPort": self.serial_port_status,
            "pixhawkFC": self.pixhawk_heartbeat_status,
            "gpsFix": self.gps_fix_type,
            "satellites": self.satellites,
            "telemetryFreshness": self.telemetry_freshness,
            "backendTransport": self.backend_status,
            "cameraModule": self.camera_status,
            "heartbeatAgeSeconds": (
                round(time.time() - self.last_heartbeat_timestamp, 2)
                if self.last_heartbeat_timestamp else None
            )
        }

