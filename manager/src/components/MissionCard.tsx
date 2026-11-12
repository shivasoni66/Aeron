import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MissionModuleData } from '../types';

interface MissionCardProps {
  module: MissionModuleData;
}

export const MissionCard: React.FC<MissionCardProps> = ({ module }) => {
  const navigate = useNavigate();

  const getModuleRoute = (code: string) => {
    switch (code) {
      case 'CIVIC_ISSUE_VERIFICATION':
        return '/civic-issue-verification';
      case 'CROWD_SAFETY':
        return '/crowd-safety';
      case 'MICRO_CLIMATE':
        return '/micro-climate-monitoring';
      case 'SUBTERRANEAN_SEARCH_RESCUE':
        return '/search-and-rescue';
      default:
        return '/all-missions';
    }
  };

  const getModuleTheme = (code: string) => {
    switch (code) {
      case 'CIVIC_ISSUE_VERIFICATION':
        return {
          accent: 'text-aeron-lime',
          borderClass: 'border-l-4 border-l-aeron-lime hover:border-aeron-lime/40',
          iconTileClass: 'bg-aeron-lime/15 text-aeron-lime border-aeron-lime/30',
          progressClass: 'bg-aeron-lime',
          badgeClass: 'bg-aeron-lime/15 text-aeron-lime border-aeron-lime/30'
        };
      case 'CROWD_SAFETY':
        return {
          accent: 'text-telemetry-cyan',
          borderClass: 'border-l-4 border-l-telemetry-cyan hover:border-telemetry-cyan/40',
          iconTileClass: 'bg-telemetry-cyan/15 text-telemetry-cyan border-telemetry-cyan/30',
          progressClass: 'bg-telemetry-cyan',
          badgeClass: 'bg-telemetry-cyan/15 text-telemetry-cyan border-telemetry-cyan/30'
        };
      case 'MICRO_CLIMATE':
        return {
          accent: 'text-caution-amber',
          borderClass: 'border-l-4 border-l-caution-amber hover:border-caution-amber/40',
          iconTileClass: 'bg-caution-amber/15 text-caution-amber border-caution-amber/30',
          progressClass: 'bg-caution-amber',
          badgeClass: 'bg-caution-amber/15 text-caution-amber border-caution-amber/30'
        };
      case 'SUBTERRANEAN_SEARCH_RESCUE':
        return {
          accent: 'text-sar-violet',
          borderClass: 'border-l-4 border-l-sar-violet hover:border-sar-violet/40',
          iconTileClass: 'bg-sar-violet/15 text-sar-violet border-sar-violet/30',
          progressClass: 'bg-sar-violet',
          badgeClass: 'bg-sar-violet/15 text-sar-violet border-sar-violet/30'
        };
      default:
        return {
          accent: 'text-aeron-lime',
          borderClass: 'border-l-4 border-l-aeron-lime hover:border-aeron-lime/40',
          iconTileClass: 'bg-aeron-lime/15 text-aeron-lime border-aeron-lime/30',
          progressClass: 'bg-aeron-lime',
          badgeClass: 'bg-aeron-lime/15 text-aeron-lime border-aeron-lime/30'
        };
    }
  };

  const theme = getModuleTheme(module.code);

  return (
    <div className={`p-5 rounded-2xl bg-surface hover:bg-surface-elevated/80 transition-all flex flex-col justify-between group shadow-sm border border-border ${theme.borderClass}`}>
      <div className="flex flex-col space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${theme.iconTileClass}`}>
              <span className="material-symbols-outlined text-[18px]">{module.icon}</span>
            </div>
            <span className={`font-mono text-xs font-bold uppercase tracking-wider ${theme.accent}`}>
              {module.code}
            </span>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${theme.badgeClass}`}>
            +{module.xpReward} XP
          </span>
        </div>

        <div>
          <h3 className="font-sans font-bold text-base text-text-primary group-hover:text-text-primary transition-colors">
            {module.title}
          </h3>
          <p className="font-sans text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">{module.description}</p>
        </div>

        {/* 8-Stage Tracker */}
        <div className="pt-2 bg-surface-secondary p-3.5 rounded-xl border border-border/80">
          <div className="flex items-center justify-between font-mono text-xs mb-1.5">
            <span className="text-text-primary font-bold text-[11px] truncate max-w-[180px]">
              STAGE {module.stage}/8: {module.stageLabel}
            </span>
            <span className={`font-bold ${theme.accent}`}>{module.progressPercent}%</span>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-sm transition-all ${
                  idx < module.stage - 1
                    ? theme.progressClass
                    : idx === module.stage - 1
                    ? `${theme.progressClass} animate-pulse`
                    : 'bg-surface-elevated'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-text-muted mt-2 pt-1.5 border-t border-border/50">
            <span>AIRFRAME: <strong className="text-text-primary">{module.asset}</strong></span>
            <span>SORTIES: <strong className={theme.accent}>{module.sortiesLogged}</strong></span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
        <span className="font-mono text-[10px] text-text-muted tracking-wider uppercase">AERON PIPELINE</span>
        <button
          onClick={() => navigate(getModuleRoute(module.code))}
          className={`${theme.accent} hover:opacity-80 font-mono text-xs flex items-center gap-1 font-bold transition-all`}
        >
          <span>OPEN MODULE</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
