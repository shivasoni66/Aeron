import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { Delivery } from '../../src/models/Delivery.js';
import { TelemetryRecord } from '../../src/models/TelemetryRecord.js';
import { User } from '../../src/models/User.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('AERON Healthcare Drone Delivery — Citizen Tracking & Safe Telemetry Suite', () => {
  const app = createApp();

  const dummyCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyOtherCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyManagerId = new mongoose.Types.ObjectId().toString();
  const dummyDroneObjectId = new mongoose.Types.ObjectId();

  const citizenToken = signAccessToken(dummyCitizenId, 'citizen');
  const otherCitizenToken = signAccessToken(dummyOtherCitizenId, 'citizen');
  const managerToken = signAccessToken(dummyManagerId, 'manager');

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(User, 'findById').mockImplementation(async (id: any) => {
      const idStr = id?.toString();
      if (idStr === dummyCitizenId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyCitizenId),
          email: 'patient@aeron.internal',
          name: 'Priya Sharma',
          role: 'citizen',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === dummyOtherCitizenId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyOtherCitizenId),
          email: 'other.patient@aeron.internal',
          name: 'Rahul Verma',
          role: 'citizen',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === dummyManagerId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyManagerId),
          email: 'manager@aeron.internal',
          name: 'Flight Manager',
          role: 'manager',
          accountStatus: 'active'
        } as any;
      }
      return null;
    });
  });

  // ==========================================
  // 1. RBAC & AUTHENTICATION ENFORCEMENT
  // ==========================================
  describe('RBAC & Route Security', () => {
    it('rejects unauthenticated requests to active delivery endpoint with 401', async () => {
      const res = await request(app).get('/api/v1/citizen/deliveries/active');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated requests to delivery detail endpoint with 401', async () => {
      const res = await request(app).get('/api/v1/citizen/deliveries/DEL-TEST001');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('STRICTLY BLOCKS managers from accessing citizen tracking routes with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/citizen/deliveries/active')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });
  });

  // ==========================================
  // 2. ACTIVE DELIVERY RETRIEVAL
  // ==========================================
  describe('GET /api/v1/citizen/deliveries/active', () => {
    it('returns valid empty response when citizen has no active delivery', async () => {
      vi.spyOn(Delivery, 'findOne').mockReturnValue({
        sort: () => ({
          populate: async () => null
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/deliveries/active')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.delivery).toBeNull();
    });

    it('citizen retrieves their active in-transit delivery with fresh telemetry', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-ACTIVE01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        assignedDrone: {
          _id: dummyDroneObjectId,
          droneId: 'AERON-PX4-BENCH01',
          displayName: 'AERON Hexacopter 01',
          model: 'PX4 Medical UAV',
          operationalStatus: 'IN_FLIGHT'
        },
        assignedDroneId: 'AERON-PX4-BENCH01',
        packageType: 'EMERGENCY_INSULIN',
        priority: 'CRITICAL',
        status: 'IN_TRANSIT',
        pickupLocation: {
          name: 'City Medical Depot',
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        },
        destinationLocation: {
          name: 'Home Address',
          address: '45 MG Road, Ward 7, Sector 3',
          type: 'Point',
          coordinates: [77.6033, 12.9752]
        },
        dispatchedAt: new Date(Date.now() - 60000),
        createdAt: new Date()
      };

      const freshTelemetry = {
        _id: new mongoose.Types.ObjectId(),
        droneId: dummyDroneObjectId,
        latitude: 12.9734,
        longitude: 77.5991,
        altitude: 60.5,
        relativeAltitude: 60.5,
        groundSpeed: 14.2,
        heading: 92.0,
        recordedAt: new Date(Date.now() - 3000), // 3s ago -> AVAILABLE
        batteryVoltage: 16.2, // internal diagnostic
        batteryPercentage: 88,
        flightMode: 'AUTO_MISSION',
        roll: 0.02,
        pitch: -0.01
      };

      vi.spyOn(Delivery, 'findOne').mockReturnValue({
        sort: () => ({
          populate: async () => mockDelivery
        })
      } as any);

      const telemetrySpy = vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
        sort: () => ({
          lean: async () => freshTelemetry
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/deliveries/active')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.delivery).toBeDefined();

      const del = res.body.data.delivery;
      expect(del.deliveryId).toBe('DEL-ACTIVE01');
      expect(del.packageType).toBe('EMERGENCY_INSULIN');
      expect(del.status).toBe('IN_TRANSIT');
      expect(del.isFlying).toBe(true);

      // Verify correct Drone ObjectId was used for telemetry query
      expect(telemetrySpy).toHaveBeenCalledWith({ droneId: dummyDroneObjectId });

      // Verify telemetry payload
      expect(del.telemetry).toBeDefined();
      expect(del.telemetry.droneId).toBe('AERON-PX4-BENCH01');
      expect(del.telemetry.latitude).toBe(12.9734);
      expect(del.telemetry.longitude).toBe(77.5991);
      expect(del.telemetry.altitude).toBe(60.5);
      expect(del.telemetry.groundSpeed).toBe(14.2);
      expect(del.telemetry.heading).toBe(92.0);
      expect(del.telemetry.freshness).toBe('AVAILABLE');
      expect(del.telemetry.isLivePosition).toBe(true);
    });

    it('assigned but undispatched delivery does not imply active flight', async () => {
      const mockAssignedDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-ASSIGN01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        assignedDrone: {
          _id: dummyDroneObjectId,
          droneId: 'AERON-PX4-BENCH01',
          displayName: 'AERON Hexacopter 01',
          model: 'PX4 Medical UAV',
          operationalStatus: 'READY'
        },
        assignedDroneId: 'AERON-PX4-BENCH01',
        packageType: 'BLOOD_PLASMA',
        priority: 'URGENT',
        status: 'ASSIGNED',
        dispatchedAt: null,
        createdAt: new Date()
      };

      vi.spyOn(Delivery, 'findOne').mockReturnValue({
        sort: () => ({
          populate: async () => mockAssignedDelivery
        })
      } as any);

      vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
        sort: () => ({
          lean: async () => ({
            droneId: dummyDroneObjectId,
            latitude: 12.9716,
            longitude: 77.5946,
            groundSpeed: 0,
            recordedAt: new Date()
          })
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/deliveries/active')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.delivery.status).toBe('ASSIGNED');
      expect(res.body.data.delivery.isFlying).toBe(false);
      expect(res.body.data.delivery.dispatchedAt).toBeNull();
    });

    it('derives recipientId exclusively from authentication (ignores client-supplied recipientId)', async () => {
      const findOneSpy = vi.spyOn(Delivery, 'findOne').mockReturnValue({
        sort: () => ({
          populate: async () => null
        })
      } as any);

      await request(app)
        .get(`/api/v1/citizen/deliveries/active?recipientId=${dummyOtherCitizenId}`)
        .set('Authorization', `Bearer ${citizenToken}`);

      // The find query MUST use dummyCitizenId from the JWT, never the client query param
      const callArgs = findOneSpy.mock.calls[0][0] as any;
      expect(callArgs.recipientId.toString()).toBe(dummyCitizenId);
      expect(callArgs.recipientId.toString()).not.toBe(dummyOtherCitizenId);
    });
  });

  // ==========================================
  // 3. TELEMETRY FRESHNESS & SAFETY
  // ==========================================
  describe('Telemetry Freshness & Sanitization', () => {
    it('handles missing telemetry safely without crashing', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-NOTEL01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        assignedDrone: {
          _id: dummyDroneObjectId,
          droneId: 'AERON-PX4-BENCH01'
        },
        assignedDroneId: 'AERON-PX4-BENCH01',
        packageType: 'ANTIVENOM',
        status: 'DISPATCHED',
        createdAt: new Date()
      };

      vi.spyOn(Delivery, 'findOne').mockReturnValue({
        sort: () => ({
          populate: async () => mockDelivery
        })
      } as any);

      vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
        sort: () => ({
          lean: async () => null
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/deliveries/active')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      const tel = res.body.data.delivery.telemetry;
      expect(tel.freshness).toBe('UNAVAILABLE');
      expect(tel.latitude).toBeNull();
      expect(tel.longitude).toBeNull();
      expect(tel.altitude).toBeNull();
      expect(tel.groundSpeed).toBeNull();
      expect(tel.isLivePosition).toBe(false);
    });

    it('stale telemetry is not represented as current (freshness = STALE)', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-STALE01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        assignedDrone: {
          _id: dummyDroneObjectId,
          droneId: 'AERON-PX4-BENCH01'
        },
        assignedDroneId: 'AERON-PX4-BENCH01',
        packageType: 'ANTIVENOM',
        status: 'IN_TRANSIT',
        createdAt: new Date()
      };

      // Telemetry recorded 5 minutes ago (> 30s threshold)
      const staleTelemetry = {
        _id: new mongoose.Types.ObjectId(),
        droneId: dummyDroneObjectId,
        latitude: 12.9750,
        longitude: 77.5980,
        altitude: 50.0,
        groundSpeed: 10.0,
        heading: 90.0,
        recordedAt: new Date(Date.now() - 300000)
      };

      vi.spyOn(Delivery, 'findOne').mockReturnValue({
        sort: () => ({
          populate: async () => mockDelivery
        })
      } as any);

      vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
        sort: () => ({
          lean: async () => staleTelemetry
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/deliveries/active')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      const tel = res.body.data.delivery.telemetry;
      expect(tel.freshness).toBe('STALE');
      expect(tel.isLivePosition).toBe(false);
    });

    it('telemetry response contains ONLY approved fields (no internal diagnostics)', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-SEC001',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        assignedDrone: {
          _id: dummyDroneObjectId,
          droneId: 'AERON-PX4-BENCH01'
        },
        assignedDroneId: 'AERON-PX4-BENCH01',
        packageType: 'FIRST_AID',
        status: 'DISPATCHED',
        createdAt: new Date()
      };

      const fullInternalTelemetry = {
        _id: new mongoose.Types.ObjectId(),
        droneId: dummyDroneObjectId,
        flightSessionId: new mongoose.Types.ObjectId(),
        latitude: 12.9750,
        longitude: 77.5980,
        altitude: 40.0,
        relativeAltitude: 40.0,
        groundSpeed: 11.0,
        heading: 180.0,
        recordedAt: new Date(),
        // Raw internal fields that MUST NOT leak to citizens:
        batteryVoltage: 16.4,
        batteryCurrent: 12.8,
        batteryPercentage: 94,
        roll: 0.05,
        pitch: -0.02,
        yaw: 3.14,
        climbRate: 0.1,
        gpsFixType: '3D_FIX',
        satellites: 18,
        hdop: 0.8,
        flightMode: 'AUTO_RTL',
        armed: true,
        sensorHealth: { imu: true, mag: true, baro: true },
        source: 'MAVLINK_BRIDGE',
        isSimulated: false,
        transport: { packetCount: 450, rssi: -45 }
      };

      vi.spyOn(Delivery, 'findOne').mockReturnValue({
        sort: () => ({
          populate: async () => mockDelivery
        })
      } as any);

      vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
        sort: () => ({
          lean: async () => fullInternalTelemetry
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/deliveries/active')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      const tel = res.body.data.delivery.telemetry;

      // Allowlist verification
      const allowedKeys = new Set([
        'droneId',
        'latitude',
        'longitude',
        'altitude',
        'groundSpeed',
        'heading',
        'recordedAt',
        'freshness',
        'isLivePosition'
      ]);

      const returnedKeys = Object.keys(tel);
      for (const key of returnedKeys) {
        expect(allowedKeys.has(key)).toBe(true);
      }

      // Explicit verification that sensitive telemetry is stripped
      expect((tel as any).batteryVoltage).toBeUndefined();
      expect((tel as any).batteryPercentage).toBeUndefined();
      expect((tel as any).roll).toBeUndefined();
      expect((tel as any).pitch).toBeUndefined();
      expect((tel as any).yaw).toBeUndefined();
      expect((tel as any).flightMode).toBeUndefined();
      expect((tel as any).sensorHealth).toBeUndefined();
      expect((tel as any).source).toBeUndefined();
      expect((tel as any).transport).toBeUndefined();
      expect((tel as any).flightSessionId).toBeUndefined();
    });
  });

  // ==========================================
  // 4. DELIVERY DETAIL & IDOR PREVENTION
  // ==========================================
  describe('GET /api/v1/citizen/deliveries/:deliveryId', () => {
    it('returns delivery details when requested by owning citizen', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-DETAIL01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        packageType: 'CARDIAC_MEDS',
        status: 'ASSIGNED',
        assignedDrone: null,
        createdAt: new Date()
      };

      vi.spyOn(Delivery, 'findOne').mockReturnValue({
        populate: async () => mockDelivery
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/deliveries/DEL-DETAIL01')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.delivery.deliveryId).toBe('DEL-DETAIL01');
      expect(res.body.data.delivery.packageType).toBe('CARDIAC_MEDS');
    });

    it('PREVENTS IDOR: returns 404 when citizen attempts to access another citizen delivery', async () => {
      const mockDeliveryOtherUser = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-OTHER01',
        recipientId: new mongoose.Types.ObjectId(dummyOtherCitizenId), // Owned by Rahul Verma
        packageType: 'CONFIDENTIAL_PRESCRIPTION',
        status: 'IN_TRANSIT',
        createdAt: new Date()
      };

      vi.spyOn(Delivery, 'findOne').mockReturnValue({
        populate: async () => mockDeliveryOtherUser
      } as any);

      // Priya Sharma requests Rahul Verma's delivery
      const res = await request(app)
        .get('/api/v1/citizen/deliveries/DEL-OTHER01')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('DELIVERY_NOT_FOUND');
      expect(res.body.data).toBeUndefined();
    });

    it('returns 404 when delivery identifier does not exist', async () => {
      vi.spyOn(Delivery, 'findOne').mockReturnValue({
        populate: async () => null
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/deliveries/DEL-NONEXISTENT')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('DELIVERY_NOT_FOUND');
    });
  });
});
