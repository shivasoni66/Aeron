from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class TelemetryProvider(ABC):
    """Abstract base class for telemetry providers (simulation and MAVLink hardware)."""

    @abstractmethod
    def connect(self) -> bool:
        """Establishes connection to telemetry source."""
        pass

    @abstractmethod
    def disconnect(self):
        """Disconnects from telemetry source."""
        pass

    @abstractmethod
    def read_telemetry(self) -> Optional[Dict[str, Any]]:
        """Reads latest normalized telemetry dictionary."""
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Returns provider connectivity and health status."""
        pass

    @property
    @abstractmethod
    def data_source(self) -> str:
        """Returns data source provenance: 'SIMULATION' or 'REAL_HARDWARE'."""
        pass


class CameraProvider(ABC):
    """Abstract base class for video/camera providers (synthetic test frame and ESP32-CAM)."""

    @abstractmethod
    def connect(self) -> bool:
        """Initializes camera feed link."""
        pass

    @abstractmethod
    def disconnect(self):
        """Terminates camera feed link."""
        pass

    @abstractmethod
    def capture_frame(
        self,
        telemetry_lat: Optional[float] = None,
        telemetry_lon: Optional[float] = None,
        telemetry_alt: Optional[float] = None,
        telemetry_heading: Optional[float] = None
    ) -> Optional[Any]:
        """Captures a single camera frame."""
        pass

    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """Returns camera provider operational status."""
        pass

    @property
    @abstractmethod
    def data_source(self) -> str:
        """Returns data source provenance: 'SIMULATION' or 'REAL_HARDWARE'."""
        pass


class LocationProvider(ABC):
    """Abstract base class for positioning providers."""

    @abstractmethod
    def get_location(self) -> Optional[Dict[str, Any]]:
        """Returns current coordinates, altitude, and fix type."""
        pass

    @property
    @abstractmethod
    def data_source(self) -> str:
        """Returns data source provenance: 'SIMULATION' or 'REAL_HARDWARE'."""
        pass

