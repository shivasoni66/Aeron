import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { fetchDashboard } from '../services/api';
import { subscribeToManagerBroadcasts } from '../services/socket';

export const DashboardLayout: React.FC = () => {
  const [activeMissionsCount, setActiveMissionsCount] = useState<number>(0);
  const [openIncidentsCount, setOpenIncidentsCount] = useState<number>(0);

  const loadCounts = async () => {
    try {
      const data = await fetchDashboard();
      if (data?.overview) {
        setActiveMissionsCount(data.overview.activeMissions || 0);
        setOpenIncidentsCount(data.overview.openIncidents || 0);
      }
    } catch {
      // Quiet background failure
    }
  };

  useEffect(() => {
    loadCounts();

    const cleanup = subscribeToManagerBroadcasts({
      onMissionCreated: () => loadCounts(),
      onMissionUpdated: () => loadCounts(),
      onIncidentUpdated: () => loadCounts(),
      onOutcomeReviewed: () => loadCounts(),
      onOutcomePublished: () => loadCounts()
    });

    const interval = setInterval(loadCounts, 12000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-surface selection:bg-primary-container selection:text-on-primary-container">
      <Sidebar />
      <div className="pl-72 flex flex-col min-h-screen">
        <Header activeMissionsCount={activeMissionsCount} openIncidentsCount={openIncidentsCount} />
        <main className="w-full pt-16 px-space-lg py-space-lg bg-background min-h-screen flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
