import React, { useEffect, useState } from 'react';
import { fetchMissions, fetchMission } from '../services/api';
import { MissionData, IncidentData } from '../types';
import { TacticalMap } from '../components/TacticalMap';

export const LiveMissionControlPage: React.FC = () => {
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [selectedMission, setSelectedMission] = useState<MissionData | null>(null);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);

  useEffect(() => {
    fetchMissions({ limit: 20 })
      .then((res) => {
        setMissions(res.missions || []);
        const active = res.missions.find((m) => m.status === 'ACTIVE') || res.missions[0];
        if (active) {
          setSelectedMissionId(active.missionId);
        }
      })
      .catch((err) => console.warn(err))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMissionId) return;

    fetchMission(selectedMissionId)
      .then((res) => {
        setSelectedMission(res.mission);
        setIncidents(res.incidents || []);
      })
      .catch((err) => console.warn(err));
  }, [selectedMissionId]);

  const assignedDrone = selectedMission?.assignedDrones?.[0];

  const mapMarkers: { lat: number; lng: number; title: string; type: 'DRONE' | 'INCIDENT' | 'WAYPOINT' | 'TARGET' }[] = incidents.map((inc) => ({
    lat: inc.location?.coordinates?.[1] || 48.1371,
    lng: inc.location?.coordinates?.[0] || 11.5761,
    title: `${inc.incidentId}: ${inc.description}`,
    type: 'INCIDENT'
  }));

  // Add drone marker if mission has assigned drone
  if (assignedDrone) {
    mapMarkers.push({
      lat: 48.1312,
      lng: 11.579,
      title: `${assignedDrone.droneId} (${assignedDrone.operationalStatus})`,
      type: 'DRONE' as const
    });
  }

  const handleLogAnnotation = () => {
    setEvidenceNote('Verified test annotation recorded in mission log.');
    setTimeout(() => setEvidenceNote(null), 4000);
  };

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-fixed opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary-fixed"></span>
            </span>
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed uppercase tracking-wider">
              TACTICAL GCS // LIVE MISSION CONTROL
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-0.5">
            {selectedMission ? selectedMission.title : 'MISSION FLIGHT MONITOR'}
          </h1>
        </div>

        {/* Mission Switcher */}
        <div className="flex items-center gap-2 font-label-telemetry text-xs">
          <span className="text-outline uppercase">SELECT ACTIVE SORTIE:</span>
          {isLoading ? (
            <span className="text-outline animate-pulse">LOADING SORTIES...</span>
          ) : (
            <select
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="px-3 py-2 rounded bg-surface-container-low border border-surface-variant text-primary-fixed font-bold focus:outline-none"
            >
              {missions.map((m) => (
                <option key={m.missionId} value={m.missionId}>
                  {m.missionId} // {m.title} [{m.status}]
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {evidenceNote && (
        <div className="p-space-sm bg-primary-container/20 border border-primary-fixed text-primary-fixed rounded font-label-telemetry text-xs flex items-center justify-between">
          <span>{evidenceNote}</span>
          <button onClick={() => setEvidenceNote(null)}>✕</button>
        </div>
      )}

      {/* Tactical Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Left Panel: Authorized Stored Evidence / Optical Preview */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-lg overflow-hidden shadow-2xl relative flex flex-col justify-between min-h-[460px] border border-surface-variant/50">
          {/* Backdrop simulation pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px] opacity-60 pointer-events-none" />

          {/* Top Info Bar */}
          <div className="relative z-10 p-space-md flex items-center justify-between bg-surface-container-lowest/80 backdrop-blur-md border-b border-surface-variant/40 font-label-telemetry text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-bold text-[10px]">
                {selectedMission?.status || 'STANDBY'}
              </span>
              <span className="text-primary font-bold">{selectedMission?.missionId || 'MSN-UNKNOWN'}</span>
              <span className="text-outline">|</span>
              <span className="text-secondary">{selectedMission?.missionType}</span>
            </div>

            <div className="text-primary-fixed font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">flight</span>
              <span>ASSET: {assignedDrone?.droneId || 'STANDBY'}</span>
            </div>
          </div>

          {/* Center Tactical Viewport */}
          <div className="relative z-10 my-auto text-center p-space-lg space-y-3 pointer-events-none">
            <div className="w-24 h-24 mx-auto border border-primary-fixed/30 rounded-full flex items-center justify-center relative">
              <span className="material-symbols-outlined text-[36px] text-primary-fixed/60">camera_alt</span>
              <div className="absolute w-32 h-[1px] bg-primary-fixed/30" />
              <div className="absolute h-32 w-[1px] bg-primary-fixed/30" />
            </div>

            <h3 className="font-headline-md text-sm text-primary tracking-wide">
              {assignedDrone ? `STAGE ${selectedMission?.stage || 1}/8: ${selectedMission?.stageLabel || 'DATA COLLECTION'}` : 'AWAITING MISSION ASSET LAUNCH'}
            </h3>

            <p className="font-label-telemetry text-xs text-outline max-w-md mx-auto">
              Per AERON Security Boundary, raw optical FPV streams are guarded in Admin GCS. Staged mission evidence and verified detections are relayed below.
            </p>

            {/* Simulated YOLO Detection Box Annotation */}
            <div className="inline-block border border-primary-fixed/60 bg-primary-fixed/10 px-3 py-1.5 rounded font-label-telemetry text-[11px] text-primary-fixed shadow-[0_0_12px_rgba(191,244,46,0.2)]">
              #BENCH-SAMPLE-042 // {selectedMission?.missionType || 'DEFECT'} [88.0% CONFIDENCE]
            </div>
          </div>

          {/* Bottom HUD Bar */}
          <div className="relative z-10 p-space-md bg-surface-container-lowest/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-space-sm border-t border-surface-variant/40 font-label-telemetry text-xs">
            <div className="flex items-center gap-3 text-secondary text-[11px]">
              <span>AIRFRAME: <strong className="text-primary">{assignedDrone?.droneId || 'AERON-PX4-BENCH01'}</strong></span>
              <span>STATUS: <strong className="text-primary-fixed">{assignedDrone?.operationalStatus || 'READY'}</strong></span>
              <span>STAGE: <strong className="text-primary">{selectedMission?.stage || 1}/8</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLogAnnotation}
                className="px-3 py-1.5 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill text-xs font-bold transition-all shadow-[0_0_12px_rgba(191,244,46,0.3)] flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                LOG VERIFIED ANNOTATION
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Leaflet Tactical Map */}
        <div className="lg:col-span-5 bg-surface-container-low rounded-lg p-space-md flex flex-col justify-between shadow-xl min-h-[460px] border border-surface-variant/50">
          <div className="flex items-center justify-between pb-2 border-b border-surface-variant/40 font-label-telemetry text-xs">
            <div className="flex flex-col">
              <span className="text-primary-fixed font-bold uppercase">TACTICAL AIRSPACE CORRIDOR</span>
              <span className="text-outline text-[10px]">COORDINATES & GEOFENCE GRID</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed text-[10px] font-bold">
              {incidents.length} INCIDENTS
            </span>
          </div>

          <div className="flex-1 my-3 relative min-h-[320px]">
            <TacticalMap
              center={[48.1371, 11.5761]}
              zoom={13}
              markers={mapMarkers}
              polygonCoords={[
                [48.145, 11.565],
                [48.145, 11.59],
                [48.125, 11.59],
                [48.125, 11.565]
              ]}
              routeCoords={[
                [48.14, 11.57],
                [48.138, 11.575],
                [48.135, 11.58],
                [48.1312, 11.579]
              ]}
              emptyNotice="NO ACTIVE GPS TRACK REPORTED"
            />
          </div>

          <div className="pt-2 border-t border-surface-variant/40 flex items-center justify-between font-label-telemetry text-[11px] text-outline">
            <span>SECTOR: ZONE 01</span>
            <span className="text-primary-fixed font-bold">BENCH CORRIDOR: ARMED</span>
          </div>
        </div>
      </div>
    </div>
  );
};

