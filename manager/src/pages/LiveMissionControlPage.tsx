import React, { useEffect, useState, useCallback } from 'react';
import { fetchMissions, fetchMission, fetchLatestTelemetry, createMissionEvent } from '../services/api';
import { subscribeToDroneTelemetry, subscribeToMissionEvents, subscribeToManagerBroadcasts } from '../services/socket';
import { MissionData, IncidentData, TelemetryPoint } from '../types';
import { TacticalMap } from '../components/TacticalMap';
import { SimulatorControlWidget } from '../components/SimulatorControlWidget';

export const LiveMissionControlPage: React.FC = () => {
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [selectedMission, setSelectedMission] = useState<MissionData | null>(null);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [droneTelemetry, setDroneTelemetry] = useState<TelemetryPoint | null>(null);
  const [trackCoords, setTrackCoords] = useState<[number, number][]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);

  const loadMissionsList = useCallback(async () => {
    try {
      const res = await fetchMissions({ limit: 20 });
      setMissions(res.missions || []);
      if (!selectedMissionId && res.missions?.length > 0) {
        const active = res.missions.find((m) => m.status === 'ACTIVE') || res.missions[0];
        setSelectedMissionId(active.missionId);
      }
    } catch (err) {
      console.warn('Failed to load sorties:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMissionId]);

  useEffect(() => {
    loadMissionsList();
  }, [loadMissionsList]);

  // Load single mission details
  const loadMissionDetails = useCallback(async () => {
    if (!selectedMissionId) return;
    try {
      const res = await fetchMission(selectedMissionId);
      setSelectedMission(res.mission);
      setIncidents(res.incidents || []);
    } catch (err) {
      console.warn('Failed to load mission details:', err);
    }
  }, [selectedMissionId]);

  useEffect(() => {
    loadMissionDetails();
    setTrackCoords([]);
  }, [loadMissionDetails]);

  // Real-time mission and incident event subscription
  useEffect(() => {
    if (!selectedMissionId) return;
    const unsubMission = subscribeToMissionEvents(selectedMissionId, () => {
      loadMissionDetails();
    });
    const unsubGlobal = subscribeToManagerBroadcasts({
      onMissionUpdated: (m) => {
        if (m.missionId === selectedMissionId) loadMissionDetails();
      },
      onIncidentUpdated: () => loadMissionDetails()
    });
    return () => {
      unsubMission();
      unsubGlobal();
    };
  }, [selectedMissionId, loadMissionDetails]);

  const assignedDrone = selectedMission?.assignedDrones?.[0];

  // Subscribe to live telemetry stream for assigned airframe
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
          if (res.telemetry.latitude && res.telemetry.longitude) {
            setTrackCoords([[res.telemetry.latitude, res.telemetry.longitude]]);
          }
        }
      })
      .catch(() => {});

    const unsubscribe = subscribeToDroneTelemetry(assignedDrone.droneId, (packet: any) => {
      if (isMounted && packet) {
        setDroneTelemetry((prev) => ({ ...prev, ...packet }));
        if (packet.latitude && packet.longitude) {
          setTrackCoords((prev) => {
            const next: [number, number][] = [...prev, [packet.latitude, packet.longitude]];
            return next.length > 200 ? next.slice(-200) : next;
          });
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [assignedDrone?.droneId]);

  // Build markers from real incidents
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

  // Build airframe marker if assigned and located
  if (assignedDrone) {
    const hasFix = typeof droneTelemetry?.latitude === 'number' && typeof droneTelemetry?.longitude === 'number';
    const isSim = droneTelemetry?.isSimulated === true || droneTelemetry?.source === 'SIMULATION';
    if (hasFix) {
      mapMarkers.push({
        lat: droneTelemetry!.latitude!,
        lng: droneTelemetry!.longitude!,
        title: `${assignedDrone.droneId} (${isSim ? 'SIMULATED FIX' : 'LIVE FIX'} • Alt ${droneTelemetry?.relativeAltitude?.toFixed(1) || 0}m)`,
        type: 'DRONE' as const,
        heading: droneTelemetry?.heading,
        isSimulated: isSim
      });
    }
  }

  // Derive polygon boundary from real mission operationalArea if configured
  const polygonCoords: [number, number][] | undefined = React.useMemo(() => {
    const area = selectedMission?.operationalArea;
    if (area && area.type === 'Polygon' && Array.isArray(area.coordinates) && area.coordinates[0]) {
      return (area.coordinates[0] as number[][]).map(([lon, lat]) => [lat, lon] as [number, number]);
    }
    return undefined;
  }, [selectedMission?.operationalArea]);

  const handleLogAnnotation = async () => {
    if (!selectedMissionId) return;
    try {
      await createMissionEvent(selectedMissionId, {
        eventType: 'OPERATOR_AUDIT_VERIFIED',
        description: `Operational milestone confirmed by Flight Operations Lead for Stage ${selectedMission?.stage || 1}`
      });
      setEvidenceNote('Verified audit annotation recorded in official mission ledger.');
      loadMissionDetails();
    } catch (err: unknown) {
      setEvidenceNote(`[ERROR] ${err instanceof Error ? err.message : 'Annotation failed'}`);
    }
    setTimeout(() => setEvidenceNote(null), 4000);
  };

  const isSim = droneTelemetry?.isSimulated === true || droneTelemetry?.source === 'SIMULATION';
  const hasTelemetry = !!droneTelemetry?.recordedAt;
  const ageMs = droneTelemetry?.recordedAt ? Date.now() - new Date(droneTelemetry.recordedAt).getTime() : Infinity;
  const isStale = ageMs > 5000;

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSim ? 'bg-caution-amber' : 'bg-aeron-lime'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSim ? 'bg-caution-amber' : 'bg-aeron-lime'}`} />
            </span>
            <span className="font-sans text-xs text-aeron-lime uppercase tracking-wider font-semibold">
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
              className="px-3.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-aeron-lime font-semibold focus:border-aeron-lime outline-none"
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
        <div className="p-3.5 bg-aeron-lime/15 border border-aeron-lime/40 text-aeron-lime rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{evidenceNote}</span>
          </div>
          <button onClick={() => setEvidenceNote(null)} className="text-text-primary hover:text-aeron-lime">✕</button>
        </div>
      )}

      {/* Simulator Bench Control Panel */}
      <SimulatorControlWidget />

      {/* Tactical Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Leaflet Tactical Map (7 Cols) */}
        <div className="lg:col-span-7 bg-surface rounded-xl p-5 flex flex-col justify-between shadow-sm min-h-[520px] border border-border">
          <div className="flex items-center justify-between pb-3 border-b border-border/60 font-mono text-xs">
            <div className="flex flex-col">
              <span className="text-aeron-lime font-bold uppercase tracking-wider">TACTICAL AIRSPACE CORRIDOR</span>
              <span className="text-text-muted text-[10px]">
                {polygonCoords ? 'GEOFENCE POLYGON ACTIVE' : 'OPEN FLIGHT CORRIDOR'}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded bg-surface-elevated text-text-primary text-[10px] font-bold border border-border">
              {incidents.length} FLAGGED INCIDENTS
            </span>
          </div>

          <div className="flex-1 my-3 relative min-h-[360px] rounded-xl overflow-hidden border border-border">
            <TacticalMap
              center={trackCoords[trackCoords.length - 1] || [12.9716, 77.5946]}
              zoom={14}
              markers={mapMarkers}
              polygonCoords={polygonCoords}
              routeCoords={trackCoords.length > 1 ? trackCoords : undefined}
              emptyNotice="NO ACTIVE GPS TRACK REPORTED"
            />
          </div>

          <div className="pt-2 border-t border-border/60 flex items-center justify-between font-mono text-xs text-text-muted">
            <span>CORRIDOR: SECTOR 01 (URBAN CORE)</span>
            <span className={trackCoords.length > 0 ? 'text-success font-bold' : 'text-text-muted'}>
              {trackCoords.length > 0 ? `${trackCoords.length} WAYPOINT SAMPLES RECORDED` : 'AWAITING AIRSPACE SAMPLES'}
            </span>
          </div>
        </div>

        {/* Right: Operational Telemetry & HUD (5 Cols) */}
        <div className="lg:col-span-5 bg-surface rounded-xl overflow-hidden shadow-sm relative flex flex-col justify-between min-h-[520px] border border-border">
          {/* Top Info Bar */}
          <div className="p-4 flex items-center justify-between bg-surface-elevated border-b border-border font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-surface text-aeron-lime font-bold text-[10px] border border-border">
                {selectedMission?.status || 'STANDBY'}
              </span>
              <span className="text-text-primary font-bold">{selectedMission?.missionId || 'MSN-UNKNOWN'}</span>
            </div>

            <div className="text-aeron-lime font-bold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">flight</span>
              <span>ASSET: {assignedDrone?.displayName || assignedDrone?.droneId || 'UNASSIGNED'}</span>
            </div>
          </div>

          {/* Center Tactical Viewport */}
          <div className="my-auto p-5 space-y-4">
            <div className="text-center space-y-2">
              <h3 className="font-sans font-bold text-sm text-text-primary tracking-normal">
                {assignedDrone
                  ? `Stage ${selectedMission?.stage || 1} of 8 • ${(selectedMission?.stageLabel || 'Data Collection').replace(/_/g, ' ')}`
                  : 'Awaiting mission asset dispatch'}
              </h3>
              <p className="font-sans text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                Authorized MAVLink telemetry synchronized via shared AERON backend.
              </p>
            </div>

            {/* Live Operational Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
              <div className="p-3 rounded-lg bg-surface-elevated border border-border/70">
                <span className="text-text-muted block text-[10px]">ALTITUDE (MSL / REL)</span>
                <span className="text-text-primary font-bold text-sm">
                  {droneTelemetry?.altitude !== undefined ? `${droneTelemetry.altitude.toFixed(1)}m` : 'N/A'}{' '}
                  <span className="text-text-muted text-[10px]">
                    ({droneTelemetry?.relativeAltitude !== undefined ? `${droneTelemetry.relativeAltitude.toFixed(1)}m` : 'N/A'})
                  </span>
                </span>
              </div>

              <div className="p-3 rounded-lg bg-surface-elevated border border-border/70">
                <span className="text-text-muted block text-[10px]">GROUND SPEED</span>
                <span className="text-text-primary font-bold text-sm">
                  {droneTelemetry?.groundSpeed !== undefined ? `${droneTelemetry.groundSpeed.toFixed(1)} m/s` : '0.0 m/s'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-surface-elevated border border-border/70">
                <span className="text-text-muted block text-[10px]">BATTERY VOLTAGE</span>
                <span className="text-aeron-lime font-bold text-sm">
                  {droneTelemetry?.batteryVoltage !== undefined ? `${droneTelemetry.batteryVoltage.toFixed(2)}V` : 'N/A'}
                  {droneTelemetry?.batteryPercentage !== undefined && droneTelemetry?.batteryPercentage !== null && (
                    <span className="text-text-muted text-[10px] ml-1">({droneTelemetry.batteryPercentage}%)</span>
                  )}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-surface-elevated border border-border/70">
                <span className="text-text-muted block text-[10px]">GNSS FIX & SATELLITES</span>
                <span className="text-telemetry-cyan font-bold text-sm">
                  {droneTelemetry?.gpsFixType || (droneTelemetry?.satellites ? `${droneTelemetry.satellites} Sats` : 'Awaiting lock')}
                </span>
              </div>
            </div>

            {/* Provenance Badge */}
            <div className="p-2.5 rounded-lg bg-surface-elevated border border-border/70 flex items-center justify-between text-xs font-mono">
              <span className="text-text-muted text-[11px]">TELEMETRY PROVENANCE:</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                !hasTelemetry
                  ? 'bg-surface text-text-muted border border-border'
                  : isSim
                  ? 'bg-caution-amber/15 text-caution-amber border border-caution-amber/30'
                  : 'bg-aeron-lime/15 text-aeron-lime border border-aeron-lime/30'
              }`}>
                {!hasTelemetry ? 'AWAITING STREAM' : isSim ? 'SIMULATION' : 'REAL_HARDWARE'}
                {isStale && hasTelemetry ? ' (STALE)' : ''}
              </span>
            </div>
          </div>

          {/* Bottom HUD Bar */}
          <div className="p-4 bg-surface-elevated flex flex-wrap items-center justify-between gap-3 border-t border-border font-sans text-xs">
            <div className="flex items-center gap-3 text-text-secondary text-[11px]">
              <span>Status: <strong className="text-success font-semibold">{assignedDrone?.operationalStatus || 'Standby'}</strong></span>
              <span>Stage: <strong className="text-aeron-lime font-mono">{selectedMission?.stage || 1}/8</strong></span>
            </div>

            <button
              onClick={handleLogAnnotation}
              className="px-3.5 py-1.5 rounded-lg bg-aeron-lime text-background font-sans font-semibold text-xs hover:brightness-110 transition-all flex items-center gap-1.5 shadow-sm"
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
