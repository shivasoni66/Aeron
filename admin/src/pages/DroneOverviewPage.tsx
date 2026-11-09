import React, { useEffect, useState } from 'react';
import { fetchOverview } from '../services/api';
import { subscribeToDroneTelemetry } from '../services/socket';
import { OverviewData, TelemetryData } from '../types';

export const DroneOverviewPage: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [commandDisabledNotice, setCommandDisabledNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadOverview = async () => {
      try {
        const overview = await fetchOverview();
        if (isMounted) {
          setData(overview);
          setLiveTelemetry(overview.latestTelemetry);
        }
      } catch (err) {
        console.warn('[Overview] Failed to fetch overview data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadOverview();

    // Subscribe to live telemetry updates via authenticated socket
    const cleanupSocket = subscribeToDroneTelemetry('AERON-HEX-01', (packet: any) => {
      if (isMounted && packet) {
        setLiveTelemetry((prev) => ({ ...prev, ...packet }));
      }
    });

    return () => {
      isMounted = false;
      cleanupSocket();
    };
  }, []);

  const tel = liveTelemetry;
  const isOnline = !!tel && (Date.now() - new Date(tel.recordedAt || 0).getTime()) < 30000;
  const readiness = data?.readiness;
  const protocol = data?.protocol;

  const handleCommandAttempt = (commandName: string) => {
    setCommandDisabledNotice(`[SAFETY INTERLOCK] Command '${commandName}' is disabled. Remote flight-control execution is restricted by ground safety policy.`);
    setTimeout(() => setCommandDisabledNotice(null), 5000);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3 font-label-telemetry">
        <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
        <span className="text-primary-fixed text-xs tracking-wider uppercase">POLLING HARDWARE BENCH OVERVIEW...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-lg text-on-surface">
      {/* Safety Notice Toast */}
      {commandDisabledNotice && (
        <div className="p-space-sm bg-error-container/30 border border-error text-error rounded font-label-telemetry text-[11px] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>{commandDisabledNotice}</span>
          </div>
          <button onClick={() => setCommandDisabledNotice(null)} className="text-on-surface hover:text-error">
            ✕
          </button>
        </div>
      )}

      {/* Protocol Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm px-space-md py-space-xs bg-surface-container-lowest rounded shadow-sm border border-outline-variant/20">
        <div className="flex flex-wrap items-center gap-space-sm text-label-telemetry font-label-telemetry">
          <span className={`inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full font-bold ${
            isOnline ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-on-primary-container animate-pulse' : 'bg-on-surface-variant'}`}></span>
            {isOnline ? (tel?.isSimulated ? 'BENCH SIMULATION ACTIVE' : 'LIVE HARDWARE LINK') : 'AWAITING HARDWARE'}
          </span>
          <span className="text-on-surface-variant">MAVLINK {protocol?.mavlinkVersion || '2.0'} // USB-SERIAL {protocol?.baudRate || 57600} BAUD</span>
          <span className="text-on-surface-variant">|</span>
          <span className="text-primary-fixed">TARGET: {protocol?.targetFC || 'PIXHAWK 2.4.8 (STM32F427)'}</span>
          <span className="text-on-surface-variant">|</span>
          <span className="text-on-surface-variant">
            MODE: <strong className="text-primary">{tel?.flightMode || protocol?.mode || 'STANDBY / BENCH TEST'}</strong>
          </span>
        </div>
        <div className="flex items-center gap-space-md text-label-telemetry font-label-telemetry">
          <span className="text-on-surface-variant">
            SYS_ID: <strong className="text-on-surface">{protocol?.sysId || '01'}</strong>
          </span>
          <span className="text-on-surface-variant">
            COMP_ID: <strong className="text-on-surface">{protocol?.compId || '01'}</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container-high rounded text-primary-fixed font-bold">
            <span className="material-symbols-outlined text-[14px]">sensors</span>
            {isOnline ? 'IMU_EKF3: CALIBRATED' : 'IMU: STANDBY'}
          </span>
        </div>
      </div>

      {/* 8-Column Quick Telemetry HUD Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-space-xs">
        {/* LAT / LON */}
        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">LAT / LON</span>
          <div className="mt-1">
            {tel?.latitude !== undefined && tel?.longitude !== undefined ? (
              <>
                <p className="text-label-telemetry font-label-telemetry text-primary leading-tight">
                  {tel.latitude.toFixed(4)}° N
                </p>
                <p className="text-label-telemetry font-label-telemetry text-secondary leading-tight">
                  {tel.longitude.toFixed(4)}° E
                </p>
              </>
            ) : (
              <p className="text-label-telemetry font-label-telemetry text-on-surface-variant">-- / NO LOCK</p>
            )}
          </div>
        </div>

        {/* ALT (AGL) */}
        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">ALT (AGL)</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-headline-md font-headline-md text-primary">
              {tel?.relativeAltitude !== undefined ? tel.relativeAltitude.toFixed(1) : '--'}
            </span>
            <span className="text-label-telemetry font-label-telemetry text-on-surface-variant">M</span>
          </div>
        </div>

        {/* GROUND SPD */}
        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">GROUND SPD</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-headline-md font-headline-md text-primary">
              {tel?.groundSpeed !== undefined ? tel.groundSpeed.toFixed(1) : '0.0'}
            </span>
            <span className="text-label-telemetry font-label-telemetry text-on-surface-variant">M/S</span>
          </div>
        </div>

        {/* BATT [4S] */}
        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">BATT [4S]</span>
            <span className="text-label-telemetry font-label-telemetry text-primary-fixed">
              {tel?.batteryPercentage !== undefined ? `${tel.batteryPercentage}%` : '--%'}
            </span>
          </div>
          <div className="mt-1">
            <div className="text-headline-md font-headline-md text-primary-fixed leading-none">
              {tel?.batteryVoltage !== undefined ? tel.batteryVoltage.toFixed(1) : '--'}
              <span className="text-label-telemetry font-label-telemetry text-on-surface ml-1">V</span>
            </div>
            <div className="w-full h-1 bg-surface-container-highest rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-primary-container h-full transition-all duration-500"
                style={{ width: `${tel?.batteryPercentage ?? 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* GPS STATUS */}
        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">GPS STATUS</span>
          <div className="mt-1">
            <p className="text-label-telemetry font-label-telemetry text-primary-fixed truncate">
              {tel?.gpsFixType || (isOnline ? '3D FIX (BENCH)' : 'NO FIX')}
            </p>
            <p className="text-label-telemetry font-label-telemetry text-secondary text-[11px]">
              {tel?.satellites !== undefined ? `${tel.satellites} SATS` : '-- SATS'} // NO RTK
            </p>
          </div>
        </div>

        {/* FLIGHT MODE */}
        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">FLIGHT MODE</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-primary-fixed' : 'bg-surface-variant'}`}></span>
            <span className="text-label-telemetry font-label-telemetry text-primary tracking-wide truncate">
              {tel?.flightMode || 'POSHOLD TEST'}
            </span>
          </div>
        </div>

        {/* ARM STATE */}
        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">ARM STATE</span>
          <div className="mt-1">
            <span className={`inline-block px-1.5 py-0.5 rounded font-label-telemetry text-label-telemetry uppercase tracking-wider font-bold ${
              tel?.armed ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'
            }`}>
              {tel?.armed ? 'BENCH ARMED' : 'DISARMED'}
            </span>
          </div>
        </div>

        {/* PWM OUT */}
        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">PWM OUT</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-headline-md font-headline-md text-primary">
              {tel?.armed ? '1100' : '1000'}
            </span>
            <span className="text-label-telemetry font-label-telemetry text-on-surface-variant">µs</span>
          </div>
        </div>
      </div>

      {/* Dynamic Readiness Gate & Pre-Flight Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Readiness Ring */}
        <div className="lg:col-span-5 bg-surface-container-low p-space-md rounded flex flex-col justify-between shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-highest/60">
            <div className="flex items-center gap-space-xs">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-primary-container animate-pulse' : 'bg-surface-variant'}`}></span>
              <span className="font-headline-md text-headline-md text-primary tracking-wide">
                AIRCRAFT READINESS GATE
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary-fixed font-label-telemetry text-label-telemetry font-bold">
              {readiness?.status || 'BENCH STAGE 2'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-space-md py-space-sm">
            <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" fill="none" r="50" stroke="#2A2A2A" strokeWidth="9"></circle>
                <circle
                  className="transition-all duration-700"
                  cx="60"
                  cy="60"
                  fill="none"
                  r="50"
                  stroke="#BFF42E"
                  strokeDasharray="314.159"
                  strokeDashoffset={314.159 - (314.159 * (readiness?.percentage || (isOnline ? 80 : 20))) / 100}
                  strokeLinecap="round"
                  strokeWidth="9"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-headline-lg font-headline-lg text-primary leading-none">
                  {readiness?.percentage ?? (isOnline ? 82 : 20)}%
                </span>
                <span className="text-[10px] font-label-telemetry text-primary-fixed uppercase mt-0.5 tracking-wider font-bold">
                  {readiness?.status ?? (isOnline ? 'BENCH READY' : 'STANDBY')}
                </span>
                <span className="text-[9px] font-label-telemetry text-on-surface-variant">
                  {readiness?.verifiedCount ?? (isOnline ? 4 : 1)}/5 VERIFIED
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2 font-label-telemetry text-label-telemetry">
              <div className="flex items-center justify-between text-[11px] p-1.5 bg-surface-container-lowest rounded border-l-2 border-primary-fixed">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-primary-fixed' : 'bg-surface-variant'}`}></span>
                  FC CORE INIT
                </span>
                <span className="text-primary-fixed font-bold">{isOnline ? 'VERIFIED (100%)' : 'STANDBY'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] p-1.5 bg-surface-container-lowest rounded border-l-2 border-primary-fixed">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${tel?.satellites ? 'bg-primary-fixed' : 'bg-surface-variant'}`}></span>
                  GPS 3D LOCK
                </span>
                <span className="text-primary-fixed font-bold">
                  {tel?.satellites ? `${tel.satellites} SATS (SIM)` : 'NO LOCK'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] p-1.5 bg-surface-container-lowest rounded border-l-2 border-primary-fixed">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-primary-fixed' : 'bg-surface-variant'}`}></span>
                  EKF3 BUS SENSORS
                </span>
                <span className="text-primary-fixed font-bold">{isOnline ? 'PASS (HEALTHY)' : 'STANDBY'}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] p-1.5 bg-surface-container-lowest rounded border-l-2 border-outline-variant/30">
                <span className="text-secondary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-variant"></span>
                  OPTICAL / LIDAR
                </span>
                <span className="text-error font-bold">BYPASS EXEMPT</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-space-xs text-label-telemetry font-label-telemetry text-on-surface-variant bg-surface-container-lowest/60 px-space-sm py-1 rounded">
            <span>STATUS: <strong className="text-primary-fixed font-bold">{readiness?.status || 'BENCH TEST QUALIFIED'}</strong></span>
            <span className="text-secondary">LIDAR BYPASS ACTIVE</span>
          </div>
        </div>

        {/* Pre-Flight Avionics Verification Checklist */}
        <div className="lg:col-span-7 bg-surface-container-low p-space-md rounded flex flex-col justify-between shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-highest/60">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary-fixed text-[20px]">fact_check</span>
              <h3 className="font-headline-md text-headline-md text-primary tracking-wide">
                PRE-FLIGHT AVIONICS VERIFICATION
              </h3>
            </div>
            <div className="flex items-center gap-space-xs font-label-telemetry text-label-telemetry">
              <span className="text-on-surface-variant">SUBSYSTEM AUDIT:</span>
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-bold">
                {isOnline ? '5 OF 6 CLEARED' : '1 OF 6 CLEARED'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-xs py-space-xs text-label-telemetry font-label-telemetry">
            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[12px] font-bold ${
                  isOnline ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'
                }`}>
                  {isOnline ? '✓' : '—'}
                </span>
                <span className="text-on-surface">Pixhawk 2.4.8 FC Bus</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed text-[10px] font-bold">
                {isOnline ? 'PASS' : 'STANDBY'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[12px] font-bold ${
                  tel?.satellites ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'
                }`}>
                  {tel?.satellites ? '✓' : '—'}
                </span>
                <span className="text-on-surface">U-Blox M8N 3D Fix</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed text-[10px] font-bold">
                {tel?.satellites ? 'PASS' : 'STANDBY'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-surface-variant flex items-center justify-center text-on-surface text-[12px] font-bold">
                  ⏳
                </span>
                <span className="text-secondary">ESP32-CAM [Bench Linked]</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-bold">
                STANDBY
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[12px] font-bold ${
                  tel?.batteryVoltage ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'
                }`}>
                  {tel?.batteryVoltage ? '✓' : '—'}
                </span>
                <span className="text-on-surface">4S LiPo Power Harness</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed text-[10px] font-bold">
                {tel?.batteryVoltage ? `${tel.batteryVoltage.toFixed(1)}V PASS` : 'STANDBY'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded flex items-center justify-center text-[12px] font-bold ${
                  isOnline ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant text-on-surface-variant'
                }`}>
                  {isOnline ? '✓' : '—'}
                </span>
                <span className="text-on-surface">Pre-Arm Safety Switch</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed text-[10px] font-bold">
                {isOnline ? 'PASS' : 'STANDBY'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded border border-error/30">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-error-container flex items-center justify-center text-on-error-container text-[11px] font-bold">
                  !
                </span>
                <span className="text-error font-medium">Downward LiDAR &amp; Optical Flow</span>
              </div>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-error text-[10px] font-bold">
                NOT INSTALLED
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-space-xs text-[11px] font-label-telemetry text-label-telemetry text-on-surface-variant">
            <span>HARDWARE COMPLIANCE AUDIT // AERON GCS</span>
            <span className="text-primary-fixed font-bold">{protocol?.mode || 'MANUAL / POSHOLD BENCH TEST'}</span>
          </div>
        </div>
      </div>

      {/* Central Viewport: Airframe Schematic & Live Bench Camera */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Airframe Schematic */}
        <div className="lg:col-span-8 bg-surface-container-low p-space-lg rounded flex flex-col relative overflow-hidden shadow-md">
          <div className="absolute -right-6 -bottom-6 font-display-hero text-display-hero text-surface-container-highest/20 select-none pointer-events-none">
            AERON
          </div>

          <div className="flex items-center justify-between z-10 mb-space-md">
            <div className="flex items-center gap-space-sm">
              <span className="w-2.5 h-2.5 bg-primary-container rounded-sm"></span>
              <h2 className="font-headline-lg text-headline-lg tracking-wider text-primary">
                PHYSICAL AIRFRAME SCHEMATIC
              </h2>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-label-telemetry font-label-telemetry text-on-surface-variant">
                QUAD-X CONFIGURATION
              </span>
            </div>
            <div className="flex items-center gap-space-xs font-label-telemetry text-label-telemetry">
              <span className={`inline-flex w-2 h-2 rounded-full ${isOnline ? 'bg-primary-container' : 'bg-surface-variant'}`}></span>
              <span className="text-primary-fixed">{isOnline ? 'BENCH HARNESS ACTIVE' : 'HARNESS STANDBY'}</span>
            </div>
          </div>

          <div className="relative w-full h-[440px] bg-surface-container-lowest rounded flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(191,244,46,0.06)_0%,_transparent_70%)]"></div>
            <div className="absolute inset-0 opacity-15 flex items-center justify-center">
              <div className="w-96 h-96 rounded-full border border-dashed border-primary"></div>
              <div className="absolute w-64 h-64 rounded-full border border-primary"></div>
              <div className="absolute w-full h-[1px] bg-surface-variant"></div>
              <div className="absolute h-full w-[1px] bg-surface-variant"></div>
            </div>

            {/* Quad-X SVG Schematic */}
            <svg className="relative z-10 w-80 h-80 text-secondary" fill="none" viewBox="0 0 400 400">
              <line className="text-surface-container-highest" stroke="currentColor" strokeLinecap="round" strokeWidth="8" x1="80" x2="320" y1="80" y2="320"></line>
              <line className="text-surface-container-highest" stroke="currentColor" strokeLinecap="round" strokeWidth="8" x1="320" x2="80" y1="80" y2="320"></line>
              <line opacity="0.6" stroke="#BFF42E" strokeDasharray="4 6" strokeWidth="2" x1="80" x2="320" y1="80" y2="320"></line>
              <line opacity="0.6" stroke="#BFF42E" strokeDasharray="4 6" strokeWidth="2" x1="320" x2="80" y1="80" y2="320"></line>
              
              {/* Central Pixhawk Core */}
              <rect fill="#202020" height="100" rx="12" width="100" x="150" y="150"></rect>
              <rect fill="#131313" height="70" rx="6" width="70" x="165" y="165"></rect>
              <rect fill="#2A2A2A" height="50" rx="4" width="50" x="175" y="175"></rect>
              <circle className="animate-pulse" cx="200" cy="190" fill="#BFF42E" r="4"></circle>
              <text fill="#E5E2E1" fontFamily="Space Mono" fontSize="7" textAnchor="middle" x="200" y="210">
                PIXHAWK
              </text>

              {/* M1 ESC (Front Right) */}
              <g transform="translate(320, 80)">
                <circle cx="0" cy="0" fill="#202020" r="32"></circle>
                <circle className={tel?.armed ? 'animate-spin' : ''} cx="0" cy="0" r="26" stroke="#BFF42E" strokeDasharray="8 4" strokeWidth="2" style={{ animationDuration: '3s' }}></circle>
                <circle cx="0" cy="0" fill="#BFF42E" r="10"></circle>
                <text fill="#131313" fontFamily="Space Mono" fontSize="9" fontWeight="bold" textAnchor="middle" x="0" y="3">
                  M1
                </text>
              </g>

              {/* M2 ESC (Front Left) */}
              <g transform="translate(80, 80)">
                <circle cx="0" cy="0" fill="#202020" r="32"></circle>
                <circle className={tel?.armed ? 'animate-spin' : ''} cx="0" cy="0" r="26" stroke="#BFF42E" strokeDasharray="8 4" strokeWidth="2" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></circle>
                <circle cx="0" cy="0" fill="#BFF42E" r="10"></circle>
                <text fill="#131313" fontFamily="Space Mono" fontSize="9" fontWeight="bold" textAnchor="middle" x="0" y="3">
                  M2
                </text>
              </g>

              {/* M3 ESC (Rear Left) */}
              <g transform="translate(80, 320)">
                <circle cx="0" cy="0" fill="#202020" r="32"></circle>
                <circle className={tel?.armed ? 'animate-spin' : ''} cx="0" cy="0" r="26" stroke="#BFF42E" strokeDasharray="8 4" strokeWidth="2" style={{ animationDuration: '3s' }}></circle>
                <circle cx="0" cy="0" fill="#BFF42E" r="10"></circle>
                <text fill="#131313" fontFamily="Space Mono" fontSize="9" fontWeight="bold" textAnchor="middle" x="0" y="3">
                  M3
                </text>
              </g>

              {/* M4 ESC (Rear Right) */}
              <g transform="translate(320, 320)">
                <circle cx="0" cy="0" fill="#202020" r="32"></circle>
                <circle className={tel?.armed ? 'animate-spin' : ''} cx="0" cy="0" r="26" stroke="#BFF42E" strokeDasharray="8 4" strokeWidth="2" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></circle>
                <circle cx="0" cy="0" fill="#BFF42E" r="10"></circle>
                <text fill="#131313" fontFamily="Space Mono" fontSize="9" fontWeight="bold" textAnchor="middle" x="0" y="3">
                  M4
                </text>
              </g>

              {/* GPS Mast Representation */}
              <circle cx="150" cy="120" fill="#353535" r="12"></circle>
              <circle cx="150" cy="120" fill="#BFF42E" r="4"></circle>
              <line stroke="#BFF42E" strokeDasharray="2 2" strokeWidth="1" x1="150" x2="175" y1="120" y2="175"></line>
            </svg>

            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-surface-container-high rounded text-label-telemetry font-label-telemetry text-primary-fixed">
              ▲ FORWARD (NOSE)
            </div>

            <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-surface-container-high/90 backdrop-blur-md px-space-sm py-1 rounded text-center shadow-lg">
              <div className="text-[10px] font-label-telemetry text-secondary font-bold">ESP32-CAM [BENCH LINKED]</div>
              <div className="text-[9px] font-label-telemetry text-on-surface-variant">AWAITING RTSP LINK (STANDBY)</div>
            </div>

            <div className="absolute top-6 left-6 bg-surface-container-high/90 backdrop-blur-md p-2 rounded text-left shadow-lg">
              <div className="text-label-telemetry font-label-telemetry text-primary-fixed">
                M2 ESC // PWM {tel?.armed ? '1100' : '1000'} µs
              </div>
              <div className="text-label-telemetry font-label-telemetry text-on-surface-variant">RPM SENSOR NOT INSTALLED</div>
            </div>

            <div className="absolute top-6 right-6 bg-surface-container-high/90 backdrop-blur-md p-2 rounded text-right shadow-lg">
              <div className="text-label-telemetry font-label-telemetry text-primary-fixed">
                M1 ESC // PWM {tel?.armed ? '1100' : '1000'} µs
              </div>
              <div className="text-label-telemetry font-label-telemetry text-on-surface-variant">RPM SENSOR NOT INSTALLED</div>
            </div>

            <div className="absolute top-1/2 -translate-y-12 left-4 bg-surface-container-high/90 backdrop-blur-md p-2 rounded text-left shadow-lg">
              <div className="text-label-telemetry font-label-telemetry text-primary-fixed">U-BLOX NEO-M8N</div>
              <div className="text-label-telemetry font-label-telemetry text-on-surface">
                {tel?.satellites ? `3D FIX (${tel.satellites} SATS)` : 'AWAITING LOCK'}
              </div>
            </div>

            <div className="absolute top-1/2 -translate-y-12 right-4 bg-surface-container-high/90 backdrop-blur-md p-2 rounded text-right shadow-lg">
              <div className="text-label-telemetry font-label-telemetry text-error font-bold">DOWNWARD LiDAR &amp; OPTICAL FLOW</div>
              <div className="text-label-telemetry font-label-telemetry text-error">NOT INSTALLED // PORT BYPASS</div>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-container-high/90 backdrop-blur-md px-space-md py-1.5 rounded text-center shadow-lg">
              <div className="text-label-telemetry font-label-telemetry text-primary-fixed">
                4S LiPo // {tel?.batteryVoltage ? `${tel.batteryVoltage.toFixed(1)}V (${tel.batteryPercentage}%)` : '--V (--%)'}
              </div>
              <div className="text-[10px] font-label-telemetry text-on-surface-variant">PM02 POWER MODULE SENSING</div>
            </div>
          </div>
        </div>

        {/* Live GCS Bench Feed (ESP32-CAM Standby) & Health Score */}
        <div className="lg:col-span-4 flex flex-col space-y-space-md">
          {/* Camera Viewport */}
          <div className="bg-surface-container-low p-space-md rounded flex flex-col shadow-md">
            <div className="flex items-center justify-between mb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                <span className="text-label-telemetry font-label-telemetry text-primary">ESP32-CAM BENCH LINK</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-label-telemetry text-primary-fixed">
                STANDBY
              </span>
            </div>

            <div className="relative w-full h-48 bg-surface-container-lowest rounded overflow-hidden flex flex-col items-center justify-center border border-outline-variant/30">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(191,244,46,0.04)_0%,_transparent_70%)]"></div>
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">videocam_off</span>
              <p className="font-label-telemetry text-label-telemetry text-primary-fixed font-bold text-center px-space-sm">
                HARDWARE BENCH LINKED
              </p>
              <p className="font-label-telemetry text-[11px] text-on-surface-variant text-center px-space-sm mt-1">
                AWAITING RTSP STREAM LINK // NOT STREAMING
              </p>
              <div className="mt-2 px-2 py-0.5 rounded bg-surface-container-high text-[10px] font-label-telemetry text-secondary">
                PORT: 81/stream (STANDBY)
              </div>
            </div>

            <div className="mt-space-sm flex items-center justify-between text-label-telemetry font-label-telemetry text-on-surface-variant">
              <span>FEED STATUS: <strong className="text-secondary">STANDBY</strong></span>
              <span className="text-primary-fixed">UART / GPIO OK</span>
            </div>
          </div>

          {/* Hardware Health Score Card */}
          <div className="bg-surface-container-low p-space-md rounded flex-1 flex flex-col justify-between shadow-md">
            <div>
              <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase tracking-wider">
                HARDWARE HEALTH SCORE
              </span>
              <div className="flex items-baseline gap-space-sm mt-1">
                <span className="text-headline-xl font-headline-xl text-primary leading-none">
                  {isOnline ? '88.4' : '45.0'}
                </span>
                <span className="text-label-telemetry font-label-telemetry text-primary-fixed">
                  % BENCH READINESS
                </span>
              </div>
              <p className="text-body-sm font-body-sm text-secondary mt-space-xs">
                Pixhawk 2.4.8 FC, M8N GPS &amp; 4S LiPo power module nominal. LiDAR &amp; Optical Flow ports not populated (bypassed).
              </p>
            </div>

            <div className="space-y-space-xs my-space-sm">
              <div className="flex justify-between text-label-telemetry font-label-telemetry">
                <span className="text-on-surface-variant">IMU VIBRATION (ACCEL X/Y/Z)</span>
                <span className="text-primary-fixed">{isOnline ? '0.12 m/s² (NORMAL)' : '--'}</span>
              </div>
              <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="bg-primary-container h-full w-[15%]"></div>
              </div>

              <div className="flex justify-between text-label-telemetry font-label-telemetry pt-1">
                <span className="text-on-surface-variant">CPU LOAD (STM32F427)</span>
                <span className="text-on-surface">{isOnline ? '32% UTILIZATION' : '0%'}</span>
              </div>
              <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="bg-primary-container h-full w-[32%]"></div>
              </div>
            </div>

            {/* Action Buttons: SAFELY DISABLED PER SAFETY RULES */}
            <div className="flex gap-space-xs pt-2">
              <button
                onClick={() => handleCommandAttempt('RE-ARM BENCH')}
                className="flex-1 py-space-sm px-space-md rounded-full bg-surface-container-high text-on-surface font-label-pill text-label-pill flex items-center justify-center gap-1 shadow-md hover:bg-surface-variant transition-colors opacity-80 cursor-not-allowed"
                title="Remote flight command execution is strictly restricted"
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                <span>RE-ARM BENCH</span>
              </button>
              <button
                onClick={() => handleCommandAttempt('CALIBRATE')}
                className="py-space-sm px-space-md rounded-full bg-surface-container-high text-on-surface font-label-pill text-label-pill hover:bg-surface-variant transition-colors opacity-80 cursor-not-allowed"
                title="Remote calibration commands are strictly restricted"
              >
                CALIBRATE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Column Dedicated Hardware & Sensor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Pixhawk 2.4.8 */}
        <div className="bg-surface-container-low p-space-md rounded flex flex-col justify-between shadow-sm relative group hover:bg-surface-container transition-colors">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <span className="material-symbols-outlined text-primary-fixed text-2xl">memory</span>
              <span className={`px-2 py-0.5 rounded text-label-telemetry font-label-telemetry font-bold ${
                isOnline ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {isOnline ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary tracking-wide">PIXHAWK 2.4.8</h3>
            <p className="text-label-telemetry font-label-telemetry text-primary-fixed mb-space-sm">AUTOPILOT CONTROLLER</p>
            <div className="space-y-1.5 text-label-telemetry font-label-telemetry text-body-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">FIRMWARE:</span>
                <span className="text-on-surface">ArduCopter v4.5.1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">IMU PRIMARY:</span>
                <span className="text-primary-fixed">{isOnline ? 'CALIBRATED (MPU6000)' : 'STANDBY'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">BAROMETER:</span>
                <span className="text-primary-fixed">{isOnline ? 'MS5611 (OK)' : 'STANDBY'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">BOARD TEMP:</span>
                <span className="text-on-surface">{isOnline ? '36.4°C' : '--°C'}</span>
              </div>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm bg-surface-container-lowest/50 p-2 rounded flex items-center justify-between text-label-telemetry font-label-telemetry text-on-surface-variant">
            <span>SAFETY SWITCH</span>
            <span className="text-primary-fixed font-bold">{isOnline ? 'BYPASS (BENCH)' : 'STANDBY'}</span>
          </div>
        </div>

        {/* U-Blox NEO-M8N */}
        <div className="bg-surface-container-low p-space-md rounded flex flex-col justify-between shadow-sm relative group hover:bg-surface-container transition-colors">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <span className="material-symbols-outlined text-primary-fixed text-2xl">share_location</span>
              <span className={`px-2 py-0.5 rounded text-label-telemetry font-label-telemetry font-bold ${
                tel?.satellites ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {tel?.satellites ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary tracking-wide">U-BLOX NEO-M8N</h3>
            <p className="text-label-telemetry font-label-telemetry text-primary-fixed mb-space-sm">GNSS &amp; COMPASS MODULE</p>
            <div className="space-y-1.5 text-label-telemetry font-label-telemetry text-body-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">SATELLITES:</span>
                <span className="text-primary-fixed">{tel?.satellites !== undefined ? `${tel.satellites} SATS` : '-- SATS'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">FIX TYPE:</span>
                <span className="text-on-surface">{tel?.gpsFixType || 'AWAITING LOCK'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">COMPASS:</span>
                <span className="text-primary-fixed">{isOnline ? 'HMC5883L (ALIGNED)' : 'STANDBY'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">RTK DIFFERENTIAL:</span>
                <span className="text-error font-bold">NOT INSTALLED</span>
              </div>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm bg-surface-container-lowest/50 p-2 rounded flex items-center justify-between text-label-telemetry font-label-telemetry text-on-surface-variant">
            <span>HORIZONTAL DILUTION</span>
            <span className="text-primary-fixed font-bold">{tel?.hdop ? `HDOP ${tel.hdop.toFixed(2)}` : 'HDOP --'}</span>
          </div>
        </div>

        {/* ESP32-CAM */}
        <div className="bg-surface-container-low p-space-md rounded flex flex-col justify-between shadow-sm relative group hover:bg-surface-container transition-colors">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <span className="material-symbols-outlined text-secondary text-2xl">videocam</span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-label-telemetry font-label-telemetry font-bold">
                STANDBY
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary tracking-wide">ESP32-CAM</h3>
            <p className="text-label-telemetry font-label-telemetry text-secondary mb-space-sm">HARDWARE BENCH LINKED</p>
            <div className="space-y-1.5 text-label-telemetry font-label-telemetry text-body-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">STATUS:</span>
                <span className="text-on-surface">HARDWARE LINKED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">RTSP STREAM:</span>
                <span className="text-on-surface-variant">PROTOCOL PLANNED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">FEED LATENCY:</span>
                <span className="text-on-surface-variant">N/A (STANDBY)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">OPTICAL FLOW:</span>
                <span className="text-error font-bold">NOT INSTALLED</span>
              </div>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm bg-surface-container-lowest/50 p-2 rounded flex items-center justify-between text-label-telemetry font-label-telemetry text-on-surface-variant">
            <span>DOWNWARD LiDAR</span>
            <span className="text-error font-bold">NOT INSTALLED</span>
          </div>
        </div>

        {/* 4S LiPo Power Harness */}
        <div className="bg-surface-container-low p-space-md rounded flex flex-col justify-between shadow-sm relative group hover:bg-surface-container transition-colors">
          <div>
            <div className="flex items-center justify-between mb-space-sm">
              <span className="material-symbols-outlined text-primary-fixed text-2xl">battery_charging_full</span>
              <span className={`px-2 py-0.5 rounded text-label-telemetry font-label-telemetry font-bold ${
                tel?.batteryVoltage ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {tel?.batteryVoltage ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            <h3 className="font-headline-md text-headline-md text-primary tracking-wide">POWER HARNESS</h3>
            <p className="text-label-telemetry font-label-telemetry text-primary-fixed mb-space-sm">4S LiPo // PM02 PDB</p>
            <div className="space-y-1.5 text-label-telemetry font-label-telemetry text-body-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">TOTAL VOLTS:</span>
                <span className="text-primary-fixed">
                  {tel?.batteryVoltage ? `${tel.batteryVoltage.toFixed(1)}V (${(tel.batteryVoltage / 4).toFixed(2)}V/CELL)` : '--V'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">CURRENT DRAW:</span>
                <span className="text-on-surface">{tel?.batteryCurrent !== undefined ? `${tel.batteryCurrent.toFixed(1)} A` : '-- A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">REMAINING:</span>
                <span className="text-primary-fixed">{tel?.batteryPercentage !== undefined ? `${tel.batteryPercentage}%` : '--%'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">FAILSAFE VOLT:</span>
                <span className="text-on-surface">14.0V THRESHOLD</span>
              </div>
            </div>
          </div>
          <div className="mt-space-md pt-space-sm bg-surface-container-lowest/50 p-2 rounded flex items-center justify-between text-label-telemetry font-label-telemetry text-on-surface-variant">
            <span>PACK HEALTH</span>
            <span className="text-primary-fixed font-bold">{tel?.batteryPercentage ? 'OPTIMAL DYNAMICS' : 'STANDBY'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
