import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { checkApiHealth, BACKEND_ROOT_URL } from '../services/api';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();

  const [callsign, setCallsign] = useState<string>(() => {
    return localStorage.getItem('aeron_admin_callsign') || 'GCS-OPERATOR-ALPHA';
  });
  const [telemetryRate, setTelemetryRate] = useState<string>(() => {
    return localStorage.getItem('aeron_admin_telemetry_rate') || '5';
  });
  const [unitSystem, setUnitSystem] = useState<'METRIC' | 'IMPERIAL'>(() => {
    const saved = localStorage.getItem('aeron_admin_unit_system');
    return saved === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC';
  });
  const [audioLowBatt, setAudioLowBatt] = useState<boolean>(() => {
    return localStorage.getItem('aeron_admin_audio_low_batt') !== 'false';
  });
  const [audioLinkLoss, setAudioLinkLoss] = useState<boolean>(() => {
    return localStorage.getItem('aeron_admin_audio_link_loss') !== 'false';
  });
  const [mapTheme, setMapTheme] = useState<string>(() => {
    return localStorage.getItem('aeron_admin_map_theme') || 'DARK_MATTER';
  });

  const [apiHealthStatus, setApiHealthStatus] = useState<string | null>(null);
  const [testingHealth, setTestingHealth] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const handleTestHealth = async () => {
    setTestingHealth(true);
    try {
      const res = await checkApiHealth();
      setApiHealthStatus(
        res.status === 'healthy' || res.status === 'ok' || res.status === 'online'
          ? 'Nominal • HTTP 200 OK'
          : 'Offline • Error'
      );
    } catch {
      setApiHealthStatus('Failed to reach API backend');
    } finally {
      setTestingHealth(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('aeron_admin_callsign', callsign);
    localStorage.setItem('aeron_admin_telemetry_rate', telemetryRate);
    localStorage.setItem('aeron_admin_unit_system', unitSystem);
    localStorage.setItem('aeron_admin_audio_low_batt', audioLowBatt.toString());
    localStorage.setItem('aeron_admin_audio_link_loss', audioLinkLoss.toString());
    localStorage.setItem('aeron_admin_map_theme', mapTheme);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[24px]">settings</span>
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              Ground Control Station Settings
            </h1>
          </div>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            Local GCS Preferences • Telemetry Link & Operator Identity
          </p>
        </div>

        {savedNotice && (
          <span className="px-3 py-1 rounded-full bg-success/15 text-success border border-success/30 font-mono text-xs font-bold">
            PREFERENCES SAVED SUCCESSFULLY
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* General & Telemetry Preferences (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Interface & Units Card */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-4 font-mono text-xs">
            <span className="font-sans text-sm font-bold text-text-primary uppercase tracking-wider block border-b border-border/60 pb-3">
              TACTICAL INTERFACE & TELEMETRY
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-text-muted block mb-1.5">OPERATOR CALLSIGN</label>
                <input
                  type="text"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                  className="w-full bg-surface-elevated px-3 py-2 rounded-lg text-text-primary border border-border focus:border-accent-primary outline-none"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1.5">TELEMETRY STREAM RATE</label>
                <select
                  value={telemetryRate}
                  onChange={(e) => setTelemetryRate(e.target.value)}
                  className="w-full bg-surface-elevated px-3 py-2 rounded-lg text-text-primary border border-border outline-none focus:border-accent-primary"
                >
                  <option value="1">1 HZ (LOW BANDWIDTH)</option>
                  <option value="5">5 HZ (STANDARD GCS)</option>
                  <option value="10">10 HZ (HIGH RESOLUTION)</option>
                </select>
              </div>

              <div>
                <label className="text-text-muted block mb-1.5">MEASUREMENT UNITS</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitSystem('METRIC')}
                    className={`flex-1 py-2 rounded-lg border transition-all ${
                      unitSystem === 'METRIC'
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    METRIC (M, M/S, KM/H)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitSystem('IMPERIAL')}
                    className={`flex-1 py-2 rounded-lg border transition-all ${
                      unitSystem === 'IMPERIAL'
                        ? 'bg-surface-elevated border-accent-primary text-accent-primary font-bold'
                        : 'bg-surface-elevated/40 border-border text-text-muted hover:text-text-primary'
                    }`}
                  >
                    IMPERIAL (FT, KNOTS)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1.5">TACTICAL MAP TILE THEME</label>
                <select
                  value={mapTheme}
                  onChange={(e) => setMapTheme(e.target.value)}
                  className="w-full bg-surface-elevated px-3 py-2 rounded-lg text-text-primary border border-border outline-none focus:border-accent-primary"
                >
                  <option value="DARK_MATTER">CARTO DARK MATTER (TACTICAL)</option>
                  <option value="SATELLITE">SATELLITE IMAGERY</option>
                  <option value="MONOCHROME">MONOCHROME VECTOR</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audio Safety Alerts */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-4 font-mono text-xs">
            <span className="font-sans text-sm font-bold text-text-primary uppercase tracking-wider block border-b border-border/60 pb-3">
              AUDIO & VISUAL ALARMS
            </span>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg border border-border/70 cursor-pointer">
                <div>
                  <span className="text-text-primary font-bold block font-sans">Low Battery Audio Tone (14.2V)</span>
                  <span className="text-text-muted text-[11px]">Emits audible frequency tone when LiPo reaches warning voltage</span>
                </div>
                <input
                  type="checkbox"
                  checked={audioLowBatt}
                  onChange={(e) => setAudioLowBatt(e.target.checked)}
                  className="w-4 h-4 accent-[#B5DE53]"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg border border-border/70 cursor-pointer">
                <div>
                  <span className="text-text-primary font-bold block font-sans">Heartbeat Loss Siren (30s)</span>
                  <span className="text-text-muted text-[11px]">Audible alert when MAVLink heartbeat fails for more than 30 seconds</span>
                </div>
                <input
                  type="checkbox"
                  checked={audioLinkLoss}
                  onChange={(e) => setAudioLinkLoss(e.target.checked)}
                  className="w-4 h-4 accent-[#B5DE53]"
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-accent-primary text-background font-sans font-bold text-xs rounded-lg hover:opacity-90 transition-opacity"
          >
            SAVE PREFERENCES
          </button>
        </div>

        {/* System & Identity Sidebar (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Operator Identity Card */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-3 font-mono text-xs">
            <span className="font-sans text-sm font-bold text-text-primary uppercase tracking-wider block border-b border-border/60 pb-3">
              OPERATOR IDENTITY
            </span>

            <div className="space-y-2">
              <div>
                <span className="text-text-muted text-[10px] block">AUTHENTICATED USER</span>
                <span className="text-text-primary font-bold text-sm font-sans">{user?.name || 'Administrator'}</span>
              </div>
              <div>
                <span className="text-text-muted text-[10px] block">EMAIL</span>
                <span className="text-text-secondary">{user?.email || 'admin@aeron.gov'}</span>
              </div>
              <div>
                <span className="text-text-muted text-[10px] block">SECURITY CLEARANCE</span>
                <span className="px-2 py-0.5 rounded bg-accent-primary/15 text-accent-primary border border-accent-primary/30 font-bold inline-block mt-1">
                  ROLE: {user?.role || 'ADMIN'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-2 bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 rounded-lg font-sans font-bold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>SIGN OUT OF GCS</span>
              </button>
            </div>
          </div>

          {/* Backend Connectivity Check */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-3 font-mono text-xs">
            <span className="font-sans text-sm font-bold text-text-primary uppercase tracking-wider block border-b border-border/60 pb-3">
              API BACKEND STATUS
            </span>

            <div className="space-y-2">
              <div>
                <span className="text-text-muted text-[10px] block">RESOLVED ROOT URL</span>
                <span className="text-text-primary break-all">{BACKEND_ROOT_URL}</span>
              </div>
              {apiHealthStatus && (
                <div>
                  <span className="text-text-muted text-[10px] block">TEST RESULT</span>
                  <span className="text-accent-primary font-bold">{apiHealthStatus}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleTestHealth}
              disabled={testingHealth}
              className="w-full py-2 bg-surface-elevated hover:bg-surface-muted border border-border text-text-primary rounded-lg font-mono text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] text-accent-primary ${testingHealth ? 'animate-spin' : ''}`}>
                network_check
              </span>
              <span>TEST API CONNECTIVITY</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
