import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-surface-container/90 backdrop-blur-xl z-40 shadow-[0_1px_8px_rgba(0,0,0,0.3)]">
      <div className="w-full h-16 px-gutter flex items-center justify-between">
        <div className="flex items-center gap-space-md">
          <span className="font-label-pill text-label-pill tracking-wider text-on-surface">AERON — DRONE INTELLIGENCE</span>
          <div className="flex items-center gap-space-xs px-space-sm py-space-xs bg-surface-container-high rounded">
            <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></div>
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">
              HARDWARE BENCH DEMONSTRATION // PIXHAWK 2.4.8 USB-MAVLINK
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-space-xs px-space-sm py-space-xs bg-surface-container-lowest rounded">
            <span className="font-label-telemetry text-label-telemetry text-on-surface-variant">OPERATOR:</span>
            <span className="font-label-telemetry text-label-telemetry text-primary">OP-8842-X</span>
          </div>
          <button className="relative p-space-xs rounded hover:bg-surface-variant hover:text-on-surface text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary-container rounded-full"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};

