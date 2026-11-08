import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const logMeta = {
      method,
      url: originalUrl,
      status: statusCode,
      durationMs: duration,
      userAgent: req.get('user-agent') || 'unknown'
    };

    if (statusCode >= 500) {
      logger.error(`HTTP ${method} ${originalUrl} ${statusCode} [${duration}ms]`, logMeta);
    } else if (statusCode >= 400) {
      logger.warn(`HTTP ${method} ${originalUrl} ${statusCode} [${duration}ms]`, logMeta);
    } else {
      logger.info(`HTTP ${method} ${originalUrl} ${statusCode} [${duration}ms]`, logMeta);
    }
  });

  next();
};

