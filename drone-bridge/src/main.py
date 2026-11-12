import sys
import time
import signal
import argparse
from typing import Optional

from .config import config
from .logging_config import setup_logging
from .mavlink.connection import MAVLinkConnection
from .mavlink.parser import MAVLinkParser
from .mavlink.health import SubsystemHealthTracker
from .mavlink.telemetry import TelemetryAggregator
from .transport.backend_client import BackendTransportClient
from .simulator import DroneTelemetrySimulator, SCENARIOS
from .simulator_server import start_simulator_http_server

# Camera subsystem
from .camera.config import CameraConfig, camera_config
from .camera.health import CameraHealthTracker
from .camera.frame_reader import ESP32CameraReader
from .camera.transport import CameraTransportClient

logger = setup_logging("AERON-BRIDGE")

def run_real_mavlink_loop(
    conn: MAVLinkConnection,
    aggregator: TelemetryAggregator,
    client: BackendTransportClient,
    persist_interval_sec: float,
    camera_reader: Optional[ESP32CameraReader] = None,
    camera_client: Optional[CameraTransportClient] = None
):
    """
    Main read-only loop for physical Pixhawk MAVLink communication.
    Strictly reads and normalizes packets. Does NOT transmit outbound flight commands.
    Optionally acquires and relays synchronized ESP32-CAM frames.
    """
    logger.info("Commencing READ-ONLY MAVLink telemetry loop. Press Ctrl+C to abort.")
    last_persist_time = 0.0
    last_camera_status_time = 0.0

    while True:
        # Non-blocking read of next available MAVLink packet
        msg = conn.receive_message()
        if msg:
            msg_type = msg.get_type()
            parsed: Optional[dict] = None

            if msg_type == "HEARTBEAT":
                conn.record_heartbeat(msg)
                parsed = MAVLinkParser.parse_heartbeat(msg)
            elif msg_type == "GLOBAL_POSITION_INT":
                parsed = MAVLinkParser.parse_global_position_int(msg)
            elif msg_type == "GPS_RAW_INT":
                parsed = MAVLinkParser.parse_gps_raw_int(msg)
            elif msg_type == "SYS_STATUS":
                parsed = MAVLinkParser.parse_sys_status(msg)
            elif msg_type == "BATTERY_STATUS":
                parsed = MAVLinkParser.parse_battery_status(msg)
            elif msg_type == "ATTITUDE":
                parsed = MAVLinkParser.parse_attitude(msg)

            if parsed:
                aggregator.update_from_message(parsed)

        now = time.time()

        # Camera frame acquisition and GPS synchronization
        if camera_reader and camera_client:
            snap = aggregator.snapshot()
            telemetry_age = (now - aggregator.last_message_time) if aggregator.last_message_time else None
            frame = camera_reader.capture_frame(
                telemetry_lat=snap.get("latitude"),
                telemetry_lon=snap.get("longitude"),
                telemetry_alt=snap.get("altitude"),
                telemetry_heading=snap.get("heading"),
                telemetry_age_seconds=round(telemetry_age, 2) if telemetry_age is not None else None
            )
            if frame:
                camera_client.enqueue_frame(frame)
                camera_client.flush_frames()

            if (now - last_camera_status_time) >= 3.0:
                camera_client.send_status(camera_reader.health.snapshot())
                last_camera_status_time = now

        # Periodic flush of normalized telemetry to Backend
        if (now - last_persist_time) >= persist_interval_sec:
            snapshot = aggregator.snapshot()
            client.enqueue(snapshot)
            success = client.flush(max_batch_size=10)
            aggregator.health.record_backend_delivery(success)
            last_persist_time = now

            # Console status summary
            hb_status = aggregator.health.pixhawk_heartbeat_status
            lat_str = f"{snapshot['latitude']:.4f}" if snapshot.get('latitude') else "--"
            lon_str = f"{snapshot['longitude']:.4f}" if snapshot.get('longitude') else "--"
            volt_str = f"{snapshot['batteryVoltage']}V" if snapshot.get('batteryVoltage') else "--"

            summary = (
                f"[TELEMETRY] FC: {hb_status} | "
                f"Mode: {snapshot.get('flightMode', 'STANDBY')} | "
                f"Armed: {snapshot.get('armed')} | "
                f"Pos: ({lat_str}, {lon_str}) | "
                f"Batt: {volt_str} | "
                f"Delivered: {client.total_delivered} pkts"
            )
            logger.info(summary)

        # Small sleep to yield CPU
        time.sleep(0.01)

def run_simulation_loop(
    simulator: DroneTelemetrySimulator,
    client: BackendTransportClient,
    camera_reader: Optional[ESP32CameraReader] = None,
    camera_client: Optional[CameraTransportClient] = None
):
    """Fallback loop running high-fidelity simulated telemetry bench."""
    logger.info("Commencing SIMULATION telemetry loop. Transmitting to backend...")
    last_camera_status = [0.0]

    def on_snapshot(payload: dict):
        now = time.time()
        # Convert simulator model format to backend ingestion schema
        gps = payload.get("gps") or {}
        dynamics = payload.get("dynamics") or {}
        battery = payload.get("battery") or {}
        flight = payload.get("flight") or {}
        connection = payload.get("connection") or {}

        backend_payload = {
            "droneId": payload.get("droneId", config.drone_id),
            "recordedAt": payload.get("timestamp"),
            "source": "SIMULATION",
            "isSimulated": True,
            "latitude": gps.get("latitude"),
            "longitude": gps.get("longitude"),
            "altitude": gps.get("altitudeMsl"),
            "relativeAltitude": gps.get("relativeAltitude"),
            "groundSpeed": dynamics.get("groundSpeed"),
            "heading": dynamics.get("heading"),
            "gpsFixType": gps.get("fixType"),
            "satellites": gps.get("satellitesVisible"),
            "hdop": gps.get("hdop"),
            "batteryVoltage": battery.get("voltage"),
            "batteryCurrent": battery.get("current"),
            "batteryPercentage": battery.get("remainingPercentage"),
            "flightMode": flight.get("flightMode"),
            "armed": flight.get("armed", False),
            "connectionStatus": connection.get("status", "CONNECTED")
        }

        client.enqueue(backend_payload)
        client.flush(max_batch_size=5)

        # Camera frame acquisition for simulation bench
        if camera_reader and camera_client:
            frame = camera_reader.capture_frame(
                telemetry_lat=gps.get("latitude"),
                telemetry_lon=gps.get("longitude"),
                telemetry_alt=gps.get("altitudeMsl"),
                telemetry_heading=dynamics.get("heading"),
                telemetry_age_seconds=0.05
            )
            if frame:
                camera_client.enqueue_frame(frame)
                camera_client.flush_frames()

            if (now - last_camera_status[0]) >= 3.0:
                camera_client.send_status(camera_reader.health.snapshot())
                last_camera_status[0] = now

        summary = (
            f"[SIMULATOR] {backend_payload['droneId']} | "
            f"Mode: {backend_payload['flightMode']} | "
            f"Alt: {backend_payload['altitude']}m | "
            f"Spd: {backend_payload['groundSpeed']}m/s | "
            f"Batt: {backend_payload['batteryVoltage']}V | "
            f"Delivered: {client.total_delivered} pkts"
        )
        logger.info(summary)

    simulator.run(callback=on_snapshot)

def main():
    parser = argparse.ArgumentParser(description="AERON Local Ground Station Telemetry Bridge & Pixhawk Gateway")
    parser.add_argument("--connection", default=config.mavlink_connection, help="Serial port (e.g. COM9, COM8) or network stream (e.g. udpin:localhost:14550)")
    parser.add_argument("--baud", type=int, default=config.mavlink_baud, help="Baud rate (default: 57600)")
    parser.add_argument("--drone-id", default=config.drone_id, help="Airframe identifier (default from config)")
    parser.add_argument("--backend-url", default=config.backend_ingest_url, help="Backend telemetry ingestion URL")
    parser.add_argument("--simulator", action="store_true", help="Force software simulation mode")
    parser.add_argument("--scenario", default="SLOW_ROUTE", choices=SCENARIOS, help="Predefined simulation scenario")
    parser.add_argument("--simulator-server-port", type=int, default=5050, help="Port for local simulation control HTTP API (default: 5050)")
    parser.add_argument("--camera", action="store_true", help="Enable ESP32-CAM video acquisition and relay")
    parser.add_argument("--camera-protocol", default=camera_config.protocol, choices=["HTTP_JPEG", "HTTP_MJPEG", "MOCK"], help="Camera acquisition protocol")
    parser.add_argument("--camera-host", default=camera_config.host, help="ESP32-CAM IP or hostname")
    parser.add_argument("--camera-port", type=int, default=camera_config.port, help="ESP32-CAM port")
    parser.add_argument("--camera-fps", type=float, default=camera_config.target_fps, help="Target camera frame rate (fps)")
    args = parser.parse_args()

    camera_enabled = args.camera or camera_config.enabled

    logger.info("==================================================")
    logger.info("AERON LOCAL GROUND STATION TELEMETRY BRIDGE")
    logger.info(f"Target Drone ID      : {args.drone_id}")
    logger.info(f"Connection Target    : {args.connection} @ {args.baud} baud")
    logger.info(f"Backend Ingest URL   : {args.backend_url}")
    logger.info(f"Simulation Requested : {args.simulator or config.simulator_enabled}")
    logger.info(f"Camera Subsystem     : {'ENABLED (' + args.camera_protocol + ')' if camera_enabled else 'DISABLED'}")
    if camera_enabled:
        logger.info(f"Camera Endpoint      : http://{args.camera_host}:{args.camera_port} @ {args.camera_fps} FPS target")
    logger.info("==================================================")

    # Initialize Backend Transport Client for Telemetry
    client = BackendTransportClient(
        ingest_url=args.backend_url,
        bridge_token=config.drone_bridge_token,
        max_queue_size=config.queue_max_size
    )

    # Initialize Camera Subsystem if enabled
    camera_reader: Optional[ESP32CameraReader] = None
    camera_client: Optional[CameraTransportClient] = None

    if camera_enabled:
        cam_cfg = CameraConfig(
            enabled=True,
            drone_id=args.drone_id,
            device_id=camera_config.device_id,
            host=args.camera_host,
            port=args.camera_port,
            protocol=args.camera_protocol,
            target_fps=args.camera_fps,
            backend_url=camera_config.backend_url,
            frames_endpoint=camera_config.frames_endpoint,
            status_endpoint=camera_config.status_endpoint,
            drone_bridge_token=camera_config.drone_bridge_token
        )
        cam_health = CameraHealthTracker(
            drone_id=args.drone_id,
            device_id=camera_config.device_id,
            ip_address=f"{args.camera_host}:{args.camera_port}"
        )
        if args.camera_protocol == "MOCK":
            cam_health.record_installed(True)
            cam_health.record_reachability(True)
        else:
            # Physical camera: not assumed installed until verified
            cam_health.record_installed(False)
            cam_health.record_reachability(False)

        camera_reader = ESP32CameraReader(config=cam_cfg, health=cam_health)
        camera_client = CameraTransportClient(
            frames_url=cam_cfg.frames_endpoint,
            status_url=cam_cfg.status_endpoint,
            bridge_token=cam_cfg.drone_bridge_token,
            max_queue_size=cam_cfg.frame_queue_max
        )
        # Broadcast initial health snapshot
        camera_client.send_status(cam_health.snapshot())

    # Graceful shutdown handler
    def handle_shutdown(signum, frame):
        logger.info(f"Signal {signum} received. Closing bridge gracefully...")
        if camera_reader and camera_client:
            offline_status = camera_reader.health.snapshot()
            offline_status.streaming = False
            camera_client.send_status(offline_status)
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    # Check if simulation mode is explicitly requested
    if args.simulator or config.simulator_enabled:
        simulator = DroneTelemetrySimulator(
            drone_id=args.drone_id,
            rate_hz=config.simulator_rate_hz,
            scenario=args.scenario
        )
        # Start local simulation control HTTP server on background thread
        start_simulator_http_server(
            simulator=simulator,
            port=args.simulator_server_port,
            camera_reader=camera_reader
        )
        run_simulation_loop(simulator, client, camera_reader, camera_client)
        return

    # Attempt physical MAVLink connection
    conn = MAVLinkConnection(
        connection_string=args.connection,
        baud=args.baud,
        heartbeat_timeout=config.heartbeat_timeout_seconds
    )

    port_open = conn.connect()
    if not port_open:
        logger.warning(
            f"Physical MAVLink port '{args.connection}' could not be opened. "
            f"Verify that Pixhawk 2.4.8 USB cable is securely connected to the laptop.\n"
            f"To run bench simulation instead, pass '--simulator' or set SIMULATOR_ENABLED=true."
        )
        sys.exit(1)

    health_tracker = SubsystemHealthTracker(heartbeat_timeout=config.heartbeat_timeout_seconds)
    health_tracker.record_port_state(True)

    aggregator = TelemetryAggregator(
        drone_id=args.drone_id,
        source=config.mavlink_source,
        health_tracker=health_tracker
    )

    persist_interval_sec = max(config.telemetry_persist_interval_ms / 1000.0, 0.05)

    try:
        run_real_mavlink_loop(conn, aggregator, client, persist_interval_sec, camera_reader, camera_client)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
