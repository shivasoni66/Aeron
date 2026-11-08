import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="fixed bottom-0 left-72 right-0 h-12 bg-surface-container-lowest/95 backdrop-blur-md z-40 shadow-[0_-1px_6px_rgba(0,0,0,0.3)]">
      <div className="w-full h-12 px-gutter flex items-center justify-between text-on-surface-variant font-label-telemetry text-label-telemetry">
        <div className="flex items-center gap-space-lg">
          <span>LINK: <strong className="text-primary-fixed">MAVLINK 57600 BAUD</strong></span>
          <span>HARDWARE: <strong className="text-on-surface">PIXHAWK 2.4.8 CONNECTED</strong></span>
        </div>
        <div className="flex items-center gap-space-md">
          <span>BENCH LAT: <strong className="text-on-surface">12.9716° N</strong></span>
          <span>BENCH LON: <strong className="text-on-surface">77.5946° E</strong></span>
          <span>ALT: <strong className="text-primary-fixed">42.4M AGL</strong></span>
        </div>
      </div>
    </footer>
  );
};

