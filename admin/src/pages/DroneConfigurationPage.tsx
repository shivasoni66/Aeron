import React, { useState } from 'react';
import { useHardware } from '../context/HardwareContext';

interface AutopilotParam {
  name: string;
  value: string;
  defaultVal: string;
  unit: string;
  description: string;
}

const DEFAULT_PARAMS: AutopilotParam[] = [
  { name: 'ARMING_CHECK', value: '1', defaultVal: '1', unit: 'bitmask', description: 'Comprehensive pre-arm sensor verification' },
  { name: 'FS_THR_ENABLE', value: '1', defaultVal: '1', unit: 'boolean', description: 'Enable RC link loss throttle failsafe' },
  { name: 'FS_BATT_VOLT', value: '14.0', defaultVal: '10.5', unit: 'Volts', description: '4S LiPo low voltage RTL threshold' },
  { name: 'RTL_ALT', value: '3000', defaultVal: '1500', unit: 'cm', description: 'Return-to-launch cruise altitude (30m)' },
  { name: 'WPNAV_SPEED', value: '500', defaultVal: '500', unit: 'cm/s', description: 'Autonomous mission waypoint velocity (5m/s)' },
  { name: 'MOT_SPIN_ARM', value: '0.12', defaultVal: '0.15', unit: 'ratio', description: 'Minimum armed idle throttle ratio' },
  { name: 'BATT_MONITOR', value: '4', defaultVal: '0', unit: 'mode', description: 'Analog voltage and current monitoring' },
  { name: 'FENCE_ENABLE', value: '1', defaultVal: '0', unit: 'boolean', description: 'Cylindrical geofence boundary interlock' },
  { name: 'FENCE_RADIUS', value: '500', defaultVal: '300', unit: 'm', description: 'Maximum horizontal perimeter distance' }
];

export const DroneConfigurationPage: React.FC = () => {
  const { isOnline, hardwareStatusLabel } = useHardware();
  const [params] = useState<AutopilotParam[]>(DEFAULT_PARAMS);
  const [searchParam, setSearchParam] = useState<string>('');
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);

  const handleRestrictedAction = (actionName: string) => {
    setSafetyNotice(
      `[SAFETY RESTRICTION] Action '${actionName}' is prohibited in read-only telemetry mode. Modifying autopilot flight parameters requires physical ground station connection.`
    );
    setTimeout(() => setSafetyNotice(null), 5000);
  };

  const filteredParams = params.filter(
    (p) =>
      p.name.toLowerCase().includes(searchParam.toLowerCase()) ||
      p.description.toLowerCase().includes(searchParam.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[24px]">tune</span>
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              Airframe & Parameter Architecture
            </h1>
          </div>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            AERON-HEX-01 • Airframe Hardware Specifications & ArduPilot Registers
          </p>
        </div>

        <div className="flex items-center gap-2 font-sans text-xs">
          <button
            onClick={() => handleRestrictedAction('WRITE_PARAMETERS')}
            className="px-3.5 py-1.5 bg-surface-elevated border border-border hover:border-accent-primary text-text-secondary hover:text-text-primary rounded-lg flex items-center gap-2 transition-colors cursor-not-allowed opacity-80"
            title="Safety policy restricted"
          >
            <span className="material-symbols-outlined text-[16px] text-accent-primary">save</span>
            <span>Write parameters (Safety locked)</span>
          </button>
          <button
            onClick={() => handleRestrictedAction('FLASH_FIRMWARE')}
            className="px-3.5 py-1.5 bg-surface-elevated border border-danger/40 text-danger rounded-lg flex items-center gap-2 transition-colors cursor-not-allowed opacity-80"
            title="Safety policy restricted"
          >
            <span className="material-symbols-outlined text-[16px]">system_update_alt</span>
            <span>Flash firmware (Safety locked)</span>
          </button>
        </div>
      </div>

      {/* Hardware Sync Banner */}
      <div className="p-4 bg-surface rounded-xl border border-border shadow-sm flex items-center justify-between font-sans text-xs">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-accent-primary text-[20px]">
            {isOnline ? 'check_circle' : 'cloud_sync'}
          </span>
          <div>
            <span className="font-bold text-text-primary">
              Airframe Configuration Profile: AERON-HEX-01
            </span>
            <p className="text-text-muted text-[11px] mt-0.5">
              {isOnline
                ? 'Pixhawk 2.4.8 connected via MAVLink 2.0. Parameters synchronized with airframe EEPROM registers.'
                : 'Parameters shown reflect the saved airframe profile for AERON-HEX-01. Physical Pixhawk 2.4.8 is in standby (Awaiting hardware sync).'}
            </p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full font-semibold text-[11px] border ${
          isOnline ? 'bg-success/15 text-success border-success/30' : 'bg-surface-elevated text-text-muted border-border'
        }`}>
          {hardwareStatusLabel}
        </span>
      </div>

      {safetyNotice && (
        <div className="p-3.5 bg-danger/15 border border-danger/40 text-danger rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>{safetyNotice}</span>
          </div>
          <button onClick={() => setSafetyNotice(null)} className="text-text-primary hover:text-danger">
            ✕
          </button>
        </div>
      )}

      {/* Airframe Physical Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-sans text-xs">
        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <span className="text-[10px] text-text-muted uppercase block font-semibold">Chassis & Propulsion</span>
          <span className="text-sm font-bold text-text-primary block">Hexacopter Frame</span>
          <span className="text-text-muted text-[11px] block">920KV Brushless Motors (2212)</span>
          <span className="text-accent-primary text-[11px] block font-semibold">Carbon-Nylon Propellers</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <span className="text-[10px] text-text-muted uppercase block font-semibold">Speed Controllers</span>
          <span className="text-sm font-bold text-text-primary block">30A Opto ESCs</span>
          <span className="text-text-muted text-[11px] block">PWM 400Hz Update Rate</span>
          <span className="text-accent-primary text-[11px] block font-semibold">Active Braking Enabled</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <span className="text-[10px] text-text-muted uppercase block font-semibold">Payload Capacity</span>
          <span className="text-sm font-bold text-text-primary block">Max 1200g Lift</span>
          <span className="text-text-muted text-[11px] block">Current Dry Weight: 1450g</span>
          <span className="text-accent-primary text-[11px] block font-semibold">All-Up-Weight: 2200g</span>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border space-y-1">
          <span className="text-[10px] text-text-muted uppercase block font-semibold">Flight Endurance</span>
          <span className="text-sm font-bold text-text-primary block">~22 Minutes Cruise</span>
          <span className="text-text-muted text-[11px] block">Based on 4S 5200mAh LiPo</span>
          <span className="text-accent-primary text-[11px] block font-semibold">Hover Power: 180W</span>
        </div>
      </div>

      {/* Autopilot Parameters Register Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm p-5 space-y-4 font-sans text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-accent-primary text-[20px]">list_alt</span>
            <span className="font-bold text-sm text-text-primary">
              ArduPilot Parameter Registers
            </span>
          </div>

          <div className="flex items-center gap-2 max-w-sm w-full">
            <span className="material-symbols-outlined text-text-muted text-[18px]">search</span>
            <input
              type="text"
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              placeholder="Search parameters or registers..."
              className="w-full bg-surface-elevated px-3 py-1.5 rounded-lg border border-border text-text-primary placeholder:text-text-muted focus:border-accent-primary outline-none text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted text-[11px] font-semibold">
                <th className="py-2.5 px-3">Parameter</th>
                <th className="py-2.5 px-3">Value</th>
                <th className="py-2.5 px-3">Default</th>
                <th className="py-2.5 px-3">Units</th>
                <th className="py-2.5 px-3">Function & Policy Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 text-text-secondary">
              {filteredParams.map((p) => (
                <tr key={p.name} className="hover:bg-surface-elevated/40 transition-colors">
                  <td className="py-2.5 px-3 text-accent-primary font-bold font-mono">{p.name}</td>
                  <td className="py-2.5 px-3 text-text-primary font-bold font-mono">{p.value}</td>
                  <td className="py-2.5 px-3 text-text-muted font-mono">{p.defaultVal}</td>
                  <td className="py-2.5 px-3 text-text-secondary font-mono">{p.unit}</td>
                  <td className="py-2.5 px-3 text-text-muted">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
