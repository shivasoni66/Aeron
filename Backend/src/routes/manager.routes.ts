import { Router } from 'express';
import { requireAuthentication, requireRole } from '../middleware/auth.middleware.js';
import { ManagerController } from '../controllers/manager.controller.js';

const managerRouter = Router();

// Strict RBAC: Accessible by 'manager' and 'admin' roles only. 'citizen' accounts are strictly rejected.
managerRouter.use(requireAuthentication);
managerRouter.use(requireRole('manager', 'admin'));

// Operations Dashboard
managerRouter.get('/dashboard', ManagerController.getDashboard);

// Mission Catalog & Lifecycle
managerRouter.get('/missions', ManagerController.getMissions);
managerRouter.post('/missions', ManagerController.createMission);
managerRouter.get('/missions/:missionId', ManagerController.getMissionById);
managerRouter.patch('/missions/:missionId', ManagerController.updateMission);
managerRouter.post('/missions/:missionId/events', ManagerController.createMissionEvent);

// Incident Management
managerRouter.get('/incidents', ManagerController.getIncidents);
managerRouter.post('/incidents', ManagerController.createIncident);
managerRouter.get('/incidents/:incidentId', ManagerController.getIncidentById);
managerRouter.patch('/incidents/:incidentId', ManagerController.updateIncident);

// Trip & Route History (Flight Sessions)
managerRouter.get('/flights', ManagerController.getFlights);
managerRouter.post('/flights', ManagerController.createFlight);
managerRouter.get('/flights/:flightSessionId', ManagerController.getFlightById);
managerRouter.patch('/flights/:flightSessionId', ManagerController.updateFlight);

// Mission Outcomes & Citizen Publishing Pipeline
managerRouter.get('/outcomes', ManagerController.getOutcomes);
managerRouter.get('/outcomes/:outcomeId', ManagerController.getOutcomeById);
managerRouter.post('/outcomes/:outcomeId/review', ManagerController.reviewOutcome);
managerRouter.post('/outcomes/:outcomeId/publish', ManagerController.publishOutcome);

// Reports & Operational Analytics
managerRouter.get('/analytics/overview', ManagerController.getAnalyticsOverview);

// Aircraft Assignment Registry
managerRouter.get('/drones/available', ManagerController.getAvailableDrones);
managerRouter.get('/drones/:droneId/telemetry/latest', ManagerController.getDroneLatestTelemetry);

// Citizen Civic Reports Intake & Triage
managerRouter.get('/citizen-reports', ManagerController.getCitizenReports);
managerRouter.patch('/citizen-reports/:reportId', ManagerController.updateCitizenReport);

// Central Mission Control & Operating Mode
managerRouter.get('/mission-control/state', ManagerController.getMissionControlState);
managerRouter.post('/mission-control/mode', ManagerController.setOperatingMode);
managerRouter.post('/mission-control/activate', ManagerController.activateMissionControl);
managerRouter.post('/mission-control/pause', ManagerController.pauseMissionControl);
managerRouter.post('/mission-control/resume', ManagerController.resumeMissionControl);
managerRouter.post('/mission-control/stop', ManagerController.stopMissionControl);

// Live AI Observations & Environmental Monitoring
managerRouter.get('/observations', ManagerController.getObservations);
managerRouter.patch('/observations/:id/review', ManagerController.reviewObservation);
managerRouter.get('/environmental/latest', ManagerController.getEnvironmentalLatest);
managerRouter.get('/environmental/bhopal', ManagerController.getBhopalMicroClimate);

export { managerRouter };

