import React from 'react';
import { TelemetryData } from '../types';

interface AircraftSchematicProps {
  telemetry: TelemetryData | null;
  isOnline: boolean;
  armed?: boolean;
  flightMode?: string;
}

export const AircraftSchematic: React.FC<AircraftSchematicProps> = ({
  telemetry,
  isOnline,
  armed = false,
  flightMode = 'STANDBY'
}) => {
  const heading = telemetry?.heading ?? 0;
  const batteryPct = telemetry?.batteryPercentage;
  const voltage = telemetry?.batteryVoltage ?? 0;
  const isArmed = armed || !!telemetry?.armed;

  return (
    <div className="relative flex flex-col items-center justify-center p-6 bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(#F1F5EE 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {/* Top HUD Metadata */}
      <div className="w-full flex items-center justify-between z-10 mb-4 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-accent-primary">flight_takeoff</span>
          <span className="font-sans text-xs font-semibold text-text-primary">
            Aircraft Overview • HEX-01
          </span>
        </div>
        <div className="flex items-center gap-2 font-sans text-xs">
          <span className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
            isArmed 
              ? 'bg-danger/20 text-danger border border-danger/40 animate-pulse' 
              : 'bg-surface-elevated text-text-secondary border border-border'
          }`}>
            {isArmed ? 'Armed' : 'Disarmed'}
          </span>
          <span className="px-2.5 py-0.5 rounded bg-surface-elevated text-text-secondary border border-border text-[11px] font-medium">
            Mode: {flightMode}
          </span>
        </div>
      </div>

      {/* Center Schematic SVG */}
      <div className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center my-2">
        {/* Compass Ring */}
        <div 
          className="absolute inset-0 rounded-full border border-border/80 border-dashed transition-transform duration-700 ease-out flex items-center justify-center pointer-events-none"
          style={{ transform: `rotate(${heading}deg)` }}
        >
          <span className="absolute -top-3 text-[11px] font-mono font-bold text-aeron-lime bg-surface px-1">N</span>
          <span className="absolute -bottom-3 text-[11px] font-mono text-text-muted bg-surface px-1">S</span>
          <span className="absolute -left-3 text-[11px] font-mono text-text-muted bg-surface px-1">W</span>
          <span className="absolute -right-3 text-[11px] font-mono text-text-muted bg-surface px-1">E</span>
        </div>

        {/* Tactical Airframe SVG */}
        <svg 
          viewBox="0 0 200 200" 
          className="w-72 h-72 sm:w-80 sm:h-80 transition-transform duration-500 ease-out z-10"
          style={{ transform: `rotate(${heading}deg)` }}
        >
          {/* Concentric Radar Range Rings */}
          <circle cx="100" cy="100" r="30" fill="none" stroke="#334451" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.35" />
          <circle cx="100" cy="100" r="60" fill="none" stroke="#334451" strokeWidth="0.75" strokeDasharray="3 3" opacity="0.35" />
          <circle cx="100" cy="100" r="88" fill="none" stroke="#334451" strokeWidth="0.75" strokeDasharray="4 4" opacity="0.25" />

          {/* Hexacopter Arms */}
          <line x1="100" y1="100" x2="45" y2="50" stroke="#334451" strokeWidth="4" strokeLinecap="round" />
          <line x1="100" y1="100" x2="155" y2="50" stroke="#334451" strokeWidth="4" strokeLinecap="round" />
          <line x1="100" y1="100" x2="180" y2="100" stroke="#334451" strokeWidth="4" strokeLinecap="round" />
          <line x1="100" y1="100" x2="155" y2="150" stroke="#334451" strokeWidth="4" strokeLinecap="round" />
          <line x1="100" y1="100" x2="45" y2="150" stroke="#334451" strokeWidth="4" strokeLinecap="round" />
          <line x1="100" y1="100" x2="20" y2="100" stroke="#334451" strokeWidth="4" strokeLinecap="round" />

          {/* Motor Pods & Propellers */}
          {/* M1 */}
          <circle cx="45" cy="50" r="14" fill="#151E27" stroke={isOnline ? "#BFF42E" : "#334451"} strokeWidth="2" />
          <circle cx="45" cy="50" r="5" fill={isArmed ? "#F07878" : (isOnline ? "#BFF42E" : "#334451")} />
          <text x="45" y="53" textAnchor="middle" fill="#B4C0C8" fontSize="6" fontFamily="monospace">M1</text>

          {/* M2 */}
          <circle cx="155" cy="50" r="14" fill="#151E27" stroke={isOnline ? "#BFF42E" : "#334451"} strokeWidth="2" />
          <circle cx="155" cy="50" r="5" fill={isArmed ? "#F07878" : (isOnline ? "#BFF42E" : "#334451")} />
          <text x="155" y="53" textAnchor="middle" fill="#B4C0C8" fontSize="6" fontFamily="monospace">M2</text>

          {/* M3 */}
          <circle cx="180" cy="100" r="14" fill="#151E27" stroke={isOnline ? "#BFF42E" : "#334451"} strokeWidth="2" />
          <circle cx="180" cy="100" r="5" fill={isArmed ? "#F07878" : (isOnline ? "#BFF42E" : "#334451")} />
          <text x="180" y="103" textAnchor="middle" fill="#B4C0C8" fontSize="6" fontFamily="monospace">M3</text>

          {/* M4 */}
          <circle cx="155" cy="150" r="14" fill="#151E27" stroke={isOnline ? "#BFF42E" : "#334451"} strokeWidth="2" />
          <circle cx="155" cy="150" r="5" fill={isArmed ? "#F07878" : (isOnline ? "#BFF42E" : "#334451")} />
          <text x="155" y="153" textAnchor="middle" fill="#B4C0C8" fontSize="6" fontFamily="monospace">M4</text>

          {/* M5 */}
          <circle cx="45" cy="150" r="14" fill="#151E27" stroke={isOnline ? "#BFF42E" : "#334451"} strokeWidth="2" />
          <circle cx="45" cy="150" r="5" fill={isArmed ? "#F07878" : (isOnline ? "#BFF42E" : "#334451")} />
          <text x="45" y="153" textAnchor="middle" fill="#B4C0C8" fontSize="6" fontFamily="monospace">M5</text>

          {/* M6 */}
          <circle cx="20" cy="100" r="14" fill="#151E27" stroke={isOnline ? "#BFF42E" : "#334451"} strokeWidth="2" />
          <circle cx="20" cy="100" r="5" fill={isArmed ? "#F07878" : (isOnline ? "#BFF42E" : "#334451")} />
          <text x="20" y="103" textAnchor="middle" fill="#B4C0C8" fontSize="6" fontFamily="monospace">M6</text>

          {/* Central Avionics Hub */}
          <rect x="75" y="75" width="50" height="50" rx="8" fill="#192631" stroke="#334451" strokeWidth="2" />
          <polygon points="100,80 92,94 108,94" fill={isOnline ? "#BFF42E" : "#84939E"} />
          <text x="100" y="108" textAnchor="middle" fill="#F0F4F6" fontSize="7" fontWeight="bold" fontFamily="monospace">
            AERON
          </text>
          <text x="100" y="117" textAnchor="middle" fill="#B4C0C8" fontSize="5.5" fontFamily="monospace">
            PX4/STM32
          </text>
        </svg>

        {/* Live Heading Readout Overlay */}
        <div className="absolute bottom-2 font-mono text-[11px] text-text-secondary bg-surface-elevated/95 px-3 py-1 rounded-lg border border-border shadow-sm">
          Heading: <span className="font-semibold text-text-primary">{isOnline ? `${heading.toFixed(1)}°` : '—'}</span>
        </div>
      </div>

      {/* Bottom Instrumentation Strip */}
      <div className="w-full grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/60 text-center font-sans text-xs">
        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <span className="block text-[11px] text-text-muted">Battery</span>
          <span className="font-mono text-sm text-text-primary font-bold">
            {isOnline && voltage > 0 ? `${voltage.toFixed(1)}V` : '—'}
          </span>
          <span className="block text-[10px] text-accent-primary font-mono">
            {isOnline && batteryPct !== undefined && batteryPct !== null ? `${batteryPct}%` : 'Standby'}
          </span>
        </div>
        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <span className="block text-[11px] text-text-muted">Altitude (AGL)</span>
          <span className="font-mono text-sm text-text-primary font-bold">
            {isOnline && telemetry?.altitude !== undefined ? `${telemetry.altitude.toFixed(1)}m` : '—'}
          </span>
          <span className="block text-[10px] text-text-muted font-mono">
            {isOnline ? 'Baro relative' : 'Standby'}
          </span>
        </div>
        <div className="bg-surface-elevated p-2.5 rounded-lg border border-border">
          <span className="block text-[11px] text-text-muted">Satellites</span>
          <span className="font-mono text-sm text-text-primary font-bold">
            {isOnline && telemetry?.satellites !== undefined && telemetry.satellites > 0 ? telemetry.satellites : '—'}
          </span>
          <span className="block text-[10px] text-text-muted font-mono">
            {isOnline ? (telemetry?.gpsFixType || '3D Lock') : 'Searching'}
          </span>
        </div>
      </div>
    </div>
  );
};

