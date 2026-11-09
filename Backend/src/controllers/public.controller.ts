import { Request, Response } from 'express';
import { MissionOutcome } from '../models/MissionOutcome.js';
import { CitizenReport } from '../models/CitizenReport.js';

export const publicController = {
  /**
   * Explore published public mission outcomes.
   * Strictly filters: reviewStatus: 'PUBLISHED', isPublic: true.
   * Confidentially protected Search & Rescue missions are strictly excluded.
   */
  async getPublicOutcomes(req: Request, res: Response) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const skip = (page - 1) * limit;

      const query: Record<string, unknown> = {
        reviewStatus: 'PUBLISHED',
        isPublic: true
      };

      if (req.query.category || req.query.outcomeType) {
        query.outcomeType = String(req.query.category || req.query.outcomeType).toUpperCase();
      }

      if (req.query.search) {
        const searchStr = String(req.query.search).trim();
        query.$or = [
          { summary: { $regex: searchStr, $options: 'i' } },
          { findings: { $regex: searchStr, $options: 'i' } },
          { outcomeId: { $regex: searchStr, $options: 'i' } }
        ];
      }

      const rawOutcomes = await MissionOutcome.find(query)
        .sort({ publishedAt: -1 })
        .populate({
          path: 'missionId',
          select: 'missionId category title isConfidential operationalArea'
        })
        .populate('evidenceAssets')
        .lean();

      // Exclude confidential SAR missions
      const sanitizedOutcomes = rawOutcomes.filter((outcome: any) => {
        if (outcome.missionId && outcome.missionId.isConfidential === true) {
          return false;
        }
        return true;
      });

      const total = sanitizedOutcomes.length;
      const paginated = sanitizedOutcomes.slice(skip, skip + limit);

      return res.status(200).json({
        status: 'success',
        data: {
          outcomes: paginated,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1
          }
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve public outcomes';
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: msg
      });
    }
  },

  /**
   * Get single public outcome details by outcome ID.
   */
  async getPublicOutcomeById(req: Request, res: Response) {
    try {
      const outcomeId = String(req.params.outcomeId);
      const query = outcomeId.startsWith('OUT-')
        ? { outcomeId, reviewStatus: 'PUBLISHED', isPublic: true }
        : { _id: outcomeId, reviewStatus: 'PUBLISHED', isPublic: true };

      const outcome: any = await MissionOutcome.findOne(query)
        .populate({
          path: 'missionId',
          select: 'missionId category title isConfidential operationalArea'
        })
        .populate('evidenceAssets')
        .lean();

      if (!outcome || (outcome.missionId && outcome.missionId.isConfidential === true)) {
        return res.status(404).json({
          status: 'error',
          code: 'OUTCOME_NOT_FOUND',
          message: 'Public mission outcome not found'
        });
      }

      return res.status(200).json({
        status: 'success',
        data: outcome
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve outcome';
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: msg
      });
    }
  },

  /**
   * Public aggregate metrics for the Home Screen Bento.
   */
  async getPublicStats(req: Request, res: Response) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [verifiedThisMonth, totalPublishedOutcomes] = await Promise.all([
        CitizenReport.countDocuments({
          status: { $in: ['AERIAL_VERIFIED', 'PUBLIC_WORKS_ASSIGNED', 'RESOLVED'] },
          updatedAt: { $gte: startOfMonth }
        }),
        MissionOutcome.countDocuments({
          reviewStatus: 'PUBLISHED',
          isPublic: true
        })
      ]);

      return res.status(200).json({
        status: 'success',
        data: {
          verifiedThisMonth,
          averageTriageHours: 4.2,
          totalPublishedOutcomes,
          airspaceStatus: 'SEC-NORM',
          activeSafetyAlerts: 0
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve public stats';
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: msg
      });
    }
  }
};

