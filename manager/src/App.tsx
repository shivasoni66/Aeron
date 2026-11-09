import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { MissionDashboardPage } from './pages/MissionDashboardPage';
import { AllMissionsPage } from './pages/AllMissionsPage';
import { LiveMissionControlPage } from './pages/LiveMissionControlPage';
import { CivicIssueVerificationPage } from './pages/CivicIssueVerificationPage';
import { CrowdSafetyPage } from './pages/CrowdSafetyPage';
import { MicroClimatePage } from './pages/MicroClimatePage';
import { SearchAndRescuePage } from './pages/SearchAndRescuePage';
import { TripRouteHistoryPage } from './pages/TripRouteHistoryPage';
import { IncidentManagementPage } from './pages/IncidentManagementPage';
import { MissionOutcomesPage } from './pages/MissionOutcomesPage';
import { ReportsAnalyticsPage } from './pages/ReportsAnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Authenticated Manager Command Deck */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<MissionDashboardPage />} />
            <Route path="all-missions" element={<AllMissionsPage />} />
            <Route path="live-mission-control" element={<LiveMissionControlPage />} />
            <Route path="civic-issue-verification" element={<CivicIssueVerificationPage />} />
            <Route path="crowd-safety" element={<CrowdSafetyPage />} />
            <Route path="micro-climate-monitoring" element={<MicroClimatePage />} />
            <Route path="search-and-rescue" element={<SearchAndRescuePage />} />
            <Route path="trip-and-route-history" element={<TripRouteHistoryPage />} />
            <Route path="incident-management" element={<IncidentManagementPage />} />
            <Route path="mission-outcomes" element={<MissionOutcomesPage />} />
            <Route path="reports-and-analytics" element={<ReportsAnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
