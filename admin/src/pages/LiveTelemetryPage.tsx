import React, { useEffect, useState } from 'react';
import { fetchLatestTelemetry, fetchTelemetryHistory } from '../services/api';
import { subscribeToDroneTelemetry } from '../services/socket';
import { TelemetryData } from '../types';
import {
  ACTIVE_DRONE_ID,
  resolveBatteryState,
  formatBatteryCurrent,
  BATTERY_WARNING_VOLTAGE,
  BATTERY_CRITICAL_VOLTAGE
} from '../config/drone';

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
        let latestRes = await fetchLatestTelemetry(ACTIVE_DRONE_ID).catch(() => null);
        let historyRes = await fetchTelemetryHistory(ACTIVE_DRONE_ID, 30).catch(() => null);

        if (!latestRes?.telemetry && ACTIVE_DRONE_ID !== 'AERON-HEX-01') {
          latestRes = await fetchLatestTelemetry('AERON-HEX-01').catch(() => null);
          historyRes = await fetchTelemetryHistory('AERON-HEX-01', 30).catch(() => null);
        }

        if (isMounted) {
          if (latestRes?.telemetry) {
            setTelemetry(latestRes.telemetry);
            setLastPacketTime(Date.now());
          }
          if (historyRes) {
            setPacketHistory(historyRes.history);
            setPacketCount(historyRes.count);
          }
        }
      } catch (err) {
        console.warn('[LiveTelemetry] Initial fetch error:', err);
      }
    };

    loadInitial();

    const handleAttitude = (rawAtt: any) => {
      if (!isMounted || !rawAtt) return;
      setTelemetry((prev) => ({
        ...prev,
        droneId: rawAtt.droneId || prev?.droneId || ACTIVE_DRONE_ID,
        roll: rawAtt.roll,
        pitch: rawAtt.pitch,
        yaw: rawAtt.yaw,
        heading: rawAtt.yaw,
        climbRate: rawAtt.climbRate !== undefined ? rawAtt.climbRate : prev?.climbRate,
        attitudeUpdatedAt: rawAtt.recordedAt || new Date().toISOString()
      }));
      setLastPacketTime(Date.now());
    };

    const cleanupActive = subscribeToDroneTelemetry(
      ACTIVE_DRONE_ID,
      (packet: any) => {
        if (!isMounted || !packet) return;
        const t = packet as TelemetryData;
        setTelemetry((prev) => ({ ...prev, ...t }));
        setLastPacketTime(Date.now());
        setPacketCount((c) => c + 1);
        setPacketHistory((prev) => [t, ...prev.slice(0, 49)]);
      },
      handleAttitude
    );

    const cleanupSecondary = ACTIVE_DRONE_ID !== 'AERON-PX4-BENCH01'
      ? subscribeToDroneTelemetry(
          'AERON-PX4-BENCH01',
          (packet: any) => {
            if (!isMounted || !packet) return;
            const t = packet as TelemetryData;
            setTelemetry((prev) => ({ ...prev, ...t }));
            setLastPacketTime(Date.now());
            setPacketCount((c) => c + 1);
            setPacketHistory((prev) => [t, ...prev.slice(0, 49)]);
          },
          handleAttitude
        )
      : () => {};

    return () => {
      isMounted = false;
      cleanupActive();
      cleanupSecondary();
    };
  }, []);

  const isConnected = !!telemetry && lastPacketTime !== null && Date.now() - lastPacketTime < 15000;
  const isSimulated = telemetry?.isSimulated ?? false;
  const droneId = telemetry?.droneId || ACTIVE_DRONE_ID;

  // Primary Flight Instruments
  const alt = typeof telemetry?.altitude === 'number' ? telemetry.altitude.toFixed(1) : '--';
  const relAlt = typeof telemetry?.relativeAltitude === 'number' ? telemetry.relativeAltitude.toFixed(1) : '--';
  const speed = typeof telemetry?.groundSpeed === 'number' ? telemetry.groundSpeed.toFixed(1) : '--';
  const speedKmh = typeof telemetry?.groundSpeed === 'number' ? (telemetry.groundSpeed * 3.6).toFixed(1) : '--';
  const heading = typeof telemetry?.heading === 'number'
    ? Math.round(telemetry.heading)
    : (typeof telemetry?.yaw === 'number' ? Math.round(telemetry.yaw) : 0);

  // Attitude & Rates
  const roll = typeof telemetry?.roll === 'number' ? telemetry.roll : 0;
  const pitch = typeof telemetry?.pitch === 'number' ? telemetry.pitch : 0;
  const yaw = typeof telemetry?.yaw === 'number' ? telemetry.yaw : heading;
  const climbRate = typeof telemetry?.climbRate === 'number' ? telemetry.climbRate : 0;

  // Dynamic Artificial Horizon Offset (clamped to prevent overflow)
  const pitchOffsetPx = Math.max(-120, Math.min(120, pitch * 4));

  // 3S LiPo Power Module calculations
  const batt = resolveBatteryState(telemetry, isConnected);

  const sats = typeof telemetry?.satellites === 'number' ? telemetry.satellites : 0;
  const fixType = telemetry?.gpsFixType || 'NO FIX';
  const mode = telemetry?.flightMode || 'STANDBY / BENCH TEST';
  const isArmed = telemetry?.armed ?? false;
  const hdop = typeof telemetry?.hdop === 'number' ? telemetry.hdop.toFixed(2) : '--';
  const source = telemetry?.source || (isSimulated ? 'SIMULATION' : 'REAL');

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-success animate-pulse' : 'bg-text-muted'
              }`}
            />
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              Live Telemetry Stream
            </h1>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded text-[11px] font-sans font-semibold ${
              isSimulated
                ? 'bg-warning/15 text-warning border border-warning/30'
                : 'bg-success/15 text-success border border-success/30'
            }`}
          >
            {isSimulated ? 'Bench Simulator' : 'Physical Hardware (Pixhawk 2.4.8)'}
          </span>
          <span className="font-sans text-xs text-text-muted">
            Airframe: <strong className="text-text-primary font-mono">{droneId}</strong>
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
            <div className="lg:col-span-8 bg-surface p-6 rounded-xl border border-border shadow-sm flex flex-col items-center justify-center relative min-h-[480px] overflow-hidden">
              {/* Tactical Horizon Display Box */}
              <div className="w-full max-w-xl aspect-video rounded-xl border border-border bg-[#0D100E] relative flex items-center justify-center overflow-hidden shadow-inner">
                {/* Dynamic Pitch and Roll Horizon Element */}
                <div
                  className="absolute w-[220%] h-[220%] pointer-events-none transition-transform duration-100 ease-linear flex flex-col items-center justify-center"
                  style={{
                    transform: `rotate(${-roll}deg) translateY(${pitchOffsetPx}px)`,
                    transformOrigin: 'center center'
                  }}
                >
                  {/* Sky Half (Upper Half) */}
                  <div className="w-full h-1/2 bg-gradient-to-t from-[#142633]/60 to-[#0A1624]/90 flex flex-col justify-end items-center pb-2">
                    {/* Pitch Ladder Positive (Climb) */}
                    <div className="flex flex-col items-center space-y-6 opacity-75 font-mono text-[10px] text-accent-primary">
                      <div className="flex items-center gap-2">
                        <span className="w-8 border-t-2 border-accent-primary" />
                        <span>+20°</span>
                        <span className="w-8 border-t-2 border-accent-primary" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 border-t border-accent-primary/60" />
                        <span>+15°</span>
                        <span className="w-5 border-t border-accent-primary/60" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-8 border-t-2 border-accent-primary" />
                        <span>+10°</span>
                        <span className="w-8 border-t-2 border-accent-primary" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 border-t border-accent-primary/60" />
                        <span>+05°</span>
                        <span className="w-5 border-t border-accent-primary/60" />
                      </div>
                    </div>
                  </div>

                  {/* Horizon Line (00° LEVEL) */}
                  <div className="w-full h-[2px] bg-accent-primary shadow-[0_0_12px_rgba(191,244,46,0.9)] relative flex items-center justify-center">
                    <span className="absolute bg-[#0D100E]/85 px-2 py-0.5 rounded text-[9px] font-mono font-bold text-accent-primary tracking-widest border border-accent-primary/40">
                      00° LEVEL
                    </span>
                  </div>

                  {/* Ground Half (Lower Half) */}
                  <div className="w-full h-1/2 bg-gradient-to-b from-[#2B1B10]/60 to-[#140D07]/90 flex flex-col justify-start items-center pt-2">
                    {/* Pitch Ladder Negative (Dive) */}
                    <div className="flex flex-col items-center space-y-6 opacity-75 font-mono text-[10px] text-[#E08A3C]">
                      <div className="flex items-center gap-2">
                        <span className="w-5 border-t border-dashed border-[#E08A3C]/70" />
                        <span>-05°</span>
                        <span className="w-5 border-t border-dashed border-[#E08A3C]/70" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-8 border-t-2 border-dashed border-[#E08A3C]" />
                        <span>-10°</span>
                        <span className="w-8 border-t-2 border-dashed border-[#E08A3C]" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 border-t border-dashed border-[#E08A3C]/70" />
                        <span>-15°</span>
                        <span className="w-5 border-t border-dashed border-[#E08A3C]/70" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-8 border-t-2 border-dashed border-[#E08A3C]" />
                        <span>-20°</span>
                        <span className="w-8 border-t-2 border-dashed border-[#E08A3C]" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Roll Bank Indicator Scale */}
                <div className="absolute top-2 w-72 h-10 flex flex-col items-center pointer-events-none z-20">
                  <div className="relative w-full flex justify-between font-mono text-[9px] text-text-muted px-2">
                    <span>-45°</span>
                    <span>-30°</span>
                    <span>-10°</span>
                    <span className="text-accent-primary font-bold">▲ 0°</span>
                    <span>+10°</span>
                    <span>+30°</span>
                    <span>+45°</span>
                  </div>
                  {/* Dynamic Bank Pointer Needle */}
                  <div
                    className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-accent-primary transition-transform duration-100 ease-linear"
                    style={{
                      transform: `rotate(${Math.max(-60, Math.min(60, roll))}deg)`,
                      transformOrigin: '50% 24px'
                    }}
                  />
                </div>

                {/* Fixed Center Aircraft Reference Crosshair */}
                <div className="relative z-10 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 border-2 border-accent-primary rounded-full flex items-center justify-center shadow-[0_0_14px_rgba(191,244,46,0.5)]">
                    <div className="w-2 h-2 bg-accent-primary rounded-full" />
                  </div>
                  <div className="absolute -left-12 w-10 h-[2px] bg-accent-primary shadow-[0_0_8px_rgba(191,244,46,0.6)]" />
                  <div className="absolute -right-12 w-10 h-[2px] bg-accent-primary shadow-[0_0_8px_rgba(191,244,46,0.6)]" />
                </div>

                {/* Flight Mode & Armed Overlay */}
                <div className="absolute top-4 left-5 flex flex-col font-mono z-20">
                  <span className="text-[10px] text-text-muted">FLIGHT MODE</span>
                  <span className="text-sm font-bold text-accent-primary uppercase tracking-wider">{mode}</span>
                  <span className="text-[10px] text-text-muted mt-0.5">SRC: {source}</span>
                </div>

                <div className="absolute top-4 right-5 flex flex-col items-end font-mono z-20">
                  <span className="text-[10px] text-text-muted">ARM STATUS</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                      isArmed
                        ? 'bg-danger text-white animate-pulse'
                        : 'bg-surface-elevated text-text-secondary border border-border'
                    }`}
                  >
                    {isArmed ? 'Armed • Live' : 'Disarmed • Safe'}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5">ID: {droneId}</span>
                </div>

                {/* Bottom HUD: Altitude & Speed Tapes */}
                <div className="absolute bottom-4 left-5 font-mono z-20">
                  <span className="text-[10px] text-text-muted block uppercase">GROUND SPEED</span>
                  <span className="text-xl font-bold text-text-primary">
                    {speed} <span className="text-xs text-accent-primary">m/s</span>
                  </span>
                  <span className="text-[10px] text-text-muted block">({speedKmh} km/h)</span>
                </div>

                {/* Real-Time Live Attitude Numerical Bar */}
                <div className="absolute bottom-3 font-mono text-center z-20 bg-surface/85 px-3.5 py-1 rounded-md border border-border/70 backdrop-blur-sm shadow-md">
                  <div className="flex items-center gap-3 text-xs">
                    <span>
                      ROLL:{' '}
                      <strong className={Math.abs(roll) > 10 ? 'text-warning font-bold' : 'text-accent-primary font-bold'}>
                        {roll.toFixed(1)}°
                      </strong>
                    </span>
                    <span className="text-border">•</span>
                    <span>
                      PITCH:{' '}
                      <strong className={Math.abs(pitch) > 10 ? 'text-warning font-bold' : 'text-accent-primary font-bold'}>
                        {pitch.toFixed(1)}°
                      </strong>
                    </span>
                    <span className="text-border">•</span>
                    <span>
                      YAW: <strong className="text-text-primary font-bold">{yaw.toFixed(1)}°</strong>
                    </span>
                  </div>
                </div>

                <div className="absolute bottom-4 right-5 font-mono text-right z-20">
                  <span className="text-[10px] text-text-muted block uppercase">ALTITUDE (REL / MSL)</span>
                  <span className="text-xl font-bold text-accent-primary">
                    {relAlt !== '--' ? `${relAlt}m` : 'N/A'} <span className="text-xs text-text-muted">/ {alt !== '--' ? `${alt}m` : 'N/A'}</span>
                  </span>
                  <span className="text-[10px] text-text-muted block">
                    CLIMB:{' '}
                    <strong
                      className={
                        climbRate > 0.2
                          ? 'text-accent-primary'
                          : climbRate < -0.2
                          ? 'text-warning'
                          : 'text-text-secondary'
                      }
                    >
                      {climbRate >= 0 ? '+' : ''}
                      {climbRate.toFixed(1)} m/s
                    </strong>
                    {' • '}<span className="text-[9px] text-text-muted">AGL: N/A</span>
                  </span>
                </div>
              </div>

              {/* Compass Heading Tape */}
              <div className="mt-4 w-full max-w-xl bg-surface-elevated p-3 rounded-lg border border-border flex items-center justify-between font-mono text-xs">
                <span className="text-text-muted">HEADING:</span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-accent-primary">
                    {heading.toString().padStart(3, '0')}°
                  </span>
                  <span className="text-xs text-text-secondary font-bold">
                    {heading >= 337.5 || heading < 22.5
                      ? 'N'
                      : heading >= 22.5 && heading < 67.5
                      ? 'NE'
                      : heading >= 67.5 && heading < 112.5
                      ? 'E'
                      : heading >= 112.5 && heading < 157.5
                      ? 'SE'
                      : heading >= 157.5 && heading < 202.5
                      ? 'S'
                      : heading >= 202.5 && heading < 247.5
                      ? 'SW'
                      : heading >= 247.5 && heading < 292.5
                      ? 'W'
                      : 'NW'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-text-muted">
                  <span>
                    HDOP: <strong className="text-text-primary">{hdop}</strong>
                  </span>
                  <span>|</span>
                  <span>
                    SATS: <strong className="text-accent-primary">{sats}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Diagnostic Stack */}
            <div className="lg:col-span-4 space-y-4">
              {/* Power & 3S LiPo Health */}
              <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text-primary font-bold">3S POWER MODULE</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${batt.sourceBadgeClass}`}>
                      {batt.sourceLabel}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-xs font-bold ${
                      batt.voltage && batt.voltage < BATTERY_WARNING_VOLTAGE
                        ? 'text-warning'
                        : batt.voltage && batt.voltage < BATTERY_CRITICAL_VOLTAGE
                        ? 'text-danger'
                        : 'text-accent-primary'
                    }`}
                  >
                    {batt.voltage !== null ? `${batt.voltage.toFixed(2)}V` : '—'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-text-muted">STATE OF CHARGE (3S LiPo)</span>
                    <span className={`font-bold ${batt.percentage !== null ? 'text-accent-primary font-mono text-sm' : 'text-text-muted text-[11px]'}`}>
                      {batt.percentage !== null ? `${batt.percentage}%` : 'UNKNOWN'}
                    </span>
                  </div>
                  {batt.percentage !== null ? (
                    <div className="w-full h-2.5 bg-surface-elevated rounded-full overflow-hidden border border-border/60">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          batt.percentage > 40 ? 'bg-accent-primary' : batt.percentage > 20 ? 'bg-warning' : 'bg-danger'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, batt.percentage))}%` }}
                      />
                    </div>
                  ) : (
                    <div className="w-full py-1 px-2 bg-surface-elevated rounded border border-border/60 text-[10px] text-text-muted flex justify-between items-center">
                      <span>No voltage or FC telemetry</span>
                      <span className="text-warning font-bold">Awaiting Data</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                  <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
                    <span className="text-text-muted block text-[10px]">CURRENT DRAW</span>
                    <span className="text-sm font-bold text-text-primary">{formatBatteryCurrent(batt.current, isConnected)}</span>
                  </div>
                  <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
                    <span className="text-text-muted block text-[10px]">CELL AVG (3S)</span>
                    <span className="text-sm font-bold text-accent-primary">
                      {batt.cellVoltage !== null ? `${batt.cellVoltage.toFixed(2)} V` : '--'}
                    </span>
                  </div>
                  <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
                    <span className="text-text-muted block text-[10px]">EST. REMAINING</span>
                    <span className="text-sm font-bold text-text-primary">
                      {batt.remainingMah !== null ? `${batt.remainingMah} mAh` : 'Unavailable'}
                    </span>
                  </div>
                  <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
                    <span className="text-text-muted block text-[10px]">FLIGHT TIME</span>
                    <span className="text-[11px] font-bold text-text-secondary truncate">
                      {batt.remainingFlightTimeStr ? batt.remainingFlightTimeStr : 'Bench / Standby'}
                    </span>
                  </div>
                </div>
                <div className="font-mono text-[10px] text-text-muted text-center pt-1 border-t border-border/40 space-y-0.5">
                  <div>Low Alert: 10.50V (3.50V/cell) • Critical RTL: 9.90V (3.30V/cell)</div>
                  <div className="text-[9px] text-text-muted/80">Voltage discharge estimate • Remaining capacity requires current sensor</div>
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
                    <span className="text-text-primary font-bold">
                      {telemetry?.latitude ? `${telemetry.latitude.toFixed(6)}°` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">LONGITUDE:</span>
                    <span className="text-text-primary font-bold">
                      {telemetry?.longitude ? `${telemetry.longitude.toFixed(6)}°` : '--'}
                    </span>
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
                    <span className="text-text-muted">LOW VOLT (10.5V):</span>
                    <span className="text-warning font-bold">AUTO-LAND / RTL</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">CRITICAL VOLT (9.9V):</span>
                    <span className="text-danger font-bold">IMMEDIATE LAND</span>
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
                <th className="py-2.5 px-3">ATTITUDE (R / P)</th>
                <th className="py-2.5 px-3">ALT (AGL)</th>
                <th className="py-2.5 px-3">CLIMB</th>
                <th className="py-2.5 px-3">SPD (M/S)</th>
                <th className="py-2.5 px-3">VOLTS (3S)</th>
                <th className="py-2.5 px-3">SATS</th>
                <th className="py-2.5 px-3">LAT / LON</th>
                <th className="py-2.5 px-3">ARMED</th>
                <th className="py-2.5 px-3">SOURCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-text-secondary">
              {packetHistory.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-text-muted">
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
                    <td className="py-2 px-3 text-text-primary">
                      {typeof p.roll === 'number' ? `${p.roll.toFixed(1)}°` : '--'} / {typeof p.pitch === 'number' ? `${p.pitch.toFixed(1)}°` : '--'}
                    </td>
                    <td className="py-2 px-3 text-text-primary">
                      {typeof p.relativeAltitude === 'number' ? `${p.relativeAltitude.toFixed(1)}m` : '--'}
                    </td>
                    <td className="py-2 px-3 text-text-primary">
                      {typeof p.climbRate === 'number' ? `${p.climbRate >= 0 ? '+' : ''}${p.climbRate.toFixed(1)}m/s` : '--'}
                    </td>
                    <td className="py-2 px-3 text-text-primary">
                      {typeof p.groundSpeed === 'number' ? `${p.groundSpeed.toFixed(1)}m/s` : '--'}
                    </td>
                    <td className="py-2 px-3 text-text-primary">
                      {typeof p.batteryVoltage === 'number' ? `${p.batteryVoltage.toFixed(1)}V` : '--'}
                    </td>
                    <td className="py-2 px-3 text-accent-primary">{typeof p.satellites === 'number' ? p.satellites : 0}</td>
                    <td className="py-2 px-3 text-text-muted">
                      {typeof p.latitude === 'number' && typeof p.longitude === 'number' ? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}` : '--'}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.armed
                            ? 'bg-danger/20 text-danger border border-danger/30'
                            : 'bg-surface-elevated text-text-muted'
                        }`}
                      >
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
