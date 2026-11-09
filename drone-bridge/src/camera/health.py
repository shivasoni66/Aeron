import time
from collections import deque
from datetime import datetime, timezone
from typing import Optional, List
from .models import CameraStatus
from ..logging_config import setup_logging

logger = setup_logging("CAMERA-HEALTH")

class CameraHealthTracker:
    """
    Monitors ESP32-CAM subsystem health, sliding-window FPS, reachability,
    stale frame detection and consecutive error reporting.
    """

    def __init__(
        self,
        drone_id: str,
        device_id: str = "ESP32-CAM-01",
        stale_timeout_sec: float = 5.0,
        ip_address: Optional[str] = None
    ):
        self.drone_id = drone_id
        self.device_id = device_id
        self.stale_timeout_sec = stale_timeout_sec
        self.ip_address = ip_address

        self.installed: bool = False
        self.reachable: bool = False
        self.last_frame_epoch: Optional[float] = None
        self.last_frame_iso: Optional[str] = None
        self.last_error: Optional[str] = None
        self.current_resolution: Optional[str] = None
        self.rssi: Optional[int] = None

        self.total_frames_captured: int = 0
        self.total_frames_dropped: int = 0
        self.total_fetch_errors: int = 0
        self.consecutive_errors: int = 0

        # Sliding window of frame timestamps (last 20 frames) for FPS calculation
        self._frame_times: deque = deque(maxlen=20)

    def record_installed(self, is_installed: bool):
        self.installed = is_installed

    def record_reachability(self, reachable: bool, ip: Optional[str] = None):
        self.reachable = reachable
        if ip:
            self.ip_address = ip
        if not reachable:
            if self.reachable:
                logger.warning(f"ESP32-CAM ({self.device_id}) became UNREACHABLE at {self.ip_address}")

    def record_frame_success(self, width: Optional[int] = None, height: Optional[int] = None, size_bytes: int = 0):
        now_epoch = time.time()
        now_iso = datetime.now(timezone.utc).isoformat()

        self.total_frames_captured += 1
        self.consecutive_errors = 0
        self.reachable = True
        self.last_frame_epoch = now_epoch
        self.last_frame_iso = now_iso
        self.last_error = None
        self._frame_times.append(now_epoch)

        if width and height:
            self.current_resolution = f"{width}x{height}"

    def record_fetch_error(self, error_message: str):
        self.total_fetch_errors += 1
        self.consecutive_errors += 1
        self.last_error = error_message

        # If 3 or more consecutive errors, mark unreachable
        if self.consecutive_errors >= 3:
            self.reachable = False

    def record_frame_dropped(self):
        self.total_frames_dropped += 1

    @property
    def is_streaming(self) -> bool:
        """Streaming is true if camera is reachable and received a valid frame within stale timeout."""
        if not self.reachable or self.last_frame_epoch is None:
            return False
        return (time.time() - self.last_frame_epoch) < self.stale_timeout_sec

    @property
    def calculated_fps(self) -> float:
        """Calculates sliding-window FPS over recent frame intervals."""
        if len(self._frame_times) < 2:
            return 0.0
        # If no frame for more than stale timeout, FPS is 0
        if self.last_frame_epoch and (time.time() - self.last_frame_epoch) > self.stale_timeout_sec:
            return 0.0

        duration = self._frame_times[-1] - self._frame_times[0]
        if duration <= 0:
            return 0.0
        return (len(self._frame_times) - 1) / duration

    def snapshot(self) -> CameraStatus:
        """Returns an immutable snapshot of current camera health status."""
        return CameraStatus(
            drone_id=self.drone_id,
            device_id=self.device_id,
            installed=self.installed,
            reachable=self.reachable,
            streaming=self.is_streaming,
            fps=self.calculated_fps,
            last_frame_at=self.last_frame_iso,
            resolution=self.current_resolution,
            rssi=self.rssi,
            ip_address=self.ip_address,
            error_message=self.last_error if not self.reachable else None,
            recorded_at=datetime.now(timezone.utc).isoformat()
        )

