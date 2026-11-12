import React, { useEffect, useState } from 'react';
import { fetchFlights, fetchFlight } from '../services/api';
import { FlightSessionData, TelemetryPoint } from '../types';
import { TacticalMap } from '../components/TacticalMap';

export const TripRouteHistoryPage: React.FC = () => {
  const [flights, setFlights] = useState<FlightSessionData[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected Flight for Route Replay & Inspection
  const [selectedFlight, setSelectedFlight] = useState<FlightSessionData | null>(null);
  const [telemetrySamples, setTelemetrySamples] = useState<TelemetryPoint[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  const loadFlights = async (p = 1) => {
    setIsLoading(true);
    try {
      const res = await fetchFlights({
        page: p,
        limit: 15,
        source: sourceFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined
      });
      setFlights(res.flights || []);
      setPagination(res.pagination || { page: p, limit: 15, total: 0, totalPages: 1 });

      if (res.flights && res.flights.length > 0 && !selectedFlight) {
        inspectFlight(res.flights[0].flightSessionId);
      }
    } catch (err: unknown) {
      console.warn(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlights(1);
  }, [sourceFilter, statusFilter]);

  const inspectFlight = async (flightSessionId: string) => {
    setIsLoadingDetails(true);
    try {
      const res = await fetchFlight(flightSessionId);
      setSelectedFlight(res.flight);
      setTelemetrySamples(res.telemetrySamples || []);
    } catch (err: unknown) {
      console.warn(err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadFlights(1);
  };

  // Convert telemetry samples to Leaflet route coordinates [lat, lng]
  const routeCoordinates = telemetrySamples
    .filter((s) => s.latitude && s.longitude)
    .map((s) => [s.latitude, s.longitude] as [number, number]);

  const routeMarkers = [];
  if (routeCoordinates.length > 0) {
    routeMarkers.push({
      lat: routeCoordinates[0][0],
      lng: routeCoordinates[0][1],
      title: 'Departure Checkpoint',
      type: 'WAYPOINT' as const
    });
    routeMarkers.push({
      lat: routeCoordinates[routeCoordinates.length - 1][0],
      lng: routeCoordinates[routeCoordinates.length - 1][1],
      title: 'Current / Recovery Checkpoint',
      type: 'DRONE' as const
    });
  }

  // Derived telemetry metrics
  const maxAlt = telemetrySamples.reduce((max, s) => Math.max(max, s.altitude || 0), 0);
  const avgSpeed = telemetrySamples.length > 0
    ? (telemetrySamples.reduce((sum, s) => sum + (s.groundSpeed || 0), 0) / telemetrySamples.length).toFixed(1)
    : '0.0';

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-sans text-xs font-semibold border border-primary-fixed/20">
              Auditable Sortie Archive
            </span>
          </div>
          <h1 className="font-sans text-2xl font-bold text-on-surface tracking-tight mt-1">
            Trip & Route History
          </h1>
          <p className="font-sans text-secondary text-xs">
            Historical flight trajectories, waypoint milestones, and immutable telemetry session records.
          </p>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="p-4 rounded-xl bg-surface-container-low border border-surface-variant/40 flex flex-wrap items-center justify-between gap-3 font-sans text-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[260px]">
          <div className="bg-surface-container-lowest px-3 py-2 rounded-lg flex items-center gap-2 border border-surface-variant/60 flex-1">
            <span className="material-symbols-outlined text-[16px] text-outline">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by flight ID or airframe..."
              className="bg-transparent text-on-surface focus:outline-none w-full text-xs placeholder:text-outline/70"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-surface-container-high hover:bg-surface-variant rounded-lg text-on-surface font-semibold text-xs transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap font-sans text-xs">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-variant/60 text-on-surface focus:outline-none text-xs"
          >
            <option value="">All Sources</option>
            <option value="REAL">Real Hardware</option>
            <option value="SIMULATION">Simulation Bench</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-variant/60 text-on-surface focus:outline-none text-xs"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="ABORTED">Aborted</option>
          </select>
        </div>
      </div>

      {/* Route Visualizer & Selected Flight Telemetry */}
      {selectedFlight && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Tactical Map Route Reconstruction (7 cols) */}
          <div className="lg:col-span-7 bg-surface-container-low p-4 rounded-xl border border-surface-variant/40 shadow-xl flex flex-col justify-between min-h-[420px]">
            <div className="flex justify-between items-center pb-3 border-b border-surface-variant/40 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-primary-fixed font-bold">{selectedFlight.flightSessionId}</span>
                <span className="text-outline">/</span>
                <span className="text-on-surface font-semibold">{selectedFlight.droneId?.droneId || 'AERON-PX4-BENCH01'}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedFlight.source === 'REAL'
                  ? 'bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/30'
                  : 'bg-surface-container text-secondary border border-surface-variant'
              }`}>
                {selectedFlight.source}
              </span>
            </div>

            <div className="flex-1 my-3 relative min-h-[320px] rounded-lg overflow-hidden border border-surface-variant/30">
              {isLoadingDetails ? (
                <div className="h-full min-h-[320px] flex items-center justify-center text-outline font-mono text-xs animate-pulse">
                  RECONSTRUCTING FLIGHT ROUTE & TELEMETRY...
                </div>
              ) : (
                <TacticalMap
                  center={routeCoordinates[0] || [48.1371, 11.5761]}
                  zoom={14}
                  markers={routeMarkers}
                  routeCoords={routeCoordinates}
                  emptyNotice="NO BOUNDED GPS TRAJECTORY POINTS STORED FOR THIS SORTIE"
                />
              )}
            </div>

            <div className="pt-2 border-t border-surface-variant/40 flex justify-between items-center font-mono text-[11px] text-outline">
              <span>SAMPLES RENDERED: <strong className="text-on-surface">{telemetrySamples.length}</strong> PTS</span>
              <span>PEAK ALT: <strong className="text-primary-fixed">{maxAlt.toFixed(1)}m</strong></span>
              <span>AVG SPEED: <strong className="text-on-surface">{avgSpeed} m/s</strong></span>
              <span>DURATION: <strong className="text-on-surface">{Math.round(selectedFlight.durationSeconds / 60)} MIN</strong></span>
            </div>
          </div>

          {/* Flight Summary & Audit Metrics (5 cols) */}
          <div className="lg:col-span-5 bg-surface-container-low p-5 rounded-xl border border-surface-variant/40 shadow-xl flex flex-col justify-between font-mono text-xs">
            <div>
              <div className="flex justify-between items-center pb-3 border-b border-surface-variant/40 mb-3">
                <span className="text-on-surface font-bold tracking-wider uppercase font-sans text-sm">Sortie Intelligence</span>
                <span className="text-outline text-[11px]">{new Date(selectedFlight.startedAt).toLocaleDateString()}</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center py-1.5 border-b border-surface-variant/30">
                  <span className="text-outline">AIRFRAME ID</span>
                  <span className="text-primary-fixed font-bold">{selectedFlight.droneId?.droneId || 'AERON-PX4-BENCH01'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-surface-variant/30">
                  <span className="text-outline">ASSIGNED MISSION</span>
                  <span className="text-on-surface max-w-[200px] truncate text-right font-medium">{selectedFlight.missionId?.title || 'GENERAL TELEMETRY LOG'}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-surface-variant/30">
                  <span className="text-outline">FLIGHT STATUS</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                    selectedFlight.status === 'COMPLETED'
                      ? 'bg-status-success/20 text-status-success border border-status-success/30'
                      : selectedFlight.status === 'ABORTED'
                      ? 'bg-status-danger/20 text-status-danger border border-status-danger/30'
                      : 'bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/30'
                  }`}>
                    {selectedFlight.status}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-surface-variant/30">
                  <span className="text-outline">DEPARTURE</span>
                  <span className="text-on-surface">{new Date(selectedFlight.startedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-surface-variant/30">
                  <span className="text-outline">RECOVERY</span>
                  <span className="text-on-surface">
                    {selectedFlight.endedAt ? new Date(selectedFlight.endedAt).toLocaleTimeString() : 'ACTIVE SORTIE'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-surface-variant/30">
                  <span className="text-outline">RECORDED DURATION</span>
                  <span className="text-primary-fixed font-bold">
                    {Math.floor(selectedFlight.durationSeconds / 60)}m {selectedFlight.durationSeconds % 60}s
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-surface-container-lowest rounded-lg border border-surface-variant/40 text-[11px] text-secondary leading-relaxed">
              <strong className="text-primary-fixed block font-mono text-[10px] uppercase mb-1">Source Telemetry Verification:</strong>
              {selectedFlight.source === 'REAL'
                ? 'MAVLink telemetry streamed over physical Pixhawk serial port. Verified real-world flight data with cryptographic integrity hash.'
                : 'Synthetic simulation bench telemetry generated by software bench emulator for operational mission rehearsal.'}
            </div>
          </div>
        </div>
      )}

      {/* Flight Sessions Table */}
      <div className="w-full overflow-x-auto rounded-xl bg-surface-container-low shadow-xl border border-surface-variant/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-lowest text-outline font-sans text-[11px] font-semibold border-b border-surface-variant/50">
              <th className="p-4">Sortie ID</th>
              <th className="p-4">Airframe</th>
              <th className="p-4">Telemetry Source</th>
              <th className="p-4">Started</th>
              <th className="p-4">Duration</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant/30 text-on-surface font-sans text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-outline">
                  Loading flight sessions...
                </td>
              </tr>
            ) : flights.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-outline">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <span className="material-symbols-outlined text-[36px] text-outline/50">history_toggle_off</span>
                    <span className="font-semibold text-on-surface">No flight sessions found</span>
                    <p className="text-[11px] text-secondary max-w-sm">
                      Zero flight sortie records match the filter criteria.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              flights.map((f) => (
                <tr
                  key={f._id}
                  onClick={() => inspectFlight(f.flightSessionId)}
                  className={`hover:bg-surface-container transition-colors cursor-pointer ${selectedFlight?.flightSessionId === f.flightSessionId ? 'bg-surface-container/70' : ''}`}
                >
                  <td className="p-4 font-mono text-primary-fixed font-bold">
                    {f.flightSessionId}
                  </td>
                  <td className="p-4 font-mono text-on-surface">
                    {f.droneId?.droneId || 'AERON-PX4-BENCH01'}
                  </td>
                  <td className="p-4 font-mono">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      f.source === 'REAL'
                        ? 'bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/30'
                        : 'bg-surface-container text-secondary border border-surface-variant'
                    }`}>
                      {f.source}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-secondary text-[11px]">
                    {new Date(f.startedAt).toLocaleString()}
                  </td>
                  <td className="p-4 font-mono text-on-surface font-medium">
                    {Math.floor(f.durationSeconds / 60)}m {f.durationSeconds % 60}s
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      f.status === 'COMPLETED'
                        ? 'bg-status-success/20 text-status-success border border-status-success/30'
                        : f.status === 'ABORTED'
                        ? 'bg-status-danger/20 text-status-danger border border-status-danger/30'
                        : 'bg-surface-container text-outline'
                    }`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        inspectFlight(f.flightSessionId);
                      }}
                      className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-variant font-sans text-xs font-semibold text-on-surface border border-surface-variant/40 transition-colors"
                    >
                      View Trajectory
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center font-mono text-xs text-outline pt-2">
          <span>PAGE {pagination.page} OF {pagination.totalPages} ({pagination.total} TOTAL SORTIES)</span>
          <div className="flex gap-2">
            <button
              onClick={() => loadFlights(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface disabled:opacity-40 transition-colors"
            >
              PREVIOUS
            </button>
            <button
              onClick={() => loadFlights(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-variant text-on-surface disabled:opacity-40 transition-colors"
            >
              NEXT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
