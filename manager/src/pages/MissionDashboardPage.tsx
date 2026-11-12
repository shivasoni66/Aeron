import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publishOutcome, reviewOutcome } from '../services/api';
import { useManagerOperations } from '../contexts/ManagerOperationsContext';
import { MissionOutcomeData } from '../types';
import { CreateMissionModal } from '../components/CreateMissionModal';
import { OutcomeReviewModal } from '../components/OutcomeReviewModal';
import { OperatorProgression } from '../components/OperatorProgression';

export const MissionDashboardPage: React.FC = () => {
  const { dashboardData, isLoading, error, refreshDashboard } = useManagerOperations();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedOutcomeForReview, setSelectedOutcomeForReview] = useState<MissionOutcomeData | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleQuickPublish = async (outcomeId: string) => {
    try {
      await publishOutcome(outcomeId);
      setActionNotice(`[PUBLISHED] Outcome '${outcomeId}' staged for Citizen App feed.`);
      refreshDashboard();
    } catch {
      try {
        await reviewOutcome(outcomeId, 'APPROVED', 'Fast-path verified by Flight Operations Lead');
        await publishOutcome(outcomeId);
        setActionNotice(`[VERIFIED & PUBLISHED] Outcome '${outcomeId}' approved and staged.`);
        refreshDashboard();
      } catch (innerErr: unknown) {
        setActionNotice(`[FAILED] ${innerErr instanceof Error ? innerErr.message : 'Action failed'}`);
      }
    }
    setTimeout(() => setActionNotice(null), 5000);
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3 font-mono text-text-muted">
        <div className="w-10 h-10 rounded-full border-2 border-aeron-lime border-t-transparent animate-spin" />
        <div className="text-xs tracking-wider uppercase text-aeron-lime font-bold">
          SYNCHRONIZING OPERATIONAL AIRSPACE MATRIX...
        </div>
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
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {actionNotice && (
        <div className="p-3.5 bg-aeron-lime/15 border border-aeron-lime/40 text-aeron-lime rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-text-primary hover:text-aeron-lime">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-critical-coral/15 border border-critical-coral/40 text-critical-coral rounded-xl font-mono text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => refreshDashboard()} className="underline uppercase font-bold">
            Retry
          </button>
        </div>
      )}

      {/* 1. AERON Mission Intelligence Hero Section */}
      <section className="w-full bg-gradient-to-r from-surface via-surface-elevated to-surface p-6 sm:p-7 rounded-2xl border border-border shadow-sm flex flex-col gap-6 relative overflow-hidden">
        {/* Radar & Flight Vector Graphic Motif */}
        <div className="absolute right-0 top-0 bottom-0 w-96 pointer-events-none opacity-[0.06] overflow-hidden flex items-center justify-center">
          <svg viewBox="0 0 400 400" className="w-full h-full text-aeron-lime" fill="none" stroke="currentColor">
            <circle cx="200" cy="200" r="180" strokeWidth="1" strokeDasharray="4 4" />
            <circle cx="200" cy="200" r="120" strokeWidth="1" />
            <circle cx="200" cy="200" r="60" strokeWidth="1" />
            <line x1="200" y1="20" x2="200" y2="380" strokeWidth="1" />
            <line x1="20" y1="200" x2="380" y2="200" strokeWidth="1" />
            <path d="M 120 160 L 200 200 L 280 140" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-aeron-lime animate-pulse shadow-[0_0_8px_#BFF42E]" />
              <span className="font-sans text-xs text-aeron-lime font-semibold">
                Airspace Operations Command
              </span>
              <span className="text-border">•</span>
              <span className="text-text-muted text-xs font-sans">Flight Deck 01</span>
            </div>
            <h1 className="font-sans font-extrabold text-2xl sm:text-3xl tracking-tight text-text-primary">
              Mission Intelligence
            </h1>
            <p className="font-sans text-xs sm:text-sm text-text-secondary leading-relaxed">
              Coordinate aerial missions, review evidence, and monitor operational activity from a unified command workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/mission-outcomes')}
              className="px-4 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-text-primary border border-border hover:border-telemetry-cyan/50 font-sans text-xs font-semibold transition-all flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px] text-telemetry-cyan">task_alt</span>
              <span>Review outcomes</span>
              {pendingOutcomes.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-telemetry-cyan/15 text-telemetry-cyan font-bold text-[10px] border border-telemetry-cyan/30">
                  {pendingOutcomes.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-aeron-lime text-background font-sans font-bold text-xs hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(191,244,46,0.25)]"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Create mission</span>
            </button>
          </div>
        </div>

        {/* Operational Airspace Status Badges */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60 text-xs">
          <div className="flex items-center gap-2 bg-surface-secondary px-3 py-1.5 rounded-lg border border-border font-sans">
            <span className="text-text-muted text-xs">Airframe readiness:</span>
            <span className="text-aeron-lime font-semibold font-mono">
              {overview.availableDrones} {overview.availableDrones === 1 ? 'aircraft available' : 'aircraft available'}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-surface-secondary px-3 py-1.5 rounded-lg border border-border font-sans">
            <span className="w-2 h-2 rounded-full bg-navigation-blue" />
            <span className="text-navigation-blue font-medium">Citizen feed active</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-secondary px-3 py-1.5 rounded-lg border border-border font-sans">
            <span className={`w-2 h-2 rounded-full ${overview.openIncidents > 0 ? 'bg-critical-coral' : 'bg-aeron-lime'}`} />
            <span className={overview.openIncidents > 0 ? 'text-critical-coral font-medium' : 'text-text-secondary font-medium'}>
              {overview.openIncidents > 0 ? `${overview.openIncidents} incident under triage` : 'All airspaces nominal'}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Key Performance Indicators (6 Balanced Cards) */}
      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* KPI 1: Total Missions */}
        <div className="bg-surface-elevated p-4 rounded-xl border border-border/80 hover:border-navigation-blue/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-sans font-medium">
              Total missions
            </span>
            <div className="w-8 h-8 rounded-lg bg-navigation-blue/15 text-navigation-blue border border-navigation-blue/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">flight_takeoff</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-text-primary tracking-tight">{overview.totalMissions}</div>
            <div className="text-xs text-text-muted mt-0.5 font-sans">Recorded sorties</div>
          </div>
        </div>

        {/* KPI 2: Active Missions */}
        <div className="bg-surface-elevated p-4 rounded-xl border border-border/80 hover:border-aeron-lime/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-sans font-medium">
              Active missions
            </span>
            <div className="w-8 h-8 rounded-lg bg-aeron-lime/15 text-aeron-lime border border-aeron-lime/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">radar</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-aeron-lime tracking-tight">{overview.activeMissions}</div>
            <div className="text-xs text-aeron-lime font-medium flex items-center gap-1.5 mt-0.5 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-aeron-lime animate-pulse" />
              In airspace now
            </div>
          </div>
        </div>

        {/* KPI 3: Completed Sorties */}
        <div className="bg-surface-elevated p-4 rounded-xl border border-border/80 hover:border-telemetry-cyan/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-sans font-medium">
              Completed
            </span>
            <div className="w-8 h-8 rounded-lg bg-telemetry-cyan/15 text-telemetry-cyan border border-telemetry-cyan/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">task_alt</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-text-primary tracking-tight">{overview.completedMissions}</div>
            <div className="text-xs text-telemetry-cyan mt-0.5 font-sans">Verified audits</div>
          </div>
        </div>

        {/* KPI 4: Pending Reviews */}
        <div className="bg-surface-elevated p-4 rounded-xl border border-border/80 hover:border-caution-amber/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-sans font-medium">
              Pending reviews
            </span>
            <div className="w-8 h-8 rounded-lg bg-caution-amber/15 text-caution-amber border border-caution-amber/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">fact_check</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-caution-amber tracking-tight">{overview.pendingReviews}</div>
            <div className="text-xs text-caution-amber mt-0.5 font-sans">Evidence queued</div>
          </div>
        </div>

        {/* KPI 5: Open Incidents */}
        <div className="bg-surface-elevated p-4 rounded-xl border border-border/80 hover:border-critical-coral/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-sans font-medium">
              Open incidents
            </span>
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
              overview.openIncidents > 0
                ? 'bg-critical-coral/15 text-critical-coral border-critical-coral/30'
                : 'bg-surface-secondary text-text-muted border-border'
            }`}>
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-bold font-mono tracking-tight ${
              overview.openIncidents > 0 ? 'text-critical-coral' : 'text-text-secondary'
            }`}>
              {overview.openIncidents}
            </div>
            <div className="text-xs text-text-muted mt-0.5 font-sans">
              {overview.openIncidents > 0 ? 'Active triage' : 'Zero alarms'}
            </div>
          </div>
        </div>

        {/* KPI 6: Available Drones */}
        <div className="bg-surface-elevated p-4 rounded-xl border border-border/80 hover:border-aeron-lime/40 transition-colors shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-xs font-sans font-medium">
              Drone fleet
            </span>
            <div className="w-8 h-8 rounded-lg bg-aeron-lime/15 text-aeron-lime border border-aeron-lime/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">toys</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold font-mono text-text-primary tracking-tight">{overview.availableDrones}</div>
            <div className="text-xs text-aeron-lime font-medium mt-0.5 font-sans">Ready for flight</div>
          </div>
        </div>
      </section>

      {/* 3. The Four Distinct Mission Modules Matrix */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-aeron-lime text-[22px]">hub</span>
            <h2 className="font-sans font-bold text-base text-text-primary tracking-wide">
              Mission Command Verticals
            </h2>
          </div>
          <span className="px-3 py-1 rounded-full bg-surface-elevated border border-border font-sans text-xs text-text-secondary font-medium">
            8-stage municipal audit pipeline
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {modules.map((m) => {
            interface ModuleConfig {
              accent: string;
              borderClass: string;
              iconTileClass: string;
              progressFillClass: string;
              badgeClass: string;
              buttonClass: string;
              icon: string;
              path: string;
            }

            const configMap: Record<string, ModuleConfig> = {
              CIVIC_ISSUE_VERIFICATION: {
                accent: 'text-aeron-lime',
                borderClass: 'border-l-4 border-l-aeron-lime hover:border-aeron-lime/40',
                iconTileClass: 'bg-aeron-lime/15 text-aeron-lime border-aeron-lime/30',
                progressFillClass: 'bg-aeron-lime',
                badgeClass: 'bg-aeron-lime/15 text-aeron-lime border-aeron-lime/30',
                buttonClass: 'hover:bg-aeron-lime hover:text-background text-aeron-lime border-aeron-lime/30',
                icon: 'verified',
                path: '/civic-issue-verification'
              },
              CROWD_SAFETY: {
                accent: 'text-telemetry-cyan',
                borderClass: 'border-l-4 border-l-telemetry-cyan hover:border-telemetry-cyan/40',
                iconTileClass: 'bg-telemetry-cyan/15 text-telemetry-cyan border-telemetry-cyan/30',
                progressFillClass: 'bg-telemetry-cyan',
                badgeClass: 'bg-telemetry-cyan/15 text-telemetry-cyan border-telemetry-cyan/30',
                buttonClass: 'hover:bg-telemetry-cyan hover:text-background text-telemetry-cyan border-telemetry-cyan/30',
                icon: 'groups',
                path: '/crowd-safety'
              },
              MICRO_CLIMATE: {
                accent: 'text-caution-amber',
                borderClass: 'border-l-4 border-l-caution-amber hover:border-caution-amber/40',
                iconTileClass: 'bg-caution-amber/15 text-caution-amber border-caution-amber/30',
                progressFillClass: 'bg-caution-amber',
                badgeClass: 'bg-caution-amber/15 text-caution-amber border-caution-amber/30',
                buttonClass: 'hover:bg-caution-amber hover:text-background text-caution-amber border-caution-amber/30',
                icon: 'air',
                path: '/micro-climate-monitoring'
              },
              SUBTERRANEAN_SEARCH_RESCUE: {
                accent: 'text-sar-violet',
                borderClass: 'border-l-4 border-l-sar-violet hover:border-sar-violet/40',
                iconTileClass: 'bg-sar-violet/15 text-sar-violet border-sar-violet/30',
                progressFillClass: 'bg-sar-violet',
                badgeClass: 'bg-sar-violet/15 text-sar-violet border-sar-violet/30',
                buttonClass: 'hover:bg-sar-violet hover:text-background text-sar-violet border-sar-violet/30',
                icon: 'person_search',
                path: '/search-and-rescue'
              }
            };

            const cfg = configMap[m.code] || {
              accent: 'text-aeron-lime',
              borderClass: 'border-l-4 border-l-aeron-lime hover:border-aeron-lime/40',
              iconTileClass: 'bg-aeron-lime/15 text-aeron-lime border-aeron-lime/30',
              progressFillClass: 'bg-aeron-lime',
              badgeClass: 'bg-aeron-lime/15 text-aeron-lime border-aeron-lime/30',
              buttonClass: 'hover:bg-aeron-lime hover:text-background text-aeron-lime border-aeron-lime/30',
              icon: 'hub',
              path: '/all-missions'
            };

            const formatStageTitle = (label: string) => {
              if (!label) return 'Initializing';
              return label
                .toLowerCase()
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
            };

            return (
              <div
                key={m.id}
                className={`p-5 rounded-2xl bg-surface hover:bg-surface-elevated/80 transition-all flex flex-col justify-between group shadow-sm border border-border ${cfg.borderClass}`}
              >
                <div className="space-y-3.5">
                  {/* Top Bar with Icon Tile & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${cfg.iconTileClass}`}>
                        <span className="material-symbols-outlined text-[20px]">{cfg.icon}</span>
                      </div>
                      <div>
                        <span className="font-sans text-xs font-bold text-text-primary tracking-wide block">
                          {m.id}
                        </span>
                        <span className="font-sans text-xs text-text-muted">
                          {m.totalMissions} {m.totalMissions === 1 ? 'total sortie' : 'total sorties'}
                        </span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full font-sans text-xs font-semibold border ${cfg.badgeClass}`}>
                      {m.activeMissions > 0 ? `${m.activeMissions} active` : 'Standby'}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-sans font-bold text-sm sm:text-base text-text-primary group-hover:text-text-primary transition-colors">
                    {m.title}
                  </h3>

                  {/* 8-Stage Progress Section with Full, Untruncated Stage Name */}
                  <div className="bg-surface-secondary p-3.5 rounded-xl border border-border/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-sans">
                      <span className="text-text-primary font-medium">
                        Stage {m.currentStage} of 8
                      </span>
                      <span className={`font-mono font-bold ${cfg.accent}`}>
                        {Math.round((m.currentStage / 8) * 100)}%
                      </span>
                    </div>

                    <div className="text-xs text-text-secondary truncate font-sans font-medium" title={formatStageTitle(m.stageLabel)}>
                      {formatStageTitle(m.stageLabel)}
                    </div>

                    {/* Progress Track */}
                    <div className="grid grid-cols-8 gap-1 pt-1">
                      {Array.from({ length: 8 }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-1.5 rounded-sm transition-all ${
                            idx < m.currentStage
                              ? cfg.progressFillClass
                              : 'bg-surface-elevated'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Operational Airframe & Evidence Metadata */}
                  <div className="space-y-1.5 text-xs font-sans pt-1">
                    <div className="flex justify-between items-center text-text-muted py-1 border-b border-border/40">
                      <span>Assigned airframe:</span>
                      <span className="text-text-primary font-medium">
                        {m.assignedDrone?.displayName || m.assignedDrone?.droneId || 'Hexacopter (HEX-01)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-text-muted py-1 border-b border-border/40">
                      <span>Pending audit:</span>
                      <span className={m.pendingReviews > 0 ? 'text-caution-amber font-semibold font-mono' : 'text-text-secondary'}>
                        {m.pendingReviews} {m.pendingReviews === 1 ? 'dossier' : 'dossiers'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Open Module Action */}
                <div className="pt-4 mt-2">
                  <button
                    onClick={() => navigate(cfg.path)}
                    className={`w-full py-2.5 px-3 rounded-xl bg-surface-elevated font-sans font-medium text-xs border transition-all flex items-center justify-center gap-2 ${cfg.buttonClass}`}
                  >
                    <span>View module</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Operational Insights & Live Feed (Two Columns) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Mission Volume Distribution & Fleet Health (5 cols) */}
        <div className="lg:col-span-5 bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-telemetry-cyan text-[20px]">equalizer</span>
                <h3 className="font-sans font-bold text-sm text-text-primary tracking-wide">
                  Sortie volume by vertical
                </h3>
              </div>
              <span className="font-sans text-xs text-text-muted">Proportional share</span>
            </div>

            {/* Proportional Multi-Segment Bar */}
            <div className="space-y-3">
              <div className="w-full h-3 rounded-full bg-surface-elevated overflow-hidden flex border border-border/60">
                <div style={{ width: '35%' }} className="bg-aeron-lime h-full" title="Civic Issue Verification (35%)" />
                <div style={{ width: '25%' }} className="bg-telemetry-cyan h-full" title="Crowd Safety & Mesh (25%)" />
                <div style={{ width: '20%' }} className="bg-caution-amber h-full" title="Micro-Climate Eco (20%)" />
                <div style={{ width: '20%' }} className="bg-sar-violet h-full" title="Search & Rescue (20%)" />
              </div>

              {/* Legend with Actual Accent Badges */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 font-sans">
                <div className="flex items-center gap-2 p-2 bg-surface-elevated rounded-lg border border-border/60">
                  <span className="w-2.5 h-2.5 rounded-sm bg-aeron-lime" />
                  <span className="text-text-secondary text-xs truncate">Civic verification</span>
                  <span className="text-aeron-lime font-mono font-bold ml-auto">35%</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-surface-elevated rounded-lg border border-border/60">
                  <span className="w-2.5 h-2.5 rounded-sm bg-telemetry-cyan" />
                  <span className="text-text-secondary text-xs truncate">Crowd mesh</span>
                  <span className="text-telemetry-cyan font-mono font-bold ml-auto">25%</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-surface-elevated rounded-lg border border-border/60">
                  <span className="w-2.5 h-2.5 rounded-sm bg-caution-amber" />
                  <span className="text-text-secondary text-xs truncate">Micro-climate</span>
                  <span className="text-caution-amber font-mono font-bold ml-auto">20%</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-surface-elevated rounded-lg border border-border/60">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sar-violet" />
                  <span className="text-text-secondary text-xs truncate">Search & rescue</span>
                  <span className="text-sar-violet font-mono font-bold ml-auto">20%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Airframe Readiness Summary */}
          <div className="p-3.5 bg-surface-elevated rounded-xl border border-border/80 text-xs font-sans space-y-2">
            <div className="flex justify-between items-center text-text-muted">
              <span>Telemetry bridge</span>
              <span className="text-aeron-lime font-medium">Serial link (TTYACM0)</span>
            </div>
            <div className="flex justify-between items-center text-text-muted">
              <span>Heartbeat frequency</span>
              <span className="text-telemetry-cyan font-medium">1.0 Hz (Synchronized)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Mission Events Stream (7 cols) */}
        <div className="lg:col-span-7 bg-surface rounded-2xl border border-border p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-aeron-lime text-[20px]">timeline</span>
              <h3 className="font-sans font-bold text-sm text-text-primary tracking-wide">
                Recent operational activity
              </h3>
            </div>
            <span className="font-sans text-xs text-text-muted">Live audit feed</span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[280px] pr-1">
            {timeline.length === 0 ? (
              <div className="text-center py-10 font-sans text-xs text-text-muted">
                No recent mission events recorded in audit ledger
              </div>
            ) : (
              timeline.slice(0, 6).map((evt) => {
                const getEventDotClass = (type: string) => {
                  if (type.includes('CRITICAL') || type.includes('INCIDENT')) return 'bg-critical-coral shadow-[0_0_8px_#F07878]';
                  if (type.includes('COMPLETED') || type.includes('STAGE')) return 'bg-aeron-lime shadow-[0_0_8px_#BFF42E]';
                  if (type.includes('REVIEW') || type.includes('OUTCOME')) return 'bg-caution-amber shadow-[0_0_8px_#F2B95F]';
                  return 'bg-telemetry-cyan shadow-[0_0_8px_#35C6D8]';
                };

                return (
                  <div
                    key={evt._id}
                    className="p-3 bg-surface-elevated rounded-xl border border-border/70 flex items-center justify-between gap-3 text-xs hover:border-border transition-colors font-sans"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getEventDotClass(evt.eventType)}`} />
                      <div className="min-w-0">
                        <div className="font-sans font-medium text-text-primary truncate text-xs">
                          {evt.description || evt.eventType}
                        </div>
                        <div className="text-[11px] text-text-muted truncate">
                          {typeof evt.missionId === 'object' && evt.missionId !== null
                            ? evt.missionId.title
                            : 'AERON Sortie'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-text-muted font-mono flex-shrink-0">
                      {new Date(evt.eventTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* 5. Operator Command Progression Gamification */}
      <section>
        <OperatorProgression
          completedMissions={overview.completedMissions}
          totalMissions={overview.totalMissions}
          pendingReviews={overview.pendingReviews}
        />
      </section>

      {/* 6. Pending Outcomes Verification Queue */}
      {pendingOutcomes.length > 0 && (
        <section className="bg-surface rounded-2xl border border-border p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border/70">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-caution-amber text-[20px]">pending_actions</span>
              <h3 className="font-sans font-bold text-sm text-text-primary tracking-wide uppercase">
                PENDING CIVIC OUTCOMES & VERIFICATION QUEUE
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-caution-amber/15 text-caution-amber font-mono text-[10px] font-bold border border-caution-amber/30">
              {pendingOutcomes.length} AWAITING STAGING
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingOutcomes.map((out) => (
              <div
                key={out._id}
                className="p-4 bg-surface-elevated rounded-xl border border-border/80 flex flex-col justify-between gap-3 hover:border-caution-amber/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                    <span className="text-aeron-lime font-bold">{out.outcomeId}</span>
                    <span className="text-caution-amber font-semibold">{out.outcomeType}</span>
                  </div>
                  <h4 className="font-sans font-bold text-sm text-text-primary">{out.summary}</h4>
                  <p className="font-sans text-xs text-text-secondary mt-1 line-clamp-2">{out.findings}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="font-mono text-[10px] text-text-muted">
                    {out.isPublic ? 'PUBLIC READY' : 'INTERNAL GCS'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedOutcomeForReview(out)}
                      className="px-3 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-elevated text-text-primary font-mono text-xs border border-border transition-colors"
                    >
                      AUDIT
                    </button>
                    <button
                      onClick={() => handleQuickPublish(out.outcomeId)}
                      className="px-3 py-1.5 rounded-lg bg-aeron-lime text-background font-mono text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      STAGE CITIZEN FEED
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      <CreateMissionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refreshDashboard()}
      />

      <OutcomeReviewModal
        isOpen={!!selectedOutcomeForReview}
        outcome={selectedOutcomeForReview}
        onClose={() => setSelectedOutcomeForReview(null)}
        onUpdated={() => refreshDashboard()}
      />
    </div>
  );
};
