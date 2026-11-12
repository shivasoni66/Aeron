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
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-surface rounded-xl border border-border border-l-4 border-l-caution-amber shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-caution-amber text-[24px]">air</span>
            <span className="font-sans text-xs text-caution-amber uppercase tracking-wider font-semibold">M03 • Micro-Climate & Heat Island</span>
            <span className="px-2 py-0.5 rounded bg-caution-amber/15 text-caution-amber border border-caution-amber/30 font-sans text-[11px] font-medium">
              Operational
            </span>
          </div>
          <h1 className="font-sans font-bold text-lg text-text-primary tracking-tight mt-1">
            Micro-Climate & Heat Island Survey
          </h1>
          <p className="font-sans text-xs text-text-muted mt-0.5 leading-relaxed">
            Environmental sensor survey routes, elevation thermal gradient mapping, and concrete canopy radiance benchmarks.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-caution-amber text-background font-sans font-bold text-xs rounded-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(242,185,95,0.25)]"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Launch climate mission</span>
        </button>
      </div>

      {/* Sensor Architecture & Physics Disclaimer */}
      <div className="p-4 rounded-xl bg-surface border border-border flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-caution-amber/10 border border-caution-amber/20 flex items-center justify-center text-caution-amber shrink-0">
          <span className="material-symbols-outlined text-[22px]">thermostat</span>
        </div>
        <div className="font-mono text-xs space-y-1">
          <span className="text-caution-amber font-bold block uppercase">SENSOR INTEGRATION NOTE:</span>
          <p className="text-text-secondary font-sans text-xs leading-relaxed">
            AERON reports environmental readings (ambient air temperature, relative humidity, barometric pressure) collected from dedicated I2C/SPI environmental payloads. Optical ESP32-CAM feeds are visible-spectrum and must not be conflated with radiometric thermal FLIR imaging.
          </p>
        </div>
      </div>

      {/* Missions in this module */}
      <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-4 font-mono text-xs">
        <div className="flex justify-between items-center pb-3 border-b border-border/60">
          <h3 className="font-sans font-bold text-sm text-text-primary tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-caution-amber animate-pulse" />
            <span>Active climate monitoring missions</span>
          </h3>
          <span className="text-text-muted font-sans text-xs">{missions.length} missions logged</span>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-text-muted animate-pulse font-mono text-xs">
            SYNCHRONIZING MICRO-CLIMATE SORTIES...
          </div>
        ) : missions.length === 0 ? (
          <div className="text-center py-8 text-text-muted font-mono text-xs">
            NO MICRO-CLIMATE MISSIONS CURRENTLY LOGGED.
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((m) => (
              <div
                key={m._id}
                className="p-4 rounded-xl bg-surface-elevated border border-border/80 border-l-4 border-l-caution-amber flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-border"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-caution-amber font-bold">{m.missionId}</span>
                    <span className="text-text-muted">|</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.status === 'ACTIVE'
                        ? 'bg-caution-amber/15 text-caution-amber border border-caution-amber/30'
                        : 'bg-surface text-text-muted border border-border'
                    }`}>
                      {m.status}
                    </span>
                    <span className="text-text-secondary text-[11px]">STAGE {m.stage}/8 ({m.stageLabel})</span>
                  </div>
                  <h4 className="font-sans font-bold text-sm text-text-primary">{m.title}</h4>
                  <p className="font-sans text-xs text-text-muted leading-relaxed max-w-3xl">{m.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-text-muted text-[11px] font-mono">
                    AIRFRAME: <strong className="text-text-primary">HEX-01</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateMissionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={loadData}
        defaultCategory="MICRO_CLIMATE"
      />
    </div>
  );
};
