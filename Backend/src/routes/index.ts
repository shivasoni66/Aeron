import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { adminRouter } from './admin.routes.js';
import { managerRouter } from './manager.routes.js';
import { citizenRouter } from './citizen.routes.js';
import { publicRouter } from './public.routes.js';
import { telemetryRouter } from './telemetry.routes.js';
import { cameraRouter } from './camera.routes.js';
import { mediaRouter } from './media.routes.js';

const apiRouter = Router();

// Root API status endpoint
apiRouter.get('/', (req, res) => {
  res.status(200).json({
    name: 'AERON Flight & Mission Intelligence API',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

// Mount modular sub-routers
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/manager', managerRouter);
apiRouter.use('/citizen', citizenRouter);
apiRouter.use('/public', publicRouter);
apiRouter.use('/telemetry', telemetryRouter);
apiRouter.use('/camera', cameraRouter);
apiRouter.use('/media', mediaRouter);

export { apiRouter };


