import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'APPLICATION_ERROR');

  logger.error(`Error processing ${req.method} ${req.originalUrl}: ${err.message}`, err);

  res.status(statusCode).json({
    status: 'error',
    code,
    message: statusCode === 500 && env.isProduction
      ? 'An unexpected internal error occurred on AERON server'
      : err.message,
    timestamp: new Date().toISOString(),
    details: env.isProduction ? undefined : err.details
  });
};

