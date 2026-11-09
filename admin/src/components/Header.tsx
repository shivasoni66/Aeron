import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface-container/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.3)]">
      <div className="w-full h-16 px-gutter flex items-center justify-between">
        <div className="flex items-center gap-space-md">
          <span className="font-label-pill text-label-pill tracking-wider text-on-surface">
            AERON — DRONE INTELLIGENCE
          </span>
          <div className="flex items-center gap-space-xs px-space-sm py-space-xs bg-surface-container-high rounded">
            <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></div>
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">
              HARDWARE BENCH // PIXHAWK 2.4.8 MAVLINK
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-space-xs px-space-sm py-space-xs bg-surface-container-lowest rounded">
            <span className="font-label-telemetry text-label-telemetry text-on-surface-variant">OPERATOR:</span>
            <span className="font-label-telemetry text-label-telemetry text-primary font-bold">
              {user?.name || user?.email || 'ADMIN-OPERATOR'}
            </span>
          </div>

          <button
            title="Notifications"
            className="relative p-space-xs rounded hover:bg-surface-variant hover:text-on-surface text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary-container rounded-full"></span>
          </button>

          {/* User Profile & Logout Menu */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity"
              title="Operator Profile"
            >
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-surface-container-low border border-outline-variant/40 rounded p-space-sm shadow-xl z-50 font-label-telemetry text-[11px]">
                <div className="p-2 border-b border-surface-container-highest/60 mb-2">
                  <span className="text-on-surface block font-bold truncate">{user?.name}</span>
                  <span className="text-on-surface-variant block truncate">{user?.email}</span>
                  <span className="px-1.5 py-0.5 rounded bg-primary-container text-on-primary-container font-bold text-[9px] uppercase mt-1 inline-block">
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-error-container/20 text-error hover:text-error transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>DISCONNECT / LOGOUT</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
