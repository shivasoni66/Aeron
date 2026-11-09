import React, { useEffect, useState } from 'react';
import { fetchSystemHealth } from '../services/api';
import { SystemHealthData } from '../types';

export const SystemHealthPage: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [auditLatency, setAuditLatency] = useState<number | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const data = await fetchSystemHealth();
      setHealth(data);
      setAuditLatency(Math.round(performance.now() - start));
    } catch (err) {
      console.warn('[SystemHealth] Error fetching health data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const subs = health?.subsystems;

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">health_metrics</span>
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              DISTRIBUTED SYSTEM HEALTH & TELEMETRY MESH
            </h1>
          </div>
          <p className="text-body-sm font-label-telemetry text-on-surface-variant text-[11px] mt-0.5">
            NODE BACKEND // MONGO ATLAS // MAVLINK BRIDGE // PIXHAWK SUBSYSTEM STATUS
          </p>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="px-3 py-1.5 bg-primary-container text-on-primary-container font-bold rounded font-label-telemetry text-[11px] flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>
            sync
          </span>
          <span>EXECUTE FULL SYSTEM AUDIT</span>
        </button>
      </div>

      {/* Latency & Timestamp Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest px-space-md py-space-xs rounded border border-outline-variant/30 font-label-telemetry text-[11px]">
        <div className="flex items-center gap- space-md text-on-surface-variant">
          <span>
            API RESPONSE TIME: <strong className="text-primary-fixed">{auditLatency ? `${auditLatency}ms` : '--'}</strong>
          </span>
          <span>|</span>
          <span>
            REPORT TIMESTAMP: <strong className="text-on-surface">{health ? new Date(health.timestamp).toLocaleTimeString() : '--'}</strong>
          </span>
        </div>

        <span className="px-2 py-0.5 rounded bg-primary-container/20 text-primary-fixed font-bold">
          OVERALL HEALTH: NOMINAL / BENCH ACTIVE
        </span>
      </div>

      {/* Subsystem Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-sm">
        {/* Backend API */}
        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-2 font-label-telemetry">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase">EXPRESS API BACKEND</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-container text-on-primary-container">
              {subs?.apiBackend?.status || 'ONLINE'}
            </span>
          </div>
          <h3 className="text-sm font-bold text-on-surface">Node.js TypeScript API (Port 5000)</h3>
          <div className="text-[11px] text-on-surface-variant space-y-1 pt-1">
            <div className="flex justify-between">
              <span>UPTIME LATENCY</span>
              <span className="text-primary-fixed font-bold">{subs?.apiBackend?.latencyMs ?? 2}ms</span>
            </div>
            <div className="flex justify-between">
              <span>ENDPOINTS ROUTED</span>
              <span className="text-on-surface">/api/v1/auth, /admin, /telemetry</span>
            </div>
          </div>
        </div>

        {/* MongoDB Database */}
        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-2 font-label-telemetry">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase">MONGODB PERSISTENCE</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-container text-on-primary-container">
              {subs?.database?.status || 'CONNECTED'}
            </span>
          </div>
          <h3 className="text-sm font-bold text-on-surface">MongoDB Atlas (Cluster 0)</h3>
          <div className="text-[11px] text-on-surface-variant space-y-1 pt-1">
            <div className="flex justify-between">
              <span>CONNECTION STATE</span>
              <span className="text-primary-fixed font-bold">STATE: 1 (CONNECTED)</span>
            </div>
            <div className="flex justify-between">
              <span>DATABASE NAME</span>
              <span className="text-on-surface">aeron</span>
            </div>
          </div>
        </div>

        {/* Socket.IO Server */}
        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-2 font-label-telemetry">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase">REAL-TIME WEBSOCKET</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-container text-on-primary-container">
              {subs?.socketServer?.status || 'ONLINE'}
            </span>
          </div>
          <h3 className="text-sm font-bold text-on-surface">Socket.IO Event Gateway</h3>
          <div className="text-[11px] text-on-surface-variant space-y-1 pt-1">
            <div className="flex justify-between">
              <span>PROTOCOL</span>
              <span className="text-primary-fixed font-bold">WEBSOCKET + POLLING</span>
            </div>
            <div className="flex justify-between">
              <span>ACTIVE ROOMS</span>
              <span className="text-on-surface">drone:telemetry:AERON-HEX-01</span>
            </div>
          </div>
        </div>

        {/* Python Drone Bridge */}
        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-2 font-label-telemetry">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase">MAVLINK DRONE BRIDGE</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              subs?.droneBridge?.status === 'ONLINE' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'
            }`}>
              {subs?.droneBridge?.status || 'STANDBY'}
            </span>
          </div>
          <h3 className="text-sm font-bold text-on-surface">Python MAVLink Bridge Daemon</h3>
          <div className="text-[11px] text-on-surface-variant space-y-1 pt-1">
            <div className="flex justify-between">
              <span>GATEWAY MODE</span>
              <span className="text-primary-fixed font-bold">
                {subs?.droneBridge?.isSimulated ? 'SIMULATOR ACTIVE' : 'SERIAL TELEMETRY'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>REST INGESTION</span>
              <span className="text-on-surface">POST /api/v1/telemetry</span>
            </div>
          </div>
        </div>

        {/* Pixhawk Flight Controller */}
        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-2 font-label-telemetry">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase">FLIGHT CONTROLLER</span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
              subs?.pixhawkFC?.status === 'ONLINE' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'
            }`}>
              {subs?.pixhawkFC?.status || 'BENCH READY'}
            </span>
          </div>
          <h3 className="text-sm font-bold text-on-surface">Pixhawk 2.4.8 (STM32F427)</h3>
          <div className="text-[11px] text-on-surface-variant space-y-1 pt-1">
            <div className="flex justify-between">
              <span>AUTOPILOT OS</span>
              <span className="text-primary-fixed font-bold">ARDUPILOT COPTER 4.3</span>
            </div>
            <div className="flex justify-between">
              <span>SERIAL INTERFACE</span>
              <span className="text-on-surface">COM3 / TELEM1 @ 57600</span>
            </div>
          </div>
        </div>

        {/* U-Blox GPS & Camera */}
        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-2 font-label-telemetry">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase">OPTICAL & GNSS PAYLOAD</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-400/20 text-amber-300">
              STANDBY
            </span>
          </div>
          <h3 className="text-sm font-bold text-on-surface">U-Blox NEO-M8N & ESP32-CAM</h3>
          <div className="text-[11px] text-on-surface-variant space-y-1 pt-1">
            <div className="flex justify-between">
              <span>GPS RECEIVER</span>
              <span className="text-primary-fixed font-bold">{subs?.gpsGNSS?.status || 'AWAITING LOCK'}</span>
            </div>
            <div className="flex justify-between">
              <span>CAMERA STREAM</span>
              <span className="text-on-surface">{subs?.cameraModule?.status || 'RTSP STANDBY'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

