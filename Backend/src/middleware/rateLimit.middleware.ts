import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const isTest = env.isTest;

/**
 * Rate limiter for citizen registration endpoint.
 * Protects against bot account creation.
 */
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 1000 : 10, // 10 registrations per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many accounts registered from this IP. Please try again after an hour.'
  }
});

/**
 * Rate limiter for login endpoint.
 * Protects against brute-force password guessing.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 10, // 10 login attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

/**
 * Rate limiter for refresh token rotation.
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 1000 : 30, // 30 refresh calls per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many token refresh requests. Please slow down.'
  }
});

