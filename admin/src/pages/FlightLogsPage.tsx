import React, { useEffect, useState } from 'react';
import { fetchEvents } from '../services/api';
import { AuditEventData } from '../types';

export const FlightLogsPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEventData[]>([]);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<AuditEventData | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchEvents(50);
      setEvents(res.events);
    } catch (err) {
      console.warn('[FlightLogs] Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `aeron-audit-logs-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredEvents = events.filter((ev) => {
    if (filterType !== 'ALL' && !ev.action.toUpperCase().includes(filterType)) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ev.action.toLowerCase().includes(q) ||
      ev.entityType.toLowerCase().includes(q) ||
      ev.entityId.toLowerCase().includes(q) ||
      ev.source.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col w-full px-gutter py-space-md space-y-space-md text-on-surface">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest p-space-md rounded border border-outline-variant/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">subject</span>
            <h1 className="font-headline-md text-headline-md tracking-wider text-on-surface uppercase">
              TECHNICAL & AUDIT FLIGHT LOGS
            </h1>
          </div>
          <p className="text-body-sm font-label-telemetry text-on-surface-variant text-[11px] mt-0.5">
            CRYPTOGRAPHICALLY VERIFIED AUDIT TRAIL // MAVLINK & SYSTEM TRANSACTIONS
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-variant text-on-surface rounded font-label-telemetry text-[11px] flex items-center gap-1.5 transition-colors"
          >
            <span className={`material-symbols-outlined text-[16px] text-primary ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>REFRESH LOGS</span>
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-primary-container text-on-primary-container font-bold rounded font-label-telemetry text-[11px] flex items-center gap-1.5 transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>EXPORT JSON</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-lowest px-space-md py-space-xs rounded border border-outline-variant/30 font-label-telemetry text-[11px]">
        {/* Category Pills */}
        <div className="flex items-center gap-1">
          {['ALL', 'AUTH', 'TELEMETRY', 'DRONE', 'SESSION'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterType(cat)}
              className={`px-2.5 py-1 rounded text-[10px] transition-colors ${
                filterType === cat
                  ? 'bg-primary-container text-on-primary-container font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <span className="material-symbols-outlined text-on-surface-variant text-[16px]">search</span>
          <input
            type="text"
            placeholder="SEARCH ACTION, ENTITY OR SOURCE..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-on-surface text-[11px] placeholder:text-on-surface-variant/50"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-on-surface-variant hover:text-on-surface">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-surface-container-lowest p-space-md rounded border border-outline-variant/30 overflow-x-auto">
        <table className="w-full text-left font-label-telemetry text-label-telemetry">
          <thead>
            <tr className="border-b border-surface-container-highest/60 text-on-surface-variant text-[10px]">
              <th className="py-2.5 px-3">TIMESTAMP</th>
              <th className="py-2.5 px-3">ACTION EVENT</th>
              <th className="py-2.5 px-3">ENTITY TYPE</th>
              <th className="py-2.5 px-3">ENTITY ID</th>
              <th className="py-2.5 px-3">SOURCE</th>
              <th className="py-2.5 px-3 text-right">DETAILS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-highest/40 text-[11px]">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                  STREAMING LOG ENTRIES...
                </td>
              </tr>
            ) : filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                  NO AUDIT LOG EVENTS RECORDED FOR THIS CRITERIA.
                </td>
              </tr>
            ) : (
              filteredEvents.map((ev, idx) => (
                <tr key={ev._id || idx} className="hover:bg-surface-container-high/40 transition-colors">
                  <td className="py-2.5 px-3 text-on-surface-variant">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-on-surface">
                    <span className="text-primary-fixed">{ev.action}</span>
                  </td>
                  <td className="py-2.5 px-3 text-on-surface-variant">{ev.entityType}</td>
                  <td className="py-2.5 px-3 text-on-surface">{ev.entityId}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-[10px] text-on-surface-variant">
                      {ev.source}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setSelectedEvent(ev)}
                      className="px-2 py-0.5 bg-surface-container hover:bg-surface-variant text-primary-fixed rounded text-[10px] transition-colors"
                    >
                      PAYLOAD
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Payload Inspection Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant rounded max-w-xl w-full p-space-md shadow-2xl space-y-space-md font-label-telemetry">
            <div className="flex items-center justify-between border-b border-surface-container-highest/60 pb-2">
              <span className="text-on-surface font-bold text-sm">
                LOG PAYLOAD // {selectedEvent.action}
              </span>
              <button onClick={() => setSelectedEvent(null)} className="text-on-surface-variant hover:text-on-surface">
                ✕
              </button>
            </div>

            <pre className="p-3 bg-surface-container-highest/50 rounded text-[10px] text-on-surface overflow-x-auto max-h-96">
              {JSON.stringify(selectedEvent, null, 2)}
            </pre>

            <div className="flex justify-end pt-2 border-t border-surface-container-highest/60">
              <button
                onClick={() => setSelectedEvent(null)}
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

