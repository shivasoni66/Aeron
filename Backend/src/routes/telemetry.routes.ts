import { Router } from 'express';
import { TelemetryController } from '../controllers/telemetry.controller.js';
import { requireDroneBridgeAuth } from '../middleware/machineAuth.middleware.js';

const telemetryRouter = Router();

// Machine-to-Machine authenticated telemetry ingestion
telemetryRouter.post('/ingest', requireDroneBridgeAuth, TelemetryController.ingest);

// Read latest telemetry for a specific airframe
telemetryRouter.get('/latest/:droneId', TelemetryController.getLatest);

export { telemetryRouter };

