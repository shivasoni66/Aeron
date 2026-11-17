"""
Unit tests for the AERON Local Bridge Controller Service.
Validates security boundaries, token authentication, CORS preflights,
and state machine transitions.
"""

import os
import json
import time
import unittest
import urllib.request
import urllib.error
import pathlib
from unittest.mock import MagicMock, patch

from controller.aeron_bridge_controller import (
    BridgeControllerServer,
    BridgeProcessManager,
    STATUS_BRIDGE_STOPPED,
    STATUS_STARTING,
    STATUS_CONNECTED,
    DEFAULT_PORT
)


class TestBridgeControllerSecurityAndEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo_root = pathlib.Path(__file__).resolve().parent.parent.parent
        # Use an ephemeral port or standard 8765 for tests
        cls.test_port = 8799
        cls.server = BridgeControllerServer(
            host="127.0.0.1",
            port=cls.test_port,
            repo_root=cls.repo_root
        )
        cls.server.start()
        # Give server thread a moment to bind
        time.sleep(0.3)
        cls.base_url = f"http://127.0.0.1:{cls.test_port}"
        cls.token = cls.server.token

    @classmethod
    def tearDownClass(cls):
        cls.server.stop()

    def test_security_violation_on_external_bind(self):
        """Verifies that the server strictly rejects binding to non-loopback addresses."""
        with self.assertRaises(ValueError):
            BridgeControllerServer(host="0.0.0.0", port=8798, repo_root=self.repo_root)
        with self.assertRaises(ValueError):
            BridgeControllerServer(host="192.168.1.100", port=8798, repo_root=self.repo_root)

    def test_health_check_endpoint(self):
        """Verifies GET /health returns service metadata without requiring token."""
        req = urllib.request.Request(f"{self.base_url}/health")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data.get("status"), "ok")
            self.assertEqual(data.get("service"), "aeron-bridge-controller")
            self.assertEqual(data.get("host"), "127.0.0.1")
            self.assertEqual(data.get("port"), self.test_port)

    def test_cors_and_private_network_access_preflight(self):
        """Verifies OPTIONS preflight returns CORS and Private Network Access headers."""
        req = urllib.request.Request(
            f"{self.base_url}/api/bridge/start",
            method="OPTIONS",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "X-AERON-TOKEN, Content-Type",
                "Access-Control-Request-Private-Network": "true"
            }
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 204)
            self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
            self.assertIn("POST", resp.headers.get("Access-Control-Allow-Methods"))
            self.assertIn("X-AERON-TOKEN", resp.headers.get("Access-Control-Allow-Headers"))
            self.assertEqual(resp.headers.get("Access-Control-Allow-Private-Network"), "true")

    def test_unauthenticated_post_rejected(self):
        """Verifies POST /api/bridge/start rejects request without X-AERON-TOKEN (401)."""
        req = urllib.request.Request(
            f"{self.base_url}/api/bridge/start",
            data=b"{}",
            method="POST",
            headers={"Content-Type": "application/json"}
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req, timeout=2.0)
        self.assertEqual(ctx.exception.code, 401)

    def test_invalid_token_post_rejected(self):
        """Verifies POST /api/bridge/start rejects invalid token (401)."""
        req = urllib.request.Request(
            f"{self.base_url}/api/bridge/start",
            data=b"{}",
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-AERON-TOKEN": "invalid-bogus-token-123456"
            }
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req, timeout=2.0)
        self.assertEqual(ctx.exception.code, 401)

    def test_status_endpoint(self):
        """Verifies GET /api/bridge/status returns structured status snapshot."""
        req = urllib.request.Request(f"{self.base_url}/api/bridge/status")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("status", data)
            self.assertIn("transport", data)
            self.assertEqual(data.get("transport"), "WIFI")
            self.assertIn("esp32_state", data)
            self.assertIn("heartbeat_state", data)
            self.assertIn("recent_logs", data)

    def test_token_endpoint_loopback_access(self):
        """Verifies GET /api/bridge/token returns token when accessed via loopback."""
        req = urllib.request.Request(f"{self.base_url}/api/bridge/token")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data.get("token"), self.token)

    def test_process_manager_stop_when_idle(self):
        """Verifies POST /api/bridge/stop returns success even when bridge is already idle."""
        req = urllib.request.Request(
            f"{self.base_url}/api/bridge/stop",
            data=b"{}",
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-AERON-TOKEN": self.token
            }
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))
            self.assertEqual(data.get("status"), STATUS_BRIDGE_STOPPED)

    @patch("subprocess.Popen")
    def test_process_manager_start_and_double_start_protection(self, mock_popen):
        """Verifies process start sets status to STARTING and prevents duplicate processes."""
        fake_proc = MagicMock()
        fake_proc.pid = 99999
        fake_proc.poll.return_value = None  # Process running
        fake_proc.stdout = None
        mock_popen.return_value = fake_proc

        # Call start
        req = urllib.request.Request(
            f"{self.base_url}/api/bridge/start",
            data=b"{}",
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-AERON-TOKEN": self.token
            }
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))
            self.assertEqual(data.get("status"), STATUS_STARTING)
            self.assertEqual(data.get("pid"), 99999)

        # Calling start again while active must be rejected (double-start guard)
        req2 = urllib.request.Request(
            f"{self.base_url}/api/bridge/start",
            data=b"{}",
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-AERON-TOKEN": self.token
            }
        )
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req2, timeout=2.0)
        self.assertEqual(ctx.exception.code, 400)

        # Clean up by resetting mock proc and calling stop
        fake_proc.poll.return_value = 0
        self.server.manager.managed_process = None
        self.server.manager.status = STATUS_BRIDGE_STOPPED
        self.server.manager.transport = "WIFI"

    def test_diagnostics_endpoint_structure(self):
        """Verifies GET /api/bridge/diagnostics returns all 13 required diagnostics checks."""
        req = urllib.request.Request(f"{self.base_url}/api/bridge/diagnostics")
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("timestamp", data)
            self.assertIn("overall", data)
            self.assertIn("summary", data)
            self.assertEqual(data["summary"]["total"], 13)
            self.assertEqual(len(data["checks"]), 13)
            check_ids = [c["id"] for c in data["checks"]]
            self.assertIn("controller_reachability", check_ids)
            self.assertIn("python_environment", check_ids)
            self.assertIn("configuration_integrity", check_ids)
            self.assertIn("com_port_availability", check_ids)
            self.assertIn("esp32_tcp_reachability", check_ids)
            self.assertIn("transport_link_state", check_ids)
            self.assertIn("mavlink_packet_reception", check_ids)
            self.assertIn("pixhawk_heartbeat", check_ids)
            self.assertIn("telemetry_decoding", check_ids)
            self.assertIn("backend_health", check_ids)
            self.assertIn("backend_authentication", check_ids)
            self.assertIn("telemetry_ingestion", check_ids)
            self.assertIn("dashboard_socket_io", check_ids)

    @patch("subprocess.Popen")
    def test_start_with_custom_transport_and_backend(self, mock_popen):
        """Verifies POST /api/bridge/start accepts custom transport and backend URL."""
        fake_proc = MagicMock()
        fake_proc.pid = 88888
        fake_proc.poll.return_value = None
        fake_proc.stdout = None
        mock_popen.return_value = fake_proc

        req = urllib.request.Request(
            f"{self.base_url}/api/bridge/start",
            data=json.dumps({
                "transport": "dual",
                "backend_url": "https://aeron.onrender.com/api/v1",
                "drone_id": "AERON-HEX-01"
            }).encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-AERON-TOKEN": self.token
            }
        )
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))
            self.assertEqual(self.server.manager.transport, "DUAL")
            self.assertEqual(self.server.manager.backend_url, "https://aeron.onrender.com/api/v1")
            self.assertEqual(self.server.manager.drone_id, "AERON-HEX-01")

        fake_proc.poll.return_value = 0
        self.server.manager.managed_process = None
        self.server.manager.status = STATUS_BRIDGE_STOPPED
        self.server.manager.transport = "WIFI"


if __name__ == "__main__":
    unittest.main()
