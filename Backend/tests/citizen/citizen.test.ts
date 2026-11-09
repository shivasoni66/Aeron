import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { CitizenReport } from '../../src/models/CitizenReport.js';
import { Notification } from '../../src/models/Notification.js';
import { MediaAsset } from '../../src/models/MediaAsset.js';
import { MissionOutcome } from '../../src/models/MissionOutcome.js';
import { Mission } from '../../src/models/Mission.js';
import { signAccessToken } from '../../src/utils/jwt.js';

describe('AERON Citizen Services & Public Outcomes API Suite', () => {
  const app = createApp();

  const dummyCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyOtherCitizenId = new mongoose.Types.ObjectId().toString();
  const dummyManagerId = new mongoose.Types.ObjectId().toString();
  const dummyAdminId = new mongoose.Types.ObjectId().toString();

  const citizenToken = signAccessToken(dummyCitizenId, 'citizen');
  const otherCitizenToken = signAccessToken(dummyOtherCitizenId, 'citizen');
  const managerToken = signAccessToken(dummyManagerId, 'manager');
  const adminToken = signAccessToken(dummyAdminId, 'admin');

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(User, 'findById').mockImplementation(async (id: any) => {
      const idStr = id?.toString();
      if (idStr === dummyCitizenId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyCitizenId),
          email: 'citizen@aeron.gov',
          name: 'Priya Sharma',
          role: 'citizen',
          accountStatus: 'active',
          createdAt: new Date('2026-01-01')
        } as any;
      }
      if (idStr === dummyOtherCitizenId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyOtherCitizenId),
          email: 'other@aeron.gov',
          name: 'Rahul Verma',
          role: 'citizen',
          accountStatus: 'active',
          createdAt: new Date('2026-01-01')
        } as any;
      }
      if (idStr === dummyManagerId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyManagerId),
          email: 'manager@aeron.gov',
          name: 'Flight Manager',
          role: 'manager',
          accountStatus: 'active'
        } as any;
      }
      if (idStr === dummyAdminId) {
        return {
          _id: new mongoose.Types.ObjectId(dummyAdminId),
          email: 'admin@aeron.gov',
          name: 'Admin Operator',
          role: 'admin',
          accountStatus: 'active'
        } as any;
      }
      return null;
    });
  });

  describe('RBAC Access Control on Citizen Endpoints', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/citizen/profile');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('rejects manager role from citizen endpoints with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/citizen/profile')
        .set('Authorization', `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('allows authenticated citizen to access citizen endpoints', async () => {
      vi.spyOn(CitizenReport, 'countDocuments').mockResolvedValue(0 as any);
      vi.spyOn(CitizenReport, 'aggregate').mockResolvedValue([{ totalPoints: 0 }] as any);

      const res = await request(app)
        .get('/api/v1/citizen/profile')
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.name).toBe('Priya Sharma');
    });
  });

  describe('Civic Report Submission & Server-Side Integrity', () => {
    it('creates a civic report with valid GeoJSON point and category', async () => {
      const mockCreated = {
        _id: new mongoose.Types.ObjectId(),
        reportId: 'AER-2026-1092',
        citizenId: new mongoose.Types.ObjectId(dummyCitizenId),
        category: 'ROAD_STRUCTURAL',
        description: 'Large asphalt fissure near the 4th cross intersection.',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        status: 'SUBMITTED',
        currentStage: 1,
        earnedPoints: 25,
        submittedAt: new Date()
      };

      vi.spyOn(CitizenReport, 'findOne').mockResolvedValue(null);
      vi.spyOn(CitizenReport, 'create').mockResolvedValue(mockCreated as any);
      vi.spyOn(Notification, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/citizen/reports')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          category: 'ROAD_STRUCTURAL',
          description: 'Large asphalt fissure near the 4th cross intersection.',
          location: {
            type: 'Point',
            coordinates: [77.5946, 12.9716]
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.reportId).toBe('AER-2026-1092');
      expect(res.body.data.status).toBe('SUBMITTED');
      expect(res.body.data.currentStage).toBe(1);
    });

    it('rejects report submission with invalid category', async () => {
      const res = await request(app)
        .post('/api/v1/citizen/reports')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          category: 'INVALID_CATEGORY_NAME',
          description: 'Pothole on main avenue road.',
          location: {
            type: 'Point',
            coordinates: [77.5946, 12.9716]
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects report submission with invalid coordinates (out of range)', async () => {
      const res = await request(app)
        .post('/api/v1/citizen/reports')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          category: 'ROAD_STRUCTURAL',
          description: 'Asphalt collapse near bus terminal.',
          location: {
            type: 'Point',
            coordinates: [250.0, 12.9716] // Longitude > 180
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('strictly overrides client-supplied privileged fields (status, points)', async () => {
      let passedData: any = null;
      vi.spyOn(CitizenReport, 'findOne').mockResolvedValue(null);
      vi.spyOn(CitizenReport, 'create').mockImplementation(async (doc: any) => {
        passedData = doc;
        return { ...doc, _id: new mongoose.Types.ObjectId() } as any;
      });
      vi.spyOn(Notification, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/citizen/reports')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          category: 'ROAD_STRUCTURAL',
          description: 'Street drainage block causing overflow.',
          location: {
            type: 'Point',
            coordinates: [77.5946, 12.9716]
          },
          // Maliciously supplied privileged fields
          status: 'RESOLVED',
          currentStage: 6,
          earnedPoints: 9999
        });

      expect(res.status).toBe(201);
      expect(passedData.status).toBe('SUBMITTED');
      expect(passedData.currentStage).toBe(1);
      expect(passedData.earnedPoints).toBe(25);
    });
  });

  describe('Report Ownership & Isolation', () => {
    it('returns 404 when looking up another citizen report', async () => {
      const reportOwnedByOther = {
        _id: new mongoose.Types.ObjectId(),
        reportId: 'AER-2026-9999',
        citizenId: new mongoose.Types.ObjectId(dummyOtherCitizenId), // Owned by other
        description: 'Private report',
        category: 'ROAD_STRUCTURAL'
      };

      vi.spyOn(CitizenReport, 'findOne').mockReturnValue({
        populate: vi.fn().mockResolvedValue(reportOwnedByOther)
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/reports/AER-2026-9999')
        .set('Authorization', `Bearer ${citizenToken}`); // Requested by dummyCitizenId

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('REPORT_NOT_FOUND');
    });

    it('returns report detail when requested by owning citizen', async () => {
      const myReport = {
        _id: new mongoose.Types.ObjectId(),
        reportId: 'AER-2026-1092',
        citizenId: new mongoose.Types.ObjectId(dummyCitizenId),
        description: 'My submitted pothole report',
        category: 'ROAD_STRUCTURAL'
      };

      vi.spyOn(CitizenReport, 'findOne').mockReturnValue({
        populate: vi.fn().mockResolvedValue(myReport)
      } as any);

      const res = await request(app)
        .get('/api/v1/citizen/reports/AER-2026-1092')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reportId).toBe('AER-2026-1092');
    });

    it('lists only reports belonging to authenticated citizen', async () => {
      vi.spyOn(CitizenReport, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          { reportId: 'AER-2026-1092', citizenId: dummyCitizenId }
        ])
      } as any);
      vi.spyOn(CitizenReport, 'countDocuments').mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/citizen/reports')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.reports.length).toBe(1);
      expect(res.body.data.pagination.total).toBe(1);
    });
  });

  describe('Notifications & Achievements', () => {
    it('retrieves citizen notifications with unread count', async () => {
      vi.spyOn(Notification, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          { title: 'Report Received', message: 'Inspection triage initialized' }
        ])
      } as any);
      vi.spyOn(Notification, 'countDocuments')
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(1); // unread

      const res = await request(app)
        .get('/api/v1/citizen/notifications')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(1);
      expect(res.body.data.notifications.length).toBe(1);
    });

    it('marks a single notification as read', async () => {
      const mockNotif = {
        _id: new mongoose.Types.ObjectId(),
        title: 'Report Received',
        readAt: new Date()
      };
      vi.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(mockNotif as any);

      const res = await request(app)
        .patch(`/api/v1/citizen/notifications/${mockNotif._id}/read`)
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Notification marked as read');
    });

    it('computes authentic achievements and badges from persisted reports', async () => {
      vi.spyOn(CitizenReport, 'countDocuments')
        .mockResolvedValueOnce(12) // totalReports -> COMMUNITY_WATCH unlocked
        .mockResolvedValueOnce(3)  // verifiedReports -> VERIFIED_CONTRIBUTOR unlocked
        .mockResolvedValueOnce(1)  // resolvedReports -> CIVIC_ADVOCATE unlocked
        .mockResolvedValueOnce(2); // ecoReports -> ECO_STEWARD (2/5)
      vi.spyOn(CitizenReport, 'aggregate').mockResolvedValue([{ totalPoints: 1280 }] as any);

      const res = await request(app)
        .get('/api/v1/citizen/achievements')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.civicPoints).toBe(1280);
      expect(res.body.data.isDerivedFromPersistedLedger).toBe(true);

      const badges = res.body.data.badges;
      const watchBadge = badges.find((b: any) => b.id === 'COMMUNITY_WATCH');
      expect(watchBadge.unlocked).toBe(true);

      const ecoBadge = badges.find((b: any) => b.id === 'ECO_STEWARD');
      expect(ecoBadge.unlocked).toBe(false);
      expect(ecoBadge.current).toBe(2);
    });
  });

  describe('Evidence Image Upload', () => {
    it('stages evidence photograph in development mode', async () => {
      const dummyBase64 = Buffer.from('fake image content bytes').toString('base64');
      vi.spyOn(MediaAsset, 'create').mockResolvedValue({
        mediaId: 'MED-1234',
        _id: new mongoose.Types.ObjectId(),
        contentType: 'image/jpeg',
        fileSize: 100,
        storageKey: 'uploads/citizen/MED-1234.jpeg'
      } as any);

      const res = await request(app)
        .post('/api/v1/citizen/media/upload')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          image: dummyBase64,
          contentType: 'image/jpeg',
          fileName: 'pothole.jpg'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.mediaId).toBe('MED-1234');
    });
  });

  describe('Public Outcomes & Public Statistics', () => {
    it('returns only PUBLISHED and isPublic=true outcomes', async () => {
      const mockOutcomes = [
        {
          outcomeId: 'OUT-8842',
          outcomeType: 'CIVIC_INFRASTRUCTURE',
          summary: 'MG Road Pothole Cluster Verified',
          reviewStatus: 'PUBLISHED',
          isPublic: true,
          missionId: { category: 'CIVIC_ISSUE_VERIFICATION', isConfidential: false }
        }
      ];

      vi.spyOn(MissionOutcome, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockOutcomes)
      } as any);

      const res = await request(app).get('/api/v1/public/outcomes');

      expect(res.status).toBe(200);
      expect(res.body.data.outcomes.length).toBe(1);
      expect(res.body.data.outcomes[0].outcomeId).toBe('OUT-8842');
    });

    it('strictly excludes confidential SAR outcomes from public discoverability', async () => {
      const mockOutcomes = [
        {
          outcomeId: 'OUT-PUBLIC-01',
          outcomeType: 'CIVIC_INFRASTRUCTURE',
          reviewStatus: 'PUBLISHED',
          isPublic: true,
          missionId: { isConfidential: false }
        },
        {
          outcomeId: 'OUT-SAR-SECRET',
          outcomeType: 'RESCUE_OPERATION',
          reviewStatus: 'PUBLISHED',
          isPublic: true,
          missionId: { category: 'SUBTERRANEAN_SEARCH_RESCUE', isConfidential: true } // Confidential!
        }
      ];

      vi.spyOn(MissionOutcome, 'find').mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(mockOutcomes)
      } as any);

      const res = await request(app).get('/api/v1/public/outcomes');

      expect(res.status).toBe(200);
      // Confidential outcome must be excluded
      expect(res.body.data.outcomes.length).toBe(1);
      expect(res.body.data.outcomes[0].outcomeId).toBe('OUT-PUBLIC-01');
    });

    it('returns 404 for individual confidential SAR outcome lookup', async () => {
      const confidentialOutcome = {
        outcomeId: 'OUT-SAR-SECRET',
        reviewStatus: 'PUBLISHED',
        isPublic: true,
        missionId: { isConfidential: true }
      };

      vi.spyOn(MissionOutcome, 'findOne').mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(confidentialOutcome)
      } as any);

      const res = await request(app).get('/api/v1/public/outcomes/OUT-SAR-SECRET');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('OUTCOME_NOT_FOUND');
    });

    it('returns public aggregate statistics without authentication', async () => {
      vi.spyOn(CitizenReport, 'countDocuments').mockResolvedValue(184);
      vi.spyOn(MissionOutcome, 'countDocuments').mockResolvedValue(42);

      const res = await request(app).get('/api/v1/public/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.verifiedThisMonth).toBe(184);
      expect(res.body.data.airspaceStatus).toBe('SEC-NORM');
    });
  });
});

