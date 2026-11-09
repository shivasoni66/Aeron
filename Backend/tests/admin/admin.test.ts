import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { Drone } from '../../src/models/Drone.js';
import { TelemetryRecord } from '../../src/models/TelemetryRecord.js';
import { HardwareDevice } from '../../src/models/HardwareDevice.js';
import { FlightSession } from '../../src/models/FlightSession.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('AERON Admin API — Read Endpoints & RBAC Security Suite', () => {
  const app = createApp();

  const dummyAdminId = new mongoose.Types.ObjectId().toString();
  const dummyCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyManagerId = new mongoose.Types.ObjectId().toString();

  const adminToken = signAccessToken(dummyAdminId, 'admin');
  const citizenToken = signAccessToken(dummyCitizenId, 'citizen');
  const managerToken = signAccessToken(dummyManagerId, 'manager');

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default User.findById mock based on requested userId
    vi.spyOn(User, 'findById').mockImplementation(async (id: any) => {
      const idStr = id?.toString();
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
      if (idStr === dummyManagerId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyManagerId),
          email: 'manager@aeron.internal',
          name: 'Mission Manager',
          role: 'manager',
          accountStatus: 'active'
        } as any;
      }
      return null;
    });
  });

  // =========================================================================
  // 1. RBAC GUARDS
  // =========================================================================
  describe('RBAC Access Control', () => {
    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/overview');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('rejects citizen role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
    });

    it('rejects manager role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
    });
  });

  // =========================================================================
  // 2. GET /api/v1/admin/overview
  // =========================================================================
  describe('GET /api/v1/admin/overview', () => {
    it('returns consolidated technical matrix and readiness calculations', async () => {
      vi.spyOn(Drone, 'countDocuments').mockResolvedValue(1 as any);
      vi.spyOn(Drone, 'findOne').mockReturnValue({
        sort: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(),
          droneId: 'AERON-HEX-01',
          displayName: 'AERON Hexacopter Alpha'
        })
      } as any);

      vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve({
            droneId: 'AERON-HEX-01',
            satellites: 12,
            gpsFixType: '3D_FIX',
            batteryVoltage: 15.2,
            batteryPercentage: 88,
            recordedAt: new Date()
          })
        })
      } as any);

      vi.spyOn(HardwareDevice, 'find').mockReturnValue({
        lean: () => Promise.resolve([
          {
            deviceId: 'FC-01',
            deviceType: 'FLIGHT_CONTROLLER',
            model: 'Pixhawk 2.4.8',
            connectionStatus: 'CONNECTED'
          }
        ])
      } as any);

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.readiness).toBeDefined();
      expect(res.body.data.protocol).toBeDefined();
      expect(res.body.data.protocol.mavlinkVersion).toBe('2.0');
    });
  });

  // =========================================================================
  // 3. GET /api/v1/admin/drones
  // =========================================================================
  describe('GET /api/v1/admin/drones', () => {
    it('returns list of registered drones', async () => {
      vi.spyOn(Drone, 'find').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve([
            { droneId: 'AERON-HEX-01', operationalStatus: 'READY' }
          ])
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/admin/drones')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.drones).toHaveLength(1);
      expect(res.body.data.drones[0].droneId).toBe('AERON-HEX-01');
    });
  });

  // =========================================================================
  // 4. GET /api/v1/admin/drones/:droneId/hardware
  // =========================================================================
  describe('GET /api/v1/admin/drones/:droneId/hardware', () => {
    it('returns hardware devices for the specified drone', async () => {
      const dummyId = new mongoose.Types.ObjectId();
      vi.spyOn(Drone, 'findOne').mockResolvedValue({
        _id: dummyId,
        droneId: 'AERON-HEX-01'
      } as any);

      vi.spyOn(HardwareDevice, 'find').mockReturnValue({
        lean: () => Promise.resolve([
          { deviceId: 'FC-01', model: 'Pixhawk 2.4.8' },
          { deviceId: 'GPS-01', model: 'U-Blox NEO-M8N' }
        ])
      } as any);

      const res = await request(app)
        .get('/api/v1/admin/drones/AERON-HEX-01/hardware')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.devices).toHaveLength(2);
    });
  });

  // =========================================================================
  // 5. GET /api/v1/admin/flights
  // =========================================================================
  describe('GET /api/v1/admin/flights', () => {
    it('returns flight sessions with pagination metadata', async () => {
      vi.spyOn(FlightSession, 'find').mockReturnValue({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.resolve([
                { flightSessionId: 'FLIGHT-001', durationSeconds: 600, source: 'REAL' }
              ])
            })
          })
        })
      } as any);

      vi.spyOn(FlightSession, 'countDocuments').mockResolvedValue(1 as any);

      const res = await request(app)
        .get('/api/v1/admin/flights')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.flights).toHaveLength(1);
      expect(res.body.data.pagination.total).toBe(1);
    });
  });

  // =========================================================================
  // 6. GET /api/v1/admin/events
  // =========================================================================
  describe('GET /api/v1/admin/events', () => {
    it('returns audit events', async () => {
      vi.spyOn(AuditLog, 'find').mockReturnValue({
        sort: () => ({
          limit: () => ({
            lean: () => Promise.resolve([
              { action: 'AUTH_LOGIN_SUCCESS', entityType: 'User', timestamp: new Date() }
            ])
          })
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/admin/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.events).toHaveLength(1);
    });
  });

  // =========================================================================
  // 7. GET /api/v1/admin/system/health
  // =========================================================================
  describe('GET /api/v1/admin/system/health', () => {
    it('returns health breakdown for all subsystems', async () => {
      vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve(null)
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.subsystems.apiBackend).toBeDefined();
      expect(res.body.data.subsystems.database).toBeDefined();
      expect(res.body.data.subsystems.droneBridge).toBeDefined();
    });
  });
});
