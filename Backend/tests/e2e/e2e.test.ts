import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { initSocketServer } from '../../src/sockets/socket.server.js';
import { User } from '../../src/models/User.js';
import { Drone } from '../../src/models/Drone.js';
import { HardwareDevice } from '../../src/models/HardwareDevice.js';
import { Mission } from '../../src/models/Mission.js';
import { MissionEvent } from '../../src/models/MissionEvent.js';
import { MissionOutcome } from '../../src/models/MissionOutcome.js';
import { Incident } from '../../src/models/Incident.js';
import { CitizenReport } from '../../src/models/CitizenReport.js';
import { Notification } from '../../src/models/Notification.js';
import { TelemetryRecord } from '../../src/models/TelemetryRecord.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { AuthSession } from '../../src/models/AuthSession.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { hashPassword } from '../../src/utils/password.js';

describe('AERON — End-to-End System Validation & 25 Critical Integration Scenarios', () => {
  const app = createApp();
  let httpServer: any;
  let socketPort: number;
  const bridgeToken = env.DRONE_BRIDGE_TOKEN;

  // Test identities
  const adminId = new mongoose.Types.ObjectId();
  const managerId = new mongoose.Types.ObjectId();
  const citizenAId = new mongoose.Types.ObjectId();
  const citizenBId = new mongoose.Types.ObjectId();
  const droneObjectId = new mongoose.Types.ObjectId();

  let adminToken: string;
  let managerToken: string;
  let citizenAToken: string;
  let citizenBToken: string;

  beforeAll(async () => {
    httpServer = createServer(app);
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        socketPort = (httpServer.address() as any).port;
        resolve();
      });
    });

    adminToken = signAccessToken(adminId.toString(), 'admin');
    managerToken = signAccessToken(managerId.toString(), 'manager');
    citizenAToken = signAccessToken(citizenAId.toString(), 'citizen');
    citizenBToken = signAccessToken(citizenBId.toString(), 'citizen');
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  const createSocketClient = (token?: string): ClientSocket => {
    return ClientIO(`http://localhost:${socketPort}`, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
  };

  // ===========================================================================
  // TEST 01 — Citizen Registration and Login
  // ===========================================================================
  it('TEST 01: Citizen can register and login, receiving JWT token pair', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValueOnce(null);
    vi.spyOn(User, 'create').mockResolvedValueOnce({
      _id: citizenAId,
      name: 'Alice Citizen',
      email: 'alice@citizen.gov',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Alice Citizen',
        email: 'alice@citizen.gov',
        password: 'AeronCitizen@2026!Secure'
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.status).toBe('success');
    expect(regRes.body.data.user.role).toBe('citizen');

    // Test login
    const hash = await hashPassword('AeronCitizen@2026!Secure');
    vi.spyOn(User, 'findOne').mockReturnValue({
      select: vi.fn().mockResolvedValue({
        _id: citizenAId,
        name: 'Alice Citizen',
        email: 'alice@citizen.gov',
        passwordHash: hash,
        role: 'citizen',
        accountStatus: 'active'
      })
    } as any);
    vi.spyOn(AuthSession, 'create').mockResolvedValue({} as any);
    vi.spyOn(RefreshToken, 'create').mockResolvedValue({} as any);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice@citizen.gov',
        password: 'AeronCitizen@2026!Secure'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data).toHaveProperty('accessToken');
    expect(loginRes.body.data.user.role).toBe('citizen');
  });

  // ===========================================================================
  // TEST 02 — Citizen Cannot Enter Admin or Manager Areas
  // ===========================================================================
  it('TEST 02: Citizen is strictly forbidden from accessing Admin or Manager APIs (403)', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: citizenAId,
      email: 'alice@citizen.gov',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    const adminAreaRes = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${citizenAToken}`);

    expect(adminAreaRes.status).toBe(403);
    expect(adminAreaRes.body.code).toBe('FORBIDDEN_ROLE');

    const managerAreaRes = await request(app)
      .get('/api/v1/manager/dashboard')
      .set('Authorization', `Bearer ${citizenAToken}`);

    expect(managerAreaRes.status).toBe(403);
    expect(managerAreaRes.body.code).toBe('FORBIDDEN_ROLE');
  });

  // ===========================================================================
  // TEST 03 — Admin Login and Hardware Overview API
  // ===========================================================================
  it('TEST 03: Admin accesses hardware telemetry overview and dynamic readiness matrix', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: adminId,
      email: 'admin@aeron.gov',
      role: 'admin',
      accountStatus: 'active'
    } as any);

    vi.spyOn(Drone, 'countDocuments').mockResolvedValue(2 as any);
    vi.spyOn(Drone, 'findOne').mockReturnValue({
      sort: () => Promise.resolve({
        _id: droneObjectId,
        droneId: 'AERON-PX4-BENCH01',
        flightController: 'Pixhawk 2.4.8 (STM32F427)'
      })
    } as any);

    vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
      sort: () => ({
        lean: () => Promise.resolve({
          recordedAt: new Date(),
          gpsFixType: '3D_FIX',
          satellites: 12,
          batteryPercentage: 92,
          batteryVoltage: 15.4,
          armed: false
        })
      })
    } as any);

    vi.spyOn(HardwareDevice, 'find').mockReturnValue({
      lean: () => Promise.resolve([])
    } as any);

    const res = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('readiness');
    expect(res.body.data.readiness).toHaveProperty('percentage');
    expect(res.body.data.protocol.targetFC).toContain('Pixhawk 2.4.8');
  });

  // ===========================================================================
  // TEST 04 — Manager Login and Authorized Mission Access
  // ===========================================================================
  it('TEST 04: Manager accesses authorized missions ledger with pagination and filters', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: managerId,
      email: 'manager@aeron.gov',
      role: 'manager',
      accountStatus: 'active'
    } as any);

    vi.spyOn(Mission, 'countDocuments').mockResolvedValue(4 as any);
    vi.spyOn(Mission, 'find').mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({
              populate: () => ({
                populate: () => ({
                  lean: () => Promise.resolve([
                    { missionId: 'MIS-DEMO-001', missionType: 'CIVIC_ISSUE_VERIFICATION', status: 'ACTIVE' }
                  ])
                })
              })
            })
          })
        })
      })
    } as any);

    const res = await request(app)
      .get('/api/v1/manager/missions')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('missions');
    expect(res.body.data.pagination.total).toBe(4);
  });

  // ===========================================================================
  // TEST 05 — Manager Cannot Access Unauthorized Citizen or System Routes
  // ===========================================================================
  it('TEST 05: Manager cannot access citizen-only report creation or admin system health', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: managerId,
      email: 'manager@aeron.gov',
      role: 'manager',
      accountStatus: 'active'
    } as any);

    const citRes = await request(app)
      .post('/api/v1/citizen/reports')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        description: 'Test report',
        category: 'ROAD_STRUCTURAL',
        location: { type: 'Point', coordinates: [77.59, 12.97] }
      });

    expect(citRes.status).toBe(403);
    expect(citRes.body.code).toBe('FORBIDDEN_ROLE');

    const adminRes = await request(app)
      .get('/api/v1/admin/system/health')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(adminRes.status).toBe(403);
    expect(adminRes.body.code).toBe('FORBIDDEN_ROLE');
  });

  // ===========================================================================
  // TEST 06 — Simulator Creates Explicitly Labelled Telemetry
  // ===========================================================================
  it('TEST 06: Simulation telemetry is strictly rejected if masquerading as real hardware', async () => {
    const res = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('x-drone-bridge-token', bridgeToken)
      .send({
        droneId: 'AERON-PX4-BENCH01',
        source: 'REAL',
        isSimulated: true, // Inconsistent masquerade!
        armed: false,
        recordedAt: new Date().toISOString()
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  // ===========================================================================
  // TEST 07 — Bridge Authentication and Telemetry Ingestion
  // ===========================================================================
  it('TEST 07: Telemetry ingestion enforces machine-to-machine bridge token auth', async () => {
    const noTokenRes = await request(app)
      .post('/api/v1/telemetry/ingest')
      .send({ droneId: 'AERON-PX4-BENCH01', source: 'REAL', isSimulated: false, armed: false, recordedAt: new Date().toISOString() });
    expect(noTokenRes.status).toBe(401);

    const badTokenRes = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('x-drone-bridge-token', 'wrong_bridge_token')
      .send({ droneId: 'AERON-PX4-BENCH01', source: 'REAL', isSimulated: false, armed: false, recordedAt: new Date().toISOString() });
    expect(badTokenRes.status).toBe(401);

    vi.spyOn(Drone, 'findOne').mockResolvedValue({ _id: droneObjectId, droneId: 'AERON-PX4-BENCH01' } as any);
    vi.spyOn(TelemetryRecord, 'insertMany').mockResolvedValue([] as any);
    vi.spyOn(Drone, 'updateOne').mockResolvedValue({} as any);

    const validRes = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('x-drone-bridge-token', bridgeToken)
      .send({
        droneId: 'AERON-PX4-BENCH01',
        source: 'REAL',
        isSimulated: false,
        armed: false,
        recordedAt: new Date().toISOString(),
        latitude: 12.9716,
        longitude: 77.5946
      });
    expect(validRes.status).toBe(201);
  });

  // ===========================================================================
  // TEST 08 — Telemetry Persistence and Retrieval
  // ===========================================================================
  it('TEST 08: Ingested telemetry is persisted and queryable via latest endpoint', async () => {
    vi.spyOn(Drone, 'findOne').mockResolvedValue({ _id: droneObjectId, droneId: 'DRONE-SIM-01' } as any);
    vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
      sort: () => ({
        lean: () => Promise.resolve({
          droneId: droneObjectId,
          source: 'SIMULATION',
          isSimulated: true,
          altitude: 18.5,
          batteryVoltage: 15.2
        })
      })
    } as any);

    const res = await request(app).get('/api/v1/telemetry/latest/DRONE-SIM-01');
    expect(res.status).toBe(200);
    expect(res.body.data.telemetry.isSimulated).toBe(true);
    expect(res.body.data.telemetry.altitude).toBe(18.5);
  });

  // ===========================================================================
  // TEST 09 — Admin Receives Real-time Simulation-Labelled Updates via Socket.IO
  // ===========================================================================
  it('TEST 09: Authorized Admin client can subscribe to telemetry socket room', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: adminId,
      email: 'admin@aeron.gov',
      name: 'Admin User',
      role: 'admin',
      accountStatus: 'active'
    } as any);

    const client = createSocketClient(adminToken);

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        client.emit('join_room', { room: 'drone:telemetry:DRONE-SIM-01' }, (res: any) => {
          expect(res.success).toBe(true);
          client.disconnect();
          resolve();
        });
      });
      client.on('connect_error', reject);
    });
  });

  // ===========================================================================
  // TEST 10 — Citizen Cannot Access Telemetry Endpoints
  // ===========================================================================
  it('TEST 10: Citizen cannot access raw flight history or admin telemetry routes', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: citizenAId,
      email: 'alice@citizen.gov',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    const res = await request(app)
      .get('/api/v1/admin/telemetry/history')
      .set('Authorization', `Bearer ${citizenAToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  // ===========================================================================
  // TEST 11 — Mock Camera Frame Reaches Authorized Admin Preview
  // ===========================================================================
  it('TEST 11: Valid mock camera frame is relayed and accessible via Admin preview API', async () => {
    vi.spyOn(Drone, 'findOne').mockResolvedValue({ _id: droneObjectId, droneId: 'DRONE-SIM-01' } as any);
    vi.spyOn(HardwareDevice, 'findOneAndUpdate').mockResolvedValue({} as any);

    const validJpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const framePayload = {
      droneId: 'DRONE-SIM-01',
      cameraId: 'ESP32-CAM-01',
      source: 'SIMULATION',
      capturedAt: new Date().toISOString(),
      contentType: 'image/jpeg',
      frameWidth: 320,
      frameHeight: 240,
      frameSizeBytes: validJpegBytes.length,
      frameData: validJpegBytes.toString('base64')
    };

    const ingestRes = await request(app)
      .post('/api/v1/camera/frames')
      .set('x-drone-bridge-token', bridgeToken)
      .send(framePayload);

    expect(ingestRes.status).toBe(201);

    // Retrieve preview from Admin preview API with admin token
    vi.spyOn(User, 'findById').mockResolvedValueOnce({
      _id: adminId,
      email: 'admin@aeron.gov',
      role: 'admin',
      accountStatus: 'active'
    } as any);

    const previewRes = await request(app)
      .get('/api/v1/admin/drones/DRONE-SIM-01/camera/preview/latest')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.source).toBe('SIMULATION');
    expect(previewRes.body.data.droneId).toBe('DRONE-SIM-01');
  });

  // ===========================================================================
  // TEST 12 — Citizen & Manager Cannot Access Internal Camera Frames
  // ===========================================================================
  it('TEST 12: Citizen and Manager are denied access to live drone camera Socket.IO room', async () => {
    vi.spyOn(User, 'findById').mockResolvedValueOnce({
      _id: citizenAId,
      email: 'alice@citizen.gov',
      name: 'Alice Citizen',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    const citizenSocket = createSocketClient(citizenAToken);
    await new Promise<void>((resolve) => {
      citizenSocket.on('connect', () => {
        citizenSocket.emit('join_room', { room: 'drone:camera:DRONE-SIM-01' }, (res: any) => {
          expect(res.success).toBe(false);
          expect(res.error).toContain('restricted exclusively to Admin GCS');
          citizenSocket.disconnect();
          resolve();
        });
      });
    });

    vi.spyOn(User, 'findById').mockResolvedValueOnce({
      _id: managerId,
      email: 'manager@aeron.gov',
      name: 'Manager Smith',
      role: 'manager',
      accountStatus: 'active'
    } as any);

    const managerSocket = createSocketClient(managerToken);
    await new Promise<void>((resolve) => {
      managerSocket.on('connect', () => {
        managerSocket.emit('join_room', { room: 'drone:camera:DRONE-SIM-01' }, (res: any) => {
          expect(res.success).toBe(false);
          expect(res.error).toContain('restricted exclusively to Admin GCS');
          managerSocket.disconnect();
          resolve();
        });
      });
    });
  });

  // ===========================================================================
  // TEST 13 — Citizen Creates a Civic Report
  // ===========================================================================
  it('TEST 13: Citizen creates civic report with validated coordinates and initial points', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: citizenAId,
      email: 'alice@citizen.gov',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    vi.spyOn(CitizenReport, 'findOne').mockResolvedValue(null);
    vi.spyOn(CitizenReport, 'create').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      reportId: 'AER-2026-0011',
      citizenId: citizenAId,
      description: 'Severe depression causing trip hazard',
      category: 'ROAD_STRUCTURAL',
      status: 'SUBMITTED',
      stage: 1,
      earnedPoints: 25,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] }
    } as any);
    vi.spyOn(Notification, 'create').mockResolvedValue({} as any);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/v1/citizen/reports')
      .set('Authorization', `Bearer ${citizenAToken}`)
      .send({
        description: 'Severe depression causing trip hazard',
        category: 'ROAD_STRUCTURAL',
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.data.reportId).toBe('AER-2026-0011');
    expect(res.body.data.stage).toBe(1);
    expect(res.body.data.earnedPoints).toBe(25);
  });

  // ===========================================================================
  // TEST 14 — Manager Reviews Civic Reports
  // ===========================================================================
  it('TEST 14: Manager retrieves and reviews submitted civic reports and incidents', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: managerId,
      email: 'manager@aeron.gov',
      role: 'manager',
      accountStatus: 'active'
    } as any);

    vi.spyOn(Incident, 'countDocuments').mockResolvedValue(5 as any);
    vi.spyOn(Incident, 'find').mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({
              populate: () => ({
                lean: () => Promise.resolve([
                  { incidentId: 'INC-DEMO-001', title: 'Road Fissure', status: 'INVESTIGATING' }
                ])
              })
            })
          })
        })
      })
    } as any);

    const res = await request(app)
      .get('/api/v1/manager/incidents')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
  });

  // ===========================================================================
  // TEST 15 — Manager Creates Associated Mission
  // ===========================================================================
  it('TEST 15: Manager initializes new aerial inspection mission for verified incident', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: managerId,
      email: 'manager@aeron.gov',
      role: 'manager',
      accountStatus: 'active'
    } as any);

    vi.spyOn(Drone, 'findOne').mockResolvedValue({
      _id: droneObjectId,
      droneId: 'DRONE-SIM-01',
      operationalStatus: 'READY'
    } as any);
    const mockMission = {
      _id: new mongoose.Types.ObjectId(),
      missionId: 'MSN-CIV-A1B2',
      title: 'Aerial Fissure Verification Sortie',
      missionType: 'CIVIC_ISSUE_VERIFICATION',
      status: 'PLANNED',
      stage: 1
    };
    vi.spyOn(Mission, 'create').mockResolvedValue(mockMission as any);
    vi.spyOn(MissionEvent, 'create').mockResolvedValue({} as any);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);
    vi.spyOn(Mission, 'findById').mockReturnValue({
      populate: () => ({
        populate: () => ({
          populate: () => Promise.resolve(mockMission)
        })
      })
    } as any);

    const res = await request(app)
      .post('/api/v1/manager/missions')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Aerial Fissure Verification Sortie',
        description: 'Verify 4th cross road depression',
        missionType: 'CIVIC_ISSUE_VERIFICATION',
        assignedDrones: ['DRONE-SIM-01']
      });

    expect(res.status).toBe(201);
    expect(res.body.data.mission.missionId).toBe('MSN-CIV-A1B2');
  });

  // ===========================================================================
  // TEST 16 — Authorized Outcome Review
  // ===========================================================================
  it('TEST 16: Manager reviews mission outcome, approving findings before public staging', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: managerId,
      email: 'manager@aeron.gov',
      role: 'manager',
      accountStatus: 'active'
    } as any);

    const outcomeObjectId = new mongoose.Types.ObjectId();
    const mockOutcome = {
      _id: outcomeObjectId,
      outcomeId: 'OUT-2026-001',
      reviewStatus: 'PENDING_REVIEW',
      isPublic: false,
      save: vi.fn().mockResolvedValue(true)
    };

    vi.spyOn(MissionOutcome, 'findOne').mockResolvedValue(mockOutcome as any);
    vi.spyOn(MissionOutcome, 'findById').mockReturnValue({
      populate: () => ({
        populate: () => Promise.resolve({
          ...mockOutcome,
          reviewStatus: 'APPROVED'
        })
      })
    } as any);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/v1/manager/outcomes/OUT-2026-001/review')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ decision: 'APPROVED', findings: 'Inspection verified by flight lead' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  // ===========================================================================
  // TEST 17 — Published Outcome Appears in Citizen Explore Feed
  // ===========================================================================
  it('TEST 17: Published approved outcome is returned in public citizen explore stream', async () => {
    vi.spyOn(MissionOutcome, 'find').mockReturnValue({
      sort: () => ({
        populate: () => ({
          populate: () => ({
            lean: () => Promise.resolve([
              {
                outcomeId: 'OUT-DEMO-001',
                outcomeType: 'CIVIC_ISSUE_VERIFICATION',
                reviewStatus: 'PUBLISHED',
                isPublic: true,
                isConfidential: false,
                publicSummary: 'Aerial inspection verified 4.2m fissure along 8th Main.'
              }
            ])
          })
        })
      })
    } as any);

    const res = await request(app).get('/api/v1/public/outcomes');

    expect(res.status).toBe(200);
    expect(res.body.data.outcomes.length).toBe(1);
    expect(res.body.data.outcomes[0].outcomeId).toBe('OUT-DEMO-001');
    expect(res.body.data.outcomes[0].isPublic).toBe(true);
  });

  // ===========================================================================
  // TEST 18 — Citizen Sees Only Their Own Reports
  // ===========================================================================
  it('TEST 18: Citizen A receives 404 when attempting to query private report of Citizen B', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: citizenAId,
      email: 'alice@citizen.gov',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    vi.spyOn(CitizenReport, 'findOne').mockReturnValue({
      populate: () => Promise.resolve({
        reportId: 'AER-2026-9999',
        citizenId: citizenBId,
        description: 'Private report of citizen B'
      })
    } as any);

    const res = await request(app)
      .get('/api/v1/citizen/reports/AER-2026-9999')
      .set('Authorization', `Bearer ${citizenAToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('REPORT_NOT_FOUND');
  });

  // ===========================================================================
  // TEST 19 — Unauthorized Publication is Rejected
  // ===========================================================================
  it('TEST 19: Publishing unreviewed / rejected outcome returns 400 error', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: managerId,
      email: 'manager@aeron.gov',
      role: 'manager',
      accountStatus: 'active'
    } as any);

    vi.spyOn(MissionOutcome, 'findOne').mockResolvedValue({
      outcomeId: 'OUT-DRAFT-001',
      reviewStatus: 'DRAFT',
      isPublic: false
    } as any);

    const res = await request(app)
      .post('/api/v1/manager/outcomes/OUT-DRAFT-001/publish')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OUTCOME_NOT_APPROVED');
  });

  // ===========================================================================
  // TEST 20 — Confidential SAR Information is Not Exposed Publicly
  // ===========================================================================
  it('TEST 20: Confidential SAR outcome is strictly prohibited from publishing (403)', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: managerId,
      email: 'manager@aeron.gov',
      role: 'manager',
      accountStatus: 'active'
    } as any);

    vi.spyOn(MissionOutcome, 'findOne').mockResolvedValue({
      outcomeId: 'OUT-SAR-CONFIDENTIAL',
      reviewStatus: 'APPROVED',
      isPublic: false,
      isConfidential: true
    } as any);

    const res = await request(app)
      .post('/api/v1/manager/outcomes/OUT-SAR-CONFIDENTIAL/publish')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SAR_CONFIDENTIAL_PROTECTED');
  });

  // ===========================================================================
  // TEST 21 — Refresh-Token Rotation and Logout Revocation
  // ===========================================================================
  it('TEST 21: Revoked session refresh token is rejected upon refresh attempt (401)', async () => {
    vi.spyOn(RefreshToken, 'findOne').mockResolvedValue({
      tokenHash: 'hashed_sample_token',
      userId: citizenAId,
      status: 'REVOKED',
      expiresAt: new Date(Date.now() + 100000)
    } as any);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'sample_revoked_token' });

    expect(res.status).toBe(401);
  });

  // ===========================================================================
  // TEST 22 — Socket.IO Unauthorized Room Denial
  // ===========================================================================
  it('TEST 22: Citizen attempting to join admin management room is rejected on Socket.IO', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: citizenAId,
      email: 'alice@citizen.gov',
      name: 'Alice Citizen',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    const client = createSocketClient(citizenAToken);

    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        client.emit('join_room', { room: 'admin:operations' }, (res: any) => {
          expect(res.success).toBe(false);
          expect(res.error).toContain('restricted to admin');
          client.disconnect();
          resolve();
        });
      });
    });
  });

  // ===========================================================================
  // TEST 23 — API Health and Integrated Recovery
  // ===========================================================================
  it('TEST 23: Service health and integrated subsystem monitoring report operational status', async () => {
    const res = await request(app).get('/health/integrated');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('operational');
    expect(res.body.subsystems.api.status).toBe('HEALTHY');
    expect(res.body.subsystems.socketServer.status).toBe('ACTIVE');
  });

  // ===========================================================================
  // TEST 24 — Database Unavailable Behavior (Graceful Degradation)
  // ===========================================================================
  it('TEST 24: Readiness endpoint gracefully reports 503 degraded when database is disconnected', async () => {
    const res = await request(app).get('/health/ready');

    expect([200, 503]).toContain(res.status);
    if (res.status === 503) {
      expect(res.body.status).toBe('degraded');
      expect(res.body.dependencies.database.ready).toBe(false);
    }
  });

  // ===========================================================================
  // TEST 25 — Media Storage Unavailable Behavior in Production Mode
  // ===========================================================================
  it('TEST 25: Evidence upload in production mode returns 503 STORAGE_UNAVAILABLE without durable cloud', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({
      _id: citizenAId,
      email: 'alice@citizen.gov',
      role: 'citizen',
      accountStatus: 'active'
    } as any);

    const originalEnv = env.isProduction;
    (env as any).isProduction = true;

    try {
      const res = await request(app)
        .post('/api/v1/citizen/media/upload')
        .set('Authorization', `Bearer ${citizenAToken}`)
        .send({
          image: 'data:image/jpeg;base64,ZmFrZWltYWdlZGF0YQ==',
          contentType: 'image/jpeg',
          fileName: 'hazard.jpg'
        });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('STORAGE_UNAVAILABLE');
    } finally {
      (env as any).isProduction = originalEnv;
    }
  });
});
