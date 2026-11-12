import React from 'react';
import { NavLink } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  accent?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Tactical Command',
    items: [
      { path: '/', label: 'Mission Dashboard', icon: 'grid_view' },
      { path: '/all-missions', label: 'All Missions', icon: 'flight_takeoff' },
      { path: '/live-mission-control', label: 'Live Mission Control', icon: 'radar' }
    ]
  },
  {
    title: 'Operational Verticals',
    items: [
      { path: '/civic-issue-verification', label: 'Civic Verification', icon: 'verified', accent: 'text-aeron-lime' },
      { path: '/crowd-safety', label: 'Crowd Safety & Mesh', icon: 'groups', accent: 'text-telemetry-cyan' },
      { path: '/micro-climate-monitoring', label: 'Micro-Climate Eco', icon: 'air', accent: 'text-caution-amber' },
      { path: '/search-and-rescue', label: 'Search & Rescue', icon: 'person_search', accent: 'text-sar-violet' }
    ]
  },
  {
    title: 'Ledger & Intelligence',
    items: [
      { path: '/trip-and-route-history', label: 'Trip & Route History', icon: 'route' },
      { path: '/incident-management', label: 'Incident Triage', icon: 'warning' },
      { path: '/mission-outcomes', label: 'Mission Outcomes', icon: 'task_alt' },
      { path: '/reports-and-analytics', label: 'Fleet Analytics', icon: 'analytics' }
    ]
  },
  {
    title: 'System',
    items: [
      { path: '/settings', label: 'Station Settings', icon: 'tune' }
    ]
  }
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-72 bg-[#0D141B] border-r border-border z-50 flex flex-col justify-between select-none">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand & Identity */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-border bg-surface/60">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-aeron-lime shadow-[0_0_10px_#BFF42E]" />
            <span className="font-sans font-extrabold text-lg tracking-wider text-text-primary">
              AERON
            </span>
          </div>
          <span className="font-sans text-[11px] tracking-wide text-aeron-lime bg-surface-elevated px-2.5 py-0.5 rounded border border-border font-medium">
            Mission Intel
          </span>
        </div>

        {/* Grouped Navigation Deck */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <div className="px-3 pb-1.5 text-[11px] font-sans font-semibold tracking-wider text-text-muted uppercase">
                {group.title}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-sans transition-all ${
                      isActive
                        ? 'bg-aeron-lime/[0.08] text-aeron-lime font-medium border-l-2 border-l-aeron-lime rounded-l-none'
                        : 'text-text-secondary hover:bg-surface-elevated/70 hover:text-text-primary border-l-2 border-l-transparent rounded-l-none'
                    }`
                  }
                >
                  <span className={`material-symbols-outlined text-[18px] ${item.accent || ''}`}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Operator Status Footer */}
      <div className="p-3.5 m-3 bg-surface rounded-xl border border-border space-y-2.5 text-xs shadow-inner">
        <div className="flex items-center justify-between font-sans">
          <span className="text-text-muted flex items-center gap-1.5 text-xs font-medium">
            <span className="material-symbols-outlined text-[16px] text-aeron-lime">military_tech</span>
            Command Tier
          </span>
          <span className="text-aeron-lime font-semibold text-xs">Flight Lead</span>
        </div>
        <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden border border-border/60">
          <div className="h-full bg-gradient-to-r from-aeron-lime to-accent-soft rounded-full w-[85%]" />
        </div>
        <div className="flex justify-between text-xs text-text-muted pt-0.5 font-sans">
          <span>Operational link</span>
          <span className="text-telemetry-cyan font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-telemetry-cyan animate-pulse" />
            Secure (TLS)
          </span>
        </div>
      </div>
    </aside>
  );
};
