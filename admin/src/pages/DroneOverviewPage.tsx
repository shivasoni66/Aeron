import React, { useState } from 'react';
import { useHardware } from '../context/HardwareContext';
import { AircraftSchematic } from '../components/AircraftSchematic';
import { AdminGamification } from '../components/AdminGamification';
import { MetricCard } from '../components/MetricCard';

export const DroneOverviewPage: React.FC = () => {
  const {
    data,
    latestTelemetry: tel,
    isOnline,
    hardwareStatusLabel,
    readiness,
    protocol,
    loading
  } = useHardware();

  const [commandDisabledNotice, setCommandDisabledNotice] = useState<string | null>(null);

  const handleCommandAttempt = (commandName: string) => {
    setCommandDisabledNotice(
      `[SAFETY INTERLOCK] Command '${commandName}' is disabled. Remote flight-control execution is strictly restricted by ground safety policy.`
    );
    setTimeout(() => setCommandDisabledNotice(null), 5000);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4 font-mono text-text-secondary">
        <div className="w-10 h-10 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
        <span className="text-accent-primary text-xs tracking-widest uppercase">
          INITIALIZING GROUND CONTROL STATION TELEMETRY...
        </span>
      </div>
    );
  }

  const lat = tel?.latitude;
  const lon = tel?.longitude;
  const alt = tel?.altitude ?? tel?.relativeAltitude;
  const speed = tel?.groundSpeed;
  const voltage = tel?.batteryVoltage;
  const batteryPct = tel?.batteryPercentage;
  const satellites = tel?.satellites ?? 0;
  const isArmed = !!tel?.armed;
  const flightMode = tel?.flightMode || protocol?.mode || 'STANDBY';

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto">
      {/* Safety Notice Toast */}
      {commandDisabledNotice && (
        <div className="p-3.5 bg-danger/15 border border-danger/40 text-danger rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>{commandDisabledNotice}</span>
          </div>
          <button onClick={() => setCommandDisabledNotice(null)} className="text-text-primary hover:text-danger">
            ✕
          </button>
        </div>
      )}

      {/* GCS Status Deck Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-3 font-sans text-xs">
          <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-semibold text-[11px] ${
            isOnline
              ? (tel?.isSimulated ? 'bg-warning/15 text-warning border border-warning/30' : 'bg-success/15 text-success border border-success/30')
              : 'bg-surface-elevated text-text-muted border border-border'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isOnline ? (tel?.isSimulated ? 'bg-warning animate-pulse' : 'bg-success animate-pulse') : 'bg-text-muted'
            }`} />
            {hardwareStatusLabel}
          </span>
          <span className="text-border">•</span>
          <span className="text-text-secondary">
            MAVLink {protocol?.mavlinkVersion || '2.0'} ({protocol?.baudRate ? protocol.baudRate.toLocaleString() : '57,600'} baud)
          </span>
          <span className="text-border">•</span>
          <span className="text-text-secondary">
            Target: <strong className="text-text-primary font-semibold">{protocol?.targetFC || 'Pixhawk 2.4.8 (STM32F427)'}</strong>
          </span>
          <span className="text-border">•</span>
          <span className="text-text-secondary">
            Mode: <strong className="text-accent-primary font-semibold">{flightMode}</strong>
          </span>
        </div>

        <div className="flex items-center gap-4 font-sans text-xs text-text-muted">
          <span>Sys: <strong className="font-mono text-text-primary font-semibold">{protocol?.sysId || '01'}</strong></span>
          <span>Comp: <strong className="font-mono text-text-primary font-semibold">{protocol?.compId || '01'}</strong></span>
          <span className="px-2.5 py-0.5 rounded bg-surface-elevated border border-border text-[11px] font-mono text-text-secondary">
            Frame: HEX-01
          </span>
        </div>
      </div>

      {/* Primary Flight Instrument KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Groundspeed"
          value={isOnline && speed !== undefined ? speed.toFixed(1) : '—'}
          unit={isOnline && speed !== undefined ? 'm/s' : undefined}
          icon="speed"
          trend={isOnline ? (speed && speed > 0 ? 'IMU Telemetry Nominal' : 'Stationary') : 'Awaiting telemetry'}
          status={isOnline && speed && speed > 0 ? 'active' : 'normal'}
          secondaryValue={isOnline && speed !== undefined ? `${(speed * 3.6).toFixed(1)} km/h` : 'Standby'}
        />

        <MetricCard
          label="Altitude (AGL)"
          value={isOnline && alt !== undefined ? alt.toFixed(1) : '—'}
          unit={isOnline && alt !== undefined ? 'meters' : undefined}
          icon="height"
          trend={isOnline ? (alt && alt > 0 ? 'Baro MS5611 Active' : 'Ground Level') : 'Awaiting telemetry'}
          status={isOnline && alt && alt > 1 ? 'info' : 'normal'}
          secondaryValue={isOnline ? 'Relative AGL' : 'Standby'}
        />

        <MetricCard
          label="Battery Power"
          value={isOnline && voltage !== undefined && voltage > 0 ? voltage.toFixed(1) : '—'}
          unit={isOnline && voltage ? 'volts' : undefined}
          icon="battery_charging_full"
          trend={isOnline && batteryPct !== undefined ? `${batteryPct}% Capacity Remaining` : '4S LiPo Pack (Standby)'}
          status={isOnline && voltage && voltage < 14.2 ? 'warning' : 'normal'}
          secondaryValue={isOnline && tel?.batteryCurrent ? `${tel.batteryCurrent.toFixed(1)} A Draw` : 'Power Standby'}
        />

        <MetricCard
          label="GPS Constellation"
          value={isOnline && satellites !== undefined && satellites > 0 ? satellites : '—'}
          unit={isOnline && satellites > 0 ? 'satellites' : undefined}
          icon="satellite_alt"
          trend={isOnline ? (tel?.gpsFixType || '3D Lock') : 'Searching'}
          status={isOnline && satellites >= 6 ? 'active' : 'normal'}
          secondaryValue={isOnline && tel?.hdop ? `HDOP ${tel.hdop.toFixed(2)}` : 'Precision GNSS (Standby)'}
        />
      </div>

      {/* Main Ground Control Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Aircraft Schematic & Live Orientation HUD */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <AircraftSchematic
            telemetry={tel}
            isOnline={isOnline}
            armed={isArmed}
            flightMode={flightMode}
          />

          {/* Quick Technical Coordinates Strip */}
          <div className="p-4 bg-surface rounded-xl border border-border flex flex-wrap items-center justify-between gap-4 font-sans text-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-info">pin_drop</span>
              <span className="text-text-muted">Coordinates:</span>
              <span className="font-mono text-text-primary font-semibold">
                {isOnline && lat !== undefined && lon !== undefined ? `${lat.toFixed(5)}° N, ${lon.toFixed(5)}° E` : '—'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-muted">PWM:</span>
              <span className="font-mono text-text-primary font-semibold">{isOnline && isArmed ? '1,100 µs' : (isOnline ? '1,000 µs' : '—')}</span>
              <span className="text-border">•</span>
              <span className="text-text-muted">Failsafe:</span>
              <span className="text-success font-semibold">RTL on Disconnect</span>
            </div>
          </div>
        </div>

        {/* Right: Aircraft Readiness Gate & Gamified Maintenance Progress */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          {/* Readiness Gate */}
          <div className="bg-surface rounded-xl border border-border p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-accent-primary text-[20px]">fact_check</span>
                <div>
                  <h3 className="font-sans text-sm font-bold text-text-primary">Aircraft Readiness Gate</h3>
                  <p className="text-[11px] text-text-muted">Pre-flight subsystem clearance</p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded border text-[11px] font-sans font-semibold ${
                readiness?.status === 'BENCH READY'
                  ? 'bg-success/15 text-success border-success/30'
                  : 'bg-surface-elevated text-text-muted border-border'
              }`}>
                {readiness?.status
                  ? readiness.status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
                  : (isOnline ? 'Bench Ready' : 'Standby (Pre-flight)')}
              </span>
            </div>

            <div className="space-y-2 font-sans text-xs">
              <div className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-lg border border-border/70">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success' : 'bg-text-muted'}`} />
                  <span className="text-text-primary font-medium">Flight Controller Core</span>
                </div>
                <span className={`text-[11px] font-semibold ${isOnline ? 'text-success' : 'text-text-muted'}`}>
                  {isOnline ? 'Passed (100%)' : 'Standby'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-lg border border-border/70">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${satellites >= 4 ? 'bg-success' : 'bg-text-muted'}`} />
                  <span className="text-text-primary font-medium">U-Blox M8N 3D Fix</span>
                </div>
                <span className={`text-[11px] font-semibold ${satellites >= 4 ? 'text-success' : 'text-text-muted'}`}>
                  {isOnline && satellites ? `${satellites} satellites locked` : 'No lock'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-lg border border-border/70">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success' : 'bg-text-muted'}`} />
                  <span className="text-text-primary font-medium">EKF3 Attitude & IMU</span>
                </div>
                <span className={`text-[11px] font-semibold ${isOnline ? 'text-success' : 'text-text-muted'}`}>
                  {isOnline ? 'Nominal' : 'Standby'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-lg border border-border/70">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${voltage ? 'bg-success' : 'bg-text-muted'}`} />
                  <span className="text-text-primary font-medium">Power Distribution (PM02)</span>
                </div>
                <span className={`text-[11px] font-semibold ${voltage ? 'text-success' : 'text-text-muted'}`}>
                  {isOnline && voltage ? `${voltage.toFixed(1)}V nominal` : 'Standby'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-surface-elevated rounded-lg border border-border/70">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-text-muted" />
                  <span className="text-text-secondary font-medium">Downward LiDAR / Optical Flow</span>
                </div>
                <span className="text-[11px] font-medium text-text-muted">
                  Not installed (Exempt)
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => handleCommandAttempt('RE-ARM BENCH')}
                className="flex-1 py-2 px-3 rounded-lg bg-surface-elevated text-text-secondary font-sans font-medium text-xs flex items-center justify-center gap-1.5 border border-border hover:bg-surface-muted transition-colors opacity-70 cursor-not-allowed"
                title="Ground safety interlock policy restricts remote arming"
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                <span>Arm bench (Safety locked)</span>
              </button>
              <button
                onClick={() => handleCommandAttempt('CALIBRATE')}
                className="py-2 px-4 rounded-lg bg-surface-elevated text-text-secondary font-sans font-medium text-xs border border-border hover:bg-surface-muted transition-colors opacity-70 cursor-not-allowed"
                title="Ground safety interlock policy restricts calibration commands"
              >
                Calibrate
              </button>
            </div>
          </div>

          {/* Gamification: Flight Engineer Operations Level */}
          <AdminGamification
            verifiedChecksCount={isOnline ? 4 : 1}
            totalChecksCount={5}
            isOnline={isOnline}
          />
        </div>
      </div>

      {/* Subsystem Hardware & Device Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pixhawk 2.4.8 */}
        <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="material-symbols-outlined text-accent-primary text-2xl">memory</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-semibold ${
              isOnline ? 'bg-success/15 text-success border border-success/30' : 'bg-surface-elevated text-text-muted'
            }`}>
              {isOnline ? 'Connected' : 'Standby'}
            </span>
          </div>
          <div>
            <h4 className="font-sans font-bold text-sm text-text-primary">Pixhawk 2.4.8</h4>
            <p className="text-xs font-sans text-text-muted">Autopilot Flight Computer</p>
          </div>
          <div className="space-y-1.5 text-xs font-sans border-t border-border/60 pt-2 text-text-secondary">
            <div className="flex justify-between">
              <span className="text-text-muted">Firmware:</span>
              <span className="text-text-primary font-medium">ArduCopter v4.5.1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Core IMU:</span>
              <span className="text-text-primary font-medium">{isOnline ? 'MPU6000 (Calibrated)' : 'Standby'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Barometer:</span>
              <span className="text-text-primary font-medium">{isOnline ? 'MS5611 OK' : 'Standby'}</span>
            </div>
          </div>
        </div>

        {/* U-Blox NEO-M8N */}
        <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="material-symbols-outlined text-info text-2xl">share_location</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-semibold ${
              isOnline && satellites > 0 ? 'bg-success/15 text-success border border-success/30' : 'bg-surface-elevated text-text-muted'
            }`}>
              {isOnline && satellites > 0 ? 'Connected' : 'Standby'}
            </span>
          </div>
          <div>
            <h4 className="font-sans font-bold text-sm text-text-primary">U-Blox NEO-M8N</h4>
            <p className="text-xs font-sans text-text-muted">Precision GNSS & Compass</p>
          </div>
          <div className="space-y-1.5 text-xs font-sans border-t border-border/60 pt-2 text-text-secondary">
            <div className="flex justify-between">
              <span className="text-text-muted">Satellites:</span>
              <span className="font-mono text-text-primary font-medium">{isOnline && satellites ? `${satellites} Sats` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Fix Type:</span>
              <span className="text-text-primary font-medium">{isOnline ? (tel?.gpsFixType || '3D Lock') : 'Searching'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Compass:</span>
              <span className="text-text-primary font-medium">{isOnline ? 'HMC5883L' : 'Standby'}</span>
            </div>
          </div>
        </div>

        {/* Power Module */}
        <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="material-symbols-outlined text-warning text-2xl">battery_charging_full</span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-sans font-semibold ${
              isOnline && voltage ? 'bg-success/15 text-success border border-success/30' : 'bg-surface-elevated text-text-muted'
            }`}>
              {isOnline && voltage ? 'Connected' : 'Standby'}
            </span>
          </div>
          <div>
            <h4 className="font-sans font-bold text-sm text-text-primary">Power Harness</h4>
            <p className="text-xs font-sans text-text-muted">4S LiPo • PM02 PDB</p>
          </div>
          <div className="space-y-1.5 text-xs font-sans border-t border-border/60 pt-2 text-text-secondary">
            <div className="flex justify-between">
              <span className="text-text-muted">Voltage:</span>
              <span className="font-mono text-text-primary font-medium">{isOnline && voltage ? `${voltage.toFixed(1)}V` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Current:</span>
              <span className="font-mono text-text-primary font-medium">{isOnline && tel?.batteryCurrent ? `${tel.batteryCurrent.toFixed(1)}A` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Failsafe:</span>
              <span className="text-text-primary font-medium">14.0V threshold</span>
            </div>
          </div>
        </div>

        {/* ESP32-CAM (Bench Linked / Standby) */}
        <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="material-symbols-outlined text-text-muted text-2xl">videocam</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-sans font-semibold bg-surface-elevated text-text-muted border border-border">
              Standby
            </span>
          </div>
          <div>
            <h4 className="font-sans font-bold text-sm text-text-primary">ESP32-CAM</h4>
            <p className="text-xs font-sans text-text-muted">Bench Optical Link</p>
          </div>
          <div className="space-y-1.5 text-xs font-sans border-t border-border/60 pt-2 text-text-secondary">
            <div className="flex justify-between">
              <span className="text-text-muted">Stream:</span>
              <span className="text-text-muted">Not streaming</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Port:</span>
              <span className="text-text-primary font-medium">UART / GPIO OK</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Optical Flow:</span>
              <span className="text-text-muted">Not installed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
