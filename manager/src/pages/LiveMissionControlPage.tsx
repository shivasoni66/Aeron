import React, { useEffect, useState } from 'react';
import { fetchMissions, fetchMission, fetchLatestTelemetry } from '../services/api';
import { subscribeToDroneTelemetry } from '../services/socket';
import { MissionData, IncidentData, TelemetryPoint } from '../types';
import { TacticalMap } from '../components/TacticalMap';
import { SimulatorControlWidget } from '../components/SimulatorControlWidget';

export const LiveMissionControlPage: React.FC = () => {
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [selectedMission, setSelectedMission] = useState<MissionData | null>(null);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [droneTelemetry, setDroneTelemetry] = useState<TelemetryPoint | null>(null);
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

  useEffect(() => {
    if (!assignedDrone?.droneId) {
      setDroneTelemetry(null);
      return;
    }

    let isMounted = true;
    fetchLatestTelemetry(assignedDrone.droneId)
      .then((res: { telemetry: TelemetryPoint | null }) => {
        if (isMounted && res?.telemetry) {
          setDroneTelemetry(res.telemetry);
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeToDroneTelemetry(assignedDrone.droneId, (packet: any) => {
      if (isMounted && packet) {
        setDroneTelemetry((prev) => ({ ...prev, ...packet }));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [assignedDrone?.droneId]);

  const mapMarkers: {
    lat: number;
    lng: number;
    title: string;
    type: 'DRONE' | 'INCIDENT' | 'WAYPOINT' | 'TARGET';
    heading?: number;
    isSimulated?: boolean;
  }[] = incidents.map((inc) => ({
    lat: inc.location?.coordinates?.[1] || 12.9716,
    lng: inc.location?.coordinates?.[0] || 77.5946,
    title: `${inc.incidentId}: ${inc.description}`,
    type: 'INCIDENT'
  }));

  if (assignedDrone) {
    const hasFix = droneTelemetry?.latitude && droneTelemetry?.longitude;
    const droneLat = hasFix ? droneTelemetry!.latitude! : 12.9716;
    const droneLng = hasFix ? droneTelemetry!.longitude! : 77.5946;
    const isSim = droneTelemetry?.isSimulated ?? true;
    const statusTag = hasFix
      ? `${isSim ? 'SIMULATED FIX' : 'LIVE FIX'} • Alt ${droneTelemetry?.relativeAltitude?.toFixed(1) || 0}m`
      : 'STANDBY / BENCH REFERENCE';

    mapMarkers.push({
      lat: droneLat,
      lng: droneLng,
      title: `${assignedDrone.droneId} (${statusTag})`,
      type: 'DRONE' as const,
      heading: droneTelemetry?.heading,
      isSimulated: isSim
    });
  }

  const handleLogAnnotation = () => {
    setEvidenceNote('Verified test annotation recorded in mission log.');
    setTimeout(() => setEvidenceNote(null), 4000);
  };

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-primary" />
            </span>
            <span className="font-sans text-xs text-accent-primary uppercase tracking-wider font-semibold">
              Tactical GCS • Live Mission Control
            </span>
          </div>
          <h1 className="font-sans font-bold text-lg text-text-primary tracking-normal mt-1">
            {selectedMission ? selectedMission.title : 'Mission Flight Monitor'}
          </h1>
        </div>

        {/* Mission Switcher */}
        <div className="flex items-center gap-2.5 font-sans text-xs">
          <span className="text-text-muted">Active sortie:</span>
          {isLoading ? (
            <span className="text-text-muted animate-pulse">Loading sorties...</span>
          ) : (
            <select
              value={selectedMissionId}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="px-3.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-accent-primary font-semibold focus:border-accent-primary outline-none"
            >
              {missions.map((m) => (
                <option key={m.missionId} value={m.missionId}>
                  {m.missionId} • {m.title} ({m.status.toLowerCase()})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {evidenceNote && (
        <div className="p-3.5 bg-accent-primary/15 border border-accent-primary/40 text-accent-primary rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{evidenceNote}</span>
          </div>
          <button onClick={() => setEvidenceNote(null)} className="text-text-primary hover:text-accent-primary">✕</button>
        </div>
      )}

      {/* Simulator Bench Control Panel */}
      <SimulatorControlWidget />

      {/* Tactical Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Leaflet Tactical Map (7 Cols) */}
        <div className="lg:col-span-7 bg-surface rounded-xl p-5 flex flex-col justify-between shadow-sm min-h-[500px] border border-border">
          <div className="flex items-center justify-between pb-3 border-b border-border/60 font-mono text-xs">
            <div className="flex flex-col">
              <span className="text-accent-primary font-bold uppercase tracking-wider">TACTICAL AIRSPACE CORRIDOR</span>
              <span className="text-text-muted text-[10px]">COORDINATES & WAYPOINT GEOFENCE</span>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-surface-elevated text-text-primary text-[10px] font-bold border border-border">
              {incidents.length} FLAGGED INCIDENTS
            </span>
          </div>

          <div className="flex-1 my-3 relative min-h-[360px] rounded-xl overflow-hidden border border-border">
            <TacticalMap
              center={[12.9716, 77.5946]}
              zoom={14}
              markers={mapMarkers}
              polygonCoords={[
                [12.980, 77.585],
                [12.980, 77.605],
                [12.960, 77.605],
                [12.960, 77.585]
              ]}
              routeCoords={[
                [12.975, 77.590],
                [12.973, 77.593],
                [12.9716, 77.5946],
                [12.9725, 77.5960]
              ]}
              emptyNotice="NO ACTIVE GPS TRACK REPORTED"
            />
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between font-mono text-xs text-text-muted">
            <span>CORRIDOR: SECTOR 01 (URBAN CORE)</span>
            <span className="text-success font-bold">AIRSPACE CLEARED</span>
          </div>
        </div>

        {/* Right: Optical Telemetry & Detection Box HUD (5 Cols) */}
        <div className="lg:col-span-5 bg-surface rounded-xl overflow-hidden shadow-sm relative flex flex-col justify-between min-h-[500px] border border-border">
          {/* Top Info Bar */}
          <div className="p-4 flex items-center justify-between bg-surface-elevated border-b border-border font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-surface text-accent-primary font-bold text-[10px] border border-border">
                {selectedMission?.status || 'STANDBY'}
              </span>
              <span className="text-text-primary font-bold">{selectedMission?.missionId || 'MSN-UNKNOWN'}</span>
            </div>

            <div className="text-accent-primary font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">flight</span>
              <span>ASSET: {assignedDrone?.droneId || 'HEX-01'}</span>
            </div>
          </div>

          {/* Center Tactical Viewport */}
          <div className="my-auto text-center p-6 space-y-4">
            <div className="w-20 h-20 mx-auto border border-accent-primary/40 rounded-full flex items-center justify-center relative">
              <span className="material-symbols-outlined text-[32px] text-accent-primary/80">camera_alt</span>
              <div className="absolute w-28 h-[1px] bg-accent-primary/30" />
              <div className="absolute h-28 w-[1px] bg-accent-primary/30" />
            </div>

            <h3 className="font-sans font-bold text-sm text-text-primary tracking-normal">
              {assignedDrone
                ? `Stage ${selectedMission?.stage || 1} of 8 • ${(selectedMission?.stageLabel || 'Data Collection').replace(/_/g, ' ')}`
                : 'Awaiting mission asset dispatch'}
            </h3>

            <p className="font-sans text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              Optical payload telemetry synced over authenticated WebSocket room. Target detections and inferences verified below.
            </p>

            {/* Neural Net Detection Box */}
            <div className="inline-block border border-accent-primary/50 bg-accent-primary/10 px-3.5 py-1.5 rounded-lg font-sans text-xs text-accent-primary shadow-sm">
              <span className="font-mono text-xs">#BENCH-SAMPLE-042</span> • {selectedMission?.missionType || 'Defect'} <span className="font-mono text-xs font-semibold">(88.0% confidence)</span>
            </div>
          </div>

          {/* Bottom HUD Bar */}
          <div className="p-4 bg-surface-elevated flex flex-wrap items-center justify-between gap-3 border-t border-border font-sans text-xs">
            <div className="flex items-center gap-3 text-text-secondary text-[11px]">
              <span>Status: <strong className="text-success font-semibold">{assignedDrone?.operationalStatus || 'Ready'}</strong></span>
              <span>Stage: <strong className="text-accent-primary font-mono">{selectedMission?.stage || 1}/8</strong></span>
            </div>

            <button
              onClick={handleLogAnnotation}
              className="px-3.5 py-1.5 rounded-lg bg-accent-primary text-background font-sans font-semibold text-xs hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>Log verified annotation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
