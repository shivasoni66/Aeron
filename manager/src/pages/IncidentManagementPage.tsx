import React, { useEffect, useState, useCallback } from 'react';
import { fetchIncidents, updateIncident, createIncident } from '../services/api';
import { subscribeToManagerBroadcasts } from '../services/socket';
import { IncidentData, IncidentStatus, IncidentSeverity } from '../types';

export const IncidentManagementPage: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Create Incident Form State
  const [newType, setNewType] = useState('ROAD_STRUCTURAL');
  const [newSeverity, setNewSeverity] = useState<IncidentSeverity>('HIGH');
  const [newDesc, setNewDesc] = useState('');
  const [newConfidential, setNewConfidential] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadIncidents = useCallback(async (p = 1) => {
    setIsLoading(true);
    try {
      const res = await fetchIncidents({
        page: p,
        limit: 15,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined
      });
      setIncidents(res.incidents || []);
      setPagination(res.pagination || { page: p, limit: 15, total: 0, totalPages: 1 });
    } catch (err: unknown) {
      console.warn('Failed to load incidents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [severityFilter, statusFilter, categoryFilter]);

  useEffect(() => {
    loadIncidents(1);
  }, [loadIncidents]);

  // Real-time synchronization
  useEffect(() => {
    const cleanup = subscribeToManagerBroadcasts({
      onIncidentCreated: () => loadIncidents(pagination.page),
      onIncidentUpdated: () => loadIncidents(pagination.page),
      onReconnect: () => loadIncidents(pagination.page)
    });
    return () => cleanup();
  }, [loadIncidents, pagination.page]);

  const handleStatusUpdate = async (incidentId: string, newStatus: IncidentStatus) => {
    try {
      await updateIncident(incidentId, { status: newStatus });
      setNotice(`Incident '${incidentId}' successfully transitioned to ${newStatus}.`);
      loadIncidents(pagination.page);
      if (selectedIncident && selectedIncident.incidentId === incidentId) {
        setSelectedIncident({ ...selectedIncident, status: newStatus });
      }
    } catch (err: unknown) {
      setNotice(`[ERROR] ${err instanceof Error ? err.message : 'Update failed'}`);
    }
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSeverityUpdate = async (incidentId: string, sev: IncidentSeverity) => {
    try {
      await updateIncident(incidentId, { severity: sev });
      setNotice(`Incident '${incidentId}' severity escalated/updated to ${sev}.`);
      loadIncidents(pagination.page);
      if (selectedIncident && selectedIncident.incidentId === incidentId) {
        setSelectedIncident({ ...selectedIncident, severity: sev });
      }
    } catch (err: unknown) {
      setNotice(`[ERROR] ${err instanceof Error ? err.message : 'Update failed'}`);
    }
    setTimeout(() => setNotice(null), 5000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim()) return;
    setIsSubmitting(true);
    try {
      await createIncident({
        incidentType: newType,
        severity: newSeverity,
        description: newDesc.trim(),
        isConfidential: newConfidential,
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716]
        }
      });
      setNotice(`Incident reported and recorded in authoritative database.`);
      setIsCreateOpen(false);
      setNewDesc('');
      loadIncidents(1);
    } catch (err: unknown) {
      setNotice(`[ERROR] ${err instanceof Error ? err.message : 'Failed to report incident'}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-critical-coral/20 text-critical-coral border-critical-coral/40';
      case 'HIGH':
        return 'bg-caution-amber/20 text-caution-amber border-caution-amber/40';
      case 'MEDIUM':
        return 'bg-telemetry-cyan/20 text-telemetry-cyan border-telemetry-cyan/40';
      case 'LOW':
      default:
        return 'bg-surface-elevated text-text-muted border-border';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-critical-coral/15 text-critical-coral border-critical-coral/30';
      case 'INVESTIGATING':
        return 'bg-caution-amber/15 text-caution-amber border-caution-amber/30';
      case 'MITIGATED':
      case 'RESOLVED':
        return 'bg-success/15 text-success border-success/30';
      case 'CLOSED':
      default:
        return 'bg-surface-elevated text-text-muted border-border';
    }
  };

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {notice && (
        <div className="p-3 bg-surface border border-aeron-lime text-aeron-lime rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-text-primary hover:text-aeron-lime">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-surface rounded-xl border border-border border-l-4 border-l-critical-coral shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-critical-coral text-[24px]">warning</span>
            <span className="px-2 py-0.5 rounded bg-critical-coral/15 text-critical-coral font-sans text-xs font-semibold border border-critical-coral/20">
              Tactical Triage Queue
            </span>
          </div>
          <h1 className="font-sans font-bold text-lg text-text-primary tracking-tight mt-1">
            Incident Management Log
          </h1>
          <p className="font-sans text-xs text-text-muted mt-0.5 leading-relaxed">
            Review airframe anomalies, civic infrastructure hazards, crowd congestion breaches, and SAR alerts.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-critical-coral text-background font-sans font-bold text-xs rounded-lg hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,180,171,0.25)]"
        >
          <span className="material-symbols-outlined text-[18px]">add_alert</span>
          <span>Report incident</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 rounded-xl bg-surface border border-border flex flex-wrap items-center justify-between gap-3 font-sans text-xs shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-text-muted">
            <span className="material-symbols-outlined text-[16px]">filter_alt</span>
            <span>Filter by:</span>
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-aeron-lime focus:outline-none text-xs"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-aeron-lime focus:outline-none text-xs"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="MITIGATED">Mitigated</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-aeron-lime focus:outline-none text-xs"
          >
            <option value="">All Categories</option>
            <option value="ROAD_STRUCTURAL">Road Structural</option>
            <option value="CROWD_SAFETY">Crowd Safety</option>
            <option value="MICRO_CLIMATE_ECO">Micro Climate</option>
            <option value="SEARCH_RESCUE">Search & Rescue</option>
          </select>
        </div>

        <div className="text-text-muted text-xs font-sans">
          Total matches: <strong className="text-text-primary font-mono">{pagination.total}</strong> incidents
        </div>
      </div>

      {/* Incidents Table */}
      <div className="w-full overflow-x-auto rounded-xl bg-surface shadow-sm border border-border">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-surface-elevated text-text-muted font-sans text-[11px] font-semibold border-b border-border">
              <th className="p-4">Incident ID</th>
              <th className="p-4">Type & Synopsis</th>
              <th className="p-4">Severity</th>
              <th className="p-4">Status</th>
              <th className="p-4">Logged At</th>
              <th className="p-4 text-right">Lifecycle Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-text-primary">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-text-muted font-mono">
                  Retrieving auditable incident logs...
                </td>
              </tr>
            ) : incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-text-muted">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <span className="material-symbols-outlined text-[36px] text-text-muted/50">verified_user</span>
                    <span className="font-semibold text-text-primary">No incidents reported</span>
                    <p className="text-xs text-text-muted max-w-sm">
                      Zero safety or hazard incidents match the active filter criteria.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              incidents.map((inc) => (
                <tr key={inc._id} className="hover:bg-surface-elevated/70 transition-colors">
                  <td className="p-4 font-mono font-bold text-aeron-lime">
                    <div className="flex items-center gap-1.5">
                      {inc.isConfidential && (
                        <span className="material-symbols-outlined text-[15px] text-critical-coral" title="Confidential Incident (SAR Redacted)">
                          lock
                        </span>
                      )}
                      <span>{inc.incidentId}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-text-primary">{inc.incidentType}</div>
                    <div className="text-text-muted text-xs line-clamp-1 mt-0.5 max-w-[320px]">{inc.description}</div>
                  </td>
                  <td className="p-4">
                    <select
                      value={inc.severity}
                      onChange={(e) => handleSeverityUpdate(inc.incidentId, e.target.value as IncidentSeverity)}
                      className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border outline-none bg-surface-elevated ${getSeverityBadgeClass(inc.severity)}`}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold border ${getStatusBadgeClass(inc.status)}`}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-[11px] text-text-muted">
                    {new Date(inc.reportedAt).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 font-sans text-xs">
                      {inc.status === 'OPEN' && (
                        <button
                          onClick={() => handleStatusUpdate(inc.incidentId, 'INVESTIGATING')}
                          className="px-3 py-1 rounded-lg bg-aeron-lime text-background font-semibold hover:brightness-110 transition-colors shadow-sm"
                        >
                          Investigate
                        </button>
                      )}
                      {inc.status === 'INVESTIGATING' && (
                        <button
                          onClick={() => handleStatusUpdate(inc.incidentId, 'RESOLVED')}
                          className="px-3 py-1 rounded-lg bg-success/20 hover:bg-success/30 text-success border border-success/30 font-semibold transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="px-3 py-1 rounded-lg bg-surface-elevated hover:bg-surface-secondary text-text-primary border border-border font-semibold transition-colors"
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Incident Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 font-sans text-xs animate-in fade-in zoom-in-95 duration-150 text-text-primary">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-critical-coral text-lg">add_alert</span>
                <span className="font-bold text-sm">REPORT OPERATIONAL INCIDENT</span>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="text-text-muted hover:text-text-primary text-base">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-text-muted uppercase text-[11px] mb-1 font-mono">Incident Classification</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-aeron-lime outline-none"
                >
                  <option value="ROAD_STRUCTURAL">Road Structural Defect / Fissure</option>
                  <option value="CROWD_SAFETY">Crowd Congestion / Density Anomaly</option>
                  <option value="MICRO_CLIMATE_ECO">Thermal Radiance / Eco Anomaly</option>
                  <option value="SEARCH_RESCUE">Subterranean SAR Distress Beacon</option>
                  <option value="AIRFRAME_WARNING">Airframe Telemetry Anomaly</option>
                </select>
              </div>

              <div>
                <label className="block text-text-muted uppercase text-[11px] mb-1 font-mono">Severity Level</label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as IncidentSeverity)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-aeron-lime outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-text-muted uppercase text-[11px] mb-1 font-mono">Description & Synopsis</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Enter detailed observation notes..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-aeron-lime outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="confidentialCheck"
                  checked={newConfidential}
                  onChange={(e) => setNewConfidential(e.target.checked)}
                  className="w-4 h-4 accent-critical-coral rounded cursor-pointer"
                />
                <label htmlFor="confidentialCheck" className="text-text-secondary cursor-pointer">
                  Mark as confidential (SAR sensitive coordinates redacted from citizen feed)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg bg-surface-elevated text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-critical-coral text-background font-bold hover:brightness-110 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Record Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-4 font-mono text-xs animate-in fade-in zoom-in-95 duration-150 text-text-primary">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="text-aeron-lime font-bold text-sm">{selectedIncident.incidentId}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadgeClass(selectedIncident.severity)}`}>
                  {selectedIncident.severity}
                </span>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-text-muted hover:text-text-primary text-base">✕</button>
            </div>

            <div>
              <h3 className="font-sans font-bold text-text-primary text-base">{selectedIncident.incidentType}</h3>
              <p className="font-sans text-text-secondary text-xs mt-1.5 leading-relaxed">{selectedIncident.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-surface-elevated rounded-xl border border-border">
              <div>
                <span className="text-text-muted block text-[10px]">Current Status</span>
                <strong className="text-text-primary font-mono">{selectedIncident.status}</strong>
              </div>
              <div>
                <span className="text-text-muted block text-[10px]">Incident Type</span>
                <strong className="text-aeron-lime font-mono">{selectedIncident.incidentType || 'Operational'}</strong>
              </div>
              <div>
                <span className="text-text-muted block text-[10px]">Coordinates</span>
                <strong className={`font-mono ${selectedIncident.isConfidential ? 'text-critical-coral' : 'text-text-primary'}`}>
                  {selectedIncident.isConfidential
                    ? '[Redacted — SAR Sensitive]'
                    : selectedIncident.location
                    ? `${selectedIncident.location.coordinates[1].toFixed(4)}° N, ${selectedIncident.location.coordinates[0].toFixed(4)}° E`
                    : 'N/A'}
                </strong>
              </div>
              <div>
                <span className="text-text-muted block text-[10px]">Classification</span>
                <strong className={selectedIncident.isConfidential ? 'text-critical-coral font-mono' : 'text-text-primary font-mono'}>
                  {selectedIncident.isConfidential ? 'Confidential (SAR)' : 'Standard Audit'}
                </strong>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-border">
              <div className="flex gap-2">
                {selectedIncident.status !== 'CLOSED' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedIncident.incidentId, 'CLOSED')}
                    className="px-3 py-1.5 bg-surface-elevated hover:bg-surface-secondary rounded-lg text-text-muted hover:text-text-primary border border-border transition-colors"
                  >
                    Close Ticket
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-5 py-1.5 bg-surface-elevated hover:bg-surface-secondary rounded-lg text-text-primary font-sans font-semibold transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
