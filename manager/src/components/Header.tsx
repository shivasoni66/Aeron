import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  activeMissionsCount?: number;
  openIncidentsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeMissionsCount = 0,
  openIncidentsCount = 0
}) => {
  const { user, logout } = useAuth();

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
            {activeMissionsCount} {activeMissionsCount === 1 ? 'MISSION' : 'MISSIONS'} ACTIVE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-space-md">
        {openIncidentsCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-error-container/30 border border-error/30 text-error">
            <span className="material-symbols-outlined text-[16px]">crisis_alert</span>
            <span className="font-label-telemetry text-label-telemetry tracking-wide uppercase">
              {openIncidentsCount} INCIDENT {openIncidentsCount === 1 ? 'ALERT' : 'ALERTS'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-surface-variant text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-primary-fixed">check_circle</span>
            <span className="font-label-telemetry text-label-telemetry tracking-wide uppercase">
              ZERO OPEN ALERTS
            </span>
          </div>
        )}

        <div className="h-6 w-[1px] bg-surface-variant"></div>

        <div className="flex items-center gap-space-sm">
          <div className="text-right hidden md:block">
            <div className="font-label-pill text-label-pill text-on-surface font-semibold flex items-center justify-end gap-1">
              <span className="material-symbols-outlined text-[16px] text-primary-fixed">shield</span>
              <span>{user?.name || 'Mission Manager'}</span>
            </div>
            <div className="text-[11px] font-label-telemetry text-on-surface-variant uppercase">
              {user?.role || 'MANAGER'} // {user?.email || 'authenticated'}
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Sign Out of Operations Command"
            className="w-9 h-9 rounded-full bg-surface-container-high hover:bg-error-container text-on-surface hover:text-error flex items-center justify-center border border-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
