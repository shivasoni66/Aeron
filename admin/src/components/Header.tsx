import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHardware } from '../context/HardwareContext';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { hardwareState, hardwareStatusLabel } = useHardware();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Derive admin initials
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'AD';

  const getStatusBadge = () => {
    if (hardwareState === 'CONNECTED') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-aeron-lime/10 border border-aeron-lime/30">
          <span className="w-2 h-2 rounded-full bg-aeron-lime animate-pulse shadow-[0_0_8px_#BFF42E]" />
          <span className="font-sans text-xs text-aeron-lime font-semibold tracking-normal">
            {hardwareStatusLabel}
          </span>
        </div>
      );
    }
    if (hardwareState === 'SIMULATION') {
      return (
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-caution-amber/10 border border-caution-amber/30">
          <span className="w-2 h-2 rounded-full bg-caution-amber animate-pulse shadow-[0_0_8px_#F2B95F]" />
          <span className="font-sans text-xs text-caution-amber font-semibold tracking-normal">
            {hardwareStatusLabel}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-elevated border border-border">
        <span className="w-2 h-2 rounded-full bg-text-muted" />
        <span className="font-sans text-xs text-text-muted font-medium tracking-normal">
          {hardwareStatusLabel}
        </span>
      </div>
    );
  };

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface/95 backdrop-blur-xl border-b border-border z-40 px-6 flex items-center justify-between text-text-primary shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-sans font-extrabold text-lg tracking-wider text-text-primary">
              AERON
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-aeron-lime" />
          </div>
          <span className="text-border">•</span>
          <span className="font-sans text-xs text-text-secondary tracking-normal font-medium">
            Drone Intelligence GCS
          </span>
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex items-center gap-3.5">
        {/* Operator Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-surface-elevated rounded-lg border border-border">
          <span className="material-symbols-outlined text-[16px] text-aeron-lime">shield</span>
          <span className="font-sans text-xs text-text-muted">Operator:</span>
          <span className="font-sans text-xs font-semibold text-text-primary truncate max-w-[140px]">
            {user?.name || user?.email || 'Administrator'}
          </span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            title="System Diagnostics & Alerts"
            className="p-2 rounded-lg bg-surface-elevated hover:bg-surface-secondary text-text-secondary hover:text-text-primary border border-border transition-colors relative"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-aeron-lime rounded-full shadow-[0_0_6px_#BFF42E]" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-surface-elevated border border-border rounded-xl p-4 shadow-2xl z-50 font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-border/60 mb-3">
                <span className="font-sans font-bold text-xs text-text-primary uppercase tracking-wider">
                  System Diagnostics & Alerts
                </span>
                <span className="font-mono text-[10px] text-aeron-lime font-bold">3 recent</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded-lg bg-surface border border-border/60">
                  <span className="text-telemetry-cyan block font-medium">✓ MAVLink Heartbeat Synced</span>
                  <span className="text-text-muted text-[10px]">Autopilot parameter table verified</span>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-border/60">
                  <span className="text-aeron-lime block font-medium">ℹ Socket.IO Room Connected</span>
                  <span className="text-text-muted text-[10px]">Room: drone:telemetry:AERON-HEX-01</span>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-border/60">
                  <span className="text-text-secondary block font-medium">• Ground Station Initialized</span>
                  <span className="text-text-muted text-[10px]">Bench telemetry link operational</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-9 h-9 rounded-full bg-surface-elevated hover:bg-surface-secondary text-aeron-lime font-sans font-bold text-xs flex items-center justify-center transition-all border border-border hover:border-aeron-lime/40 shadow-sm"
            title="Administrator Profile"
          >
            {initials}
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-surface-elevated border border-border rounded-xl p-3 shadow-2xl z-50 font-sans text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="p-2 border-b border-border/60 mb-2">
                <span className="text-text-primary block font-bold truncate text-sm">{user?.name}</span>
                <span className="text-text-muted block text-[11px] truncate mt-0.5">{user?.email}</span>
                <span className="px-2 py-0.5 rounded bg-aeron-lime/15 text-aeron-lime font-semibold text-[10px] uppercase mt-2 inline-block border border-aeron-lime/30">
                  Role: {user?.role || 'Administrator'}
                </span>
              </div>
              <button
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-critical-coral/20 text-critical-coral transition-colors flex items-center gap-2 font-sans font-semibold text-xs"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
