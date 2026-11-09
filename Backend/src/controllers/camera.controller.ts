import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CameraFrameSchema, CameraStatusSchema, CameraFrameInput, CameraStatusInput } from '../validators/camera.validator.js';
import { Drone } from '../models/Drone.js';
import { HardwareDevice } from '../models/HardwareDevice.js';
import { getSocketServer } from '../sockets/socket.server.js';
import { logger } from '../utils/logger.js';

// In-memory bounded cache for latest frame per drone (Zero database bloat for streaming frames)
const latestFrames = new Map<string, CameraFrameInput & { receivedAt: string }>();
const latestStatuses = new Map<string, CameraStatusInput & { updatedAt: string }>();

export class CameraController {
  /**
   * POST /api/v1/camera/frames
   * Ingests a validated JPEG frame from the Python Camera Bridge.
   * Authenticated via requireDroneBridgeAuth.
   * Does NOT write stream frames to MongoDB. Stores in memory and broadcasts to authorized Admin Socket.IO room.
   */
  public static async ingestFrame(req: Request, res: Response): Promise<void> {
    const parseResult = CameraFrameSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        status: 'error',
        code: 'FRAME_VALIDATION_FAILED',
        message: 'Invalid camera frame format or size exceeded',
        details: parseResult.error.format()
      });
      return;
    }

    const frame = parseResult.data;
    const receivedAt = new Date().toISOString();

    try {
      // Resolve drone
      let drone = null;
      if (mongoose.connection.readyState === 1) {
        drone = await Drone.findOne({ droneId: frame.droneId });
        if (!drone) {
          const authorizedAllowlist = [
            'AERON-PX4-BENCH01',
            'AERON-HEX-01',
            'DRONE-01',
            'DRONE-SIM-01',
            'DRONE-SIM-02',
            'AERON-QUAD-01'
          ];

          if (authorizedAllowlist.includes(frame.droneId)) {
            drone = await Drone.create({
              droneId: frame.droneId,
              displayName: `AERON Airframe ${frame.droneId}`,
              model: 'AERON Quadcopter (Pixhawk 2.4.8)',
              flightController: 'Pixhawk 2.4.8',
              operationalStatus: 'READY'
            });
          } else {
            logger.warn(`[CameraController] Rejected frame: Unprovisioned drone identity '${frame.droneId}'`);
            res.status(403).json({
              status: 'error',
              code: 'UNAUTHORIZED_DRONE_ID',
              message: `Drone identity '${frame.droneId}' is not authorized or provisioned. Machine token valid, but drone airframe must be pre-registered by an Administrator.`
            });
            return;
          }
        }

        // Update hardware device record for the camera
        await HardwareDevice.findOneAndUpdate(
          { deviceId: frame.cameraId },
          {
            $set: {
              droneId: drone._id,
              deviceType: 'CAMERA',
              manufacturer: 'Espressif / OmniVision',
              model: 'ESP32-CAM (OV2640)',
              installationStatus: 'INSTALLED',
              connectionStatus: 'CONNECTED',
              lastSeenAt: new Date(),
              metadata: {
                resolution: `${frame.frameWidth}x${frame.frameHeight}`,
                contentType: frame.contentType,
                source: frame.source
              }
            }
          },
          { upsert: true, new: true }
        );
      }

      // Cache latest frame in bounded in-memory store
      const cachedPayload = {
        ...frame,
        receivedAt
      };
      latestFrames.set(frame.droneId, cachedPayload);

      // Broadcast to authorized Socket.IO room (Admin only)
      try {
        const io = getSocketServer();
        const room = `drone:camera:${frame.droneId}`;

        io.to(room).emit(`camera:frame:${frame.droneId}`, cachedPayload);
        io.to(room).emit('camera:frame', cachedPayload);
        io.to(room).emit('drone:camera:frame', cachedPayload);
      } catch (socketErr) {
        logger.debug('[CameraController] Socket.IO broadcast skipped or uninitialized');
      }

      res.status(201).json({
        status: 'success',
        message: 'Camera frame successfully relayed',
        data: {
          cameraId: frame.cameraId,
          droneId: frame.droneId,
          receivedAt,
          frameSizeBytes: frame.frameSizeBytes,
          resolution: `${frame.frameWidth}x${frame.frameHeight}`
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown frame relay error';
      logger.error(`[CameraController] Frame ingestion error: ${msg}`);
      res.status(500).json({ status: 'error', code: 'FRAME_RELAY_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/camera/status
   * Updates camera connection/health status from the Python Camera Bridge.
   */
  public static async updateStatus(req: Request, res: Response): Promise<void> {
    const parseResult = CameraStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        status: 'error',
        code: 'STATUS_VALIDATION_FAILED',
        message: 'Invalid camera status payload',
        details: parseResult.error.format()
      });
      return;
    }

    const status = parseResult.data;
    const updatedAt = new Date().toISOString();

    try {
      latestStatuses.set(status.droneId, { ...status, updatedAt });

      if (mongoose.connection.readyState === 1) {
        const drone = await Drone.findOne({ droneId: status.droneId });
        if (drone) {
          await HardwareDevice.findOneAndUpdate(
            { deviceId: status.cameraId },
            {
              $set: {
                droneId: drone._id,
                deviceType: 'CAMERA',
                connectionStatus: status.connectionStatus === 'CONNECTED' || status.connectionStatus === 'STREAMING' ? 'CONNECTED' : 'DISCONNECTED',
                lastSeenAt: new Date(),
                metadata: {
                  streamStatus: status.streamStatus,
                  resolution: status.resolution,
                  frameRate: status.frameRate,
                  source: status.source
                }
              }
            },
            { upsert: true }
          );
        }
      }

      // Broadcast status update
      try {
        const io = getSocketServer();
        const room = `drone:camera:${status.droneId}`;
        io.to(room).emit(`camera:status:${status.droneId}`, status);
        io.to(room).emit('camera:status', status);
      } catch {
        // Socket optional
      }

      res.status(200).json({
        status: 'success',
        message: 'Camera status updated',
        data: status
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown status update error';
      res.status(500).json({ status: 'error', code: 'STATUS_UPDATE_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/drones/:droneId/camera/status
   * Retrieves authoritative camera device status and metadata.
   */
  public static async getCameraStatus(req: Request, res: Response): Promise<void> {
    try {
      const droneId = (req.params.droneId as string).toUpperCase();
      const cachedStatus = latestStatuses.get(droneId);
      const cachedFrame = latestFrames.get(droneId);

      let hardwareDevice = null;
      if (mongoose.connection.readyState === 1) {
        const drone = await Drone.findOne({ droneId });
        if (drone) {
          hardwareDevice = await HardwareDevice.findOne({ droneId: drone._id, deviceType: 'CAMERA' }).lean();
        }
      }

      const isFrameFresh = cachedFrame
        ? (Date.now() - new Date(cachedFrame.receivedAt).getTime()) < 5000
        : false;

      res.status(200).json({
        status: 'success',
        data: {
          droneId,
          cameraId: cachedStatus?.cameraId || (hardwareDevice as any)?.deviceId || 'CAM-OV2640-01',
          hardwareInstalled: !!hardwareDevice,
          connectionStatus: cachedStatus?.connectionStatus || (hardwareDevice as any)?.connectionStatus || 'NOT_INSTALLED',
          streamStatus: isFrameFresh ? 'STREAMING' : (cachedStatus?.streamStatus || 'OFFLINE'),
          lastFrameAt: cachedFrame?.receivedAt || cachedStatus?.lastFrameAt || null,
          frameFreshness: isFrameFresh ? 'FRESH' : (cachedFrame ? 'STALE' : 'NO_FRAMES'),
          source: cachedStatus?.source || (hardwareDevice as any)?.metadata?.source || 'REAL',
          resolution: cachedFrame ? `${cachedFrame.frameWidth}x${cachedFrame.frameHeight}` : (cachedStatus?.resolution || '640x480'),
          frameRate: cachedStatus?.frameRate || 0,
          hardwareDevice
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'CAMERA_STATUS_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/admin/drones/:droneId/camera/preview/latest
   * Returns latest cached camera frame for Admin preview.
   */
  public static async getLatestPreview(req: Request, res: Response): Promise<void> {
    try {
      const droneId = (req.params.droneId as string).toUpperCase();
      const cachedFrame = latestFrames.get(droneId);

      if (!cachedFrame) {
        res.status(404).json({
          status: 'error',
          code: 'NO_FRAME_AVAILABLE',
          message: `No camera frames available for drone '${droneId}'. Camera on standby.`
        });
        return;
      }

      const ageMs = Date.now() - new Date(cachedFrame.receivedAt).getTime();

      res.status(200).json({
        status: 'success',
        data: {
          ...cachedFrame,
          ageMs,
          isStale: ageMs > 5000
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'PREVIEW_FETCH_FAILED', message: msg });
    }
  }

  /**
   * Internal telemetry & health check accessor
   */
  public static getLatestFrame(droneId?: string): (CameraFrameInput & { receivedAt: string }) | null {
    if (droneId) {
      return latestFrames.get(droneId) || null;
    }
    let latest: (CameraFrameInput & { receivedAt: string }) | null = null;
    for (const frame of latestFrames.values()) {
      if (!latest || new Date(frame.receivedAt) > new Date(latest.receivedAt)) {
        latest = frame;
      }
    }
    return latest;
  }
}

