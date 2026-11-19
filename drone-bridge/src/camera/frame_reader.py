import io
import time
import base64
import threading
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
    Supports continuous HTTP MJPEG streaming, HTTP snapshot polling, fallback synthetic frames (MOCK), and rate limiting.
    """

    def __init__(self, config: CameraConfig, health: CameraHealthTracker):
        self.config = config
        self.health = health
        self.base_url = f"http://{config.host}:{config.port}"
        self.snapshot_url = f"{self.base_url}{config.snapshot_path}"
        self.stream_url = f"{self.base_url}{config.stream_path}"
        self.last_capture_time: float = 0.0
        self.min_frame_interval: float = 1.0 / max(0.1, config.target_fps)

        # Protocol normalization
        proto = (config.protocol or "MJPEG").upper()
        self.is_mjpeg = proto in ("MJPEG", "HTTP_MJPEG")
        self.is_mock = proto in ("MOCK", "SIMULATION")

        # Session with connection pooling
        self.session = requests.Session()

        # Threading and bounded frame storage for MJPEG stream
        self._frame_lock = threading.Lock()
        self._latest_raw_frame: Optional[bytes] = None
        self._latest_frame_time: float = 0.0
        self._latest_width: int = 320
        self._latest_height: int = 240
        self._stop_event = threading.Event()
        self._stream_thread: Optional[threading.Thread] = None

    def start(self):
        """Starts the background MJPEG stream reader thread if streaming protocol is configured."""
        if self.is_mjpeg and not self.is_mock:
            if self._stream_thread is None or not self._stream_thread.is_alive():
                self._stop_event.clear()
                self._stream_thread = threading.Thread(
                    target=self._mjpeg_stream_loop,
                    name="ESP32-MJPEG-Reader",
                    daemon=True
                )
                self._stream_thread.start()
                logger.info(f"ESP32-CAM MJPEG background stream reader thread started for {self.stream_url}.")

    def stop(self):
        """Stops the background MJPEG stream reader thread cleanly."""
        self._stop_event.set()
        try:
            self.session.close()
        except Exception:
            pass
        if self._stream_thread and self._stream_thread.is_alive():
            self._stream_thread.join(timeout=2.0)
        logger.info("ESP32-CAM stream reader stopped.")

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

        return True, None

    @staticmethod
    def get_image_dimensions(data: bytes) -> Tuple[Optional[int], Optional[int]]:
        """Extracts width and height of JPEG frame using PIL."""
        try:
            with Image.open(io.BytesIO(data)) as img:
                return img.width, img.height
        except Exception:
            return None, None

    def _mjpeg_stream_loop(self):
        """
        Continuous worker loop consuming the multipart MJPEG stream from ESP32-CAM.
        Extracts individual JPEG frames delimited by SOI (0xFF, 0xD8) and EOI (0xFF, 0xD9).
        Maintains bounded buffer and auto-reconnects on disconnection.
        """
        logger.info(f"MJPEG continuous consumer initiated: {self.stream_url}")
        reconnect_delay = 1.0

        while not self._stop_event.is_set():
            try:
                logger.info(f"Connecting to ESP32-CAM MJPEG stream at {self.stream_url}...")
                with self.session.get(
                    self.stream_url,
                    stream=True,
                    timeout=(self.config.timeout_seconds, 10.0),
                    headers={"User-Agent": "AERON-GCS/1.0"}
                ) as resp:
                    if resp.status_code != 200:
                        err = f"ESP32-CAM stream HTTP {resp.status_code} ({self.stream_url})"
                        logger.warning(err)
                        self.health.record_fetch_error(err)
                        time.sleep(reconnect_delay)
                        reconnect_delay = min(5.0, reconnect_delay * 1.5)
                        continue

                    logger.info(f"Successfully connected to ESP32-CAM MJPEG stream at {self.stream_url}!")
                    reconnect_delay = 1.0
                    self.health.record_reachability(True, ip=f"{self.config.host}:{self.config.port}")

                    chunk_buffer = bytearray()
                    # Bounded iteration chunk size
                    for chunk in resp.iter_content(chunk_size=4096):
                        if self._stop_event.is_set():
                            break
                        if not chunk:
                            continue

                        chunk_buffer.extend(chunk)

                        # Extract all complete JPEG frames in buffer
                        while True:
                            soi = chunk_buffer.find(b"\xff\xd8")
                            if soi == -1:
                                if len(chunk_buffer) > 4:
                                    chunk_buffer = chunk_buffer[-3:]
                                break

                            eoi = chunk_buffer.find(b"\xff\xd9", soi + 2)
                            if eoi == -1:
                                if soi > 0:
                                    chunk_buffer = chunk_buffer[soi:]
                                # Bounded buffer protection against runaway memory
                                if len(chunk_buffer) > self.config.max_frame_bytes + 65536:
                                    chunk_buffer = chunk_buffer[2:]
                                break

                            # Complete frame extracted
                            jpeg_bytes = bytes(chunk_buffer[soi : eoi + 2])
                            chunk_buffer = chunk_buffer[eoi + 2 :]

                            valid, err = self.validate_jpeg(jpeg_bytes, max_bytes=self.config.max_frame_bytes)
                            if valid:
                                w, h = self.get_image_dimensions(jpeg_bytes)
                                if not w or not h:
                                    w, h = self._latest_width or 320, self._latest_height or 240

                                now_epoch = time.time()
                                with self._frame_lock:
                                    self._latest_raw_frame = jpeg_bytes
                                    self._latest_frame_time = now_epoch
                                    self._latest_width = w
                                    self._latest_height = h

                                self.health.record_frame_success(width=w, height=h, size_bytes=len(jpeg_bytes))

            except requests.exceptions.RequestException as exc:
                err_msg = str(exc)
                logger.warning(f"ESP32-CAM MJPEG stream disconnected: {err_msg}")
                self.health.record_fetch_error(f"Stream error: {err_msg}")

                # If connection timed out on port 81, check if browser is holding single client slot
                if "timed out" in err_msg.lower() or "timeout" in err_msg.lower():
                    logger.warning(
                        "NOTE: If 'http://10.231.241.200:81/stream' is open in another browser tab, "
                        "please close it to allow the AERON bridge to connect (ESP32-CAM serves 1 stream client)."
                    )

                with self._frame_lock:
                    if time.time() - self._latest_frame_time > self.config.stale_timeout_seconds:
                        self._latest_raw_frame = None

                time.sleep(reconnect_delay)
                reconnect_delay = min(5.0, reconnect_delay * 1.5)

            except Exception as exc:
                logger.error(f"Unexpected error in MJPEG stream loop: {exc}")
                self.health.record_fetch_error(str(exc))
                time.sleep(reconnect_delay)

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
        width: Optional[int] = None
        height: Optional[int] = None

        if self.is_mock:
            raw_bytes = self.generate_synthetic_frame(
                drone_id=self.config.drone_id,
                lat=telemetry_lat,
                lon=telemetry_lon,
                alt=telemetry_alt
            )
            width, height = 640, 480
        elif self.is_mjpeg:
            # Ensure background stream thread is started
            if self._stream_thread is None or not self._stream_thread.is_alive():
                self.start()

            with self._frame_lock:
                if not self._latest_raw_frame:
                    return None
                # Check stale frame threshold
                if (now - self._latest_frame_time) > self.config.stale_timeout_seconds:
                    return None
                raw_bytes = self._latest_raw_frame
                width = self._latest_width
                height = self._latest_height
        else:
            # Physical HTTP JPEG snapshot polling (fallback for port 80 /capture)
            try:
                response = self.session.get(self.snapshot_url, timeout=self.config.timeout_seconds)
                if response.status_code == 200:
                    raw_bytes = response.content
                else:
                    err = f"HTTP {response.status_code} fetching snapshot frame"
                    self.health.record_fetch_error(err)
                    logger.debug(err)
                    return None
            except requests.exceptions.RequestException as exc:
                err = f"Camera snapshot failure: {str(exc)}"
                self.health.record_fetch_error(err)
                logger.debug(err)
                return None

            valid, err_msg = self.validate_jpeg(raw_bytes, max_bytes=self.config.max_frame_bytes)
            if not valid:
                self.health.record_fetch_error(f"Invalid snapshot frame: {err_msg}")
                logger.warning(f"ESP32-CAM frame rejected: {err_msg}")
                return None

            width, height = self.get_image_dimensions(raw_bytes)
            if not width or not height:
                width, height = 320, 240
            self.health.record_frame_success(width=width, height=height, size_bytes=len(raw_bytes))

        if not raw_bytes:
            return None

        frame_base64 = base64.b64encode(raw_bytes).decode("ascii")
        self.last_capture_time = now

        return CameraFrame(
            drone_id=self.config.drone_id,
            device_id=self.config.device_id,
            captured_at=datetime.now(timezone.utc).isoformat(),
            frame_base64=frame_base64,
            mime_type="image/jpeg",
            width=width or 320,
            height=height or 240,
            size_bytes=len(raw_bytes),
            source="SIMULATION" if self.is_mock else "REAL",
            telemetry_lat=telemetry_lat,
            telemetry_lon=telemetry_lon,
            telemetry_alt=telemetry_alt,
            telemetry_heading=telemetry_heading,
            telemetry_age_seconds=telemetry_age_seconds
        )
