import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Mission } from '../../src/models/Mission.js';
import { MissionSession } from '../../src/models/MissionSession.js';
import { Observation } from '../../src/models/Observation.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { env } from '../../src/config/env.js';

describe('AERON Central Mission Controller & AI Observation Suite', () => {
  const app = createApp();

  const dummyManagerId = new mongoose.Types.ObjectId().toString();
  const dummyAdminId = new mongoose.Types.ObjectId().toString();
  const managerToken = signAccessToken(dummyManagerId, 'manager');
  const adminToken = signAccessToken(dummyAdminId, 'admin');

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(User, 'findById').mockImplementation(async (id: any) => {
      const idStr = id?.toString();
      if (idStr === dummyManagerId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyManagerId),
          email: 'manager@aeron.internal',
          name: 'Operations Manager',
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
      return null;
    });
  });

  describe('GET /api/v1/manager/mission-control/state', () => {
    it('returns initial session state with STANDARD mode and independent environmental monitoring', async () => {
      const mockSession = {
        sessionId: 'SES-TEST-01',
        operatingMode: 'STANDARD',
        status: 'IDLE',
        activeMissionId: null,
        childSessions: {
          civic: { status: 'IDLE', pipelineHealth: 'STOPPED' },
          crowd: { status: 'IDLE', pipelineHealth: 'STOPPED' },
          sar: { status: 'IDLE', pipelineHealth: 'STOPPED' }
        },
        environmentalService: { status: 'ONLINE', details: 'Continuous monitoring active' }
      };

      vi.spyOn(MissionSession, 'findOne').mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockSession)
      } as any);

      const res = await request(app)
        .get('/api/v1/manager/mission-control/state')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.session.operatingMode).toBe('STANDARD');
      expect(res.body.data.session.environmentalService.status).toBe('ONLINE');
    });
  });

  describe('Exclusivity Lock Enforcement in Standard Mode', () => {
    it('blocks activation of Crowd Safety when Civic Issue Verification is already active', async () => {
      const existingCivicMission = {
        _id: new mongoose.Types.ObjectId(),
        missionId: 'MSN-CIV-1001',
        missionType: 'CIVIC_ISSUE_VERIFICATION',
        title: 'Active Pothole Recon',
        status: 'ACTIVE'
      };

      const crowdMissionToActivate = {
        _id: new mongoose.Types.ObjectId(),
        missionId: 'MSN-CRW-2002',
        missionType: 'CROWD_SAFETY',
        title: 'Stadium Ingress Monitoring',
        status: 'PLANNED',
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(Mission, 'findOne').mockImplementation(async (query: any) => {
        if (query.missionId === 'MSN-CRW-2002') {
          return crowdMissionToActivate as any;
        }
        if (query.status && query.status.$in) {
          // Exclusivity lock query finds existing civic mission
          return existingCivicMission as any;
        }
        return null;
      });

      const mockSession = {
        operatingMode: 'STANDARD',
        status: 'IDLE',
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(MissionSession, 'findOne').mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockSession)
      } as any);

      const res = await request(app)
        .post('/api/v1/manager/mission-control/activate')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          mode: 'STANDARD',
          missionId: 'MSN-CRW-2002'
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('MISSION_LOCK_CONFLICT');
      expect(res.body.message).toContain("Mission 'MSN-CIV-1001'");
    });

    it('successfully activates a Standard Mission when no conflicting mission is active', async () => {
      const plannedMission = {
        _id: new mongoose.Types.ObjectId(),
        missionId: 'MSN-CRW-2002',
        missionType: 'CROWD_SAFETY',
        title: 'Stadium Ingress Monitoring',
        status: 'PLANNED',
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(Mission, 'findOne').mockImplementation(async (query: any) => {
        if (query.missionId === 'MSN-CRW-2002') {
          return plannedMission as any;
        }
        return null; // No conflicting active mission
      });

      const mockSession = {
        operatingMode: 'STANDARD',
        status: 'IDLE',
        activeMissionId: null,
        childSessions: {
          civic: { status: 'IDLE', pipelineHealth: 'STOPPED' },
          crowd: { status: 'IDLE', pipelineHealth: 'STOPPED' },
          sar: { status: 'IDLE', pipelineHealth: 'STOPPED' }
        },
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(MissionSession, 'findOne').mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockSession)
      } as any);

      const res = await request(app)
        .post('/api/v1/manager/mission-control/activate')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          mode: 'STANDARD',
          missionId: 'MSN-CRW-2002'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(mockSession.status).toBe('ACTIVE');
      expect(mockSession.activeMissionId).toBe('MSN-CRW-2002');
      expect(mockSession.childSessions.crowd.status).toBe('ACTIVE');
    });
  });

  describe('MEGA MISSION Mode Activation', () => {
    it('activates all 3 child pipelines concurrently under parent session with honest model availability', async () => {
      const mockSession = {
        operatingMode: 'STANDARD',
        status: 'IDLE',
        activeMissionId: null,
        childSessions: {
          civic: { status: 'IDLE', pipelineHealth: 'STOPPED' },
          crowd: { status: 'IDLE', pipelineHealth: 'STOPPED' },
          sar: { status: 'IDLE', pipelineHealth: 'STOPPED' }
        },
        save: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(MissionSession, 'findOne').mockReturnValue({
        sort: vi.fn().mockResolvedValue(mockSession)
      } as any);

      const res = await request(app)
        .post('/api/v1/manager/mission-control/activate')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          mode: 'MEGA_MISSION'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(mockSession.operatingMode).toBe('MEGA_MISSION');
      expect(mockSession.status).toBe('ACTIVE');
      // Crowd and SAR are HEALTHY with YOLO models, Civic reports DEGRADED/MODEL_NOT_AVAILABLE
      expect(mockSession.childSessions.crowd.status).toBe('ACTIVE');
      expect(mockSession.childSessions.crowd.pipelineHealth).toBe('HEALTHY');
      expect(mockSession.childSessions.sar.status).toBe('ACTIVE');
      expect(mockSession.childSessions.sar.pipelineHealth).toBe('HEALTHY');
      expect(mockSession.childSessions.civic.status).toBe('ACTIVE');
      expect(mockSession.childSessions.civic.pipelineHealth).toBe('DEGRADED');
    });
  });

  describe('M2M AI Observation Ingestion & Manager Review', () => {
    it('accepts authenticated observation from Python Bridge and stores in MongoDB', async () => {
      const mockObs = {
        _id: new mongoose.Types.ObjectId(),
        observationId: 'OBS-CROWD-TEST01',
        missionId: 'MSN-CRW-2002',
        missionType: 'CROWD_SAFETY',
        droneId: 'AERON-HEX-01',
        category: 'crowd_congestion',
        confidence: 0.92,
        detectedAt: new Date(),
        evidenceImageUrl: 'https://storage.aeron.gov/evidence/crowd_01.jpg',
        dronePosition: { latitude: 28.6139, longitude: 77.209, altitude: 25.4, heading: 180 },
        locationAccuracyStatus: 'APPROXIMATE',
        modelInfo: { name: 'yolo11n.pt', version: '11.0' },
        verificationStatus: 'PENDING'
      };

      vi.spyOn(Observation, 'create').mockResolvedValue(mockObs as any);

      const res = await request(app)
        .post('/api/v1/telemetry/observations')
        .set('x-drone-bridge-token', env.DRONE_BRIDGE_TOKEN)
        .send({
          missionId: 'MSN-CRW-2002',
          missionType: 'CROWD_SAFETY',
          droneId: 'AERON-HEX-01',
          category: 'crowd_congestion',
          confidence: 0.92,
          detectedAt: new Date().toISOString(),
          evidenceImageUrl: 'https://storage.aeron.gov/evidence/crowd_01.jpg',
          dronePosition: { latitude: 28.6139, longitude: 77.209, altitude: 25.4, heading: 180 },
          locationAccuracyStatus: 'APPROXIMATE',
          modelInfo: { name: 'yolo11n.pt', version: '11.0' }
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.observation.category).toBe('crowd_congestion');
    });

    it('rejects unauthenticated observation submission without valid bridge token', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/observations')
        .send({
          missionId: 'MSN-CRW-2002',
          missionType: 'CROWD_SAFETY'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('DRONE_BRIDGE_TOKEN_REQUIRED');
    });

    it('allows Manager to review and accept an AI observation', async () => {
      const mockObs = {
        _id: new mongoose.Types.ObjectId(),
        observationId: 'OBS-CROWD-TEST01',
        verificationStatus: 'PENDING',
        reviewNotes: '',
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(Observation, 'findOne').mockResolvedValue(mockObs as any);

      const res = await request(app)
        .patch('/api/v1/manager/observations/OBS-CROWD-TEST01/review')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          verificationStatus: 'ACCEPTED',
          reviewNotes: 'Verified genuine queue congestion at gate 3'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(mockObs.verificationStatus).toBe('ACCEPTED');
      expect(mockObs.reviewNotes).toBe('Verified genuine queue congestion at gate 3');
    });
  });
});
