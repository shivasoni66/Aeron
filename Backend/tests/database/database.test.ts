import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import {
  connectDatabase,
  disconnectDatabase,
  getDatabaseStatus,
  sanitizeMongoUri,
  getSafeMaskedUri,
  setDatabaseConnectedForTesting
} from '../../src/config/database.js';
import { sanitizeEnvString, auditMongoUriSafely } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';

describe('AERON Database — Initialization, Resilience & Zero-Leak Diagnostics', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
    setDatabaseConnectedForTesting(null);
  });

  afterEach(async () => {
    await disconnectDatabase();
    setDatabaseConnectedForTesting(null);
  });

  describe('URI Sanitization & Zero-Leak Auditing', () => {
    it('safely strips outer wrapping quotes and trims whitespace', () => {
      expect(sanitizeMongoUri('  "mongodb+srv://user:pass@host/db"  ')).toBe('mongodb+srv://user:pass@host/db');
      expect(sanitizeMongoUri(" 'mongodb://user:pass@host/db' ")).toBe('mongodb://user:pass@host/db');
    });

    it('safely strips Byte Order Marks (BOM) and command prefixes', () => {
      const withBom = '\uFEFFmongodb+srv://user:pass@cluster.mongodb.net/aeron';
      expect(sanitizeEnvString(withBom)).toBe('mongodb+srv://user:pass@cluster.mongodb.net/aeron');

      const withPrefix = 'export MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/aeron';
      expect(sanitizeEnvString(withPrefix)).toBe('mongodb+srv://user:pass@cluster.mongodb.net/aeron');
    });

    it('audits MongoDB URI without exposing credentials or hosts', () => {
      const audit = auditMongoUriSafely(' "mongodb+srv://admin_user:SuperSecretP@ssword@cluster0.mongodb.net/aeron" ');
      expect(audit.exists).toBe(true);
      expect(audit.scheme).toBe('mongodb+srv');
      expect(audit.hasSurroundingQuotes).toBe(true);
      expect(audit.hasLeadingTrailingWhitespace).toBe(true);
      expect(audit.acceptedByParser).toBe(true);
      expect(audit.isLocalhost).toBe(false);

      // Verify no leak of password in string representation of audit
      const serialized = JSON.stringify(audit);
      expect(serialized).not.toContain('SuperSecretP@ssword');
      expect(serialized).not.toContain('admin_user');
    });

    it('masks credentials safely in getSafeMaskedUri', () => {
      const masked = getSafeMaskedUri('mongodb+srv://admin_operator:TopSecretKey123!@cluster0.mongodb.net/aeron');
      expect(masked).toBe('mongodb+srv://***:***@cluster0.mongodb.net/aeron');
      expect(masked).not.toContain('admin_operator');
      expect(masked).not.toContain('TopSecretKey123!');
    });

    it('rejects invalid MongoDB URI schemes before passing to driver', async () => {
      const result = await connectDatabase('postgres://user:pass@localhost:5432/db');
      expect(result).toBe(false);

      const status = getDatabaseStatus();
      expect(status.status).toBe('error');
      expect(status.error).toContain('Invalid MongoDB URI scheme');
    });
  });

  describe('Concurrency & Connection Mutex', () => {
    it('multiple simultaneous connectDatabase() calls return the same single promise', async () => {
      let callCount = 0;
      vi.spyOn(mongoose, 'connect').mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return mongoose as any;
      });

      // Fire 5 concurrent connection requests simultaneously
      const [res1, res2, res3, res4, res5] = await Promise.all([
        connectDatabase('mongodb://localhost:27017/test_db'),
        connectDatabase('mongodb://localhost:27017/test_db'),
        connectDatabase('mongodb://localhost:27017/test_db'),
        connectDatabase('mongodb://localhost:27017/test_db'),
        connectDatabase('mongodb://localhost:27017/test_db')
      ]);

      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(res3).toBe(true);
      expect(res4).toBe(true);
      expect(res5).toBe(true);

      // Mutex guarantee: mongoose.connect must be called exactly once
      expect(callCount).toBe(1);
    });

    it('immediately returns true when already connected without initiating new connection', async () => {
      setDatabaseConnectedForTesting(true);
      const connectSpy = vi.spyOn(mongoose, 'connect');

      const connected = await connectDatabase('mongodb://localhost:27017/test_db');
      expect(connected).toBe(true);
      expect(connectSpy).not.toHaveBeenCalled();
    });
  });

  describe('Readiness & Resilience Endpoints', () => {
    it('GET /health/ready returns 503 Service Unavailable when database is disconnected', async () => {
      setDatabaseConnectedForTesting(false);

      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('degraded');
      expect(res.body.dependencies.database.ready).toBe(false);
    });

    it('GET /health/ready returns 200 OK when database is connected', async () => {
      setDatabaseConnectedForTesting(true);

      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.dependencies.database.ready).toBe(true);
    });

    it('GET /health liveness continues to report operational 200 even if database is degraded', async () => {
      setDatabaseConnectedForTesting(false);

      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
    });
  });
});
