import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer } from 'http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import mongoose from 'mongoose';
import { initSocketServer, getSocketServer } from '../../src/sockets/socket.server.js';
import { User } from '../../src/models/User.js';
import { Delivery } from '../../src/models/Delivery.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import { broadcastDeliveryTelemetry } from '../../src/services/delivery-telemetry.service.js';

describe('AERON Healthcare Drone Delivery — Scoped Socket.IO Telemetry Streaming Suite', () => {
  let httpServer: any;
  let serverPort: number;

  const dummyCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyOtherCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyDroneObjectId = new mongoose.Types.ObjectId();
  const dummyOtherDroneObjectId = new mongoose.Types.ObjectId();

  const citizenToken = signAccessToken(dummyCitizenId, 'citizen');
  const otherCitizenToken = signAccessToken(dummyOtherCitizenId, 'citizen');

  beforeAll(async () => {
    httpServer = createServer();
    initSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = (httpServer.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(User, 'findById').mockImplementation(async (id: any) => {
      const idStr = id?.toString();
      if (idStr === dummyCitizenId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyCitizenId),
          email: 'citizen1@aeron.internal',
          name: 'Citizen Recipient 1',
          role: 'citizen',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === dummyOtherCitizenId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyOtherCitizenId),
          email: 'citizen2@aeron.internal',
          name: 'Citizen Recipient 2',
          role: 'citizen',
          accountStatus: 'active'
        } as any;
      }
      return null;
    });
  });

  const createClient = (token?: string): ClientSocket => {
    return ClientIO(`http://localhost:${serverPort}`, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });
  };

  // ==========================================
  // 1. AUTHENTICATION & ROOM ACCESS CONTROL
  // ==========================================
  describe('Room Authorization & RBAC', () => {
    it('rejects unauthenticated socket connections with AUTHENTICATION_REQUIRED', async () => {
      const client = createClient();

      const errMsg = await new Promise<string>((resolve) => {
        client.on('connect_error', (err) => resolve(err.message));
      });

      expect(errMsg).toBe('AUTHENTICATION_REQUIRED');
      client.disconnect();
    });

    it('citizens remain STRICTLY BLOCKED from raw drone telemetry rooms', async () => {
      const client = createClient(citizenToken);
      await new Promise<void>((resolve) => client.on('connect', () => resolve()));

      const joinResult = await new Promise<any>((resolve) => {
        client.emit(
          'join_room',
          { room: 'drone:telemetry:AERON-HEX-01' },
          (res: any) => resolve(res)
        );
      });

      expect(joinResult.success).toBe(false);
      expect(joinResult.error).toContain('Citizens are strictly prohibited');
      client.disconnect();
    });

    it('authenticated citizen joins their own active delivery room', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-OWNED-01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        status: 'IN_TRANSIT',
        assignedDrone: dummyDroneObjectId,
        assignedDroneId: 'AERON-PX4-BENCH01'
      };

      vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery as any);

      const client = createClient(citizenToken);
      await new Promise<void>((resolve) => client.on('connect', () => resolve()));

      const joinResult = await new Promise<any>((resolve) => {
        client.emit(
          'join_room',
          { room: 'citizen:delivery:DEL-OWNED-01' },
          (res: any) => resolve(res)
        );
      });

      expect(joinResult.success).toBe(true);
      expect(joinResult.error).toBeUndefined();
      client.disconnect();
    });

    it('citizen can also subscribe via dedicated delivery:subscribe event', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-SUB-01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        status: 'DISPATCHED',
        assignedDrone: dummyDroneObjectId,
        assignedDroneId: 'AERON-PX4-BENCH01'
      };

      vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery as any);

      const client = createClient(citizenToken);
      await new Promise<void>((resolve) => client.on('connect', () => resolve()));

      const subResult = await new Promise<any>((resolve) => {
        client.emit('delivery:subscribe', { deliveryId: 'DEL-SUB-01' }, (res: any) => resolve(res));
      });

      expect(subResult.success).toBe(true);
      expect(subResult.room).toBe('citizen:delivery:DEL-SUB-01');
      client.disconnect();
    });

    it('STRICTLY BLOCKS citizen from joining another citizen delivery room', async () => {
      const mockOtherDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-OTHER-01',
        recipientId: new mongoose.Types.ObjectId(dummyOtherCitizenId), // Owned by citizen 2
        status: 'IN_TRANSIT',
        assignedDrone: dummyDroneObjectId
      };

      vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockOtherDelivery as any);

      const client = createClient(citizenToken); // Connected as citizen 1
      await new Promise<void>((resolve) => client.on('connect', () => resolve()));

      const joinResult = await new Promise<any>((resolve) => {
        client.emit(
          'join_room',
          { room: 'citizen:delivery:DEL-OTHER-01' },
          (res: any) => resolve(res)
        );
      });

      expect(joinResult.success).toBe(false);
      expect(joinResult.error).toContain('Access denied');
      client.disconnect();
    });

    it('rejects join requests for nonexistent deliveries safely', async () => {
      vi.spyOn(Delivery, 'findOne').mockResolvedValue(null);

      const client = createClient(citizenToken);
      await new Promise<void>((resolve) => client.on('connect', () => resolve()));

      const joinResult = await new Promise<any>((resolve) => {
        client.emit(
          'join_room',
          { room: 'citizen:delivery:DEL-NONEXISTENT' },
          (res: any) => resolve(res)
        );
      });

      expect(joinResult.success).toBe(false);
      expect(joinResult.error).toContain('Healthcare delivery not found');
      client.disconnect();
    });

    it('rejects joining closed or cancelled deliveries (DELIVERED or CANCELLED)', async () => {
      const mockDelivered = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-DELIVERED-01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        status: 'DELIVERED'
      };

      vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivered as any);

      const client = createClient(citizenToken);
      await new Promise<void>((resolve) => client.on('connect', () => resolve()));

      const joinResult = await new Promise<any>((resolve) => {
        client.emit(
          'join_room',
          { room: 'citizen:delivery:DEL-DELIVERED-01' },
          (res: any) => resolve(res)
        );
      });

      expect(joinResult.success).toBe(false);
      expect(joinResult.error).toContain('already closed with status DELIVERED');

      // Test CANCELLED
      mockDelivered.status = 'CANCELLED';
      const joinResultCancelled = await new Promise<any>((resolve) => {
        client.emit(
          'join_room',
          { room: 'citizen:delivery:DEL-DELIVERED-01' },
          (res: any) => resolve(res)
        );
      });

      expect(joinResultCancelled.success).toBe(false);
      expect(joinResultCancelled.error).toContain('already closed with status CANCELLED');

      client.disconnect();
    });
  });

  // ==========================================
  // 2. REAL-TIME TELEMETRY STREAMING & ISOLATION
  // ==========================================
  describe('Delivery Telemetry Streaming & Scoped Isolation', () => {
    it('telemetry updates reach ONLY the assigned delivery room; other citizens receive NO data', async () => {
      const mockDelivery1 = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-STREAM-01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        status: 'IN_TRANSIT',
        assignedDrone: dummyDroneObjectId,
        assignedDroneId: 'AERON-PX4-BENCH01'
      };

      const mockDelivery2 = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-STREAM-02',
        recipientId: new mongoose.Types.ObjectId(dummyOtherCitizenId),
        status: 'IN_TRANSIT',
        assignedDrone: dummyOtherDroneObjectId,
        assignedDroneId: 'AERON-OTHER-01'
      };

      // Mock Delivery.find for broadcast query
      vi.spyOn(Delivery, 'find').mockReturnValue({
        select: () => ({
          lean: async () => [mockDelivery1]
        })
      } as any);

      // Connect Client 1 (owns DEL-STREAM-01)
      vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery1 as any);
      const client1 = createClient(citizenToken);
      await new Promise<void>((resolve) => client1.on('connect', () => resolve()));
      await new Promise<void>((resolve) => {
        client1.emit('delivery:subscribe', { deliveryId: 'DEL-STREAM-01' }, () => resolve());
      });

      // Connect Client 2 (owns DEL-STREAM-02)
      vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery2 as any);
      const client2 = createClient(otherCitizenToken);
      await new Promise<void>((resolve) => client2.on('connect', () => resolve()));
      await new Promise<void>((resolve) => {
        client2.emit('delivery:subscribe', { deliveryId: 'DEL-STREAM-02' }, () => resolve());
      });

      let client2Received = false;
      client2.on('delivery:telemetry', () => {
        client2Received = true;
      });

      // Broadcast telemetry for drone 1
      const io = getSocketServer();
      const telemetryItem = {
        latitude: 12.9755,
        longitude: 77.5999,
        altitude: 48.0,
        relativeAltitude: 48.0,
        groundSpeed: 11.5,
        heading: 180.0,
        recordedAt: new Date(),
        batteryVoltage: 16.5, // Sensitive internal field that must be stripped
        flightMode: 'AUTO_MISSION'
      };

      const client1Payload = await new Promise<any>((resolve) => {
        client1.on('delivery:telemetry', (payload) => {
          resolve(payload);
        });
        broadcastDeliveryTelemetry(io, dummyDroneObjectId, 'AERON-PX4-BENCH01', telemetryItem);
      });

      // Verify Client 1 received the update
      expect(client1Payload.deliveryId).toBe('DEL-STREAM-01');
      expect(client1Payload.droneId).toBe('AERON-PX4-BENCH01');
      expect(client1Payload.latitude).toBe(12.9755);
      expect(client1Payload.longitude).toBe(77.5999);
      expect(client1Payload.groundSpeed).toBe(11.5);
      expect(client1Payload.freshness).toBe('AVAILABLE');
      expect(client1Payload.isLivePosition).toBe(true);

      // Verify Client 2 received NOTHING
      await new Promise<void>((r) => setTimeout(r, 100));
      expect(client2Received).toBe(false);

      client1.disconnect();
      client2.disconnect();
    });

    it('delivery:telemetry payload contains ONLY approved fields (no raw GCS internals)', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-SANITIZE-01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        status: 'IN_TRANSIT',
        assignedDrone: dummyDroneObjectId,
        assignedDroneId: 'AERON-PX4-BENCH01'
      };

      vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery as any);
      vi.spyOn(Delivery, 'find').mockReturnValue({
        select: () => ({
          lean: async () => [mockDelivery]
        })
      } as any);

      const client = createClient(citizenToken);
      await new Promise<void>((resolve) => client.on('connect', () => resolve()));
      await new Promise<void>((resolve) => {
        client.emit('delivery:subscribe', { deliveryId: 'DEL-SANITIZE-01' }, () => resolve());
      });

      const io = getSocketServer();
      const telemetryWithInternalDiagnostics = {
        latitude: 12.98,
        longitude: 77.60,
        altitude: 55.0,
        groundSpeed: 13.0,
        heading: 45.0,
        recordedAt: new Date(),
        batteryVoltage: 16.4,
        batteryCurrent: 8.2,
        batteryPercentage: 90,
        roll: 0.02,
        pitch: -0.01,
        yaw: 0.78,
        flightMode: 'AUTO_TAKEOFF',
        armed: true,
        sensorHealth: { imu: true }
      };

      const payload = await new Promise<any>((resolve) => {
        client.on('delivery:telemetry', (data) => resolve(data));
        broadcastDeliveryTelemetry(io, dummyDroneObjectId, 'AERON-PX4-BENCH01', telemetryWithInternalDiagnostics);
      });

      const allowedKeys = new Set([
        'deliveryId',
        'deliveryStatus',
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

      for (const key of Object.keys(payload)) {
        expect(allowedKeys.has(key)).toBe(true);
      }

      expect(payload.batteryVoltage).toBeUndefined();
      expect(payload.roll).toBeUndefined();
      expect(payload.pitch).toBeUndefined();
      expect(payload.flightMode).toBeUndefined();
      expect(payload.sensorHealth).toBeUndefined();

      client.disconnect();
    });

    it('stale telemetry is marked as STALE and isLivePosition is false', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-STALE-01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        status: 'IN_TRANSIT',
        assignedDrone: dummyDroneObjectId,
        assignedDroneId: 'AERON-PX4-BENCH01'
      };

      vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery as any);
      vi.spyOn(Delivery, 'find').mockReturnValue({
        select: () => ({
          lean: async () => [mockDelivery]
        })
      } as any);

      const client = createClient(citizenToken);
      await new Promise<void>((resolve) => client.on('connect', () => resolve()));
      await new Promise<void>((resolve) => {
        client.emit('delivery:subscribe', { deliveryId: 'DEL-STALE-01' }, () => resolve());
      });

      const io = getSocketServer();
      const staleTelemetry = {
        latitude: 12.98,
        longitude: 77.60,
        recordedAt: new Date(Date.now() - 120000) // 2 minutes ago
      };

      const payload = await new Promise<any>((resolve) => {
        client.on('delivery:telemetry', (data) => resolve(data));
        broadcastDeliveryTelemetry(io, dummyDroneObjectId, 'AERON-PX4-BENCH01', staleTelemetry);
      });

      expect(payload.freshness).toBe('STALE');
      expect(payload.isLivePosition).toBe(false);

      client.disconnect();
    });

    it('assigned but undispatched delivery reports isLivePosition false and groundSpeed 0', async () => {
      const mockDelivery = {
        _id: new mongoose.Types.ObjectId(),
        deliveryId: 'DEL-UNDISPATCHED-01',
        recipientId: new mongoose.Types.ObjectId(dummyCitizenId),
        status: 'ASSIGNED', // Undispatched
        assignedDrone: dummyDroneObjectId,
        assignedDroneId: 'AERON-PX4-BENCH01'
      };

      vi.spyOn(Delivery, 'findOne').mockResolvedValue(mockDelivery as any);
      vi.spyOn(Delivery, 'find').mockReturnValue({
        select: () => ({
          lean: async () => [mockDelivery]
        })
      } as any);

      const client = createClient(citizenToken);
      await new Promise<void>((resolve) => client.on('connect', () => resolve()));
      await new Promise<void>((resolve) => {
        client.emit('delivery:subscribe', { deliveryId: 'DEL-UNDISPATCHED-01' }, () => resolve());
      });

      const io = getSocketServer();
      const groundTelemetry = {
        latitude: 12.9716,
        longitude: 77.5946,
        groundSpeed: 5.0, // Might be sensor jitter on launchpad
        recordedAt: new Date()
      };

      const payload = await new Promise<any>((resolve) => {
        client.on('delivery:telemetry', (data) => resolve(data));
        broadcastDeliveryTelemetry(io, dummyDroneObjectId, 'AERON-PX4-BENCH01', groundTelemetry);
      });

      expect(payload.deliveryStatus).toBe('ASSIGNED');
      expect(payload.isLivePosition).toBe(false);
      expect(payload.groundSpeed).toBe(0);

      client.disconnect();
    });
  });
});
