import os
from dataclasses import dataclass

@dataclass(frozen=True)
class CameraConfig:
    """Configuration for ESP32-CAM video acquisition and relay."""
    # Master switch: whether camera acquisition is enabled
    enabled: bool = os.getenv("CAMERA_ENABLED", "false").lower() in ("true", "1", "yes")

    # Airframe & Subsystem Identification
    drone_id: str = os.getenv("DRONE_ID", "AERON-PX4-BENCH01")
    device_id: str = os.getenv("CAMERA_DEVICE_ID", "ESP32-CAM-01")

    # ESP32-CAM Network Endpoint
    host: str = os.getenv("CAMERA_HOST", "192.168.4.1")
    port: int = int(os.getenv("CAMERA_PORT", "80"))
    protocol: str = os.getenv("CAMERA_PROTOCOL", "HTTP_JPEG").upper()  # HTTP_JPEG, HTTP_MJPEG, MOCK
    snapshot_path: str = os.getenv("CAMERA_SNAPSHOT_PATH", "/capture")
    stream_path: str = os.getenv("CAMERA_STREAM_PATH", "/stream")

    # Frame Rate and Constraints
    target_fps: float = float(os.getenv("CAMERA_TARGET_FPS", "2.0"))  # Standard IoT preview rate (1-5 fps)
    max_frame_bytes: int = int(os.getenv("CAMERA_MAX_FRAME_BYTES", "1048576"))  # 1 MB max frame size
    timeout_seconds: float = float(os.getenv("CAMERA_TIMEOUT_SECONDS", "2.5"))
    stale_timeout_seconds: float = float(os.getenv("CAMERA_STALE_TIMEOUT_SECONDS", "5.0"))

    # Backend Endpoints
    backend_url: str = os.getenv("AERON_BACKEND_URL", "http://localhost:5000/api/v1")
    frames_endpoint: str = os.getenv(
        "CAMERA_FRAMES_ENDPOINT",
        os.getenv("AERON_BACKEND_URL", "http://localhost:5000/api/v1").rstrip("/") + "/camera/frames"
    )
    status_endpoint: str = os.getenv(
        "CAMERA_STATUS_ENDPOINT",
        os.getenv("AERON_BACKEND_URL", "http://localhost:5000/api/v1").rstrip("/") + "/camera/status"
    )
    drone_bridge_token: str = os.getenv("DRONE_BRIDGE_TOKEN", "aeron_drone_bridge_secret_token_dev")

    # Queue sizing
    frame_queue_max: int = int(os.getenv("CAMERA_FRAME_QUEUE_MAX", "5"))

camera_config = CameraConfig()

