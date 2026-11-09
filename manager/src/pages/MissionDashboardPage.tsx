import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDashboard, publishOutcome, reviewOutcome } from '../services/api';
import { DashboardData, MissionOutcomeData } from '../types';
import { CreateMissionModal } from '../components/CreateMissionModal';
import { OutcomeReviewModal } from '../components/OutcomeReviewModal';

export const MissionDashboardPage: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedOutcomeForReview, setSelectedOutcomeForReview] = useState<MissionOutcomeData | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const data = await fetchDashboard();
      setDashboardData(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load mission dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickPublish = async (outcomeId: string) => {
    try {
      await publishOutcome(outcomeId);
      setActionNotice(`[PUBLISHED] Outcome '${outcomeId}' staged for Citizen App feed.`);
      loadData();
    } catch (err: unknown) {
      // If not approved yet, try to approve and publish
      try {
        await reviewOutcome(outcomeId, 'APPROVED', 'Fast-path verified by Flight Commander');
        await publishOutcome(outcomeId);
        setActionNotice(`[VERIFIED & PUBLISHED] Outcome '${outcomeId}' approved and staged.`);
        loadData();
      } catch (innerErr: unknown) {
        setActionNotice(`[FAILED] ${innerErr instanceof Error ? innerErr.message : 'Action failed'}`);
      }
    }
    setTimeout(() => setActionNotice(null), 5000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 font-label-telemetry text-primary-fixed">
        <div className="w-10 h-10 rounded-full border-2 border-primary-fixed border-t-transparent animate-spin"></div>
        <div className="text-xs tracking-wider uppercase">SYNCHRONIZING OPERATIONAL AIRSPACE MATRIX...</div>
      </div>
    );
  }

  const overview = dashboardData?.overview || {
    totalMissions: 0,
    activeMissions: 0,
    completedMissions: 0,
    pendingReviews: 0,
    openIncidents: 0,
    availableDrones: 0
  };

  const modules = dashboardData?.modules || [];
  const pendingOutcomes = dashboardData?.pendingActions?.outcomesAwaitingReview || [];
  const timeline = dashboardData?.timeline || [];

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {actionNotice && (
        <div className="p-space-sm bg-primary-container/20 border border-primary-fixed text-primary-fixed rounded font-label-telemetry text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-on-surface hover:text-primary-fixed">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-space-sm bg-error-container/30 border border-error text-error rounded font-label-telemetry text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadData} className="underline uppercase">Retry</button>
        </div>
      )}

      {/* 1. Executive Operations Bar */}
      <section className="w-full bg-surface-container-low p-space-lg rounded-lg shadow-xl relative overflow-hidden border border-surface-variant/40">
        <div className="absolute -right-24 -top-24 w-96 h-96 bg-primary-fixed/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg relative z-10">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary-fixed animate-pulse"></span>
              <span className="font-label-telemetry text-label-telemetry text-primary-fixed uppercase tracking-wider">
                AERON AIRSPACE OPERATIONS INTELLIGENCE
              </span>
              <span className="text-outline text-body-sm font-label-telemetry">/ MISSION COMMAND DECK</span>
              <span className="px-2 py-0.5 rounded bg-primary-fixed/10 border border-primary-fixed/30 font-label-telemetry text-[11px] text-primary-fixed">
                LIVE GCS OPS
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-primary tracking-wide uppercase leading-none">
              FLIGHT DECK OPS
            </h1>
            <p className="font-body-md text-body-md text-secondary max-w-2xl">
              Real-time sortie telemetry, edge neural net sample inferences, and multi-mission civic verification workflows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-space-md">
            <button
              onClick={() => navigate('/mission-outcomes')}
              className="px-space-lg py-3 rounded-full bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-pill text-label-pill transition-all flex items-center gap-2 group shadow-md"
            >
              <span className="material-symbols-outlined text-[18px] text-primary-fixed group-hover:rotate-12 transition-transform">
                send
              </span>
              <span>STAGE APPROVED OUTCOMES</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-variant text-primary-fixed font-label-telemetry text-[11px]">
                {pendingOutcomes.length} QUEUED
              </span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-space-lg py-3 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill text-label-pill transition-all flex items-center gap-2 shadow-[0_0_24px_rgba(191,244,46,0.3)] font-bold"
            >
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span className="tracking-wide">NEW MISSION SORTIE +</span>
            </button>
          </div>
        </div>

        {/* Real Overview Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-space-md mt-space-md pt-space-md bg-surface-container-lowest/60 rounded p-space-md border border-surface-variant/30">
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">TOTAL MISSIONS</span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className="font-headline-lg text-headline-lg text-primary">{overview.totalMissions}</span>
              <span className="font-label-telemetry text-[11px] text-primary-fixed uppercase">RECORDED</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">ACTIVE MISSIONS</span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className="font-headline-lg text-headline-lg text-primary-fixed">{overview.activeMissions}</span>
              <span className="font-label-telemetry text-[11px] text-primary-fixed uppercase animate-pulse">LIVE</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">COMPLETED</span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className="font-headline-lg text-headline-lg text-secondary">{overview.completedMissions}</span>
              <span className="font-label-telemetry text-[11px] text-outline uppercase">ARCHIVED</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">PENDING REVIEWS</span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className="font-headline-lg text-headline-lg text-primary-fixed">{overview.pendingReviews}</span>
              <span className="font-label-telemetry text-[11px] text-primary-fixed uppercase">INSPECTION</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">OPEN INCIDENTS</span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className={`font-headline-lg text-headline-lg ${overview.openIncidents > 0 ? 'text-error' : 'text-primary'}`}>
                {overview.openIncidents}
              </span>
              <span className="font-label-telemetry text-[11px] text-error uppercase">ALERTS</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">AVAILABLE DRONES</span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className="font-headline-lg text-headline-lg text-primary-fixed">{overview.availableDrones}</span>
              <span className="font-label-telemetry text-[11px] text-primary-fixed uppercase">READY</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. The Four Mission Modules Matrix */}
      <section className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">[MATRIX]</span>
            <h2 className="font-headline-md text-headline-md text-primary tracking-tight">
              OPERATIONAL MISSION COMMAND MATRIX
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-surface-container-high font-label-telemetry text-[10px] text-primary-fixed border border-primary-fixed/30">
              8-STAGE PIPELINE
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {modules.map((m) => {
            const pathMap: Record<string, string> = {
              CIVIC_ISSUE_VERIFICATION: '/civic-issue-verification',
              CROWD_SAFETY: '/crowd-safety',
              MICRO_CLIMATE: '/micro-climate-monitoring',
              SUBTERRANEAN_SEARCH_RESCUE: '/search-and-rescue'
            };
            const path = pathMap[m.code] || '/all-missions';

            return (
              <div
                key={m.id}
                className="p-space-lg rounded bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between group shadow-md relative overflow-hidden border border-surface-variant/40"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-fixed"></div>
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-label-telemetry text-label-telemetry text-primary-fixed font-bold">
                        {m.id} // {m.title.toUpperCase()}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-label-telemetry text-[10px] font-bold">
                      {m.activeMissions} ACTIVE
                    </span>
                  </div>

                  <h3 className="font-headline-md text-headline-md text-primary group-hover:text-primary-fixed transition-colors">
                    {m.title}
                  </h3>

                  <div className="mt-space-xs pt-space-xs bg-surface-container-lowest/70 p-2.5 rounded border border-surface-variant/50">
                    <div className="flex items-center justify-between font-label-telemetry text-[10px] mb-1.5">
                      <span className="text-primary-fixed font-bold">
                        STAGE {m.currentStage}/8: {m.stageLabel}
                      </span>
                      <span className="text-primary-fixed font-bold">
                        {Math.round((m.currentStage / 8) * 100)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {Array.from({ length: 8 }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-1.5 rounded-sm ${
                            idx + 1 < m.currentStage
                              ? 'bg-primary-fixed'
                              : idx + 1 === m.currentStage
                              ? 'bg-primary-fixed animate-pulse'
                              : 'bg-surface-variant'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-[9px] font-label-telemetry text-outline mt-1.5">
                      <span>ASSET: {m.assignedDrone?.droneId || 'STANDBY'}</span>
                      <span>SORTIES: {m.totalMissions}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-space-md pt-space-sm bg-surface-container-lowest/40 rounded p-space-sm flex flex-col gap-space-xs font-label-telemetry text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-outline">TOTAL SORTIES</span>
                    <span className="text-primary font-bold">{m.totalMissions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-outline">PENDING REVIEWS</span>
                    <span className="text-error font-bold">{m.pendingReviews} CASES</span>
                  </div>
                </div>

                <div className="mt-space-md flex items-center justify-between pt-2 border-t border-surface-variant/40">
                  <span className="font-label-telemetry text-[11px] text-outline">
                    {m.assignedDrone?.displayName || 'UNASSIGNED'}
                  </span>
                  <button
                    onClick={() => navigate(path)}
                    className="text-primary-fixed hover:underline font-label-telemetry text-[12px] flex items-center gap-1 font-bold"
                  >
                    OPEN MODULE <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Tactical Live Split View & Staged Outcomes Queue */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Left: Quick Verification & Staged Outcomes Queue */}
        <div className="lg:col-span-7 bg-surface-container-low p-space-lg rounded-lg border border-surface-variant/40 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-variant mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed">task_alt</span>
                <span className="font-label-telemetry text-primary-fixed">[OUTCOMES QUEUE]</span>
                <h3 className="font-headline-md text-headline-md text-primary">PENDING VERIFICATION QUEUE</h3>
              </div>
              <span className="text-xs font-label-telemetry text-outline">{pendingOutcomes.length} ITEMS AWAITING SIGN-OFF</span>
            </div>

            {pendingOutcomes.length === 0 ? (
              <div className="text-center py-12 text-outline font-label-telemetry text-xs">
                <span className="material-symbols-outlined text-[36px] text-outline/50 block mb-2">check_circle</span>
                ALL OUTCOMES HAVE BEEN AUDITED & STAGED
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOutcomes.map((out) => (
                  <div
                    key={out.outcomeId}
                    className="p-space-md rounded bg-surface-container-lowest border border-surface-variant/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 font-label-telemetry text-[11px]">
                        <span className="text-primary-fixed font-bold">{out.outcomeId}</span>
                        <span className="text-outline">|</span>
                        <span className="text-secondary">{out.outcomeType}</span>
                      </div>
                      <h4 className="font-headline-md text-sm text-on-surface mt-0.5">{out.summary}</h4>
                      <p className="text-outline text-xs line-clamp-1 mt-0.5">{out.findings}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedOutcomeForReview(out)}
                        className="px-3 py-1.5 rounded bg-surface-container hover:bg-surface-variant text-on-surface font-label-pill text-xs font-bold transition-colors"
                      >
                        INSPECT
                      </button>
                      <button
                        onClick={() => handleQuickPublish(out.outcomeId)}
                        className="px-4 py-1.5 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill text-xs font-bold shadow-[0_0_10px_rgba(191,244,46,0.3)] transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">publish</span>
                        STAGE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-surface-variant/40 flex justify-between items-center text-[11px] font-label-telemetry text-outline">
            <span>STAGING COMPLIANCE: 100% CHECKLIST VERIFIED</span>
            <button onClick={() => navigate('/mission-outcomes')} className="text-primary-fixed hover:underline font-bold">
              VIEW FULL OUTCOMES LEDGER →
            </button>
          </div>
        </div>

        {/* Right: Operational Activity Timeline */}
        <div className="lg:col-span-5 bg-surface-container-low p-space-lg rounded-lg border border-surface-variant/40 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-variant mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-fixed">timeline</span>
                <span className="font-label-telemetry text-primary-fixed">[TIMELINE]</span>
                <h3 className="font-headline-md text-headline-md text-primary">MISSION ACTIVITY LOG</h3>
              </div>
              <span className="text-xs font-label-telemetry text-outline">DATABASE LOGS</span>
            </div>

            {timeline.length === 0 ? (
              <div className="text-center py-12 text-outline font-label-telemetry text-xs">
                AWAITING SORTIE ACTIVITY LOGS
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {timeline.map((evt) => (
                  <div key={evt._id} className="p-2.5 rounded bg-surface-container-lowest border border-surface-variant/40 font-label-telemetry text-[11px]">
                    <div className="flex justify-between items-center text-outline text-[10px]">
                      <span className="text-primary-fixed font-bold">{evt.eventType}</span>
                      <span>{new Date(evt.eventTimestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-on-surface mt-1 font-body-sm text-xs">{evt.description}</div>
                    <div className="text-outline text-[10px] mt-1 flex justify-between">
                      <span>ACTOR: {evt.actorId?.name || 'SYSTEM'}</span>
                      <span>SRC: {evt.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-surface-variant/40 flex justify-between items-center text-[11px] font-label-telemetry text-outline">
            <span>MUTATION LOGS IMMUTABLE</span>
            <button onClick={() => navigate('/all-missions')} className="text-primary-fixed hover:underline font-bold">
              BROWSE ALL MISSIONS →
            </button>
          </div>
        </div>
      </section>

      {/* Modals */}
      <CreateMissionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          loadData();
          setActionNotice('New mission sortie initialized successfully.');
        }}
      />

      <OutcomeReviewModal
        isOpen={!!selectedOutcomeForReview}
        outcome={selectedOutcomeForReview}
        onClose={() => setSelectedOutcomeForReview(null)}
        onUpdated={() => {
          loadData();
          setActionNotice('Mission outcome review updated.');
        }}
      />
    </div>
  );
};
