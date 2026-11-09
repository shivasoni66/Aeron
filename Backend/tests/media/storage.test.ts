import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { MediaAsset } from '../../src/models/MediaAsset.js';
import { Mission } from '../../src/models/Mission.js';
import { MissionOutcome } from '../../src/models/MissionOutcome.js';
import { CitizenReport } from '../../src/models/CitizenReport.js';
import { storageService } from '../../src/services/storage.service.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('AERON Durable Media Storage & Media Access Controller Suite', () => {
  const app = createApp();

  const adminId = new mongoose.Types.ObjectId();
  const managerId = new mongoose.Types.ObjectId();
  const citizenId = new mongoose.Types.ObjectId();
  const otherCitizenId = new mongoose.Types.ObjectId();

  const adminToken = signAccessToken(adminId.toString(), 'admin');
  const managerToken = signAccessToken(managerId.toString(), 'manager');
  const citizenToken = signAccessToken(citizenId.toString(), 'citizen');
  const otherCitizenToken = signAccessToken(otherCitizenId.toString(), 'citizen');

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(User, 'findById').mockImplementation(async (id: any) => {
      const idStr = id?.toString();
      if (idStr === adminId.toString()) {
        return {
          _id: adminId,
          email: 'admin@aeron.gov',
          name: 'Admin User',
          role: 'admin',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === managerId.toString()) {
        return {
          _id: managerId,
          email: 'manager@aeron.gov',
          name: 'Manager User',
          role: 'manager',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === citizenId.toString()) {
        return {
          _id: citizenId,
          email: 'citizen@aeron.gov',
          name: 'Citizen User',
          role: 'citizen',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === otherCitizenId.toString()) {
        return {
          _id: otherCitizenId,
          email: 'other@aeron.gov',
          name: 'Other Citizen',
          role: 'citizen',
          accountStatus: 'active'
        } as any;
      }
      return null;
    });
  });

  describe('StorageService Adapter Unit Validation', () => {
    it('rejects files larger than 5MB', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      await expect(
        storageService.upload({
          buffer: largeBuffer,
          fileName: 'oversized.jpg',
          contentType: 'image/jpeg'
        })
      ).rejects.toThrow(/exceeds maximum size limit/i);
    });

    it('rejects unsupported MIME types', async () => {
      const buffer = Buffer.from('executable binary code');
      await expect(
        storageService.upload({
          buffer,
          fileName: 'malicious.exe',
          contentType: 'application/x-msdownload'
        })
      ).rejects.toThrow(/not supported/i);
    });

    it('returns valid status structure via getStatus()', () => {
      const status = storageService.getStatus();
      expect(status).toHaveProperty('provider');
      expect(status).toHaveProperty('isConfigured');
      expect(status).toHaveProperty('maxSizeBytes', 5242880);
      expect(status.allowedMimeTypes).toContain('image/jpeg');
    });
  });

  describe('GET /api/v1/media/storage/status (Operator Diagnostics)', () => {
    it('denies unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/media/storage/status');
      expect(res.status).toBe(401);
    });

    it('denies citizen role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/media/storage/status')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(403);
    });

    it('allows admin role to inspect storage configuration', async () => {
      const res = await request(app)
        .get('/api/v1/media/storage/status')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.maxSizeBytes).toBe(5242880);
    });
  });

  describe('GET /api/v1/media/:mediaId (Privacy & Access Authorization)', () => {
    it('returns 404 if media asset does not exist', async () => {
      vi.spyOn(MediaAsset, 'findOne').mockResolvedValue(null as any);

      const res = await request(app)
        .get('/api/v1/media/MED-NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('MEDIA_NOT_FOUND');
    });

    it('BLOCKS unauthorized citizen from accessing Search and Rescue (SAR) mission media', async () => {
      const sarMissionId = new mongoose.Types.ObjectId();
      const mockSarAsset = {
        mediaId: 'MED-SAR-001',
        mediaType: 'IMAGE',
        contentType: 'image/jpeg',
        fileSize: 102400,
        storageProvider: 'CLOUDINARY',
        storageKey: 'https://res.cloudinary.com/aeron/image/upload/v1/sar_001.jpg',
        uploadedBy: managerId,
        relatedEntityType: 'MISSION',
        relatedEntityId: sarMissionId,
        source: 'DRONE_PAYLOAD'
      };

      vi.spyOn(MediaAsset, 'findOne').mockResolvedValue(mockSarAsset as any);
      vi.spyOn(Mission, 'findById').mockResolvedValue({
        _id: sarMissionId,
        missionType: 'SUBTERRANEAN_SEARCH_RESCUE',
        isConfidential: true
      } as any);

      const res = await request(app)
        .get('/api/v1/media/MED-SAR-001')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_MEDIA_ACCESS');
    });

    it('ALLOWS Admin to access Search and Rescue (SAR) mission media', async () => {
      const sarMissionId = new mongoose.Types.ObjectId();
      const mockSarAsset = {
        mediaId: 'MED-SAR-001',
        mediaType: 'IMAGE',
        contentType: 'image/jpeg',
        fileSize: 102400,
        storageProvider: 'CLOUDINARY',
        storageKey: 'https://res.cloudinary.com/aeron/image/upload/v1/sar_001.jpg',
        uploadedBy: managerId,
        relatedEntityType: 'MISSION',
        relatedEntityId: sarMissionId,
        source: 'DRONE_PAYLOAD'
      };

      vi.spyOn(MediaAsset, 'findOne').mockResolvedValue(mockSarAsset as any);

      const res = await request(app)
        .get('/api/v1/media/MED-SAR-001')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.mediaId).toBe('MED-SAR-001');
    });

    it('ALLOWS Citizen to access their own uploaded evidence', async () => {
      const mockCitizenAsset = {
        mediaId: 'MED-CITIZEN-001',
        mediaType: 'IMAGE',
        contentType: 'image/jpeg',
        fileSize: 50000,
        storageProvider: 'LOCAL',
        storageKey: 'uploads/citizen/MED-CITIZEN-001.jpg',
        uploadedBy: citizenId,
        relatedEntityType: 'CITIZEN_REPORT',
        relatedEntityId: new mongoose.Types.ObjectId(),
        source: 'CITIZEN_UPLOAD'
      };

      vi.spyOn(MediaAsset, 'findOne').mockResolvedValue(mockCitizenAsset as any);

      const res = await request(app)
        .get('/api/v1/media/MED-CITIZEN-001')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.mediaId).toBe('MED-CITIZEN-001');
    });

    it('ALLOWS Public to access public mission outcome media without authentication', async () => {
      const outcomeId = new mongoose.Types.ObjectId();
      const mockPublicAsset = {
        mediaId: 'MED-PUBLIC-OUTCOME',
        mediaType: 'IMAGE',
        contentType: 'image/jpeg',
        fileSize: 80000,
        storageProvider: 'CLOUDINARY',
        storageKey: 'https://res.cloudinary.com/aeron/image/upload/v1/public_outcome.jpg',
        uploadedBy: managerId,
        relatedEntityType: 'MISSION_OUTCOME',
        relatedEntityId: outcomeId,
        source: 'OPERATOR_CAPTURE'
      };

      vi.spyOn(MediaAsset, 'findOne').mockResolvedValue(mockPublicAsset as any);
      vi.spyOn(MissionOutcome, 'findById').mockResolvedValue({
        _id: outcomeId,
        isConfidential: false,
        isPublic: true
      } as any);

      const res = await request(app).get('/api/v1/media/MED-PUBLIC-OUTCOME');
      expect(res.status).toBe(200);
      expect(res.body.data.mediaId).toBe('MED-PUBLIC-OUTCOME');
    });
  });

  describe('GET /api/v1/media/:mediaId/content (Content Delivery & Cloud Redirection)', () => {
    it('redirects with 302 to external durable cloud URL (Cloudinary / S3)', async () => {
      const cloudUrl = 'https://res.cloudinary.com/aeron-storage/image/upload/v12345/pothole.jpg';
      const mockAsset = {
        mediaId: 'MED-CLOUD-01',
        storageProvider: 'CLOUDINARY',
        storageKey: cloudUrl,
        contentType: 'image/jpeg',
        fileSize: 45000,
        uploadedBy: citizenId,
        relatedEntityType: 'CITIZEN_REPORT',
        source: 'CITIZEN_UPLOAD'
      };

      vi.spyOn(MediaAsset, 'findOne').mockResolvedValue(mockAsset as any);

      const res = await request(app)
        .get('/api/v1/media/MED-CLOUD-01/content')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(302);
      expect(res.header.location).toBe(cloudUrl);
    });
  });
});
