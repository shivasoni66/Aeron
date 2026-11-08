import React from 'react';

export const DroneOverviewPage: React.FC = () => {
  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-lg text-on-surface">
      {/* Protocol Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm px-space-md py-space-xs bg-surface-container-lowest rounded shadow-sm">
        <div className="flex flex-wrap items-center gap-space-sm text-label-telemetry font-label-telemetry">
          <span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 bg-primary-container text-on-primary-container rounded-full font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-on-primary-container animate-pulse"></span>
            BENCH TEST ACTIVE
          </span>
          <span className="text-on-surface-variant">MAVLINK 2.0 // USB-SERIAL 57600 BAUD</span>
          <span className="text-on-surface-variant">|</span>
          <span className="text-primary-fixed">TARGET: PIXHAWK 2.4.8 (STM32F427)</span>
          <span className="text-on-surface-variant">|</span>
          <span className="text-on-surface-variant">
            MODE: <strong className="text-primary">MANUAL / POSHOLD BENCH TEST</strong>
          </span>
        </div>
        <div className="flex items-center gap-space-md text-label-telemetry font-label-telemetry">
          <span className="text-on-surface-variant">
            SYS_ID: <strong className="text-on-surface">01</strong>
          </span>
          <span className="text-on-surface-variant">
            COMP_ID: <strong className="text-on-surface">01</strong>
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container-high rounded text-primary-fixed font-bold">
            <span className="material-symbols-outlined text-[14px]">sensors</span>IMU_EKF3: CALIBRATED
          </span>
        </div>
      </div>

      {/* 8-Column Quick Telemetry HUD Badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-space-xs">
        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">LAT / LON</span>
          <div className="mt-1">
            <p className="text-label-telemetry font-label-telemetry text-primary leading-tight">12.9716° N</p>
            <p className="text-label-telemetry font-label-telemetry text-secondary leading-tight">77.5946° E</p>
          </div>
        </div>

        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">ALT (AGL)</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-headline-md font-headline-md text-primary">42.4</span>
            <span className="text-label-telemetry font-label-telemetry text-on-surface-variant">M</span>
          </div>
        </div>

        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">GROUND SPD</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-headline-md font-headline-md text-primary">0.0</span>
            <span className="text-label-telemetry font-label-telemetry text-on-surface-variant">M/S (BENCH)</span>
          </div>
        </div>

        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">BATT [4S]</span>
            <span className="text-label-telemetry font-label-telemetry text-primary-fixed">78%</span>
          </div>
          <div className="mt-1">
            <div className="text-headline-md font-headline-md text-primary-fixed leading-none">
              15.2<span className="text-label-telemetry font-label-telemetry text-on-surface ml-1">V</span>
            </div>
            <div className="w-full h-1 bg-surface-container-highest rounded-full mt-1.5 overflow-hidden">
              <div className="bg-primary-container h-full w-[78%]"></div>
            </div>
          </div>
        </div>

        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">GPS STATUS</span>
          <div className="mt-1">
            <p className="text-label-telemetry font-label-telemetry text-primary-fixed">3D FIX (BENCH SIM)</p>
            <p className="text-label-telemetry font-label-telemetry text-secondary text-[11px]">8 SATS // NO RTK</p>
          </div>
        </div>

        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">FLIGHT MODE</span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-fixed"></span>
            <span className="text-label-telemetry font-label-telemetry text-primary tracking-wide">POSHOLD TEST</span>
          </div>
        </div>

        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">ARM STATE</span>
          <div className="mt-1">
            <span className="inline-block px-1.5 py-0.5 rounded bg-primary-container text-on-primary-container font-label-telemetry text-label-telemetry uppercase tracking-wider font-bold">
              BENCH ARMED
            </span>
          </div>
        </div>

        <div className="p-space-sm bg-surface-container-low rounded flex flex-col justify-between shadow-sm">
          <span className="text-label-telemetry font-label-telemetry text-on-surface-variant uppercase">PWM OUT</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-headline-md font-headline-md text-primary">1100</span>
            <span className="text-label-telemetry font-label-telemetry text-on-surface-variant">µs</span>
          </div>
        </div>
      </div>

      {/* Aircraft Readiness Gate & Subsystem Clearance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        <div className="lg:col-span-5 bg-surface-container-low p-space-md rounded flex flex-col justify-between shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-highest/60">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              <span className="font-headline-md text-headline-md text-primary tracking-wide">AIRCRAFT READINESS GATE</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-primary-fixed font-label-telemetry text-label-telemetry font-bold">
              BENCH STAGE 2
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-space-md py-space-sm">
            <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" fill="none" r="50" stroke="#2A2A2A" strokeWidth="9"></circle>
                <circle
                  className="transition-all duration-700"
                  cx="60"
                  cy="60"
                  fill="none"
                  r="50"
                  stroke="#BFF42E"
                  strokeDasharray="314.159"
                  strokeDashoffset="56.5"
                  strokeLinecap="round"
                  strokeWidth="9"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-headline-lg font-headline-lg text-primary leading-none">82%</span>
                <span className="text-[10px] font-label-telemetry text-primary-fixed uppercase mt-0.5 tracking-wider font-bold">
                  BENCH READY
                </span>
                <span className="text-[9px] font-label-telemetry text-on-surface-variant">4/5 VERIFIED</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2 font-label-telemetry text-label-telemetry">
              <div className="flex items-center justify-between text-[11px] p-1.5 bg-surface-container-lowest rounded border-l-2 border-primary-fixed">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed"></span>FC CORE INIT
                </span>
                <span className="text-primary-fixed font-bold">VERIFIED (100%)</span>
              </div>
              <div className="flex items-center justify-between text-[11px] p-1.5 bg-surface-container-lowest rounded border-l-2 border-primary-fixed">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed"></span>GPS 3D LOCK
                </span>
                <span className="text-primary-fixed font-bold">8 SATS (SIM)</span>
              </div>
              <div className="flex items-center justify-between text-[11px] p-1.5 bg-surface-container-lowest rounded border-l-2 border-primary-fixed">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed"></span>EKF3 BUS SENSORS
                </span>
                <span className="text-primary-fixed font-bold">PASS (HEALTHY)</span>
              </div>
              <div className="flex items-center justify-between text-[11px] p-1.5 bg-surface-container-lowest rounded border-l-2 border-outline-variant/30">
                <span className="text-secondary flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-surface-variant"></span>OPTICAL / LIDAR
                </span>
                <span className="text-error font-bold">BYPASS EXEMPT</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-space-xs text-label-telemetry font-label-telemetry text-on-surface-variant bg-surface-container-lowest/60 px-space-sm py-1 rounded">
            <span>
              STATUS: <strong className="text-primary-fixed font-bold">BENCH TEST QUALIFIED</strong>
            </span>
            <span className="text-secondary">LIDAR BYPASS ACTIVE</span>
          </div>
        </div>

        <div className="lg:col-span-7 bg-surface-container-low p-space-md rounded flex flex-col justify-between shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-highest/60">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-primary-fixed text-[20px]">fact_check</span>
              <h3 className="font-headline-md text-headline-md text-primary tracking-wide">
                PRE-FLIGHT AVIONICS VERIFICATION
              </h3>
            </div>
            <div className="flex items-center gap-space-xs font-label-telemetry text-label-telemetry">
              <span className="text-on-surface-variant">SUBSYSTEM AUDIT:</span>
              <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-bold">
                5 OF 6 CLEARED
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-xs py-space-xs text-label-telemetry font-label-telemetry">
            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <span className="text-on-surface">✓ Pixhawk 2.4.8 FC Bus Verified</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed text-[10px] font-bold">
                PASS
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <span className="text-on-surface">✓ U-Blox M8N 3D Fix (8 Sats Bench)</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed text-[10px] font-bold">
                PASS
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <span className="text-secondary">⏳ ESP32-CAM [Bench Hardware Linked]</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-bold">
                STANDBY
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <span className="text-on-surface">✓ 4S LiPo Bench Power (15.2V / 78%)</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed text-[10px] font-bold">
                PASS
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded">
              <span className="text-on-surface">✓ Pre-Arm Safety Switch & Harness</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-primary-fixed text-[10px] font-bold">
                PASS
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-surface-container-lowest rounded border border-error/30">
              <span className="text-error">! Downward LiDAR & Optical Flow</span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-error text-[10px] font-bold">
                NOT INSTALLED
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-space-xs text-[11px] font-label-telemetry text-label-telemetry text-on-surface-variant">
            <span>HARDWARE COMPLIANCE AUDIT // AERON GCS</span>
            <span className="text-primary-fixed font-bold">MANUAL / POSHOLD BENCH TEST</span>
          </div>
        </div>
      </div>
    </div>
  );
};

