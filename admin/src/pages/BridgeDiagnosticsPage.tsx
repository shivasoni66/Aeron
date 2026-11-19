import React from 'react';
import { useHardware } from '../context/HardwareContext';
import { BridgeControllerWidget } from '../components/telemetry/BridgeControllerWidget';
import { LiveEngineeringDiagnosticsPanel } from '../components/telemetry/LiveEngineeringDiagnosticsPanel';
import { BridgeSelfDiagnosticsSuite } from '../components/telemetry/BridgeSelfDiagnosticsSuite';
import { ACTIVE_DRONE_ID } from '../config/drone';

export const BridgeDiagnosticsPage: React.FC = () => {
  const {
    latestTelemetry: tel,
    isOnline,
    hardwareStatusLabel,
    hardwareState,
    protocol,
    transport,
    attitudeHz,
    gpsHz,
    attitudeAgeMs
  } = useHardware();

  // Real-time calculated indicators
  const isWifiConnected = Boolean(transport?.wifi?.connected || (isOnline && transport?.activeSource === 'WIFI'));
  const wifiEndpoint = transport?.wifi?.assignedIp
    ? `${transport.wifi.assignedIp}:5760`
    : transport?.wifi?.endpoint || 'TCP 5760 (Auto-Discovery)';

  const fcTarget = protocol?.targetFC || 'Pixhawk 2.4.8 (STM32F427)';
  const transportMode = (transport?.mode || 'dual').toUpperCase();
  const activeSource = transport?.activeSource || (isOnline ? 'WIFI' : 'NONE');

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] tracking-widest text-aeron-lime bg-surface-elevated px-2 py-0.5 rounded border border-border uppercase font-bold">
              SYSTEM HARDWARE & TELEMETRY
            </span>
            <span className="text-border">•</span>
            <span className="font-mono text-[11px] text-text-muted">
              TARGET: <strong className="text-text-secondary">{ACTIVE_DRONE_ID}</strong>
            </span>
          </div>
          <h1 className="font-sans font-extrabold text-2xl tracking-tight text-text-primary">
            Bridge & Diagnostics
          </h1>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            Local hardware communication, telemetry gateway and engineering diagnostics.
          </p>
        </div>

        {/* Global Connection Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface border border-border shadow-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline
                  ? (tel?.isSimulated ? 'bg-warning animate-pulse' : 'bg-aeron-lime shadow-[0_0_8px_#BFF42E]')
                  : 'bg-text-muted'
              }`}
            />
            <span className="font-sans text-xs font-semibold text-text-primary">
              {hardwareStatusLabel}
            </span>
            <span className="text-border">•</span>
            <span className="font-mono text-[11px] text-accent-primary">
              {transportMode} MODE
            </span>
          </div>
        </div>
      </div>

      {/* Top Telemetry & Bridge Summary Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Telemetry Gateway */}
        <div className="p-4 bg-surface rounded-xl border border-border flex flex-col justify-between space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="font-sans text-xs font-medium">Gateway Transport</span>
            <span className="material-symbols-outlined text-[18px] text-accent-primary">
              router
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-text-primary">
                {activeSource}
              </span>
              <span className="font-sans text-[11px] text-text-muted">
                (Pref: {(transport?.primaryPreference || 'WIFI').toUpperCase()})
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? 'bg-success animate-pulse' : 'bg-text-muted'
                }`}
              />
              <span className="font-sans text-[11px] text-text-secondary truncate">
                {isOnline ? 'Active MAVLink Relay' : 'Bridge Standby / Offline'}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border/40 font-mono text-[10px] text-text-muted">
            Mode: {transportMode} Transport Coordinator
          </div>
        </div>

        {/* Card 2: Pixhawk FC Link */}
        <div className="p-4 bg-surface rounded-xl border border-border flex flex-col justify-between space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="font-sans text-xs font-medium">Flight Controller</span>
            <span className="material-symbols-outlined text-[18px] text-aeron-lime">
              memory
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-text-primary">
                {hardwareState === 'CONNECTED'
                  ? 'CONNECTED'
                  : hardwareState === 'SIMULATION'
                  ? 'SIMULATION'
                  : 'STANDBY'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hardwareState === 'CONNECTED' ? 'bg-aeron-lime' : 'bg-text-muted'
                }`}
              />
              <span className="font-sans text-[11px] text-text-secondary truncate">
                {fcTarget}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border/40 font-mono text-[10px] text-text-muted">
            MAVLink {protocol?.mavlinkVersion || '2.0'} ({protocol?.baudRate ? protocol.baudRate.toLocaleString() : '57,600'} baud)
          </div>
        </div>

        {/* Card 3: ESP32 Wi-Fi Telemetry */}
        <div className="p-4 bg-surface rounded-xl border border-border flex flex-col justify-between space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="font-sans text-xs font-medium">ESP32 Wi-Fi Link</span>
            <span className="material-symbols-outlined text-[18px] text-telemetry-cyan">
              wifi
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-text-primary">
                {isWifiConnected ? 'ONLINE' : (transport?.wifi?.assignedIp ? 'DISCOVERED' : 'STANDBY')}
              </span>
              <span className="font-mono text-[11px] text-telemetry-cyan">
                :5760
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isWifiConnected ? 'bg-telemetry-cyan animate-pulse' : 'bg-text-muted'
                }`}
              />
              <span className="font-sans text-[11px] text-text-secondary truncate">
                {wifiEndpoint}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border/40 font-mono text-[10px] text-text-muted">
            Discovery: {transport?.wifi?.discoveryMethod || 'mDNS / UDP / Fallback'}
          </div>
        </div>

        {/* Card 4: Telemetry Activity & Freshness */}
        <div className="p-4 bg-surface rounded-xl border border-border flex flex-col justify-between space-y-2 shadow-sm">
          <div className="flex items-center justify-between text-text-muted">
            <span className="font-sans text-xs font-medium">Stream Activity</span>
            <span className="material-symbols-outlined text-[18px] text-accent-secondary">
              vital_signs
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-bold text-text-primary">
                {attitudeHz > 0 ? `${attitudeHz.toFixed(1)} Hz` : (isOnline ? 'Active' : '0.0 Hz')}
              </span>
              <span className="font-sans text-[11px] text-text-muted">
                ({gpsHz.toFixed(1)} Hz GPS)
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline && attitudeAgeMs < 1000
                    ? 'bg-success'
                    : isOnline
                    ? 'bg-warning'
                    : 'bg-text-muted'
                }`}
              />
              <span className="font-sans text-[11px] text-text-secondary truncate">
                {isOnline ? `Packet age: ${attitudeAgeMs}ms` : 'Awaiting physical heartbeat'}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-border/40 font-mono text-[10px] text-text-muted truncate">
            Flight Mode: <strong className="text-accent-primary">{tel?.flightMode || protocol?.mode || 'STANDBY'}</strong>
          </div>
        </div>
      </div>

      {/* SECTION 1: AERON Bridge Controller */}
      <section className="space-y-2">
        <BridgeControllerWidget />
      </section>

      {/* SECTION 2: Live Engineering Diagnostics & Telemetry Bench */}
      <section className="space-y-2">
        <LiveEngineeringDiagnosticsPanel />
      </section>

      {/* SECTION 3: 13-Stage Telemetry Bridge Self-Diagnostics */}
      <section className="space-y-2">
        <BridgeSelfDiagnosticsSuite />
      </section>
    </div>
  );
};
