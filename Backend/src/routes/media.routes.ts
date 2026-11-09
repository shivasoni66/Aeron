import { Router } from 'express';
import { mediaController } from '../controllers/media.controller.js';
import { requireAuthentication, requireRole, optionalAuthentication } from '../middleware/auth.middleware.js';

const router = Router();

// Operator diagnostic endpoint: view storage configuration status
router.get(
  '/storage/status',
  requireAuthentication,
  requireRole('admin', 'manager'),
  mediaController.getStorageStatus
);

// Retrieve media metadata with role/privacy authorization
router.get('/:mediaId', optionalAuthentication, mediaController.getMediaMetadata);

// Deliver or redirect to media file content
router.get('/:mediaId/content', optionalAuthentication, mediaController.getMediaContent);

export { router as mediaRouter };

