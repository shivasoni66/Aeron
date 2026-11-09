import React, { useEffect, useState } from 'react';
import { fetchMissions } from '../services/api';
import { MissionData } from '../types';
import { CreateMissionModal } from '../components/CreateMissionModal';

export const MicroClimatePage: React.FC = () => {
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await fetchMissions({ category: 'MICRO_CLIMATE', limit: 15 });
      setMissions(res.missions || []);
    } catch (err: unknown) {
      console.warn(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="flex flex-col w-full gap-space-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm">
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">M03 // MICRO-CLIMATE & HEAT ISLAND</span>
            <span className="px-2 py-0.5 rounded bg-primary-fixed/20 text-primary-fixed font-label-telemetry text-[10px] font-bold">
              OPERATIONAL
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-0.5">
            MICRO-CLIMATE & HEAT ISLAND SURVEY
          </h1>
          <p className="font-body-sm text-secondary text-xs">
            Environmental sensor survey routes, elevation thermal gradient mapping, and concrete canopy radiance benchmarks.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-space-lg py-2.5 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill text-xs font-bold flex items-center gap-2 shadow-[0_0_16px_rgba(191,244,46,0.3)] shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>LAUNCH CLIMATE SORTIE +</span>
        </button>
      </div>

      {/* Sensor Architecture & Physics Disclaimer */}
      <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40 flex items-start gap-3">
        <span className="material-symbols-outlined text-primary-fixed text-[22px] shrink-0">thermostat</span>
        <div className="font-label-telemetry text-xs space-y-1">
          <span className="text-primary-fixed font-bold block uppercase">SENSOR INTEGRATION NOTE:</span>
          <p className="text-on-surface-variant font-body-sm text-xs">
            AERON reports environmental readings (ambient air temperature, relative humidity, barometric pressure) collected from dedicated I2C/SPI environmental payloads. Optical ESP32-CAM feeds are visible-spectrum and must not be conflated with radiometric thermal FLIR imaging.
          </p>
        </div>
      </div>

      {/* Missions in this module */}
      <div className="p-space-lg rounded bg-surface-container-low border border-surface-variant/40 shadow-xl space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-surface-variant">
          <h3 className="font-headline-md text-base text-primary">M03 CLIMATE MONITORING SORTIES</h3>
          <span className="font-label-telemetry text-xs text-outline">{missions.length} MISSIONS LOGGED</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-outline font-label-telemetry text-xs animate-pulse">
            LOADING MICRO-CLIMATE SORTIES...
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-8 text-outline font-label-telemetry text-xs">
            NO MICRO-CLIMATE MISSIONS CURRENTLY LOGGED
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((m) => (
              <div
                key={m._id}
                className="p-space-md rounded bg-surface-container-lowest border border-surface-variant/40 flex flex-col md:flex-row md:items-center justify-between gap-3 font-label-telemetry text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary-fixed font-bold">{m.missionId}</span>
                    <span className="text-outline">|</span>
                    <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-bold text-[10px]">
                      {m.status}
                    </span>
                    <span className="text-outline text-[11px]">STAGE {m.stage}/8 ({m.stageLabel})</span>
                  </div>
                  <h4 className="font-headline-md text-sm text-primary mt-1">{m.title}</h4>
                  <p className="text-outline text-xs mt-0.5">{m.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-outline">ASSIGNED AIRFRAME</div>
                    <div className="text-primary-fixed font-bold">{m.assignedDrones?.[0]?.droneId || 'STANDBY'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateMissionModal
        isOpen={isCreateOpen}
        defaultCategory="MICRO_CLIMATE"
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};

