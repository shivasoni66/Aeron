import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { fetchDashboard } from '../services/api';
import { subscribeToManagerBroadcasts } from '../services/socket';
import { DashboardData } from '../types';

interface ManagerOperationsContextType {
  dashboardData: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  activeMissionsCount: number;
  openIncidentsCount: number;
  refreshDashboard: () => Promise<void>;
}

const ManagerOperationsContext = createContext<ManagerOperationsContextType | undefined>(undefined);

export const ManagerOperationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<number>(0);

  const refreshDashboard = useCallback(async () => {
    const currentReq = ++requestIdRef.current;
    try {
      const data = await fetchDashboard();
      if (currentReq === requestIdRef.current) {
        setDashboardData(data);
        setError(null);
      }
    } catch (err: unknown) {
      if (currentReq === requestIdRef.current) {
        setDashboardData((prev) => {
          if (!prev) {
            setError(err instanceof Error ? err.message : 'Failed to synchronize mission operations');
          }
          return prev;
        });
      }
    } finally {
      if (currentReq === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshDashboard();

    const cleanup = subscribeToManagerBroadcasts({
      onMissionCreated: () => refreshDashboard(),
      onMissionUpdated: () => refreshDashboard(),
      onIncidentUpdated: () => refreshDashboard(),
      onOutcomeReviewed: () => refreshDashboard(),
      onOutcomePublished: () => refreshDashboard()
    });

    const interval = setInterval(refreshDashboard, 15000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [refreshDashboard]);

  // Authoritative single-source metrics
  const activeMissionsCount = dashboardData?.overview?.activeMissions ?? 0;
  const openIncidentsCount = dashboardData?.overview?.openIncidents ?? 0;

  return (
    <ManagerOperationsContext.Provider
      value={{
        dashboardData,
        isLoading,
        error,
        activeMissionsCount,
        openIncidentsCount,
        refreshDashboard
      }}
    >
      {children}
    </ManagerOperationsContext.Provider>
  );
};

export const useManagerOperations = (): ManagerOperationsContextType => {
  const context = useContext(ManagerOperationsContext);
  if (!context) {
    throw new Error('useManagerOperations must be used within a ManagerOperationsProvider');
  }
  return context;
};

