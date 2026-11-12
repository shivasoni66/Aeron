import React from 'react';

interface CinematicAuthLayoutProps {
  branding: React.ReactNode;
  hero: React.ReactNode;
  radar: React.ReactNode;
  panel: React.ReactNode;
  securityNotice?: string;
}

export const CinematicAuthLayout: React.FC<CinematicAuthLayoutProps> = ({
  branding,
  hero,
  radar,
  panel,
  securityNotice = 'AERON AEROSPACE SYSTEMS • SECURE GATEWAY'
}) => {
  return (
    <div className="min-h-screen w-full relative bg-[#070b09] text-white flex flex-col justify-between overflow-x-hidden selection:bg-[#BFF42E] selection:text-[#081109]">
      {/* Background Topographic Elevation Map & Atmospheric Lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Master Topographic Elevation Contours (725 vector paths across 55 elevation levels) */}
        <img
          src="/topographic_elevation_map.svg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-90 filter brightness-105"
        />

        {/* Localized Central Olive/Lime Ambient Radiance behind Aircraft */}
        <div
          className="absolute w-[1000px] h-[800px] left-[15%] top-[10%] rounded-full blur-[160px] opacity-25 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(191,244,46,0.18) 0%, rgba(35,65,40,0.08) 50%, transparent 75%)'
          }}
        />

        {/* Right-Side Atmospheric Depth behind Login Glass Panel */}
        <div
          className="absolute w-[750px] h-[750px] right-0 top-[15%] rounded-full blur-[160px] opacity-35 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(14,24,18,0.9) 0%, transparent 70%)'
          }}
        />

        {/* Subtle Horizontal Flight Deck Horizon Line */}
        <div className="absolute top-[48%] inset-x-0 h-px bg-gradient-to-r from-transparent via-[#BFF42E]/15 to-transparent opacity-60" />

        {/* Deep Corner Vignette Gradients */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 55%, rgba(4,6,5,0.75) 100%)'
          }}
        />
      </div>

      {/* Main Interactive Stage */}
      <main className="relative z-10 flex-1 w-full max-w-[1880px] mx-auto px-6 sm:px-10 lg:px-14 py-6 sm:py-8 lg:py-10 flex flex-col justify-center">
        {/* Desktop 3-Zone Layout (>= lg: 1024px) */}
        <div className="hidden lg:grid lg:grid-cols-12 items-center gap-6 xl:gap-8 min-h-[660px] relative">
          {/* Left Zone: Minimalist Branding (top) + Expanded GPS Radar Map (bottom) */}
          <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 h-full flex flex-col justify-between py-2 z-20">
            <div>
              {branding}
            </div>
            <div className="pt-6 xl:pt-8">
              {radar}
            </div>
          </div>

          {/* Center Zone: Central Large 3D Drone Hero with Orbit Rings */}
          <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-5 flex items-center justify-center relative z-10 pointer-events-none select-none">
            <div className="pointer-events-auto flex items-center justify-center w-full">
              {hero}
            </div>
          </div>

          {/* Right Zone: Floating Translucent Forest-Green Glass Authentication Panel */}
          <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-4 flex items-center justify-end z-20">
            {panel}
          </div>
        </div>

        {/* Tablet Layout (md to lg) */}
        <div className="hidden md:flex lg:hidden flex-col items-center gap-8 py-6 relative z-10">
          <div className="w-full flex items-center justify-between">
            {branding}
            <div className="scale-95 origin-right">
              {radar}
            </div>
          </div>
          <div className="w-full flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="scale-90 xl:scale-100 -my-4">
              {hero}
            </div>
            <div className="w-full max-w-md">
              {panel}
            </div>
          </div>
        </div>

        {/* Mobile Layout (< md: 768px) */}
        <div className="flex md:hidden flex-col items-center gap-6 py-4 relative z-10">
          <div className="w-full text-left">
            {branding}
          </div>
          <div className="w-full overflow-hidden flex items-center justify-center scale-90 -my-6">
            {hero}
          </div>
          <div className="w-full max-w-md">
            {panel}
          </div>
          <div className="pt-2 scale-95">
            {radar}
          </div>
        </div>
      </main>

      {/* Clean Industrial Footer (Understated, no fake telemetry, no '//' separators) */}
      <footer className="relative z-20 w-full px-6 lg:px-14 py-3 flex items-center justify-between text-neutral-500 font-mono text-[9px] tracking-wider select-none border-t border-neutral-800/40 bg-[#070b09]/80 backdrop-blur-sm">
        <span>{securityNotice}</span>
        <span className="hidden sm:inline text-neutral-600">AUTHORIZED ACCESS ONLY • MONITORED SYSTEM</span>
      </footer>
    </div>
  );
};
