import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-surface-variant z-40 px-space-lg flex items-center justify-between">
      <div className="flex items-center gap-space-lg">
        <div className="flex items-baseline gap-space-xs">
          <span className="font-headline-md text-headline-md tracking-wider text-primary">AERON</span>
          <span className="text-outline text-body-sm font-label-telemetry">— MISSION INTELLIGENCE</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-surface-variant">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-fixed opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-fixed"></span>
          </span>
          <span className="font-label-telemetry text-label-telemetry text-primary-fixed tracking-wider uppercase">
            4 MISSIONS ACTIVE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-space-md">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-error-container/30 border border-error/30 text-error">
          <span className="material-symbols-outlined text-[16px]">crisis_alert</span>
          <span className="font-label-telemetry text-label-telemetry tracking-wide uppercase">2 INCIDENT ALERTS</span>
        </div>
        <div className="h-6 w-[1px] bg-surface-variant"></div>
        <div className="flex items-center gap-space-sm">
          <div className="text-right hidden md:block">
            <div className="font-label-pill text-label-pill text-on-surface font-semibold flex items-center justify-end gap-1">
              <span className="material-symbols-outlined text-[16px] text-primary-fixed">shield</span> Flight Commander
            </div>
            <div className="text-[11px] font-label-telemetry text-on-surface-variant">OP-8842-X • GCS BENCH [LVL 03]</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center ring-2 ring-primary-fixed/30">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};

