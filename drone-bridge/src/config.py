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
    simulator_enabled: bool = os.getenv("SIMULATOR_ENABLED", "true").lower() in ("true", "1", "yes")
    simulator_rate_hz: float = float(os.getenv("SIMULATOR_RATE_HZ", "10.0"))
    drone_id: str = os.getenv("DRONE_ID", "AERON-PX4-BENCH01")
    backend_ingest_url: str = os.getenv("BACKEND_INGEST_URL", "http://localhost:5000/api/v1/telemetry/ingest")
    drone_bridge_token: str = os.getenv("DRONE_BRIDGE_TOKEN", "aeron_drone_bridge_secret_token_dev")
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()

config = BridgeConfig()
