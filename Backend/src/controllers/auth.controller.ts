import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/auth.service.js';
import { env } from '../config/env.js';
import { ClientPlatform } from '../models/AuthSession.js';
import { UserRole } from '../models/User.js';

const REFRESH_COOKIE_NAME = 'aeron_refresh_token';
const CSRF_COOKIE_NAME = 'aeron_csrf';

const getClientPlatform = (req: Request): ClientPlatform => {
  const header = req.headers['x-client-platform'];
  if (header === 'FLUTTER') return 'FLUTTER';
  if (header === 'CLI') return 'CLI';
  if (req.body?.clientType === 'FLUTTER') return 'FLUTTER';
  return 'WEB';
};

const setAuthCookies = (res: Response, refreshToken: string): string => {
  const isSecure = env.isProduction;
  const csrfToken = crypto.randomBytes(24).toString('hex');

  // HttpOnly, Secure cookie for Refresh Token
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86400000
  });

  // Non-HttpOnly cookie for Double-Submit CSRF Verification on Web
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86400000
  });

  return csrfToken;
};

const clearAuthCookies = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/api/v1/auth'
  });
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/'
  });
};

export class AuthController {
  /**
   * POST /api/v1/auth/register
   * Public registration strictly for citizen accounts.
   */
  public static async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password } = req.body;
      const user = await AuthService.registerCitizen({
        name,
        email,
        password,
        source: getClientPlatform(req) === 'FLUTTER' ? 'CITIZEN_APP' : 'ADMIN_WEB'
      });

      res.status(201).json({
        status: 'success',
        message: 'Citizen account registered successfully',
        data: { user }
      });
    } catch (err: unknown) {
      const error = err as { status?: number; code?: string; message?: string };
      res.status(error.status ?? 500).json({
        status: 'error',
        code: error.code ?? 'REGISTRATION_FAILED',
        message: error.message ?? 'Failed to register account'
      });
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const clientType = getClientPlatform(req);
      const userAgent = req.headers['user-agent'] as string;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const result = await AuthService.login({
        email,
        password,
        clientType,
        userAgent,
        ipAddress
      });

      // For WEB clients, set HttpOnly refresh cookie & CSRF cookie
      let csrfToken: string | undefined;
      if (clientType === 'WEB' || req.cookies) {
        csrfToken = setAuthCookies(res, result.refreshToken);
      }

      res.status(200).json({
        status: 'success',
        message: 'Authentication successful',
        data: {
          accessToken: result.accessToken,
          // Supply refreshToken in body for mobile/Flutter or API clients
          refreshToken: clientType === 'FLUTTER' || clientType === 'CLI' ? result.refreshToken : undefined,
          tokenType: 'Bearer',
          expiresInSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
          sessionId: result.sessionId,
          csrfToken,
          user: result.user
        }
      });
    } catch (err: unknown) {
      const error = err as { status?: number; code?: string; message?: string };
      res.status(error.status ?? 500).json({
        status: 'error',
        code: error.code ?? 'LOGIN_FAILED',
        message: error.message ?? 'Authentication failed'
      });
    }
  }

  /**
   * POST /api/v1/auth/refresh
   * Single-use rotation with reuse detection.
   */
  public static async refresh(req: Request, res: Response): Promise<void> {
    try {
      // Check body first (Flutter/Mobile), then fallback to HttpOnly cookie (Web)
      const rawRefreshToken = req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];

      if (!rawRefreshToken) {
        res.status(400).json({
          status: 'error',
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token must be provided via request body or authorization cookie'
        });
        return;
      }

      // CSRF validation for cookie-based browser requests
      if (!req.body?.refreshToken && req.cookies?.[REFRESH_COOKIE_NAME]) {
        const headerCsrf = req.headers['x-csrf-token'];
        const cookieCsrf = req.cookies?.[CSRF_COOKIE_NAME];
        if (headerCsrf && cookieCsrf && headerCsrf !== cookieCsrf) {
          res.status(403).json({
            status: 'error',
            code: 'CSRF_MISMATCH',
            message: 'Invalid CSRF token'
          });
          return;
        }
      }

      const clientType = getClientPlatform(req);
      const userAgent = req.headers['user-agent'] as string;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const result = await AuthService.rotateRefreshToken({
        rawRefreshToken,
        userAgent,
        ipAddress
      });

      let csrfToken: string | undefined;
      if (clientType === 'WEB' || req.cookies?.[REFRESH_COOKIE_NAME]) {
        csrfToken = setAuthCookies(res, result.refreshToken);
      }

      res.status(200).json({
        status: 'success',
        message: 'Tokens rotated successfully',
        data: {
          accessToken: result.accessToken,
          refreshToken: clientType === 'FLUTTER' || clientType === 'CLI' || req.body?.refreshToken ? result.refreshToken : undefined,
          tokenType: 'Bearer',
          expiresInSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
          csrfToken,
          user: result.user
        }
      });
    } catch (err: unknown) {
      const error = err as { status?: number; code?: string; message?: string };
      clearAuthCookies(res);
      res.status(error.status ?? 401).json({
        status: 'error',
        code: error.code ?? 'REFRESH_FAILED',
        message: error.message ?? 'Token rotation failed'
      });
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  public static async logout(req: Request, res: Response): Promise<void> {
    try {
      const rawRefreshToken = req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE_NAME];
      const userId = req.user?.id || 'ANONYMOUS';

      await AuthService.logout({
        userId,
        rawRefreshToken,
        sessionId: req.body?.sessionId
      });

      clearAuthCookies(res);

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully'
      });
    } catch (err: unknown) {
      clearAuthCookies(res);
      const error = err as { status?: number; code?: string; message?: string };
      res.status(error.status ?? 500).json({
        status: 'error',
        code: error.code ?? 'LOGOUT_FAILED',
        message: error.message ?? 'Failed to complete logout'
      });
    }
  }

  /**
   * POST /api/v1/auth/logout-all
   */
  public static async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      await AuthService.logoutAll(req.user.id);
      clearAuthCookies(res);

      res.status(200).json({
        status: 'success',
        message: 'All active sessions have been revoked'
      });
    } catch (err: unknown) {
      const error = err as { status?: number; code?: string; message?: string };
      res.status(error.status ?? 500).json({
        status: 'error',
        code: error.code ?? 'LOGOUT_ALL_FAILED',
        message: error.message ?? 'Failed to revoke all sessions'
      });
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  public static async getCurrentUser(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { user: req.user }
    });
  }

  /**
   * GET /api/v1/auth/sessions
   */
  public static async getSessions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const sessions = await AuthService.listSessions(req.user.id);
      res.status(200).json({
        status: 'success',
        data: { sessions }
      });
    } catch (err: unknown) {
      const error = err as { status?: number; code?: string; message?: string };
      res.status(error.status ?? 500).json({
        status: 'error',
        code: error.code ?? 'SESSIONS_FETCH_FAILED',
        message: error.message ?? 'Failed to retrieve sessions'
      });
    }
  }

  /**
   * DELETE /api/v1/auth/sessions/:sessionId
   */
  public static async revokeSession(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', code: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const sessionId = req.params.sessionId as string;
      if (!sessionId) {
        res.status(400).json({ status: 'error', code: 'MISSING_SESSION_ID', message: 'Session ID parameter required' });
        return;
      }

      await AuthService.revokeSession(req.user.id, sessionId);

      res.status(200).json({
        status: 'success',
        message: `Session ${sessionId} revoked successfully`
      });
    } catch (err: unknown) {
      const error = err as { status?: number; code?: string; message?: string };
      res.status(error.status ?? 500).json({
        status: 'error',
        code: error.code ?? 'SESSION_REVOCATION_FAILED',
        message: error.message ?? 'Failed to revoke session'
      });
    }
  }

  /**
   * POST /api/v1/admin/users
   * Protected Admin Provisioning Endpoint for Managers and Admins.
   */
  public static async provisionUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_ROLE',
          message: 'Only authorized administrators may provision accounts'
        });
        return;
      }

      const { name, email, password, role } = req.body;
      const user = await AuthService.provisionUser({
        adminUserId: req.user.id,
        name,
        email,
        password,
        role: role as UserRole
      });

      res.status(201).json({
        status: 'success',
        message: `Account with role '${user.role}' provisioned successfully`,
        data: { user }
      });
    } catch (err: unknown) {
      const error = err as { status?: number; code?: string; message?: string };
      res.status(error.status ?? 500).json({
        status: 'error',
        code: error.code ?? 'PROVISIONING_FAILED',
        message: error.message ?? 'Failed to provision user'
      });
    }
  }
}
