import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuthentication, requireRole } from '../middleware/auth.middleware.js';

const adminRouter = Router();

// Administrative user provisioning endpoint (Admins only)
adminRouter.post(
  '/users',
  requireAuthentication,
  requireRole('admin'),
  AuthController.provisionUser
);

export { adminRouter };

