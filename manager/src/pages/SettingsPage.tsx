import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  const [telemetryPollMs, setTelemetryPollMs] = useState<number>(250);
  const [audioAlerts, setAudioAlerts] = useState<boolean>(true);
  const [visualHudGlow, setVisualHudGlow] = useState<boolean>(true);
  const [autoStageOutcomes, setAutoStageOutcomes] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice('Manager GCS preferences updated successfully.');
    setTimeout(() => setSavedNotice(null), 4000);
  };

  return (
    <div className="flex flex-col w-full gap-space-lg font-label-telemetry text-xs">
      {/* Header */}
      <div>
        <div className="flex items-center gap-space-sm">
          <span className="font-label-telemetry text-label-telemetry text-primary-fixed">[PREFERENCES]</span>
          <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-label-telemetry text-[10px] font-bold">
            GCS CONFIG
          </span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-0.5">
          STATION SETTINGS & SYSTEM CONFIGURATION
        </h1>
        <p className="font-body-sm text-secondary text-xs">
          Manage local GCS flight deck preferences, audio-visual tactical cues, and operator profile.
        </p>
      </div>

      {savedNotice && (
        <div className="p-space-sm bg-primary-container/20 border border-primary-fixed text-primary-fixed rounded flex items-center justify-between">
          <span>{savedNotice}</span>
          <button onClick={() => setSavedNotice(null)}>✕</button>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        {/* Operator Session Details */}
        <div className="p-space-lg rounded bg-surface-container-low border border-surface-variant/40 space-y-3">
          <h3 className="font-headline-md text-base text-primary">OPERATOR CREDENTIALS</h3>
          <div className="space-y-2">
            <div className="flex justify-between py-1.5 border-b border-surface-variant/30">
              <span className="text-outline">CALLSIGN / NAME</span>
              <span className="text-primary font-bold">{user?.name || 'Mission Manager'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-surface-variant/30">
              <span className="text-outline">EMAIL IDENTITY</span>
              <span className="text-on-surface">{user?.email || 'manager@aeron.internal'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-surface-variant/30">
              <span className="text-outline">ROLE CLEARANCE</span>
              <span className="text-primary-fixed font-bold uppercase">{user?.role || 'MANAGER'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-surface-variant/30">
              <span className="text-outline">TRANSPORT AUTH</span>
              <span className="text-secondary">JWT IN-MEMORY + HTTPONLY REFRESH</span>
            </div>
          </div>
        </div>

        {/* Tactical GCS Settings */}
        <div className="p-space-lg rounded bg-surface-container-low border border-surface-variant/40 space-y-4">
          <h3 className="font-headline-md text-base text-primary">TACTICAL GCS PREFERENCES</h3>

          <div className="space-y-3">
            <div>
              <label className="text-outline block mb-1">TELEMETRY POLLING INTERVAL (MS)</label>
              <input
                type="number"
                value={telemetryPollMs}
                min={100}
                max={5000}
                step={50}
                onChange={(e) => setTelemetryPollMs(parseInt(e.target.value) || 250)}
                className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-on-surface block">AUDIO TACTICAL ALERTS</span>
                <span className="text-[10px] text-outline">Chirp on new critical incident breach</span>
              </div>
              <input
                type="checkbox"
                checked={audioAlerts}
                onChange={(e) => setAudioAlerts(e.target.checked)}
                className="w-4 h-4 accent-primary-fixed"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-on-surface block">TACTICAL HUD GLOW</span>
                <span className="text-[10px] text-outline">High-voltage neon accents on active missions</span>
              </div>
              <input
                type="checkbox"
                checked={visualHudGlow}
                onChange={(e) => setVisualHudGlow(e.target.checked)}
                className="w-4 h-4 accent-primary-fixed"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <span className="text-on-surface block">AUTOMATIC VERIFICATION STAGING</span>
                <span className="text-[10px] text-outline">Require explicit manual click to publish</span>
              </div>
              <input
                type="checkbox"
                checked={autoStageOutcomes}
                onChange={(e) => setAutoStageOutcomes(e.target.checked)}
                className="w-4 h-4 accent-primary-fixed"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-bold font-label-pill shadow-[0_0_12px_rgba(191,244,46,0.3)]"
            >
              SAVE GCS SETTINGS
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

