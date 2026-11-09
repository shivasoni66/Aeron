import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';

import { DroneOverviewPage } from './pages/DroneOverviewPage';
import { LiveTelemetryPage } from './pages/LiveTelemetryPage';
import { HardwareSensorsPage } from './pages/HardwareSensorsPage';
import { LiveCameraPage } from './pages/LiveCameraPage';
import { GPSTrackingPage } from './pages/GPSTrackingPage';
import { FlightAnalyticsPage } from './pages/FlightAnalyticsPage';
import { FlightHistoryPage } from './pages/FlightHistoryPage';
import { FlightLogsPage } from './pages/FlightLogsPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { DroneConfigurationPage } from './pages/DroneConfigurationPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<DroneOverviewPage />} />
              <Route path="live-telemetry" element={<LiveTelemetryPage />} />
              <Route path="hardware-and-sensors" element={<HardwareSensorsPage />} />
              <Route path="live-camera" element={<LiveCameraPage />} />
              <Route path="gps-tracking" element={<GPSTrackingPage />} />
              <Route path="flight-analytics" element={<FlightAnalyticsPage />} />
              <Route path="flight-history" element={<FlightHistoryPage />} />
              <Route path="flight-logs" element={<FlightLogsPage />} />
              <Route path="system-health" element={<SystemHealthPage />} />
              <Route path="drone-configuration" element={<DroneConfigurationPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
