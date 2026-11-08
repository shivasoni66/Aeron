import React from 'react';
import { MissionModuleData } from '../types';

interface MissionCardProps {
  module: MissionModuleData;
}

export const MissionCard: React.FC<MissionCardProps> = ({ module }) => {
  return (
    <div className="p-space-lg rounded bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between group shadow-md relative overflow-hidden border border-surface-variant/40">
      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary-fixed"></div>

      <div className="flex flex-col gap-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-primary-fixed">{module.icon}</span>
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">{module.code}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/40 font-label-telemetry text-[10px] font-bold">
            +{module.xpReward} XP QUALITY
          </span>
        </div>

        <h3 className="font-headline-md text-headline-md text-primary group-hover:text-primary-fixed transition-colors">
          {module.title}
        </h3>
        <p className="font-body-sm text-body-sm text-secondary">{module.description}</p>

        {/* 8-Stage Tracker */}
        <div className="mt-space-xs pt-space-xs bg-surface-container-lowest/70 p-2.5 rounded border border-surface-variant/50">
          <div className="flex items-center justify-between font-label-telemetry text-[10px] mb-1.5">
            <span className="text-primary-fixed font-bold">
              STAGE {module.stage}/8: {module.stageLabel}
            </span>
            <span className="text-primary-fixed font-bold">{module.progressPercent}%</span>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-sm ${
                  idx < module.stage - 1
                    ? 'bg-primary-fixed'
                    : idx === module.stage - 1
                    ? 'bg-primary-fixed animate-pulse'
                    : 'bg-surface-variant'
                }`}
              ></div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] font-label-telemetry text-outline mt-1.5">
            <span>ASSET: {module.asset}</span>
            <span>SORTIES: {module.sortiesLogged}</span>
          </div>
        </div>
      </div>

      <div className="mt-space-md flex items-center justify-between">
        <span className="font-label-telemetry text-[11px] text-outline">AERON-PIPELINE</span>
        <button className="text-primary-fixed hover:underline font-label-telemetry text-[12px] flex items-center gap-1 font-bold">
          REVIEW EVIDENCE <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

