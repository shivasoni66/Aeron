import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { TelemetryRecord } from '../../src/models/TelemetryRecord.js';
import { Drone } from '../../src/models/Drone.js';

describe('AERON Telemetry — Ingestion API & M2M Bridge Security Suite', () => {
  const app = createApp();
  const validBridgeToken = env.DRONE_BRIDGE_TOKEN;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. MACHINE-TO-MACHINE (M2M) AUTHENTICATION
  // =========================================================================
  describe('M2M Bridge Authentication', () => {
    it('rejects ingestion when token header is completely missing (401)', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .send({ droneId: 'AERON-PX4-BENCH01', source: 'REAL', isSimulated: false, armed: false, recordedAt: new Date().toISOString() });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('DRONE_BRIDGE_TOKEN_REQUIRED');
    });

    it('rejects ingestion with an invalid / unauthorized bridge token (401)', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-drone-bridge-token', 'tampered_or_invalid_secret_token')
        .send({ droneId: 'AERON-PX4-BENCH01', source: 'REAL', isSimulated: false, armed: false, recordedAt: new Date().toISOString() });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_DRONE_BRIDGE_TOKEN');
    });

    it('accepts ingestion with valid token via x-drone-bridge-token header', async () => {
      vi.spyOn(Drone, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId(), droneId: 'AERON-PX4-BENCH01' } as any);
      vi.spyOn(TelemetryRecord, 'insertMany').mockResolvedValue([] as any);
      vi.spyOn(Drone, 'updateOne').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-drone-bridge-token', validBridgeToken)
        .send({
          droneId: 'AERON-PX4-BENCH01',
          source: 'REAL',
          isSimulated: false,
          armed: false,
          recordedAt: new Date().toISOString(),
          latitude: 12.9716,
          longitude: 77.5946,
          batteryVoltage: 15.2
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.ingestedCount).toBe(1);
    });

    it('accepts ingestion with valid token via Authorization Bearer header', async () => {
      vi.spyOn(Drone, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId(), droneId: 'AERON-PX4-BENCH01' } as any);
      vi.spyOn(TelemetryRecord, 'insertMany').mockResolvedValue([] as any);
      vi.spyOn(Drone, 'updateOne').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('Authorization', `Bearer ${validBridgeToken}`)
        .send({
          droneId: 'AERON-PX4-BENCH01',
          source: 'REAL',
          isSimulated: false,
          armed: false,
          recordedAt: new Date().toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
    });
  });

  // =========================================================================
  // 2. PAYLOAD VALIDATION & CONSISTENCY
  // =========================================================================
  describe('Payload Schema & Boundary Validation', () => {
    it('rejects out-of-range latitude (> 90 degrees) with 400 Validation Error', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-drone-bridge-token', validBridgeToken)
        .send({
          droneId: 'AERON-PX4-BENCH01',
          source: 'REAL',
          isSimulated: false,
          armed: false,
          recordedAt: new Date().toISOString(),
          latitude: 135.5, // Invalid!
          longitude: 77.5946
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('rejects out-of-range longitude (> 180 degrees) with 400 Validation Error', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-drone-bridge-token', validBridgeToken)
        .send({
          droneId: 'AERON-PX4-BENCH01',
          source: 'REAL',
          isSimulated: false,
          armed: false,
          recordedAt: new Date().toISOString(),
          latitude: 12.9716,
          longitude: 240.0 // Invalid!
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('rejects negative ground speed with 400 Validation Error', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-drone-bridge-token', validBridgeToken)
        .send({
          droneId: 'AERON-PX4-BENCH01',
          source: 'REAL',
          isSimulated: false,
          armed: false,
          recordedAt: new Date().toISOString(),
          groundSpeed: -5.2 // Invalid!
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('strictly prevents simulation masquerading as real hardware (source=REAL, isSimulated=true)', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-drone-bridge-token', validBridgeToken)
        .send({
          droneId: 'AERON-PX4-BENCH01',
          source: 'REAL',
          isSimulated: true, // Inconsistent masquerade attempt!
          armed: false,
          recordedAt: new Date().toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('strictly prevents real data masquerading as simulation (source=SIMULATION, isSimulated=false)', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-drone-bridge-token', validBridgeToken)
        .send({
          droneId: 'AERON-PX4-BENCH01',
          source: 'SIMULATION',
          isSimulated: false, // Inconsistent masquerade attempt!
          armed: false,
          recordedAt: new Date().toISOString()
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // =========================================================================
  // 3. BATCH INGESTION & READ ENDPOINTS
  // =========================================================================
  describe('Batch Telemetry & Read APIs', () => {
    it('successfully processes a bounded batch of telemetry packets', async () => {
      vi.spyOn(Drone, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId(), droneId: 'AERON-HEX-01' } as any);
      vi.spyOn(TelemetryRecord, 'insertMany').mockResolvedValue([] as any);
      vi.spyOn(Drone, 'updateOne').mockResolvedValue({} as any);

      const batch = [
        {
          droneId: 'AERON-HEX-01',
          source: 'REAL',
          isSimulated: false,
          armed: false,
          recordedAt: new Date(Date.now() - 200).toISOString(),
          relativeAltitude: 0.1,
          batteryVoltage: 15.2
        },
        {
          droneId: 'AERON-HEX-01',
          source: 'REAL',
          isSimulated: false,
          armed: true,
          recordedAt: new Date().toISOString(),
          relativeAltitude: 2.5,
          batteryVoltage: 15.1
        }
      ];

      const res = await request(app)
        .post('/api/v1/telemetry/ingest')
        .set('x-drone-bridge-token', validBridgeToken)
        .send(batch);

      expect(res.status).toBe(201);
      expect(res.body.data.ingestedCount).toBe(2);
    });

    it('retrieves the latest telemetry for a registered airframe', async () => {
      const dummyDroneId = new mongoose.Types.ObjectId();
      vi.spyOn(Drone, 'findOne').mockResolvedValue({ _id: dummyDroneId, droneId: 'AERON-HEX-01' } as any);
      vi.spyOn(TelemetryRecord, 'findOne').mockReturnValue({
        sort: () => ({
          lean: () => Promise.resolve({
            droneId: dummyDroneId,
            altitude: 42.4,
            relativeAltitude: 12.1,
            groundSpeed: 3.5,
            batteryVoltage: 15.2
          })
        })
      } as any);

      const res = await request(app).get('/api/v1/telemetry/latest/AERON-HEX-01');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.telemetry.altitude).toBe(42.4);
    });
  });
});

