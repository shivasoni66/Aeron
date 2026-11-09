import requests
from collections import deque
from typing import Optional, Dict, Any
from .models import CameraFrame, CameraStatus
from ..logging_config import setup_logging

logger = setup_logging("CAMERA-TRANSPORT")

class CameraTransportClient:
    """
    Transmits authenticated camera frames and status telemetry to the AERON backend.
    Enforces bounded queues so real-time video preview does not lag behind.
    """

    def __init__(
        self,
        frames_url: str,
        status_url: str,
        bridge_token: str,
        max_queue_size: int = 5,
        timeout_seconds: float = 3.0
    ):
        self.frames_url = frames_url
        self.status_url = status_url
        self.bridge_token = bridge_token
        self.max_queue_size = max_queue_size
        self.timeout_seconds = timeout_seconds

        self.frame_queue: deque = deque(maxlen=self.max_queue_size)
        self.total_frames_sent: int = 0
        self.total_frames_dropped: int = 0
        self.total_status_sent: int = 0
        self.session = requests.Session()

    def enqueue_frame(self, frame: CameraFrame):
        """Pushes a frame to the bounded queue, dropping oldest if queue is full."""
        if len(self.frame_queue) >= self.max_queue_size:
            self.total_frames_dropped += 1
            if self.total_frames_dropped % 25 == 1:
                logger.warning(
                    f"Camera outbound queue full ({self.max_queue_size}). "
                    f"Dropped {self.total_frames_dropped} frames to maintain low preview latency."
                )
        self.frame_queue.append(frame)

    def flush_frames(self) -> int:
        """Flushes the most recent frame in the queue to backend. Returns number sent."""
        if not self.frame_queue:
            return 0

        # For real-time camera preview, send the latest frame and discard stale queued ones
        latest_frame = self.frame_queue.pop()
        dropped_stale = len(self.frame_queue)
        if dropped_stale > 0:
            self.total_frames_dropped += dropped_stale
            self.frame_queue.clear()

        headers = {
            "Content-Type": "application/json",
            "x-drone-bridge-token": self.bridge_token
        }

        try:
            resp = self.session.post(
                self.frames_url,
                json=latest_frame.to_backend_dict(),
                headers=headers,
                timeout=self.timeout_seconds
            )
            if resp.status_code in (200, 201):
                self.total_frames_sent += 1
                logger.debug(f"Frame delivered to {self.frames_url} ({latest_frame.size_bytes} bytes)")
                return 1
            else:
                logger.warning(f"Backend rejected frame with HTTP {resp.status_code}: {resp.text[:200]}")
                return 0
        except requests.exceptions.RequestException as err:
            logger.debug(f"Camera frame delivery failed: {err}")
            return 0

    def send_status(self, status: CameraStatus) -> bool:
        """Sends camera subsystem operational health to the backend."""
        headers = {
            "Content-Type": "application/json",
            "x-drone-bridge-token": self.bridge_token
        }

        try:
            resp = self.session.post(
                self.status_url,
                json=status.to_backend_dict(),
                headers=headers,
                timeout=self.timeout_seconds
            )
            if resp.status_code in (200, 201):
                self.total_status_sent += 1
                return True
            else:
                logger.warning(f"Backend rejected camera status with HTTP {resp.status_code}")
                return False
        except requests.exceptions.RequestException as err:
            logger.debug(f"Camera status delivery failed: {err}")
            return False

