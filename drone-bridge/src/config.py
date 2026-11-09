import os
from dataclasses import dataclass

# Attempt to load dotenv if available, otherwise read standard environment
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

@dataclass(frozen=True)
class BridgeConfig:
    # MAVLink Serial / Network Connection
    mavlink_connection: str = os.getenv("MAVLINK_CONNECTION", "COM9")
    mavlink_baud: int = int(os.getenv("MAVLINK_BAUD", "57600"))
    mavlink_source: str = os.getenv("MAVLINK_SOURCE", "REAL").upper()

    # Airframe Identification
    drone_id: str = os.getenv("DRONE_ID", "AERON-PX4-BENCH01")

    # Backend Transport Configuration
    aeron_backend_url: str = os.getenv("AERON_BACKEND_URL", "http://localhost:5000/api/v1")
    backend_ingest_url: str = os.getenv(
        "BACKEND_INGEST_URL",
        os.getenv("AERON_BACKEND_URL", "http://localhost:5000/api/v1").rstrip("/") + "/telemetry/ingest"
    )
    drone_bridge_token: str = os.getenv("DRONE_BRIDGE_TOKEN", "aeron_drone_bridge_secret_token_dev")

    # Rate, Queue and Freshness Tuning
    telemetry_persist_interval_ms: int = int(os.getenv("TELEMETRY_PERSIST_INTERVAL_MS", "250"))
    heartbeat_timeout_seconds: float = float(os.getenv("HEARTBEAT_TIMEOUT_SECONDS", "3.0"))
    queue_max_size: int = int(os.getenv("QUEUE_MAX_SIZE", "500"))

    # Simulation Fallback
    simulator_enabled: bool = os.getenv("SIMULATOR_ENABLED", "false").lower() in ("true", "1", "yes")
    simulator_rate_hz: float = float(os.getenv("SIMULATOR_RATE_HZ", "10.0"))

    # Logging
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()

config = BridgeConfig()
