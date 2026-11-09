import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { corsMiddleware, helmetMiddleware } from './middleware/security.middleware.js';
import { requestLogger } from './middleware/logging.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { healthRouter } from './routes/health.routes.js';
import { apiRouter } from './routes/index.js';

export const createApp = (): Express => {
  const app = express();

  // Configure reverse proxy trust for Render / Cloudflare deployments
  app.set('trust proxy', 1);

  // Security and parsing middleware
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(requestLogger);

  // Root health endpoints as specified in Task 01 requirements
  app.use('/health', healthRouter);

  // Versioned API namespace
  app.use('/api/v1', apiRouter);

  // Fallback 404 handler
  app.use(notFoundHandler);

  // Central error handler
  app.use(errorHandler);

  return app;
};

