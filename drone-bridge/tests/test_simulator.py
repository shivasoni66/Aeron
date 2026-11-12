import unittest
import sys
import os

# Ensure parent directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.simulator import DroneTelemetrySimulator, SCENARIOS
from src.models import SimulatedTelemetryPayload
from src.providers import (
    SimulationTelemetryProvider,
    SimulationCameraProvider,
    SimulationLocationProvider
)

class TestDroneTelemetrySimulator(unittest.TestCase):
    def setUp(self):
        self.simulator = DroneTelemetrySimulator(
            drone_id="TEST-DRONE-01",
            rate_hz=20.0
        )

    def test_explicit_simulation_flags(self):
        snapshot = self.simulator.generate_snapshot()
        payload = snapshot.to_dict()

        # Strict Requirement: source must be 'simulation' and isSimulated must be True
        self.assertEqual(payload["source"], "simulation")
        self.assertTrue(payload["isSimulated"])
        self.assertEqual(payload["droneId"], "TEST-DRONE-01")

    def test_telemetry_ranges(self):
        snapshot = self.simulator.generate_snapshot()
        payload = snapshot.to_dict()

        # Coordinates must be valid latitudes/longitudes
        lat = payload["gps"]["latitude"]
        lon = payload["gps"]["longitude"]
        self.assertTrue(-90.0 <= lat <= 90.0)
        self.assertTrue(-180.0 <= lon <= 180.0)

        # Battery voltage must be within reasonable 4S LiPo limits (14.0V - 16.8V)
        volt = payload["battery"]["voltage"]
        self.assertTrue(14.0 <= volt <= 16.8)

        # Battery percentage must be between 0 and 100
        pct = payload["battery"]["remainingPercentage"]
        self.assertTrue(0 <= pct <= 100)

        # Altitude and speed must be positive
        self.assertGreater(payload["gps"]["altitudeMsl"], 0)
        self.assertGreaterEqual(payload["dynamics"]["groundSpeed"], 0)

    def test_iteration_loop(self):
        collected = []
        self.simulator.run(callback=lambda p: collected.append(p), max_iterations=5)
        self.assertEqual(len(collected), 5)
        for p in collected:
            self.assertTrue(p["isSimulated"])

    def test_scenarios_deterministic_execution(self):
        """Verifies that all 8 scenarios execute and produce contract-valid payloads."""
        self.assertEqual(len(SCENARIOS), 8)
        for sc in SCENARIOS:
            success = self.simulator.select_scenario(sc)
            self.assertTrue(success)
            self.assertEqual(self.simulator.scenario, sc)

            snap = self.simulator.generate_snapshot()
            data = snap.to_dict()
            self.assertEqual(data["source"], "simulation")
            self.assertTrue(data["isSimulated"])
            self.assertIsNotNone(data["gps"])
            self.assertIsNotNone(data["dynamics"])
            self.assertIsNotNone(data["battery"])

    def test_state_controls_lifecycle(self):
        """Verifies start, pause, resume, stop, and reset transitions."""
        self.simulator.start()
        self.assertEqual(self.simulator.state, "RUNNING")

        pos1 = self.simulator.generate_snapshot().gps.latitude
        self.simulator.pause()
        self.assertEqual(self.simulator.state, "PAUSED")

        # In paused state, position must not increment
        pos2 = self.simulator.generate_snapshot().gps.latitude
        self.assertEqual(pos1, pos2)

        self.simulator.resume()
        self.assertEqual(self.simulator.state, "RUNNING")

        self.simulator.stop()
        self.assertEqual(self.simulator.state, "STOPPED")

        self.simulator.reset()
        self.assertEqual(self.simulator.state, "IDLE")
        self.assertEqual(self.simulator.tick_count, 0)

    def test_provider_abstractions(self):
        """Tests SimulationTelemetryProvider, SimulationCameraProvider, and SimulationLocationProvider."""
        tel_prov = SimulationTelemetryProvider(drone_id="SIM-ALPHA", scenario="SLOW_ROUTE")
        self.assertEqual(tel_prov.data_source, "SIMULATION")
        tel_prov.connect()

        snap = tel_prov.read_telemetry()
        self.assertIsNotNone(snap)
        self.assertEqual(snap["source"], "SIMULATION")
        self.assertTrue(snap["isSimulated"])

        loc_prov = SimulationLocationProvider(tel_prov)
        self.assertEqual(loc_prov.data_source, "SIMULATION")
        loc = loc_prov.get_location()
        self.assertIsNotNone(loc)
        self.assertEqual(loc["dataSource"], "SIMULATION")

        cam_prov = SimulationCameraProvider(drone_id="SIM-ALPHA")
        self.assertEqual(cam_prov.data_source, "SIMULATION")
        cam_prov.connect()
        frame = cam_prov.capture_frame(loc["latitude"], loc["longitude"], loc["altitude"], loc["heading"])
        self.assertIsNotNone(frame)
        self.assertEqual(frame.drone_id, "SIM-ALPHA")
        self.assertEqual(frame.mime_type, "image/jpeg")

if __name__ == "__main__":
    unittest.main()
