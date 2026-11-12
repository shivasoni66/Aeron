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

    const loadInitial = async () => {
      try {
        const [latestRes, historyRes] = await Promise.allSettled([
          fetchLatestTelemetry('AERON-HEX-01'),
          fetchTelemetryHistory('AERON-HEX-01', 30)
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

    const cleanup = subscribeToDroneTelemetry('AERON-HEX-01', (packet: any) => {
      if (!isMounted || !packet) return;
      const t = packet as TelemetryData;
      setTelemetry((prev) => ({ ...prev, ...t }));
      setLastPacketTime(Date.now());
      setPacketCount((c) => c + 1);
      setPacketHistory((prev) => [t, ...prev.slice(0, 49)]);
    });

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  const isConnected = !!telemetry && lastPacketTime !== null && Date.now() - lastPacketTime < 15000;
  const isSimulated = telemetry?.isSimulated ?? false;

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
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? 'bg-success animate-pulse' : 'bg-text-muted'
            }`} />
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              Live Telemetry Stream
            </h1>
          </div>
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-sans font-semibold ${
            isSimulated ? 'bg-warning/15 text-warning border border-warning/30' : 'bg-success/15 text-success border border-success/30'
          }`}>
            {isSimulated ? 'Bench Simulator' : 'Hardware Sensors'}
          </span>
          <span className="font-sans text-xs text-text-muted">
            Stream buffer: <strong className="text-accent-primary font-mono">{packetCount}</strong> packets
          </span>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-border font-sans text-xs">
          <button
            onClick={() => setActiveTab('pfd')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'pfd'
                ? 'bg-accent-primary text-background font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Tactical PFD HUD
          </button>
          <button
            onClick={() => setActiveTab('raw')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === 'raw'
                ? 'bg-accent-primary text-background font-semibold shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Raw MAVLink Buffer ({packetHistory.length})
          </button>
        </div>
      </div>

      {activeTab === 'pfd' ? (
        <>
          {/* Main Flight Display & Diagnostic Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Primary Flight Display (PFD) */}
            <div className="lg:col-span-8 bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col items-center justify-center relative min-h-[460px] overflow-hidden">
              {/* Tactical Horizon Display Box */}
              <div className="w-full max-w-xl aspect-video rounded-xl border border-border bg-[#0D100E] relative flex items-center justify-center overflow-hidden shadow-inner">
                {/* Sky / Ground Split Background */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#14231E]/40 via-transparent to-[#1F1810]/40 pointer-events-none" />

                {/* Horizon Line */}
                <div className="absolute left-0 right-0 h-[1.5px] bg-accent-primary/80 shadow-[0_0_8px_rgba(181,222,83,0.4)]" />

                {/* Pitch Ladder lines */}
                <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none space-y-7 opacity-30 font-mono text-[9px] text-accent-primary">
                  <div className="w-24 border-t border-accent-primary text-center">+10°</div>
                  <div className="w-16 border-t border-accent-primary/60 text-center">+05°</div>
                  <div className="w-32 border-t-2 border-accent-primary text-center font-bold">00° LEVEL</div>
                  <div className="w-16 border-t border-accent-primary/60 text-center">-05°</div>
                  <div className="w-24 border-t border-accent-primary text-center">-10°</div>
                </div>

                {/* Flight Crosshair */}
                <div className="relative z-10 flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-accent-primary rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(181,222,83,0.3)]">
                    <div className="w-1.5 h-1.5 bg-accent-primary rounded-full" />
                  </div>
                  <div className="absolute -left-12 w-10 h-[2px] bg-accent-primary" />
                  <div className="absolute -right-12 w-10 h-[2px] bg-accent-primary" />
                </div>

                {/* Flight Mode & Armed Overlay */}
                <div className="absolute top-4 left-5 flex flex-col font-mono">
                  <span className="text-[10px] text-text-muted">FLIGHT MODE</span>
                  <span className="text-sm font-bold text-accent-primary uppercase tracking-wider">{mode}</span>
                </div>

                <div className="absolute top-4 right-5 flex flex-col items-end font-mono">
                  <span className="text-[10px] text-text-muted">ARM STATUS</span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                    isArmed ? 'bg-danger text-white animate-pulse' : 'bg-surface-elevated text-text-secondary border border-border'
                  }`}>
                    {isArmed ? 'Armed • Live' : 'Disarmed • Safe'}
                  </span>
                </div>

                {/* Bottom HUD: Altitude & Speed Tapes */}
                <div className="absolute bottom-4 left-5 font-mono">
                  <span className="text-[10px] text-text-muted block uppercase">AIR/GROUND SPEED</span>
                  <span className="text-xl font-bold text-text-primary">
                    {speed} <span className="text-xs text-accent-primary">m/s</span>
                  </span>
                  <span className="text-[10px] text-text-muted block">({speedKmh} km/h)</span>
                </div>

                <div className="absolute bottom-4 right-5 font-mono text-right">
                  <span className="text-[10px] text-text-muted block uppercase">ALTITUDE (AGL / MSL)</span>
                  <span className="text-xl font-bold text-accent-primary">
                    {relAlt}m <span className="text-xs text-text-muted">/ {alt}m</span>
                  </span>
                </div>
              </div>

              {/* Compass Heading Tape */}
              <div className="mt-4 w-full max-w-xl bg-surface-elevated p-3 rounded-lg border border-border flex items-center justify-between font-mono text-xs">
                <span className="text-text-muted">HEADING:</span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-accent-primary">{heading.toString().padStart(3, '0')}°</span>
                  <span className="text-xs text-text-secondary font-bold">
                    {heading >= 337.5 || heading < 22.5 ? 'N' :
                     heading >= 22.5 && heading < 67.5 ? 'NE' :
                     heading >= 67.5 && heading < 112.5 ? 'E' :
                     heading >= 112.5 && heading < 157.5 ? 'SE' :
                     heading >= 157.5 && heading < 202.5 ? 'S' :
                     heading >= 202.5 && heading < 247.5 ? 'SW' :
                     heading >= 247.5 && heading < 292.5 ? 'W' : 'NW'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-text-muted">
                  <span>HDOP: <strong className="text-text-primary">{hdop}</strong></span>
                  <span>|</span>
                  <span>SATS: <strong className="text-accent-primary">{sats}</strong></span>
                </div>
              </div>
            </div>

            {/* Right Diagnostic Stack */}
            <div className="lg:col-span-4 space-y-4">
              {/* Power & LiPo Health */}
              <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <span className="font-mono text-xs text-text-primary font-bold">4S POWER MODULE</span>
                  <span className="font-mono text-xs text-accent-primary font-bold">{voltage}V</span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-text-muted">BATTERY STATE</span>
                    <span className="text-text-primary font-bold">{battPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden border border-border/60">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        battPct > 40 ? 'bg-accent-primary' : battPct > 20 ? 'bg-warning' : 'bg-danger'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, battPct))}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                  <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
                    <span className="text-text-muted block text-[10px]">CURRENT DRAW</span>
                    <span className="text-sm font-bold text-text-primary">{current} A</span>
                  </div>
                  <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
                    <span className="text-text-muted block text-[10px]">CELL AVG</span>
                    <span className="text-sm font-bold text-accent-primary">
                      {telemetry?.batteryVoltage ? (telemetry.batteryVoltage / 4).toFixed(2) : '--'} V
                    </span>
                  </div>
                </div>
              </div>

              {/* GNSS Receiver */}
              <div className="bg-surface p-5 rounded-xl border border-border space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <span className="text-text-primary font-bold">GNSS RECEIVER</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-surface-elevated text-accent-primary font-bold border border-border">
                    {fixType}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-text-muted">LATITUDE:</span>
                    <span className="text-text-primary font-bold">{telemetry?.latitude ? `${telemetry.latitude.toFixed(6)}°` : '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">LONGITUDE:</span>
                    <span className="text-text-primary font-bold">{telemetry?.longitude ? `${telemetry.longitude.toFixed(6)}°` : '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">SATELLITES:</span>
                    <span className="text-accent-primary font-bold">{sats} IN VIEW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">ACCURACY (HDOP):</span>
                    <span className="text-text-primary font-bold">{hdop}</span>
                  </div>
                </div>
              </div>

              {/* Failsafe Safety Policy */}
              <div className="bg-surface p-5 rounded-xl border border-border space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <span className="text-text-primary font-bold">FAILSAFE PROTOCOLS</span>
                  <span className="text-success font-bold">ARM SAFE</span>
                </div>
                <div className="space-y-2 text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">LINK LOSS (RC/GCS):</span>
                    <span className="text-accent-primary font-bold">RTL (RETURN)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">LOW VOLT (14.0V):</span>
                    <span className="text-warning font-bold">AUTO-LAND</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">GEOFENCE BREACH:</span>
                    <span className="text-danger font-bold">BRAKE & HOVER</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Raw MAVLink Packet History Table */
        <div className="bg-surface p-5 rounded-xl border border-border shadow-sm overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-border/80 text-text-muted text-[11px] uppercase">
                <th className="py-2.5 px-3">RECORDED AT</th>
                <th className="py-2.5 px-3">MODE</th>
                <th className="py-2.5 px-3">ALT (AGL)</th>
                <th className="py-2.5 px-3">SPD (M/S)</th>
                <th className="py-2.5 px-3">VOLTS</th>
                <th className="py-2.5 px-3">SATS</th>
                <th className="py-2.5 px-3">LAT / LON</th>
                <th className="py-2.5 px-3">ARMED</th>
                <th className="py-2.5 px-3">SOURCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-text-secondary">
              {packetHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-text-muted">
                    NO TELEMETRY PACKETS IN BUFFER — WAITING FOR MAVLINK STREAM...
                  </td>
                </tr>
              ) : (
                packetHistory.map((p, idx) => (
                  <tr key={idx} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="py-2 px-3 text-text-primary">
                      {p.recordedAt ? new Date(p.recordedAt).toLocaleTimeString() : '--'}
                    </td>
                    <td className="py-2 px-3 text-accent-primary font-bold">{p.flightMode || 'STANDBY'}</td>
                    <td className="py-2 px-3 text-text-primary">{p.relativeAltitude !== undefined ? `${p.relativeAltitude.toFixed(1)}m` : '--'}</td>
                    <td className="py-2 px-3 text-text-primary">{p.groundSpeed !== undefined ? `${p.groundSpeed.toFixed(1)}m/s` : '--'}</td>
                    <td className="py-2 px-3 text-text-primary">{p.batteryVoltage !== undefined ? `${p.batteryVoltage.toFixed(1)}V` : '--'}</td>
                    <td className="py-2 px-3 text-accent-primary">{p.satellites ?? 0}</td>
                    <td className="py-2 px-3 text-text-muted">
                      {p.latitude ? `${p.latitude.toFixed(4)}, ${p.longitude?.toFixed(4)}` : '--'}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.armed ? 'bg-danger/20 text-danger border border-danger/30' : 'bg-surface-elevated text-text-muted'
                      }`}>
                        {p.armed ? 'ARMED' : 'DISARMED'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-surface-elevated text-text-secondary border border-border">
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
