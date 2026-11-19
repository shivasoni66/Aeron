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
    source: str = "REAL"
    telemetry_lat: Optional[float] = None
    telemetry_lon: Optional[float] = None
    telemetry_alt: Optional[float] = None
    telemetry_heading: Optional[float] = None
    telemetry_age_seconds: Optional[float] = None

    def to_backend_dict(self) -> Dict[str, Any]:
        """Serializes the frame into the exact schema expected by AERON backend."""
        d = {
            "cameraId": self.device_id.upper(),
            "droneId": self.drone_id.upper(),
            "capturedAt": self.captured_at,
            "source": self.source,
            "contentType": "image/jpeg",
            "frameWidth": self.width or 320,
            "frameHeight": self.height or 240,
            "frameSizeBytes": self.size_bytes,
            "frameData": self.frame_base64,
            # Legacy and frontend alias mappings
            "deviceId": self.device_id,
            "frameBase64": self.frame_base64,
            "mimeType": self.mime_type,
            "sizeBytes": self.size_bytes,
            "width": self.width or 320,
            "height": self.height or 240
        }
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
    source: str = "REAL"

    def to_backend_dict(self) -> Dict[str, Any]:
        """Serializes camera health into the camelCase JSON format expected by AERON backend."""
        if self.streaming:
            conn_status = "STREAMING"
            stream_status = "STREAMING"
        elif self.reachable:
            conn_status = "CONNECTED"
            stream_status = "STANDBY"
        elif self.installed:
            conn_status = "DISCONNECTED"
            stream_status = "OFFLINE"
        else:
            conn_status = "NOT_INSTALLED"
            stream_status = "OFFLINE"

        d = {
            "cameraId": self.device_id.upper(),
            "droneId": self.drone_id.upper(),
            "connectionStatus": conn_status,
            "streamStatus": stream_status,
            "source": self.source,
            "resolution": self.resolution or "320x240",
            "frameRate": max(0.0, min(60.0, round(self.fps, 2))),
            # Legacy fields for direct consumer compatibility
            "deviceId": self.device_id,
            "installed": self.installed,
            "reachable": self.reachable,
            "streaming": self.streaming,
            "fps": round(self.fps, 2),
            "recordedAt": self.recorded_at or datetime.now(timezone.utc).isoformat()
        }
        if self.last_frame_at:
            d["lastFrameAt"] = self.last_frame_at
        if self.rssi is not None:
            d["rssi"] = self.rssi
        if self.ip_address:
            d["ipAddress"] = self.ip_address
        if self.error_message:
            d["errorCode"] = self.error_message
            d["errorMessage"] = self.error_message
        return d
