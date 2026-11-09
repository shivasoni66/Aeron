import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Drone } from '../models/Drone.js';
import { HardwareDevice } from '../models/HardwareDevice.js';
import { FlightSession } from '../models/FlightSession.js';
import { TelemetryRecord } from '../models/TelemetryRecord.js';
import { AuditLog } from '../models/AuditLog.js';
import { getDatabaseStatus } from '../config/database.js';
import { env } from '../config/env.js';
import { CameraController } from './camera.controller.js';

export class AdminController {
  /**
   * GET /api/v1/admin/overview
   * Consolidated technical telemetry matrix, protocol info, and dynamic readiness.
   */
  public static async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const droneCount = await Drone.countDocuments();
      const primaryDrone = await Drone.findOne().sort({ createdAt: -1 });

      let latestTelemetry = null;
      let hardwareDevices: any[] = [];

      if (primaryDrone) {
        latestTelemetry = await TelemetryRecord.findOne({ droneId: primaryDrone._id })
          .sort({ recordedAt: -1 })
          .lean();

        hardwareDevices = await HardwareDevice.find({ droneId: primaryDrone._id }).lean();
      } else {
        latestTelemetry = await TelemetryRecord.findOne().sort({ recordedAt: -1 }).lean();
      }

      // Dynamic Aircraft Readiness Calculation based on real available signals
      const readinessChecks = [
        {
          id: 'FC_CORE_INIT',
          name: 'FC Core Initialized',
          verified: latestTelemetry ? true : false,
          details: latestTelemetry ? 'Telemetry packet verified' : 'Awaiting heartbeat'
        },
        {
          id: 'GPS_3D_LOCK',
          name: 'GPS 3D Fix',
          verified: latestTelemetry?.gpsFixType === '3D_FIX' || (latestTelemetry?.satellites ?? 0) >= 6,
          details: latestTelemetry ? `${latestTelemetry.satellites ?? 0} Satellites locked` : 'No GPS signal'
        },
        {
          id: 'BATTERY_POWER',
          name: '4S Power Module',
          verified: (latestTelemetry?.batteryPercentage ?? 0) > 20,
          details: latestTelemetry ? `${latestTelemetry.batteryPercentage}% (${latestTelemetry.batteryVoltage ?? 0}V)` : 'No power telemetry'
        },
        {
          id: 'TELEMETRY_FRESHNESS',
          name: 'Telemetry Freshness',
          verified: latestTelemetry ? (Date.now() - new Date(latestTelemetry.recordedAt).getTime()) < 30000 : false,
          details: latestTelemetry ? 'Live / Fresh' : 'Stale / Disconnected'
        },
        {
          id: 'LIDAR_OPTICAL_FLOW',
          name: 'LiDAR & Optical Flow',
          verified: false,
          details: 'NOT INSTALLED // PORT BYPASS EXEMPT'
        }
      ];

      const verifiedCount = readinessChecks.filter(c => c.verified).length;
      const readinessPercentage = Math.round((verifiedCount / 5) * 100);

      res.status(200).json({
        status: 'success',
        data: {
          drone: primaryDrone,
          droneCount,
          protocol: {
            mavlinkVersion: '2.0',
            serialConnection: latestTelemetry ? 'CONNECTED' : 'DISCONNECTED',
            baudRate: 57600,
            targetFC: primaryDrone?.flightController || 'Pixhawk 2.4.8 (STM32F427)',
            mode: latestTelemetry?.flightMode || 'STANDBY / BENCH TEST',
            sysId: 1,
            compId: 1,
            armed: latestTelemetry?.armed ?? false
          },
          readiness: {
            percentage: readinessPercentage,
            status: readinessPercentage >= 80 ? 'BENCH READY' : readinessPercentage >= 40 ? 'BENCH STAGE 2' : 'NOT READY',
            verifiedCount,
            totalChecks: 5,
            checks: readinessChecks
          },
          latestTelemetry,
          hardwareDevices
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'OVERVIEW_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/drones
   */
  public static async listDrones(req: Request, res: Response): Promise<void> {
    try {
      const drones = await Drone.find().sort({ createdAt: -1 }).lean();
      res.status(200).json({ status: 'success', data: { drones } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'DRONES_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/drones/:droneId
   */
  public static async getDrone(req: Request, res: Response): Promise<void> {
    try {
      const droneId = req.params.droneId as string;
      const drone = await Drone.findOne({
        $or: [
          { droneId },
          ...(mongoose.Types.ObjectId.isValid(droneId) ? [{ _id: new mongoose.Types.ObjectId(droneId) }] : [])
        ]
      }).lean();

      if (!drone) {
        res.status(404).json({ status: 'error', code: 'DRONE_NOT_FOUND', message: `Drone '${droneId}' not found` });
        return;
      }

      res.status(200).json({ status: 'success', data: { drone } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'DRONE_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/drones/:droneId/telemetry/latest
   */
  public static async getLatestTelemetry(req: Request, res: Response): Promise<void> {
    try {
      const droneId = req.params.droneId as string;
      const drone = await Drone.findOne({
        $or: [
          { droneId },
          ...(mongoose.Types.ObjectId.isValid(droneId) ? [{ _id: new mongoose.Types.ObjectId(droneId) }] : [])
        ]
      });

      if (!drone) {
        res.status(404).json({ status: 'error', code: 'DRONE_NOT_FOUND', message: 'Drone not found' });
        return;
      }

      const telemetry = await TelemetryRecord.findOne({ droneId: drone._id })
        .sort({ recordedAt: -1 })
        .lean();

      res.status(200).json({ status: 'success', data: { telemetry: telemetry || null } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'TELEMETRY_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/drones/:droneId/telemetry/history
   */
  public static async getTelemetryHistory(req: Request, res: Response): Promise<void> {
    try {
      const droneId = req.params.droneId as string;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const flightSessionId = req.query.flightSessionId as string;

      const drone = await Drone.findOne({
        $or: [
          { droneId },
          ...(mongoose.Types.ObjectId.isValid(droneId) ? [{ _id: new mongoose.Types.ObjectId(droneId) }] : [])
        ]
      });

      if (!drone) {
        res.status(404).json({ status: 'error', code: 'DRONE_NOT_FOUND', message: 'Drone not found' });
        return;
      }

      const query: Record<string, unknown> = { droneId: drone._id };
      if (flightSessionId && mongoose.Types.ObjectId.isValid(flightSessionId)) {
        query.flightSessionId = new mongoose.Types.ObjectId(flightSessionId);
      }

      const history = await TelemetryRecord.find(query)
        .sort({ recordedAt: -1 })
        .limit(limit)
        .lean();

      res.status(200).json({ status: 'success', data: { history, count: history.length, limit } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'HISTORY_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/drones/:droneId/hardware
   */
  public static async getDroneHardware(req: Request, res: Response): Promise<void> {
    try {
      const droneId = req.params.droneId as string;
      const drone = await Drone.findOne({
        $or: [
          { droneId },
          ...(mongoose.Types.ObjectId.isValid(droneId) ? [{ _id: new mongoose.Types.ObjectId(droneId) }] : [])
        ]
      });

      if (!drone) {
        res.status(404).json({ status: 'error', code: 'DRONE_NOT_FOUND', message: 'Drone not found' });
        return;
      }

      const devices = await HardwareDevice.find({ droneId: drone._id }).lean();
      res.status(200).json({ status: 'success', data: { devices } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'HARDWARE_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/flights
   */
  public static async listFlights(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 50);
      const source = req.query.source as string;

      const query: Record<string, unknown> = {};
      if (source === 'REAL' || source === 'SIMULATION') {
        query.source = source;
      }

      const total = await FlightSession.countDocuments(query);
      const flights = await FlightSession.find(query)
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      res.status(200).json({
        status: 'success',
        data: {
          flights,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'FLIGHTS_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/flights/:flightSessionId
   */
  public static async getFlightDetails(req: Request, res: Response): Promise<void> {
    try {
      const flightSessionId = req.params.flightSessionId as string;
      const flight = await FlightSession.findOne({
        $or: [
          { flightSessionId },
          ...(mongoose.Types.ObjectId.isValid(flightSessionId) ? [{ _id: new mongoose.Types.ObjectId(flightSessionId) }] : [])
        ]
      }).lean();

      if (!flight) {
        res.status(404).json({ status: 'error', code: 'FLIGHT_NOT_FOUND', message: 'Flight session not found' });
        return;
      }

      const telemetrySamples = await TelemetryRecord.find({ flightSessionId: flight._id })
        .sort({ recordedAt: 1 })
        .limit(100)
        .lean();

      res.status(200).json({ status: 'success', data: { flight, telemetrySamples } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'FLIGHT_DETAILS_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/events
   */
  public static async listEvents(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 30, 1), 100);
      const events = await AuditLog.find({
        source: { $in: ['ADMIN_WEB', 'DRONE_BRIDGE', 'SYSTEM'] }
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      res.status(200).json({ status: 'success', data: { events } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'EVENTS_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/system/health
   */
  public static async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const dbStatus = getDatabaseStatus();
      let latestTelemetry = null;
      if (mongoose.connection.readyState === 1) {
        latestTelemetry = await TelemetryRecord.findOne().sort({ recordedAt: -1 }).lean();
      }

      const telemetryAgeMs = latestTelemetry ? Date.now() - new Date(latestTelemetry.recordedAt).getTime() : null;
      const isDroneBridgeActive = telemetryAgeMs !== null && telemetryAgeMs < 45000;

      const latestCameraFrame = CameraController.getLatestFrame();
      const cameraAgeMs = latestCameraFrame ? Date.now() - new Date(latestCameraFrame.receivedAt).getTime() : null;
      const isCameraFresh = cameraAgeMs !== null && cameraAgeMs < 10000;

      res.status(200).json({
        status: 'success',
        data: {
          timestamp: new Date().toISOString(),
          subsystems: {
            apiBackend: { status: 'ONLINE', latencyMs: 1 },
            database: {
              status: dbStatus.status === 'connected' ? 'CONNECTED' : 'DEGRADED',
              readyState: dbStatus.readyState,
              host: dbStatus.host
            },
            socketServer: { status: 'ACTIVE' },
            droneBridge: {
              status: isDroneBridgeActive ? 'STREAMING' : 'STANDBY',
              lastPacketAt: latestTelemetry?.recordedAt || null,
              isSimulated: latestTelemetry?.isSimulated ?? true
            },
            pixhawkFC: {
              status: isDroneBridgeActive && !latestTelemetry?.isSimulated ? 'HARDWARE_LINKED' : 'NOT_CONNECTED_USB',
              model: 'Pixhawk 2.4.8 (STM32F427)'
            },
            gpsGNSS: {
              status: latestTelemetry?.gpsFixType === '3D_FIX' ? '3D_FIX_AVAILABLE' : 'NO_FIX',
              satellites: latestTelemetry?.satellites ?? 0
            },
            cameraModule: {
              status: isCameraFresh ? 'STREAMING' : latestCameraFrame ? 'STALE' : 'STANDBY',
              source: latestCameraFrame?.source || 'NOT_CONNECTED',
              lastFrameAt: latestCameraFrame?.receivedAt || null,
              protocol: latestCameraFrame?.contentType || 'HTTP_JPEG'
            },
            mediaStorage: {
              status: env.isProduction ? 'BLOCKED_PENDING_S3_GCS' : 'LOCAL_STAGING',
              provider: 'LOCAL',
              persistentCloudConfigured: false,
              note: env.isProduction ? 'Production requires configured S3 or GCS credentials' : 'Local storage active for development'
            }
          }
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'HEALTH_FETCH_FAILED', message: msg });
    }
  }
}
