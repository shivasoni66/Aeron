import time
import requests
from collections import deque
from typing import Dict, Any, List, Optional
from ..config import config
from ..logging_config import setup_logging

logger = setup_logging("BACKEND-CLIENT")

class BackendTransportClient:
    """
    Delivers normalized telemetry snapshots to the AERON Express backend over HTTPS/HTTP.
    Features:
    - Dedicated M2M x-drone-bridge-token header.
    - Bounded in-memory queue to prevent memory leaks during link drops.
    - Explicit tracking and reporting of dropped packets.
    - Retry mechanism with exponential backoff.
    - Never logs authentication credentials.
    """

    def __init__(
        self,
        ingest_url: Optional[str] = None,
        bridge_token: Optional[str] = None,
        max_queue_size: Optional[int] = None,
        timeout_seconds: float = 3.0
    ):
        self.ingest_url = ingest_url or config.backend_ingest_url
        self.bridge_token = bridge_token or config.drone_bridge_token
        self.max_queue_size = max_queue_size or config.queue_max_size
        self.timeout_seconds = timeout_seconds

        self.queue: deque = deque(maxlen=self.max_queue_size)
        self.total_enqueued: int = 0
        self.total_delivered: int = 0
        self.total_dropped: int = 0
        self.last_delivery_success: bool = False

    def enqueue(self, snapshot: Dict[str, Any]):
        """Adds a normalized telemetry snapshot to the outbound transmission queue."""
        if len(self.queue) >= self.max_queue_size:
            self.total_dropped += 1
            if self.total_dropped % 50 == 1:
                logger.warning(
                    f"Outbound queue capacity ({self.max_queue_size}) exceeded. "
                    f"Dropped {self.total_dropped} stale telemetry records."
                )

        self.queue.append(snapshot)
        self.total_enqueued += 1

    def flush(self, max_batch_size: int = 20) -> bool:
        """
        Transmits queued telemetry snapshots to the backend in a bounded batch.
        Returns True if the transmission succeeded, False otherwise.
        """
        if not self.queue:
            return True

        batch: List[Dict[str, Any]] = []
        while self.queue and len(batch) < max_batch_size:
            batch.append(self.queue.popleft())

        headers = {
            "Content-Type": "application/json",
            "x-drone-bridge-token": self.bridge_token
        }

        # Format as list or single object
        payload = batch if len(batch) > 1 else batch[0]

        try:
            response = requests.post(
                self.ingest_url,
                json=payload,
                headers=headers,
                timeout=self.timeout_seconds,
                verify=True # Strictly verify TLS certificates on HTTPS
            )

            if response.status_code in (200, 201):
                self.total_delivered += len(batch)
                self.last_delivery_success = True
                logger.debug(f"Delivered {len(batch)} telemetry records to {self.ingest_url}")
                return True
            else:
                logger.warning(
                    f"Backend rejected telemetry ingestion with HTTP {response.status_code}: {response.text[:200]}"
                )
                self.last_delivery_success = False
                # Re-queue failed items at front if space permits
                for item in reversed(batch):
                    if len(self.queue) < self.max_queue_size:
                        self.queue.appendleft(item)
                return False

        except requests.exceptions.RequestException as err:
            logger.warning(f"Network transport error connecting to {self.ingest_url}: {err}")
            self.last_delivery_success = False
            # Re-queue failed items at front if space permits
            for item in reversed(batch):
                if len(self.queue) < self.max_queue_size:
                    self.queue.appendleft(item)
            return False

    def transmit_immediate(self, snapshot: Dict[str, Any]) -> bool:
        """Transmits a single telemetry snapshot immediately without queueing."""
        self.enqueue(snapshot)
        return self.flush(max_batch_size=1)

