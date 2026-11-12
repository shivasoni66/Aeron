import React from 'react';

export const AuthBranding: React.FC = () => {
  return (
    <div className="flex flex-col select-none relative z-20">
      {/* 3 Minimalist Outline Icons in Restrained Grey-Green Style */}
      <div className="flex items-center gap-4 sm:gap-5 mb-5 sm:mb-6 text-[#6d8a78]">
        {/* Icon 1: Radar / Wave Antenna */}
        <span
          className="hover:text-[#BFF42E] transition-colors cursor-default"
          title="Avionics Telemetry"
        >
          <svg className="w-[22px] h-[22px] sm:w-[24px] sm:h-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
            <path d="M7.76 16.24a6 6 0 0 1 0-8.48" />
            <circle cx="12" cy="12" r="2" />
            <path d="M16.24 7.76a6 6 0 0 1 0 8.48" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </span>

        {/* Icon 2: Flight Path / Waypoint Corridor */}
        <span
          className="hover:text-[#BFF42E] transition-colors cursor-default"
          title="Waypoint Corridor"
        >
          <svg className="w-[22px] h-[22px] sm:w-[24px] sm:h-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="19" r="2.5" />
            <path d="M8.5 19h7a3.5 3.5 0 0 0 0-7h-8a3.5 3.5 0 0 1 0-7H15" />
            <circle cx="17.5" cy="5" r="2.5" />
          </svg>
        </span>

        {/* Icon 3: Tactical Target / Orientation Compass */}
        <span
          className="hover:text-[#BFF42E] transition-colors cursor-default"
          title="Tactical Grid"
        >
          <svg className="w-[22px] h-[22px] sm:w-[24px] sm:h-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="3" x2="12" y2="7" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <line x1="3" y1="12" x2="7" y2="12" />
            <line x1="17" y1="12" x2="21" y2="12" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </span>
      </div>

      {/* Brand Title: Aeron in elegant lightweight typography substantially enlarged */}
      <h1
        className="font-light tracking-[-0.015em] text-neutral-100 font-sans leading-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)] text-[58px] sm:text-[66px] md:text-[70px] lg:text-[80px] xl:text-[88px] 2xl:text-[96px]"
      >
        Aeron
      </h1>

      {/* Subtitle: Proportionally scaled while remaining secondary */}
      <div
        className="mt-3.5 sm:mt-4 text-neutral-400 font-sans tracking-wide leading-snug font-normal text-sm sm:text-[15px] lg:text-base xl:text-[17px] 2xl:text-[18px]"
      >
        <div>Enterprise Fleet Management</div>
        <div>Console</div>
      </div>
    </div>
  );
};
