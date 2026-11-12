import React, { useState } from 'react';

export const RadarPreview: React.FC = () => {
  // Local schematic display mode: 'all' | 'corridor' | 'terrain'
  const [activeLayer, setActiveLayer] = useState<'all' | 'corridor' | 'terrain'>('all');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [pulseCount, setPulseCount] = useState<number>(0);

  const toggleLayer = () => {
    setActiveLayer((prev) => (prev === 'all' ? 'corridor' : prev === 'corridor' ? 'terrain' : 'all'));
  };

  const toggleGrid = () => {
    setShowGrid((prev) => !prev);
  };

  const triggerCenter = () => {
    setPulseCount((prev) => prev + 1);
  };

  return (
    <div className="flex items-end gap-2.5 sm:gap-3 select-none relative z-20">
      {/* Expanded Tactical GPS Radar Map Card with responsive clamping */}
      <div
        style={{ width: 'clamp(280px, calc(17vw + 60px), 370px)' }}
        className="max-w-[calc(100vw-56px)] bg-[#0a120e]/90 backdrop-blur-xl border border-[#233829]/70 hover:border-[#BFF42E]/35 rounded-2xl p-3 sm:p-3.5 xl:p-3.5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.85),0_0_24px_rgba(15,30,20,0.45)] transition-all duration-300 relative overflow-hidden group"
      >
        {/* Subtle grid pattern background across card */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(rgba(191,244,46,0.35) 1px, transparent 1px)`,
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0'
          }}
        />

        {/* Header Row: Title + SCHEMATIC Badge (No fake satellite or battery indicators) */}
        <div className="flex items-center justify-between mb-1.5 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BFF42E] shadow-[0_0_6px_#BFF42E] animate-pulse" />
            <span className="font-sans text-[11px] sm:text-xs font-semibold text-neutral-200 tracking-wider uppercase">
              GPS Radar Map
            </span>
          </div>
          <span className="font-mono text-[8px] sm:text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-[#111c14] border border-[#2b4432]/80 text-[#a3e635] font-semibold">
            SCHEMATIC
          </span>
        </div>

        {/* Compact Legend Row */}
        <div className="flex items-center gap-3 mb-1.5 px-0.5 text-[9px] sm:text-[10px] font-mono text-neutral-400 relative z-10">
          <div className="flex items-center gap-1">
            <span className="w-3 h-[2px] bg-[#BFF42E] rounded-full shadow-[0_0_4px_#BFF42E]" />
            <span className="text-neutral-300">Route</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border border-[#BFF42E] bg-[#122417]" />
            <span className="text-neutral-300">Waypoint</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-2.5 h-2.5 text-[#BFF42E]" viewBox="0 0 16 16" fill="currentColor">
              <polygon points="8,1 15,14 8,11 1,14" />
            </svg>
            <span className="text-neutral-300">Aircraft</span>
          </div>
        </div>

        {/* Interactive Tactical Map Canvas Box */}
        <div className="h-[105px] sm:h-[110px] md:h-[102px] lg:h-[112px] xl:h-[120px] 2xl:h-[130px] w-full rounded-xl bg-[#060c08] border border-[#1d3123] relative overflow-hidden flex items-center justify-center shadow-inner">
          <svg
            className="w-full h-full"
            viewBox="0 0 360 160"
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Deep charcoal forest gradient map background */}
              <linearGradient id="mapSurfaceGradMgr" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#060c08" />
                <stop offset="50%" stopColor="#08140c" />
                <stop offset="100%" stopColor="#050a06" />
              </linearGradient>

              {/* Soft green ambient illumination radiating from flight corridor */}
              <radialGradient id="flightCorridorGlowMgr" cx="45%" cy="50%" r="65%">
                <stop offset="0%" stopColor="rgba(191,244,46,0.16)" />
                <stop offset="50%" stopColor="rgba(53,198,216,0.06)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>

              {/* Waypoint pulse filter */}
              <filter id="glowLimeMgr" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Map Canvas Background */}
            <rect width="360" height="160" fill="url(#mapSurfaceGradMgr)" />

            {/* Elevation-Style Contours & Terrain Shapes (Visible when layer is 'all' or 'terrain') */}
            {(activeLayer === 'all' || activeLayer === 'terrain') && (
              <g className="transition-opacity duration-300">
                {/* Elevation hill/ridge contours */}
                <path
                  d="M -10,130 Q 50,70 120,95 T 240,110 T 370,80 L 370,170 L -10,170 Z"
                  fill="#0c1b12"
                  opacity="0.55"
                />
                <path
                  d="M -10,95 Q 60,40 140,65 T 260,80 T 370,40"
                  fill="none"
                  stroke="#162e20"
                  strokeWidth="0.8"
                />
                <path
                  d="M -10,115 Q 70,60 150,85 T 280,95 T 370,65"
                  fill="none"
                  stroke="#1e3d2a"
                  strokeWidth="0.8"
                />
                <path
                  d="M 20,-10 Q 90,50 170,25 T 310,35 T 380,10"
                  fill="none"
                  stroke="#162e20"
                  strokeWidth="0.8"
                />
                <path
                  d="M 50,170 Q 130,120 210,140 T 350,120"
                  fill="none"
                  stroke="#1a3525"
                  strokeWidth="0.8"
                />
              </g>
            )}

            {/* Soft Green Map Illumination */}
            <rect width="360" height="160" fill="url(#flightCorridorGlowMgr)" pointerEvents="none" />

            {/* Cartographic Coordinate Grid & Registration Marks */}
            {showGrid && (
              <g opacity="0.45" stroke="#1f3b2a" strokeWidth="0.5">
                {/* Vertical grid lines */}
                <line x1="60" y1="0" x2="60" y2="160" strokeDasharray="2,5" />
                <line x1="120" y1="0" x2="120" y2="160" strokeDasharray="2,5" />
                <line x1="180" y1="0" x2="180" y2="160" strokeDasharray="2,5" />
                <line x1="240" y1="0" x2="240" y2="160" strokeDasharray="2,5" />
                <line x1="300" y1="0" x2="300" y2="160" strokeDasharray="2,5" />

                {/* Horizontal grid lines */}
                <line x1="0" y1="40" x2="360" y2="40" strokeDasharray="2,5" />
                <line x1="0" y1="80" x2="360" y2="80" strokeDasharray="2,5" />
                <line x1="0" y1="120" x2="360" y2="120" strokeDasharray="2,5" />

                {/* Faint range circles from tactical origin */}
                <circle cx="180" cy="80" r="45" fill="none" stroke="#254833" strokeDasharray="2,4" />
                <circle cx="180" cy="80" r="75" fill="none" stroke="#1d3828" strokeDasharray="1,5" />

                {/* Intersection Crosshairs */}
                <path d="M 176,80 L 184,80 M 180,76 L 180,84" stroke="#487858" strokeWidth="0.8" />
                <path d="M 116,40 L 124,40 M 120,36 L 120,44" stroke="#487858" strokeWidth="0.8" />
                <path d="M 236,120 L 244,120 M 240,116 L 240,124" stroke="#487858" strokeWidth="0.8" />
              </g>
            )}

            {/* Flight Corridor & Route Lines (Visible when layer is 'all' or 'corridor') */}
            {(activeLayer === 'all' || activeLayer === 'corridor') && (
              <g className="transition-opacity duration-300">
                {/* Secondary Tactical Approach / Return Path for Depth */}
                <path
                  d="M 30,135 Q 90,145 150,120 T 260,115 T 330,85"
                  fill="none"
                  stroke="#35C6D8"
                  strokeWidth="0.9"
                  strokeDasharray="3,4"
                  opacity="0.38"
                />

                {/* Broad Translucent Flight Corridor Envelope */}
                <path
                  d="M 35,130 C 80,135 110,105 155,90 C 200,75 230,70 315,40"
                  fill="none"
                  stroke="#BFF42E"
                  strokeWidth="16"
                  strokeLinecap="round"
                  opacity="0.10"
                />

                {/* Corridor Guideline Boundary */}
                <path
                  d="M 35,130 C 80,135 110,105 155,90 C 200,75 230,70 315,40"
                  fill="none"
                  stroke="#BFF42E"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.16"
                />

                {/* Primary Flight Route: Curving Lime Route Line */}
                <path
                  d="M 35,130 C 80,135 110,105 155,90 C 200,75 230,70 315,40"
                  fill="none"
                  stroke="#BFF42E"
                  strokeWidth="2"
                  strokeLinecap="round"
                  filter="url(#glowLimeMgr)"
                />

                {/* Dynamic reset pulse wave when center button clicked */}
                {pulseCount > 0 && (
                  <circle
                    cx="155"
                    cy="90"
                    r="25"
                    fill="none"
                    stroke="#BFF42E"
                    strokeWidth="1.5"
                    opacity="0.7"
                    className="animate-ping"
                  />
                )}

                {/* Waypoint A (Start / Ingress) */}
                <g transform="translate(85, 115)">
                  <circle cx="0" cy="0" r="7" fill="#0d1b12" stroke="#a3e635" strokeWidth="1" strokeDasharray="2,2" />
                  <circle cx="0" cy="0" r="2.5" fill="#BFF42E" />
                  <rect x="-14" y="-18" width="28" height="11" rx="2" fill="#0b1710" stroke="#25422e" strokeWidth="0.6" />
                  <text x="0" y="-10" textAnchor="middle" fill="#d4d4d8" fontSize="7.5" fontFamily="monospace" fontWeight="600">
                    WP-A
                  </text>
                </g>

                {/* Waypoint B (Primary Mission Target - Highlighted) */}
                <g transform="translate(210, 68)">
                  {/* Concentric reticle & targeting brackets */}
                  <circle cx="0" cy="0" r="11" fill="none" stroke="#BFF42E" strokeWidth="0.8" opacity="0.45" strokeDasharray="3,3" />
                  <circle cx="0" cy="0" r="7" fill="#13271b" stroke="#BFF42E" strokeWidth="1.2" />
                  <circle cx="0" cy="0" r="3" fill="#BFF42E" />
                  {/* Target brackets */}
                  <path d="M -9,-9 L -6,-9 M -9,-9 L -9,-6" stroke="#BFF42E" strokeWidth="1" fill="none" />
                  <path d="M 9,-9 L 6,-9 M 9,-9 L 9,-6" stroke="#BFF42E" strokeWidth="1" fill="none" />
                  <path d="M -9,9 L -6,9 M -9,9 L -9,6" stroke="#BFF42E" strokeWidth="1" fill="none" />
                  <path d="M 9,9 L 6,9 M 9,9 L 9,6" stroke="#BFF42E" strokeWidth="1" fill="none" />
                  <rect x="-24" y="-21" width="48" height="12" rx="2" fill="#102115" stroke="#BFF42E" strokeWidth="0.75" />
                  <text x="0" y="-12.5" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                    WP-B [PRI]
                  </text>
                </g>

                {/* Waypoint C (Egress / Terminal) */}
                <g transform="translate(315, 40)">
                  <circle cx="0" cy="0" r="7" fill="#0d1b12" stroke="#a3e635" strokeWidth="1" />
                  <circle cx="0" cy="0" r="2.5" fill="#a3e635" />
                  <rect x="-14" y="-18" width="28" height="11" rx="2" fill="#0b1710" stroke="#25422e" strokeWidth="0.6" />
                  <text x="0" y="-10" textAnchor="middle" fill="#d4d4d8" fontSize="7.5" fontFamily="monospace" fontWeight="600">
                    WP-C
                  </text>
                </g>

                {/* Aircraft Silhouette Marker: Top-Down Quadcopter along flight path */}
                <g transform="translate(152, 90) rotate(-22)">
                  {/* Ambient Position Glow */}
                  <circle cx="0" cy="0" r="14" fill="rgba(191,244,46,0.18)" />

                  {/* Directional Heading Cone / Arrow */}
                  <polygon points="0,-13 4,-6 -4,-6" fill="#BFF42E" />

                  {/* 4 Carbon Motor Arms */}
                  <line x1="-8" y1="-8" x2="8" y2="8" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
                  <line x1="-8" y1="8" x2="8" y2="-8" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />

                  {/* 4 Distinct Rotor Rings with Lime Accents */}
                  <circle cx="-8" cy="-8" r="3.5" fill="#0b1710" stroke="#BFF42E" strokeWidth="0.8" />
                  <circle cx="8" cy="-8" r="3.5" fill="#0b1710" stroke="#BFF42E" strokeWidth="0.8" />
                  <circle cx="-8" cy="8" r="3.5" fill="#0b1710" stroke="#BFF42E" strokeWidth="0.8" />
                  <circle cx="8" cy="8" r="3.5" fill="#0b1710" stroke="#BFF42E" strokeWidth="0.8" />

                  {/* Fuselage Core */}
                  <rect x="-3.5" y="-5" width="7" height="10" rx="1.8" fill="#ffffff" stroke="#060c08" strokeWidth="0.5" />
                  {/* Central status beacon */}
                  <circle cx="0" cy="0" r="1.5" fill="#BFF42E" />
                </g>
              </g>
            )}

            {/* Integrated Cartographic Compass Indicator (Top Right Corner) */}
            <g transform="translate(332, 22)">
              <circle cx="0" cy="0" r="11" fill="#09130c" stroke="#233d2a" strokeWidth="0.8" />
              {/* Compass Needle: Lime North pointer, dark green South */}
              <polygon points="0,-9 2.5,-1 0,0 -2.5,-1" fill="#BFF42E" />
              <polygon points="0,9 2.5,1 0,0 -2.5,1" fill="#1c3323" />
              <text x="0" y="-12" textAnchor="middle" fill="#BFF42E" fontSize="7" fontFamily="monospace" fontWeight="bold">
                N
              </text>
            </g>

            {/* Inner border frame highlight */}
            <rect x="0.5" y="0.5" width="359" height="159" rx="11" fill="none" stroke="#25422d" strokeWidth="1" opacity="0.6" pointerEvents="none" />
          </svg>
        </div>

        {/* Footer Caption Row: SCHEMATIC PREVIEW + Grid Ref */}
        <div className="flex items-center justify-between mt-2 px-0.5 relative z-10">
          <div className="flex items-center gap-1.5">
            <span className="font-sans text-[10px] text-neutral-400 font-medium">Flight</span>
            <span className="font-mono text-[8px] sm:text-[9px] text-[#BFF42E] uppercase tracking-widest font-semibold">
              • SCHEMATIC PREVIEW
            </span>
          </div>
          <span className="font-mono text-[8px] sm:text-[8.5px] text-neutral-500 uppercase tracking-wider">
            SCALE 1:25K
          </span>
        </div>
      </div>

      {/* Vertical Action Icon Buttons Column: Refined schematic controls with local cosmetic interactivity */}
      <div className="flex flex-col gap-2 pb-1">
        {/* Button 1: Layer Selection Toggle (All -> Corridor -> Terrain) */}
        <button
          type="button"
          onClick={toggleLayer}
          className={`w-7 sm:w-8 h-7 sm:h-8 rounded-full border flex items-center justify-center transition-all shadow-sm ${
            activeLayer !== 'all'
              ? 'bg-[#182b1e] border-[#BFF42E] text-[#BFF42E]'
              : 'bg-[#111713] border-neutral-700/60 text-neutral-400 hover:text-white hover:border-[#BFF42E]/50'
          }`}
          title={`Layer: ${activeLayer.toUpperCase()} (Click to toggle)`}
          aria-label="Toggle Mission Map Layer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </button>

        {/* Button 2: Toggle Grid / Cartographic Lines */}
        <button
          type="button"
          onClick={toggleGrid}
          className={`w-7 sm:w-8 h-7 sm:h-8 rounded-full border flex items-center justify-center transition-all shadow-sm ${
            showGrid
              ? 'bg-[#111713] border-neutral-700/60 text-neutral-400 hover:text-white hover:border-[#BFF42E]/50'
              : 'bg-[#182b1e] border-neutral-700 text-neutral-500'
          }`}
          title={showGrid ? 'Hide Cartographic Grid' : 'Show Cartographic Grid'}
          aria-label="Toggle Tactical Grid"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>

        {/* Button 3: Center / Pulse Tactical Reticle */}
        <button
          type="button"
          onClick={triggerCenter}
          className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-[#111713] border border-neutral-700/60 flex items-center justify-center text-neutral-400 hover:text-[#BFF42E] hover:border-[#BFF42E]/60 hover:bg-[#142318] active:scale-95 transition-all shadow-sm"
          title="Center Schematic Orientation"
          aria-label="Center Schematic Orientation"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="3" x2="12" y2="7" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <line x1="3" y1="12" x2="7" y2="12" />
            <line x1="17" y1="12" x2="21" y2="12" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
};
