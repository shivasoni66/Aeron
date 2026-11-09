import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { TelemetryIngestSchema, SingleTelemetryInput } from '../validators/telemetry.validator.js';
import { TelemetryRecord } from '../models/TelemetryRecord.js';
import { Drone } from '../models/Drone.js';
import { getSocketServer } from '../sockets/socket.server.js';
import { logger } from '../utils/logger.js';

export class TelemetryController {
  /**
   * POST /api/v1/telemetry/ingest
   * Ingests single or batched verified telemetry from the Python MAVLink Bridge.
   * Authenticated via requireDroneBridgeAuth.
   */
  public static async ingest(req: Request, res: Response): Promise<void> {
    const parseResult = TelemetryIngestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        status: 'error',
        code: 'VALIDATION_FAILED',
        message: 'Invalid telemetry payload structure or sentinel values',
        details: parseResult.error.format()
      });
      return;
    }

    const rawData = parseResult.data;
    const items: SingleTelemetryInput[] = Array.isArray(rawData) ? rawData : [rawData];

    try {
      // Group items by droneId to minimize database lookups
      const droneCache = new Map<string, mongoose.Types.ObjectId>();

      for (const item of items) {
        if (!droneCache.has(item.droneId)) {
          let drone = null;
          if (mongoose.connection.readyState === 1) {
            drone = await Drone.findOne({ droneId: item.droneId });
            if (!drone) {
              // Pre-authorized drone allowlist for bench testing and simulation
              const authorizedAllowlist = [
                'AERON-PX4-BENCH01',
                'AERON-HEX-01',
                'DRONE-01',
                'DRONE-SIM-01',
                'DRONE-SIM-02',
                'AERON-QUAD-01'
              ];

              if (authorizedAllowlist.includes(item.droneId)) {
                // Automatically register pre-authorized airframe if first time seen
                drone = await Drone.create({
                  droneId: item.droneId,
                  displayName: `AERON Airframe ${item.droneId}`,
                  model: 'AERON Quadcopter (Pixhawk 2.4.8)',
                  manufacturer: 'AERON Aerospace',
                  flightController: 'Pixhawk 2.4.8 (STM32F427)',
                  operationalStatus: item.armed ? 'IN_FLIGHT' : 'READY',
                  lastTelemetryAt: item.recordedAt
                });
              } else {
                logger.warn(`[TelemetryController] Rejected ingestion: Unprovisioned drone identity '${item.droneId}'`);
                res.status(403).json({
                  status: 'error',
                  code: 'UNAUTHORIZED_DRONE_ID',
                  message: `Drone identity '${item.droneId}' is not authorized or provisioned. Machine token valid, but drone airframe must be pre-registered by an Administrator.`
                });
                return;
              }
            }
          }
          const resolvedId = drone?._id || new mongoose.Types.ObjectId();
          droneCache.set(item.droneId, resolvedId);
        }
      }

      // Prepare records for database insertion
      const recordsToInsert = items.map((item) => {
        const droneObjectId = droneCache.get(item.droneId)!;
        const record: any = {
          droneId: droneObjectId,
          recordedAt: item.recordedAt,
          receivedAt: new Date(),
          source: item.source,
          isSimulated: item.isSimulated,
          armed: item.armed,
          connectionStatus: item.connectionStatus || 'CONNECTED',
          sensorHealth: item.sensorHealth || {}
        };

        if (item.flightSessionId && mongoose.Types.ObjectId.isValid(item.flightSessionId)) {
          record.flightSessionId = new mongoose.Types.ObjectId(item.flightSessionId);
        }

        if (item.latitude !== undefined && item.latitude !== null && item.longitude !== undefined && item.longitude !== null) {
          record.latitude = item.latitude;
          record.longitude = item.longitude;
          record.location = {
            type: 'Point',
            coordinates: [item.longitude, item.latitude]
          };
        }

        if (item.altitude !== undefined && item.altitude !== null) record.altitude = item.altitude;
        if (item.relativeAltitude !== undefined && item.relativeAltitude !== null) record.relativeAltitude = item.relativeAltitude;
        if (item.groundSpeed !== undefined && item.groundSpeed !== null) record.groundSpeed = item.groundSpeed;
        if (item.heading !== undefined && item.heading !== null) record.heading = item.heading;
        if (item.gpsFixType !== undefined && item.gpsFixType !== null) record.gpsFixType = item.gpsFixType;
        if (item.satellites !== undefined && item.satellites !== null) record.satellites = item.satellites;
        if (item.hdop !== undefined && item.hdop !== null) record.hdop = item.hdop;
        if (item.batteryVoltage !== undefined && item.batteryVoltage !== null) record.batteryVoltage = item.batteryVoltage;
        if (item.batteryCurrent !== undefined && item.batteryCurrent !== null) record.batteryCurrent = item.batteryCurrent;
        if (item.batteryPercentage !== undefined && item.batteryPercentage !== null) record.batteryPercentage = item.batteryPercentage;
        if (item.flightMode !== undefined && item.flightMode !== null) record.flightMode = item.flightMode;

        return record;
      });

      // Persist in MongoDB if connected
      if (mongoose.connection.readyState === 1 && recordsToInsert.length > 0) {
        await TelemetryRecord.insertMany(recordsToInsert);

        // Update latest telemetry on each distinct drone
        for (const [droneIdStr, droneObjId] of droneCache.entries()) {
          const latestItem = items.filter((i) => i.droneId === droneIdStr).pop();
          if (latestItem) {
            await Drone.updateOne(
              { _id: droneObjId },
              {
                $set: {
                  lastTelemetryAt: latestItem.recordedAt,
                  operationalStatus: latestItem.armed ? 'IN_FLIGHT' : 'READY'
                }
              }
            );
          }
        }
      }

      // Broadcast Socket.IO events to authorized rooms
      try {
        const io = getSocketServer();
        for (const item of items) {
          const room = `drone:telemetry:${item.droneId}`;
          const broadcastPayload = {
            ...item,
            receivedAt: new Date().toISOString(),
            recordedAt: item.recordedAt.toISOString()
          };

          // Primary telemetry feeds
          io.to(room).emit(`telemetry:${item.droneId}`, broadcastPayload);
          io.to(room).emit('telemetry', broadcastPayload);
          io.to(room).emit('telemetry:stream', broadcastPayload);
          io.to('admin:telemetry').emit('telemetry', broadcastPayload);

          // Discrete subsystem events
          io.to(room).emit('drone:connection', {
            droneId: item.droneId,
            status: item.connectionStatus,
            source: item.source,
            isSimulated: item.isSimulated,
            recordedAt: item.recordedAt.toISOString()
          });

          if (item.latitude !== null && item.latitude !== undefined) {
            io.to(room).emit('drone:gps', {
              droneId: item.droneId,
              latitude: item.latitude,
              longitude: item.longitude,
              altitude: item.altitude,
              relativeAltitude: item.relativeAltitude,
              gpsFixType: item.gpsFixType,
              satellites: item.satellites,
              hdop: item.hdop
            });
          }

          if (item.batteryVoltage !== null && item.batteryVoltage !== undefined) {
            io.to(room).emit('drone:battery', {
              droneId: item.droneId,
              voltage: item.batteryVoltage,
              current: item.batteryCurrent,
              percentage: item.batteryPercentage
            });
          }

          io.to(room).emit('drone:health', {
            droneId: item.droneId,
            armed: item.armed,
            flightMode: item.flightMode,
            sensorHealth: item.sensorHealth
          });
        }
      } catch (socketErr) {
        // Socket.IO may not be initialized in non-server / test runs
        logger.debug('[TelemetryController] Socket.IO broadcast skipped or uninitialized');
      }

      res.status(201).json({
        status: 'success',
        message: `Successfully ingested ${items.length} telemetry records`,
        data: {
          ingestedCount: items.length,
          latestRecordedAt: items[items.length - 1].recordedAt.toISOString()
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during ingestion';
      logger.error(`[TelemetryController] Ingestion error: ${msg}`);
      res.status(500).json({
        status: 'error',
        code: 'INGESTION_FAILED',
        message: msg
      });
    }
  }

  /**
   * GET /api/v1/telemetry/latest/:droneId
   */
  public static async getLatest(req: Request, res: Response): Promise<void> {
    try {
      const droneId = req.params.droneId as string;
      const drone = await Drone.findOne({ droneId });
      if (!drone) {
        res.status(404).json({
          status: 'error',
          code: 'DRONE_NOT_FOUND',
          message: `Drone with ID '${droneId}' not found`
        });
        return;
      }

      const telemetry = await TelemetryRecord.findOne({ droneId: drone._id })
        .sort({ recordedAt: -1 })
        .lean();

      res.status(200).json({
        status: 'success',
        data: { telemetry: telemetry || null }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'FETCH_FAILED', message: msg });
    }
  }
}

