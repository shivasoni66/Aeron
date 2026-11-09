import React, { useEffect, useState } from 'react';
import { fetchOutcomes, publishOutcome } from '../services/api';
import { MissionOutcomeData } from '../types';
import { OutcomeReviewModal } from '../components/OutcomeReviewModal';

export const MissionOutcomesPage: React.FC = () => {
  const [outcomes, setOutcomes] = useState<MissionOutcomeData[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('');
  const [outcomeTypeFilter, setOutcomeTypeFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedOutcome, setSelectedOutcome] = useState<MissionOutcomeData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOutcomes = async (p = 1) => {
    setIsLoading(true);
    try {
      const res = await fetchOutcomes({
        page: p,
        limit: 15,
        reviewStatus: reviewStatusFilter || undefined,
        outcomeType: outcomeTypeFilter || undefined
      });
      setOutcomes(res.outcomes || []);
      setPagination(res.pagination || { page: p, limit: 15, total: 0, totalPages: 1 });
    } catch (err: unknown) {
      console.warn(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOutcomes(1);
  }, [reviewStatusFilter, outcomeTypeFilter]);

  const handleStagePublish = async (outcomeId: string) => {
    try {
      await publishOutcome(outcomeId);
      setNotice(`Outcome '${outcomeId}' staged and published to Citizen App feed.`);
      loadOutcomes(pagination.page);
    } catch (err: unknown) {
      setNotice(`[ERROR] ${err instanceof Error ? err.message : 'Publishing failed'}`);
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
            <span className="font-label-telemetry text-label-telemetry text-primary-fixed">[OUTCOMES WORKFLOW]</span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-label-telemetry text-[10px] font-bold">
              VERIFICATION & PUBLISHING
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mt-0.5">
            MISSION OUTCOMES & CITIZEN STREAM
          </h1>
          <p className="font-body-sm text-secondary text-xs">
            Review aerial evidence packages, verify AI inspection inferences, and authorize municipal public staging feeds.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-space-md rounded bg-surface-container-low border border-surface-variant/40 flex flex-wrap items-center justify-between gap-3 font-label-telemetry text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={reviewStatusFilter}
            onChange={(e) => setReviewStatusFilter(e.target.value)}
            className="px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none text-xs"
          >
            <option value="">ALL REVIEW STATUSES</option>
            <option value="PENDING_REVIEW">PENDING REVIEW</option>
            <option value="APPROVED">APPROVED</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="DRAFT">DRAFT</option>
          </select>

          <select
            value={outcomeTypeFilter}
            onChange={(e) => setOutcomeTypeFilter(e.target.value)}
            className="px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:outline-none text-xs"
          >
            <option value="">ALL VERTICAL OUTCOMES</option>
            <option value="CIVIC_INFRASTRUCTURE">CIVIC INFRASTRUCTURE</option>
            <option value="PUBLIC_SAFETY">PUBLIC SAFETY</option>
            <option value="ENVIRONMENTAL_AUDIT">ENVIRONMENTAL AUDIT</option>
            <option value="RESCUE_OPERATION">RESCUE OPERATION</option>
          </select>
        </div>
      </div>

      {/* Outcomes Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
        {isLoading ? (
          <div className="col-span-2 text-center py-16 text-outline font-label-telemetry text-xs">
            LOADING MISSION OUTCOMES...
          </div>
        ) : outcomes.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-outline font-label-telemetry text-xs">
            NO MISSION OUTCOMES LOGGED MATCHING FILTERS
          </div>
        ) : (
          outcomes.map((out) => (
            <div
              key={out._id}
              className="p-space-lg rounded-lg bg-surface-container-low flex flex-col justify-between gap-space-md shadow-xl border border-surface-variant/40"
            >
              <div className="flex items-start justify-between gap-space-sm">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 font-label-telemetry text-[11px]">
                    <span className="text-primary-fixed font-bold">{out.outcomeId}</span>
                    <span className="text-outline">|</span>
                    <span className="text-secondary">{out.outcomeType}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        out.reviewStatus === 'PUBLISHED'
                          ? 'bg-primary-fixed text-on-primary-fixed'
                          : out.reviewStatus === 'APPROVED'
                          ? 'bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/40'
                          : out.reviewStatus === 'REJECTED'
                          ? 'bg-error-container text-error'
                          : 'bg-surface-container text-outline'
                      }`}
                    >
                      {out.reviewStatus}
                    </span>
                  </div>
                  <h4 className="font-headline-md text-base text-primary mt-1">{out.summary}</h4>
                  <p className="font-body-sm text-xs text-secondary mt-1">{out.findings}</p>
                  <div className="font-label-telemetry text-[10px] text-outline mt-2">
                    SORTIE: <strong className="text-on-surface">{out.missionId?.title || 'GENERAL MISSION'}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-space-sm bg-surface-container-lowest/50 rounded p-space-sm border border-surface-variant/30 font-label-telemetry text-[11px]">
                <span className="text-outline">
                  {out.isPublic ? (
                    <span className="text-primary-fixed flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">public</span> PUBLIC IN CITIZEN FEED
                    </span>
                  ) : (
                    'INTERNAL GCS REVIEW'
                  )}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedOutcome(out)}
                    className="px-3 py-1.5 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-pill text-xs font-bold transition-colors"
                  >
                    INSPECT & AUDIT
                  </button>

                  {out.reviewStatus === 'APPROVED' && !out.isPublic && (
                    <button
                      onClick={() => handleStagePublish(out.outcomeId)}
                      className="px-4 py-1.5 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill text-xs font-bold shadow-[0_0_12px_rgba(191,244,46,0.3)] flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">publish</span>
                      STAGE FOR CITIZEN APP
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <OutcomeReviewModal
        isOpen={!!selectedOutcome}
        outcome={selectedOutcome}
        onClose={() => setSelectedOutcome(null)}
        onUpdated={() => loadOutcomes(pagination.page)}
      />
    </div>
  );
};
