import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { AdminController } from '../controllers/admin.controller.js';
import { CameraController } from '../controllers/camera.controller.js';
import { requireAuthentication, requireRole } from '../middleware/auth.middleware.js';

const adminRouter = Router();

// Apply administrative authentication and role requirement to all admin routes
adminRouter.use(requireAuthentication, requireRole('admin'));

// Administrative user provisioning endpoint
adminRouter.post('/users', AuthController.provisionUser);

// Drone Intelligence & Telemetry Read Endpoints
adminRouter.get('/overview', AdminController.getOverview);
adminRouter.get('/drones', AdminController.listDrones);
adminRouter.get('/drones/:droneId', AdminController.getDrone);
adminRouter.get('/drones/:droneId/telemetry/latest', AdminController.getLatestTelemetry);
adminRouter.get('/drones/:droneId/telemetry/history', AdminController.getTelemetryHistory);
adminRouter.get('/drones/:droneId/hardware', AdminController.getDroneHardware);
adminRouter.get('/flights', AdminController.listFlights);
adminRouter.get('/flights/:flightSessionId', AdminController.getFlightDetails);
adminRouter.get('/events', AdminController.listEvents);
adminRouter.get('/system/health', AdminController.getSystemHealth);

// Camera Subsystem Read Endpoints
adminRouter.get('/drones/:droneId/camera/status', CameraController.getCameraStatus);
adminRouter.get('/drones/:droneId/camera/preview/latest', CameraController.getLatestPreview);

export { adminRouter };

