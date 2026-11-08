import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  validatePasswordPolicy,
  hashPassword,
  comparePassword
} from '../../src/utils/password.js';
import {
  signAccessToken,
  verifyAccessToken,
  generateOpaqueRefreshToken,
  hashRefreshToken
} from '../../src/utils/jwt.js';
import { env } from '../../src/config/env.js';

describe('AERON Auth — Password & JWT Cryptographic Utilities', () => {
  // =========================================================================
  // 1. PASSWORD POLICY & BCRYPT HASHING
  // =========================================================================
  describe('Password Security', () => {
    it('accepts strong compliant passwords', () => {
      const res = validatePasswordPolicy('Aer0n#P1lot2026!');
      expect(res.valid).toBe(true);
      expect(res.reason).toBeUndefined();
    });

    it('rejects passwords shorter than 8 characters', () => {
      const res = validatePasswordPolicy('Sh0rt!');
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('at least 8 characters');
    });

    it('rejects passwords missing uppercase letters', () => {
      const res = validatePasswordPolicy('aer0n#p1lot2026!');
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('uppercase letter');
    });

    it('rejects passwords missing lowercase letters', () => {
      const res = validatePasswordPolicy('AER0N#P1LOT2026!');
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('lowercase letter');
    });

    it('rejects passwords missing numeric digits', () => {
      const res = validatePasswordPolicy('Aeron#PilotSpecial!');
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('numeric digit');
    });

    it('rejects passwords missing special characters', () => {
      const res = validatePasswordPolicy('AeronPilot2026');
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('special character');
    });

    it('hashes passwords using bcrypt with work factor >= 12', async () => {
      const raw = 'SecureSecretPassword123!';
      const hash = await hashPassword(raw);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$2a$12$') || hash.startsWith('$2b$12$')).toBe(true);
      expect(hash).not.toBe(raw);

      const isMatch = await comparePassword(raw, hash);
      expect(isMatch).toBe(true);

      const isWrong = await comparePassword('WrongPassword123!', hash);
      expect(isWrong).toBe(false);
    });
  });

  // =========================================================================
  // 2. JWT ACCESS TOKEN VERIFICATION & CLAIMS
  // =========================================================================
  describe('JWT Access Tokens', () => {
    it('signs and verifies valid HS256 tokens with standard claims', () => {
      const userId = '507f1f77bcf86cd799439011';
      const role = 'admin';

      const token = signAccessToken(userId, role);
      expect(token).toBeDefined();

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(userId);
      expect(decoded.role).toBe('admin');
      expect(decoded.iss).toBe(env.JWT_ISSUER);
      expect(decoded.aud).toBe(env.JWT_AUDIENCE);
      expect(decoded.jti).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('rejects tampered tokens', () => {
      const token = signAccessToken('507f1f77bcf86cd799439011', 'citizen');
      // Tamper signature by modifying the last character
      const parts = token.split('.');
      parts[2] = parts[2].slice(0, -2) + 'XX';
      const tampered = parts.join('.');

      expect(() => verifyAccessToken(tampered)).toThrow();
    });

    it('rejects unsigned "none" algorithm tokens', () => {
      const unsigned = jwt.sign(
        { sub: 'hacker', role: 'admin', iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE },
        '',
        // @ts-expect-error Testing none algorithm rejection
        { algorithm: 'none' }
      );

      expect(() => verifyAccessToken(unsigned)).toThrow();
    });

    it('rejects tokens with mismatched issuer or audience', () => {
      const badToken = jwt.sign(
        { sub: 'user1', role: 'citizen', iss: 'fake-issuer', aud: 'fake-audience' },
        env.JWT_SECRET,
        { algorithm: 'HS256' }
      );

      expect(() => verifyAccessToken(badToken)).toThrow();
    });

    it('rejects expired tokens', () => {
      const expiredToken = jwt.sign(
        { sub: 'user1', role: 'citizen', iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE },
        env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: -10 }
      );

      expect(() => verifyAccessToken(expiredToken)).toThrow();
    });
  });

  // =========================================================================
  // 3. OPAQUE REFRESH TOKENS & HASHING
  // =========================================================================
  describe('Opaque Refresh Tokens', () => {
    it('generates random opaque tokens and deterministically hashes them', () => {
      const token1 = generateOpaqueRefreshToken();
      const token2 = generateOpaqueRefreshToken();

      expect(token1).toHaveLength(80); // 40 bytes hex = 80 chars
      expect(token2).toHaveLength(80);
      expect(token1).not.toBe(token2);

      const hash1 = hashRefreshToken(token1);
      const hash1Repeat = hashRefreshToken(token1);
      expect(hash1).toBe(hash1Repeat);
      expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
    });
  });
});

