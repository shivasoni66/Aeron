import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Mission Dashboard', icon: 'grid_view' },
  { path: '/all-missions', label: 'All Missions', icon: 'flight_takeoff' },
  { path: '/live-mission-control', label: 'Live Mission Control', icon: 'radar' },
  { path: '/civic-issue-verification', label: 'Civic Issue Verification', icon: 'verified' },
  { path: '/crowd-safety', label: 'Crowd Safety', icon: 'groups' },
  { path: '/micro-climate-monitoring', label: 'Micro-Climate Monitoring', icon: 'air' },
  { path: '/search-and-rescue', label: 'Search & Rescue', icon: 'person_search' },
  { path: '/trip-and-route-history', label: 'Trip & Route History', icon: 'route' },
  { path: '/incident-management', label: 'Incident Management', icon: 'warning' },
  { path: '/mission-outcomes', label: 'Mission Outcomes', icon: 'task_alt' },
  { path: '/reports-and-analytics', label: 'Reports & Analytics', icon: 'analytics' },
  { path: '/settings', label: 'Settings', icon: 'tune' }
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-surface-container-lowest border-r border-surface-variant z-50 flex flex-col justify-between overflow-y-auto">
      <div className="flex flex-col">
        {/* Brand & Identity */}
        <div className="h-16 px-space-lg flex items-center gap-space-sm border-b border-surface-variant bg-surface-container-lowest">
          <span className="font-headline-lg text-headline-lg tracking-wider text-primary">AERON</span>
          <span className="text-[10px] font-label-telemetry text-primary-fixed uppercase tracking-widest px-2 py-0.5 rounded bg-surface-variant border border-outline-variant">
            MISSION INTEL
          </span>
        </div>

        {/* Navigation Sections */}
        <div className="px-space-md py-space-sm">
          <div className="px-space-sm py-space-xs mb-space-xs">
            <span className="text-[10px] font-label-telemetry uppercase tracking-wider text-outline">
              Operations Flight Deck
            </span>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-space-sm px-space-md py-2.5 rounded transition-all text-body-sm font-body-sm ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container font-semibold shadow-[0_0_16px_rgba(191,244,46,0.2)]'
                      : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Operator Rank / Progression Foundation (Honest unpersisted state per Task 07 spec) */}
      <div className="p-space-md border-t border-surface-variant bg-surface-container-low">
        <div className="p-2.5 rounded bg-surface-container-lowest border border-surface-variant mb-space-sm">
          <div className="flex items-center justify-between text-[11px] font-label-telemetry">
            <span className="text-primary-fixed flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">military_tech</span> OPERATOR RANK
            </span>
            <span className="text-on-surface-variant text-[10px]">STANDBY</span>
          </div>
          <div className="w-full bg-surface-container h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div className="bg-primary-fixed/40 h-full w-[25%]"></div>
          </div>
          <div className="flex justify-between text-[9px] font-label-telemetry text-outline mt-1">
            <span>FLIGHT COMMANDER</span>
            <span>XP ENGINE: STANDBY</span>
          </div>
        </div>

        <div className="pt-space-xs flex items-center justify-between text-outline text-[11px] font-label-telemetry">
          <span>OPERATIONAL LINK</span>
          <span className="text-primary-fixed">ACTIVE (TLS)</span>
        </div>
      </div>
    </aside>
  );
};
