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
    <div className="flex flex-col w-full gap-space-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm">
            <span className="font-label-telemetry text-label-telemetry text-secondary">M04 // SUBTERRANEAN SEARCH & RESCUE</span>
            <span className="px-2 py-0.5 rounded bg-error-container/40 text-error font-label-telemetry text-[10px] font-bold">
              CLASSIFIED OPS
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-0.5">
            SUBTERRANEAN SEARCH & RESCUE COMMAND
          </h1>
          <p className="font-body-sm text-secondary text-xs">
            Culvert navigation drills, mock survivor beacon localization, and mission evidence quarantine.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-space-lg py-2.5 rounded-full bg-secondary text-on-secondary font-label-pill text-xs font-bold flex items-center gap-2 hover:opacity-90 shadow-md shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>INITIALIZE SAR SORTIE +</span>
        </button>
      </div>

      {/* Module Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
        <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40">
          <span className="font-label-telemetry text-[11px] text-outline uppercase">SAR SORTIES</span>
          <div className="text-2xl font-bold font-headline-md text-primary mt-1">{missions.length}</div>
          <span className="text-[11px] font-label-telemetry text-secondary">
            {missions.filter((m) => m.status === 'ACTIVE').length} CURRENTLY DEPLOYED
          </span>
        </div>

        <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40">
          <span className="font-label-telemetry text-[11px] text-outline uppercase">OPEN SAR DISTRESS INCIDENTS</span>
          <div className="text-2xl font-bold font-headline-md text-primary mt-1">{incidents.length}</div>
          <span className="text-[11px] font-label-telemetry text-error">AIR-GAPPED BEACON TARGETS</span>
        </div>
      </div>

      {/* Survivor Confidentiality Protection Notice */}
      <div className="p-space-md rounded bg-surface-container-low border border-error/40 flex items-start gap-3">
        <span className="material-symbols-outlined text-error text-[22px] shrink-0">lock</span>
        <div className="font-label-telemetry text-xs space-y-1">
          <span className="text-error font-bold block uppercase">CONFIDENTIALITY & SURVIVOR PRIVACY MANDATE:</span>
          <p className="text-on-surface-variant font-body-sm text-xs">
            Subterranean SAR coordinates and survivor identification data are strictly confidential (<code className="text-error">isConfidential = true</code>). Under no circumstances are rescue coordinates broadcast to public citizen feeds. Point-cloud and acoustic sensor telemetry are displayed only when physical payloads are verified.
          </p>
        </div>
      </div>

      {/* Missions in this module */}
      <div className="p-space-lg rounded bg-surface-container-low border border-surface-variant/40 shadow-xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-surface-variant">
          <h3 className="font-headline-md text-base text-primary">M04 SEARCH & RESCUE MISSIONS</h3>
          <span className="font-label-telemetry text-xs text-outline">{missions.length} MISSIONS LOGGED</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-outline font-label-telemetry text-xs animate-pulse">
            LOADING SEARCH & RESCUE SORTIES...
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-8 text-outline font-label-telemetry text-xs">
            NO SEARCH & RESCUE MISSIONS CURRENTLY LOGGED
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((m) => (
              <div
                key={m._id}
                className="p-space-md rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col md:flex-row md:items-center justify-between gap-3 font-label-telemetry text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-secondary font-bold">{m.missionId}</span>
                    <span className="text-outline">|</span>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-bold text-[10px]">
                      {m.status}
                    </span>
                    <span className="text-outline text-[11px]">STAGE {m.stage}/8 ({m.stageLabel})</span>
                    <span className="px-1.5 py-0.5 rounded bg-error-container/30 text-error text-[9px] font-bold">
                      CONFIDENTIAL
                    </span>
                  </div>
                  <h4 className="font-headline-md text-sm text-primary mt-1">{m.title}</h4>
                  <p className="text-outline text-xs mt-0.5">{m.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-outline">ASSIGNED AIRFRAME</div>
                    <div className="text-primary-fixed font-bold">{m.assignedDrones?.[0]?.droneId || 'STANDBY'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateMissionModal
        isOpen={isCreateOpen}
        defaultCategory="SUBTERRANEAN_SEARCH_RESCUE"
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};

