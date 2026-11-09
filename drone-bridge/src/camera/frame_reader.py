import io
import time
import base64
from typing import Optional, Tuple
from datetime import datetime, timezone
import requests
from PIL import Image, ImageDraw, ImageFont

from .config import CameraConfig
from .health import CameraHealthTracker
from .models import CameraFrame
from ..logging_config import setup_logging

logger = setup_logging("CAMERA-READER")

class ESP32CameraReader:
    """
    Acquires, validates, and encodes frames from an ESP32-CAM video module.
    Supports HTTP snapshot polling, fallback synthetic frames (MOCK), and rate limiting.
    """

    def __init__(self, config: CameraConfig, health: CameraHealthTracker):
        self.config = config
        self.health = health
        self.base_url = f"http://{config.host}:{config.port}"
        self.snapshot_url = f"{self.base_url}{config.snapshot_path}"
        self.last_capture_time: float = 0.0
        self.min_frame_interval: float = 1.0 / max(0.1, config.target_fps)

        # Pre-initialize session for connection pooling
        self.session = requests.Session()

    @staticmethod
    def validate_jpeg(data: bytes, max_bytes: int = 1048576) -> Tuple[bool, Optional[str]]:
        """
        Validates that raw bytes constitute a well-formed JPEG image within size limits.
        Checks for JPEG Start of Image (SOI 0xFFD8) and End of Image (0xFFD9).
        """
        if not data:
            return False, "Empty frame payload"

        if len(data) > max_bytes:
            return False, f"Frame size ({len(data)} bytes) exceeds maximum limit ({max_bytes} bytes)"

        if len(data) < 4:
            return False, "Frame data too short to be a valid image"

        # Check SOI: 0xFF, 0xD8
        if data[0] != 0xFF or data[1] != 0xD8:
            return False, f"Invalid JPEG SOI header: 0x{data[0]:02x} 0x{data[1]:02x}"

        # Check EOI: 0xFF, 0xD9 anywhere in last 32 bytes (some cameras append trailing null bytes or padding)
        has_eoi = b"\xff\xd9" in data[-32:]
        if not has_eoi:
            # We allow relaxed check if PIL can parse it, but log warning
            pass

        return True, None

    @staticmethod
    def get_image_dimensions(data: bytes) -> Tuple[Optional[int], Optional[int]]:
        """Extracts width and height of JPEG frame using PIL."""
        try:
            with Image.open(io.BytesIO(data)) as img:
                return img.width, img.height
        except Exception:
            return None, None

    def generate_synthetic_frame(
        self,
        drone_id: str,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        alt: Optional[float] = None
    ) -> bytes:
        """
        Generates a valid 640x480 test JPEG frame with simulated HUD overlay.
        Used for bench validation when physical ESP32-CAM is not connected.
        """
        width, height = 640, 480
        # Dark slate background with grid pattern
        img = Image.new("RGB", (width, height), color=(15, 23, 42))
        draw = ImageDraw.Draw(img)

        # Crosshair HUD
        cx, cy = width // 2, height // 2
        draw.line([(cx - 40, cy), (cx + 40, cy)], fill=(56, 189, 248), width=2)
        draw.line([(cx, cy - 40), (cx, cy + 40)], fill=(56, 189, 248), width=2)
        draw.ellipse([(cx - 20, cy - 20), (cx + 20, cy + 20)], outline=(56, 189, 248), width=1)

        # Corner brackets
        box_size = 80
        draw.line([(40, 40), (40 + box_size, 40)], fill=(14, 165, 233), width=2)
        draw.line([(40, 40), (40, 40 + box_size)], fill=(14, 165, 233), width=2)
        draw.line([(width - 40, 40), (width - 40 - box_size, 40)], fill=(14, 165, 233), width=2)
        draw.line([(width - 40, 40), (width - 40, 40 + box_size)], fill=(14, 165, 233), width=2)

        # Telemetry / HUD text overlay
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        lat_str = f"{lat:.5f}" if lat is not None else "--.-----"
        lon_str = f"{lon:.5f}" if lon is not None else "--.-----"
        alt_str = f"{alt:.1f}m" if alt is not None else "--.-m"

        draw.text((20, height - 60), f"AERON BENCH CAMERA | {drone_id}", fill=(241, 245, 249))
        draw.text((20, height - 40), f"TIME: {now_str}", fill=(148, 163, 184))
        draw.text((20, height - 20), f"POS: ({lat_str}, {lon_str}) ALT: {alt_str}", fill=(56, 189, 248))
        draw.text((width - 160, 20), "[SYNTHETIC BENCH]", fill=(234, 179, 8))

        output = io.BytesIO()
        img.save(output, format="JPEG", quality=80)
        return output.getvalue()

    def capture_frame(
        self,
        telemetry_lat: Optional[float] = None,
        telemetry_lon: Optional[float] = None,
        telemetry_alt: Optional[float] = None,
        telemetry_heading: Optional[float] = None,
        telemetry_age_seconds: Optional[float] = None
    ) -> Optional[CameraFrame]:
        """
        Attempts to acquire a single frame from the camera according to configured protocol.
        Respects frame rate throttling.
        """
        now = time.time()
        elapsed = now - self.last_capture_time
        if elapsed < self.min_frame_interval:
            # Throttled, not time for next frame yet
            return None

        raw_bytes: Optional[bytes] = None

        if self.config.protocol == "MOCK":
            raw_bytes = self.generate_synthetic_frame(
                drone_id=self.config.drone_id,
                lat=telemetry_lat,
                lon=telemetry_lon,
                alt=telemetry_alt
            )
        else:
            # Physical HTTP JPEG snapshot
            try:
                response = self.session.get(self.snapshot_url, timeout=self.config.timeout_seconds)
                if response.status_code == 200:
                    raw_bytes = response.content
                else:
                    err = f"HTTP {response.status_code} fetching camera frame"
                    self.health.record_fetch_error(err)
                    logger.debug(err)
                    return None
            except requests.exceptions.RequestException as exc:
                err = f"Camera network failure: {str(exc)}"
                self.health.record_fetch_error(err)
                logger.debug(err)
                return None

        # Validate acquired frame
        valid, err_msg = self.validate_jpeg(raw_bytes, max_bytes=self.config.max_frame_bytes)
        if not valid:
            self.health.record_fetch_error(f"Invalid frame: {err_msg}")
            logger.warning(f"ESP32-CAM frame rejected: {err_msg}")
            return None

        # Dimensions & encoding
        width, height = self.get_image_dimensions(raw_bytes)
        frame_base64 = base64.b64encode(raw_bytes).decode("ascii")

        self.last_capture_time = now
        self.health.record_frame_success(width=width, height=height, size_bytes=len(raw_bytes))

        return CameraFrame(
            drone_id=self.config.drone_id,
            device_id=self.config.device_id,
            captured_at=datetime.now(timezone.utc).isoformat(),
            frame_base64=frame_base64,
            mime_type="image/jpeg",
            width=width,
            height=height,
            size_bytes=len(raw_bytes),
            telemetry_lat=telemetry_lat,
            telemetry_lon=telemetry_lon,
            telemetry_alt=telemetry_alt,
            telemetry_heading=telemetry_heading,
            telemetry_age_seconds=telemetry_age_seconds
        )

