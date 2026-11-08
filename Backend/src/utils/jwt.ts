import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserRole } from '../models/User.js';

export interface JWTAccessPayload {
  sub: string;
  role: UserRole;
  jti: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
}

/**
 * Signs an HS256 JWT access token with standard claims.
 */
export const signAccessToken = (userId: string, role: UserRole): string => {
  const jti = crypto.randomUUID();
  const payload: Omit<JWTAccessPayload, 'iat' | 'exp'> = {
    sub: userId,
    role,
    jti,
    iss: env.JWT_ISSUER,
    aud: env.JWT_AUDIENCE
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS
  });
};

/**
 * Verifies and decodes an access token.
 * Rejects unsigned, expired, tampered, or mismatched tokens.
 */
export const verifyAccessToken = (token: string): JWTAccessPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE
  });

  return decoded as JWTAccessPayload;
};

/**
 * Generates a cryptographically secure opaque refresh token.
 */
export const generateOpaqueRefreshToken = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

/**
 * Computes a deterministic SHA-256 hash of an opaque refresh token for database lookup.
 * Raw refresh tokens are never persisted in the database.
 */
export const hashRefreshToken = (rawToken: string): string => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

