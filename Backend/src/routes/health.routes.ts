import { Router } from 'express';
import { getHealth, getReadiness, getIntegratedHealth } from '../controllers/health.controller.js';

const router = Router();

router.get('/', getHealth);
router.get('/ready', getReadiness);
router.get('/integrated', getIntegratedHealth);

export { router as healthRouter };

