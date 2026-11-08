import sys
import signal
import json
import logging
from .config import config
from .simulator import DroneTelemetrySimulator

logging.basicConfig(
    level=getattr(logging, config.log_level, logging.INFO),
    format="[%(asctime)s] [%(levelname)s] [AERON-BRIDGE] %(message)s"
)
logger = logging.getLogger("AERON-BRIDGE")

def main():
    logger.info("==================================================")
    logger.info("AERON LOCAL GROUND STATION TELEMETRY BRIDGE")
    logger.info(f"Target Drone ID      : {config.drone_id}")
    logger.info(f"Simulator Enabled    : {config.simulator_enabled}")
    logger.info(f"Simulation Rate (Hz) : {config.simulator_rate_hz}")
    logger.info(f"Backend Ingest URL   : {config.backend_ingest_url}")
    logger.info("==================================================")

    if not config.simulator_enabled:
        logger.warning("Simulator is disabled in configuration. Set SIMULATOR_ENABLED=true to run mock telemetry.")
        sys.exit(0)

    simulator = DroneTelemetrySimulator(
        drone_id=config.drone_id,
        rate_hz=config.simulator_rate_hz
    )

    def handle_shutdown(signum, frame):
        logger.info(f"Signal {signum} received. Initiating graceful shutdown...")
        simulator.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    def telemetry_callback(payload: dict):
        # Print sample to console or transmit to backend
        summary = (
            f"[{payload['timestamp']}] {payload['droneId']} | "
            f"Mode: {payload['flight']['flightMode']} | "
            f"Alt: {payload['gps']['altitudeMsl']}m | "
            f"Spd: {payload['dynamics']['groundSpeed']}m/s | "
            f"Batt: {payload['battery']['voltage']}V ({payload['battery']['remainingPercentage']}%) | "
            f"Sim: {payload['isSimulated']}"
        )
        logger.info(summary)

    simulator.run(callback=telemetry_callback)

if __name__ == "__main__":
    main()

