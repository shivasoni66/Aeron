import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { MediaAsset } from '../models/MediaAsset.js';
import { Mission } from '../models/Mission.js';
import { MissionOutcome } from '../models/MissionOutcome.js';
import { CitizenReport } from '../models/CitizenReport.js';
import { storageService } from '../services/storage.service.js';

export const mediaController = {
  /**
   * Diagnostic storage status check for operators.
   * Requires Admin or Manager authorization.
   */
  async getStorageStatus(req: Request, res: Response) {
    try {
      const status = storageService.getStatus();
      return res.status(200).json({
        status: 'success',
        data: status
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve storage status';
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: msg
      });
    }
  },

  /**
   * Retrieves media asset metadata with strict privacy and RBAC enforcement.
   */
  async getMediaMetadata(req: Request, res: Response) {
    try {
      const mediaId = String(req.params.mediaId || '');
      const asset = await MediaAsset.findOne({
        $or: [{ mediaId: mediaId.toUpperCase() }, { _id: mediaId.match(/^[0-9a-fA-F]{24}$/) ? mediaId : null }]
      });

      if (!asset) {
        return res.status(404).json({
          status: 'error',
          code: 'MEDIA_NOT_FOUND',
          message: `Media asset '${mediaId}' not found`
        });
      }

      // Check authorization based on related entity and privacy
      const authResult = await verifyMediaAccess(asset, req.user);
      if (!authResult.allowed) {
        return res.status(authResult.status).json({
          status: 'error',
          code: authResult.code,
          message: authResult.message
        });
      }

      return res.status(200).json({
        status: 'success',
        data: {
          mediaId: asset.mediaId,
          mediaType: asset.mediaType,
          contentType: asset.contentType,
          fileSize: asset.fileSize,
          storageProvider: asset.storageProvider,
          storageKey: asset.storageKey,
          checksum: asset.checksum,
          uploadedAt: asset.uploadedAt,
          relatedEntityType: asset.relatedEntityType,
          relatedEntityId: asset.relatedEntityId,
          source: asset.source,
          metadata: asset.metadata
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve media metadata';
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: msg
      });
    }
  },

  /**
   * Streams or redirects to media file content with access control.
   */
  async getMediaContent(req: Request, res: Response) {
    try {
      const mediaId = String(req.params.mediaId || '');
      const asset = await MediaAsset.findOne({
        $or: [{ mediaId: mediaId.toUpperCase() }, { _id: mediaId.match(/^[0-9a-fA-F]{24}$/) ? mediaId : null }]
      });

      if (!asset) {
        return res.status(404).json({
          status: 'error',
          code: 'MEDIA_NOT_FOUND',
          message: `Media asset '${mediaId}' not found`
        });
      }

      const authResult = await verifyMediaAccess(asset, req.user);
      if (!authResult.allowed) {
        return res.status(authResult.status).json({
          status: 'error',
          code: authResult.code,
          message: authResult.message
        });
      }

      // If stored on durable cloud storage (Cloudinary or S3 URL)
      if (asset.storageKey.startsWith('http://') || asset.storageKey.startsWith('https://')) {
        return res.redirect(302, asset.storageKey);
      }

      // If stored locally on disk
      const localPath = path.resolve(process.cwd(), asset.storageKey);
      if (!fs.existsSync(localPath)) {
        return res.status(404).json({
          status: 'error',
          code: 'MEDIA_FILE_MISSING',
          message: 'The media file is not present in local filesystem storage.'
        });
      }

      res.setHeader('Content-Type', asset.contentType);
      res.setHeader('Content-Length', asset.fileSize);
      return res.sendFile(localPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to deliver media content';
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_ERROR',
        message: msg
      });
    }
  }
};

/**
 * Access authorization checker enforcing SAR and private civic evidence security.
 */
async function verifyMediaAccess(
  asset: any,
  user?: { id: string; role: string }
): Promise<{ allowed: boolean; status: number; code: string; message: string }> {
  // 1. Admin and Manager have full access to all operational media
  if (user && (user.role === 'admin' || user.role === 'manager')) {
    return { allowed: true, status: 200, code: 'OK', message: 'Authorized' };
  }

  // 2. If uploader matches authenticated user
  if (user && asset.uploadedBy && asset.uploadedBy.toString() === user.id) {
    return { allowed: true, status: 200, code: 'OK', message: 'Authorized' };
  }

  // 3. Inspect related entity for confidentiality
  if (asset.relatedEntityType === 'MISSION' && asset.relatedEntityId) {
    const mission = await Mission.findById(asset.relatedEntityId);
    if (mission && (mission.missionType === 'SUBTERRANEAN_SEARCH_RESCUE' || (mission as any).isConfidential)) {
      if (!user) {
        return { allowed: false, status: 401, code: 'UNAUTHORIZED', message: 'Authentication required for confidential mission media' };
      }
      return { allowed: false, status: 403, code: 'FORBIDDEN_MEDIA_ACCESS', message: 'Search and Rescue mission media is confidential to authorized personnel.' };
    }
  }

  if (asset.relatedEntityType === 'MISSION_OUTCOME' && asset.relatedEntityId) {
    const outcome = await MissionOutcome.findById(asset.relatedEntityId);
    if (outcome && (outcome.isConfidential || !outcome.isPublic)) {
      if (!user) {
        return { allowed: false, status: 401, code: 'UNAUTHORIZED', message: 'Authentication required for confidential outcome media' };
      }
      return { allowed: false, status: 403, code: 'FORBIDDEN_MEDIA_ACCESS', message: 'Confidential mission outcome media is restricted.' };
    }
    // Public outcome
    return { allowed: true, status: 200, code: 'OK', message: 'Authorized' };
  }

  if (asset.relatedEntityType === 'CITIZEN_REPORT' && asset.relatedEntityId) {
    const report = await CitizenReport.findById(asset.relatedEntityId);
    if (report) {
      if (user && report.citizenId.toString() === user.id) {
        return { allowed: true, status: 200, code: 'OK', message: 'Authorized' };
      }
      // Resolved or published civic issues may be viewed publicly
      if (report.status === 'RESOLVED') {
        return { allowed: true, status: 200, code: 'OK', message: 'Authorized' };
      }
    }
    if (!user) {
      return { allowed: false, status: 401, code: 'UNAUTHORIZED', message: 'Authentication required for private civic report media' };
    }
    return { allowed: false, status: 403, code: 'FORBIDDEN_MEDIA_ACCESS', message: 'Access denied to unverified private citizen report media.' };
  }

  // If no related entity yet (staged upload): only uploader or admin/manager can access
  if (!user) {
    return { allowed: false, status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' };
  }

  if (asset.uploadedBy && asset.uploadedBy.toString() === user.id) {
    return { allowed: true, status: 200, code: 'OK', message: 'Authorized' };
  }

  return { allowed: false, status: 403, code: 'FORBIDDEN_MEDIA_ACCESS', message: 'Access to this media asset is restricted.' };
}
