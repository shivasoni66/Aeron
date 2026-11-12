import React, { useEffect, useState } from 'react';
import { fetchMissions, fetchIncidents, fetchCitizenReports, updateCitizenReport } from '../services/api';
import { MissionData, IncidentData, CitizenReportData } from '../types';
import { CreateMissionModal } from '../components/CreateMissionModal';

export const CivicIssueVerificationPage: React.FC = () => {
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [citizenReports, setCitizenReports] = useState<CitizenReportData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [triageNotice, setTriageNotice] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [mRes, iRes, rRes] = await Promise.all([
        fetchMissions({ category: 'CIVIC_ISSUE_VERIFICATION', limit: 15 }),
        fetchIncidents({ category: 'ROAD_STRUCTURAL', limit: 10 }),
        fetchCitizenReports({ limit: 10 })
      ]);
      setMissions(mRes.missions || []);
      setIncidents(iRes.incidents || []);
      setCitizenReports(rRes.reports || []);
    } catch (err: unknown) {
      console.warn(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateReportStage = async (reportId: string, newStatus: string, stage: number) => {
    try {
      await updateCitizenReport(reportId, { status: newStatus, currentStage: stage });
      setTriageNotice(`Report ${reportId} transitioned to ${newStatus} (Stage ${stage}/6).`);
      loadData();
    } catch (err: unknown) {
      setTriageNotice(`[TRIAGE ERROR] ${err instanceof Error ? err.message : 'Update failed'}`);
    }
    setTimeout(() => setTriageNotice(null), 4000);
  };

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-surface rounded-xl border border-border border-l-4 border-l-aeron-lime shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-aeron-lime text-[24px]">verified</span>
            <span className="font-sans text-xs text-aeron-lime uppercase tracking-wider font-semibold">M01 • Civic Issue Verification</span>
            <span className="px-2 py-0.5 rounded bg-aeron-lime/15 text-aeron-lime border border-aeron-lime/30 font-sans text-[11px] font-medium">
              Operational
            </span>
          </div>
          <h1 className="font-sans font-bold text-lg text-text-primary tracking-tight mt-1">
            Civic Issue Verification
          </h1>
          <p className="font-sans text-xs text-text-muted mt-0.5 leading-relaxed">
            Municipal asphalt fissure inspection, illegal dumping detection, and citizen report audit workflow.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-aeron-lime text-background font-sans font-bold text-xs rounded-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(191,244,46,0.25)]"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Launch civic mission</span>
        </button>
      </div>

      {triageNotice && (
        <div className="p-3 bg-surface-elevated border border-aeron-lime text-aeron-lime rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">verified</span>
            <span>{triageNotice}</span>
          </div>
          <button onClick={() => setTriageNotice(null)} className="text-text-muted hover:text-aeron-lime">✕</button>
        </div>
      )}

      {/* Module Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-text-muted uppercase font-sans tracking-wider">CIVIC SORTIES</span>
            <div className="text-2xl font-bold text-text-primary font-sans">{missions.length}</div>
            <span className="text-[11px] text-aeron-lime">
              {missions.filter((m) => m.status === 'ACTIVE').length} ACTIVELY RUNNING
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-aeron-lime/10 border border-aeron-lime/20 flex items-center justify-center text-aeron-lime">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-text-muted uppercase font-sans tracking-wider">OPEN ROAD INCIDENTS</span>
            <div className="text-2xl font-bold text-text-primary font-sans">{incidents.length}</div>
            <span className="text-[11px] text-caution-amber">PENDING AERIAL AUDIT</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-caution-amber/10 border border-caution-amber/20 flex items-center justify-center text-caution-amber">
            <span className="material-symbols-outlined text-[24px]">warning</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-text-muted uppercase font-sans tracking-wider">CITIZEN REPORTS</span>
            <div className="text-2xl font-bold text-text-primary font-sans">{citizenReports.length}</div>
            <span className="text-[11px] text-telemetry-cyan">MOBILE INTAKE FEED</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-telemetry-cyan/10 border border-telemetry-cyan/20 flex items-center justify-center text-telemetry-cyan">
            <span className="material-symbols-outlined text-[24px]">smartphone</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-surface border border-border flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-text-muted uppercase font-sans tracking-wider">VERIFICATION PIPELINE</span>
            <div className="text-2xl font-bold text-text-primary font-sans">8-STAGE</div>
            <span className="text-[11px] text-text-muted">STRICT MANUAL SIGN-OFF</span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-text-muted">
            <span className="material-symbols-outlined text-[24px]">fact_check</span>
          </div>
        </div>
      </div>

      {/* Citizen Reports Intake & Triage Stream */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-4 font-mono text-xs">
        <div className="flex justify-between items-center pb-3 border-b border-border/60">
          <h3 className="font-sans font-bold text-sm text-text-primary tracking-wide flex items-center gap-2">
            <span className="material-symbols-outlined text-aeron-lime text-[18px]">inbox</span>
            <span>Citizen Reports Intake & Aerial Triage</span>
          </h3>
          <span className="text-text-muted font-sans text-xs">{citizenReports.length} reports logged</span>
        </div>

        {isLoading ? (
          <div className="text-center py-6 text-text-muted animate-pulse font-mono text-xs">
            SYNCHRONIZING CITIZEN REPORT INTAKE FEED...
          </div>
        ) : citizenReports.length === 0 ? (
          <div className="text-center py-6 text-text-muted font-mono text-xs">
            NO CITIZEN REPORTS LOGGED YET. CITIZEN SUBMISSIONS FROM THE MOBILE APP WILL APPEAR HERE IN REAL-TIME.
          </div>
        ) : (
          <div className="space-y-3">
            {citizenReports.map((r) => (
              <div
                key={r._id}
                className="p-4 rounded-xl bg-surface-elevated border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-border"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-aeron-lime font-bold">{r.reportId}</span>
                    <span className="text-text-muted">|</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface text-telemetry-cyan border border-telemetry-cyan/30">
                      {r.category}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface text-text-muted border border-border">
                      {r.status}
                    </span>
                    <span className="text-text-secondary text-[11px]">
                      COORDINATES: [{r.location?.coordinates?.[1]?.toFixed(4)}° N, {r.location?.coordinates?.[0]?.toFixed(4)}° E]
                    </span>
                  </div>
                  <p className="font-sans text-xs text-text-primary leading-relaxed max-w-3xl">{r.description}</p>
                  <div className="flex items-center gap-3 text-[11px] text-text-muted font-sans">
                    <span>Reported: {new Date(r.submittedAt).toLocaleString()}</span>
                    {r.citizenId && <span>Citizen: {r.citizenId.name}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 font-sans text-xs">
                  {r.status === 'SUBMITTED' && (
                    <button
                      onClick={() => handleUpdateReportStage(r.reportId, 'MUNICIPAL_REVIEW', 2)}
                      className="px-3 py-1.5 bg-surface-elevated hover:bg-surface border border-border text-text-primary rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px] text-aeron-lime">rule</span>
                      <span>Accept Review</span>
                    </button>
                  )}
                  {(r.status === 'SUBMITTED' || r.status === 'MUNICIPAL_REVIEW') && (
                    <button
                      onClick={() => handleUpdateReportStage(r.reportId, 'INSPECTION_SCHEDULED', 3)}
                      className="px-3 py-1.5 bg-aeron-lime text-background font-semibold rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px]">flight_takeoff</span>
                      <span>Schedule Sortie</span>
                    </button>
                  )}
                  {r.status === 'INSPECTION_SCHEDULED' && (
                    <button
                      onClick={() => handleUpdateReportStage(r.reportId, 'AERIAL_VERIFIED', 4)}
                      className="px-3 py-1.5 bg-telemetry-cyan text-background font-semibold rounded-lg hover:brightness-110 transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px]">verified</span>
                      <span>Aerial Verified</span>
                    </button>
                  )}
                  {r.status === 'AERIAL_VERIFIED' && (
                    <button
                      onClick={() => handleUpdateReportStage(r.reportId, 'RESOLVED', 6)}
                      className="px-3 py-1.5 bg-success/20 text-success border border-success/40 font-semibold rounded-lg hover:bg-success/30 transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px]">task_alt</span>
                      <span>Mark Resolved</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Missions in this module */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-4 font-mono text-xs">
        <div className="flex justify-between items-center pb-3 border-b border-border/60">
          <h3 className="font-sans font-bold text-sm text-text-primary tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-aeron-lime animate-pulse" />
            <span>Active civic missions</span>
          </h3>
          <span className="text-text-muted font-sans text-xs">{missions.length} missions logged</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-text-muted animate-pulse font-mono text-xs">
            SYNCHRONIZING CIVIC SORTIES...
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-8 text-text-muted font-mono text-xs">
            NO CIVIC ISSUE SORTIES LOGGED YET.
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((m) => (
              <div
                key={m._id}
                className="p-4 rounded-xl bg-surface-elevated border border-border/80 border-l-4 border-l-aeron-lime flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-border"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-aeron-lime font-bold">{m.missionId}</span>
                    <span className="text-text-muted">|</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.status === 'ACTIVE'
                        ? 'bg-aeron-lime/15 text-aeron-lime border border-aeron-lime/30'
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
        defaultCategory="CIVIC_ISSUE_VERIFICATION"
      />
    </div>
  );
};
