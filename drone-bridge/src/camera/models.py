from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any
from datetime import datetime, timezone

@dataclass
class CameraFrame:
    """Represents a validated video frame captured from the ESP32-CAM."""
    drone_id: str
    device_id: str
    captured_at: str
    frame_base64: str
    mime_type: str = "image/jpeg"
    width: Optional[int] = None
    height: Optional[int] = None
    size_bytes: int = 0
    telemetry_lat: Optional[float] = None
    telemetry_lon: Optional[float] = None
    telemetry_alt: Optional[float] = None
    telemetry_heading: Optional[float] = None
    telemetry_age_seconds: Optional[float] = None

    def to_backend_dict(self) -> Dict[str, Any]:
        """Serializes the frame into the camelCase JSON format expected by AERON backend."""
        d = {
            "droneId": self.drone_id,
            "deviceId": self.device_id,
            "capturedAt": self.captured_at,
            "frameBase64": self.frame_base64,
            "mimeType": self.mime_type,
            "sizeBytes": self.size_bytes
        }
        if self.width is not None:
            d["width"] = self.width
        if self.height is not None:
            d["height"] = self.height
        if self.telemetry_lat is not None:
            d["telemetryLat"] = self.telemetry_lat
        if self.telemetry_lon is not None:
            d["telemetryLon"] = self.telemetry_lon
        if self.telemetry_alt is not None:
            d["telemetryAlt"] = self.telemetry_alt
        if self.telemetry_heading is not None:
            d["telemetryHeading"] = self.telemetry_heading
        if self.telemetry_age_seconds is not None:
            d["telemetryAgeSeconds"] = self.telemetry_age_seconds
        return d

@dataclass
class CameraStatus:
    """Authoritative operational health status of the ESP32-CAM subsystem."""
    drone_id: str
    device_id: str
    installed: bool = False
    reachable: bool = False
    streaming: bool = False
    fps: float = 0.0
    last_frame_at: Optional[str] = None
    resolution: Optional[str] = None
    rssi: Optional[int] = None
    ip_address: Optional[str] = None
    error_message: Optional[str] = None
    recorded_at: Optional[str] = None

    def to_backend_dict(self) -> Dict[str, Any]:
        """Serializes camera health into the camelCase JSON format expected by AERON backend."""
        d = {
            "droneId": self.drone_id,
            "deviceId": self.device_id,
            "installed": self.installed,
            "reachable": self.reachable,
            "streaming": self.streaming,
            "fps": round(self.fps, 2),
            "recordedAt": self.recorded_at or datetime.now(timezone.utc).isoformat()
        }
        if self.last_frame_at:
            d["lastFrameAt"] = self.last_frame_at
        if self.resolution:
            d["resolution"] = self.resolution
        if self.rssi is not None:
            d["rssi"] = self.rssi
        if self.ip_address:
            d["ipAddress"] = self.ip_address
        if self.error_message:
            d["errorMessage"] = self.error_message
        return d

