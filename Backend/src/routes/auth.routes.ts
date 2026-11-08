import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';
import {
  registerRateLimiter,
  loginRateLimiter,
  refreshRateLimiter
} from '../middleware/rateLimit.middleware.js';

const authRouter = Router();

// Public routes with rate limiting
authRouter.post('/register', registerRateLimiter, AuthController.register);
authRouter.post('/login', loginRateLimiter, AuthController.login);
authRouter.post('/refresh', refreshRateLimiter, AuthController.refresh);
authRouter.post('/logout', AuthController.logout);

// Protected authenticated routes
authRouter.post('/logout-all', requireAuthentication, AuthController.logoutAll);
authRouter.get('/me', requireAuthentication, AuthController.getCurrentUser);
authRouter.get('/sessions', requireAuthentication, AuthController.getSessions);
authRouter.delete('/sessions/:sessionId', requireAuthentication, AuthController.revokeSession);

export { authRouter };

