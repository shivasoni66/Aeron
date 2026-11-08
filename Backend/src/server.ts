import { createServer } from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initSocketServer } from './sockets/socket.server.js';
import { logger } from './utils/logger.js';

const startServer = async () => {
  const app = createApp();
  const httpServer = createServer(app);

  // Initialize Socket.IO engine
  initSocketServer(httpServer);

  // Attempt database connection (graceful, non-fatal for scaffolding)
  await connectDatabase();

  const server = httpServer.listen(env.PORT, () => {
    logger.info(`========================================================`);
    logger.info(`🚀 AERON BACKEND SERVER OPERATIONAL`);
    logger.info(`🌐 Environment : ${env.NODE_ENV}`);
    logger.info(`📡 Port        : ${env.PORT}`);
    logger.info(`🩺 Health      : http://localhost:${env.PORT}/health`);
    logger.info(`🩺 Readiness   : http://localhost:${env.PORT}/health/ready`);
    logger.info(`🔌 API Base    : http://localhost:${env.PORT}/api/v1`);
    logger.info(`========================================================`);
  });

  // Graceful termination handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down AERON backend gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDatabase();
      process.exit(0);
    });

    // Force termination if graceful shutdown exceeds 10s
    setTimeout(() => {
      logger.error('Forceful shutdown triggered after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch((err) => {
  logger.error('Fatal failure starting AERON backend', err);
  process.exit(1);
});

