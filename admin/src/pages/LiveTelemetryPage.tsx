import React, { useEffect, useState } from 'react';
import { fetchLatestTelemetry, fetchTelemetryHistory } from '../services/api';
import { subscribeToDroneTelemetry } from '../services/socket';
import { TelemetryData } from '../types';

export const LiveTelemetryPage: React.FC = () => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [packetHistory, setPacketHistory] = useState<TelemetryData[]>([]);
  const [packetCount, setPacketCount] = useState<number>(0);
  const [lastPacketTime, setLastPacketTime] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'pfd' | 'raw'>('pfd');

  useEffect(() => {
    let isMounted = true;

    // Load initial telemetry and history
    const loadInitial = async () => {
      try {
        const [latestRes, historyRes] = await Promise.allSettled([
          fetchLatestTelemetry('AERON-HEX-01'),
          fetchTelemetryHistory('AERON-HEX-01', 20)
        ]);

        if (isMounted) {
          if (latestRes.status === 'fulfilled' && latestRes.value.telemetry) {
            setTelemetry(latestRes.value.telemetry);
            setLastPacketTime(Date.now());
          }
          if (historyRes.status === 'fulfilled') {
            setPacketHistory(historyRes.value.history);
            setPacketCount(historyRes.value.count);
          }
        }
      } catch (err) {
        console.warn('[LiveTelemetry] Initial fetch error:', err);
      }
    };

    loadInitial();

    // Subscribe to live socket telemetry
    const cleanup = subscribeToDroneTelemetry('AERON-HEX-01', (packet: any) => {
      if (!isMounted || !packet) return;
      const t = packet as TelemetryData;
      setTelemetry((prev) => ({ ...prev, ...t }));
      setLastPacketTime(Date.now());
      setPacketCount((c) => c + 1);
      setPacketHistory((prev) => [t, ...prev.slice(0, 24)]);
    });

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  const isConnected = !!telemetry && (lastPacketTime !== null && Date.now() - lastPacketTime < 15000);
  const isSimulated = telemetry?.isSimulated ?? false;

  // Telemetry metrics or fallback placeholders
  const alt = telemetry?.altitude !== undefined ? telemetry.altitude.toFixed(1) : '--';
  const relAlt = telemetry?.relativeAltitude !== undefined ? telemetry.relativeAltitude.toFixed(1) : '--';
  const speed = telemetry?.groundSpeed !== undefined ? telemetry.groundSpeed.toFixed(1) : '--';
  const speedKmh = telemetry?.groundSpeed !== undefined ? (telemetry.groundSpeed * 3.6).toFixed(1) : '--';
  const heading = telemetry?.heading !== undefined ? Math.round(telemetry.heading) : 0;
  const voltage = telemetry?.batteryVoltage !== undefined ? telemetry.batteryVoltage.toFixed(2) : '--';
  const current = telemetry?.batteryCurrent !== undefined ? telemetry.batteryCurrent.toFixed(1) : '--';
  const battPct = telemetry?.batteryPercentage !== undefined ? telemetry.batteryPercentage : 0;
  const sats = telemetry?.satellites !== undefined ? telemetry.satellites : 0;
  const fixType = telemetry?.gpsFixType || 'NO FIX';
  const mode = telemetry?.flightMode || 'STANDBY / BENCH TEST';
  const isArmed = telemetry?.armed ?? false;
  const hdop = telemetry?.hdop !== undefined ? telemetry.hdop.toFixed(2) : '--';

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner & Control Row */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-primary-container animate-pulse shadow-[0_0_8px_#bff42e]' : 'bg-surface-variant'}`} />
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              LIVE TELEMETRY STREAM
            </h1>
          </div>
          <span className={`px-2 py-0.5 rounded font-label-telemetry text-label-telemetry font-bold ${
            isSimulated ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-container text-on-primary-container'
          }`}>
            {isSimulated ? 'SIMULATOR SOURCE' : 'PHYSICAL HARDWARE'}
          </span>
          <span className="font-label-telemetry text-label-telemetry text-on-surface-variant">
            BUFFER: <strong className="text-primary-fixed">{packetCount}</strong> PACKETS
          </span>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded font-label-telemetry text-[11px]">
          <button
            onClick={() => setActiveTab('pfd')}
            className={`px-3 py-1 rounded transition-colors ${activeTab === 'pfd' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            TACTICAL PFD HUD
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1 rounded transition-colors ${activeTab === 'raw' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            RAW MAVLINK BUFFER
          </button>
        </div>
      </div>

      {activeTab === 'pfd' ? (
        <>
          {/* Main Flight Display Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
            {/* Primary Flight Display (Attitude & Compass) */}
            <div className="lg:col-span-8 bg-surface-container-lowest p-space-lg rounded border border-outline-variant/30 flex flex-col items-center justify-center relative min-h-[420px] overflow-hidden">
              {/* Artificial Horizon / Pitch Ladder Representation */}
              <div className="w-full max-w-lg aspect-video rounded border border-surface-container-highest bg-[#0d0d0d] relative flex items-center justify-center overflow-hidden shadow-inner">
                {/* Sky / Ground Split Background */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#112233]/40 via-transparent to-[#1c1508]/40 pointer-events-none" />

                {/* Horizon Line */}
                <div className="absolute left-0 right-0 h-[2px] bg-primary-container/70 shadow-[0_0_8px_#bff42e]" />

                {/* Pitch Ladder lines */}
                <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none space-y-8 opacity-40">
                  <div className="w-24 border-t border-primary text-[9px] font-label-telemetry text-center text-primary-fixed">+10°</div>
                  <div className="w-16 border-t border-primary/50 text-[9px] font-label-telemetry text-center text-primary-fixed">+05°</div>
                  <div className="w-32 border-t-2 border-primary-container text-center text-[10px] font-bold text-primary-fixed">00° LEVEL</div>
                  <div className="w-16 border-t border-primary/50 text-[9px] font-label-telemetry text-center text-primary-fixed">-05°</div>
                  <div className="w-24 border-t border-primary text-[9px] font-label-telemetry text-center text-primary-fixed">-10°</div>
                </div>

                {/* Flight Crosshair */}
                <div className="relative z-10 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-primary-fixed rounded-full flex items-center justify-center shadow-[0_0_12px_#bff42e]">
                    <div className="w-1.5 h-1.5 bg-primary-container rounded-full" />
                  </div>
                  <div className="absolute -left-12 w-10 h-[2px] bg-primary-fixed" />
                  <div className="absolute -right-12 w-10 h-[2px] bg-primary-fixed" />
                </div>

                {/* Flight Mode & Armed Overlay */}
                <div className="absolute top-3 left-4 flex flex-col font-label-telemetry">
                  <span className="text-[10px] text-on-surface-variant">FLIGHT MODE</span>
                  <span className="text-sm font-bold text-primary-fixed uppercase tracking-wider">{mode}</span>
                </div>

                <div className="absolute top-3 right-4 flex flex-col items-end font-label-telemetry">
                  <span className="text-[10px] text-on-surface-variant">ARM STATUS</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    isArmed ? 'bg-error text-on-error animate-pulse' : 'bg-primary-container text-on-primary-container'
                  }`}>
                    {isArmed ? 'ARMED [LIVE PROPULSION]' : 'SAFE // DISARMED'}
                  </span>
                </div>

                {/* Bottom HUD: Altitude & Speed Tapes */}
                <div className="absolute bottom-3 left-4 font-label-telemetry">
                  <span className="text-[10px] text-on-surface-variant block">SPEED</span>
                  <span className="text-xl font-bold text-on-surface">{speed} <span className="text-xs text-primary-fixed">m/s</span></span>
                  <span className="text-[10px] text-on-surface-variant block">({speedKmh} km/h)</span>
                </div>

                <div className="absolute bottom-3 right-4 font-label-telemetry text-right">
                  <span className="text-[10px] text-on-surface-variant block">ALTITUDE (AGL / MSL)</span>
                  <span className="text-xl font-bold text-primary-fixed">{relAlt}m <span className="text-xs text-on-surface-variant">/ {alt}m</span></span>
                </div>
              </div>

              {/* Compass Heading Tape */}
              <div className="mt-space-md w-full max-w-lg bg-surface-container-high p-space-sm rounded flex items-center justify-between font-label-telemetry text-label-telemetry">
                <span className="text-on-surface-variant">HEADING:</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-primary-fixed">{heading.toString().padStart(3, '0')}°</span>
                  <span className="text-xs text-on-surface-variant">
                    {heading >= 337.5 || heading < 22.5 ? 'N' :
                     heading >= 22.5 && heading < 67.5 ? 'NE' :
                     heading >= 67.5 && heading < 112.5 ? 'E' :
                     heading >= 112.5 && heading < 157.5 ? 'SE' :
                     heading >= 157.5 && heading < 202.5 ? 'S' :
                     heading >= 202.5 && heading < 247.5 ? 'SW' :
                     heading >= 247.5 && heading < 292.5 ? 'W' : 'NW'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                  <span>HDOP: <strong className="text-on-surface">{hdop}</strong></span>
                  <span>|</span>
                  <span>SATS: <strong className="text-primary-fixed">{sats}</strong></span>
                </div>
              </div>
            </div>

            {/* Right Diagnostic Stack */}
            <div className="lg:col-span-4 space-y-space-md">
              {/* Power & LiPo Health */}
              <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm">
                <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-2">
                  <span className="font-label-telemetry text-label-telemetry text-on-surface font-bold">4S POWER MODULE</span>
                  <span className="font-label-telemetry text-label-telemetry text-primary-fixed font-bold">{voltage}V</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-body-sm font-label-telemetry text-[11px]">
                    <span className="text-on-surface-variant">BATTERY STATE</span>
                    <span className="text-on-surface font-bold">{battPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        battPct > 40 ? 'bg-primary-container' : battPct > 20 ? 'bg-amber-400' : 'bg-error'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, battPct))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-space-xs pt-2 font-label-telemetry text-[11px]">
                  <div className="bg-surface-container-high p-2 rounded">
                    <span className="text-on-surface-variant block text-[9px]">CURRENT DRAW</span>
                    <span className="text-sm font-bold text-on-surface">{current} A</span>
                  </div>
                  <div className="bg-surface-container-high p-2 rounded">
                    <span className="text-on-surface-variant block text-[9px]">EST CELL AVG</span>
                    <span className="text-sm font-bold text-primary-fixed">
                      {telemetry?.batteryVoltage ? (telemetry.batteryVoltage / 4).toFixed(2) : '--'} V
                    </span>
                  </div>
                </div>
              </div>

              {/* GNSS / Navigation Bench */}
              <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm">
                <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-2">
                  <span className="font-label-telemetry text-label-telemetry text-on-surface font-bold">GNSS RECEIVER</span>
                  <span className="px-2 py-0.5 rounded font-label-telemetry text-[10px] bg-primary-container text-on-primary-container font-bold">
                    {fixType}
                  </span>
                </div>

                <div className="space-y-2 font-label-telemetry text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">LATITUDE</span>
                    <span className="text-on-surface font-bold">{telemetry?.latitude ? `${telemetry.latitude.toFixed(6)}°` : '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">LONGITUDE</span>
                    <span className="text-on-surface font-bold">{telemetry?.longitude ? `${telemetry.longitude.toFixed(6)}°` : '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">SATELLITES</span>
                    <span className="text-primary-fixed font-bold">{sats} IN VIEW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">ACCURACY (HDOP)</span>
                    <span className="text-on-surface font-bold">{hdop}</span>
                  </div>
                </div>
              </div>

              {/* Link Quality & Failsafe */}
              <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry text-[11px]">
                <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-2">
                  <span className="text-on-surface font-bold">FAILSAFE MONITORS</span>
                  <span className="text-primary-fixed">ARM SAFE</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">RC LINK LOSS</span>
                    <span className="text-primary-fixed font-bold">RTL (RETURN TO LAUNCH)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">LOW BATT (14.0V)</span>
                    <span className="text-primary-fixed font-bold">LAND IMMEDIATELY</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">GEOFENCE 500M</span>
                    <span className="text-primary-fixed font-bold">BRAKE & HOLD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Raw MAVLink Packet History Table */
        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 overflow-x-auto">
          <table className="w-full text-left font-label-telemetry text-label-telemetry">
            <thead>
              <tr className="border-b border-surface-container-highest/60 text-on-surface-variant text-[10px]">
                <th className="py-2 px-3">RECORDED AT</th>
                <th className="py-2 px-3">MODE</th>
                <th className="py-2 px-3">ALT (AGL)</th>
                <th className="py-2 px-3">SPD (M/S)</th>
                <th className="py-2 px-3">BATT</th>
                <th className="py-2 px-3">SATS</th>
                <th className="py-2 px-3">LAT / LON</th>
                <th className="py-2 px-3">ARMED</th>
                <th className="py-2 px-3">SOURCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-highest/40 text-[11px]">
              {packetHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                    NO TELEMETRY PACKETS IN BUFFER — WAITING FOR MAVLINK BRIDGE...
                  </td>
                </tr>
              ) : (
                packetHistory.map((p, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-high/40 transition-colors">
                    <td className="py-2 px-3 text-on-surface">
                      {p.recordedAt ? new Date(p.recordedAt).toLocaleTimeString() : '--'}
                    </td>
                    <td className="py-2 px-3 text-primary-fixed font-bold">{p.flightMode || 'STANDBY'}</td>
                    <td className="py-2 px-3 text-on-surface">{p.relativeAltitude !== undefined ? `${p.relativeAltitude.toFixed(1)}m` : '--'}</td>
                    <td className="py-2 px-3 text-on-surface">{p.groundSpeed !== undefined ? `${p.groundSpeed.toFixed(1)}m/s` : '--'}</td>
                    <td className="py-2 px-3 text-on-surface">{p.batteryVoltage !== undefined ? `${p.batteryVoltage.toFixed(1)}V` : '--'}</td>
                    <td className="py-2 px-3 text-primary-fixed">{p.satellites ?? 0}</td>
                    <td className="py-2 px-3 text-on-surface-variant">
                      {p.latitude ? `${p.latitude.toFixed(4)}, ${p.longitude?.toFixed(4)}` : '--'}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.armed ? 'bg-error text-on-error' : 'bg-surface-variant text-on-surface-variant'}`}>
                        {p.armed ? 'ARMED' : 'DISARMED'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${p.isSimulated ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-container text-on-primary-container'}`}>
                        {p.source || (p.isSimulated ? 'SIM' : 'REAL')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

