import { Router } from 'express';
import { publicController } from '../controllers/public.controller.js';

const publicRouter = Router();

// Public Discoverability Endpoints (No authentication required)
publicRouter.get('/outcomes', publicController.getPublicOutcomes);
publicRouter.get('/outcomes/:outcomeId', publicController.getPublicOutcomeById);
publicRouter.get('/stats', publicController.getPublicStats);

export { publicRouter };

