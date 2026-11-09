import React from 'react';
import { useAuth } from '../context/AuthContext';

export const AccessDeniedPage: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-gutter text-center select-none">
      <div className="w-full max-w-lg bg-surface-container-low border border-error/40 rounded p-space-lg shadow-2xl relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-error-container/30 border border-error text-error flex items-center justify-center mx-auto mb-space-md">
          <span className="material-symbols-outlined text-4xl">gpp_bad</span>
        </div>

        <span className="font-label-telemetry text-label-telemetry text-error uppercase tracking-widest block mb-1">
          SECURITY BOUNDARY VIOLATION [403 FORBIDDEN]
        </span>
        <h1 className="font-headline-lg text-headline-lg text-primary mb-space-sm">
          ADMINISTRATOR ACCESS ONLY
        </h1>

        <p className="font-body-md text-secondary mb-space-md text-body-sm leading-relaxed">
          The <strong className="text-on-surface">AERON Drone Intelligence</strong> panel manages physical flight
          controllers, avionics buses, and direct telemetry. Your account is authorized as{' '}
          <strong className="text-primary-fixed uppercase tracking-wider">{user?.role || 'UNKNOWN'}</strong>.
        </p>

        <div className="p-space-sm bg-surface-container-lowest rounded text-left mb-space-md font-label-telemetry text-[11px] space-y-1 border-l-2 border-error">
          <div className="flex justify-between text-on-surface-variant">
            <span>AUTHENTICATED ID:</span>
            <span className="text-on-surface">{user?.id}</span>
          </div>
          <div className="flex justify-between text-on-surface-variant">
            <span>CURRENT ROLE:</span>
            <span className="text-error font-bold">{user?.role}</span>
          </div>
          <div className="flex justify-between text-on-surface-variant">
            <span>REQUIRED ROLE:</span>
            <span className="text-primary-fixed font-bold">admin</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-space-sm">
          <button
            onClick={() => logout()}
            className="py-space-sm px-space-md rounded bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-pill text-label-pill tracking-wider uppercase transition-colors"
          >
            DISCONNECT &amp; SWITCH OPERATOR
          </button>
        </div>
      </div>
    </div>
  );
};

