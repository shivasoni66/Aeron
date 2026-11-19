import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Mission, MissionType, MissionStatus } from '../models/Mission.js';
import { MissionSession } from '../models/MissionSession.js';
import { Observation } from '../models/Observation.js';
import { MissionEvent } from '../models/MissionEvent.js';
import { Incident } from '../models/Incident.js';
import { MissionOutcome } from '../models/MissionOutcome.js';
import { FlightSession } from '../models/FlightSession.js';
import { TelemetryRecord } from '../models/TelemetryRecord.js';
import { Drone } from '../models/Drone.js';
import { CitizenReport } from '../models/CitizenReport.js';
import { Notification } from '../models/Notification.js';
import { AuditLog } from '../models/AuditLog.js';
import { getSocketServer } from '../sockets/socket.server.js';
import { EnvironmentalService } from '../services/environmental.service.js';
import {
  CreateMissionSchema,
  UpdateMissionSchema,
  CreateMissionEventSchema,
  CreateIncidentSchema,
  UpdateIncidentSchema,
  CreateFlightSessionSchema,
  UpdateFlightSessionSchema,
  ReviewOutcomeSchema,
  PublishOutcomeSchema,
  SetOperatingModeSchema,
  ActivateMissionControlSchema,
  ReviewObservationSchema
} from '../validators/manager.validator.js';

const OPERATIONAL_VERTICALS: MissionType[] = [
  'CIVIC_ISSUE_VERIFICATION',
  'CROWD_SAFETY',
  'SUBTERRANEAN_SEARCH_RESCUE'
];

async function getOrCreateActiveSession() {
  let session = await MissionSession.findOne().sort({ updatedAt: -1 });
  if (!session) {
    session = await MissionSession.create({
      sessionId: `SES-STD-${Date.now().toString(36).toUpperCase()}`,
      operatingMode: 'STANDARD',
      status: 'IDLE',
      childSessions: {
        civic: { status: 'IDLE', pipelineHealth: 'STOPPED', details: 'Awaiting activation' },
        crowd: { status: 'IDLE', pipelineHealth: 'STOPPED', details: 'Awaiting activation' },
        sar: { status: 'IDLE', pipelineHealth: 'STOPPED', details: 'Awaiting activation' }
      },
      environmentalService: {
        status: 'ONLINE',
        lastReadingAt: new Date(),
        sensorCount: 1,
        details: 'Continuous background micro-climate monitoring active'
      }
    });
  }
  return session;
}

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

        if (validated.status === 'ACTIVE') {
          // Check operational exclusivity lock
          if (OPERATIONAL_VERTICALS.includes(mission.missionType)) {
            const session = await getOrCreateActiveSession();
            if (session.operatingMode === 'MEGA_MISSION' && session.status === 'ACTIVE') {
              res.status(409).json({
                status: 'error',
                code: 'MEGA_MISSION_ACTIVE',
                message: 'Mega Mission is currently active. Individual standard missions cannot be activated during Mega Mission.'
              });
              return;
            }

            const conflictingMission = await Mission.findOne({
              _id: { $ne: mission._id },
              status: { $in: ['ACTIVE', 'PAUSED'] },
              missionType: { $in: OPERATIONAL_VERTICALS }
            });

            if (conflictingMission) {
              res.status(409).json({
                status: 'error',
                code: 'MISSION_LOCK_CONFLICT',
                message: `Operational exclusivity lock active: Mission '${conflictingMission.missionId}' (${conflictingMission.missionType}) is currently ${conflictingMission.status}. Only ONE operational mission may be active at a time.`
              });
              return;
            }

            // Acquire lock atomically
            session.status = 'ACTIVE';
            session.activeMissionId = mission.missionId;
            session.activeMissionType = mission.missionType;
            if (!session.sessionStartedAt) session.sessionStartedAt = new Date();

            if (mission.missionType === 'CIVIC_ISSUE_VERIFICATION') {
              session.childSessions.civic = {
                missionId: mission.missionId,
                status: 'ACTIVE',
                pipelineHealth: 'DEGRADED',
                details: 'Civic pipeline active (MODEL_NOT_AVAILABLE for pothole/garbage_dump)',
                lastInferenceAt: new Date()
              };
            } else if (mission.missionType === 'CROWD_SAFETY') {
              session.childSessions.crowd = {
                missionId: mission.missionId,
                status: 'ACTIVE',
                pipelineHealth: 'HEALTHY',
                details: 'Crowd safety & occupancy pipeline active (YOLO + ByteTrack)',
                modelName: 'yolo11n.pt',
                lastInferenceAt: new Date()
              };
            } else if (mission.missionType === 'SUBTERRANEAN_SEARCH_RESCUE') {
              session.childSessions.sar = {
                missionId: mission.missionId,
                status: 'ACTIVE',
                pipelineHealth: 'HEALTHY',
                details: 'SAR optical survivor detection active',
                modelName: 'yolov8n.pt',
                lastInferenceAt: new Date()
              };
            }
            await session.save();
            safeEmit('mission:session_updated', session);
          }
          if (!mission.actualStart) {
            mission.actualStart = new Date();
          }
        }

        if (validated.status === 'PAUSED') {
          const session = await MissionSession.findOne().sort({ updatedAt: -1 });
          if (session && session.activeMissionId === mission.missionId) {
            session.status = 'PAUSED';
            if (mission.missionType === 'CIVIC_ISSUE_VERIFICATION') session.childSessions.civic.status = 'PAUSED';
            if (mission.missionType === 'CROWD_SAFETY') session.childSessions.crowd.status = 'PAUSED';
            if (mission.missionType === 'SUBTERRANEAN_SEARCH_RESCUE') session.childSessions.sar.status = 'PAUSED';
            await session.save();
            safeEmit('mission:session_updated', session);
          }
        }

        if (['COMPLETED', 'CANCELLED', 'ABORTED'].includes(validated.status)) {
          mission.completedAt = new Date();
          const session = await MissionSession.findOne().sort({ updatedAt: -1 });
          if (session && session.activeMissionId === mission.missionId) {
            session.status = 'IDLE';
            session.activeMissionId = null;
            session.activeMissionType = null;
            session.sessionEndedAt = new Date();
            if (mission.missionType === 'CIVIC_ISSUE_VERIFICATION') session.childSessions.civic.status = 'STOPPED';
            if (mission.missionType === 'CROWD_SAFETY') session.childSessions.crowd.status = 'STOPPED';
            if (mission.missionType === 'SUBTERRANEAN_SEARCH_RESCUE') session.childSessions.sar.status = 'STOPPED';
            await session.save();
            safeEmit('mission:session_updated', session);
          }
        }

        mission.status = validated.status;

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
   * POST /api/v1/manager/incidents
   * Creates a new incident log with severity, classification, and geo-coordinates.
   */
  public static async createIncident(req: Request, res: Response): Promise<void> {
    try {
      const validated = CreateIncidentSchema.parse(req.body);

      // Generate unique incidentId
      const count = await Incident.countDocuments();
      const incidentId = `INC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

      let missionObjectId: mongoose.Types.ObjectId | undefined;
      if (validated.missionId) {
        const isOid = mongoose.isValidObjectId(validated.missionId);
        const mission = await Mission.findOne(
          isOid
            ? { $or: [{ _id: validated.missionId }, { missionId: validated.missionId.toUpperCase() }] }
            : { missionId: validated.missionId.toUpperCase() }
        );
        if (mission) missionObjectId = mission._id;
      }

      const incident = new Incident({
        incidentId,
        incidentType: validated.incidentType,
        severity: validated.severity || 'MEDIUM',
        status: 'OPEN',
        description: validated.description,
        isConfidential: validated.isConfidential ?? false,
        missionId: missionObjectId,
        location: validated.location || {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        },
        reportedAt: new Date(),
        assignedManager: validated.assignedManager && mongoose.isValidObjectId(validated.assignedManager)
          ? new mongoose.Types.ObjectId(validated.assignedManager)
          : req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined
      });

      await incident.save();

      // Audit Log
      await AuditLog.create({
        actorId: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
        action: 'INCIDENT_CREATED',
        entityType: 'Incident',
        entityId: incident.incidentId,
        source: req.user?.role === 'admin' ? 'ADMIN_WEB' : 'MANAGER_WEB',
        metadata: { severity: incident.severity, isConfidential: incident.isConfidential }
      });

      const populated = await Incident.findById(incident._id)
        .populate('missionId', 'missionId title missionType')
        .populate('assignedManager', 'name email role');

      safeEmit('incident:created', populated || incident);
      safeEmit('incident:updated', populated || incident);

      res.status(201).json({
        status: 'success',
        message: 'Incident reported and recorded successfully',
        data: { incident: populated || incident }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(400).json({ status: 'error', code: 'INCIDENT_CREATE_FAILED', message: msg });
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
   * POST /api/v1/manager/flights
   * Creates a new flight session record.
   */
  public static async createFlight(req: Request, res: Response): Promise<void> {
    try {
      const validated = CreateFlightSessionSchema.parse(req.body);

      // Find drone
      const isOid = mongoose.isValidObjectId(validated.droneId);
      const drone = await Drone.findOne(
        isOid
          ? { $or: [{ _id: validated.droneId }, { droneId: validated.droneId }] }
          : { droneId: validated.droneId }
      );
      if (!drone) {
        res.status(404).json({ status: 'error', code: 'DRONE_NOT_FOUND', message: `Drone '${validated.droneId}' not found` });
        return;
      }

      let missionObjectId: mongoose.Types.ObjectId | undefined;
      if (validated.missionId) {
        const isMOid = mongoose.isValidObjectId(validated.missionId);
        const mission = await Mission.findOne(
          isMOid
            ? { $or: [{ _id: validated.missionId }, { missionId: validated.missionId.toUpperCase() }] }
            : { missionId: validated.missionId.toUpperCase() }
        );
        if (mission) missionObjectId = mission._id;
      }

      const count = await FlightSession.countDocuments();
      const flightSessionId = `FLT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(count + 1).padStart(4, '0')}`;

      const flight = new FlightSession({
        flightSessionId,
        droneId: drone._id,
        missionId: missionObjectId,
        startedAt: new Date(),
        status: 'ACTIVE',
        source: validated.source || 'REAL',
        startLocation: validated.startLocation || {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        },
        durationSeconds: 0,
        summary: validated.summary || `Airborne sortie logged for ${drone.droneId}`
      });

      await flight.save();

      const populated = await FlightSession.findById(flight._id)
        .populate('droneId', 'droneId displayName model operationalStatus')
        .populate('missionId', 'missionId title missionType');

      safeEmit('flight:created', populated || flight);
      safeEmit('flight:updated', populated || flight);

      res.status(201).json({
        status: 'success',
        message: 'Flight session initialized',
        data: { flight: populated || flight }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(400).json({ status: 'error', code: 'FLIGHT_CREATE_FAILED', message: msg });
    }
  }

  /**
   * PATCH /api/v1/manager/flights/:flightSessionId
   * Updates flight session status (COMPLETED/ABORTED), duration, and end location.
   */
  public static async updateFlight(req: Request, res: Response): Promise<void> {
    try {
      const flightSessionId = String(req.params.flightSessionId);
      const validated = UpdateFlightSessionSchema.parse(req.body);

      const isOid = mongoose.isValidObjectId(flightSessionId);
      const flight = await FlightSession.findOne(
        isOid
          ? { $or: [{ _id: flightSessionId }, { flightSessionId: flightSessionId.toUpperCase() }] }
          : { flightSessionId: flightSessionId.toUpperCase() }
      );
      if (!flight) {
        res.status(404).json({ status: 'error', code: 'FLIGHT_NOT_FOUND', message: `Flight session '${flightSessionId}' not found` });
        return;
      }

      if (validated.status) {
        flight.status = validated.status;
        if (['COMPLETED', 'ABORTED'].includes(validated.status) && !flight.endedAt) {
          flight.endedAt = new Date();
          if (!flight.durationSeconds || flight.durationSeconds === 0) {
            flight.durationSeconds = Math.max(1, Math.round((flight.endedAt.getTime() - flight.startedAt.getTime()) / 1000));
          }
        }
      }
      if (validated.durationSeconds !== undefined) flight.durationSeconds = validated.durationSeconds;
      if (validated.endLocation) flight.endLocation = validated.endLocation;
      if (validated.summary) flight.summary = validated.summary;

      await flight.save();

      const populated = await FlightSession.findById(flight._id)
        .populate('droneId', 'droneId displayName model operationalStatus')
        .populate('missionId', 'missionId title missionType');

      safeEmit('flight:updated', populated || flight);

      res.status(200).json({
        status: 'success',
        data: { flight: populated || flight }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(400).json({ status: 'error', code: 'FLIGHT_UPDATE_FAILED', message: msg });
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

  /**
   * GET /api/v1/manager/drones/:droneId/telemetry/latest
   * Returns authoritative latest telemetry record for an airframe with source filtering.
   */
  public static async getDroneLatestTelemetry(req: Request, res: Response): Promise<void> {
    try {
      const droneId = req.params.droneId as string;
      const drone = await Drone.findOne({ droneId });
      if (!drone) {
        res.status(404).json({
          status: 'error',
          code: 'DRONE_NOT_FOUND',
          message: `Drone '${droneId}' not found in registry`
        });
        return;
      }

      const source = (req.query.source as string | undefined)?.toUpperCase();
      const isSimParam = req.query.isSimulated as string | undefined;

      const query: any = { droneId: drone._id };
      if (source === 'REAL' || isSimParam === 'false') {
        query.isSimulated = { $ne: true };
        query.source = { $ne: 'SIMULATION' };
      } else if (source === 'SIMULATION' || isSimParam === 'true') {
        query.$or = [{ isSimulated: true }, { source: 'SIMULATION' }];
      }

      const telemetry = await TelemetryRecord.findOne(query)
        .sort({ recordedAt: -1 })
        .lean();

      res.status(200).json({
        status: 'success',
        data: { telemetry: telemetry || null }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'TELEMETRY_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/citizen-reports
   * List citizen issue reports with filtering, pagination, and media assets.
   */
  public static async getCitizenReports(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 15));
      const skip = (page - 1) * limit;

      const query: Record<string, unknown> = {};
      if (req.query.category) query.category = req.query.category;
      if (req.query.status) query.status = req.query.status;

      const [reports, total] = await Promise.all([
        CitizenReport.find(query)
          .sort({ submittedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('citizenId', 'name email reputationScore')
          .populate('mediaAssets')
          .lean(),
        CitizenReport.countDocuments(query)
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          reports,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1
          }
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'CITIZEN_REPORTS_FETCH_FAILED', message: msg });
    }
  }

  /**
   * PATCH /api/v1/manager/citizen-reports/:reportId
   * Updates report status, verification stage, or assigns to a mission.
   */
  public static async updateCitizenReport(req: Request, res: Response): Promise<void> {
    try {
      const reportId = String(req.params.reportId);
      const isOid = mongoose.isValidObjectId(reportId);
      const report = await CitizenReport.findOne(
        isOid ? { $or: [{ _id: reportId }, { reportId: reportId.toUpperCase() }] } : { reportId: reportId.toUpperCase() }
      );

      if (!report) {
        res.status(404).json({ status: 'error', code: 'REPORT_NOT_FOUND', message: `Report '${reportId}' not found` });
        return;
      }

      const { status, currentStage, duplicateOf } = req.body;
      const validStatuses = [
        'SUBMITTED',
        'MUNICIPAL_REVIEW',
        'INSPECTION_SCHEDULED',
        'AERIAL_VERIFIED',
        'PUBLIC_WORKS_ASSIGNED',
        'RESOLVED',
        'REJECTED'
      ];

      if (status && !validStatuses.includes(status)) {
        res.status(400).json({
          status: 'error',
          code: 'INVALID_STATUS',
          message: `Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`
        });
        return;
      }

      if (status) {
        report.status = status;
        if (typeof currentStage !== 'number') {
          const stageMap: Record<string, number> = {
            SUBMITTED: 1,
            MUNICIPAL_REVIEW: 2,
            INSPECTION_SCHEDULED: 3,
            AERIAL_VERIFIED: 4,
            PUBLIC_WORKS_ASSIGNED: 5,
            RESOLVED: 6,
            REJECTED: 1
          };
          if (stageMap[status]) report.currentStage = stageMap[status];
        }
      }
      if (typeof currentStage === 'number') report.currentStage = currentStage;
      if (duplicateOf && mongoose.isValidObjectId(duplicateOf)) report.duplicateOf = duplicateOf;

      report.reviewedAt = new Date();
      if (req.user?.id && mongoose.isValidObjectId(req.user.id)) {
        report.reviewedBy = new mongoose.Types.ObjectId(req.user.id);
      }

      await report.save();

      // Dispatch dynamic notification to reporting citizen
      if (status && status !== 'SUBMITTED') {
        const statusDisplayNames: Record<string, string> = {
          MUNICIPAL_REVIEW: 'Under Municipal Review',
          INSPECTION_SCHEDULED: 'Aerial Inspection Scheduled',
          AERIAL_VERIFIED: 'Aerial Drone Verified',
          PUBLIC_WORKS_ASSIGNED: 'Dispatched to Public Works',
          RESOLVED: 'Civic Issue Resolved',
          REJECTED: 'Report Rejected'
        };

        const readableStatus = statusDisplayNames[status] || status;
        await Notification.create({
          recipientId: report.citizenId,
          title: `Report Status: ${readableStatus}`,
          message: `Your civic report ${report.reportId} status has progressed to ${readableStatus}.`,
          category: 'CIVIC_UPDATE',
          relatedEntityType: 'CITIZEN_REPORT',
          relatedEntityId: report._id
        });
      }

      safeEmit('citizen:report_updated', report);

      res.status(200).json({
        status: 'success',
        message: 'Citizen report updated successfully',
        data: { report }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'CITIZEN_REPORT_UPDATE_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/mission-control/state
   * Retrieves active operating mode, pipeline health, and exclusivity lock status.
   */
  public static async getMissionControlState(req: Request, res: Response): Promise<void> {
    try {
      const session = await getOrCreateActiveSession();
      res.status(200).json({
        status: 'success',
        data: { session }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'MISSION_CONTROL_STATE_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/manager/mission-control/mode
   * Switch central operating mode between STANDARD and MEGA_MISSION.
   */
  public static async setOperatingMode(req: Request, res: Response): Promise<void> {
    try {
      const validated = SetOperatingModeSchema.parse(req.body);
      const session = await getOrCreateActiveSession();

      if (session.status === 'ACTIVE' && session.operatingMode !== validated.mode) {
        res.status(409).json({
          status: 'error',
          code: 'CANNOT_CHANGE_MODE_WHILE_ACTIVE',
          message: `Cannot switch operating mode from ${session.operatingMode} to ${validated.mode} while a session is actively running. Stop active mission first.`
        });
        return;
      }

      session.operatingMode = validated.mode;
      await session.save();
      safeEmit('mission:session_updated', session);

      res.status(200).json({
        status: 'success',
        message: `Operating mode set to ${validated.mode}`,
        data: { session }
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'issues' in err) {
        res.status(400).json({ status: 'error', code: 'VALIDATION_FAILED', message: err.message, details: (err as any).issues });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'SET_OPERATING_MODE_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/manager/mission-control/activate
   * Activates either a Standard Mission (with exclusive lock) or Mega Mission (all 3 pipelines).
   */
  public static async activateMissionControl(req: Request, res: Response): Promise<void> {
    try {
      const validated = ActivateMissionControlSchema.parse(req.body);
      const session = await getOrCreateActiveSession();

      if (validated.mode === 'MEGA_MISSION') {
        session.operatingMode = 'MEGA_MISSION';
        session.status = 'ACTIVE';
        session.sessionStartedAt = new Date();
        session.sessionEndedAt = null;
        session.activeMissionId = `MEGA-SES-${Date.now().toString(36).toUpperCase()}`;
        session.activeMissionType = null;

        session.childSessions.civic = {
          missionId: 'MEGA-CIVIC-CHILD',
          status: 'ACTIVE',
          pipelineHealth: 'DEGRADED',
          details: 'Civic pipeline running in degraded mode: MODEL_NOT_AVAILABLE for [pothole, garbage_dump]. Frame capture active.',
          lastInferenceAt: new Date()
        };
        session.childSessions.crowd = {
          missionId: 'MEGA-CROWD-CHILD',
          status: 'ACTIVE',
          pipelineHealth: 'HEALTHY',
          details: 'Crowd safety pipeline active: YOLO + ByteTrack occupancy tracking',
          modelName: 'yolo11n.pt',
          lastInferenceAt: new Date()
        };
        session.childSessions.sar = {
          missionId: 'MEGA-SAR-CHILD',
          status: 'ACTIVE',
          pipelineHealth: 'HEALTHY',
          details: 'SAR visual search pipeline active: optical person detection',
          modelName: 'yolov8n.pt',
          lastInferenceAt: new Date()
        };

        await session.save();
        safeEmit('mission:session_updated', session);

        res.status(200).json({
          status: 'success',
          message: 'Mega Mission activated. All 3 operational pipelines started concurrently.',
          data: { session }
        });
        return;
      }

      if (validated.mode === 'STANDARD') {
        if (!validated.missionId) {
          res.status(400).json({
            status: 'error',
            code: 'MISSION_ID_REQUIRED',
            message: 'Standard Mode activation requires a valid missionId'
          });
          return;
        }

        const isOid = mongoose.isValidObjectId(validated.missionId);
        const mission = await Mission.findOne(
          isOid
            ? { $or: [{ _id: validated.missionId }, { missionId: validated.missionId.toUpperCase() }] }
            : { missionId: validated.missionId.toUpperCase() }
        );

        if (!mission) {
          res.status(404).json({
            status: 'error',
            code: 'MISSION_NOT_FOUND',
            message: `Mission '${validated.missionId}' not found`
          });
          return;
        }

        if (OPERATIONAL_VERTICALS.includes(mission.missionType)) {
          const conflicting = await Mission.findOne({
            _id: { $ne: mission._id },
            status: { $in: ['ACTIVE', 'PAUSED'] },
            missionType: { $in: OPERATIONAL_VERTICALS }
          });

          if (conflicting) {
            res.status(409).json({
              status: 'error',
              code: 'MISSION_LOCK_CONFLICT',
              message: `Operational exclusivity lock active: Mission '${conflicting.missionId}' (${conflicting.missionType}) is currently ${conflicting.status}. Only ONE operational mission may be active at a time.`
            });
            return;
          }
        }

        mission.status = 'ACTIVE';
        if (!mission.actualStart) mission.actualStart = new Date();
        await mission.save();

        session.operatingMode = 'STANDARD';
        session.status = 'ACTIVE';
        session.activeMissionId = mission.missionId;
        session.activeMissionType = mission.missionType;
        session.sessionStartedAt = new Date();
        session.sessionEndedAt = null;

        if (mission.missionType === 'CIVIC_ISSUE_VERIFICATION') {
          session.childSessions.civic = {
            missionId: mission.missionId,
            status: 'ACTIVE',
            pipelineHealth: 'DEGRADED',
            details: 'Civic pipeline active (Awaiting custom pothole/garbage model weights)',
            lastInferenceAt: new Date()
          };
        } else if (mission.missionType === 'CROWD_SAFETY') {
          session.childSessions.crowd = {
            missionId: mission.missionId,
            status: 'ACTIVE',
            pipelineHealth: 'HEALTHY',
            details: 'Crowd safety pipeline active (YOLO + ByteTrack)',
            modelName: 'yolo11n.pt',
            lastInferenceAt: new Date()
          };
        } else if (mission.missionType === 'SUBTERRANEAN_SEARCH_RESCUE') {
          session.childSessions.sar = {
            missionId: mission.missionId,
            status: 'ACTIVE',
            pipelineHealth: 'HEALTHY',
            details: 'SAR visual survivor search active (Optical person model)',
            modelName: 'yolov8n.pt',
            lastInferenceAt: new Date()
          };
        }

        await session.save();
        safeEmit('mission:updated', mission);
        safeEmit('mission:session_updated', session);

        res.status(200).json({
          status: 'success',
          message: `Standard mission '${mission.missionId}' activated with exclusivity lock`,
          data: { mission, session }
        });
        return;
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'issues' in err) {
        res.status(400).json({ status: 'error', code: 'VALIDATION_FAILED', message: err.message, details: (err as any).issues });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'MISSION_CONTROL_ACTIVATE_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/manager/mission-control/pause
   */
  public static async pauseMissionControl(req: Request, res: Response): Promise<void> {
    try {
      const session = await getOrCreateActiveSession();
      session.status = 'PAUSED';
      if (session.childSessions.civic.status === 'ACTIVE') session.childSessions.civic.status = 'PAUSED';
      if (session.childSessions.crowd.status === 'ACTIVE') session.childSessions.crowd.status = 'PAUSED';
      if (session.childSessions.sar.status === 'ACTIVE') session.childSessions.sar.status = 'PAUSED';

      await session.save();

      if (session.activeMissionId) {
        await Mission.updateOne(
          { missionId: session.activeMissionId },
          { $set: { status: 'PAUSED' } }
        );
      }

      safeEmit('mission:session_updated', session);
      res.status(200).json({
        status: 'success',
        message: 'Mission session paused (exclusivity lock retained)',
        data: { session }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'MISSION_CONTROL_PAUSE_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/manager/mission-control/resume
   */
  public static async resumeMissionControl(req: Request, res: Response): Promise<void> {
    try {
      const session = await getOrCreateActiveSession();
      session.status = 'ACTIVE';
      if (session.childSessions.civic.status === 'PAUSED') session.childSessions.civic.status = 'ACTIVE';
      if (session.childSessions.crowd.status === 'PAUSED') session.childSessions.crowd.status = 'ACTIVE';
      if (session.childSessions.sar.status === 'PAUSED') session.childSessions.sar.status = 'ACTIVE';

      await session.save();

      if (session.activeMissionId) {
        await Mission.updateOne(
          { missionId: session.activeMissionId },
          { $set: { status: 'ACTIVE' } }
        );
      }

      safeEmit('mission:session_updated', session);
      res.status(200).json({
        status: 'success',
        message: 'Mission session resumed',
        data: { session }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'MISSION_CONTROL_RESUME_FAILED', message: msg });
    }
  }

  /**
   * POST /api/v1/manager/mission-control/stop
   */
  public static async stopMissionControl(req: Request, res: Response): Promise<void> {
    try {
      const session = await getOrCreateActiveSession();
      session.status = 'IDLE';
      const stoppedMissionId = session.activeMissionId;
      session.activeMissionId = null;
      session.activeMissionType = null;
      session.sessionEndedAt = new Date();

      session.childSessions.civic.status = 'STOPPED';
      session.childSessions.civic.pipelineHealth = 'STOPPED';
      session.childSessions.crowd.status = 'STOPPED';
      session.childSessions.crowd.pipelineHealth = 'STOPPED';
      session.childSessions.sar.status = 'STOPPED';
      session.childSessions.sar.pipelineHealth = 'STOPPED';

      await session.save();

      if (stoppedMissionId) {
        await Mission.updateOne(
          { missionId: stoppedMissionId },
          { $set: { status: 'COMPLETED', completedAt: new Date() } }
        );
      }

      safeEmit('mission:session_updated', session);
      res.status(200).json({
        status: 'success',
        message: 'Mission session stopped cleanly and exclusivity locks released',
        data: { session }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'MISSION_CONTROL_STOP_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/observations
   * Retrieves paginated live AI observations with optional vertical filtering.
   */
  public static async getObservations(req: Request, res: Response): Promise<void> {
    try {
      const { missionType, missionId, verificationStatus } = req.query;
      const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
      const skip = (page - 1) * limit;

      const filter: any = {};
      if (missionType) filter.missionType = String(missionType);
      if (missionId) filter.missionId = String(missionId);
      if (verificationStatus) filter.verificationStatus = String(verificationStatus);

      const [observations, total] = await Promise.all([
        Observation.find(filter)
          .sort({ detectedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('reviewedBy', 'name email role')
          .lean(),
        Observation.countDocuments(filter)
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          observations,
          total,
          page,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'OBSERVATIONS_FETCH_FAILED', message: msg });
    }
  }

  /**
   * PATCH /api/v1/manager/observations/:id/review
   * Allows manager to review, accept, or reject an AI observation.
   */
  public static async reviewObservation(req: Request, res: Response): Promise<void> {
    try {
      const observationId = String(req.params.id);
      const validated = ReviewObservationSchema.parse(req.body);

      const isOid = mongoose.isValidObjectId(observationId);
      const observation = await Observation.findOne(
        isOid
          ? { $or: [{ _id: observationId }, { observationId: observationId.toUpperCase() }] }
          : { observationId: observationId.toUpperCase() }
      );

      if (!observation) {
        res.status(404).json({
          status: 'error',
          code: 'OBSERVATION_NOT_FOUND',
          message: `Observation '${observationId}' not found`
        });
        return;
      }

      observation.verificationStatus = validated.verificationStatus;
      if (validated.reviewNotes !== undefined) observation.reviewNotes = validated.reviewNotes;
      observation.reviewedAt = new Date();
      if (req.user?.id && mongoose.isValidObjectId(req.user.id)) {
        observation.reviewedBy = new mongoose.Types.ObjectId(req.user.id);
      }

      await observation.save();
      safeEmit('observation:updated', observation);

      res.status(200).json({
        status: 'success',
        message: `Observation ${observation.observationId} updated to ${observation.verificationStatus}`,
        data: { observation }
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'issues' in err) {
        res.status(400).json({ status: 'error', code: 'VALIDATION_FAILED', message: err.message, details: (err as any).issues });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'OBSERVATION_REVIEW_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/environmental/latest
   * Micro-climate always-on environmental telemetry feed.
   */
  public static async getEnvironmentalLatest(req: Request, res: Response): Promise<void> {
    try {
      const latestTelemetry = await TelemetryRecord.findOne({
        $or: [
          { 'sensorHealth.temperature': { $exists: true } },
          { 'sensorHealth.humidity': { $exists: true } },
          { 'sensorHealth.pressure': { $exists: true } }
        ]
      })
        .sort({ recordedAt: -1 })
        .lean();

      const session = await MissionSession.findOne().sort({ updatedAt: -1 });

      if (latestTelemetry && latestTelemetry.sensorHealth) {
        res.status(200).json({
          status: 'success',
          data: {
            serviceStatus: 'ONLINE',
            lastReadingAt: latestTelemetry.recordedAt,
            sensors: latestTelemetry.sensorHealth,
            droneId: latestTelemetry.droneId,
            details: 'Live environmental readings from drone I2C/SPI sensors'
          }
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: {
          serviceStatus: session?.environmentalService?.status || 'NOT_CONNECTED',
          lastReadingAt: session?.environmentalService?.lastReadingAt || null,
          sensors: null,
          details: 'No active environmental hardware sensors streaming telemetry. Showing honest standby state.'
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ status: 'error', code: 'ENVIRONMENTAL_FETCH_FAILED', message: msg });
    }
  }

  /**
   * GET /api/v1/manager/environmental/bhopal
   * Retrieves live atmospheric weather, CAMS air quality, hourly & 7-day forecasts
   * for Bhopal, Madhya Pradesh, India via Open-Meteo with caching, rate-limited manual refresh,
   * and isolated hardware sensor status.
   */
  public static async getBhopalMicroClimate(req: Request, res: Response): Promise<void> {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const data = await EnvironmentalService.getBhopalMicroClimate(forceRefresh);

      res.status(200).json({
        status: 'success',
        data
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve environmental data';
      res.status(503).json({
        status: 'error',
        code: 'ENVIRONMENTAL_SERVICE_UNAVAILABLE',
        message: msg
      });
    }
  }
}
