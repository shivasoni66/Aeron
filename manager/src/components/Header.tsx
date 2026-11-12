import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useManagerOperations } from '../contexts/ManagerOperationsContext';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { activeMissionsCount, openIncidentsCount } = useManagerOperations();
  const [profileOpen, setProfileOpen] = useState(false);

  // Derive manager initials
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'MO';

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface/95 backdrop-blur-xl border-b border-border z-40 px-6 flex items-center justify-between text-text-primary shadow-sm">
      {/* Brand & Live Airspace Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-baseline gap-1.5">
            <span className="font-sans font-extrabold text-lg tracking-wider text-text-primary">
              AERON
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-aeron-lime" />
          </div>
          <span className="text-border">•</span>
          <span className="font-sans text-xs text-text-secondary tracking-wide font-medium">
            Mission Intelligence
          </span>
        </div>

        {/* Authoritative Active Mission Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-aeron-lime/10 border border-aeron-lime/30">
          <span className="w-2 h-2 rounded-full bg-aeron-lime animate-pulse shadow-[0_0_8px_#BFF42E]" />
          <span className="font-sans text-xs text-aeron-lime font-semibold">
            {activeMissionsCount} {activeMissionsCount === 1 ? 'active sortie' : 'active sorties'}
          </span>
        </div>
      </div>

      {/* Global Status, Alerts & Profile */}
      <div className="flex items-center gap-3.5">
        {openIncidentsCount > 0 ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-critical-coral/15 border border-critical-coral/40 text-critical-coral shadow-sm">
            <span className="material-symbols-outlined text-[16px]">crisis_alert</span>
            <span className="font-sans text-xs font-semibold">
              {openIncidentsCount} {openIncidentsCount === 1 ? 'incident' : 'incidents'} under triage
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-elevated border border-border text-text-secondary">
            <span className="material-symbols-outlined text-[16px] text-telemetry-cyan">check_circle</span>
            <span className="font-sans text-xs font-medium text-text-secondary">
              Airspace nominal
            </span>
          </div>
        )}

        {/* Manager Operator Tile */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-surface-elevated rounded-lg border border-border text-xs">
          <span className="material-symbols-outlined text-[16px] text-aeron-lime">military_tech</span>
          <span className="text-text-muted font-sans">Operator:</span>
          <span className="font-sans font-medium text-text-primary truncate max-w-[150px]">
            {user?.name || 'Mission Manager'}
          </span>
        </div>

        {/* Profile Avatar with Initials */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-9 h-9 rounded-full bg-surface-elevated hover:bg-surface-secondary text-aeron-lime font-sans font-bold text-xs flex items-center justify-center transition-all border border-border hover:border-aeron-lime/40 shadow-sm"
            title="Operations Manager Profile"
          >
            {initials}
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-surface-elevated border border-border rounded-xl p-3 shadow-2xl z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="p-2 border-b border-border/80 mb-2">
                <span className="text-text-primary block font-bold truncate text-sm font-sans">{user?.name}</span>
                <span className="text-text-muted block text-xs truncate mt-0.5 font-sans">{user?.email}</span>
                <span className="px-2 py-0.5 rounded bg-aeron-lime/15 text-aeron-lime font-semibold text-[11px] mt-2 inline-block border border-aeron-lime/30 font-sans">
                  Role: {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Manager'}
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
