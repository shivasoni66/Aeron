import unittest
from unittest.mock import patch, MagicMock
import requests

from src.transport.backend_client import BackendTransportClient

class TestBackendTransportClient(unittest.TestCase):

    def test_bounded_queue_capacity_and_drop_tracking(self):
        client = BackendTransportClient(
            ingest_url="http://localhost:5000/api/v1/telemetry/ingest",
            bridge_token="secret_token",
            max_queue_size=5
        )

        # Enqueue 8 records (capacity is 5)
        for i in range(8):
            client.enqueue({"droneId": "DRONE-01", "index": i})

        self.assertEqual(len(client.queue), 5)
        self.assertEqual(client.total_enqueued, 8)
        self.assertEqual(client.total_dropped, 3)
        # Oldest records (0, 1, 2) were dropped; oldest remaining is 3
        self.assertEqual(client.queue[0]["index"], 3)
        self.assertEqual(client.queue[-1]["index"], 7)

    @patch("requests.post")
    def test_successful_flush_and_header_injection(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_post.return_value = mock_response

        client = BackendTransportClient(
            ingest_url="https://aeron-api.sharprad-x.tech/api/v1/telemetry/ingest",
            bridge_token="my_m2m_secret_token",
            max_queue_size=10
        )

        client.enqueue({"droneId": "AERON-HEX-01", "voltage": 15.2})
        client.enqueue({"droneId": "AERON-HEX-01", "voltage": 15.1})

        success = client.flush(max_batch_size=10)
        self.assertTrue(success)
        self.assertEqual(client.total_delivered, 2)
        self.assertEqual(len(client.queue), 0)

        # Verify headers passed to requests.post
        mock_post.assert_called_once()
        _, kwargs = mock_post.call_args
        headers = kwargs.get("headers", {})
        self.assertEqual(headers["x-drone-bridge-token"], "my_m2m_secret_token")
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertTrue(kwargs.get("verify")) # TLS verification enabled

    @patch("requests.post")
    def test_requeue_on_network_failure(self, mock_post):
        mock_post.side_effect = requests.exceptions.ConnectionError("Connection refused")

        client = BackendTransportClient(
            ingest_url="http://localhost:5000/api/v1/telemetry/ingest",
            bridge_token="secret_token",
            max_queue_size=10
        )

        sample = {"droneId": "AERON-HEX-01", "seq": 1}
        client.enqueue(sample)
        self.assertEqual(len(client.queue), 1)

        success = client.flush()
        self.assertFalse(success)
        self.assertFalse(client.last_delivery_success)
        # Sample should be re-queued so it is not lost
        self.assertEqual(len(client.queue), 1)
        self.assertEqual(client.queue[0]["seq"], 1)

    @patch("requests.post")
    def test_requeue_on_http_500_server_error(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal server error"
        mock_post.return_value = mock_response

        client = BackendTransportClient(
            ingest_url="http://localhost:5000/api/v1/telemetry/ingest",
            bridge_token="secret_token",
            max_queue_size=10
        )

        client.enqueue({"droneId": "AERON-HEX-01", "seq": 42})
        success = client.flush()
        self.assertFalse(success)
        self.assertEqual(len(client.queue), 1)

if __name__ == "__main__":
    unittest.main()

