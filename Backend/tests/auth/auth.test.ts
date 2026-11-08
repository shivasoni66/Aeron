import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../src/app.js';
import { User, IUser } from '../../src/models/User.js';
import { AuthSession } from '../../src/models/AuthSession.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { hashPassword } from '../../src/utils/password.js';
import { signAccessToken, hashRefreshToken } from '../../src/utils/jwt.js';

describe('AERON Auth — HTTP Routes & RBAC Integration Suite', () => {
  const app = createApp();
  const dummyUserId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PUBLIC CITIZEN REGISTRATION
  // =========================================================================
  describe('POST /api/v1/auth/register', () => {
    it('successfully registers a citizen account with strong password', async () => {
      vi.spyOn(User, 'findOne').mockResolvedValue(null as any);
      vi.spyOn(User, 'create').mockImplementation(async (doc: any) => {
        return {
          _id: new mongoose.Types.ObjectId(dummyUserId),
          name: doc.name,
          email: doc.email,
          role: doc.role, // Must be citizen
          accountStatus: doc.accountStatus,
          createdAt: new Date()
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Citizen',
          email: 'jane.citizen@example.com',
          password: 'Password123!@#'
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.role).toBe('citizen');
      expect(res.body.data.user.email).toBe('jane.citizen@example.com');
      // Verify no password or passwordHash in response
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('STRICTLY PREVENTS privilege escalation: ignores client-supplied admin role', async () => {
      vi.spyOn(User, 'findOne').mockResolvedValue(null as any);

      let createdRole = '';
      vi.spyOn(User, 'create').mockImplementation(async (doc: any) => {
        createdRole = doc.role;
        return {
          _id: new mongoose.Types.ObjectId(dummyUserId),
          name: doc.name,
          email: doc.email,
          role: doc.role,
          accountStatus: doc.accountStatus,
          createdAt: new Date()
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Malicious Actor',
          email: 'hacker@darkweb.org',
          password: 'Password123!@#',
          role: 'admin', // Attack vector: trying to register as admin
          accountStatus: 'active'
        });

      expect(res.status).toBe(201);
      // The backend MUST enforce role: 'citizen'
      expect(createdRole).toBe('citizen');
      expect(res.body.data.user.role).toBe('citizen');
    });

    it('rejects registration with duplicate email address', async () => {
      vi.spyOn(User, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        email: 'existing@aeron.gov'
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Jane Clone',
          email: 'existing@aeron.gov',
          password: 'Password123!@#'
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('rejects weak passwords failing the security policy', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Weak User',
          email: 'weak@example.com',
          password: 'weak'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('WEAK_PASSWORD');
    });
  });

  // =========================================================================
  // 2. USER AUTHENTICATION & LOGIN
  // =========================================================================
  describe('POST /api/v1/auth/login', () => {
    it('authenticates user with valid credentials and issues JWT + Session', async () => {
      const plainPassword = 'CorrectPassword123!';
      const hash = await hashPassword(plainPassword);

      vi.spyOn(User, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(dummyUserId),
          name: 'Chief Pilot',
          email: 'pilot@aeron.gov',
          role: 'admin',
          accountStatus: 'active',
          passwordHash: hash
        })
      } as any);

      vi.spyOn(AuthSession, 'create').mockResolvedValue({} as any);
      vi.spyOn(RefreshToken, 'create').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'pilot@aeron.gov',
          password: plainPassword,
          clientType: 'FLUTTER'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined(); // Supplied for mobile
      expect(res.body.data.user.email).toBe('pilot@aeron.gov');
      expect(res.body.data.user.role).toBe('admin');
      // Password hash must never leak in login response
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('rejects login with incorrect password with generic error response', async () => {
      const hash = await hashPassword('CorrectPassword123!');

      vi.spyOn(User, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          email: 'pilot@aeron.gov',
          role: 'admin',
          accountStatus: 'active',
          passwordHash: hash
        })
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'pilot@aeron.gov',
          password: 'WrongPassword456!'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('prevents user enumeration: unknown email returns identical generic error', async () => {
      vi.spyOn(User, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(null)
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@aeron.gov',
          password: 'SomePassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('rejects login for suspended accounts', async () => {
      const hash = await hashPassword('Password123!');

      vi.spyOn(User, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          email: 'suspended@aeron.gov',
          role: 'citizen',
          accountStatus: 'suspended',
          passwordHash: hash
        })
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'suspended@aeron.gov',
          password: 'Password123!'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  // =========================================================================
  // 3. PROTECTED /auth/me ENDPOINT & TOKEN VERIFICATION
  // =========================================================================
  describe('GET /api/v1/auth/me', () => {
    it('returns profile for valid authenticated user', async () => {
      const token = signAccessToken(dummyUserId, 'citizen');

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(dummyUserId),
        email: 'citizen@example.com',
        name: 'Jane Citizen',
        role: 'citizen',
        accountStatus: 'active'
      } as any);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(dummyUserId);
      expect(res.body.data.user.role).toBe('citizen');
    });

    it('rejects request with missing Authorization header', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects request with malformed / tampered Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.tampered.token');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_TOKEN');
    });
  });

  // =========================================================================
  // 4. REFRESH TOKEN ROTATION & REUSE DETECTION
  // =========================================================================
  describe('POST /api/v1/auth/refresh', () => {
    it('successfully rotates an active refresh token', async () => {
      const rawOldToken = 'a'.repeat(80);
      const tokenHash = hashRefreshToken(rawOldToken);
      const familyId = 'family-uuid-123';
      const sessionId = 'session-uuid-123';

      const mockExistingToken = {
        tokenId: 'token-uuid-1',
        tokenHash,
        userId: new mongoose.Types.ObjectId(dummyUserId),
        sessionId,
        familyId,
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 86400000),
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(RefreshToken, 'findOne').mockResolvedValue(mockExistingToken as any);
      vi.spyOn(RefreshToken, 'create').mockResolvedValue({} as any);

      vi.spyOn(AuthSession, 'findOne').mockResolvedValue({
        sessionId,
        revokedAt: null,
        save: vi.fn().mockResolvedValue(true)
      } as any);

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(dummyUserId),
        email: 'user@aeron.gov',
        role: 'manager',
        accountStatus: 'active'
      } as any);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawOldToken });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      // Verified old token was marked as ROTATED
      expect(mockExistingToken.status).toBe('ROTATED');
    });

    it('REUSE DETECTION: immediately revokes token family and active session on reuse', async () => {
      const reusedRawToken = 'b'.repeat(80);
      const reusedHash = hashRefreshToken(reusedRawToken);
      const familyId = 'compromised-family-999';
      const sessionId = 'compromised-session-999';

      vi.spyOn(RefreshToken, 'findOne').mockResolvedValue({
        tokenId: 'token-uuid-old',
        tokenHash: reusedHash,
        userId: new mongoose.Types.ObjectId(dummyUserId),
        sessionId,
        familyId,
        status: 'ROTATED', // Already rotated! Someone is replaying this token!
        expiresAt: new Date(Date.now() + 86400000)
      } as any);

      const updateManySpy = vi.spyOn(RefreshToken, 'updateMany').mockResolvedValue({} as any);
      const updateSessionSpy = vi.spyOn(AuthSession, 'updateOne').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: reusedRawToken });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('REFRESH_TOKEN_REUSE_DETECTED');

      // Verify the entire family was revoked
      expect(updateManySpy).toHaveBeenCalledWith(
        { familyId },
        { status: 'REVOKED' }
      );

      // Verify session was revoked
      expect(updateSessionSpy).toHaveBeenCalledWith(
        { sessionId },
        expect.objectContaining({ revocationReason: 'REFRESH_TOKEN_REUSE_DETECTED' })
      );
    });
  });

  // =========================================================================
  // 5. ROLE-BASED ACCESS CONTROL (RBAC) & ADMIN PROVISIONING
  // =========================================================================
  describe('RBAC on POST /api/v1/admin/users', () => {
    it('DENIES citizen from accessing administrator provisioning route (403)', async () => {
      const citizenToken = signAccessToken(dummyUserId, 'citizen');

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(dummyUserId),
        email: 'citizen@aeron.gov',
        role: 'citizen',
        accountStatus: 'active'
      } as any);

      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          name: 'New Manager',
          email: 'manager.new@aeron.gov',
          password: 'Password123!@#',
          role: 'manager'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('DENIES manager from accessing administrator provisioning route (403)', async () => {
      const managerToken = signAccessToken(dummyUserId, 'manager');

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(dummyUserId),
        email: 'manager@aeron.gov',
        role: 'manager',
        accountStatus: 'active'
      } as any);

      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Another Manager',
          email: 'mgr2@aeron.gov',
          password: 'Password123!@#',
          role: 'manager'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('ALLOWS administrator to provision a manager account (201)', async () => {
      const adminToken = signAccessToken(dummyUserId, 'admin');

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(dummyUserId),
        email: 'admin@aeron.gov',
        role: 'admin',
        accountStatus: 'active'
      } as any);

      vi.spyOn(User, 'findOne').mockResolvedValue(null as any);
      vi.spyOn(User, 'create').mockImplementation(async (doc: any) => {
        return {
          _id: new mongoose.Types.ObjectId(),
          name: doc.name,
          email: doc.email,
          role: doc.role,
          accountStatus: doc.accountStatus,
          createdAt: new Date()
        } as any;
      });

      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Mission Manager Bob',
          email: 'bob.manager@aeron.gov',
          password: 'Password123!@#',
          role: 'manager'
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.role).toBe('manager');
      expect(res.body.data.user.email).toBe('bob.manager@aeron.gov');
    });
  });

  // =========================================================================
  // 6. LOGOUT AND LOGOUT-ALL
  // =========================================================================
  describe('POST /api/v1/auth/logout & logout-all', () => {
    it('revokes session on logout', async () => {
      const updateSessionSpy = vi.spyOn(AuthSession, 'updateOne').mockResolvedValue({} as any);
      const updateTokenSpy = vi.spyOn(RefreshToken, 'updateMany').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({ sessionId: 'session-to-close' });

      expect(res.status).toBe(200);
      expect(updateSessionSpy).toHaveBeenCalledWith(
        { sessionId: 'session-to-close' },
        expect.objectContaining({ revocationReason: 'USER_LOGOUT' })
      );
      expect(updateTokenSpy).toHaveBeenCalledWith(
        { sessionId: 'session-to-close' },
        { status: 'REVOKED' }
      );
    });

    it('revokes all sessions on logout-all', async () => {
      const adminToken = signAccessToken(dummyUserId, 'admin');

      vi.spyOn(User, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(dummyUserId),
        email: 'admin@aeron.gov',
        role: 'admin',
        accountStatus: 'active'
      } as any);

      const updateSessionsSpy = vi.spyOn(AuthSession, 'updateMany').mockResolvedValue({} as any);
      const updateTokensSpy = vi.spyOn(RefreshToken, 'updateMany').mockResolvedValue({} as any);

      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(updateSessionsSpy).toHaveBeenCalled();
      expect(updateTokensSpy).toHaveBeenCalled();
    });
  });
});

