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
managerRouter.get('/incidents/:incidentId', ManagerController.getIncidentById);
managerRouter.patch('/incidents/:incidentId', ManagerController.updateIncident);

// Trip & Route History (Flight Sessions)
managerRouter.get('/flights', ManagerController.getFlights);
managerRouter.get('/flights/:flightSessionId', ManagerController.getFlightById);

// Mission Outcomes & Citizen Publishing Pipeline
managerRouter.get('/outcomes', ManagerController.getOutcomes);
managerRouter.get('/outcomes/:outcomeId', ManagerController.getOutcomeById);
managerRouter.post('/outcomes/:outcomeId/review', ManagerController.reviewOutcome);
managerRouter.post('/outcomes/:outcomeId/publish', ManagerController.publishOutcome);

// Reports & Operational Analytics
managerRouter.get('/analytics/overview', ManagerController.getAnalyticsOverview);

// Aircraft Assignment Registry
managerRouter.get('/drones/available', ManagerController.getAvailableDrones);

// Citizen Civic Reports Intake & Triage
managerRouter.get('/citizen-reports', ManagerController.getCitizenReports);
managerRouter.patch('/citizen-reports/:reportId', ManagerController.updateCitizenReport);

export { managerRouter };

