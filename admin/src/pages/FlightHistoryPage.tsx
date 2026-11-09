import React, { useEffect, useState } from 'react';
import { fetchFlights, fetchFlightDetails } from '../services/api';
import { FlightSessionData, TelemetryData } from '../types';

export const FlightHistoryPage: React.FC = () => {
  const [flights, setFlights] = useState<FlightSessionData[]>([]);
  const [filterSource, setFilterSource] = useState<'ALL' | 'REAL' | 'SIMULATION'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Detail Modal State
  const [inspectModalOpen, setInspectModalOpen] = useState<boolean>(false);
  const [selectedFlight, setSelectedFlight] = useState<FlightSessionData | null>(null);
  const [flightSamples, setFlightSamples] = useState<TelemetryData[]>([]);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const loadFlights = async () => {
      setLoading(true);
      try {
        const sourceParam = filterSource === 'ALL' ? undefined : filterSource;
        const res = await fetchFlights(page, 15, sourceParam);
        if (isMounted) {
          setFlights(res.flights);
          setTotalPages(res.pagination.totalPages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      } catch (err) {
        console.warn('[FlightHistory] Failed to load flights:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadFlights();
    return () => {
      isMounted = false;
    };
  }, [page, filterSource]);

  const handleInspect = async (f: FlightSessionData) => {
    setSelectedFlight(f);
    setInspectModalOpen(true);
    setInspectLoading(true);
    try {
      const res = await fetchFlightDetails(f.flightSessionId);
      setFlightSamples(res.telemetrySamples || []);
    } catch (err) {
      console.warn('[FlightHistory] Error fetching flight details:', err);
    } finally {
      setInspectLoading(false);
    }
  };

  const filteredFlights = flights.filter((f) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.flightSessionId.toLowerCase().includes(q) ||
      (f.missionId && f.missionId.toLowerCase().includes(q)) ||
      f.droneId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">history</span>
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              FLIGHT SORTIE HISTORY
            </h1>
          </div>
          <p className="text-body-sm font-label-telemetry text-on-surface-variant text-[11px] mt-0.5">
            VERIFIED FLIGHT LOG ARCHIVES // {totalCount} TOTAL RECORDED SESSIONS
          </p>
        </div>

        {/* Source Filter Tabs */}
        <div className="flex items-center gap-1 bg-surface-container-high p-1 rounded font-label-telemetry text-[11px]">
          {(['ALL', 'REAL', 'SIMULATION'] as const).map((source) => (
            <button
              key={source}
              onClick={() => {
                setFilterSource(source);
                setPage(1);
              }}
              className={`px-3 py-1 rounded transition-colors ${
                filterSource === source
                  ? 'bg-primary-container text-on-primary-container font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest px-space-md py-space-xs rounded border border-outline-variant/30 font-label-telemetry text-[11px]">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
          <input
            type="text"
            placeholder="FILTER BY SESSION ID, MISSION ID OR DRONE..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-on-surface placeholder:text-on-surface-variant/50"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-on-surface-variant hover:text-on-surface">
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-on-surface-variant">
          <span>PAGE {page} OF {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-1 rounded bg-surface-container hover:bg-surface-variant disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-1 rounded bg-surface-container hover:bg-surface-variant disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Main Sorties Table */}
      <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 overflow-x-auto">
        <table className="w-full text-left font-label-telemetry text-label-telemetry">
          <thead>
            <tr className="border-b border-surface-container-highest/60 text-on-surface-variant text-[10px]">
              <th className="py-2.5 px-3">SESSION IDENTIFIER</th>
              <th className="py-2.5 px-3">DRONE ID</th>
              <th className="py-2.5 px-3">START DATE / TIME</th>
              <th className="py-2.5 px-3">DURATION</th>
              <th className="py-2.5 px-3">SOURCE</th>
              <th className="py-2.5 px-3">STATUS</th>
              <th className="py-2.5 px-3 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-highest/40 text-[11px]">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                  QUERYING ARCHIVED FLIGHT SORTIES...
                </td>
              </tr>
            ) : filteredFlights.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                  NO FLIGHT SESSIONS MATCH THE CURRENT FILTER.
                </td>
              </tr>
            ) : (
              filteredFlights.map((flight) => {
                const durMin = `${Math.floor(flight.durationSeconds / 60)}m ${flight.durationSeconds % 60}s`;
                return (
                  <tr key={flight.flightSessionId} className="hover:bg-surface-container-high/40 transition-colors">
                    <td className="py-3 px-3 text-on-surface font-bold">
                      {flight.flightSessionId}
                    </td>
                    <td className="py-3 px-3 text-primary-fixed">{flight.droneId}</td>
                    <td className="py-3 px-3 text-on-surface-variant">
                      {new Date(flight.startedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-on-surface">{durMin}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          flight.source === 'REAL'
                            ? 'bg-primary-container text-on-primary-container'
                            : 'bg-secondary-container text-on-secondary-container'
                        }`}
                      >
                        {flight.source}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          flight.status === 'COMPLETED'
                            ? 'bg-primary-container/20 text-primary-fixed'
                            : flight.status === 'ACTIVE'
                            ? 'bg-primary text-on-primary animate-pulse'
                            : flight.status === 'ABORTED'
                            ? 'bg-error-container text-error'
                            : 'bg-surface-variant text-on-surface-variant'
                        }`}
                      >
                        {flight.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleInspect(flight)}
                        className="px-2.5 py-1 bg-surface-container hover:bg-surface-variant text-primary-fixed rounded text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        <span>INSPECT</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Inspect Detail Modal */}
      {inspectModalOpen && selectedFlight && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant rounded max-w-2xl w-full p-space-md shadow-2xl space-y-space-md font-label-telemetry">
            <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">flight_takeoff</span>
                <span className="text-on-surface font-bold text-sm">
                  SORTIE INSPECTOR // {selectedFlight.flightSessionId}
                </span>
              </div>
              <button onClick={() => setInspectModalOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                ✕
              </button>
            </div>

            {inspectLoading ? (
              <div className="py-8 text-center text-on-surface-variant text-xs flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
                <span>HARVESTING SORTIE SAMPLES...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-space-sm text-[11px]">
                <div>
                  <span className="text-on-surface-variant block text-[10px]">DRONE IDENTIFIER</span>
                  <span className="text-on-surface font-bold">{selectedFlight.droneId}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-[10px]">MISSION ID</span>
                  <span className="text-on-surface font-bold">{selectedFlight.missionId || 'STANDALONE BENCH'}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-[10px]">START TIME</span>
                  <span className="text-on-surface">{new Date(selectedFlight.startedAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-[10px]">END TIME</span>
                  <span className="text-on-surface">
                    {selectedFlight.endedAt ? new Date(selectedFlight.endedAt).toLocaleString() : 'ACTIVE'}
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-[10px]">TOTAL DURATION</span>
                  <span className="text-primary-fixed font-bold">
                    {Math.floor(selectedFlight.durationSeconds / 60)}m {selectedFlight.durationSeconds % 60}s
                  </span>
                </div>
                <div>
                  <span className="text-on-surface-variant block text-[10px]">TELEMETRY SAMPLES</span>
                  <span className="text-primary-fixed font-bold">{flightSamples.length} RECORDED</span>
                </div>
              </div>
            )}

            {selectedFlight.summary && (
              <div className="bg-surface-container-high p-space-sm rounded text-[11px]">
                <span className="text-on-surface-variant block text-[10px] mb-1">MISSION SUMMARY</span>
                <p className="text-on-surface">{selectedFlight.summary}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-surface-container-highest/60">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-1.5 bg-surface-container hover:bg-surface-variant text-on-surface rounded text-xs"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
