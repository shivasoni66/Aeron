import { Router } from 'express';
import { CameraController } from '../controllers/camera.controller.js';
import { requireDroneBridgeAuth } from '../middleware/machineAuth.middleware.js';

const cameraRouter = Router();

// Machine-to-Machine authenticated camera frame & status ingestion
cameraRouter.post('/frames', requireDroneBridgeAuth, CameraController.ingestFrame);
cameraRouter.post('/status', requireDroneBridgeAuth, CameraController.updateStatus);

export { cameraRouter };

