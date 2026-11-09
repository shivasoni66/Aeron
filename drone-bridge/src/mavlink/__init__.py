"""
AERON MAVLink Telemetry Bridge Package
Provides read-only MAVLink communication with Pixhawk 2.4.8 autopilots.
"""
from .connection import MAVLinkConnection
from .parser import MAVLinkParser
from .telemetry import TelemetryAggregator
from .health import SubsystemHealthTracker

__all__ = [
    "MAVLinkConnection",
    "MAVLinkParser",
    "TelemetryAggregator",
    "SubsystemHealthTracker"
]

