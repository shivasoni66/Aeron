import time
import math
import logging
from datetime import datetime, timezone
from typing import Optional, Callable, List, Dict, Any
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

SCENARIOS = [
    "SLOW_ROUTE",
    "STATIONARY_BENCH",
    "GPS_ACQUISITION",
    "WAYPOINT_PROGRESSION",
    "BATTERY_CONSUMPTION",
    "CONNECTION_LOSS",
    "STALE_TELEMETRY",
    "RECONNECTION"
]

class DroneTelemetrySimulator:
    """
    Generates realistic, continuous simulated telemetry for AERON ground station bench testing.
    Supports deterministic movement scenarios, state controls (start, pause, resume, stop, reset),
    and rate tuning. All outputs are explicitly marked with source='simulation' and isSimulated=True.
    """

    def __init__(
        self,
        drone_id: Optional[str] = None,
        rate_hz: Optional[float] = None,
        base_lat: float = 12.9716,
        base_lon: float = 77.5946,
        base_alt: float = 42.4,
        scenario: str = "SLOW_ROUTE"
    ):
        self.drone_id = drone_id or config.drone_id
        self.rate_hz = rate_hz or config.simulator_rate_hz
        self.interval = 1.0 / max(self.rate_hz, 0.1)

        # Baseline coordinates matching GCS bench / scenario origin
        self.base_lat = base_lat
        self.base_lon = base_lon
        self.base_alt = base_alt

        self.scenario = scenario if scenario in SCENARIOS else "SLOW_ROUTE"
        self.state = "IDLE"  # IDLE, RUNNING, PAUSED, STOPPED
        self.tick_count = 0
        self.battery_voltage = 15.2
        self.battery_pct = 78
        self._history: List[Dict[str, Any]] = []
        self._max_history = 100

        # Waypoints for WAYPOINT_PROGRESSION scenario
        self.waypoints = [
            (self.base_lat + 0.0008, self.base_lon + 0.0004, 25.0),
            (self.base_lat + 0.0016, self.base_lon + 0.0012, 30.0),
            (self.base_lat + 0.0012, self.base_lon + 0.0022, 28.0),
            (self.base_lat + 0.0002, self.base_lon + 0.0018, 20.0),
            (self.base_lat, self.base_lon, 15.0)
        ]
        self.current_wp_index = 0
        self._last_snapshot: Optional[SimulatedTelemetryPayload] = None

    def select_scenario(self, scenario_name: str) -> bool:
        """Switches active simulation scenario and resets state counter."""
        if scenario_name not in SCENARIOS:
            logger.warning(f"Unknown scenario '{scenario_name}'. Valid: {SCENARIOS}")
            return False
        self.scenario = scenario_name
        self.tick_count = 0
        self.current_wp_index = 0
        logger.info(f"Simulator scenario set to: {self.scenario}")
        return True

    def set_rate_hz(self, rate_hz: float):
        """Adjusts the simulation tick rate."""
        self.rate_hz = max(0.1, min(rate_hz, 50.0))
        self.interval = 1.0 / self.rate_hz
        logger.info(f"Simulator update rate set to {self.rate_hz} Hz (interval: {self.interval:.3f}s)")

    def start(self):
        """Starts or unpauses the simulation."""
        self.state = "RUNNING"
        logger.info(f"Simulator [{self.drone_id}] started in scenario: {self.scenario}")

    def pause(self):
        """Pauses the simulation; position stops moving."""
        self.state = "PAUSED"
        logger.info(f"Simulator [{self.drone_id}] paused at tick {self.tick_count}")

    def resume(self):
        """Resumes a paused simulation."""
        if self.state == "PAUSED":
            self.state = "RUNNING"
            logger.info(f"Simulator [{self.drone_id}] resumed from tick {self.tick_count}")

    def stop(self):
        """Stops the simulation gracefully."""
        self.state = "STOPPED"
        logger.info(f"Simulator [{self.drone_id}] stopped.")

    def reset(self):
        """Resets simulation state to initial scenario baseline."""
        self.tick_count = 0
        self.current_wp_index = 0
        self.battery_voltage = 15.2
        self.battery_pct = 78
        self._history.clear()
        self._last_snapshot = None
        self.state = "IDLE"
        logger.info(f"Simulator [{self.drone_id}] reset to baseline.")

    def get_status(self) -> Dict[str, Any]:
        """Returns the current simulator execution status."""
        pos = self.get_current_position()
        return {
            "droneId": self.drone_id,
            "state": self.state,
            "scenario": self.scenario,
            "rateHz": self.rate_hz,
            "tickCount": self.tick_count,
            "currentPosition": {
                "latitude": pos[0],
                "longitude": pos[1],
                "altitude": pos[2],
                "heading": pos[3]
            },
            "historyCount": len(self._history),
            "availableScenarios": SCENARIOS
        }

    def get_current_position(self) -> tuple:
        """Returns current (lat, lon, alt, heading) from last snapshot or base."""
        if self._last_snapshot and self._last_snapshot.gps and self._last_snapshot.dynamics:
            return (
                self._last_snapshot.gps.latitude,
                self._last_snapshot.gps.longitude,
                self._last_snapshot.gps.altitude_msl,
                self._last_snapshot.dynamics.heading
            )
        return (self.base_lat, self.base_lon, self.base_alt, 0.0)

    def get_telemetry_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns the most recent persisted snapshot history."""
        return self._history[-limit:]

    def generate_snapshot(self) -> SimulatedTelemetryPayload:
        """Constructs a single contract-valid telemetry snapshot based on active scenario."""
        if self.state != "PAUSED":
            self.tick_count += 1
        t = self.tick_count * self.interval
        now_iso = datetime.now(timezone.utc).isoformat()

        # Route variables
        lat = self.base_lat
        lon = self.base_lon
        alt = self.base_alt
        rel_alt = 0.0
        ground_speed = 0.0
        heading = 0.0
        roll = 0.0
        pitch = 0.0
        yaw = 0.0
        flight_mode = "STANDBY"
        armed = False
        fix_type = "3D DGPS FIX"
        satellites = 10
        hdop = 0.8
        conn_status = "CONNECTED"
        heartbeat_age = 80
        voltage = 15.2
        remaining_pct = 78

        if self.scenario == "STATIONARY_BENCH":
            # Stationary bench: zero ground speed, minimal sensor noise, disarmed
            lat = self.base_lat + 0.000002 * math.sin(0.1 * t)
            lon = self.base_lon + 0.000002 * math.cos(0.1 * t)
            alt = self.base_alt + 0.05 * math.sin(0.2 * t)
            rel_alt = 0.0
            ground_speed = 0.0
            heading = 45.0
            flight_mode = "MANUAL / BENCH"
            armed = False
            satellites = 9
            hdop = 0.9
            voltage = 15.1
            remaining_pct = 82

        elif self.scenario == "GPS_ACQUISITION":
            # Progresses from no satellites to sub-meter 3D lock
            cycle_tick = self.tick_count % 60
            if cycle_tick < 15:
                fix_type = "NO_FIX"
                satellites = 2
                hdop = 9.9
                lat = self.base_lat
                lon = self.base_lon
            elif cycle_tick < 30:
                fix_type = "2D_FIX"
                satellites = 5
                hdop = 3.5
                lat = self.base_lat
                lon = self.base_lon
            elif cycle_tick < 45:
                fix_type = "3D_FIX"
                satellites = 8
                hdop = 1.4
                lat = self.base_lat
                lon = self.base_lon
            else:
                fix_type = "3D DGPS FIX"
                satellites = 14
                hdop = 0.72
                lat = self.base_lat
                lon = self.base_lon
            flight_mode = "ACQUIRING GNSS"
            armed = False

        elif self.scenario == "SLOW_ROUTE":
            # Gentle orbital flight corridor (~50m radius)
            radius_deg = 0.0004
            orbit_speed = 0.15  # rad/s
            lat = self.base_lat + radius_deg * math.sin(orbit_speed * t)
            lon = self.base_lon + radius_deg * math.cos(orbit_speed * t)
            alt = self.base_alt + 18.0 + 1.2 * math.sin(0.1 * t)
            rel_alt = alt - self.base_alt
            ground_speed = 6.4 + 0.6 * math.sin(0.2 * t)
            heading = (math.degrees(orbit_speed * t) + 90) % 360.0
            roll = round(4.5 * math.sin(orbit_speed * t), 2)
            pitch = round(1.2 * math.cos(orbit_speed * t), 2)
            yaw = heading
            flight_mode = "AUTO / CORRIDOR"
            armed = True
            voltage = max(14.2, 15.2 - (self.tick_count * 0.0002))
            remaining_pct = max(20, int(80 - (self.tick_count * 0.004)))

        elif self.scenario == "WAYPOINT_PROGRESSION":
            # Advances along 5 distinct waypoints
            target_wp = self.waypoints[self.current_wp_index]
            target_lat, target_lon, target_alt = target_wp

            curr_lat, curr_lon, curr_alt, _ = self.get_current_position()
            dlat = target_lat - curr_lat
            dlon = target_lon - curr_lon
            dist = math.sqrt(dlat**2 + dlon**2)

            step = 0.00008  # ~8 meters per tick
            if dist < step:
                # Arrived at waypoint, advance to next
                self.current_wp_index = (self.current_wp_index + 1) % len(self.waypoints)
                lat = target_lat
                lon = target_lon
                alt = self.base_alt + target_alt
            else:
                ratio = step / dist
                lat = curr_lat + dlat * ratio
                lon = curr_lon + dlon * ratio
                alt = self.base_alt + target_alt

            rel_alt = alt - self.base_alt
            ground_speed = 7.5
            heading = (math.degrees(math.atan2(dlon, dlat)) + 360.0) % 360.0
            flight_mode = f"WAYPOINT {self.current_wp_index + 1}/5"
            armed = True
            voltage = max(14.3, 15.4 - (self.tick_count * 0.0003))
            remaining_pct = max(25, int(85 - (self.tick_count * 0.005)))

        elif self.scenario == "BATTERY_CONSUMPTION":
            # Realistic 4S LiPo discharge curve
            lat = self.base_lat + 0.0001 * math.sin(0.1 * t)
            lon = self.base_lon + 0.0001 * math.cos(0.1 * t)
            alt = self.base_alt + 12.0
            rel_alt = 12.0
            ground_speed = 3.2
            heading = 180.0
            flight_mode = "LOITER"
            armed = True
            # Drops from 16.6V (100%) to 13.8V (critical) over 120 ticks
            drain_fraction = min(1.0, (self.tick_count % 120) / 120.0)
            voltage = round(16.6 - (drain_fraction * 2.8), 2)
            remaining_pct = max(5, int(100 - (drain_fraction * 95)))
            if remaining_pct < 20:
                flight_mode = "BATTERY FAILSAFE RTL"

        elif self.scenario == "CONNECTION_LOSS":
            # Telemetry for first 15 ticks, then link drops
            lat = self.base_lat
            lon = self.base_lon
            alt = self.base_alt + 5.0
            rel_alt = 5.0
            if (self.tick_count % 40) >= 15:
                conn_status = "LOST"
                heartbeat_age = 6500
                flight_mode = "LINK LOSS FAILSAFE"
            else:
                conn_status = "CONNECTED"
                heartbeat_age = 90
                flight_mode = "GUIDED"
            armed = True

        elif self.scenario == "STALE_TELEMETRY":
            # Frozen coordinates with increasing heartbeat age
            lat = self.base_lat + 0.0002
            lon = self.base_lon + 0.0002
            alt = self.base_alt + 10.0
            rel_alt = 10.0
            ground_speed = 0.0
            heading = 90.0
            conn_status = "STALE"
            heartbeat_age = min(30000, 200 + (self.tick_count * 200))
            flight_mode = "STALE BUFFER"
            armed = True

        elif self.scenario == "RECONNECTION":
            # Alternates disconnected -> reconnecting -> connected
            phase = (self.tick_count % 30)
            if phase < 10:
                conn_status = "DISCONNECTED"
                heartbeat_age = 12000
                satellites = 0
                fix_type = "NO_FIX"
            elif phase < 15:
                conn_status = "RECONNECTING"
                heartbeat_age = 450
                satellites = 4
                fix_type = "2D_FIX"
            else:
                conn_status = "CONNECTED"
                heartbeat_age = 60
                satellites = 11
                fix_type = "3D DGPS FIX"
            lat = self.base_lat
            lon = self.base_lon
            alt = self.base_alt
            flight_mode = "RECOVERING"
            armed = False

        snapshot = SimulatedTelemetryPayload(
            drone_id=self.drone_id,
            timestamp=now_iso,
            source="simulation",
            is_simulated=True,
            connection=ConnectionTelemetry(
                status=conn_status,
                heartbeat_age_ms=heartbeat_age
            ),
            flight=FlightTelemetry(
                armed=armed,
                flight_mode=flight_mode,
                system_status="STANDBY"
            ),
            gps=GPSTelemetry(
                latitude=round(lat, 7),
                longitude=round(lon, 7),
                altitude_msl=round(alt, 2),
                relative_altitude=round(rel_alt, 2),
                fix_type=fix_type,
                satellites_visible=satellites,
                hdop=hdop
            ),
            dynamics=DynamicsTelemetry(
                ground_speed=round(ground_speed, 2),
                heading=round(heading, 1),
                vertical_speed=round(0.1 * math.cos(0.1 * t), 2),
                roll_deg=roll,
                pitch_deg=pitch,
                yaw_deg=yaw
            ),
            battery=BatteryTelemetry(
                voltage=round(voltage, 2),
                current=1.2,
                remaining_percentage=remaining_pct
            )
        )

        self._last_snapshot = snapshot
        payload_dict = snapshot.to_dict()
        self._history.append(payload_dict)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        return snapshot

    def run(self, callback: Optional[Callable[[dict], None]] = None, max_iterations: Optional[int] = None):
        """Runs the simulation loop at configured rate until stopped."""
        self.state = "RUNNING"
        logger.info(f"Starting Drone Telemetry Simulator [{self.drone_id}] scenario='{self.scenario}' at {self.rate_hz} Hz")

        iterations = 0
        try:
            while self.state in ("RUNNING", "PAUSED"):
                if self.state == "RUNNING":
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
