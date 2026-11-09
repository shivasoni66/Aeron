import React, { useEffect, useState } from 'react';
import { fetchMissions, fetchIncidents } from '../services/api';
import { MissionData, IncidentData } from '../types';
import { CreateMissionModal } from '../components/CreateMissionModal';

export const CivicIssueVerificationPage: React.FC = () => {
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mRes, iRes] = await Promise.all([
        fetchMissions({ category: 'CIVIC_ISSUE_VERIFICATION', limit: 15 }),
        fetchIncidents({ category: 'ROAD_STRUCTURAL', limit: 10 })
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
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">M01 // CIVIC VERIFICATION</span>
            <span className="px-2 py-0.5 rounded bg-primary-fixed/20 text-primary-fixed font-label-telemetry text-[10px] font-bold">
              OPERATIONAL
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-0.5">
            CIVIC ISSUE VERIFICATION MODULE
          </h1>
          <p className="font-body-sm text-secondary text-xs">
            Municipal asphalt fissure inspection, illegal dumping detection, and civic report audit workflow.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-space-lg py-2.5 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill text-xs font-bold flex items-center gap-2 shadow-[0_0_16px_rgba(191,244,46,0.3)] shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>LAUNCH CIVIC SORTIE +</span>
        </button>
      </div>

      {/* Module Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40">
          <span className="font-label-telemetry text-[11px] text-outline uppercase">CIVIC SORTIES</span>
          <div className="text-2xl font-bold font-headline-md text-primary mt-1">{missions.length}</div>
          <span className="text-[11px] font-label-telemetry text-primary-fixed">
            {missions.filter((m) => m.status === 'ACTIVE').length} ACTIVELY RUNNING
          </span>
        </div>

        <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40">
          <span className="font-label-telemetry text-[11px] text-outline uppercase">OPEN CIVIC INCIDENTS</span>
          <div className="text-2xl font-bold font-headline-md text-primary mt-1">{incidents.length}</div>
          <span className="text-[11px] font-label-telemetry text-error">PENDING AERIAL VERIFICATION</span>
        </div>

        <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40">
          <span className="font-label-telemetry text-[11px] text-outline uppercase">VERIFICATION WORKFLOW</span>
          <div className="text-2xl font-bold font-headline-md text-primary-fixed mt-1">8-STAGE</div>
          <span className="text-[11px] font-label-telemetry text-outline">STRICT MANUAL SIGN-OFF</span>
        </div>
      </div>

      {/* Active Missions in this module */}
      <div className="p-space-lg rounded bg-surface-container-low border border-surface-variant/40 shadow-xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-surface-variant">
          <h3 className="font-headline-md text-base text-primary">M01 ACTIVE SORTIES</h3>
          <span className="font-label-telemetry text-xs text-outline">{missions.length} MISSIONS LOGGED</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-outline font-label-telemetry text-xs animate-pulse">
            LOADING CIVIC SORTIES...
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-8 text-outline font-label-telemetry text-xs">
            NO CIVIC ISSUE SORTIES LOGGED YET
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
                    <span className="text-primary-fixed font-bold">{m.missionId}</span>
                    <span className="text-outline">|</span>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-bold text-[10px]">
                      {m.status}
                    </span>
                    <span className="text-outline text-[11px]">STAGE {m.stage}/8 ({m.stageLabel})</span>
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
        defaultCategory="CIVIC_ISSUE_VERIFICATION"
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};

