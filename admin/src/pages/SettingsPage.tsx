import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { checkApiHealth } from '../services/api';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();

  const [callsign, setCallsign] = useState<string>('GCS-OPERATOR-ALPHA');
  const [telemetryRate, setTelemetryRate] = useState<string>('5');
  const [unitSystem, setUnitSystem] = useState<'METRIC' | 'IMPERIAL'>('METRIC');
  const [audioLowBatt, setAudioLowBatt] = useState<boolean>(true);
  const [audioLinkLoss, setAudioLinkLoss] = useState<boolean>(true);
  const [mapTheme, setMapTheme] = useState<string>('DARK_MATTER');

  const [apiHealthStatus, setApiHealthStatus] = useState<string | null>(null);
  const [testingHealth, setTestingHealth] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const handleTestHealth = async () => {
    setTestingHealth(true);
    try {
      const res = await checkApiHealth();
      setApiHealthStatus(res.status === 'ok' || res.status === 'online' ? 'NOMINAL // HTTP 200 OK' : 'OFFLINE // ERROR');
    } catch {
      setApiHealthStatus('FAILED TO REACH API BACKEND');
    } finally {
      setTestingHealth(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">settings</span>
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              GROUND CONTROL STATION SETTINGS
            </h1>
          </div>
          <p className="text-body-sm font-label-telemetry text-on-surface-variant text-[11px] mt-0.5">
            LOCAL GCS PREFERENCES // TELEMETRY LINK & OPERATOR IDENTITY
          </p>
        </div>

        {savedNotice && (
          <span className="px-3 py-1 rounded bg-primary-container text-on-primary-container font-label-telemetry text-[11px] font-bold">
            PREFERENCES SAVED SUCCESSFULLY
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* General & Telemetry Preferences (8 Cols) */}
        <div className="lg:col-span-8 space-y-space-md">
          {/* Interface & Units Card */}
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
            <span className="text-label-telemetry text-on-surface font-bold uppercase block border-b border-surface-container-highest/60 pb-2">
              TACTICAL INTERFACE & TELEMETRY
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              <div>
                <label className="text-on-surface-variant text-[10px] block mb-1">OPERATOR CALLSIGN</label>
                <input
                  type="text"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                  className="w-full bg-surface-container px-3 py-2 rounded text-on-surface border border-outline-variant focus:border-primary outline-none"
                />
              </div>

              <div>
                <label className="text-on-surface-variant text-[10px] block mb-1">TELEMETRY STREAM RATE</label>
                <select
                  value={telemetryRate}
                  onChange={(e) => setTelemetryRate(e.target.value)}
                  className="w-full bg-surface-container px-3 py-2 rounded text-on-surface border border-outline-variant outline-none"
                >
                  <option value="1">1 HZ (LOW BANDWIDTH)</option>
                  <option value="5">5 HZ (STANDARD GCS)</option>
                  <option value="10">10 HZ (HIGH RESOLUTION)</option>
                </select>
              </div>

              <div>
                <label className="text-on-surface-variant text-[10px] block mb-1">MEASUREMENT UNITS</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitSystem('METRIC')}
                    className={`flex-1 py-1.5 rounded ${unitSystem === 'METRIC' ? 'bg-primary-container text-on-primary-container font-bold' : 'bg-surface-container text-on-surface-variant'}`}
                  >
                    METRIC (M, KM/H)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitSystem('IMPERIAL')}
                    className={`flex-1 py-1.5 rounded ${unitSystem === 'IMPERIAL' ? 'bg-primary-container text-on-primary-container font-bold' : 'bg-surface-container text-on-surface-variant'}`}
                  >
                    IMPERIAL (FT, MPH)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-on-surface-variant text-[10px] block mb-1">MAP CARTOGRAPHY THEME</label>
                <select
                  value={mapTheme}
                  onChange={(e) => setMapTheme(e.target.value)}
                  className="w-full bg-surface-container px-3 py-2 rounded text-on-surface border border-outline-variant outline-none"
                >
                  <option value="DARK_MATTER">CARTODB DARK MATTER</option>
                  <option value="OSM">OPENSTREETMAP STANDARD</option>
                </select>
              </div>
            </div>
          </div>

          {/* Audio Safety Alarms */}
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
            <span className="text-label-telemetry text-on-surface font-bold uppercase block border-b border-surface-container-highest/60 pb-2">
              AUDITORY SAFETY ALERTS
            </span>

            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-on-surface font-bold block">LOW BATTERY ACOUSTIC ALARM</span>
                  <span className="text-on-surface-variant text-[10px]">Audio chime when voltage drops below 14.0V threshold</span>
                </div>
                <input
                  type="checkbox"
                  checked={audioLowBatt}
                  onChange={(e) => setAudioLowBatt(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-on-surface font-bold block">MAVLINK TELEMETRY LOSS CHIME</span>
                  <span className="text-on-surface-variant text-[10px]">Alert when no heartbeat received for &gt; 5 seconds</span>
                </div>
                <input
                  type="checkbox"
                  checked={audioLinkLoss}
                  onChange={(e) => setAudioLinkLoss(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
              </label>
            </div>
          </div>

          {/* Network Endpoint Inspector */}
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
            <span className="text-label-telemetry text-on-surface font-bold uppercase block border-b border-surface-container-highest/60 pb-2">
              BACKEND ENDPOINTS & WEBSOCKET PROXY
            </span>

            <div className="space-y-2">
              <div className="flex justify-between items-center bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant">API BASE URL:</span>
                <span className="text-primary-fixed font-bold">http://localhost:5000/api/v1</span>
              </div>
              <div className="flex justify-between items-center bg-surface-container p-2 rounded">
                <span className="text-on-surface-variant">SOCKET SERVER:</span>
                <span className="text-primary-fixed font-bold">http://localhost:5000</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestHealth}
                disabled={testingHealth}
                className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-variant text-on-surface rounded flex items-center gap-1.5"
              >
                <span className={`material-symbols-outlined text-[16px] text-primary ${testingHealth ? 'animate-spin' : ''}`}>
                  network_check
                </span>
                <span>TEST BACKEND LINK</span>
              </button>
              {apiHealthStatus && (
                <span className="text-[10px] text-primary-fixed font-bold">{apiHealthStatus}</span>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-primary-container text-on-primary-container font-bold rounded font-label-telemetry text-xs hover:opacity-90 transition-opacity"
            >
              SAVE GCS CONFIGURATION
            </button>
          </div>
        </div>

        {/* User Identity & Session Info (4 Cols) */}
        <div className="lg:col-span-4 space-y-space-md font-label-telemetry text-[11px]">
          <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm">
            <span className="text-label-telemetry text-on-surface font-bold uppercase block border-b border-surface-container-highest/60 pb-2">
              AUTHENTICATED OPERATOR PROFILE
            </span>

            <div className="space-y-2">
              <div>
                <span className="text-on-surface-variant block text-[10px]">OPERATOR NAME</span>
                <span className="text-on-surface font-bold text-sm">{user?.name || 'ADMIN OPERATOR'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[10px]">AUTHENTICATED EMAIL</span>
                <span className="text-on-surface">{user?.email || 'admin@aeron.internal'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[10px]">SYSTEM ROLE</span>
                <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-bold text-[10px] inline-block uppercase">
                  {user?.role || 'admin'}
                </span>
              </div>
              <div>
                <span className="text-on-surface-variant block text-[10px]">USER ID</span>
                <span className="text-on-surface text-[10px] font-mono">{user?.id || '--'}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-surface-container-highest/60">
              <button
                type="button"
                onClick={logout}
                className="w-full py-2 bg-error-container text-error rounded font-bold hover:bg-error-container/80 transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>DISCONNECT OPERATOR SESSION</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

