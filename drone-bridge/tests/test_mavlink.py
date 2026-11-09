import unittest
import math
import time
from typing import Any

from src.mavlink.parser import MAVLinkParser
from src.mavlink.health import SubsystemHealthTracker
from src.mavlink.telemetry import TelemetryAggregator

class MockMAVLinkMessage:
    """Helper mock object mimicking pymavlink MAVLink message classes."""
    def __init__(self, msg_type: str, **kwargs):
        self._msg_type = msg_type
        for k, v in kwargs.items():
            setattr(self, k, v)

    def get_type(self) -> str:
        return self._msg_type

    def get_srcSystem(self) -> int:
        return getattr(self, "sysid", 1)

    def get_srcComponent(self) -> int:
        return getattr(self, "compid", 1)


class TestMAVLinkParser(unittest.TestCase):

    def test_heartbeat_parsing_and_armed_state(self):
        # Base mode 129 has bit 7 set (128 = ARMED) and bit 0 set (1 = CUSTOM_MODE)
        msg_armed = MockMAVLinkMessage(
            "HEARTBEAT",
            sysid=1,
            compid=1,
            type=2, # Quadrotor
            autopilot=3, # ArduPilot
            base_mode=129,
            custom_mode=16, # POSHOLD
            system_status=4, # MAV_STATE_ACTIVE
            mavlink_version=2
        )

        parsed = MAVLinkParser.parse_heartbeat(msg_armed)
        self.assertEqual(parsed["systemId"], 1)
        self.assertEqual(parsed["componentId"], 1)
        self.assertTrue(parsed["armed"])
        self.assertEqual(parsed["flightMode"], "POSHOLD")
        self.assertEqual(parsed["mavlinkVersion"], 2)

        # Base mode 1 has bit 7 cleared (DISARMED)
        msg_disarmed = MockMAVLinkMessage(
            "HEARTBEAT",
            base_mode=1,
            custom_mode=0 # STABILIZE
        )
        parsed_disarmed = MAVLinkParser.parse_heartbeat(msg_disarmed)
        self.assertFalse(parsed_disarmed["armed"])
        self.assertEqual(parsed_disarmed["flightMode"], "STABILIZE")

    def test_global_position_int_conversions(self):
        msg = MockMAVLinkMessage(
            "GLOBAL_POSITION_INT",
            lat=129716000,       # 12.9716 degrees
            lon=775946000,       # 77.5946 degrees
            alt=42400,           # 42.4 meters MSL
            relative_alt=12100,  # 12.1 meters AGL
            vx=300,              # 3.0 m/s north
            vy=400,              # 4.0 m/s east -> 5.0 m/s ground speed
            hdg=4500             # 45.0 degrees heading
        )

        parsed = MAVLinkParser.parse_global_position_int(msg)
        self.assertAlmostEqual(parsed["latitude"], 12.9716, places=4)
        self.assertAlmostEqual(parsed["longitude"], 77.5946, places=4)
        self.assertEqual(parsed["altitude"], 42.4)
        self.assertEqual(parsed["relativeAltitude"], 12.1)
        self.assertEqual(parsed["groundSpeed"], 5.0) # sqrt(3^2 + 4^2) = 5
        self.assertEqual(parsed["heading"], 45.0)

    def test_global_position_invalid_sentinels(self):
        # 65535 heading is MAVLink sentinel for unavailable heading
        msg = MockMAVLinkMessage(
            "GLOBAL_POSITION_INT",
            lat=0,
            lon=0,
            alt=0,
            relative_alt=0,
            vx=0,
            vy=0,
            hdg=65535
        )
        parsed = MAVLinkParser.parse_global_position_int(msg)
        self.assertIsNone(parsed["latitude"])
        self.assertIsNone(parsed["longitude"])
        self.assertIsNone(parsed["heading"])

    def test_gps_raw_int_parsing_and_no_heading_substitution(self):
        msg = MockMAVLinkMessage(
            "GPS_RAW_INT",
            fix_type=3,          # 3D Fix
            lat=129716000,
            lon=775946000,
            alt=42400,
            satellites_visible=12,
            eph=95,              # HDOP 0.95
            cog=27000            # Course over ground 270.0 deg (separate from aircraft heading!)
        )

        parsed = MAVLinkParser.parse_gps_raw_int(msg)
        self.assertEqual(parsed["gpsFixType"], "3D_FIX")
        self.assertEqual(parsed["satellites"], 12)
        self.assertEqual(parsed["hdop"], 0.95)
        self.assertEqual(parsed["courseOverGround"], 270.0)
        # Course over ground must not be stored as heading
        self.assertNotIn("heading", parsed)

    def test_sys_status_battery_and_sensor_health(self):
        msg = MockMAVLinkMessage(
            "SYS_STATUS",
            voltage_battery=15240, # 15.24 V
            current_battery=125,   # 1.25 A
            battery_remaining=82,  # 82%
            onboard_control_sensors_present=0x1FF,
            onboard_control_sensors_enabled=0x1FF,
            onboard_control_sensors_health=0x1FF
        )

        parsed = MAVLinkParser.parse_sys_status(msg)
        self.assertEqual(parsed["batteryVoltage"], 15.24)
        self.assertEqual(parsed["batteryCurrent"], 1.25)
        self.assertEqual(parsed["batteryPercentage"], 82)
        self.assertTrue(parsed["sensorHealth"]["imu"])
        self.assertTrue(parsed["sensorHealth"]["gps"])
        self.assertTrue(parsed["sensorHealth"]["compass"])

    def test_attitude_radians_to_degrees_conversion(self):
        msg = MockMAVLinkMessage(
            "ATTITUDE",
            roll=0.174533,  # ~10.0 degrees
            pitch=-0.087266, # ~-5.0 degrees
            yaw=1.570796    # ~90.0 degrees
        )

        parsed = MAVLinkParser.parse_attitude(msg)
        self.assertAlmostEqual(parsed["roll"], 10.0, places=1)
        self.assertAlmostEqual(parsed["pitch"], -5.0, places=1)
        self.assertAlmostEqual(parsed["yaw"], 90.0, places=1)


class TestSubsystemHealthTracker(unittest.TestCase):

    def test_heartbeat_timeout_transitions(self):
        tracker = SubsystemHealthTracker(heartbeat_timeout=0.1)
        tracker.record_port_state(True)

        self.assertEqual(tracker.pixhawk_heartbeat_status, "AWAITING_FIRST_HEARTBEAT")

        # Record heartbeat -> HEALTHY
        tracker.record_heartbeat()
        self.assertEqual(tracker.pixhawk_heartbeat_status, "HEALTHY")

        # Wait past timeout -> STALE then DISCONNECTED
        time.sleep(0.12)
        self.assertIn(tracker.pixhawk_heartbeat_status, ("STALE", "DISCONNECTED"))

        time.sleep(0.22)
        self.assertEqual(tracker.pixhawk_heartbeat_status, "DISCONNECTED")

    def test_subsystem_decoupling(self):
        tracker = SubsystemHealthTracker(heartbeat_timeout=1.0)
        tracker.record_port_state(True)
        tracker.record_heartbeat()
        tracker.record_gps_state("NO_FIX", 0, None)
        tracker.record_backend_delivery(True)

        snapshot = tracker.snapshot()
        # Pixhawk can be HEALTHY while GPS is NO_FIX and Camera is NOT_CONNECTED
        self.assertEqual(snapshot["pixhawkFC"], "HEALTHY")
        self.assertEqual(snapshot["gpsFix"], "NO_FIX")
        self.assertEqual(snapshot["cameraModule"], "NOT_CONNECTED")
        self.assertEqual(snapshot["backendTransport"], "ONLINE")


class TestTelemetryAggregator(unittest.TestCase):

    def test_strict_source_and_simulation_flags(self):
        # Real hardware aggregator
        real_agg = TelemetryAggregator(drone_id="AERON-HEX-01", source="REAL")
        real_snap = real_agg.snapshot()
        self.assertEqual(real_snap["source"], "REAL")
        self.assertFalse(real_snap["isSimulated"])

        # Simulated aggregator
        sim_agg = TelemetryAggregator(drone_id="AERON-HEX-01", source="SIMULATION")
        sim_snap = sim_agg.snapshot()
        self.assertEqual(sim_snap["source"], "SIMULATION")
        self.assertTrue(sim_snap["isSimulated"])

    def test_message_accumulation(self):
        agg = TelemetryAggregator(drone_id="AERON-HEX-01", source="REAL")

        # Update heartbeat
        agg.update_from_message({
            "type": "HEARTBEAT",
            "armed": True,
            "flightMode": "LOITER"
        })
        # Update position
        agg.update_from_message({
            "type": "GLOBAL_POSITION_INT",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "altitude": 40.0,
            "relativeAltitude": 10.0,
            "groundSpeed": 2.5,
            "heading": 90.0
        })
        # Update battery
        agg.update_from_message({
            "type": "SYS_STATUS",
            "batteryVoltage": 15.1,
            "batteryCurrent": 4.2,
            "batteryPercentage": 75,
            "sensorHealth": {"imu": True}
        })

        snap = agg.snapshot()
        self.assertEqual(snap["droneId"], "AERON-HEX-01")
        self.assertTrue(snap["armed"])
        self.assertEqual(snap["flightMode"], "LOITER")
        self.assertEqual(snap["latitude"], 12.9716)
        self.assertEqual(snap["batteryVoltage"], 15.1)
        self.assertEqual(snap["groundSpeed"], 2.5)

if __name__ == "__main__":
    unittest.main()

