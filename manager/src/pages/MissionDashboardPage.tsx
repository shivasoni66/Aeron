import React from 'react';
import { MissionCard } from '../components/MissionCard';
import { MissionModuleData } from '../types';

const sampleModules: MissionModuleData[] = [
  {
    id: 'M01',
    code: 'M01 // CIVIC ISSUE VERIFICATION',
    title: 'Civic Issue Verification',
    description: 'Optical tarmac fissure inspection, illegal municipal dumping identification, and road pothole depth rating.',
    stage: 6,
    totalStages: 8,
    stageLabel: 'MANUAL REVIEW',
    progressPercent: 75,
    asset: 'BENCH01',
    sortiesLogged: 12,
    xpReward: 150,
    icon: 'traffic'
  },
  {
    id: 'M02',
    code: 'M02 // CROWD SAFETY & AERIAL MESH',
    title: 'Crowd Safety & Aerial Mesh',
    description: 'Multi-drone peer mesh over assembly zones. Choke-point density threshold telemetry with strict privacy blur.',
    stage: 4,
    totalStages: 8,
    stageLabel: 'DATA COLLECTION',
    progressPercent: 50,
    asset: 'BENCH02',
    sortiesLogged: 6,
    xpReward: 180,
    icon: 'groups'
  },
  {
    id: 'M03',
    code: 'M03 // MICRO-CLIMATE & HEAT ISLAND',
    title: 'Micro-Climate & Heat Island',
    description: 'Simulated thermal elevation contour mapping, VOC gas particulates, and concrete canopy radiance benchmarks.',
    stage: 5,
    totalStages: 8,
    stageLabel: 'AI ANALYSIS',
    progressPercent: 62,
    asset: 'THERM-01',
    sortiesLogged: 4,
    xpReward: 140,
    icon: 'thermostat'
  },
  {
    id: 'M04',
    code: 'M04 // SUBTERRANEAN SEARCH & RESCUE',
    title: 'Subterranean Search & Rescue',
    description: 'Drainage culvert navigation drills, mock survivor thermal beacon tags, and LiDAR point-cloud benchmark reconstruction.',
    stage: 7,
    totalStages: 8,
    stageLabel: 'VERIFIED',
    progressPercent: 88,
    asset: 'SAR-BENCH',
    sortiesLogged: 2,
    xpReward: 200,
    icon: 'radar'
  }
];

export const MissionDashboardPage: React.FC = () => {
  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* 1. Executive Operations Bar + Operator Progression Hero */}
      <section className="w-full bg-surface-container-low p-space-lg rounded-lg shadow-xl relative overflow-hidden border border-surface-variant/40">
        <div className="absolute -right-24 -top-24 w-96 h-96 bg-primary-fixed/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg relative z-10">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary-fixed animate-pulse"></span>
              <span className="font-label-telemetry text-label-telemetry text-primary-fixed uppercase tracking-wider">
                AERON TESTBED AIRSPACE INTELLIGENCE
              </span>
              <span className="text-outline text-body-sm font-label-telemetry">/ ZONE 01 TACTICAL TEST</span>
              <span className="px-2 py-0.5 rounded bg-primary-fixed/10 border border-primary-fixed/30 font-label-telemetry text-[11px] text-primary-fixed">
                BENCH SIMULATION V2.4
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-primary tracking-wide uppercase leading-none">
              FLIGHT DECK OPS
            </h1>
            <p className="font-body-md text-body-md text-secondary max-w-2xl">
              Real-time bench sortie telemetry, edge neural net sample inferences, and staged civic verification publishing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-space-md">
            <button className="px-space-lg py-3 rounded-full bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-pill text-label-pill transition-all flex items-center gap-2 group shadow-md">
              <span className="material-symbols-outlined text-[18px] text-primary-fixed group-hover:rotate-12 transition-transform">
                send
              </span>
              <span>STAGE APPROVED OUTCOMES</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-variant text-primary-fixed font-label-telemetry text-[11px]">
                8 DEMO QUEUED
              </span>
            </button>
            <button className="px-space-lg py-3 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill text-label-pill transition-all flex items-center gap-2 shadow-[0_0_24px_rgba(191,244,46,0.3)]">
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
              <span className="tracking-wide">NEW BENCH SORTIE +</span>
            </button>
          </div>
        </div>

        {/* Operator Quality XP Progress */}
        <div className="mt-space-md p-space-md bg-surface-container-lowest/80 rounded border border-surface-variant/70 flex flex-col xl:flex-row items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md w-full xl:w-auto">
            <div className="w-14 h-14 rounded bg-surface-container-high border-2 border-primary-fixed flex flex-col items-center justify-center shrink-0 shadow-[0_0_16px_rgba(191,244,46,0.2)]">
              <span className="text-[9px] font-label-telemetry text-outline leading-tight">RANK</span>
              <span className="font-headline-md text-[20px] text-primary-fixed leading-tight">03</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-label-telemetry text-[13px] font-bold text-primary">
                  LEVEL 03 // MISSION SPECIALIST
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-label-telemetry text-[10px]">
                  CALLSIGN: OP-8842-X
                </span>
              </div>
              <div className="text-[12px] font-label-telemetry text-secondary mt-0.5">
                XP ADVANCEMENT: ACCREDITED FOR VERIFIED WORK QUALITY & CHECKLIST ADHERENCE
              </div>
            </div>
          </div>

          <div className="flex flex-col w-full xl:w-96 gap-1">
            <div className="flex justify-between items-center text-[11px] font-label-telemetry">
              <span className="text-outline">OPERATOR QUALITY XP</span>
              <span className="text-primary-fixed font-bold">2,180 / 2,500 XP (87%)</span>
            </div>
            <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden p-[2px]">
              <div className="bg-gradient-to-r from-surface-tint to-primary-fixed h-full rounded-full w-[87%] shadow-[0_0_12px_rgba(191,244,46,0.5)]"></div>
            </div>
            <div className="flex justify-between items-center text-[10px] font-label-telemetry text-outline">
              <span>+120 XP QUALITY AUDIT</span>
              <span>+80 XP CHECKLIST SIGN-OFF</span>
              <span>+100 XP BOUNDING PRECISION</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 rounded bg-surface-container-high border border-outline-variant/40 flex items-center gap-2 font-label-telemetry text-[11px]">
              <span className="material-symbols-outlined text-[16px] text-primary-fixed">military_tech</span>
              <span className="text-on-surface">
                PROTOCOL COMPLIANCE: <strong className="text-primary-fixed">99.2% INDEX</strong>
              </span>
            </div>
          </div>
        </div>

        {/* 4 Stat Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md mt-space-md pt-space-md bg-surface-container-lowest/60 rounded p-space-md">
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">
              TOTAL SORTIES
            </span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className="font-headline-lg text-headline-lg text-primary">24</span>
              <span className="font-label-telemetry text-[11px] text-primary-fixed uppercase">BENCH LOGGED</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">
              ACTIVE ASSETS
            </span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className="font-headline-lg text-headline-lg text-primary-fixed">02</span>
              <span className="font-label-telemetry text-[11px] text-primary-fixed uppercase animate-pulse">
                SIM-ACTIVE
              </span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">
              AI DEMO DETECTIONS
            </span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className="font-headline-lg text-headline-lg text-secondary">08</span>
              <span className="font-label-telemetry text-[11px] text-error">STAGED BENCH</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-label-telemetry text-label-telemetry text-outline uppercase tracking-wider">
              PUBLISHED TO DEMO
            </span>
            <div className="flex items-baseline gap-space-xs mt-1">
              <span className="font-headline-lg text-headline-lg text-primary">14</span>
              <span className="font-label-telemetry text-[11px] text-primary-fixed uppercase">
                CITIZEN APP STAGING
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. The Four Mission Modules Operational Matrix */}
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
              8-STAGE BENCH PIPELINE
            </span>
            <span className="font-label-telemetry text-[11px] text-outline">SIM STATUS: BENCH FEED ACTIVE</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {sampleModules.map((module) => (
            <MissionCard key={module.id} module={module} />
          ))}
        </div>
      </section>

      {/* 3. Team Ethical Reliability Metrics */}
      <section className="bg-surface-container-low p-space-md rounded-lg border border-surface-variant/40 shadow-xl">
        <div className="flex items-center justify-between pb-space-sm border-b border-surface-variant">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-fixed text-[20px]">health_and_safety</span>
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">[SAFETY]</span>
            <h3 className="font-headline-md text-[18px] text-primary">RELIABILITY INDEX</h3>
          </div>
          <span className="px-2 py-0.5 rounded bg-primary-fixed/10 text-primary-fixed font-label-telemetry text-[10px]">
            ETHICAL BENCHMARK
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md mt-space-sm">
          <div>
            <div className="flex justify-between items-center text-[12px] font-label-telemetry mb-1">
              <span className="text-secondary">Checklist Compliance</span>
              <span className="text-primary font-bold">100% (No Skips)</span>
            </div>
            <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
              <div className="bg-primary-fixed h-full w-[100%]"></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center text-[12px] font-label-telemetry mb-1">
              <span className="text-secondary">AI Verification Accuracy</span>
              <span className="text-primary font-bold">98.4% Precision</span>
            </div>
            <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
              <div className="bg-primary-fixed h-full w-[98.4%]"></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center text-[12px] font-label-telemetry mb-1">
              <span className="text-secondary">Evidence Audit Integrity</span>
              <span className="text-primary font-bold">99.1% Cryptographic</span>
            </div>
            <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden">
              <div className="bg-primary-fixed h-full w-[99.1%]"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

