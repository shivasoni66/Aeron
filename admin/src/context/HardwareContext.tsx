import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchOverview } from '../services/api';
import { subscribeToDroneTelemetry } from '../services/socket';
import { OverviewData, TelemetryData, HardwareDeviceData, AircraftReadiness, DroneData } from '../types';

export type AuthoritativeHardwareState = 'CONNECTED' | 'AWAITING HARDWARE' | 'SIMULATION' | 'OFFLINE';

interface HardwareContextType {
  data: OverviewData | null;
  drone: DroneData | null;
  latestTelemetry: TelemetryData | null;
  devices: HardwareDeviceData[];
  readiness: AircraftReadiness | null;
  protocol: OverviewData['protocol'] | null;
  isOnline: boolean;
  hardwareState: AuthoritativeHardwareState;
  hardwareStatusLabel: string;
  loading: boolean;
  refreshHardware: () => Promise<void>;
}

const HardwareContext = createContext<HardwareContextType | undefined>(undefined);

export const HardwareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshHardware = useCallback(async () => {
    try {
      const overview = await fetchOverview();
      if (overview) {
        setData(overview);
        if (overview.latestTelemetry) {
          setLatestTelemetry(overview.latestTelemetry);
        }
      }
    } catch (err) {
      console.warn('[HardwareContext] Failed to load overview data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    refreshHardware();

    // Listen to real-time telemetry packets via authenticated Socket.IO room
    const cleanupSocket = subscribeToDroneTelemetry('AERON-HEX-01', (packet: any) => {
      if (isMounted && packet) {
        setLatestTelemetry((prev) => ({ ...prev, ...packet }));
      }
    });

    const pollInterval = setInterval(() => {
      if (isMounted) {
        refreshHardware();
      }
    }, 15000);

    return () => {
      isMounted = false;
      cleanupSocket();
      clearInterval(pollInterval);
    };
  }, [refreshHardware]);

  const tel = latestTelemetry;
  const isOnline = !!tel && (Date.now() - new Date(tel.recordedAt || tel.receivedAt || 0).getTime()) < 30000;

  let hardwareState: AuthoritativeHardwareState = 'OFFLINE';
  let hardwareStatusLabel = 'Awaiting hardware';

  if (isOnline) {
    if (tel?.isSimulated) {
      hardwareState = 'SIMULATION';
      hardwareStatusLabel = 'Bench simulation active';
    } else {
      hardwareState = 'CONNECTED';
      hardwareStatusLabel = 'Pixhawk 2.4.8 connected';
    }
  } else {
    hardwareState = 'AWAITING HARDWARE';
    hardwareStatusLabel = 'Awaiting hardware (Standby)';
  }

  return (
    <HardwareContext.Provider
      value={{
        data,
        drone: data?.drone || null,
        latestTelemetry,
        devices: data?.hardwareDevices || [],
        readiness: data?.readiness || null,
        protocol: data?.protocol || null,
        isOnline,
        hardwareState,
        hardwareStatusLabel,
        loading,
        refreshHardware,
      }}
    >
      {children}
    </HardwareContext.Provider>
  );
};

export const useHardware = (): HardwareContextType => {
  const context = useContext(HardwareContext);
  if (!context) {
    throw new Error('useHardware must be used within a HardwareProvider');
  }
  return context;
};

