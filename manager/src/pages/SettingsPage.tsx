import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();

  const [telemetryPollMs, setTelemetryPollMs] = useState<number>(() => {
    const saved = localStorage.getItem('aeron_manager_poll_ms');
    return saved ? parseInt(saved, 10) : 250;
  });
  const [audioAlerts, setAudioAlerts] = useState<boolean>(() => {
    return localStorage.getItem('aeron_manager_audio_alerts') !== 'false';
  });
  const [visualHudGlow, setVisualHudGlow] = useState<boolean>(() => {
    return localStorage.getItem('aeron_manager_hud_glow') !== 'false';
  });
  const [autoStageOutcomes, setAutoStageOutcomes] = useState<boolean>(() => {
    return localStorage.getItem('aeron_manager_auto_stage') === 'true';
  });
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('aeron_manager_poll_ms', telemetryPollMs.toString());
    localStorage.setItem('aeron_manager_audio_alerts', audioAlerts.toString());
    localStorage.setItem('aeron_manager_hud_glow', visualHudGlow.toString());
    localStorage.setItem('aeron_manager_auto_stage', autoStageOutcomes.toString());
    setSavedNotice('Manager GCS preferences saved to local station memory.');
    setTimeout(() => setSavedNotice(null), 4000);
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-primary-fixed tracking-wider">[PREFERENCES]</span>
          <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-mono text-[10px] font-bold border border-primary-fixed/20">
            GCS CONFIG
          </span>
        </div>
        <h1 className="font-sans text-2xl font-bold text-on-surface tracking-tight mt-1">
          Station Settings & Configuration
        </h1>
        <p className="font-sans text-secondary text-xs">
          Manage local GCS flight deck preferences, audio-visual tactical cues, and operator profile.
        </p>
      </div>

      {savedNotice && (
        <div className="p-3 bg-surface-container border border-primary-fixed text-primary-fixed rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>{savedNotice}</span>
          </div>
          <button onClick={() => setSavedNotice(null)} className="text-on-surface hover:text-primary-fixed">✕</button>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-5 font-sans">
        {/* Operator Session Details */}
        <div className="p-6 rounded-xl bg-surface-container-low border border-surface-variant/40 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-surface-variant/40">
            <h3 className="font-bold text-base text-on-surface">Operator Profile & Security</h3>
            <span className="font-mono text-[10px] text-primary-fixed bg-surface-container px-2 py-0.5 rounded border border-primary-fixed/20 font-bold">
              ACTIVE SESSION
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-2 border-b border-surface-variant/30">
              <span className="text-outline">CALLSIGN / NAME</span>
              <span className="text-on-surface font-bold">{user?.name || 'Mission Manager'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-surface-variant/30">
              <span className="text-outline">EMAIL IDENTITY</span>
              <span className="text-secondary">{user?.email || 'manager@aeron.internal'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-surface-variant/30">
              <span className="text-outline">SECURITY CLEARANCE</span>
              <span className="text-primary-fixed font-bold uppercase">{user?.role || 'MANAGER'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-surface-variant/30">
              <span className="text-outline">TRANSPORT AUTH</span>
              <span className="text-secondary">JWT IN-MEMORY + HTTPONLY REFRESH</span>
            </div>
          </div>

          <div className="pt-2 text-xs text-secondary leading-relaxed font-sans">
            Clearance level <strong className="text-on-surface">MANAGER</strong> grants authorization to schedule sorties, review automated AI outcomes, publish citizen notifications, and acknowledge incident triage alarms.
          </div>
        </div>

        {/* Tactical GCS Settings */}
        <div className="p-6 rounded-xl bg-surface-container-low border border-surface-variant/40 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-surface-variant/40">
            <h3 className="font-bold text-base text-on-surface">Tactical GCS Preferences</h3>
            <span className="font-mono text-[10px] text-outline">WORKSPACE CUES</span>
          </div>

          <div className="space-y-4 font-sans text-xs">
            <div>
              <label className="text-outline font-mono text-[11px] block mb-1.5 uppercase">
                TELEMETRY POLLING INTERVAL (MS)
              </label>
              <input
                type="number"
                value={telemetryPollMs}
                min={100}
                max={5000}
                step={50}
                onChange={(e) => setTelemetryPollMs(parseInt(e.target.value) || 250)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-lowest border border-surface-variant/60 text-on-surface font-mono focus:border-primary-fixed focus:outline-none transition-colors"
              />
              <span className="text-[11px] text-secondary mt-1 block">Default 250ms for low-latency live map tracking.</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-surface-variant/30">
              <div>
                <span className="text-on-surface font-medium block">Audio Tactical Alerts</span>
                <span className="text-[11px] text-secondary">Acoustic chime on critical incident detection</span>
              </div>
              <input
                type="checkbox"
                checked={audioAlerts}
                onChange={(e) => setAudioAlerts(e.target.checked)}
                className="w-4 h-4 accent-primary-fixed rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-surface-variant/30">
              <div>
                <span className="text-on-surface font-medium block">Tactical HUD Lighting</span>
                <span className="text-[11px] text-secondary">Aviation softened green glow on live telemetry indicators</span>
              </div>
              <input
                type="checkbox"
                checked={visualHudGlow}
                onChange={(e) => setVisualHudGlow(e.target.checked)}
                className="w-4 h-4 accent-primary-fixed rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-surface-variant/30">
              <div>
                <span className="text-on-surface font-medium block">Explicit Outcome Staging</span>
                <span className="text-[11px] text-secondary">Require dual confirmation before broadcasting to citizen app</span>
              </div>
              <input
                type="checkbox"
                checked={autoStageOutcomes}
                onChange={(e) => setAutoStageOutcomes(e.target.checked)}
                className="w-4 h-4 accent-primary-fixed rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-sans text-xs font-bold transition-all shadow-[0_0_12px_rgba(191,244,46,0.25)]"
            >
              SAVE GCS SETTINGS
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
