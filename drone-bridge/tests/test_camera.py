import io
import time
import base64
import unittest
from unittest.mock import patch, MagicMock

from src.camera.config import CameraConfig
from src.camera.models import CameraFrame, CameraStatus
from src.camera.health import CameraHealthTracker
from src.camera.frame_reader import ESP32CameraReader
from src.camera.transport import CameraTransportClient

class TestCameraSubsystem(unittest.TestCase):
    """Test suite for the AERON ESP32-CAM video acquisition and relay subsystem."""

    def setUp(self):
        self.config = CameraConfig(
            enabled=True,
            drone_id="TEST-DRONE-01",
            device_id="ESP32-CAM-01",
            host="192.168.4.1",
            port=80,
            protocol="MOCK",
            target_fps=5.0,
            max_frame_bytes=1048576,
            timeout_seconds=1.0,
            stale_timeout_seconds=0.5,
            frame_queue_max=3
        )
        self.health = CameraHealthTracker(
            drone_id="TEST-DRONE-01",
            device_id="ESP32-CAM-01",
            stale_timeout_sec=0.5,
            ip_address="192.168.4.1:80"
        )
        self.reader = ESP32CameraReader(config=self.config, health=self.health)

    def test_jpeg_validation(self):
        """Validates that JPEG byte integrity checking strictly detects corrupt or non-JPEG payloads."""
        # Non-JPEG bytes (PNG header)
        png_header = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        valid, err = ESP32CameraReader.validate_jpeg(png_header)
        self.assertFalse(valid)
        self.assertIn("Invalid JPEG SOI header", err)

        # Empty data
        valid, err = ESP32CameraReader.validate_jpeg(b"")
        self.assertFalse(valid)
        self.assertIn("Empty", err)

        # HTML error page
        html_data = b"<html><head><title>500 Internal Error</title></head></html>"
        valid, err = ESP32CameraReader.validate_jpeg(html_data)
        self.assertFalse(valid)

        # Oversized frame
        valid, err = ESP32CameraReader.validate_jpeg(b"\xff\xd8" + b"\x00" * 100, max_bytes=50)
        self.assertFalse(valid)
        self.assertIn("exceeds maximum limit", err)

        # Real synthetic JPEG
        real_jpeg = self.reader.generate_synthetic_frame("TEST-DRONE-01")
        valid, err = ESP32CameraReader.validate_jpeg(real_jpeg)
        self.assertTrue(valid)
        self.assertIsNone(err)

    def test_synthetic_frame_generation(self):
        """Verifies synthetic bench frame generation creates valid 640x480 JPEGs with valid base64."""
        frame_bytes = self.reader.generate_synthetic_frame(
            drone_id="TEST-DRONE-01",
            lat=12.9716,
            lon=77.5946,
            alt=45.2
        )
        self.assertTrue(frame_bytes.startswith(b"\xff\xd8"))
        w, h = ESP32CameraReader.get_image_dimensions(frame_bytes)
        self.assertEqual(w, 640)
        self.assertEqual(h, 480)

        # Base64 verification
        b64 = base64.b64encode(frame_bytes).decode("ascii")
        self.assertTrue(b64.startswith("/9j/"))

    def test_frame_acquisition_and_gps_synchronization(self):
        """Tests that captured frames correctly synchronize with nearest flight telemetry coordinates."""
        frame = self.reader.capture_frame(
            telemetry_lat=12.9716,
            telemetry_lon=77.5946,
            telemetry_alt=50.0,
            telemetry_heading=180.5,
            telemetry_age_seconds=0.12
        )

        self.assertIsNotNone(frame)
        self.assertEqual(frame.drone_id, "TEST-DRONE-01")
        self.assertEqual(frame.telemetry_lat, 12.9716)
        self.assertEqual(frame.telemetry_lon, 77.5946)
        self.assertEqual(frame.telemetry_alt, 50.0)
        self.assertEqual(frame.telemetry_heading, 180.5)
        self.assertEqual(frame.telemetry_age_seconds, 0.12)

        payload = frame.to_backend_dict()
        self.assertEqual(payload["droneId"], "TEST-DRONE-01")
        self.assertEqual(payload["telemetryLat"], 12.9716)
        self.assertTrue(payload["frameBase64"].startswith("/9j/"))

    def test_rate_throttling(self):
        """Ensures frame reader enforces target FPS rate throttling."""
        # First capture succeeds
        f1 = self.reader.capture_frame()
        self.assertIsNotNone(f1)

        # Immediate second capture must be throttled (returns None)
        f2 = self.reader.capture_frame()
        self.assertIsNone(f2)

    def test_health_tracker_stale_and_fps(self):
        """Tests sliding window FPS calculation, consecutive error handling and stale streaming state."""
        tracker = CameraHealthTracker(
            drone_id="TEST-DRONE-01",
            device_id="ESP32-CAM-01",
            stale_timeout_sec=0.2
        )
        tracker.record_installed(True)
        tracker.record_reachability(True)

        # Initially 0 FPS and not streaming
        self.assertEqual(tracker.calculated_fps, 0.0)
        self.assertFalse(tracker.is_streaming)

        # Record successive frames
        tracker.record_frame_success(640, 480, 25000)
        self.assertTrue(tracker.is_streaming)

        time.sleep(0.05)
        tracker.record_frame_success(640, 480, 25000)
        self.assertGreater(tracker.calculated_fps, 0.0)

        # Wait past stale timeout (0.2s)
        time.sleep(0.25)
        self.assertFalse(tracker.is_streaming)
        self.assertEqual(tracker.calculated_fps, 0.0)

        # Error tracking
        tracker.record_fetch_error("Connection refused")
        tracker.record_fetch_error("Connection timed out")
        self.assertTrue(tracker.reachable)  # still reachable after 2 errors
        tracker.record_fetch_error("Network unreachable")
        self.assertFalse(tracker.reachable)  # marked unreachable after 3 consecutive errors

    def test_transport_client_queue_and_bounded_drop(self):
        """Verifies transport client queue bounds and drop behavior to maintain low preview latency."""
        client = CameraTransportClient(
            frames_url="http://localhost:5000/api/v1/camera/frames",
            status_url="http://localhost:5000/api/v1/camera/status",
            bridge_token="test_token",
            max_queue_size=2
        )

        f1 = CameraFrame("DRONE-1", "CAM-1", "2026-11-08T00:00:00Z", "/9j/test1", size_bytes=100)
        f2 = CameraFrame("DRONE-1", "CAM-1", "2026-11-08T00:00:01Z", "/9j/test2", size_bytes=100)
        f3 = CameraFrame("DRONE-1", "CAM-1", "2026-11-08T00:00:02Z", "/9j/test3", size_bytes=100)

        client.enqueue_frame(f1)
        client.enqueue_frame(f2)
        client.enqueue_frame(f3)  # Exceeds max_queue_size (2)

        self.assertEqual(client.total_frames_dropped, 1)
        self.assertEqual(len(client.frame_queue), 2)

        # Mock successful transmission
        with patch.object(client.session, "post") as mock_post:
            mock_post.return_value = MagicMock(status_code=200)
            sent = client.flush_frames()
            self.assertEqual(sent, 1)
            # Stale frames cleared
            self.assertEqual(len(client.frame_queue), 0)

if __name__ == "__main__":
    unittest.main()

