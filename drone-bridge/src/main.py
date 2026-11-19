import sys
import time
import signal
import argparse
import threading
from typing import Optional

from .config import config
from .logging_config import setup_logging
from .mavlink.connection import MAVLinkConnection
from .mavlink.parser import MAVLinkParser
from .mavlink.health import SubsystemHealthTracker
from .mavlink.telemetry import TelemetryAggregator
from .mavlink.transport_manager import DualTransportCoordinator
from .transport.backend_client import BackendTransportClient
from .transport.socket_client import BridgeSocketClient
from .simulator import DroneTelemetrySimulator, SCENARIOS
from .simulator_server import start_simulator_http_server

# Camera subsystem
from .camera.config import CameraConfig, camera_config
from .camera.health import CameraHealthTracker
from .camera.frame_reader import ESP32CameraReader
from .camera.transport import CameraTransportClient

logger = setup_logging("AERON-BRIDGE")

def run_real_mavlink_loop(
    coordinator: DualTransportCoordinator,
    aggregator: TelemetryAggregator,
    client: BackendTransportClient,
    persist_interval_sec: float,
    camera_reader: Optional[ESP32CameraReader] = None,
    camera_client: Optional[CameraTransportClient] = None,
    socket_client: Optional[BridgeSocketClient] = None
):
    """
    Decoupled read-only loop for physical Pixhawk MAVLink communication with Dual-Transport support.
    - DualTransportCoordinator: Reads and normalizes MAVLink packets from Wi-Fi and/or USB simultaneously,
      selects the authoritative active transport, eliminates duplicates, and tracks failover.
    - Sender thread / loop: Transmits the latest normalized telemetry snapshot to Backend via keep-alive session.
    """
    logger.info("Commencing DUAL-TRANSPORT READ-ONLY MAVLink telemetry loop. Press Ctrl+C to abort.")

    stop_event = threading.Event()
    snapshot_lock = threading.Lock()
    latest_snapshot: Optional[dict] = None

    def on_telemetry_packet(parsed: dict):
        nonlocal latest_snapshot
        try:
            aggregator.update_from_message(parsed)
            aggregator.health.record_heartbeat()
            with snapshot_lock:
                trans_snap = coordinator.get_transport_snapshot()
                latest_snapshot = aggregator.snapshot(transport=trans_snap)
        except Exception as update_err:
            logger.debug(f"[COORDINATOR-INGEST] Error updating aggregator: {update_err}")

    def on_attitude_packet(parsed: dict, raw_msg: Any):
        if socket_client:
            try:
                socket_client.emit_attitude(
                    drone_id=aggregator.drone_id,
                    roll=parsed["roll"],
                    pitch=parsed["pitch"],
                    yaw=parsed["yaw"],
                    climb_rate=aggregator.climb_rate or 0.0,
                    boot_ms=getattr(raw_msg, "time_boot_ms", 0)
                )
            except Exception as att_err:
                logger.debug(f"[COORDINATOR-INGEST] Error emitting attitude: {att_err}")

    coordinator.on_telemetry_callback = on_telemetry_packet
    coordinator.on_attitude_callback = on_attitude_packet
    coordinator.start()

    # Dedicated background worker thread for camera acquisition and relay
    camera_worker_thread = None
    if camera_reader and camera_client:
        def _camera_worker():
            last_status = 0.0
            while not stop_event.is_set():
                now = time.time()
                try:
                    with snapshot_lock:
                        snap = latest_snapshot or aggregator.snapshot(transport=coordinator.get_transport_snapshot())
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

                    if (now - last_status) >= 3.0:
                        camera_client.send_status(camera_reader.health.snapshot())
                        last_status = now
                except Exception as cam_err:
                    logger.debug(f"[CAMERA-WORKER] Error: {cam_err}")

                time.sleep(0.02)

        camera_worker_thread = threading.Thread(target=_camera_worker, daemon=True, name="CameraWorker")
        camera_worker_thread.start()
        logger.info("[CAMERA] Dedicated optical acquisition and relay worker thread started.")

    # Main Sender Loop
    last_persist_time = 0.0

    try:
        while not stop_event.is_set():
            now = time.time()

            # Periodic transmission of latest normalized telemetry to Backend
            if (now - last_persist_time) >= persist_interval_sec:
                trans_snap = coordinator.get_transport_snapshot()

                with snapshot_lock:
                    snapshot_to_send = dict(latest_snapshot) if latest_snapshot else aggregator.snapshot(transport=trans_snap)

                snapshot_to_send["transport"] = trans_snap

                # Transmit directly over keep-alive HTTP session
                success = client.send_snapshot(snapshot_to_send)
                aggregator.health.record_backend_delivery(success)
                last_persist_time = now

                # Console status summary
                hb_status = aggregator.health.pixhawk_heartbeat_status
                mode_str = trans_snap.get("mode", "DUAL").upper()
                active_src = trans_snap.get("activeSource", "NONE")
                trans_label = f"Transport: {mode_str} [Active: {active_src}]"

                # Diagnostic transport metrics summary
                channels = trans_snap.get("channels", {})
                w = trans_snap.get("wifi") or trans_snap.get("WIFI") or channels.get("WIFI") or channels.get("wifi")
                u = trans_snap.get("usb") or trans_snap.get("USB") or channels.get("USB") or channels.get("usb")

                diag_parts = []
                if w:
                    diag_parts.append(f"WIFI(bytes={w.get('rawBytesReceived', 0)}, msgs={w.get('messageCount', 0)}, hb={w.get('heartbeatCount', 0)}, bad={w.get('badDataCount', 0)})")
                if u:
                    diag_parts.append(f"USB(bytes={u.get('rawBytesReceived', 0)}, msgs={u.get('messageCount', 0)}, hb={u.get('heartbeatCount', 0)}, bad={u.get('badDataCount', 0)})")
                diag_str = " | ".join(diag_parts) if diag_parts else "NO_CHANNELS"

                lat_str = f"{snapshot_to_send['latitude']:.4f}" if snapshot_to_send.get('latitude') else "--"
                lon_str = f"{snapshot_to_send['longitude']:.4f}" if snapshot_to_send.get('longitude') else "--"
                volt_str = f"{snapshot_to_send['batteryVoltage']}V" if snapshot_to_send.get('batteryVoltage') else "--"
                pct_val = snapshot_to_send.get('batteryPercentage')
                src_val = snapshot_to_send.get('batteryPercentageSource', 'UNKNOWN')
                pct_str = f"{pct_val}% ({src_val})" if pct_val is not None else "--"
                yaw_str = f"{snapshot_to_send['yaw']:.1f}°" if snapshot_to_send.get('yaw') is not None else "--"
                hdg_str = f"{snapshot_to_send['heading']:.1f}°" if snapshot_to_send.get('heading') is not None else "--"

                summary = (
                    f"[TELEMETRY] FC: {hb_status} | {trans_label} | "
                    f"RX: {diag_str} | "
                    f"Mode: {snapshot_to_send.get('flightMode', 'STANDBY')} | "
                    f"Armed: {snapshot_to_send.get('armed')} | "
                    f"Attitude(Y/H): {yaw_str}/{hdg_str} | "
                    f"Pos: ({lat_str}, {lon_str}) | "
                    f"Batt: {volt_str} [{pct_str}] | "
                    f"BackendDelivered: {client.total_delivered} pkts"
                )
                logger.info(summary)

            time.sleep(0.01)

    except (KeyboardInterrupt, SystemExit):
        logger.info("Stopping telemetry loop...")
    finally:
        stop_event.set()
        if camera_worker_thread and camera_worker_thread.is_alive():
            camera_worker_thread.join(timeout=1.5)
        if camera_reader:
            try:
                camera_reader.stop()
            except Exception:
                pass
        coordinator.stop()

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
    parser.add_argument("--transport", default=config.telemetry_transport, choices=["dual", "wifi", "usb"], help="Telemetry transport mode: dual, wifi, or usb (default: dual)")
    parser.add_argument("--primary-transport", default=config.primary_transport, choices=["wifi", "usb"], help="Preferred primary transport in dual mode (default: wifi)")
    parser.add_argument("--wifi-host", default=config.wifi_host, help="ESP32 Hotspot IP, 'auto', or hostname (default: auto)")
    parser.add_argument("--wifi-port", type=int, default=config.wifi_port, help="ESP32 MAVLink TCP port (default: 5760)")
    parser.add_argument("--wifi-fallback-ip", default=config.wifi_fallback_ip, help="Fallback IP if discovery fails (default: 192.168.4.1)")
    parser.add_argument("--wifi-udp-port", type=int, default=config.wifi_udp_port, help="ESP32 UDP discovery port (default: 37020)")
    parser.add_argument("--usb-port", default=config.usb_port, help="ESP32 USB Serial COM port (default: COM8)")
    parser.add_argument("--usb-baud", type=int, default=config.usb_baud, help="ESP32 USB Serial baud rate (default: 115200)")

    # Legacy CLI arguments preserved for full backwards compatibility
    parser.add_argument("--connection", default=config.mavlink_connection, help="Legacy port/target alias")
    parser.add_argument("--baud", type=int, default=config.mavlink_baud, help="Legacy baud alias")
    parser.add_argument("--drone-id", default=config.drone_id, help="Airframe identifier (default from config)")
    parser.add_argument("--backend-url", default=config.backend_ingest_url, help="Backend telemetry ingestion URL")
    parser.add_argument("--simulator", action="store_true", help="Force software simulation mode")
    parser.add_argument("--scenario", default="SLOW_ROUTE", choices=SCENARIOS, help="Predefined simulation scenario")
    parser.add_argument("--simulator-server-port", type=int, default=5050, help="Port for local simulation control HTTP API (default: 5050)")
    parser.add_argument("--camera", action="store_true", help="Enable ESP32-CAM video acquisition and relay")
    parser.add_argument("--camera-protocol", default=camera_config.protocol, choices=["MJPEG", "HTTP_MJPEG", "HTTP_JPEG", "MOCK"], help="Camera acquisition protocol")
    parser.add_argument("--camera-host", default=camera_config.host, help="ESP32-CAM IP or hostname")
    parser.add_argument("--camera-port", type=int, default=camera_config.port, help="ESP32-CAM port")
    parser.add_argument("--camera-fps", type=float, default=camera_config.target_fps, help="Target camera frame rate (fps)")
    args = parser.parse_args()

    # Reconcile legacy CLI options with dual-transport settings
    usb_port = args.usb_port
    if args.connection != config.mavlink_connection:
        usb_port = args.connection
    usb_baud = args.usb_baud
    if args.baud != config.mavlink_baud:
        usb_baud = args.baud

    camera_enabled = args.camera or camera_config.enabled

    logger.info("==================================================")
    logger.info("AERON LOCAL GROUND STATION TELEMETRY BRIDGE")
    logger.info(f"Target Drone ID      : {args.drone_id}")
    logger.info(f"Transport Mode       : {args.transport.upper()}")
    logger.info(f"Primary Preference   : {args.primary_transport.upper()}")
    if args.transport in ("wifi", "dual"):
        logger.info(f"Wi-Fi Telemetry Path : tcp:{args.wifi_host}:{args.wifi_port} (Fallback: {args.wifi_fallback_ip}, UDP Discovery: {args.wifi_udp_port})")
    if args.transport in ("usb", "dual"):
        logger.info(f"USB Serial Path      : {usb_port} @ {usb_baud} baud")
    logger.info(f"Backend Ingest URL   : {args.backend_url}")
    logger.info(f"Simulation Requested : {args.simulator or config.simulator_enabled}")
    logger.info(f"Camera Subsystem     : {'ENABLED (' + args.camera_protocol + ')' if camera_enabled else 'DISABLED'}")
    if camera_enabled:
        logger.info(f"Camera Endpoint      : http://{args.camera_host}:{args.camera_port} @ {args.camera_fps} FPS target")
    logger.info("==================================================")

    # Format ingestion endpoint ensuring /telemetry/ingest suffix
    ingest_endpoint = (
        args.backend_url
        if "/telemetry/ingest" in args.backend_url
        else args.backend_url.rstrip("/") + "/telemetry/ingest"
    )

    # Initialize Backend Transport Client for Telemetry
    client = BackendTransportClient(
        ingest_url=ingest_endpoint,
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
        camera_reader.start()
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
        if camera_reader:
            try:
                if camera_client:
                    offline_status = camera_reader.health.snapshot()
                    offline_status.streaming = False
                    camera_client.send_status(offline_status)
                camera_reader.stop()
            except Exception as close_err:
                logger.debug(f"Error stopping camera during shutdown: {close_err}")
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
        try:
            run_simulation_loop(simulator, client, camera_reader, camera_client)
        finally:
            if camera_reader:
                try:
                    camera_reader.stop()
                except Exception:
                    pass
        return

    # Initialize dedicated high-frequency Socket.IO machine client
    socket_client = BridgeSocketClient(
        server_url=args.backend_url,
        bridge_token=config.drone_bridge_token,
        drone_id=args.drone_id
    )
    socket_client.connect()

    # Initialize Dual-Transport Coordinator (Wi-Fi + USB)
    coordinator = DualTransportCoordinator(
        mode=args.transport,
        primary_preference=args.primary_transport,
        wifi_host=args.wifi_host,
        wifi_port=args.wifi_port,
        wifi_fallback_ip=args.wifi_fallback_ip,
        wifi_udp_port=args.wifi_udp_port,
        usb_port=usb_port,
        usb_baud=usb_baud,
        heartbeat_timeout=config.heartbeat_timeout_seconds,
        hysteresis_duration_sec=2.0
    )

    health_tracker = SubsystemHealthTracker(heartbeat_timeout=config.heartbeat_timeout_seconds)
    health_tracker.record_port_state(True)

    aggregator = TelemetryAggregator(
        drone_id=args.drone_id,
        source=config.mavlink_source,
        health_tracker=health_tracker
    )

    persist_interval_sec = max(config.telemetry_persist_interval_ms / 1000.0, 0.05)

    try:
        run_real_mavlink_loop(
            coordinator,
            aggregator,
            client,
            persist_interval_sec,
            camera_reader,
            camera_client,
            socket_client=socket_client
        )
    finally:
        if camera_reader:
            try:
                camera_reader.stop()
            except Exception:
                pass
        socket_client.disconnect()

if __name__ == "__main__":
    main()
