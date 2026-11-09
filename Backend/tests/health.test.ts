import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('AERON Backend — Health & Infrastructure Endpoints', () => {
  const app = createApp();

  it('GET /health should return 200 with service health metadata', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('service', 'aeron-backend');
    expect(res.body).toHaveProperty('version', '1.0.0');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('environment');
  });

  it('GET /health/ready should return dependency readiness report', async () => {
    const res = await request(app).get('/health/ready');

    // Without an active MongoDB Atlas/local instance, status will be degraded (503) or ready (200)
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('service', 'aeron-backend');
    expect(res.body).toHaveProperty('dependencies');
    expect(res.body.dependencies).toHaveProperty('database');
    expect(res.body.dependencies).toHaveProperty('socketServer');
    expect(res.body.dependencies.socketServer.status).toBe('active');
  });

  it('GET /health/integrated should return full platform subsystem indicators', async () => {
    const res = await request(app).get('/health/integrated');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'operational');
    expect(res.body).toHaveProperty('subsystems');
    expect(res.body.subsystems).toHaveProperty('api');
    expect(res.body.subsystems).toHaveProperty('database');
    expect(res.body.subsystems).toHaveProperty('socketServer');
    expect(res.body.subsystems).toHaveProperty('telemetryPipeline');
    expect(res.body.subsystems).toHaveProperty('cameraRelay');
    expect(res.body.subsystems).toHaveProperty('mediaStorage');
  });

  it('GET /api/v1 should return API root metadata', async () => {
    const res = await request(app).get('/api/v1');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'AERON Flight & Mission Intelligence API');
    expect(res.body).toHaveProperty('version', '1.0.0');
    expect(res.body).toHaveProperty('status', 'online');
  });

  it('GET /api/v1/health should route to health controller', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /non-existent-route should return 404 with structured error', async () => {
    const res = await request(app).get('/non-existent-route');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('status', 'error');
    expect(res.body).toHaveProperty('code', 'RESOURCE_NOT_FOUND');
  });
});

