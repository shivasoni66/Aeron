import React, { useState } from 'react';
import { activeTelemetryProvider, SimulationTelemetryProvider } from '../providers/telemetryProvider';

interface SimulatorControlWidgetProps {
  onScenarioChange?: (scenario: string) => void;
  className?: string;
}

export const SimulatorControlWidget: React.FC<SimulatorControlWidgetProps> = ({
  onScenarioChange,
  className = ''
}) => {
  const isSimulation = activeTelemetryProvider.dataSource === 'SIMULATION';
  const simProvider = activeTelemetryProvider instanceof SimulationTelemetryProvider ? activeTelemetryProvider : null;

  const [activeScenario, setActiveScenario] = useState<string>('SLOW_ROUTE');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const scenarios = [
    { id: 'SLOW_ROUTE', label: 'Slow Flight Corridor (Default)' },
    { id: 'STATIONARY_BENCH', label: 'Stationary Bench Calibration' },
    { id: 'GPS_ACQUISITION', label: 'GNSS Satellite Lock Acquisition' },
    { id: 'WAYPOINT_PROGRESSION', label: 'Autonomous Waypoint Sortie (5 WP)' },
    { id: 'BATTERY_CONSUMPTION', label: '4S LiPo Drain & RTL Failsafe' },
    { id: 'CONNECTION_LOSS', label: 'Telemetry Link Dropout & Hold' },
    { id: 'STALE_TELEMETRY', label: 'RF Jammer / Stale Buffer' },
    { id: 'RECONNECTION', label: 'Link Reconnect & Resync' }
  ];

  const handleScenarioSelect = async (scenarioId: string) => {
    setActiveScenario(scenarioId);
    if (simProvider) {
      const ok = await simProvider.setScenario(scenarioId);
      if (ok) {
        setNotice(`Simulator switched to scenario: ${scenarioId}`);
      }
    }
    if (onScenarioChange) onScenarioChange(scenarioId);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleTogglePause = async () => {
    if (!simProvider) return;
    if (isPaused) {
      await simProvider.resumeSimulation();
      setIsPaused(false);
      setNotice('Simulation resumed.');
    } else {
      await simProvider.pauseSimulation();
      setIsPaused(true);
      setNotice('Simulation paused at current coordinates.');
    }
    setTimeout(() => setNotice(null), 3000);
  };

  const handleReset = async () => {
    if (!simProvider) return;
    await simProvider.resetSimulation();
    setIsPaused(false);
    setNotice('Simulator reset to scenario baseline.');
    setTimeout(() => setNotice(null), 3000);
  };

  if (!isSimulation) {
    return (
      <div className={`p-3 bg-surface rounded-xl border border-border text-xs flex items-center justify-between font-mono ${className}`}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-success" />
          <span className="text-text-primary font-bold">DATA SOURCE: REAL_HARDWARE</span>
        </div>
        <span className="text-text-muted text-[11px]">Pixhawk MAVLink Telemetry</span>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-surface rounded-xl border border-border shadow-sm space-y-3 font-sans text-xs ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-caution-amber animate-pulse" />
          <span className="font-bold text-text-primary uppercase tracking-wider font-mono text-[11px]">
            Simulator Bench Control
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-caution-amber/15 text-caution-amber border border-caution-amber/30">
            PROVENANCE: SIMULATION
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <button
            onClick={handleTogglePause}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all border ${
              isPaused
                ? 'bg-success/20 text-success border-success/40 hover:bg-success/30'
                : 'bg-caution-amber/20 text-caution-amber border-caution-amber/40 hover:bg-caution-amber/30'
            }`}
          >
            {isPaused ? '▶ RESUME' : '❚❚ PAUSE'}
          </button>
          <button
            onClick={handleReset}
            className="px-2.5 py-1 rounded-md bg-surface-elevated hover:bg-surface border border-border text-text-muted hover:text-text-primary text-[11px] transition-colors"
            title="Reset to scenario origin"
          >
            RESET
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-2 rounded-lg bg-surface-elevated border border-border text-aeron-lime font-mono text-[11px]">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        <div>
          <label className="text-text-muted block text-[10px] font-mono uppercase mb-1">
            Deterministic Scenario
          </label>
          <select
            value={activeScenario}
            onChange={(e) => handleScenarioSelect(e.target.value)}
            className="w-full bg-surface-elevated px-2.5 py-1.5 rounded-lg border border-border text-text-primary text-xs focus:border-aeron-lime outline-none font-mono"
          >
            {scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 text-[11px] font-mono text-text-secondary pt-3 sm:pt-0">
          <div>
            <span className="text-text-muted block text-[10px]">INGESTION RATE</span>
            <span className="text-telemetry-cyan font-bold">5.0 HZ (200MS)</span>
          </div>
          <div>
            <span className="text-text-muted block text-[10px]">FC SAFETY LOCK</span>
            <span className="text-aeron-lime font-bold">READ-ONLY</span>
          </div>
        </div>
      </div>
    </div>
  );
};

