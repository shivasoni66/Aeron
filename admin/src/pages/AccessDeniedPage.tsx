import React from 'react';
import { useAuth } from '../context/AuthContext';

export const AccessDeniedPage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 text-center select-none text-text-primary">
      <div className="w-full max-w-lg bg-surface border border-danger/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-danger/15 border border-danger/40 text-danger flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">gpp_bad</span>
        </div>

        <span className="font-mono text-xs text-danger uppercase tracking-widest block mb-1 font-bold">
          SECURITY BOUNDARY VIOLATION [403 FORBIDDEN]
        </span>
        <h1 className="font-sans font-bold text-xl text-text-primary mb-3">
          ADMINISTRATOR ACCESS ONLY
        </h1>

        <p className="font-sans text-xs text-text-secondary mb-6 leading-relaxed">
          The <strong className="text-text-primary">AERON Drone Intelligence</strong> panel manages physical flight
          controllers, avionics buses, and direct telemetry. Your account is authorized as{' '}
          <strong className="text-accent-primary uppercase tracking-wider">{user?.role || 'UNKNOWN'}</strong>.
        </p>

        <div className="p-4 bg-surface-elevated rounded-xl text-left mb-6 font-mono text-xs space-y-1.5 border-l-2 border-danger">
          <div className="flex justify-between text-text-muted">
            <span>AUTHENTICATED ID:</span>
            <span className="text-text-primary">{user?.id}</span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>CURRENT ROLE:</span>
            <span className="text-danger font-bold uppercase">{user?.role}</span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>REQUIRED ROLE:</span>
            <span className="text-accent-primary font-bold">admin</span>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <button
            onClick={() => logout()}
            className="py-2.5 px-6 rounded-lg bg-surface-elevated hover:bg-surface-muted text-text-primary border border-border font-sans font-bold text-xs uppercase tracking-wider transition-colors"
          >
            DISCONNECT &amp; SWITCH OPERATOR
          </button>
        </div>
      </div>
    </div>
  );
};
