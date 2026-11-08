import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Drone Overview', icon: 'grid_view' },
  { path: '/live-telemetry', label: 'Live Telemetry', icon: 'vital_signs' },
  { path: '/hardware-and-sensors', label: 'Hardware & Sensors', icon: 'memory' },
  { path: '/live-camera', label: 'Live Camera', icon: 'videocam' },
  { path: '/gps-tracking', label: 'GPS Tracking', icon: 'share_location' },
  { path: '/flight-analytics', label: 'Flight Analytics', icon: 'monitoring' },
  { path: '/flight-history', label: 'Flight History', icon: 'history' },
  { path: '/flight-logs', label: 'Flight Logs', icon: 'subject' },
  { path: '/system-health', label: 'System Health', icon: 'health_metrics' },
  { path: '/drone-configuration', label: 'Drone Configuration', icon: 'tune' },
  { path: '/settings', label: 'Settings', icon: 'settings' }
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-72 bg-surface-container-low z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.4)]">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="h-16 px-gutter flex items-center justify-between bg-surface-container-lowest">
          <div className="flex items-center gap-space-sm">
            <div className="w-3 h-3 rounded-full bg-primary-container shadow-[0_0_12px_#bff42e]"></div>
            <span className="font-headline-md text-headline-md tracking-wider text-primary">AERON</span>
          </div>
          <span className="font-label-telemetry text-label-telemetry text-primary-fixed uppercase">GCS-SYS</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-space-sm py-space-md space-y-space-xs">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-space-sm px-space-md py-space-sm rounded transition-colors text-body-sm font-body-sm ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-space-md bg-surface-container-lowest m-space-sm rounded">
        <div className="flex items-center justify-between mb-space-xs">
          <span className="font-label-telemetry text-label-telemetry text-on-surface-variant">SYS-VOLTAGE</span>
          <span className="font-label-telemetry text-label-telemetry text-primary-fixed">24.8V</span>
        </div>
        <div className="w-full h-1 bg-surface-variant rounded-full overflow-hidden">
          <div className="h-full w-4/5 bg-primary-container"></div>
        </div>
      </div>
    </aside>
  );
};

