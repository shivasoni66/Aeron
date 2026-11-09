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

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm">
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">[FLIGHT LEDGER]</span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-label-telemetry text-[10px] font-bold">
              AUDITABLE FLIGHT RECORDS
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-0.5">
            TRIP & ROUTE HISTORY
          </h1>
          <p className="font-body-sm text-secondary text-xs">
            Historical flight telemetry archives, recorded routes, and waypoint milestone verification.
          </p>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40 flex flex-wrap items-center justify-between gap-3 font-label-telemetry text-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="bg-surface-container-lowest px-3 py-2 rounded flex items-center gap-2 border border-surface-variant flex-1">
            <span className="material-symbols-outlined text-[16px] text-outline">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH FLIGHT ID OR SUMMARY..."
              className="bg-transparent text-on-surface focus:outline-none w-full text-xs placeholder:text-outline"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-surface-container-high hover:bg-surface-variant rounded text-on-surface">
            SEARCH
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none text-xs"
          >
            <option value="">ALL SOURCES</option>
            <option value="REAL">REAL HARDWARE</option>
            <option value="SIMULATION">SIMULATION BENCH</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none text-xs"
          >
            <option value="">ALL STATUSES</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="ABORTED">ABORTED</option>
          </select>
        </div>
      </div>

      {/* Route Visualizer & Selected Flight Telemetry */}
      {selectedFlight && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
          {/* Tactical Map Route Reconstruction (7 cols) */}
          <div className="lg:col-span-7 bg-surface-container-low p-space-md rounded-lg border border-surface-variant/40 shadow-xl flex flex-col justify-between min-h-[400px]">
            <div className="flex justify-between items-center pb-2 border-b border-surface-variant/40 font-label-telemetry text-xs">
              <div className="flex items-center gap-2">
                <span className="text-primary-fixed font-bold">{selectedFlight.flightSessionId}</span>
                <span className="text-outline">|</span>
                <span className="text-primary">{selectedFlight.droneId?.droneId || 'AERON-PX4-BENCH01'}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedFlight.source === 'REAL' ? 'bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/30' : 'bg-surface-container text-secondary'}`}>
                {selectedFlight.source}
              </span>
            </div>

            <div className="flex-1 my-3 relative min-h-[300px]">
              {isLoadingDetails ? (
                <div className="h-full min-h-[300px] flex items-center justify-center text-outline font-label-telemetry text-xs animate-pulse">
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

            <div className="pt-2 border-t border-surface-variant/40 flex justify-between items-center font-label-telemetry text-[11px] text-outline">
              <span>SAMPLES RENDERED: {telemetrySamples.length} PTS</span>
              <span>DURATION: {Math.round(selectedFlight.durationSeconds / 60)} MIN</span>
            </div>
          </div>

          {/* Flight Summary & Audit Metrics (5 cols) */}
          <div className="lg:col-span-5 bg-surface-container-low p-space-md rounded-lg border border-surface-variant/40 shadow-xl flex flex-col justify-between font-label-telemetry text-xs">
            <div>
              <div className="flex justify-between items-center pb-2 border-b border-surface-variant/40 mb-3">
                <span className="text-primary font-bold uppercase">SORTIE METADATA</span>
                <span className="text-outline">{new Date(selectedFlight.startedAt).toLocaleDateString()}</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center py-1 border-b border-surface-variant/30">
                  <span className="text-outline">AIRFRAME</span>
                  <span className="text-primary font-bold">{selectedFlight.droneId?.droneId || 'AERON-PX4-BENCH01'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-surface-variant/30">
                  <span className="text-outline">MISSION SORTIE</span>
                  <span className="text-primary-fixed">{selectedFlight.missionId?.title || 'GENERAL TELEMETRY LOG'}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-surface-variant/30">
                  <span className="text-outline">STATUS</span>
                  <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-bold text-[10px]">
                    {selectedFlight.status}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-surface-variant/30">
                  <span className="text-outline">STARTED AT</span>
                  <span className="text-on-surface">{new Date(selectedFlight.startedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-surface-variant/30">
                  <span className="text-outline">ENDED AT</span>
                  <span className="text-on-surface">
                    {selectedFlight.endedAt ? new Date(selectedFlight.endedAt).toLocaleTimeString() : 'ACTIVE'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-surface-variant/30">
                  <span className="text-outline">RECORDED DURATION</span>
                  <span className="text-primary font-bold">
                    {Math.floor(selectedFlight.durationSeconds / 60)}m {selectedFlight.durationSeconds % 60}s
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-2.5 bg-surface-container-lowest rounded border border-surface-variant/30 text-[11px] text-outline">
              <strong className="text-primary-fixed block mb-0.5">SOURCE ATTRIBUTION:</strong>
              {selectedFlight.source === 'REAL'
                ? 'MAVLink telemetry streamed over physical Pixhawk serial port. Verified real-world flight data.'
                : 'Synthetic simulation bench telemetry generated by local software bench emulator.'}
            </div>
          </div>
        </div>
      )}

      {/* Flight Sessions Table */}
      <div className="w-full overflow-x-auto rounded-lg bg-surface-container-low shadow-xl border border-surface-variant/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-lowest text-outline font-label-telemetry text-[11px] uppercase tracking-wider border-b border-surface-variant/50">
              <th className="p-space-md">TRIP / SESSION ID</th>
              <th className="p-space-md">AIRFRAME</th>
              <th className="p-space-md">SOURCE</th>
              <th className="p-space-md">START TIME</th>
              <th className="p-space-md">DURATION</th>
              <th className="p-space-md">STATUS</th>
              <th className="p-space-md text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant/30 text-on-surface font-body-sm text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-outline font-label-telemetry">
                  LOADING FLIGHT SESSIONS...
                </td>
              </tr>
            ) : flights.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-outline font-label-telemetry">
                  NO FLIGHT SESSIONS FOUND
                </td>
              </tr>
            ) : (
              flights.map((f) => (
                <tr
                  key={f._id}
                  onClick={() => inspectFlight(f.flightSessionId)}
                  className={`hover:bg-surface-container transition-colors cursor-pointer ${selectedFlight?.flightSessionId === f.flightSessionId ? 'bg-surface-container' : ''}`}
                >
                  <td className="p-space-md font-label-telemetry text-primary-fixed font-bold">
                    {f.flightSessionId}
                  </td>
                  <td className="p-space-md font-label-telemetry">
                    {f.droneId?.droneId || 'AERON-PX4-BENCH01'}
                  </td>
                  <td className="p-space-md font-label-telemetry">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.source === 'REAL' ? 'bg-primary-fixed/20 text-primary-fixed' : 'bg-surface-container text-secondary'}`}>
                      {f.source}
                    </span>
                  </td>
                  <td className="p-space-md font-label-telemetry text-secondary text-[11px]">
                    {new Date(f.startedAt).toLocaleString()}
                  </td>
                  <td className="p-space-md font-label-telemetry text-primary">
                    {Math.floor(f.durationSeconds / 60)}m {f.durationSeconds % 60}s
                  </td>
                  <td className="p-space-md">
                    <span className="px-2 py-0.5 rounded bg-surface-container text-outline text-[10px] font-bold font-label-telemetry">
                      {f.status}
                    </span>
                  </td>
                  <td className="p-space-md text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        inspectFlight(f.flightSessionId);
                      }}
                      className="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-variant font-label-telemetry text-[11px] text-on-surface"
                    >
                      VIEW ROUTE
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
        <div className="flex justify-between items-center font-label-telemetry text-xs text-outline pt-2">
          <span>PAGE {pagination.page} OF {pagination.totalPages} ({pagination.total} TOTAL SESSIONS)</span>
          <div className="flex gap-2">
            <button
              onClick={() => loadFlights(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded bg-surface-container hover:bg-surface-variant text-on-surface disabled:opacity-40"
            >
              PREVIOUS
            </button>
            <button
              onClick={() => loadFlights(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded bg-surface-container hover:bg-surface-variant text-on-surface disabled:opacity-40"
            >
              NEXT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
