import React, { useEffect, useState } from 'react';
import { fetchMissions, updateMission } from '../services/api';
import { MissionData, MissionStatus } from '../types';
import { CreateMissionModal } from '../components/CreateMissionModal';

export const AllMissionsPage: React.FC = () => {
  const [missions, setMissions] = useState<MissionData[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [category, setCategory] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [selectedMission, setSelectedMission] = useState<MissionData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMissions = async (p = 1) => {
    setIsLoading(true);
    try {
      const res = await fetchMissions({
        page: p,
        limit: 15,
        category: category || undefined,
        status: status || undefined,
        search: search || undefined
      });
      setMissions(res.missions || []);
      setPagination(res.pagination || { page: p, limit: 15, total: 0, totalPages: 1 });
    } catch (err: unknown) {
      console.warn('Failed to load missions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMissions(1);
  }, [category, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadMissions(1);
  };

  const handleStatusChange = async (missionId: string, newStatus: MissionStatus) => {
    try {
      await updateMission(missionId, { status: newStatus });
      setNotice(`Mission '${missionId}' status transitioned to ${newStatus}.`);
      loadMissions(pagination.page);
    } catch (err: unknown) {
      setNotice(`[ERROR] ${err instanceof Error ? err.message : 'Transition failed'}`);
    }
    setTimeout(() => setNotice(null), 5000);
  };

  const handleAdvanceStage = async (m: MissionData) => {
    if (m.stage >= 8) return;
    const nextStage = m.stage + 1;
    try {
      await updateMission(m.missionId, { stage: nextStage });
      setNotice(`Mission '${m.missionId}' advanced to Stage ${nextStage}/8.`);
      loadMissions(pagination.page);
    } catch (err: unknown) {
      setNotice(`[ERROR] ${err instanceof Error ? err.message : 'Stage advancement failed'}`);
    }
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="flex flex-col w-full px-6 py-6 space-y-6 max-w-[1680px] mx-auto text-text-primary">
      {notice && (
        <div className="p-3.5 bg-accent-primary/15 border border-accent-primary/40 text-accent-primary rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-text-primary hover:text-accent-primary">✕</button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[24px]">flight_takeoff</span>
            <h1 className="font-sans font-bold text-base tracking-wide text-text-primary">
              All Missions Catalog
            </h1>
          </div>
          <p className="font-sans text-xs text-text-muted mt-0.5">
            Multi-mission sortie register • {pagination.total} total missions recorded
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-accent-primary text-background font-sans font-bold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Create mission</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="p-4 rounded-xl bg-surface border border-border flex flex-wrap items-center justify-between gap-3 font-sans text-xs">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="bg-surface-elevated px-3 py-1.5 rounded-lg flex items-center gap-2 border border-border flex-1">
            <span className="material-symbols-outlined text-[18px] text-text-muted">search</span>
            <input
              type="text"
              placeholder="Search title, mission ID or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-text-primary placeholder:text-text-muted outline-none w-full text-xs"
            />
          </div>
          <button type="submit" className="px-3.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-primary hover:border-accent-primary font-semibold transition-colors">
            Filter
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-primary outline-none focus:border-accent-primary text-xs"
          >
            <option value="">All Verticals</option>
            <option value="CIVIC_ISSUE_VERIFICATION">Civic Issue Verification</option>
            <option value="CROWD_SAFETY">Crowd Safety</option>
            <option value="MICRO_CLIMATE">Micro-Climate</option>
            <option value="SUBTERRANEAN_SEARCH_RESCUE">Search & Rescue</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-text-primary outline-none focus:border-accent-primary text-xs"
          >
            <option value="">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Missions Data Table */}
      <div className="bg-surface rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-left font-sans text-xs">
          <thead>
            <tr className="border-b border-border text-text-muted text-[11px] font-semibold">
              <th className="py-3 px-4">Mission ID</th>
              <th className="py-3 px-4">Title & Vertical</th>
              <th className="py-3 px-4">Operational Stage</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Assigned Airframe</th>
              <th className="py-3 px-4 text-right">Stage Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-text-secondary">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-muted">
                  Fetching mission register...
                </td>
              </tr>
            ) : missions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-muted">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <span className="material-symbols-outlined text-[36px] text-text-muted/50">flight_takeoff</span>
                    <span className="font-semibold text-text-primary">No missions found</span>
                    <p className="text-[11px] text-text-muted max-w-sm">
                      Zero missions match the current filter criteria. Create a mission to dispatch autonomous sorties.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              missions.map((m) => (
                <tr key={m._id} className="hover:bg-surface-elevated/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-text-primary font-bold">{m.missionId}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(m.missionId);
                          setNotice(`Mission ID ${m.missionId} copied to clipboard.`);
                          setTimeout(() => setNotice(null), 3000);
                        }}
                        className="p-1 rounded text-text-muted hover:text-accent-primary transition-colors"
                        title="Copy Mission ID"
                      >
                        <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-sans font-bold text-text-primary block text-sm">
                      {m.title}
                    </span>
                    <span className="text-[10px] text-text-muted uppercase font-mono">
                      {m.missionType}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-accent-primary">Stage {m.stage} of 8</span>
                        <span className="text-[10px] text-text-muted font-mono">{Math.round((m.stage / 8) * 100)}%</span>
                      </div>
                      <span className="text-[11px] text-text-secondary block font-medium truncate max-w-[180px]">
                        {m.stageLabel}
                      </span>
                      <div className="w-28 h-1.5 bg-surface-elevated rounded-full overflow-hidden border border-border/50">
                        <div
                          className="h-full bg-accent-primary rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((m.stage / 8) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={m.status}
                      onChange={(e) => handleStatusChange(m.missionId, e.target.value as MissionStatus)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-elevated border border-border outline-none font-mono ${
                        m.status === 'ACTIVE'
                          ? 'text-accent-primary border-accent-primary/40'
                          : m.status === 'COMPLETED'
                          ? 'text-success border-success/40'
                          : 'text-text-muted'
                      }`}
                    >
                      <option value="PLANNED">PLANNED</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PAUSED">PAUSED</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CANCELLED">CANCELLED</option>
                      <option value="ABORTED">ABORTED</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-text-primary font-mono text-[11px]">
                    {m.assignedDrones && m.assignedDrones.length > 0
                      ? m.assignedDrones.map((d) => d.displayName || d.droneId).join(', ')
                      : 'AERON-HEX-01'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedMission(m)}
                        className="px-2.5 py-1 bg-surface-elevated hover:bg-surface-muted text-text-secondary border border-border rounded-lg text-xs transition-colors font-medium"
                      >
                        Inspect
                      </button>
                      <button
                        disabled={m.stage >= 8}
                        onClick={() => handleAdvanceStage(m)}
                        className="px-2.5 py-1 bg-surface-elevated hover:bg-accent-primary hover:text-background text-accent-primary border border-border rounded-lg text-xs font-bold transition-colors disabled:opacity-30 disabled:hover:bg-surface-elevated disabled:hover:text-accent-primary flex items-center gap-1"
                        title={m.stage >= 8 ? 'Mission at final stage' : 'Advance to next operational stage'}
                      >
                        <span>Advance</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between font-mono text-xs text-text-secondary">
            <span>SHOWING PAGE {pagination.page} OF {pagination.totalPages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadMissions(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border disabled:opacity-40 hover:bg-surface-muted transition-colors"
              >
                PREVIOUS
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadMissions(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border disabled:opacity-40 hover:bg-surface-muted transition-colors"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Mission Details Modal */}
      {selectedMission && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs text-text-primary">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-accent-primary text-[22px]">flight_takeoff</span>
                <h3 className="font-sans font-bold text-base text-text-primary">
                  Mission Briefing • {selectedMission.missionId}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMission(null)}
                className="w-8 h-8 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary flex items-center justify-center border border-border transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <span className="text-text-muted text-[10px] block">TITLE</span>
                <span className="font-sans text-base font-bold text-text-primary block mt-0.5">{selectedMission.title}</span>
                <span className="text-[11px] text-accent-primary block mt-0.5">{selectedMission.missionType}</span>
              </div>

              <div>
                <span className="text-text-muted text-[10px] block font-semibold">DESCRIPTION</span>
                <p className="font-sans text-xs text-text-secondary bg-surface-elevated p-3 rounded-lg border border-border/80 leading-relaxed mt-1">
                  {selectedMission.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-surface-elevated p-3 rounded-xl border border-border">
                  <span className="text-text-muted text-[10px] block">CURRENT STAGE</span>
                  <span className="text-sm font-bold text-accent-primary">STAGE {selectedMission.stage}/8</span>
                  <span className="text-[10px] text-text-muted block mt-0.5">{selectedMission.stageLabel}</span>
                </div>
                <div className="bg-surface-elevated p-3 rounded-xl border border-border">
                  <span className="text-text-muted text-[10px] block">STATUS</span>
                  <span className="text-sm font-bold text-text-primary uppercase">{selectedMission.status}</span>
                  <span className="text-[10px] text-text-muted block mt-0.5">
                    {selectedMission.completedAt ? `Closed ${new Date(selectedMission.completedAt).toLocaleDateString()}` : 'In Flight Ops'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedMission(null)}
                className="px-4 py-2 bg-surface-elevated hover:bg-surface-muted text-text-primary rounded-lg border border-border font-sans font-semibold text-xs transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <CreateMissionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => loadMissions(1)}
      />
    </div>
  );
};
