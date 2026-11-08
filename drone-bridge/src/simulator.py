import time
import math
import logging
from datetime import datetime, timezone
from typing import Optional, Callable
from .config import config
from .models import (
    SimulatedTelemetryPayload,
    ConnectionTelemetry,
    FlightTelemetry,
    GPSTelemetry,
    DynamicsTelemetry,
    BatteryTelemetry
)

logger = logging.getLogger("AERON-SIMULATOR")

class DroneTelemetrySimulator:
    """
    Generates realistic, continuous simulated telemetry for AERON ground station bench testing.
    All outputs are explicitly marked with source='simulation' and isSimulated=True.
    """

    def __init__(
        self,
        drone_id: Optional[str] = None,
        rate_hz: Optional[float] = None,
        base_lat: float = 12.9716,
        base_lon: float = 77.5946,
        base_alt: float = 42.4
    ):
        self.drone_id = drone_id or config.drone_id
        self.rate_hz = rate_hz or config.simulator_rate_hz
        self.interval = 1.0 / max(self.rate_hz, 0.1)

        # Baseline coordinates matching Admin GCS bench reference
        self.base_lat = base_lat
        self.base_lon = base_lon
        self.base_alt = base_alt

        self.running = False
        self.tick_count = 0
        self.battery_voltage = 15.2
        self.battery_pct = 78

    def generate_snapshot(self) -> SimulatedTelemetryPayload:
        """Constructs a single normalized simulated telemetry snapshot."""
        self.tick_count += 1
        t = self.tick_count * self.interval

        # Gentle orbital dynamics simulation
        radius_deg = 0.0003  # ~30 meters
        orbit_speed = 0.2    # rad/s
        current_lat = self.base_lat + radius_deg * math.sin(orbit_speed * t)
        current_lon = self.base_lon + radius_deg * math.cos(orbit_speed * t)

        current_alt = self.base_alt + 1.5 * math.sin(0.1 * t)
        ground_speed = 7.2 + 0.8 * math.sin(0.3 * t)
        heading = (math.degrees(orbit_speed * t) + 90) % 360.0

        # Slow realistic battery discharge simulation
        voltage = max(14.1, 15.2 - (self.tick_count * 0.0001))
        remaining_pct = max(15, int(78 - (self.tick_count * 0.002)))

        now_iso = datetime.now(timezone.utc).isoformat()

        return SimulatedTelemetryPayload(
            drone_id=self.drone_id,
            timestamp=now_iso,
            source="simulation",
            is_simulated=True,
            connection=ConnectionTelemetry(
                status="connected",
                heartbeat_age_ms=85
            ),
            flight=FlightTelemetry(
                armed=True,
                flight_mode="POSHOLD TEST",
                system_status="STANDBY"
            ),
            gps=GPSTelemetry(
                latitude=round(current_lat, 7),
                longitude=round(current_lon, 7),
                altitude_msl=round(current_alt, 2),
                relative_altitude=round(current_alt - 10.0, 2),
                fix_type="3D DGPS FIX",
                satellites_visible=8,
                hdop=0.82
            ),
            dynamics=DynamicsTelemetry(
                ground_speed=round(ground_speed, 2),
                heading=round(heading, 1),
                vertical_speed=round(0.1 * math.cos(0.1 * t), 2),
                roll_deg=round(1.2 * math.sin(0.5 * t), 2),
                pitch_deg=round(0.8 * math.cos(0.5 * t), 2),
                yaw_deg=round(heading, 1)
            ),
            battery=BatteryTelemetry(
                voltage=round(voltage, 2),
                current=1.2,
                remaining_percentage=remaining_pct
            )
        )

    def run(self, callback: Optional[Callable[[dict], None]] = None, max_iterations: Optional[int] = None):
        """Runs the simulation loop at the configured rate."""
        self.running = True
        logger.info(f"Starting Drone Telemetry Simulator [{self.drone_id}] at {self.rate_hz} Hz")

        iterations = 0
        try:
            while self.running:
                snapshot = self.generate_snapshot()
                payload = snapshot.to_dict()

                if callback:
                    callback(payload)

                iterations += 1
                if max_iterations and iterations >= max_iterations:
                    break

                time.sleep(self.interval)
        except KeyboardInterrupt:
            logger.info("Keyboard interrupt received. Stopping simulator...")
        finally:
            self.stop()

    def stop(self):
        """Gracefully terminates the simulation loop."""
        self.running = False
        logger.info("Drone Telemetry Simulator stopped.")

