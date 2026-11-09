import math
from typing import Optional, Dict, Any

# ArduPilot Copter Mode Mapping (custom_mode values)
COPTER_MODES = {
    0: "STABILIZE",
    1: "ACRO",
    2: "ALT_HOLD",
    3: "AUTO",
    4: "GUIDED",
    5: "LOITER",
    6: "RTL",
    7: "CIRCLE",
    9: "LAND",
    11: "DRIFT",
    13: "SPORT",
    14: "FLIP",
    15: "AUTOTUNE",
    16: "POSHOLD",
    17: "BRAKE",
    18: "THROW",
    19: "AVOID_ADSB",
    20: "GUIDED_NOGPS",
    21: "SMART_RTL",
    22: "FLOWHOLD",
    23: "FOLLOW",
    24: "ZIGZAG",
    25: "SYSTEMID",
    26: "AUTOROTATE",
    27: "AUTO_RTL"
}

# GPS Fix Type Enumeration Mapping
GPS_FIX_TYPES = {
    0: "NO_GPS",
    1: "NO_FIX",
    2: "2D_FIX",
    3: "3D_FIX",
    4: "DGPS",
    5: "RTK_FLOAT",
    6: "RTK_FIXED",
    7: "STATIC",
    8: "PPP"
}

class MAVLinkParser:
    """
    Parses incoming raw MAVLink messages into standardized, validated dictionary structures.
    Strictly READ-ONLY: Never alters flight parameters or emits commands.
    """

    @staticmethod
    def parse_heartbeat(msg: Any) -> Dict[str, Any]:
        """Parses HEARTBEAT message."""
        base_mode = getattr(msg, "base_mode", 0)
        custom_mode = getattr(msg, "custom_mode", 0)
        # Bit 7 (128) of base_mode represents MAV_MODE_FLAG_SAFETY_ARMED
        armed = bool(base_mode & 128)
        flight_mode = COPTER_MODES.get(custom_mode, f"MODE_{custom_mode}")

        sys_id = getattr(msg, "get_srcSystem", lambda: getattr(msg, "sysid", 1))()
        comp_id = getattr(msg, "get_srcComponent", lambda: getattr(msg, "compid", 1))()

        return {
            "type": "HEARTBEAT",
            "systemId": sys_id,
            "componentId": comp_id,
            "vehicleType": getattr(msg, "type", 2),
            "autopilotType": getattr(msg, "autopilot", 3),
            "baseMode": base_mode,
            "customMode": custom_mode,
            "flightMode": flight_mode,
            "armed": armed,
            "systemStatus": getattr(msg, "system_status", 0),
            "mavlinkVersion": getattr(msg, "mavlink_version", 2)
        }

    @staticmethod
    def parse_global_position_int(msg: Any) -> Dict[str, Any]:
        """Parses GLOBAL_POSITION_INT message."""
        raw_lat = getattr(msg, "lat", 0)
        raw_lon = getattr(msg, "lon", 0)
        raw_alt = getattr(msg, "alt", 0)
        raw_relative_alt = getattr(msg, "relative_alt", 0)
        vx = getattr(msg, "vx", 0)
        vy = getattr(msg, "vy", 0)
        raw_hdg = getattr(msg, "hdg", 65535)

        # Coordinate conversions (degE7 to decimal degrees)
        lat = None
        lon = None
        if raw_lat != 0 or raw_lon != 0:
            converted_lat = raw_lat / 1e7
            converted_lon = raw_lon / 1e7
            if -90.0 <= converted_lat <= 90.0 and -180.0 <= converted_lon <= 180.0:
                lat = round(converted_lat, 7)
                lon = round(converted_lon, 7)

        # Altitude conversions (mm to meters)
        alt = round(raw_alt / 1000.0, 2) if raw_alt != 0 else None
        relative_alt = round(raw_relative_alt / 1000.0, 2)

        # Horizontal ground speed: sqrt(vx^2 + vy^2) in cm/s -> m/s
        ground_speed = round(math.sqrt(vx**2 + vy**2) / 100.0, 2)

        # Heading (cdeg to degrees, 0 to 360)
        heading = None
        if raw_hdg != 65535 and 0 <= raw_hdg <= 36000:
            heading = round(raw_hdg / 100.0, 1)

        return {
            "type": "GLOBAL_POSITION_INT",
            "latitude": lat,
            "longitude": lon,
            "altitude": alt,
            "relativeAltitude": relative_alt,
            "groundSpeed": ground_speed,
            "heading": heading
        }

    @staticmethod
    def parse_gps_raw_int(msg: Any) -> Dict[str, Any]:
        """Parses GPS_RAW_INT message."""
        raw_fix = getattr(msg, "fix_type", 0)
        fix_type_str = GPS_FIX_TYPES.get(raw_fix, "UNKNOWN")
        raw_lat = getattr(msg, "lat", 0)
        raw_lon = getattr(msg, "lon", 0)
        raw_alt = getattr(msg, "alt", 0)
        satellites = getattr(msg, "satellites_visible", 0)
        raw_eph = getattr(msg, "eph", 65535)
        raw_cog = getattr(msg, "cog", 65535)

        lat = None
        lon = None
        if raw_fix >= 2 and (raw_lat != 0 or raw_lon != 0):
            conv_lat = raw_lat / 1e7
            conv_lon = raw_lon / 1e7
            if -90.0 <= conv_lat <= 90.0 and -180.0 <= conv_lon <= 180.0:
                lat = round(conv_lat, 7)
                lon = round(conv_lon, 7)

        alt = round(raw_alt / 1000.0, 2) if (raw_alt != 0 and raw_fix >= 2) else None
        hdop = round(raw_eph / 100.0, 2) if raw_eph != 65535 else None
        course_over_ground = round(raw_cog / 100.0, 1) if raw_cog != 65535 else None

        return {
            "type": "GPS_RAW_INT",
            "gpsFixType": fix_type_str,
            "latitude": lat,
            "longitude": lon,
            "altitude": alt,
            "satellites": satellites,
            "hdop": hdop,
            "courseOverGround": course_over_ground
        }

    @staticmethod
    def parse_sys_status(msg: Any) -> Dict[str, Any]:
        """Parses SYS_STATUS message."""
        raw_voltage = getattr(msg, "voltage_battery", 65535)
        raw_current = getattr(msg, "current_battery", -1)
        raw_pct = getattr(msg, "battery_remaining", -1)

        voltage = round(raw_voltage / 1000.0, 2) if (raw_voltage != 65535 and raw_voltage > 0) else None
        current = round(raw_current / 100.0, 2) if raw_current >= 0 else None
        percentage = raw_pct if (0 <= raw_pct <= 100) else None

        present_sensors = getattr(msg, "onboard_control_sensors_present", 0)
        enabled_sensors = getattr(msg, "onboard_control_sensors_enabled", 0)
        healthy_sensors = getattr(msg, "onboard_control_sensors_health", 0)

        sensor_health = {
            "imu": bool(healthy_sensors & 1),
            "barometer": bool(healthy_sensors & 4),
            "compass": bool(healthy_sensors & 8),
            "gps": bool(healthy_sensors & 32),
            "motors": bool(healthy_sensors & 256),
            "presentBitmap": present_sensors,
            "enabledBitmap": enabled_sensors,
            "healthBitmap": healthy_sensors
        }

        return {
            "type": "SYS_STATUS",
            "batteryVoltage": voltage,
            "batteryCurrent": current,
            "batteryPercentage": percentage,
            "sensorHealth": sensor_health
        }

    @staticmethod
    def parse_battery_status(msg: Any) -> Dict[str, Any]:
        """Parses BATTERY_STATUS message if provided."""
        voltages = getattr(msg, "voltages", [])
        total_mv = sum(v for v in voltages if v != 65535 and v > 0)
        voltage = round(total_mv / 1000.0, 2) if total_mv > 0 else None

        raw_current = getattr(msg, "current_battery", -1)
        current = round(raw_current / 100.0, 2) if raw_current >= 0 else None

        raw_pct = getattr(msg, "battery_remaining", -1)
        percentage = raw_pct if (0 <= raw_pct <= 100) else None

        return {
            "type": "BATTERY_STATUS",
            "batteryVoltage": voltage,
            "batteryCurrent": current,
            "batteryPercentage": percentage
        }

    @staticmethod
    def parse_attitude(msg: Any) -> Dict[str, Any]:
        """Parses ATTITUDE message."""
        raw_roll = getattr(msg, "roll", 0.0)
        raw_pitch = getattr(msg, "pitch", 0.0)
        raw_yaw = getattr(msg, "yaw", 0.0)

        roll = round(math.degrees(raw_roll), 2)
        pitch = round(math.degrees(raw_pitch), 2)
        yaw = round((math.degrees(raw_yaw) + 360.0) % 360.0, 2)

        return {
            "type": "ATTITUDE",
            "roll": roll,
            "pitch": pitch,
            "yaw": yaw
        }

