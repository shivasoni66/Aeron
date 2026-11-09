import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Mission } from '../../src/models/Mission.js';
import { MissionEvent } from '../../src/models/MissionEvent.js';
import { Incident } from '../../src/models/Incident.js';
import { MissionOutcome } from '../../src/models/MissionOutcome.js';
import { FlightSession } from '../../src/models/FlightSession.js';
import { TelemetryRecord } from '../../src/models/TelemetryRecord.js';
import { Drone } from '../../src/models/Drone.js';
import { CitizenReport } from '../../src/models/CitizenReport.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('AERON Manager API — Mission Operations & RBAC Integration Suite', () => {
  const app = createApp();

  const dummyManagerId = new mongoose.Types.ObjectId().toString();
  const dummyAdminId = new mongoose.Types.ObjectId().toString();
  const dummyCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyDroneId = new mongoose.Types.ObjectId().toString();

  const managerToken = signAccessToken(dummyManagerId, 'manager');
  const adminToken = signAccessToken(dummyAdminId, 'admin');
  const citizenToken = signAccessToken(dummyCitizenId, 'citizen');

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(User, 'findById').mockImplementation(async (id: any) => {
      const idStr = id?.toString();
      if (idStr === dummyManagerId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyManagerId),
          email: 'manager@aeron.internal',
          name: 'Mission Manager',
          role: 'manager',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === dummyAdminId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyAdminId),
          email: 'admin@aeron.internal',
          name: 'Admin Operator',
          role: 'admin',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === dummyCitizenId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyCitizenId),
          email: 'citizen@aeron.internal',
          name: 'Jane Citizen',
          role: 'citizen',
          accountStatus: 'active'
        } as any;
      }
      return null;
    });
  });

  describe('RBAC Access Control', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/manager/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('STRICTLY BLOCKS citizens from accessing manager dashboard with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/manager/dashboard')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('ALLOWS authorized manager to access manager dashboard', async () => {
      vi.spyOn(Mission, 'countDocuments').mockResolvedValue(10 as any);
      vi.spyOn(MissionOutcome, 'countDocuments').mockResolvedValue(3 as any);
      vi.spyOn(CitizenReport, 'countDocuments').mockResolvedValue(4 as any);
      vi.spyOn(Incident, 'countDocuments').mockResolvedValue(2 as any);
      vi.spyOn(Drone, 'countDocuments').mockResolvedValue(5 as any);
      vi.spyOn(Mission, 'findOne').mockReturnValue({
        sort: () => ({ populate: () => ({ lean: async () => null }) })
      } as any);
      vi.spyOn(MissionEvent, 'find').mockReturnValue({
        sort: () => ({ limit: () => ({ populate: () => ({ populate: () => ({ lean: async () => [] }) }) }) })
      } as any);
      vi.spyOn(MissionOutcome, 'find').mockReturnValue({
        sort: () => ({ limit: () => ({ populate: () => ({ lean: async () => [] }) }) })
      } as any);
      vi.spyOn(Incident, 'find').mockReturnValue({
        sort: () => ({ limit: () => ({ populate: () => ({ lean: async () => [] }) }) })
      } as any);

      const res = await request(app)
        .get('/api/v1/manager/dashboard')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.overview.totalMissions).toBe(10);
      expect(res.body.data.modules).toHaveLength(4);
    });

    it('ALLOWS authorized administrator to inspect manager dashboard', async () => {
      vi.spyOn(Mission, 'countDocuments').mockResolvedValue(5 as any);
      vi.spyOn(MissionOutcome, 'countDocuments').mockResolvedValue(1 as any);
      vi.spyOn(CitizenReport, 'countDocuments').mockResolvedValue(2 as any);
      vi.spyOn(Incident, 'countDocuments').mockResolvedValue(0 as any);
      vi.spyOn(Drone, 'countDocuments').mockResolvedValue(3 as any);
      vi.spyOn(Mission, 'findOne').mockReturnValue({
        sort: () => ({ populate: () => ({ lean: async () => null }) })
      } as any);
      vi.spyOn(MissionEvent, 'find').mockReturnValue({
        sort: () => ({ limit: () => ({ populate: () => ({ populate: () => ({ lean: async () => [] }) }) }) })
      } as any);
      vi.spyOn(MissionOutcome, 'find').mockReturnValue({
        sort: () => ({ limit: () => ({ populate: () => ({ lean: async () => [] }) }) })
      } as any);
      vi.spyOn(Incident, 'find').mockReturnValue({
        sort: () => ({ limit: () => ({ populate: () => ({ lean: async () => [] }) }) })
      } as any);

      const res = await request(app)
        .get('/api/v1/manager/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('Mission Creation & Drone Assignment', () => {
    it('creates a new mission when drone is eligible', async () => {
      vi.spyOn(Drone, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(dummyDroneId),
        droneId: 'AERON-PX4-BENCH01',
        operationalStatus: 'READY'
      } as any);

      const mockMission = {
        _id: new mongoose.Types.ObjectId(),
        missionId: 'MSN-CIV-A1B2',
        missionType: 'CIVIC_ISSUE_VERIFICATION',
        title: 'Municipal Pavement Quality Audit',
        description: 'Autonomous road surface defect survey',
        status: 'PLANNED',
        stage: 1,
        stageLabel: 'STAGE 1/8: MISSION PLANNING',
        assignedDrones: [new mongoose.Types.ObjectId(dummyDroneId)]
      };

      vi.spyOn(Mission, 'create').mockResolvedValue(mockMission as any);
      vi.spyOn(MissionEvent, 'create').mockResolvedValue({} as any);
      vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
      vi.spyOn(Mission, 'findById').mockReturnValue({
        populate: () => ({ populate: () => ({ populate: async () => mockMission }) })
      } as any);

      const res = await request(app)
        .post('/api/v1/manager/missions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          missionType: 'CIVIC_ISSUE_VERIFICATION',
          title: 'Municipal Pavement Quality Audit',
          description: 'Autonomous road surface defect survey',
          assignedDrones: [dummyDroneId]
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.mission.title).toBe('Municipal Pavement Quality Audit');
    });

    it('rejects mission creation if assigned drone does not exist', async () => {
      vi.spyOn(Drone, 'findById').mockResolvedValue(null);
      vi.spyOn(Drone, 'findOne').mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/manager/missions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          missionType: 'CROWD_SAFETY',
          title: 'Assembly Area Monitoring',
          description: 'High-density zone monitoring',
          assignedDrones: ['NON_EXISTENT_DRONE']
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRONE_NOT_FOUND');
    });

    it('rejects mission creation if assigned drone is in MAINTENANCE or OFFLINE', async () => {
      vi.spyOn(Drone, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(dummyDroneId),
        droneId: 'AERON-PX4-BENCH01',
        operationalStatus: 'MAINTENANCE'
      } as any);

      const res = await request(app)
        .post('/api/v1/manager/missions')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          missionType: 'MICRO_CLIMATE',
          title: 'Canopy Heat Island Survey',
          description: 'Urban heat mapping',
          assignedDrones: [dummyDroneId]
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('DRONE_NOT_ELIGIBLE');
    });
  });

  describe('Mission Lifecycle & Stage Transitions', () => {
    it('allows authorized lifecycle status transition from PLANNED to ACTIVE', async () => {
      const mockMissionInstance = {
        _id: new mongoose.Types.ObjectId(),
        missionId: 'MSN-CIV-A1B2',
        status: 'PLANNED',
        stage: 1,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(Mission, 'findOne').mockResolvedValue(mockMissionInstance as any);
      vi.spyOn(MissionEvent, 'create').mockResolvedValue({} as any);
      vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
      vi.spyOn(Mission, 'findById').mockReturnValue({
        populate: () => ({ populate: () => ({ populate: async () => ({ ...mockMissionInstance, status: 'ACTIVE' }) }) })
      } as any);

      const res = await request(app)
        .patch('/api/v1/manager/missions/MSN-CIV-A1B2')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'ACTIVE'
        });

      expect(res.status).toBe(200);
      expect(mockMissionInstance.status).toBe('ACTIVE');
    });

    it('STRICTLY REJECTS invalid lifecycle transitions (e.g. PLANNED directly to COMPLETED)', async () => {
      const mockMissionInstance = {
        _id: new mongoose.Types.ObjectId(),
        missionId: 'MSN-CIV-A1B2',
        status: 'PLANNED',
        save: vi.fn()
      };

      vi.spyOn(Mission, 'findOne').mockResolvedValue(mockMissionInstance as any);

      const res = await request(app)
        .patch('/api/v1/manager/missions/MSN-CIV-A1B2')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          status: 'COMPLETED'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('Mission Outcomes Review & Citizen Publishing Pipeline', () => {
    it('submits manager outcome review decision (APPROVED)', async () => {
      const mockOutcome = {
        _id: new mongoose.Types.ObjectId(),
        outcomeId: 'OUT-CIV-001',
        reviewStatus: 'PENDING_REVIEW',
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(MissionOutcome, 'findOne').mockResolvedValue(mockOutcome as any);
      vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
      vi.spyOn(MissionOutcome, 'findById').mockReturnValue({
        populate: () => ({ populate: async () => ({ ...mockOutcome, reviewStatus: 'APPROVED' }) })
      } as any);

      const res = await request(app)
        .post('/api/v1/manager/outcomes/OUT-CIV-001/review')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          decision: 'APPROVED',
          findings: 'Pavement fissure verified against manual review checklist.'
        });

      expect(res.status).toBe(200);
      expect(mockOutcome.reviewStatus).toBe('APPROVED');
    });

    it('STRICTLY BLOCKS publishing if outcome is not approved yet', async () => {
      const mockOutcome = {
        _id: new mongoose.Types.ObjectId(),
        outcomeId: 'OUT-CIV-002',
        reviewStatus: 'PENDING_REVIEW',
        save: vi.fn()
      };

      vi.spyOn(MissionOutcome, 'findOne').mockResolvedValue(mockOutcome as any);

      const res = await request(app)
        .post('/api/v1/manager/outcomes/OUT-CIV-002/publish')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('OUTCOME_NOT_APPROVED');
    });

    it('STRICTLY BLOCKS publishing confidential SAR rescue outcome to public citizen feed', async () => {
      const missionOid = new mongoose.Types.ObjectId();
      const mockOutcome = {
        _id: new mongoose.Types.ObjectId(),
        outcomeId: 'OUT-SAR-003',
        missionId: missionOid,
        outcomeType: 'RESCUE_OPERATION',
        reviewStatus: 'APPROVED',
        save: vi.fn()
      };

      vi.spyOn(MissionOutcome, 'findOne').mockResolvedValue(mockOutcome as any);
      // Incident contains confidential survivor info
      vi.spyOn(Incident, 'findOne').mockResolvedValue({ isConfidential: true } as any);

      const res = await request(app)
        .post('/api/v1/manager/outcomes/OUT-SAR-003/publish')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SAR_CONFIDENTIAL_PROTECTED');
    });

    it('successfully publishes approved civic outcome to citizen app feed', async () => {
      const mockOutcome = {
        _id: new mongoose.Types.ObjectId(),
        outcomeId: 'OUT-CIV-004',
        outcomeType: 'CIVIC_INFRASTRUCTURE',
        reviewStatus: 'APPROVED',
        isPublic: false,
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(MissionOutcome, 'findOne').mockResolvedValue(mockOutcome as any);
      vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
      vi.spyOn(MissionOutcome, 'findById').mockReturnValue({
        populate: () => ({ populate: async () => ({ ...mockOutcome, reviewStatus: 'PUBLISHED', isPublic: true }) })
      } as any);

      const res = await request(app)
        .post('/api/v1/manager/outcomes/OUT-CIV-004/publish')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(mockOutcome.reviewStatus).toBe('PUBLISHED');
      expect(mockOutcome.isPublic).toBe(true);
    });
  });

  describe('Flight Sessions & Incident Retrieval', () => {
    it('retrieves flight sessions distinguishing REAL vs SIMULATION', async () => {
      vi.spyOn(FlightSession, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              populate: () => ({ populate: () => ({ lean: async () => [{ flightSessionId: 'FLT-001', source: 'REAL' }] }) })
            })
          })
        })
      } as any);
      vi.spyOn(FlightSession, 'countDocuments').mockResolvedValue(1 as any);

      const res = await request(app)
        .get('/api/v1/manager/flights?source=REAL')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.flights[0].source).toBe('REAL');
    });

    it('retrieves flight session with bounded telemetry samples', async () => {
      vi.spyOn(FlightSession, 'findOne').mockReturnValue({
        populate: () => ({ populate: () => ({ lean: async () => ({ flightSessionId: 'FLT-001' }) }) })
      } as any);

      vi.spyOn(TelemetryRecord, 'find').mockReturnValue({
        sort: () => ({
          limit: () => ({
            select: () => ({ lean: async () => [{ latitude: 48.13, longitude: 11.57 }] })
          })
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/manager/flights/FLT-001')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.telemetrySamples).toHaveLength(1);
    });
  });
});

