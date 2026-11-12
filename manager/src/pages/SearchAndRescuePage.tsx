import React, { useEffect, useState } from 'react';
import { fetchMissions, fetchIncidents } from '../services/api';
import { MissionData, IncidentData } from '../types';
import { CreateMissionModal } from '../components/CreateMissionModal';

export const SearchAndRescuePage: React.FC = () => {
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mRes, iRes] = await Promise.all([
        fetchMissions({ category: 'SUBTERRANEAN_SEARCH_RESCUE', limit: 15 }),
        fetchIncidents({ category: 'SEARCH_RESCUE', limit: 10 })
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
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-surface rounded-xl border border-border border-l-4 border-l-sar-violet shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-sar-violet text-[24px]">person_search</span>
            <span className="font-sans text-xs text-sar-violet uppercase tracking-wider font-semibold">M04 • Subterranean Search & Rescue</span>
            <span className="px-2 py-0.5 rounded bg-sar-violet/15 text-sar-violet border border-sar-violet/30 font-sans text-[11px] font-medium">
              Classified Operations
            </span>
          </div>
          <h1 className="font-sans font-bold text-lg text-text-primary tracking-tight mt-1">
            Subterranean Search & Rescue
          </h1>
          <p className="font-sans text-xs text-text-muted mt-0.5 leading-relaxed">
            Culvert navigation drills, mock survivor beacon localization, and mission evidence quarantine.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-sar-violet text-background font-sans font-bold text-xs rounded-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(167,139,250,0.25)]"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Launch search & rescue mission</span>
        </button>
      </div>

      {/* Module Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-text-muted uppercase font-sans tracking-wider">SAR SORTIES</span>
            <div className="text-2xl font-bold text-text-primary font-sans">{missions.length}</div>
            <span className="text-[11px] text-sar-violet">
              {missions.filter((m) => m.status === 'ACTIVE').length} CURRENTLY DEPLOYED
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-sar-violet/10 border border-sar-violet/20 flex items-center justify-center text-sar-violet">
            <span className="material-symbols-outlined text-[24px]">person_search</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-text-muted uppercase font-sans tracking-wider">OPEN SAR DISTRESS INCIDENTS</span>
            <div className="text-2xl font-bold text-text-primary font-sans">{incidents.length}</div>
            <span className="text-[11px] text-critical-coral">AIR-GAPPED BEACON TARGETS</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-critical-coral/10 border border-critical-coral/20 flex items-center justify-center text-critical-coral">
            <span className="material-symbols-outlined text-[24px]">warning</span>
          </div>
        </div>
      </div>

      {/* Survivor Confidentiality Protection Notice */}
      <div className="p-4 rounded-xl bg-surface border border-sar-violet/40 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-sar-violet/10 border border-sar-violet/20 flex items-center justify-center text-sar-violet shrink-0">
          <span className="material-symbols-outlined text-[22px]">lock</span>
        </div>
        <div className="font-mono text-xs space-y-1">
          <span className="text-sar-violet font-bold block uppercase">CONFIDENTIALITY & SURVIVOR PRIVACY MANDATE:</span>
          <p className="text-text-secondary font-sans text-xs leading-relaxed">
            Subterranean SAR coordinates and survivor identification data are strictly confidential (<code className="text-sar-violet font-mono font-bold">isConfidential = true</code>). Under no circumstances are rescue coordinates broadcast to public citizen feeds. Point-cloud and acoustic telemetry are displayed only when physical payloads are verified.
          </p>
        </div>
      </div>

      {/* Missions in this module */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-4 font-mono text-xs">
        <div className="flex justify-between items-center pb-3 border-b border-border/60">
          <h3 className="font-sans font-bold text-sm text-text-primary tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sar-violet animate-pulse" />
            <span>Active search & rescue missions</span>
          </h3>
          <span className="text-text-muted font-sans text-xs">{missions.length} missions logged</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-text-muted animate-pulse font-mono text-xs">
            SYNCHRONIZING SEARCH & RESCUE SORTIES...
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-8 text-text-muted font-mono text-xs">
            NO SEARCH & RESCUE MISSIONS CURRENTLY LOGGED.
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((m) => (
              <div
                key={m._id}
                className="p-4 rounded-xl bg-surface-elevated border border-border/80 border-l-4 border-l-sar-violet flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-border"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sar-violet font-bold">{m.missionId}</span>
                    <span className="text-text-muted">|</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.status === 'ACTIVE'
                        ? 'bg-sar-violet/15 text-sar-violet border border-sar-violet/30'
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
        defaultCategory="SUBTERRANEAN_SEARCH_RESCUE"
      />
    </div>
  );
};
