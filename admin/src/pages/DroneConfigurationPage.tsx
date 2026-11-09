import React, { useState } from 'react';

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
  const [params] = useState<AutopilotParam[]>(DEFAULT_PARAMS);
  const [searchParam, setSearchParam] = useState<string>('');
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);

  const handleRestrictedAction = (actionName: string) => {
    setSafetyNotice(
      `[SAFETY RESTRICTION] Action '${actionName}' is prohibited in read-only telemetry mode. Modifying autopilot flight parameters requires hardware ground station connection.`
    );
    setTimeout(() => setSafetyNotice(null), 5000);
  };

  const filteredParams = params.filter(
    (p) =>
      p.name.toLowerCase().includes(searchParam.toLowerCase()) ||
      p.description.toLowerCase().includes(searchParam.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              DRONE AIRFRAME & PARAMETER ARCHITECTURE
            </h1>
          </div>
          <p className="text-body-sm font-label-telemetry text-on-surface-variant text-[11px] mt-0.5">
            AERON-HEX-01 // AIRFRAME HARDWARE SPECIFICATIONS & ARDUPILOT REGISTERS
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRestrictedAction('WRITE_PARAMETERS')}
            className="px-3 py-1.5 bg-surface-container-high border border-outline-variant hover:border-primary text-on-surface rounded font-label-telemetry text-[11px] flex items-center gap-1.5 transition-colors cursor-not-allowed opacity-80"
            title="Safety policy restricted"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">save</span>
            <span>WRITE PARAMETERS [LOCKED]</span>
          </button>
          <button
            onClick={() => handleRestrictedAction('FLASH_FIRMWARE')}
            className="px-3 py-1.5 bg-surface-container-high border border-error/50 text-error rounded font-label-telemetry text-[11px] flex items-center gap-1.5 transition-colors cursor-not-allowed opacity-80"
            title="Safety policy restricted"
          >
            <span className="material-symbols-outlined text-[16px]">system_update_alt</span>
            <span>FLASH FIRMWARE [LOCKED]</span>
          </button>
        </div>
      </div>

      {safetyNotice && (
        <div className="p-space-sm bg-error-container/30 border border-error text-error rounded font-label-telemetry text-[11px] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>{safetyNotice}</span>
          </div>
          <button onClick={() => setSafetyNotice(null)} className="text-on-surface hover:text-error">
            ✕
          </button>
        </div>
      )}

      {/* Airframe Physical Specifications (Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-space-sm font-label-telemetry text-[11px]">
        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-1">
          <span className="text-[10px] text-on-surface-variant block uppercase">CHASSIS & PROPULSION</span>
          <span className="text-sm font-bold text-on-surface block">F450 QUADCOPTER X</span>
          <span className="text-on-surface-variant text-[10px] block">920KV Brushless Motors (2212)</span>
          <span className="text-primary-fixed text-[10px] block">1045 Carbon-Nylon Propellers</span>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-1">
          <span className="text-[10px] text-on-surface-variant block uppercase">SPEED CONTROLLERS</span>
          <span className="text-sm font-bold text-on-surface block">30A SIMONK ESCs</span>
          <span className="text-on-surface-variant text-[10px] block">400Hz Refresh Rate (PWM)</span>
          <span className="text-primary-fixed text-[10px] block">5V 2A Linear BEC Support</span>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-1">
          <span className="text-[10px] text-on-surface-variant block uppercase">POWER SUPPLY SYSTEM</span>
          <span className="text-sm font-bold text-on-surface block">4S 14.8V 5200MAH LIPO</span>
          <span className="text-on-surface-variant text-[10px] block">35C Continuous Discharge</span>
          <span className="text-primary-fixed text-[10px] block">Max Flight Time: ~18-22 Min</span>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-1">
          <span className="text-[10px] text-on-surface-variant block uppercase">PAYLOAD & LIMITS</span>
          <span className="text-sm font-bold text-on-surface block">MTOW 2.40 KG</span>
          <span className="text-on-surface-variant text-[10px] block">Dry Weight: 1.65 kg</span>
          <span className="text-primary-fixed text-[10px] block">Max Additional Payload: 750g</span>
        </div>
      </div>

      {/* Autopilot Parameters Table */}
      <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 space-y-space-sm font-label-telemetry">
        <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-surface-container-highest/60 pb-2">
          <span className="text-on-surface font-bold text-xs uppercase">
            READ-ONLY AUTOPILOT REGISTERS (MAVLINK PARAM_VALUE)
          </span>

          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">search</span>
            <input
              type="text"
              placeholder="SEARCH PARAMETER..."
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              className="bg-surface-container px-2.5 py-1 rounded text-[11px] text-on-surface border border-outline-variant outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-surface-container-highest/60 text-on-surface-variant text-[10px]">
                <th className="py-2 px-3">REGISTER NAME</th>
                <th className="py-2 px-3">CURRENT VALUE</th>
                <th className="py-2 px-3">DEFAULT</th>
                <th className="py-2 px-3">UNIT</th>
                <th className="py-2 px-3">DESCRIPTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-highest/40">
              {filteredParams.map((p) => (
                <tr key={p.name} className="hover:bg-surface-container-high/40 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-primary-fixed">{p.name}</td>
                  <td className="py-2.5 px-3 font-bold text-on-surface">{p.value}</td>
                  <td className="py-2.5 px-3 text-on-surface-variant">{p.defaultVal}</td>
                  <td className="py-2.5 px-3 text-on-surface-variant">{p.unit}</td>
                  <td className="py-2.5 px-3 text-on-surface">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

