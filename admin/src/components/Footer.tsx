import React from 'react';
import { useHardware } from '../context/HardwareContext';

export const Footer: React.FC = () => {
  const { hardwareState, hardwareStatusLabel, latestTelemetry, protocol, isOnline } = useHardware();

  const getHardwareStatusClass = () => {
    if (hardwareState === 'CONNECTED') return 'text-aeron-lime';
    if (hardwareState === 'SIMULATION') return 'text-caution-amber';
    return 'text-text-muted';
  };

  const lat = latestTelemetry?.latitude;
  const lon = latestTelemetry?.longitude;
  const alt = latestTelemetry?.altitude;

  return (
    <footer className="fixed bottom-0 left-72 right-0 h-10 bg-surface/95 backdrop-blur-md border-t border-border z-40 px-6 flex items-center justify-between text-xs font-sans text-text-secondary">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-text-muted">Link:</span>
          <span className="text-telemetry-cyan font-mono font-semibold">
            MAVLink {protocol?.mavlinkVersion || '2.0'} • {protocol?.baudRate ? protocol.baudRate.toLocaleString() : '57,600'} baud
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted">Hardware:</span>
          <span className={`font-semibold ${getHardwareStatusClass()}`}>
            {hardwareStatusLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-text-muted font-sans">Lat:</span>
          <span className="text-navigation-blue font-semibold">
            {isOnline && lat !== undefined && lat !== null ? `${lat.toFixed(5)}°` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted font-sans">Lon:</span>
          <span className="text-navigation-blue font-semibold">
            {isOnline && lon !== undefined && lon !== null ? `${lon.toFixed(5)}°` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted font-sans">Alt:</span>
          <span className="text-aeron-lime font-semibold">
            {isOnline && alt !== undefined && alt !== null ? `${alt.toFixed(1)}m AGL` : '—'}
          </span>
        </div>
      </div>
    </footer>
  );
};
