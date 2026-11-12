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
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[24px]">history</span>
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              Flight Sortie History
            </h1>
          </div>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            Verified flight log archives • {totalCount} total recorded sessions
          </p>
        </div>

        {/* Source Filter Tabs */}
        <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-lg border border-border font-sans text-xs">
          {(['ALL', 'REAL', 'SIMULATION'] as const).map((source) => (
            <button
              key={source}
              onClick={() => {
                setFilterSource(source);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md transition-all font-semibold ${
                filterSource === source
                  ? 'bg-accent-primary text-background font-bold shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {source === 'ALL' ? 'All Sorties' : source === 'REAL' ? 'Real Hardware' : 'Simulation'}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm font-sans text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="material-symbols-outlined text-text-muted text-[18px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by session ID, mission or airframe..."
            className="w-full bg-surface-elevated px-3 py-1.5 rounded-lg border border-border text-text-primary placeholder:text-text-muted focus:border-accent-primary outline-none text-xs"
          />
        </div>

        <div className="flex items-center gap-2 text-text-muted">
          <span>Sorties: <strong className="text-accent-primary font-mono font-bold">{filteredFlights.length}</strong> displayed</span>
          <span>|</span>
          <span>Page <strong className="text-text-primary font-mono">{page}</strong> of <strong className="text-text-primary font-mono">{totalPages}</strong></span>
        </div>
      </div>

      {/* Flight History Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-left font-sans text-xs">
          <thead>
            <tr className="border-b border-border text-text-muted text-[11px] font-semibold">
              <th className="py-3 px-4">Flight Session ID</th>
              <th className="py-3 px-4">Start Timestamp</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4">Mission ID</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-text-secondary">
            {loading ? (
              <>
                {[1, 2, 3].map((n) => (
                  <tr key={n} className="animate-pulse">
                    <td colSpan={7} className="py-4 px-4">
                      <div className="h-4 bg-surface-elevated rounded w-full" />
                    </td>
                  </tr>
                ))}
              </>
            ) : filteredFlights.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-text-muted">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <span className="material-symbols-outlined text-[36px] text-text-muted/50">history_toggle_off</span>
                    <span className="font-semibold text-text-primary">No flight sorties found</span>
                    <p className="text-[11px] text-text-muted max-w-sm">
                      Flight sessions are automatically recorded when missions are launched or bench telemetry is transmitted.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFlights.map((f) => (
                <tr key={f.flightSessionId} className="hover:bg-surface-elevated/40 transition-colors">
                  <td className="py-3 px-4 text-text-primary font-bold font-mono">
                    {f.flightSessionId}
                  </td>
                  <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">
                    {new Date(f.startedAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-text-primary font-mono">
                    {Math.floor(f.durationSeconds / 60)}m {f.durationSeconds % 60}s
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      f.status === 'COMPLETED'
                        ? 'bg-success/15 text-success border border-success/30'
                        : f.status === 'ACTIVE'
                        ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30 animate-pulse'
                        : 'bg-surface-elevated text-text-muted border border-border'
                    }`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      f.source === 'REAL'
                        ? 'bg-success/15 text-success border border-success/30'
                        : 'bg-warning/15 text-warning border border-warning/30'
                    }`}>
                      {f.source}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-text-muted font-mono truncate max-w-[120px]">
                    {f.missionId || '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleInspect(f)}
                      className="px-2.5 py-1 bg-surface-elevated hover:bg-surface-muted text-accent-primary border border-border rounded-lg text-xs font-semibold transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between font-mono text-xs text-text-secondary">
            <span>SHOWING PAGE {page} OF {totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border disabled:opacity-40 hover:bg-surface-muted transition-colors"
              >
                PREVIOUS
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border disabled:opacity-40 hover:bg-surface-muted transition-colors"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Flight Modal */}
      {inspectModalOpen && selectedFlight && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-accent-primary text-[22px]">flight_takeoff</span>
                <h3 className="font-sans font-bold text-base text-text-primary">
                  Flight Inspector • {selectedFlight.flightSessionId}
                </h3>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary flex items-center justify-center border border-border transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 font-mono text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface-elevated p-3 rounded-xl border border-border">
                  <span className="text-text-muted text-[10px] block">AIRFRAME</span>
                  <span className="text-sm font-bold text-text-primary">{selectedFlight.droneId}</span>
                </div>
                <div className="bg-surface-elevated p-3 rounded-xl border border-border">
                  <span className="text-text-muted text-[10px] block">DURATION</span>
                  <span className="text-sm font-bold text-accent-primary">
                    {Math.floor(selectedFlight.durationSeconds / 60)}m {selectedFlight.durationSeconds % 60}s
                  </span>
                </div>
                <div className="bg-surface-elevated p-3 rounded-xl border border-border">
                  <span className="text-text-muted text-[10px] block">SOURCE</span>
                  <span className="text-sm font-bold text-text-primary">{selectedFlight.source}</span>
                </div>
                <div className="bg-surface-elevated p-3 rounded-xl border border-border">
                  <span className="text-text-muted text-[10px] block">SAMPLES HARVESTED</span>
                  <span className="text-sm font-bold text-text-primary">{flightSamples.length} PTS</span>
                </div>
              </div>

              {inspectLoading ? (
                <div className="py-8 text-center text-text-muted">
                  EXTRACTING HIGH-FREQUENCY TELEMETRY ARCHIVE...
                </div>
              ) : flightSamples.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-text-primary font-bold uppercase block">
                    TELEMETRY SAMPLES ({flightSamples.length})
                  </span>
                  <div className="max-h-56 overflow-y-auto bg-surface-elevated rounded-xl border border-border p-3">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-text-muted border-b border-border/60">
                          <th className="pb-1">TIME</th>
                          <th className="pb-1">ALT (M)</th>
                          <th className="pb-1">SPEED</th>
                          <th className="pb-1">BATT</th>
                          <th className="pb-1">MODE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 text-text-secondary">
                        {flightSamples.slice(0, 25).map((s, idx) => (
                          <tr key={idx} className="hover:bg-surface/50">
                            <td className="py-1 text-text-primary">{s.recordedAt ? new Date(s.recordedAt).toLocaleTimeString() : '--'}</td>
                            <td className="py-1">{s.relativeAltitude?.toFixed(1) || '--'}</td>
                            <td className="py-1">{s.groundSpeed?.toFixed(1) || '--'} m/s</td>
                            <td className="py-1 text-accent-primary">{s.batteryVoltage?.toFixed(1) || '--'}V</td>
                            <td className="py-1">{s.flightMode || 'STANDBY'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-text-muted">
                  NO EXTENDED TELEMETRY PACKETS STORED FOR THIS RUN.
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-2 bg-surface-elevated hover:bg-surface-muted text-text-primary rounded-lg border border-border font-sans font-semibold text-xs transition-colors"
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
