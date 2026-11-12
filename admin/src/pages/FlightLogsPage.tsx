import React, { useEffect, useState } from 'react';
import { fetchEvents } from '../services/api';
import { useHardware } from '../context/HardwareContext';
import { AuditEventData } from '../types';

export const FlightLogsPage: React.FC = () => {
  const { isOnline, hardwareStatusLabel, latestTelemetry } = useHardware();
  const [activeTab, setActiveTab] = useState<'audit' | 'telemetry'>('audit');
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
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[24px]">subject</span>
            <h1 className="font-sans font-bold text-base tracking-normal text-text-primary">
              System & Security Audit Log
            </h1>
          </div>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            Cryptographically verified event journal • Security audits & MAVLink protocol transactions
          </p>
        </div>

        <div className="flex items-center gap-2.5 font-sans text-xs">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3.5 py-1.5 bg-surface-elevated hover:bg-surface-muted text-text-primary rounded-lg border border-border flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] text-accent-primary ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh logs</span>
          </button>
          <button
            onClick={handleExport}
            className="px-3.5 py-1.5 bg-accent-primary text-background font-semibold rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
            activeTab === 'audit'
              ? 'border-accent-primary text-accent-primary bg-surface/50'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">shield_person</span>
          <span>System Audit Events ({events.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
            activeTab === 'telemetry'
              ? 'border-accent-primary text-accent-primary bg-surface/50'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">flight</span>
          <span>MAVLink Binary & Telemetry Logs</span>
        </button>
      </div>

      {activeTab === 'audit' ? (
        <>
          {/* Filter and Search Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm font-sans text-xs">
            <div className="flex items-center gap-1.5">
              {['ALL', 'AUTH', 'TELEMETRY', 'DRONE', 'SESSION'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterType(cat)}
                  className={`px-3 py-1.5 rounded-lg transition-all font-semibold ${
                    filterType === cat
                      ? 'bg-accent-primary text-background font-bold shadow-sm'
                      : 'text-text-secondary hover:text-text-primary bg-surface-elevated border border-border'
                  }`}
                >
                  {cat === 'ALL' ? 'All Events' : cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <span className="material-symbols-outlined text-text-muted text-[18px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search action, entity or source..."
                className="w-full bg-surface-elevated px-3 py-1.5 rounded-lg border border-border text-text-primary placeholder:text-text-muted focus:border-accent-primary outline-none text-xs"
              />
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="bg-surface rounded-xl border border-border shadow-sm overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted text-[11px] font-semibold">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action Protocol</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Source Origin</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-text-secondary">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-muted">
                      Reading audit log journal...
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-muted">
                      No audit events found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev, idx) => (
                    <tr key={ev._id || idx} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="py-3 px-4 text-text-primary font-mono text-[11px]">
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-accent-primary font-mono font-bold">
                        {ev.action}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-surface-elevated border border-border text-text-secondary font-mono">
                          {ev.entityType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-primary font-mono truncate max-w-[140px]">
                        {ev.entityId}
                      </td>
                      <td className="py-3 px-4 text-text-muted font-mono">
                        {ev.source}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedEvent(ev)}
                          className="px-2.5 py-1 bg-surface-elevated hover:bg-surface-muted text-accent-primary border border-border rounded-lg text-xs font-semibold transition-colors"
                        >
                          Payload
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Telemetry & Binary Logs Tab */
        <div className="space-y-4">
          <div className="bg-surface p-5 rounded-xl border border-border space-y-3 font-sans text-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="font-bold text-sm text-text-primary">
                  MAVLink Onboard Dataflash (.BIN) Records
                </h3>
                <p className="text-text-muted text-xs mt-0.5">
                  Autopilot flight logs recorded directly to Pixhawk 2.4.8 high-speed MicroSD storage
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                isOnline ? 'bg-success/15 text-success border-success/30' : 'bg-surface-elevated text-text-muted border-border'
              }`}>
                {hardwareStatusLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-surface-elevated rounded-xl border border-border space-y-2">
                <div className="flex items-center gap-2 text-accent-primary font-semibold">
                  <span className="material-symbols-outlined text-[18px]">sd_card</span>
                  <span>Pixhawk SD Logging</span>
                </div>
                <p className="text-text-muted text-[11px]">
                  Format: ArduCopter Binary (.BIN)
                </p>
                <div className="text-[11px] text-text-secondary">
                  Bitrate: 25Hz Full EKF + High-rate IMU
                </div>
              </div>

              <div className="p-4 bg-surface-elevated rounded-xl border border-border space-y-2">
                <div className="flex items-center gap-2 text-info font-semibold">
                  <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                  <span>Telemetry Radio Stream</span>
                </div>
                <p className="text-text-muted text-[11px]">
                  Format: Telemetry Log (.tlog)
                </p>
                <div className="text-[11px] text-text-secondary">
                  Radio Baud: 57600 (TELEM 1)
                </div>
              </div>

              <div className="p-4 bg-surface-elevated rounded-xl border border-border space-y-2">
                <div className="flex items-center gap-2 text-warning font-semibold">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  <span>Integrity Ledger</span>
                </div>
                <p className="text-text-muted text-[11px]">
                  SHA-256 Hashing on Flight Disarm
                </p>
                <div className="text-[11px] text-text-secondary">
                  Storage Status: Ready
                </div>
              </div>
            </div>

            <div className="p-4 bg-surface-elevated/40 rounded-xl border border-border/60 text-text-muted text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-accent-primary">info</span>
                <span>
                  {isOnline
                    ? `Live bench link active. Current battery: ${latestTelemetry?.batteryVoltage?.toFixed(1) || '24.8'}V.`
                    : 'Physical drone hardware is offline. Connect Pixhawk 2.4.8 USB or telemetry radio to extract raw .BIN binary logs.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON Payload Inspection Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans text-xs">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-accent-primary text-[22px]">data_object</span>
                <h3 className="font-bold text-base text-text-primary">
                  Log Metadata • {selectedEvent.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-8 h-8 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary flex items-center justify-center border border-border transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-elevated p-3 rounded-xl border border-border">
                  <span className="text-text-muted text-[10px] block font-medium">Entity</span>
                  <span className="text-text-primary font-bold font-mono">{selectedEvent.entityType} ({selectedEvent.entityId})</span>
                </div>
                <div className="bg-surface-elevated p-3 rounded-xl border border-border">
                  <span className="text-text-muted text-[10px] block font-medium">Source</span>
                  <span className="text-accent-primary font-bold font-mono">{selectedEvent.source}</span>
                </div>
              </div>

              <div>
                <span className="text-text-muted text-[11px] block mb-1 font-medium">Raw JSON Payload:</span>
                <pre className="p-3 bg-surface-elevated rounded-xl border border-border text-text-secondary text-[11px] font-mono overflow-x-auto">
                  {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-surface-elevated hover:bg-surface-muted text-text-primary rounded-lg border border-border font-semibold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
