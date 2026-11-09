import time
import logging
from typing import Optional, Any
from pymavlink import mavutil
from ..config import config
from ..logging_config import setup_logging

logger = setup_logging("MAVLINK-CONN")

class MAVLinkConnection:
    """
    Manages physical or simulated serial/network MAVLink communication with Pixhawk 2.4.8.
    Strictly READ-ONLY: No outbound commands, arming requests, or parameter modification.
    """

    def __init__(
        self,
        connection_string: Optional[str] = None,
        baud: Optional[int] = None,
        heartbeat_timeout: Optional[float] = None
    ):
        self.connection_string = connection_string or config.mavlink_connection
        self.baud = baud or config.mavlink_baud
        self.heartbeat_timeout = heartbeat_timeout or config.heartbeat_timeout_seconds

        self.mav: Optional[mavutil.mavfile] = None
        self.is_port_open: bool = False
        self.last_heartbeat_time: Optional[float] = None
        self.system_id: Optional[int] = None
        self.component_id: Optional[int] = None
        self.autopilot_type: Optional[str] = None
        self.vehicle_type: Optional[str] = None

    def connect(self) -> bool:
        """
        Attempts to open the configured connection device (e.g., COM port or UDP stream).
        Does not perform arbitrary port scanning.
        """
        try:
            logger.info(f"Opening MAVLink interface on {self.connection_string} (baud: {self.baud})...")
            self.mav = mavutil.mavlink_connection(
                self.connection_string,
                baud=self.baud,
                autoreconnect=True
            )
            self.is_port_open = True
            logger.info(f"MAVLink port {self.connection_string} opened successfully. Awaiting valid HEARTBEAT...")
            return True
        except Exception as err:
            self.is_port_open = False
            self.mav = None
            logger.warning(f"Failed to open MAVLink port '{self.connection_string}': {err}")
            return False

    def is_heartbeat_alive(self) -> bool:
        """Checks if a valid flight-controller heartbeat has been received within timeout."""
        if not self.is_port_open or self.last_heartbeat_time is None:
            return False
        return (time.time() - self.last_heartbeat_time) <= self.heartbeat_timeout

    def record_heartbeat(self, msg: Any):
        """Updates internal heartbeat state and FC identifiers."""
        self.last_heartbeat_time = time.time()
        self.system_id = getattr(msg, "get_srcSystem", lambda: getattr(msg, "sysid", None))()
        self.component_id = getattr(msg, "get_srcComponent", lambda: getattr(msg, "compid", None))()

    def receive_message(self) -> Optional[Any]:
        """
        Polls for the next available MAVLink message without blocking.
        Returns the parsed MAVLink message object, or None if no message is queued.
        """
        if not self.mav:
            return None

        try:
            msg = self.mav.recv_match(blocking=False)
            return msg
        except Exception as err:
            logger.debug(f"Error receiving MAVLink packet: {err}")
            return None

    def close(self):
        """Closes the MAVLink connection cleanly."""
        if self.mav:
            try:
                self.mav.close()
            except Exception:
                pass
            self.mav = None
        self.is_port_open = False
        self.last_heartbeat_time = None
        logger.info(f"Closed MAVLink interface {self.connection_string}")

