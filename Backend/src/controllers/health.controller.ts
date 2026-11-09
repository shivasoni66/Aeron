import { Request, Response } from 'express';
import { getDatabaseStatus } from '../config/database.js';
import { env } from '../config/env.js';

const APP_VERSION = '1.0.0';
const startTime = Date.now();

export const getHealth = (req: Request, res: Response): void => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  res.status(200).json({
    status: 'healthy',
    service: 'aeron-backend',
    version: APP_VERSION,
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
};

export const getReadiness = (req: Request, res: Response): void => {
  const db = getDatabaseStatus();
  const isDbReady = db.readyState === 1;

  const readinessPayload = {
    status: isDbReady ? 'ready' : 'degraded',
    service: 'aeron-backend',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    dependencies: {
      database: {
        type: 'mongodb',
        status: db.status,
        ready: isDbReady,
        host: db.host
      },
      socketServer: {
        status: 'active',
        ready: true
      }
    }
  };

  // Return 200 if ready, 503 Service Unavailable if critical dependency (MongoDB) is not ready
  const statusCode = isDbReady ? 200 : 503;
  res.status(statusCode).json(readinessPayload);
};

export const getIntegratedHealth = (req: Request, res: Response): void => {
  const db = getDatabaseStatus();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  res.status(200).json({
    status: 'operational',
    service: 'aeron-backend',
    version: APP_VERSION,
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    subsystems: {
      api: { status: 'HEALTHY', healthy: true },
      database: { status: db.status === 'connected' ? 'CONNECTED' : 'DEGRADED', healthy: db.readyState === 1 },
      socketServer: { status: 'ACTIVE', healthy: true },
      telemetryPipeline: { status: 'READY', sourceValidation: 'STRICT' },
      cameraRelay: { status: 'ACTIVE', buffer: 'IN_MEMORY_BOUNDED' },
      mediaStorage: {
        status: env.isProduction ? 'BLOCKED_PENDING_S3_GCS' : 'LOCAL_STAGING',
        provider: 'LOCAL',
        durableCloudConfigured: false
      }
    }
  });
};

