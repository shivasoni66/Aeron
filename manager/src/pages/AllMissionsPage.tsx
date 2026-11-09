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
    <div className="flex flex-col w-full gap-space-lg">
      {notice && (
        <div className="p-space-sm bg-primary-container/20 border border-primary-fixed text-primary-fixed rounded font-label-telemetry text-xs flex items-center justify-between shadow-lg">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-on-surface hover:text-primary-fixed">✕</button>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-sm">
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">[CATALOG]</span>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">ALL MISSIONS CATALOG</h1>
          </div>
          <p className="font-body-sm text-secondary text-xs">Complete register of multi-mission sorties, active stages, and aircraft assignments.</p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-space-lg py-2.5 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill text-xs font-bold flex items-center gap-2 shadow-[0_0_16px_rgba(191,244,46,0.3)] shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>NEW MISSION SORTIE +</span>
        </button>
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
              placeholder="SEARCH BY ID, TITLE OR SPEC..."
              className="bg-transparent text-on-surface focus:outline-none w-full text-xs placeholder:text-outline"
            />
          </div>
          <button type="submit" className="px-3 py-2 bg-surface-container-high hover:bg-surface-variant rounded text-on-surface">
            SEARCH
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none text-xs"
          >
            <option value="">ALL VERTICALS</option>
            <option value="CIVIC_ISSUE_VERIFICATION">M01 // CIVIC ISSUE</option>
            <option value="CROWD_SAFETY">M02 // CROWD SAFETY</option>
            <option value="MICRO_CLIMATE">M03 // MICRO-CLIMATE</option>
            <option value="SUBTERRANEAN_SEARCH_RESCUE">M04 // SEARCH & RESCUE</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none text-xs"
          >
            <option value="">ALL STATUSES</option>
            <option value="PLANNED">PLANNED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="ABORTED">ABORTED</option>
          </select>
        </div>
      </div>

      {/* Missions Table */}
      <div className="w-full overflow-x-auto rounded-lg bg-surface-container-low shadow-xl border border-surface-variant/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-lowest text-outline font-label-telemetry text-[11px] uppercase tracking-wider border-b border-surface-variant/50">
              <th className="p-space-md">MISSION ID</th>
              <th className="p-space-md">TITLE & VERTICAL</th>
              <th className="p-space-md">STAGE / 8</th>
              <th className="p-space-md">STATUS</th>
              <th className="p-space-md">AIRFRAME</th>
              <th className="p-space-md">PLANNED START</th>
              <th className="p-space-md text-right">LIFECYCLE CONTROLS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant/30 text-on-surface font-body-sm text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-outline font-label-telemetry">
                  LOADING MISSION CATALOG...
                </td>
              </tr>
            ) : missions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-outline font-label-telemetry">
                  NO MISSIONS FOUND MATCHING CRITERIA
                </td>
              </tr>
            ) : (
              missions.map((m) => (
                <tr key={m._id} className="hover:bg-surface-container transition-colors">
                  <td className="p-space-md font-label-telemetry text-primary-fixed font-bold">
                    {m.missionId}
                  </td>
                  <td className="p-space-md">
                    <div className="font-semibold text-primary">{m.title}</div>
                    <div className="font-label-telemetry text-[10px] text-outline mt-0.5">
                      {m.missionType}
                    </div>
                  </td>
                  <td className="p-space-md min-w-[140px]">
                    <div className="flex items-center justify-between font-label-telemetry text-[10px] text-outline mb-1">
                      <span>STAGE {m.stage}/8</span>
                      <span>{Math.round((m.stage / 8) * 100)}%</span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary-fixed h-full transition-all"
                        style={{ width: `${(m.stage / 8) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-space-md">
                    <span
                      className={`px-2 py-0.5 rounded font-label-telemetry text-[10px] font-bold ${
                        m.status === 'ACTIVE'
                          ? 'bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/30 animate-pulse'
                          : m.status === 'COMPLETED'
                          ? 'bg-surface-variant text-secondary'
                          : m.status === 'PAUSED'
                          ? 'bg-secondary/20 text-secondary'
                          : 'bg-surface-container text-outline'
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="p-space-md font-label-telemetry text-xs">
                    {m.assignedDrones?.[0]?.droneId ? (
                      <span className="text-primary font-bold">{m.assignedDrones[0].droneId}</span>
                    ) : (
                      <span className="text-outline">UNASSIGNED</span>
                    )}
                  </td>
                  <td className="p-space-md font-label-telemetry text-[11px] text-secondary">
                    {m.plannedStart ? new Date(m.plannedStart).toLocaleDateString() : 'IMMEDIATE'}
                  </td>
                  <td className="p-space-md text-right">
                    <div className="flex items-center justify-end gap-1.5 font-label-telemetry text-[11px]">
                      {m.status === 'PLANNED' && (
                        <button
                          onClick={() => handleStatusChange(m.missionId, 'ACTIVE')}
                          className="px-2.5 py-1 rounded bg-primary-fixed text-on-primary-fixed font-bold hover:bg-surface-tint"
                        >
                          ACTIVATE
                        </button>
                      )}
                      {m.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => handleAdvanceStage(m)}
                            disabled={m.stage >= 8}
                            className="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-variant text-primary-fixed border border-primary-fixed/40 disabled:opacity-30"
                          >
                            +STAGE
                          </button>
                          <button
                            onClick={() => handleStatusChange(m.missionId, 'COMPLETED')}
                            className="px-2.5 py-1 rounded bg-surface-container-high hover:bg-surface-variant text-secondary"
                          >
                            FINISH
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedMission(m)}
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

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center font-label-telemetry text-xs text-outline pt-2">
          <span>PAGE {pagination.page} OF {pagination.totalPages} ({pagination.total} TOTAL SORTIES)</span>
          <div className="flex gap-2">
            <button
              onClick={() => loadMissions(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 rounded bg-surface-container hover:bg-surface-variant text-on-surface disabled:opacity-40"
            >
              PREVIOUS
            </button>
            <button
              onClick={() => loadMissions(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 rounded bg-surface-container hover:bg-surface-variant text-on-surface disabled:opacity-40"
            >
              NEXT
            </button>
          </div>
        </div>
      )}

      {/* Mission Detail Modal */}
      {selectedMission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface-container-low border border-surface-variant rounded-lg p-space-lg shadow-2xl space-y-4 font-label-telemetry text-xs">
            <div className="flex justify-between items-center border-b border-surface-variant pb-2">
              <span className="text-primary-fixed font-bold text-sm">{selectedMission.missionId}</span>
              <button onClick={() => setSelectedMission(null)} className="text-outline hover:text-primary">✕</button>
            </div>
            <h3 className="font-headline-md text-primary text-base">{selectedMission.title}</h3>
            <p className="font-body-sm text-secondary">{selectedMission.description}</p>
            <div className="grid grid-cols-2 gap-2 p-2 bg-surface-container-lowest rounded">
              <div><span className="text-outline">VERTICAL:</span> <strong className="text-on-surface">{selectedMission.missionType}</strong></div>
              <div><span className="text-outline">STATUS:</span> <strong className="text-primary-fixed">{selectedMission.status}</strong></div>
              <div><span className="text-outline">STAGE:</span> <strong className="text-on-surface">{selectedMission.stage}/8 ({selectedMission.stageLabel})</strong></div>
              <div><span className="text-outline">AIRFRAME:</span> <strong className="text-on-surface">{selectedMission.assignedDrones?.[0]?.droneId || 'NONE'}</strong></div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedMission(null)} className="px-4 py-1.5 bg-surface-container-high rounded text-on-surface">
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateMissionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          loadMissions(1);
          setNotice('New mission sortie created.');
        }}
      />
    </div>
  );
};

