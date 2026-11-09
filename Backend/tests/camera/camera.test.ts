import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { Drone } from '../../src/models/Drone.js';
import { HardwareDevice } from '../../src/models/HardwareDevice.js';
import { User } from '../../src/models/User.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('AERON Camera — Ingestion, Relay & Admin Read API Suite', () => {
  const app = createApp();
  const validBridgeToken = env.DRONE_BRIDGE_TOKEN;

  const dummyAdminId = new mongoose.Types.ObjectId().toString();
  const dummyCitizenId = new mongoose.Types.ObjectId().toString();

  const adminToken = signAccessToken(dummyAdminId, 'admin');
  const citizenToken = signAccessToken(dummyCitizenId, 'citizen');

  // Minimal valid 1x1 JPEG in Base64 (starts with 0xFF, 0xD8 and ends with 0xFF, 0xD9)
  const sampleValidJpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  beforeEach(() => {
    vi.restoreAllMocks();

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
          name: 'Citizen User',
          role: 'citizen',
          accountStatus: 'active'
        } as any;
      }
      return null;
    });
  });

  // =========================================================================
  // 1. M2M FRAME INGESTION & AUTHENTICATION
  // =========================================================================
  describe('POST /api/v1/camera/frames (Machine Ingestion)', () => {
    it('rejects frame upload without machine authentication token (401)', async () => {
      const res = await request(app)
        .post('/api/v1/camera/frames')
        .send({
          cameraId: 'CAM-OV2640-01',
          droneId: 'AERON-PX4-BENCH01',
          capturedAt: new Date().toISOString(),
          source: 'REAL',
          contentType: 'image/jpeg',
          frameWidth: 640,
          frameHeight: 480,
          frameSizeBytes: 12000,
          frameData: sampleValidJpegBase64
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('DRONE_BRIDGE_TOKEN_REQUIRED');
    });

    it('rejects invalid non-JPEG base64 data (400)', async () => {
      const res = await request(app)
        .post('/api/v1/camera/frames')
        .set('x-drone-bridge-token', validBridgeToken)
        .send({
          cameraId: 'CAM-OV2640-01',
          droneId: 'AERON-PX4-BENCH01',
          capturedAt: new Date().toISOString(),
          source: 'REAL',
          contentType: 'image/jpeg',
          frameWidth: 640,
          frameHeight: 480,
          frameSizeBytes: 12,
          frameData: Buffer.from('NOT_A_JPEG_FILE').toString('base64')
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FRAME_VALIDATION_FAILED');
    });

    it('successfully accepts valid JPEG frame with M2M token (201)', async () => {
      vi.spyOn(Drone, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        droneId: 'AERON-PX4-BENCH01'
      } as any);
      vi.spyOn(HardwareDevice, 'findOneAndUpdate').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/camera/frames')
        .set('x-drone-bridge-token', validBridgeToken)
        .send({
          cameraId: 'CAM-OV2640-01',
          droneId: 'AERON-PX4-BENCH01',
          capturedAt: new Date().toISOString(),
          source: 'REAL',
          contentType: 'image/jpeg',
          frameWidth: 640,
          frameHeight: 480,
          frameSizeBytes: 120,
          frameData: sampleValidJpegBase64,
          telemetryLat: 12.9716,
          telemetryLon: 77.5946,
          telemetryAlt: 42.4,
          telemetryHeading: 90.0,
          telemetryAgeSeconds: 0.15
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.cameraId).toBe('CAM-OV2640-01');
      expect(res.body.data.resolution).toBe('640x480');
    });
  });

  // =========================================================================
  // 2. CAMERA STATUS UPDATE
  // =========================================================================
  describe('POST /api/v1/camera/status (Machine Status)', () => {
    it('successfully updates camera connection and stream status (200)', async () => {
      vi.spyOn(Drone, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any);
      vi.spyOn(HardwareDevice, 'findOneAndUpdate').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/camera/status')
        .set('x-drone-bridge-token', validBridgeToken)
        .send({
          cameraId: 'CAM-OV2640-01',
          droneId: 'AERON-PX4-BENCH01',
          connectionStatus: 'CONNECTED',
          streamStatus: 'STREAMING',
          source: 'REAL',
          resolution: '640x480',
          frameRate: 2.0
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.streamStatus).toBe('STREAMING');
    });
  });

  // =========================================================================
  // 3. ADMIN READ ENDPOINTS & ROLE GUARDS
  // =========================================================================
  describe('Admin Camera Read Endpoints', () => {
    it('rejects unauthenticated request to /admin/drones/:droneId/camera/status (401)', async () => {
      const res = await request(app).get('/api/v1/admin/drones/AERON-PX4-BENCH01/camera/status');
      expect(res.status).toBe(401);
    });

    it('rejects citizen role from reading camera status (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/drones/AERON-PX4-BENCH01/camera/status')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(403);
    });

    it('allows admin role to read camera status (200)', async () => {
      vi.spyOn(Drone, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any);
      vi.spyOn(HardwareDevice, 'findOne').mockReturnValue({
        lean: () => Promise.resolve({
          deviceId: 'CAM-OV2640-01',
          connectionStatus: 'CONNECTED',
          installationStatus: 'INSTALLED'
        })
      } as any);

      const res = await request(app)
        .get('/api/v1/admin/drones/AERON-PX4-BENCH01/camera/status')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.droneId).toBe('AERON-PX4-BENCH01');
    });

    it('allows admin to retrieve latest preview frame (200)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/drones/AERON-PX4-BENCH01/camera/preview/latest')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.frameData).toBe(sampleValidJpegBase64);
      expect(res.body.data.telemetryLat).toBe(12.9716);
    });
  });
});

