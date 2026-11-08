import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { MissionDashboardPage } from './pages/MissionDashboardPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<MissionDashboardPage />} />
          <Route path="all-missions" element={<div className="p-8 font-label-telemetry text-primary-fixed">ALL MISSIONS CATALOG</div>} />
          <Route path="live-mission-control" element={<div className="p-8 font-label-telemetry text-primary-fixed">LIVE MISSION CONTROL [TACTICAL GCS]</div>} />
          <Route path="civic-issue-verification" element={<div className="p-8 font-label-telemetry text-primary-fixed">M01 // CIVIC ISSUE VERIFICATION</div>} />
          <Route path="crowd-safety" element={<div className="p-8 font-label-telemetry text-primary-fixed">M02 // CROWD SAFETY & AERIAL MESH</div>} />
          <Route path="micro-climate-monitoring" element={<div className="p-8 font-label-telemetry text-primary-fixed">M03 // MICRO-CLIMATE & HEAT ISLAND</div>} />
          <Route path="search-and-rescue" element={<div className="p-8 font-label-telemetry text-primary-fixed">M04 // SUBTERRANEAN SEARCH & RESCUE</div>} />
          <Route path="*" element={<div className="p-8 font-label-telemetry text-on-surface-variant">MODULE INITIALIZED — STANDING BY</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;

