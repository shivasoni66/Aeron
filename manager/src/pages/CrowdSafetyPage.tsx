import React, { useEffect, useState } from 'react';
import { fetchMissions, fetchIncidents } from '../services/api';
import { MissionData, IncidentData } from '../types';
import { CreateMissionModal } from '../components/CreateMissionModal';

export const CrowdSafetyPage: React.FC = () => {
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mRes, iRes] = await Promise.all([
        fetchMissions({ category: 'CROWD_SAFETY', limit: 15 }),
        fetchIncidents({ category: 'CROWD_SAFETY', limit: 10 })
      ]);
      setMissions(mRes.missions || []);
      setIncidents(iRes.incidents || []);
    } catch (err: unknown) {
      console.warn(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-surface rounded-xl border border-border border-l-4 border-l-telemetry-cyan shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-telemetry-cyan text-[24px]">groups</span>
            <span className="font-sans text-xs text-telemetry-cyan uppercase tracking-wider font-semibold">M02 • Crowd Safety & Aerial Mesh</span>
            <span className="px-2 py-0.5 rounded bg-telemetry-cyan/15 text-telemetry-cyan border border-telemetry-cyan/30 font-sans text-[11px] font-medium">
              Operational
            </span>
          </div>
          <h1 className="font-sans font-bold text-lg text-text-primary tracking-tight mt-1">
            Crowd Safety & Assembly Monitoring
          </h1>
          <p className="font-sans text-xs text-text-muted mt-0.5 leading-relaxed">
            Multi-drone aerial mesh relay over designated assembly zones with density threshold monitoring and strict facial privacy protection.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-telemetry-cyan text-background font-sans font-bold text-xs rounded-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(53,198,216,0.25)]"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Launch crowd mission</span>
        </button>
      </div>

      {/* Module Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-text-muted uppercase font-sans tracking-wider">CROWD SORTIES</span>
            <div className="text-2xl font-bold text-text-primary font-sans">{missions.length}</div>
            <span className="text-[11px] text-telemetry-cyan">
              {missions.filter((m) => m.status === 'ACTIVE').length} ACTIVELY PATROLLING
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-telemetry-cyan/10 border border-telemetry-cyan/20 flex items-center justify-center text-telemetry-cyan">
            <span className="material-symbols-outlined text-[24px]">groups</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-text-muted uppercase font-sans tracking-wider">CROWD DENSITY ANOMALIES</span>
            <div className="text-2xl font-bold text-text-primary font-sans">{incidents.length}</div>
            <span className="text-[11px] text-caution-amber">FLAGGED BY SENSORY CORRIDOR</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-caution-amber/10 border border-caution-amber/20 flex items-center justify-center text-caution-amber">
            <span className="material-symbols-outlined text-[24px]">warning</span>
          </div>
        </div>
      </div>

      {/* Safety Policy & Threshold Note */}
      <div className="p-4 rounded-xl bg-surface border border-border flex items-start gap-3">
        <span className="material-symbols-outlined text-telemetry-cyan text-[22px] shrink-0">policy</span>
        <div className="font-mono text-xs space-y-1">
          <span className="text-telemetry-cyan font-bold block uppercase">DATA INTEGRITY & PRIVACY MANDATE:</span>
          <p className="text-text-secondary font-sans text-xs leading-relaxed">
            AERON monitors choke-point density thresholds only when valid sensor or verified edge inference telemetry is active. Stampede prediction claims are strictly prohibited; density calculations are purely observational.
          </p>
        </div>
      </div>

      {/* Missions in this module */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-4 font-mono text-xs">
        <div className="flex justify-between items-center pb-3 border-b border-border/60">
          <h3 className="font-sans font-bold text-sm text-text-primary tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-telemetry-cyan animate-pulse" />
            <span>Active crowd safety missions</span>
          </h3>
          <span className="text-text-muted font-sans text-xs">{missions.length} missions logged</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-text-muted animate-pulse font-mono text-xs">
            SYNCHRONIZING CROWD SAFETY SORTIES...
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-8 text-text-muted font-mono text-xs">
            NO CROWD SAFETY MISSIONS CURRENTLY LOGGED.
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((m) => (
              <div
                key={m._id}
                className="p-4 rounded-xl bg-surface-elevated border border-border/80 border-l-4 border-l-telemetry-cyan flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-border"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-telemetry-cyan font-bold">{m.missionId}</span>
                    <span className="text-text-muted">|</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.status === 'ACTIVE'
                        ? 'bg-telemetry-cyan/15 text-telemetry-cyan border border-telemetry-cyan/30'
                        : 'bg-surface text-text-muted border border-border'
                    }`}>
                      {m.status}
                    </span>
                    <span className="text-text-secondary text-[11px]">STAGE {m.stage}/8 ({m.stageLabel})</span>
                  </div>
                  <h4 className="font-sans font-bold text-sm text-text-primary">{m.title}</h4>
                  <p className="font-sans text-xs text-text-muted leading-relaxed max-w-3xl">{m.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-text-muted text-[11px] font-mono">
                    AIRFRAME: <strong className="text-text-primary">HEX-01</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateMissionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={loadData}
        defaultCategory="CROWD_SAFETY"
      />
    </div>
  );
};
