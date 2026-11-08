import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DroneOverviewPage } from './pages/DroneOverviewPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<DroneOverviewPage />} />
          <Route path="live-telemetry" element={<div className="p-8 font-label-telemetry text-primary-fixed">LIVE TELEMETRY MODULE [READY FOR STREAM]</div>} />
          <Route path="hardware-and-sensors" element={<div className="p-8 font-label-telemetry text-primary-fixed">HARDWARE & SENSORS BENCH</div>} />
          <Route path="*" element={<div className="p-8 font-label-telemetry text-on-surface-variant">MODULE INITIALIZED — STANDING BY</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;

