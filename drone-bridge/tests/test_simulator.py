import unittest
import sys
import os

# Ensure parent directory is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.simulator import DroneTelemetrySimulator
from src.models import SimulatedTelemetryPayload

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

if __name__ == "__main__":
    unittest.main()
