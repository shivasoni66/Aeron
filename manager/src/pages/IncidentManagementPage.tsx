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
      setNotice(`Incident '${incidentId}' marked as ${newStatus}.`);
      loadIncidents(pagination.page);
      if (selectedIncident && selectedIncident.incidentId === incidentId) {
        setSelectedIncident({ ...selectedIncident, status: newStatus });
      }
    } catch (err: unknown) {
      setNotice(`[ERROR] ${err instanceof Error ? err.message : 'Update failed'}`);
    }
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {notice && (
        <div className="p-space-sm bg-primary-container/20 border border-primary-fixed text-primary-fixed rounded font-label-telemetry text-xs flex items-center justify-between shadow-lg">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-on-surface hover:text-primary-fixed">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm">
            <span className="font-label-telemetry text-label-telemetry text-error">[SAFETY AUDIT]</span>
            <span className="px-2 py-0.5 rounded bg-error-container/30 text-error font-label-telemetry text-[10px] font-bold">
              INCIDENT RESPONSE
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-0.5">
            INCIDENT MANAGEMENT LOG
          </h1>
          <p className="font-body-sm text-secondary text-xs">
            Review airframe anomalies, civic infrastructure hazards, crowd congestion breaches, and SAR alerts.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40 flex flex-wrap items-center justify-between gap-3 font-label-telemetry text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none text-xs"
          >
            <option value="">ALL SEVERITIES</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none text-xs"
          >
            <option value="">ALL STATUSES</option>
            <option value="OPEN">OPEN</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="MITIGATED">MITIGATED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none text-xs"
          >
            <option value="">ALL CATEGORIES</option>
            <option value="ROAD_STRUCTURAL">ROAD STRUCTURAL</option>
            <option value="CROWD_SAFETY">CROWD SAFETY</option>
            <option value="MICRO_CLIMATE_ECO">MICRO CLIMATE</option>
            <option value="SEARCH_RESCUE">SEARCH & RESCUE</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="w-full overflow-x-auto rounded-lg bg-surface-container-low shadow-xl border border-surface-variant/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-lowest text-outline font-label-telemetry text-[11px] uppercase tracking-wider border-b border-surface-variant/50">
              <th className="p-space-md">INCIDENT ID</th>
              <th className="p-space-md">TYPE & DESCRIPTION</th>
              <th className="p-space-md">SEVERITY</th>
              <th className="p-space-md">STATUS</th>
              <th className="p-space-md">REPORTED AT</th>
              <th className="p-space-md text-right">LIFECYCLE ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant/30 text-on-surface font-body-sm text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-outline font-label-telemetry">
                  LOADING INCIDENT LOGS...
                </td>
              </tr>
            ) : incidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-outline font-label-telemetry">
                  NO INCIDENTS LOGGED MATCHING FILTERS
                </td>
              </tr>
            ) : (
              incidents.map((inc) => (
                <tr key={inc._id} className="hover:bg-surface-container transition-colors">
                  <td className="p-space-md font-label-telemetry font-bold text-primary-fixed">
                    <div className="flex items-center gap-1.5">
                      {inc.isConfidential && (
                        <span className="material-symbols-outlined text-[14px] text-error" title="Confidential Incident">
                          lock
                        </span>
                      )}
                      <span>{inc.incidentId}</span>
                    </div>
                  </td>
                  <td className="p-space-md">
                    <div className="font-semibold text-primary">{inc.incidentType}</div>
                    <div className="text-secondary text-xs line-clamp-1 mt-0.5">{inc.description}</div>
                  </td>
                  <td className="p-space-md">
                    <span
                      className={`px-2 py-0.5 rounded font-label-telemetry text-[10px] font-bold ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-error-container text-on-error-container'
                          : inc.severity === 'HIGH'
                          ? 'bg-error-container/30 text-error'
                          : inc.severity === 'MEDIUM'
                          ? 'bg-primary-container/20 text-primary-fixed'
                          : 'bg-surface-container text-outline'
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="p-space-md">
                    <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-telemetry text-[10px] font-bold">
                      {inc.status}
                    </span>
                  </td>
                  <td className="p-space-md font-label-telemetry text-[11px] text-secondary">
                    {new Date(inc.reportedAt).toLocaleString()}
                  </td>
                  <td className="p-space-md text-right">
                    <div className="flex items-center justify-end gap-1.5 font-label-telemetry text-[11px]">
                      {inc.status === 'OPEN' && (
                        <button
                          onClick={() => handleStatusUpdate(inc.incidentId, 'INVESTIGATING')}
                          className="px-2.5 py-1 rounded bg-primary-fixed text-on-primary-fixed font-bold hover:bg-surface-tint"
                        >
                          INVESTIGATE
                        </button>
                      )}
                      {inc.status === 'INVESTIGATING' && (
                        <button
                          onClick={() => handleStatusUpdate(inc.incidentId, 'RESOLVED')}
                          className="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-variant text-primary-fixed font-bold"
                        >
                          RESOLVE
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedIncident(inc)}
                        className="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface"
                      >
                        DETAILS
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
          <div className="w-full max-w-lg bg-surface-container-low border border-surface-variant rounded-lg p-space-lg shadow-2xl space-y-4 font-label-telemetry text-xs">
            <div className="flex justify-between items-center border-b border-surface-variant pb-2">
              <span className="text-primary-fixed font-bold text-sm">{selectedIncident.incidentId}</span>
              <button onClick={() => setSelectedIncident(null)} className="text-outline hover:text-primary">✕</button>
            </div>
            <h3 className="font-headline-md text-primary text-base">{selectedIncident.incidentType}</h3>
            <p className="font-body-sm text-secondary">{selectedIncident.description}</p>
            <div className="grid grid-cols-2 gap-2 p-2 bg-surface-container-lowest rounded">
              <div><span className="text-outline">SEVERITY:</span> <strong className="text-error">{selectedIncident.severity}</strong></div>
              <div><span className="text-outline">STATUS:</span> <strong className="text-primary-fixed">{selectedIncident.status}</strong></div>
              <div><span className="text-outline">LOCATION:</span> <strong className="text-on-surface">{selectedIncident.location ? `${selectedIncident.location.coordinates[1].toFixed(4)}, ${selectedIncident.location.coordinates[0].toFixed(4)}` : 'N/A'}</strong></div>
              <div><span className="text-outline">CONFIDENTIAL:</span> <strong className={selectedIncident.isConfidential ? 'text-error' : 'text-on-surface'}>{selectedIncident.isConfidential ? 'YES (SAR PROTECTED)' : 'NO'}</strong></div>
            </div>
            <div className="flex justify-between pt-2">
              <div className="flex gap-2">
                {selectedIncident.status !== 'CLOSED' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedIncident.incidentId, 'CLOSED')}
                    className="px-3 py-1.5 bg-surface-container rounded text-outline hover:text-on-surface"
                  >
                    CLOSE INCIDENT
                  </button>
                )}
              </div>
              <button onClick={() => setSelectedIncident(null)} className="px-4 py-1.5 bg-surface-container-high rounded text-on-surface">
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
