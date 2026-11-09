import crypto from 'crypto';
import mongoose from 'mongoose';
import { User, UserRole, AccountStatus, IUser } from '../models/User.js';
import { AuthSession, ClientPlatform } from '../models/AuthSession.js';
import { RefreshToken } from '../models/RefreshToken.js';
import {
  hashPassword,
  comparePassword,
  validatePasswordPolicy
} from '../utils/password.js';
import {
  signAccessToken,
  generateOpaqueRefreshToken,
  hashRefreshToken
} from '../utils/jwt.js';
import { recordAuthAudit } from '../utils/audit.js';
import { env } from '../config/env.js';
import { isDatabaseConnected, isDatabaseError } from '../config/database.js';
import { AuditSource } from '../models/AuditLog.js';

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  profileImageUrl?: string;
  createdAt?: Date;
}

export interface AuthSuccessResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: UserDTO;
}

export interface SessionDTO {
  sessionId: string;
  clientType: ClientPlatform;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
}

export class AuthService {
  /**
   * Public Citizen Registration.
   * STRICT ENFORCEMENT: Role is hardcoded to 'citizen'.
   * Any client-supplied role or privilege field is ignored.
   */
  public static async registerCitizen(params: {
    name: string;
    email: string;
    password: string;
    source?: AuditSource;
  }): Promise<UserDTO> {
    const name = params.name?.trim();
    const email = params.email?.trim().toLowerCase();
    const source: AuditSource = params.source ?? 'CITIZEN_APP';

    if (!name || name.length < 2) {
      throw { status: 400, code: 'INVALID_NAME', message: 'Name must be at least 2 characters long' };
    }

    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      throw { status: 400, code: 'INVALID_EMAIL', message: 'A valid email address is required' };
    }

    const policy = validatePasswordPolicy(params.password);
    if (!policy.valid) {
      throw { status: 400, code: 'WEAK_PASSWORD', message: policy.reason };
    }

    if (!isDatabaseConnected()) {
      throw {
        status: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Authentication service temporarily unavailable. Please try again.'
      };
    }

    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      throw {
        status: 409,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email address already exists'
      };
    }

    const passwordHash = await hashPassword(params.password);

    // Explicitly enforce citizen role and active status
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'citizen',
      accountStatus: 'active'
    });

    await recordAuthAudit({
      action: 'AUTH_REGISTER_SUCCESS',
      actorId: user._id,
      entityType: 'User',
      entityId: user._id.toString(),
      source,
      metadata: { role: 'citizen', email }
    });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      profileImageUrl: user.profileImageUrl,
      createdAt: user.createdAt
    };
  }

  /**
   * User Authentication & Session Creation.
   */
  public static async login(params: {
    email: string;
    password: string;
    clientType?: ClientPlatform;
    userAgent?: string;
    ipAddress?: string;
    source?: AuditSource;
  }): Promise<AuthSuccessResult> {
    const email = params.email?.trim().toLowerCase();
    const clientType = params.clientType ?? 'WEB';
    const source = params.source ?? (clientType === 'FLUTTER' ? 'CITIZEN_APP' : 'ADMIN_WEB');

    if (!email || !params.password) {
      throw {
        status: 400,
        code: 'MISSING_CREDENTIALS',
        message: 'Email and password are required'
      };
    }

    if (!isDatabaseConnected()) {
      throw {
        status: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Authentication service temporarily unavailable. Please try again.'
      };
    }

    // Explicitly select passwordHash since it has select: false on schema
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      await recordAuthAudit({
        action: 'AUTH_LOGIN_FAILED',
        entityType: 'User',
        entityId: 'UNKNOWN',
        source,
        metadata: { reason: 'User not found', email }
      });
      // Generic error response to prevent user enumeration
      throw {
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      };
    }

    const isMatch = await comparePassword(params.password, user.passwordHash);
    if (!isMatch) {
      await recordAuthAudit({
        action: 'AUTH_LOGIN_FAILED',
        actorId: user._id,
        entityType: 'User',
        entityId: user._id.toString(),
        source,
        metadata: { reason: 'Password mismatch', email }
      });
      throw {
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      };
    }

    if (user.accountStatus !== 'active') {
      await recordAuthAudit({
        action: 'AUTH_LOGIN_FAILED',
        actorId: user._id,
        entityType: 'User',
        entityId: user._id.toString(),
        source,
        metadata: { reason: 'Account suspended/pending', status: user.accountStatus }
      });
      throw {
        status: 403,
        code: 'ACCOUNT_SUSPENDED',
        message: `Your account is ${user.accountStatus}. Please contact system administration.`
      };
    }

    // Establish persistent session and refresh token
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000);

    await AuthSession.create({
      sessionId,
      userId: user._id,
      clientType,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      expiresAt
    });

    const rawRefreshToken = generateOpaqueRefreshToken();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const familyId = crypto.randomUUID();

    await RefreshToken.create({
      tokenId: crypto.randomUUID(),
      tokenHash,
      userId: user._id,
      sessionId,
      familyId,
      status: 'ACTIVE',
      createdAt: new Date(),
      expiresAt
    });

    const accessToken = signAccessToken(user._id.toString(), user.role);

    await recordAuthAudit({
      action: 'AUTH_LOGIN_SUCCESS',
      actorId: user._id,
      entityType: 'User',
      entityId: user._id.toString(),
      source,
      metadata: { sessionId, clientType, role: user.role }
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      sessionId,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        profileImageUrl: user.profileImageUrl,
        createdAt: user.createdAt
      }
    };
  }

  /**
   * Refresh Token Rotation with Automatic Reuse Detection.
   */
  public static async rotateRefreshToken(params: {
    rawRefreshToken: string;
    userAgent?: string;
    ipAddress?: string;
    source?: AuditSource;
  }): Promise<{ accessToken: string; refreshToken: string; user: UserDTO }> {
    if (!params.rawRefreshToken) {
      throw { status: 401, code: 'MISSING_REFRESH_TOKEN', message: 'Authentication required. No refresh token provided.' };
    }

    if (!isDatabaseConnected()) {
      throw {
        status: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Authentication service temporarily unavailable. Please try again.'
      };
    }

    const tokenHash = hashRefreshToken(params.rawRefreshToken);
    const existingToken = await RefreshToken.findOne({ tokenHash });

    if (!existingToken) {
      await recordAuthAudit({
        action: 'AUTH_REFRESH_TOKEN_UNKNOWN',
        entityType: 'RefreshToken',
        entityId: 'UNKNOWN',
        source: params.source ?? 'SYSTEM',
        metadata: { ipAddress: params.ipAddress }
      });
      throw {
        status: 401,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or unrecognized refresh token'
      };
    }

    // =========================================================================
    // REUSE DETECTION: If a previously rotated token is presented again,
    // compromise is assumed. Revoke the entire token family and active session.
    // =========================================================================
    if (existingToken.status === 'ROTATED') {
      await RefreshToken.updateMany(
        { familyId: existingToken.familyId },
        { status: 'REVOKED' }
      );

      await AuthSession.updateOne(
        { sessionId: existingToken.sessionId },
        {
          revokedAt: new Date(),
          revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED'
        }
      );

      await recordAuthAudit({
        action: 'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
        actorId: existingToken.userId,
        entityType: 'RefreshToken',
        entityId: existingToken.tokenId,
        source: params.source ?? 'SYSTEM',
        metadata: {
          familyId: existingToken.familyId,
          sessionId: existingToken.sessionId,
          ipAddress: params.ipAddress
        }
      });

      throw {
        status: 401,
        code: 'REFRESH_TOKEN_REUSE_DETECTED',
        message: 'Security violation: Refresh token reuse detected. All sessions in this family revoked.'
      };
    }

    if (existingToken.status === 'REVOKED') {
      throw {
        status: 401,
        code: 'REFRESH_TOKEN_REVOKED',
        message: 'This refresh token has been revoked'
      };
    }

    if (existingToken.expiresAt.getTime() <= Date.now()) {
      throw {
        status: 401,
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired. Please log in again.'
      };
    }

    // Verify parent session is still valid
    const session = await AuthSession.findOne({ sessionId: existingToken.sessionId });
    if (!session || session.revokedAt) {
      throw {
        status: 401,
        code: 'SESSION_REVOKED',
        message: 'Associated login session has expired or been revoked'
      };
    }

    // Verify user is active
    const user = await User.findById(existingToken.userId);
    if (!user || user.accountStatus !== 'active') {
      throw {
        status: 403,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Account is inactive or suspended'
      };
    }

    // Rotate: Mark current token as ROTATED
    const newTokenId = crypto.randomUUID();
    existingToken.status = 'ROTATED';
    existingToken.rotatedAt = new Date();
    existingToken.replacedByTokenId = newTokenId;
    await existingToken.save();

    // Issue new active refresh token preserving the familyId
    const rawNewRefreshToken = generateOpaqueRefreshToken();
    const newHash = hashRefreshToken(rawNewRefreshToken);

    await RefreshToken.create({
      tokenId: newTokenId,
      tokenHash: newHash,
      userId: existingToken.userId,
      sessionId: existingToken.sessionId,
      familyId: existingToken.familyId,
      status: 'ACTIVE',
      createdAt: new Date(),
      expiresAt: existingToken.expiresAt
    });

    // Touch session lastUsedAt
    session.lastUsedAt = new Date();
    if (params.userAgent) session.userAgent = params.userAgent;
    if (params.ipAddress) session.ipAddress = params.ipAddress;
    await session.save();

    const newAccessToken = signAccessToken(user._id.toString(), user.role);

    await recordAuthAudit({
      action: 'AUTH_TOKEN_ROTATION_SUCCESS',
      actorId: user._id,
      entityType: 'RefreshToken',
      entityId: newTokenId,
      source: params.source ?? 'SYSTEM',
      metadata: { sessionId: existingToken.sessionId }
    });

    return {
      accessToken: newAccessToken,
      refreshToken: rawNewRefreshToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        profileImageUrl: user.profileImageUrl,
        createdAt: user.createdAt
      }
    };
  }

  /**
   * Logout single session.
   */
  public static async logout(params: {
    userId: string;
    rawRefreshToken?: string;
    sessionId?: string;
    source?: AuditSource;
  }): Promise<void> {
    let resolvedSessionId = params.sessionId;

    if (params.rawRefreshToken) {
      const tokenHash = hashRefreshToken(params.rawRefreshToken);
      const token = await RefreshToken.findOne({ tokenHash });
      if (token) {
        resolvedSessionId = token.sessionId;
        await RefreshToken.updateMany(
          { familyId: token.familyId },
          { status: 'REVOKED' }
        );
      }
    }

    if (resolvedSessionId) {
      await AuthSession.updateOne(
        { sessionId: resolvedSessionId },
        { revokedAt: new Date(), revocationReason: 'USER_LOGOUT' }
      );
      await RefreshToken.updateMany(
        { sessionId: resolvedSessionId },
        { status: 'REVOKED' }
      );
    }

    await recordAuthAudit({
      action: 'AUTH_LOGOUT',
      actorId: params.userId,
      entityType: 'AuthSession',
      entityId: resolvedSessionId ?? 'SESSION',
      source: params.source ?? 'SYSTEM'
    });
  }

  /**
   * Logout from all sessions.
   */
  public static async logoutAll(userId: string, source?: AuditSource): Promise<void> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await AuthSession.updateMany(
      { userId: userObjectId, revokedAt: null },
      { revokedAt: new Date(), revocationReason: 'USER_LOGOUT_ALL' }
    );

    await RefreshToken.updateMany(
      { userId: userObjectId, status: 'ACTIVE' },
      { status: 'REVOKED' }
    );

    await recordAuthAudit({
      action: 'AUTH_LOGOUT_ALL',
      actorId: userObjectId,
      entityType: 'User',
      entityId: userId,
      source: source ?? 'SYSTEM'
    });
  }

  /**
   * List active sessions for user.
   */
  public static async listSessions(userId: string): Promise<SessionDTO[]> {
    const sessions = await AuthSession.find({
      userId: new mongoose.Types.ObjectId(userId),
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    }).sort({ lastUsedAt: -1 });

    return sessions.map((s) => ({
      sessionId: s.sessionId,
      clientType: s.clientType,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt
    }));
  }

  /**
   * Revoke specific session.
   */
  public static async revokeSession(userId: string, targetSessionId: string): Promise<void> {
    const session = await AuthSession.findOne({
      sessionId: targetSessionId,
      userId: new mongoose.Types.ObjectId(userId)
    });

    if (!session) {
      throw { status: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found or already closed' };
    }

    session.revokedAt = new Date();
    session.revocationReason = 'USER_MANUAL_REVOCATION';
    await session.save();

    await RefreshToken.updateMany(
      { sessionId: targetSessionId },
      { status: 'REVOKED' }
    );

    await recordAuthAudit({
      action: 'AUTH_SESSION_REVOKED',
      actorId: userId,
      entityType: 'AuthSession',
      entityId: targetSessionId,
      source: 'SYSTEM'
    });
  }

  /**
   * Admin Provisioning Endpoint:
   * Only authenticated administrators can invoke this to create managers or other admins.
   */
  public static async provisionUser(params: {
    adminUserId: string;
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<UserDTO> {
    const validRoles: UserRole[] = ['admin', 'manager', 'citizen'];
    if (!validRoles.includes(params.role)) {
      throw { status: 400, code: 'INVALID_ROLE', message: 'Invalid target role requested' };
    }

    const email = params.email?.trim().toLowerCase();
    const name = params.name?.trim();

    if (!name || name.length < 2) {
      throw { status: 400, code: 'INVALID_NAME', message: 'Name must be at least 2 characters long' };
    }

    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      throw { status: 400, code: 'INVALID_EMAIL', message: 'Valid email address is required' };
    }

    const policy = validatePasswordPolicy(params.password);
    if (!policy.valid) {
      throw { status: 400, code: 'WEAK_PASSWORD', message: policy.reason };
    }

    if (!isDatabaseConnected()) {
      throw {
        status: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Authentication service temporarily unavailable. Please try again.'
      };
    }

    const existing = await User.findOne({ email });
    if (existing) {
      throw { status: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'Email already registered' };
    }

    const passwordHash = await hashPassword(params.password);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: params.role,
      accountStatus: 'active'
    });

    await recordAuthAudit({
      action: 'AUTH_ADMIN_PROVISION_USER',
      actorId: params.adminUserId,
      entityType: 'User',
      entityId: user._id.toString(),
      source: 'ADMIN_WEB',
      metadata: { targetRole: params.role, email }
    });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      profileImageUrl: user.profileImageUrl,
      createdAt: user.createdAt
    };
  }
}

