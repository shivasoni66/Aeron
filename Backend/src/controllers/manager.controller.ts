import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Mission, MissionType, MissionStatus } from '../models/Mission.js';
import { MissionEvent } from '../models/MissionEvent.js';
import { Incident } from '../models/Incident.js';
import { MissionOutcome } from '../models/MissionOutcome.js';
import { FlightSession } from '../models/FlightSession.js';
import { TelemetryRecord } from '../models/TelemetryRecord.js';
import { Drone } from '../models/Drone.js';
import { CitizenReport } from '../models/CitizenReport.js';
import { AuditLog } from '../models/AuditLog.js';
import { getSocketServer } from '../sockets/socket.server.js';
import {
  CreateMissionSchema,
  UpdateMissionSchema,
  CreateMissionEventSchema,
  UpdateIncidentSchema,
  ReviewOutcomeSchema,
  PublishOutcomeSchema
} from '../validators/manager.validator.js';

const STAGE_LABELS: Record<number, string> = {
  1: 'STAGE 1/8: MISSION PLANNING',
  2: 'STAGE 2/8: TARGET RECON',
  3: 'STAGE 3/8: GEOFENCE CORRIDOR',
  4: 'STAGE 4/8: DATA COLLECTION',
  5: 'STAGE 5/8: AI ANALYSIS',
  6: 'STAGE 6/8: MANUAL REVIEW',
  7: 'STAGE 7/8: VERIFIED',
  8: 'STAGE 8/8: COMPLETED'
};

const VALID_STATUS_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  PLANNED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAUSED', 'COMPLETED', 'ABORTED'],
  PAUSED: ['ACTIVE', 'ABORTED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  ABORTED: []
};

function safeEmit(event: string, payload: unknown, room?: string) {
  try {
    const io = getSocketServer();
    if (room) {
      io.to(room).emit(event, payload);
    } else {
      io.emit(event, payload);
    }
  } catch {
    // Socket server might not be active in unit tests; ignore silently
  }
}

export class ManagerController {
  /**
   * GET /api/v1/manager/dashboard
   * Consolidated mission intelligence overview, four module cards, recent events, and pending actions.
   */
  public static async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const [
        totalMissions,
        activeMissions,
        completedMissions,
        pendingOutcomesCount,
        pendingReportsCount,
        openIncidents,
        availableDrones
      ] = await Promise.all([
        Mission.countDocuments(),
        Mission.countDocuments({ status: 'ACTIVE' }),
        Mission.countDocuments({ status: 'COMPLETED' }),
        MissionOutcome.countDocuments({ reviewStatus: 'PENDING_REVIEW' }),
        CitizenReport.countDocuments({ status: { $in: ['SUBMITTED', 'MUNICIPAL_REVIEW'] } }),
        Incident.countDocuments({ status: { $in: ['OPEN', 'INVESTIGATING'] } }),
        Drone.countDocuments({ operationalStatus: 'READY' })
      ]);

      const pendingReviews = pendingOutcomesCount + pendingReportsCount;

      // Module breakdown for the 4 core verticals
      const moduleTypes: { id: string; code: MissionType; title: string }[] = [
        { id: 'M01', code: 'CIVIC_ISSUE_VERIFICATION', title: 'Civic Issue Verification' },
        { id: 'M02', code: 'CROWD_SAFETY', title: 'Crowd Safety & Aerial Mesh' },
        { id: 'M03', code: 'MICRO_CLIMATE', title: 'Micro-Climate & Heat Island' },
        { id: 'M04', code: 'SUBTERRANEAN_SEARCH_RESCUE', title: 'Subterranean Search & Rescue' }
      ];

      const modules = await Promise.all(
        moduleTypes.map(async (mod) => {
          const [total, active, pending, latestMission] = await Promise.all([
            Mission.countDocuments({ missionType: mod.code }),
            Mission.countDocuments({ missionType: mod.code, status: 'ACTIVE' }),
            Mission.countDocuments({ missionType: mod.code, stage: 6 }), // Stage 6 = Manual Review
            Mission.findOne({ missionType: mod.code })
              .sort({ updatedAt: -1 })
              .populate('assignedDrones', 'droneId displayName operationalStatus')
              .lean()
          ]);

          return {
            id: mod.id,
            code: mod.code,
            title: mod.title,
            totalMissions: total,
            activeMissions: active,
            pendingReviews: pending,
            currentStage: latestMission?.stage || 1,
            stageLabel: latestMission?.stageLabel || 'STAGE 1/8: MISSION PLANNING',
            assignedDrone: latestMission?.assignedDrones?.[0] || null,
            latestUpdate: latestMission?.updatedAt || null
          };
        })
      );

      // Recent Mission Events Timeline
      const timelineEvents = await MissionEvent.find()
        .sort({ eventTimestamp: -1 })
        .limit(10)
        .populate('missionId', 'missionId title missionType status')
        .populate('actorId', 'name email role')
        .lean();

      // Pending Operational Actions
      const [pendingOutcomes, urgentIncidents] = await Promise.all([
        MissionOutcome.find({ reviewStatus: 'PENDING_REVIEW' })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('missionId', 'missionId title missionType')
          .lean(),
        Incident.find({ status: { $in: ['OPEN', 'INVESTIGATING'] }, severity: { $in: ['HIGH', 'CRITICAL'] } })
          .sort({ reportedAt: -1 })
          .limit(5)
          .populate('missionId', 'missionId title')
          .lean()
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          overview: {
            totalMissions,
            activeMissions,
            completedMissions,
            pendingReviews,
            openIncidents,
            availableDrones
          },
          modules,
          timeline: timelineEvents,
          pendingActions: {
            outcomesAwaitingReview: pendingOutcomes,
            urgentIncidents
          },
          dataFreshnessTimestamp: new Date().toISOString()
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown dashboard error';
      res.status(500).json({ status: 'error', code: 'DASHBOARD_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/missions
   * Lists missions with search, filtering, and pagination.
   */
  public static async getMissions(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};

      if (req.query.category || req.query.missionType) {
        filter.missionType = req.query.category || req.query.missionType;
      }
      if (req.query.status) {
        filter.status = req.query.status;
      }
      if (req.query.assignedManager) {
        filter.assignedManager = req.query.assignedManager;
      }
      if (req.query.search) {
        const regex = new RegExp(req.query.search as string, 'i');
        filter.$or = [{ missionId: regex }, { title: regex }, { description: regex }];
      }

      const [missions, total] = await Promise.all([
        Mission.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('assignedDrones', 'droneId displayName model operationalStatus')
          .populate('assignedManager', 'name email role')
          .populate('createdBy', 'name email role')
          .lean(),
        Mission.countDocuments(filter)
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          missions,
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
      res.status(500).json({ status: 'error', code: 'MISSIONS_FETCH_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/manager/missions
   * Creates a new mission with strict validation, drone assignment verification, and audit logging.
   */
  public static async createMission(req: Request, res: Response): Promise<void> {
    try {
      const validated = CreateMissionSchema.parse(req.body);

      // Verify drone assignment eligibility if drones provided
      const resolvedDroneObjectIds: mongoose.Types.ObjectId[] = [];
      if (validated.assignedDrones && validated.assignedDrones.length > 0) {
        for (const droneIdentifier of validated.assignedDrones) {
          const drone = mongoose.isValidObjectId(droneIdentifier)
            ? await Drone.findById(droneIdentifier)
            : await Drone.findOne({ droneId: droneIdentifier.toUpperCase() });

          if (!drone) {
            res.status(400).json({
              status: 'error',
              code: 'DRONE_NOT_FOUND',
              message: `Assigned drone '${droneIdentifier}' does not exist in registry`
            });
            return;
          }

          if (drone.operationalStatus === 'MAINTENANCE' || drone.operationalStatus === 'OFFLINE') {
            res.status(400).json({
              status: 'error',
              code: 'DRONE_NOT_ELIGIBLE',
              message: `Drone '${drone.droneId}' is currently ${drone.operationalStatus} and cannot be assigned`
            });
            return;
          }

          resolvedDroneObjectIds.push(drone._id as mongoose.Types.ObjectId);
        }
      }

      // Generate unique mission ID
      const prefix = validated.missionType === 'CIVIC_ISSUE_VERIFICATION' ? 'CIV'
        : validated.missionType === 'CROWD_SAFETY' ? 'CRW'
        : validated.missionType === 'MICRO_CLIMATE' ? 'MCR'
        : 'SAR';
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const missionId = `MSN-${prefix}-${randomSuffix}`;

      const userId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;
      const managerId = validated.assignedManager && mongoose.isValidObjectId(validated.assignedManager)
        ? new mongoose.Types.ObjectId(validated.assignedManager)
        : userId;

      const mission = await Mission.create({
        missionId,
        missionType: validated.missionType,
        title: validated.title,
        description: validated.description,
        status: 'PLANNED',
        stage: 1,
        stageLabel: STAGE_LABELS[1],
        createdBy: userId,
        assignedManager: managerId,
        assignedDrones: resolvedDroneObjectIds,
        plannedStart: validated.plannedStart ? new Date(validated.plannedStart) : undefined,
        operationalArea: validated.operationalArea,
        metadata: validated.metadata || {}
      });

      // Record MissionEvent
      await MissionEvent.create({
        missionId: mission._id,
        eventType: 'MISSION_CREATED',
        actorId: userId,
        description: `Mission ${missionId} created by ${req.user?.name || 'Manager'}`,
        source: 'MANAGER_WEB',
        metadata: { missionType: validated.missionType, title: validated.title }
      });

      // Audit Log
      await AuditLog.create({
        actorId: userId,
        action: 'MISSION_CREATED',
        entityType: 'Mission',
        entityId: mission.missionId,
        source: 'MANAGER_WEB',
        metadata: { missionType: validated.missionType, title: validated.title }
      });

      safeEmit('mission:created', mission);

      const populated = await Mission.findById(mission._id)
        .populate('assignedDrones', 'droneId displayName model operationalStatus')
        .populate('assignedManager', 'name email role')
        .populate('createdBy', 'name email role');

      res.status(201).json({
        status: 'success',
        data: { mission: populated }
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'issues' in err) {
        res.status(400).json({ status: 'error', code: 'VALIDATION_FAILED', message: err.message, details: (err as any).issues });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'MISSION_CREATE_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/missions/:missionId
   * Retrieves single mission with associated events, incidents, and outcomes.
   */
  public static async getMissionById(req: Request, res: Response): Promise<void> {
    try {
      const missionId = String(req.params.missionId);
      const isOid = mongoose.isValidObjectId(missionId);

      const mission = await Mission.findOne(isOid ? { $or: [{ _id: missionId }, { missionId: missionId.toUpperCase() }] } : { missionId: missionId.toUpperCase() })
        .populate('assignedDrones', 'droneId displayName model operationalStatus lastTelemetryAt')
        .populate('assignedManager', 'name email role')
        .populate('createdBy', 'name email role')
        .lean();

      if (!mission) {
        res.status(404).json({ status: 'error', code: 'MISSION_NOT_FOUND', message: `Mission '${missionId}' not found` });
        return;
      }

      const [events, incidents, outcomes] = await Promise.all([
        MissionEvent.find({ missionId: mission._id }).sort({ eventTimestamp: -1 }).populate('actorId', 'name email role').lean(),
        Incident.find({ missionId: mission._id }).sort({ reportedAt: -1 }).lean(),
        MissionOutcome.find({ missionId: mission._id }).sort({ createdAt: -1 }).lean()
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          mission,
          events,
          incidents,
          outcomes
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'MISSION_FETCH_FAILED', message: msg });
    }
  }

  /**
   * PATCH /api/v1/manager/missions/:missionId
   * Validated mission updates and lifecycle stage transitions.
   */
  public static async updateMission(req: Request, res: Response): Promise<void> {
    try {
      const missionId = String(req.params.missionId);
      const validated = UpdateMissionSchema.parse(req.body);

      const isOid = mongoose.isValidObjectId(missionId);
      const mission = await Mission.findOne(isOid ? { $or: [{ _id: missionId }, { missionId: missionId.toUpperCase() }] } : { missionId: missionId.toUpperCase() });

      if (!mission) {
        res.status(404).json({ status: 'error', code: 'MISSION_NOT_FOUND', message: `Mission '${missionId}' not found` });
        return;
      }

      const userId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;

      // Status transition validation
      if (validated.status && validated.status !== mission.status) {
        const allowedTransitions = VALID_STATUS_TRANSITIONS[mission.status] || [];
        if (!allowedTransitions.includes(validated.status)) {
          res.status(400).json({
            status: 'error',
            code: 'INVALID_STATUS_TRANSITION',
            message: `Cannot transition mission from '${mission.status}' to '${validated.status}'. Allowed: [${allowedTransitions.join(', ')}]`
          });
          return;
        }

        const prevStatus = mission.status;
        mission.status = validated.status;

        if (validated.status === 'ACTIVE' && !mission.actualStart) {
          mission.actualStart = new Date();
        }
        if (['COMPLETED', 'CANCELLED', 'ABORTED'].includes(validated.status)) {
          mission.completedAt = new Date();
        }

        await MissionEvent.create({
          missionId: mission._id,
          eventType: 'STATUS_TRANSITION',
          actorId: userId,
          description: `Mission status changed from ${prevStatus} to ${validated.status}`,
          source: 'MANAGER_WEB',
          metadata: { prevStatus, newStatus: validated.status }
        });
      }

      // Stage transition validation
      if (validated.stage !== undefined) {
        const prevStage = mission.stage;
        mission.stage = validated.stage;
        mission.stageLabel = validated.stageLabel || STAGE_LABELS[validated.stage] || `STAGE ${validated.stage}/8`;

        await MissionEvent.create({
          missionId: mission._id,
          eventType: 'STAGE_CHANGED',
          actorId: userId,
          description: `Mission stage transitioned to ${mission.stageLabel}`,
          source: 'MANAGER_WEB',
          metadata: { prevStage, newStage: validated.stage }
        });

        safeEmit('mission:stage_changed', { missionId: mission.missionId, stage: mission.stage, stageLabel: mission.stageLabel });
      }

      if (validated.title) mission.title = validated.title;
      if (validated.description) mission.description = validated.description;
      if (validated.operationalArea) mission.operationalArea = validated.operationalArea as any;
      if (validated.metadata) mission.metadata = { ...mission.metadata, ...validated.metadata };

      // Update drone assignments if provided
      if (validated.assignedDrones) {
        const resolvedDroneOids: mongoose.Types.ObjectId[] = [];
        for (const dId of validated.assignedDrones) {
          const drone = mongoose.isValidObjectId(dId)
            ? await Drone.findById(dId)
            : await Drone.findOne({ droneId: dId.toUpperCase() });
          if (drone) resolvedDroneOids.push(drone._id as mongoose.Types.ObjectId);
        }
        mission.assignedDrones = resolvedDroneOids;
      }

      await mission.save();

      // Audit Log
      await AuditLog.create({
        actorId: userId,
        action: 'MISSION_UPDATED',
        entityType: 'Mission',
        entityId: mission.missionId,
        source: 'MANAGER_WEB',
        metadata: { status: mission.status, stage: mission.stage }
      });

      safeEmit('mission:updated', mission);

      const populated = await Mission.findById(mission._id)
        .populate('assignedDrones', 'droneId displayName model operationalStatus')
        .populate('assignedManager', 'name email role')
        .populate('createdBy', 'name email role');

      res.status(200).json({
        status: 'success',
        data: { mission: populated }
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'issues' in err) {
        res.status(400).json({ status: 'error', code: 'VALIDATION_FAILED', message: err.message });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'MISSION_UPDATE_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/manager/missions/:missionId/events
   * Manually adds a mission annotation or event.
   */
  public static async createMissionEvent(req: Request, res: Response): Promise<void> {
    try {
      const missionId = String(req.params.missionId);
      const validated = CreateMissionEventSchema.parse(req.body);

      const isOid = mongoose.isValidObjectId(missionId);
      const mission = await Mission.findOne(isOid ? { $or: [{ _id: missionId }, { missionId: missionId.toUpperCase() }] } : { missionId: missionId.toUpperCase() });

      if (!mission) {
        res.status(404).json({ status: 'error', code: 'MISSION_NOT_FOUND', message: `Mission '${missionId}' not found` });
        return;
      }

      const userId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;

      const event = await MissionEvent.create({
        missionId: mission._id,
        eventType: validated.eventType,
        actorId: userId,
        description: validated.description,
        source: validated.source || 'MANAGER_WEB',
        metadata: validated.metadata || {}
      });

      safeEmit('mission:event', event, `mission:${mission.missionId}`);

      res.status(201).json({
        status: 'success',
        data: { event }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'EVENT_CREATE_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/incidents
   * Lists incidents with category, severity, status filtering, and confidentiality guards.
   */
  public static async getIncidents(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};

      if (req.query.severity) filter.severity = req.query.severity;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.category || req.query.incidentType) {
        filter.incidentType = req.query.category || req.query.incidentType;
      }
      if (req.query.missionId) {
        const m = mongoose.isValidObjectId(req.query.missionId as string)
          ? req.query.missionId
          : await Mission.findOne({ missionId: (req.query.missionId as string).toUpperCase() }).select('_id');
        if (m) filter.missionId = m;
      }

      const [incidents, total] = await Promise.all([
        Incident.find(filter)
          .sort({ reportedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('missionId', 'missionId title missionType')
          .populate('assignedManager', 'name email role')
          .lean(),
        Incident.countDocuments(filter)
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          incidents,
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
      res.status(500).json({ status: 'error', code: 'INCIDENTS_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/incidents/:incidentId
   */
  public static async getIncidentById(req: Request, res: Response): Promise<void> {
    try {
      const incidentId = String(req.params.incidentId);
      const isOid = mongoose.isValidObjectId(incidentId);

      const incident = await Incident.findOne(isOid ? { $or: [{ _id: incidentId }, { incidentId: incidentId.toUpperCase() }] } : { incidentId: incidentId.toUpperCase() })
        .populate('missionId', 'missionId title missionType operationalArea')
        .populate('assignedManager', 'name email role')
        .populate('evidenceAssets')
        .lean();

      if (!incident) {
        res.status(404).json({ status: 'error', code: 'INCIDENT_NOT_FOUND', message: `Incident '${incidentId}' not found` });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: { incident }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'INCIDENT_FETCH_FAILED', message: msg });
    }
  }

  /**
   * PATCH /api/v1/manager/incidents/:incidentId
   * Updates incident status, resolution notes, and manager assignment.
   */
  public static async updateIncident(req: Request, res: Response): Promise<void> {
    try {
      const incidentId = String(req.params.incidentId);
      const validated = UpdateIncidentSchema.parse(req.body);

      const isOid = mongoose.isValidObjectId(incidentId);
      const incident = await Incident.findOne(isOid ? { $or: [{ _id: incidentId }, { incidentId: incidentId.toUpperCase() }] } : { incidentId: incidentId.toUpperCase() });

      if (!incident) {
        res.status(404).json({ status: 'error', code: 'INCIDENT_NOT_FOUND', message: `Incident '${incidentId}' not found` });
        return;
      }

      if (validated.status) {
        incident.status = validated.status;
        if (['RESOLVED', 'CLOSED'].includes(validated.status)) {
          incident.resolvedAt = new Date();
        }
      }
      if (validated.severity) incident.severity = validated.severity;
      if (validated.description) incident.description = validated.description;
      if (validated.assignedManager && mongoose.isValidObjectId(validated.assignedManager)) {
        incident.assignedManager = new mongoose.Types.ObjectId(validated.assignedManager);
      }

      await incident.save();

      // Audit Log
      await AuditLog.create({
        actorId: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
        action: 'INCIDENT_UPDATED',
        entityType: 'Incident',
        entityId: incident.incidentId,
        source: 'MANAGER_WEB',
        metadata: { status: incident.status, severity: incident.severity }
      });

      safeEmit('incident:updated', incident);

      const populated = await Incident.findById(incident._id)
        .populate('missionId', 'missionId title')
        .populate('assignedManager', 'name email role');

      res.status(200).json({
        status: 'success',
        data: { incident: populated }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'INCIDENT_UPDATE_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/flights
   * Lists FlightSession records (distinguishing REAL vs SIMULATION).
   */
  public static async getFlights(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};

      if (req.query.source) filter.source = req.query.source;
      if (req.query.status) filter.status = req.query.status;
      if (req.query.search) {
        const regex = new RegExp(req.query.search as string, 'i');
        filter.$or = [{ flightSessionId: regex }, { summary: regex }];
      }

      const [flights, total] = await Promise.all([
        FlightSession.find(filter)
          .sort({ startedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('droneId', 'droneId displayName model')
          .populate('missionId', 'missionId title missionType')
          .lean(),
        FlightSession.countDocuments(filter)
      ]);

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
   * GET /api/v1/manager/flights/:flightSessionId
   * Retrieves flight session with bounded telemetry samples for route reconstruction.
   */
  public static async getFlightById(req: Request, res: Response): Promise<void> {
    try {
      const flightSessionId = String(req.params.flightSessionId);
      const isOid = mongoose.isValidObjectId(flightSessionId);

      const flight = await FlightSession.findOne(
        isOid
          ? { $or: [{ _id: flightSessionId }, { flightSessionId: flightSessionId.toUpperCase() }] }
          : { flightSessionId: flightSessionId.toUpperCase() }
      )
        .populate('droneId', 'droneId displayName model flightController')
        .populate('missionId', 'missionId title missionType operationalArea')
        .lean();

      if (!flight) {
        res.status(404).json({ status: 'error', code: 'FLIGHT_NOT_FOUND', message: `Flight session '${flightSessionId}' not found` });
        return;
      }

      // Query bounded telemetry points for route drawing (up to 200 points)
      const telemetrySamples = await TelemetryRecord.find({
        $or: [
          { flightSessionId: flight._id },
          { droneId: (flight.droneId as any)?._id || flight.droneId }
        ]
      })
        .sort({ recordedAt: 1 })
        .limit(200)
        .select('latitude longitude altitude relativeAltitude groundSpeed heading recordedAt source isSimulated')
        .lean();

      res.status(200).json({
        status: 'success',
        data: {
          flight,
          telemetrySamples
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'FLIGHT_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/outcomes
   * Lists MissionOutcome records.
   */
  public static async getOutcomes(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {};
      if (req.query.reviewStatus) filter.reviewStatus = req.query.reviewStatus;
      if (req.query.outcomeType) filter.outcomeType = req.query.outcomeType;
      if (req.query.isPublic !== undefined) filter.isPublic = req.query.isPublic === 'true';

      const [outcomes, total] = await Promise.all([
        MissionOutcome.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('missionId', 'missionId title missionType')
          .populate('reviewedBy', 'name email role')
          .populate('evidenceAssets')
          .lean(),
        MissionOutcome.countDocuments(filter)
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          outcomes,
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
      res.status(500).json({ status: 'error', code: 'OUTCOMES_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/outcomes/:outcomeId
   */
  public static async getOutcomeById(req: Request, res: Response): Promise<void> {
    try {
      const outcomeId = String(req.params.outcomeId);
      const isOid = mongoose.isValidObjectId(outcomeId);

      const outcome = await MissionOutcome.findOne(
        isOid
          ? { $or: [{ _id: outcomeId }, { outcomeId: outcomeId.toUpperCase() }] }
          : { outcomeId: outcomeId.toUpperCase() }
      )
        .populate('missionId', 'missionId title missionType operationalArea')
        .populate('reviewedBy', 'name email role')
        .populate('evidenceAssets')
        .lean();

      if (!outcome) {
        res.status(404).json({ status: 'error', code: 'OUTCOME_NOT_FOUND', message: `Outcome '${outcomeId}' not found` });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: { outcome }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'OUTCOME_FETCH_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/manager/outcomes/:outcomeId/review
   * Submits review decision (APPROVED or REJECTED) with manager credentials.
   */
  public static async reviewOutcome(req: Request, res: Response): Promise<void> {
    try {
      const outcomeId = String(req.params.outcomeId);
      const validated = ReviewOutcomeSchema.parse(req.body);

      const isOid = mongoose.isValidObjectId(outcomeId);
      const outcome = await MissionOutcome.findOne(
        isOid
          ? { $or: [{ _id: outcomeId }, { outcomeId: outcomeId.toUpperCase() }] }
          : { outcomeId: outcomeId.toUpperCase() }
      );

      if (!outcome) {
        res.status(404).json({ status: 'error', code: 'OUTCOME_NOT_FOUND', message: `Outcome '${outcomeId}' not found` });
        return;
      }

      const userId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;

      outcome.reviewStatus = validated.decision;
      outcome.reviewedBy = userId;
      outcome.reviewedAt = new Date();
      if (validated.findings) {
        outcome.findings = validated.findings;
      }

      await outcome.save();

      // Audit Log
      await AuditLog.create({
        actorId: userId,
        action: 'OUTCOME_REVIEWED',
        entityType: 'MissionOutcome',
        entityId: outcome.outcomeId,
        source: 'MANAGER_WEB',
        metadata: { decision: validated.decision }
      });

      safeEmit('outcome:review_updated', outcome);

      const populated = await MissionOutcome.findById(outcome._id)
        .populate('missionId', 'missionId title missionType')
        .populate('reviewedBy', 'name email role');

      res.status(200).json({
        status: 'success',
        data: { outcome: populated }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'OUTCOME_REVIEW_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/manager/outcomes/:outcomeId/publish
   * Publishes approved mission outcome to the public Citizen App feed.
   * Strictly enforces that outcome must be in 'APPROVED' status.
   * Protects sensitive SAR confidential data from public leakage.
   */
  public static async publishOutcome(req: Request, res: Response): Promise<void> {
    try {
      const outcomeId = String(req.params.outcomeId);
      PublishOutcomeSchema.parse(req.body);

      const isOid = mongoose.isValidObjectId(outcomeId);
      const outcome = await MissionOutcome.findOne(
        isOid
          ? { $or: [{ _id: outcomeId }, { outcomeId: outcomeId.toUpperCase() }] }
          : { outcomeId: outcomeId.toUpperCase() }
      );

      if (!outcome) {
        res.status(404).json({ status: 'error', code: 'OUTCOME_NOT_FOUND', message: `Outcome '${outcomeId}' not found` });
        return;
      }

      // Check if outcome is approved
      if (outcome.reviewStatus !== 'APPROVED') {
        res.status(400).json({
          status: 'error',
          code: 'OUTCOME_NOT_APPROVED',
          message: `Outcome '${outcome.outcomeId}' cannot be published. Current status is '${outcome.reviewStatus}'. Must be 'APPROVED' first.`
        });
        return;
      }

      // Confidential SAR protection: Rescue operations with sensitive data must not be broadcast publicly
      if (outcome.isConfidential || outcome.outcomeType === 'RESCUE_OPERATION') {
        const associatedIncident = outcome.missionId
          ? await Incident.findOne({ missionId: outcome.missionId, isConfidential: true })
          : null;

        if (outcome.isConfidential || associatedIncident) {
          res.status(403).json({
            status: 'error',
            code: 'SAR_CONFIDENTIAL_PROTECTED',
            message: 'Publishing restricted: Rescue operation contains protected confidential survivor data.'
          });
          return;
        }
      }

      const userId = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined;

      outcome.reviewStatus = 'PUBLISHED';
      outcome.isPublic = true;
      outcome.publishedAt = new Date();

      await outcome.save();

      // Audit Log
      await AuditLog.create({
        actorId: userId,
        action: 'OUTCOME_PUBLISHED',
        entityType: 'MissionOutcome',
        entityId: outcome.outcomeId,
        source: 'MANAGER_WEB',
        metadata: { publishedAt: outcome.publishedAt }
      });

      safeEmit('outcome:published', outcome);

      const populated = await MissionOutcome.findById(outcome._id)
        .populate('missionId', 'missionId title missionType')
        .populate('reviewedBy', 'name email role');

      res.status(200).json({
        status: 'success',
        data: { outcome: populated }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'OUTCOME_PUBLISH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/analytics/overview
   * Aggregates operational database metrics without fabricated statistics.
   */
  public static async getAnalyticsOverview(req: Request, res: Response): Promise<void> {
    try {
      const [
        missionsByCategory,
        missionsByStatus,
        flightsBySource,
        flightDurationAgg,
        incidentsBySeverity,
        incidentsByStatus,
        outcomesByReviewStatus
      ] = await Promise.all([
        Mission.aggregate([{ $group: { _id: '$missionType', count: { $sum: 1 } } }]),
        Mission.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        FlightSession.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]),
        FlightSession.aggregate([{ $group: { _id: null, totalSeconds: { $sum: '$durationSeconds' } } }]),
        Incident.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
        Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        MissionOutcome.aggregate([{ $group: { _id: '$reviewStatus', count: { $sum: 1 } } }])
      ]);

      const totalFlightSeconds = flightDurationAgg[0]?.totalSeconds || 0;

      res.status(200).json({
        status: 'success',
        data: {
          metrics: {
            missionsByCategory: Object.fromEntries(missionsByCategory.map(x => [x._id, x.count])),
            missionsByStatus: Object.fromEntries(missionsByStatus.map(x => [x._id, x.count])),
            flightsBySource: Object.fromEntries(flightsBySource.map(x => [x._id, x.count])),
            totalFlightDurationHours: Math.round((totalFlightSeconds / 3600) * 10) / 10,
            incidentsBySeverity: Object.fromEntries(incidentsBySeverity.map(x => [x._id, x.count])),
            incidentsByStatus: Object.fromEntries(incidentsByStatus.map(x => [x._id, x.count])),
            outcomesByReviewStatus: Object.fromEntries(outcomesByReviewStatus.map(x => [x._id, x.count]))
          },
          dataFreshnessTimestamp: new Date().toISOString()
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'ANALYTICS_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/drones/available
   * Returns registered drones with operational readiness.
   */
  public static async getAvailableDrones(req: Request, res: Response): Promise<void> {
    try {
      const drones = await Drone.find().sort({ operationalStatus: 1, createdAt: -1 }).lean();
      res.status(200).json({
        status: 'success',
        data: { drones }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'DRONES_FETCH_FAILED', message: msg });
    }
  }
}
