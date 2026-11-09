import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware for authenticating Machine-to-Machine (M2M) ingestion agents (e.g., Python Drone Bridge).
 * Enforces a dedicated DRONE_BRIDGE_TOKEN passed via 'x-drone-bridge-token' or 'Authorization: Bearer <token>'.
 * Compares credentials using timing-safe buffer equality.
 */
export const requireDroneBridgeAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const headerToken =
    (req.headers['x-drone-bridge-token'] as string) ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!headerToken) {
    logger.warn(`[MachineAuth] Telemetry ingestion rejected: Missing bridge token from ${req.ip}`);
    res.status(401).json({
      status: 'error',
      code: 'DRONE_BRIDGE_TOKEN_REQUIRED',
      message: 'Machine-to-machine authentication token missing'
    });
    return;
  }

  const expectedToken = env.DRONE_BRIDGE_TOKEN;
  const tokenBuffer = Buffer.from(headerToken.trim());
  const expectedBuffer = Buffer.from(expectedToken.trim());

  // Timing-safe constant-time comparison
  const isValid =
    tokenBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(tokenBuffer, expectedBuffer);

  if (!isValid) {
    logger.warn(`[MachineAuth] Telemetry ingestion rejected: Invalid bridge token from ${req.ip}`);
    res.status(401).json({
      status: 'error',
      code: 'INVALID_DRONE_BRIDGE_TOKEN',
      message: 'Invalid machine-to-machine authentication token'
    });
    return;
  }

  next();
};

