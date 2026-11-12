import React from 'react';
import { NavLink } from 'react-router-dom';
import { useHardware } from '../context/HardwareContext';

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
    title: 'Avionics Flight Deck',
    items: [
      { path: '/', label: 'Drone Overview', icon: 'grid_view' },
      { path: '/live-telemetry', label: 'Live Telemetry', icon: 'vital_signs', accent: 'text-telemetry-cyan' },
      { path: '/hardware-and-sensors', label: 'Hardware & Sensors', icon: 'memory', accent: 'text-aeron-lime' },
      { path: '/live-camera', label: 'Live Camera HUD', icon: 'videocam', accent: 'text-caution-amber' },
      { path: '/gps-tracking', label: 'GPS Tracking', icon: 'share_location', accent: 'text-navigation-blue' }
    ]
  },
  {
    title: 'Analytics & Flight Ledger',
    items: [
      { path: '/flight-analytics', label: 'Flight Analytics', icon: 'monitoring' },
      { path: '/flight-history', label: 'Flight History', icon: 'history' },
      { path: '/flight-logs', label: 'System & Audit Logs', icon: 'subject' },
      { path: '/system-health', label: 'System Health & CPU', icon: 'health_metrics' }
    ]
  },
  {
    title: 'Avionics Tuning',
    items: [
      { path: '/drone-configuration', label: 'PID & Airframe Tuning', icon: 'tune' },
      { path: '/settings', label: 'GCS Preferences', icon: 'settings' }
    ]
  }
];

export const Sidebar: React.FC = () => {
  const { latestTelemetry, isOnline, hardwareState } = useHardware();
  const voltage = latestTelemetry?.batteryVoltage;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-72 bg-[#0D141B] border-r border-border z-50 flex flex-col justify-between select-none">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-border bg-surface/60">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-aeron-lime shadow-[0_0_10px_#BFF42E]" />
            <span className="font-sans font-extrabold text-lg tracking-wider text-text-primary">
              AERON
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-aeron-lime bg-surface-elevated px-2 py-0.5 rounded border border-border uppercase font-bold">
            GCS V2.4
          </span>
        </div>

        {/* Grouped Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pb-1 text-[11px] font-sans tracking-normal text-text-muted font-medium">
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
                        ? 'border-l-2 border-l-aeron-lime bg-aeron-lime/[0.08] text-aeron-lime font-semibold'
                        : 'text-text-secondary hover:bg-surface-elevated/80 hover:text-text-primary border-l-2 border-l-transparent'
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

      {/* Bench System Power Footer Block */}
      <div className="p-3.5 m-3 bg-surface rounded-xl border border-border space-y-2 shadow-inner">
        <div className="flex items-center justify-between font-sans text-xs">
          <span className="text-text-muted text-[11px]">Bench Voltage</span>
          <span className={`font-mono font-semibold text-[11px] ${isOnline ? 'text-aeron-lime' : 'text-text-secondary'}`}>
            {voltage !== undefined && voltage > 0 ? `${voltage.toFixed(1)}V` : (isOnline ? '24.8V' : 'Offline')}
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden border border-border/60">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isOnline ? 'bg-gradient-to-r from-accent-soft to-aeron-lime shadow-[0_0_8px_#BFF42E]' : 'bg-text-muted/40'}`}
            style={{ width: isOnline ? '82%' : '0%' }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-sans text-text-muted pt-0.5">
          <span>Flight Controller</span>
          <span className={`font-mono text-[10px] font-semibold ${isOnline ? 'text-aeron-lime' : 'text-text-muted'}`}>
            {hardwareState === 'CONNECTED' ? 'Connected' : hardwareState === 'SIMULATION' ? 'Simulated' : 'Standby'}
          </span>
        </div>
      </div>
    </aside>
  );
};
