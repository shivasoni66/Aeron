import React, { useEffect, useState } from 'react';
import { fetchIncidents, updateIncident } from '../services/api';
import { IncidentData, IncidentStatus } from '../types';

export const IncidentManagementPage: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedIncident, setSelectedIncident] = useState<IncidentData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadIncidents = async (p = 1) => {
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
      console.warn(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents(1);
  }, [severityFilter, statusFilter, categoryFilter]);

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

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-status-danger/20 text-status-danger border-status-danger/40';
      case 'HIGH':
        return 'bg-status-warning/20 text-status-warning border-status-warning/40';
      case 'MEDIUM':
        return 'bg-status-info/20 text-status-info border-status-info/40';
      case 'LOW':
      default:
        return 'bg-surface-container text-secondary border-surface-variant';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-status-danger/15 text-status-danger border-status-danger/30';
      case 'INVESTIGATING':
        return 'bg-status-warning/15 text-status-warning border-status-warning/30';
      case 'MITIGATED':
      case 'RESOLVED':
        return 'bg-status-success/15 text-status-success border-status-success/30';
      case 'CLOSED':
      default:
        return 'bg-surface-container text-outline border-surface-variant';
    }
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {notice && (
        <div className="p-3 bg-surface-container border border-primary-fixed text-primary-fixed rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-on-surface hover:text-primary-fixed">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-status-danger/15 text-status-danger font-sans text-xs font-semibold border border-status-danger/20">
              Tactical Triage Queue
            </span>
          </div>
          <h1 className="font-sans text-2xl font-bold text-on-surface tracking-tight mt-1">
            Incident Management Log
          </h1>
          <p className="font-sans text-secondary text-xs">
            Review airframe anomalies, civic infrastructure hazards, crowd congestion breaches, and SAR alerts.
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 rounded-xl bg-surface-container-low border border-surface-variant/40 flex flex-wrap items-center justify-between gap-3 font-sans text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-outline">
            <span className="material-symbols-outlined text-[16px]">filter_alt</span>
            <span>Filter by:</span>
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-variant/60 text-on-surface focus:outline-none text-xs"
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
            className="px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-variant/60 text-on-surface focus:outline-none text-xs"
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
            className="px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-variant/60 text-on-surface focus:outline-none text-xs"
          >
            <option value="">All Categories</option>
            <option value="ROAD_STRUCTURAL">Road Structural</option>
            <option value="CROWD_SAFETY">Crowd Safety</option>
            <option value="MICRO_CLIMATE_ECO">Micro Climate</option>
            <option value="SEARCH_RESCUE">Search & Rescue</option>
          </select>
        </div>

        <div className="text-outline text-[11px] font-sans">
          Total matches: <strong className="text-on-surface font-mono">{pagination.total}</strong> incidents
        </div>
      </div>

      {/* Incidents Table */}
      <div className="w-full overflow-x-auto rounded-xl bg-surface-container-low shadow-xl border border-surface-variant/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-lowest text-outline font-sans text-[11px] font-semibold border-b border-surface-variant/50">
              <th className="p-4">Incident ID</th>
              <th className="p-4">Type & Synopsis</th>
              <th className="p-4">Severity</th>
              <th className="p-4">Status</th>
              <th className="p-4">Logged At</th>
              <th className="p-4 text-right">Lifecycle Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant/30 text-on-surface font-sans text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-outline">
                  Retrieving auditable incident logs...
                </td>
              </tr>
            ) : incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-outline">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <span className="material-symbols-outlined text-[36px] text-outline/50">verified_user</span>
                    <span className="font-semibold text-on-surface">No incidents reported</span>
                    <p className="text-[11px] text-secondary max-w-sm">
                      Zero safety or hazard incidents match the active filter criteria.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              incidents.map((inc) => (
                <tr key={inc._id} className="hover:bg-surface-container/70 transition-colors">
                  <td className="p-4 font-mono font-bold text-primary-fixed">
                    <div className="flex items-center gap-1.5">
                      {inc.isConfidential && (
                        <span className="material-symbols-outlined text-[15px] text-status-danger" title="Confidential Incident (SAR Redacted)">
                          lock
                        </span>
                      )}
                      <span>{inc.incidentId}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-on-surface">{inc.incidentType}</div>
                    <div className="text-secondary text-xs line-clamp-1 mt-0.5 max-w-[320px]">{inc.description}</div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold border ${getSeverityBadgeClass(inc.severity)}`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold border ${getStatusBadgeClass(inc.status)}`}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-[11px] text-secondary">
                    {new Date(inc.reportedAt).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 font-sans text-xs">
                      {inc.status === 'OPEN' && (
                        <button
                          onClick={() => handleStatusUpdate(inc.incidentId, 'INVESTIGATING')}
                          className="px-3 py-1 rounded-lg bg-primary-fixed text-on-primary-fixed font-semibold hover:bg-surface-tint transition-colors shadow-sm"
                        >
                          Investigate
                        </button>
                      )}
                      {inc.status === 'INVESTIGATING' && (
                        <button
                          onClick={() => handleStatusUpdate(inc.incidentId, 'RESOLVED')}
                          className="px-3 py-1 rounded-lg bg-status-success/20 hover:bg-status-success/30 text-status-success border border-status-success/30 font-semibold transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="px-3 py-1 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface border border-surface-variant/40 font-semibold transition-colors"
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

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface-container-low border border-surface-variant/80 rounded-2xl p-6 shadow-2xl space-y-4 font-mono text-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-surface-variant/50 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-primary-fixed font-bold text-sm">{selectedIncident.incidentId}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getSeverityBadgeClass(selectedIncident.severity)}`}>
                  {selectedIncident.severity}
                </span>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-outline hover:text-on-surface text-base">✕</button>
            </div>

            <div>
              <h3 className="font-sans font-bold text-on-surface text-base">{selectedIncident.incidentType}</h3>
              <p className="font-sans text-secondary text-xs mt-1.5 leading-relaxed">{selectedIncident.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-surface-container-lowest rounded-xl border border-surface-variant/40">
              <div>
                <span className="text-outline block text-[10px]">Current Status</span>
                <strong className="text-on-surface font-mono">{selectedIncident.status}</strong>
              </div>
              <div>
                <span className="text-outline block text-[10px]">Incident Type</span>
                <strong className="text-primary-fixed font-mono">{selectedIncident.incidentType || 'Operational'}</strong>
              </div>
              <div>
                <span className="text-outline block text-[10px]">Coordinates</span>
                <strong className={`font-mono ${selectedIncident.isConfidential ? 'text-status-danger' : 'text-on-surface'}`}>
                  {selectedIncident.isConfidential
                    ? '[Redacted — SAR Sensitive]'
                    : selectedIncident.location
                    ? `${selectedIncident.location.coordinates[1].toFixed(4)}° N, ${selectedIncident.location.coordinates[0].toFixed(4)}° E`
                    : 'N/A'}
                </strong>
              </div>
              <div>
                <span className="text-outline block text-[10px]">Classification</span>
                <strong className={selectedIncident.isConfidential ? 'text-status-danger font-mono' : 'text-on-surface font-mono'}>
                  {selectedIncident.isConfidential ? 'Confidential (SAR)' : 'Standard Audit'}
                </strong>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-surface-variant/40">
              <div className="flex gap-2">
                {selectedIncident.status !== 'CLOSED' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedIncident.incidentId, 'CLOSED')}
                    className="px-3 py-1.5 bg-surface-container hover:bg-surface-variant rounded-lg text-outline hover:text-on-surface border border-surface-variant/50 transition-colors"
                  >
                    Close Ticket
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="px-5 py-1.5 bg-surface-container-high hover:bg-surface-variant rounded-lg text-on-surface font-sans font-semibold transition-colors"
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
