import { Router } from 'express';
import { requireAuthentication, requireRole } from '../middleware/auth.middleware.js';
import { citizenController } from '../controllers/citizen.controller.js';

const citizenRouter = Router();

// Protect all citizen endpoints with authentication & role check
// Citizens and Admins are permitted; managers blocked
citizenRouter.use(requireAuthentication);
citizenRouter.use(requireRole('citizen', 'admin'));

// Civic Reports
citizenRouter.post('/reports', citizenController.createReport);
citizenRouter.get('/reports', citizenController.getMyReports);
citizenRouter.get('/reports/:reportId', citizenController.getReportById);

// Profile
citizenRouter.get('/profile', citizenController.getProfile);
citizenRouter.patch('/profile', citizenController.updateProfile);

// Notifications
citizenRouter.get('/notifications', citizenController.getNotifications);
citizenRouter.patch('/notifications/:notificationId/read', citizenController.markNotificationRead);
citizenRouter.post('/notifications/read-all', citizenController.markAllNotificationsRead);

// Achievements / Contribution Ledger
citizenRouter.get('/achievements', citizenController.getAchievements);

// Media / Photographic Evidence Upload
citizenRouter.post('/media/upload', citizenController.uploadEvidence);

export { citizenRouter };

