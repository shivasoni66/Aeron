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
      setNotice(`Outcome '${outcomeId}' approved & published to Citizen App community feed.`);
      loadOutcomes(pagination.page);
    } catch (err: unknown) {
      setNotice(`[ERROR] ${err instanceof Error ? err.message : 'Publishing failed'}`);
    }
    setTimeout(() => setNotice(null), 5000);
  };

  const getReviewStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return 'bg-primary-fixed/20 text-primary-fixed border border-primary-fixed/40';
      case 'APPROVED':
        return 'bg-status-success/20 text-status-success border border-status-success/40';
      case 'REJECTED':
        return 'bg-status-danger/20 text-status-danger border border-status-danger/40';
      case 'PENDING_REVIEW':
        return 'bg-status-warning/20 text-status-warning border border-status-warning/40';
      case 'DRAFT':
      default:
        return 'bg-surface-container text-secondary border border-surface-variant';
    }
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {notice && (
        <div className="p-3 bg-surface-container border border-primary-fixed text-primary-fixed rounded-xl font-mono text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">verified</span>
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-on-surface hover:text-primary-fixed">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-sans text-xs font-semibold border border-primary-fixed/20">
              Verification & Citizen Sync
            </span>
          </div>
          <h1 className="font-sans text-2xl font-bold text-on-surface tracking-tight mt-1">
            Mission Outcomes & Citizen Staging
          </h1>
          <p className="font-sans text-secondary text-xs">
            Review aerial evidence packages, verify AI inspection inferences, and authorize public municipal resolution feeds.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl bg-surface-container-low border border-surface-variant/40 flex flex-wrap items-center justify-between gap-3 font-sans text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-outline">
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Filters:</span>
          </div>

          <select
            value={reviewStatusFilter}
            onChange={(e) => setReviewStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-variant/60 text-on-surface focus:outline-none text-xs"
          >
            <option value="">All Review Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="PUBLISHED">Published</option>
            <option value="REJECTED">Rejected</option>
            <option value="DRAFT">Draft</option>
          </select>

          <select
            value={outcomeTypeFilter}
            onChange={(e) => setOutcomeTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface-container-lowest border border-surface-variant/60 text-on-surface focus:outline-none text-xs"
          >
            <option value="">All Outcome Types</option>
            <option value="CIVIC_INFRASTRUCTURE">Civic Infrastructure</option>
            <option value="PUBLIC_SAFETY">Public Safety</option>
            <option value="ENVIRONMENTAL_AUDIT">Environmental Audit</option>
            <option value="RESCUE_OPERATION">Search & Rescue</option>
          </select>
        </div>

        <div className="text-outline text-[11px] font-sans">
          Total packages: <strong className="text-on-surface font-mono">{pagination.total}</strong>
        </div>
      </div>

      {/* Outcomes Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {isLoading ? (
          <div className="col-span-2 text-center py-16 text-outline font-sans text-xs">
            Synchronizing mission outcomes data...
          </div>
        ) : outcomes.length === 0 ? (
          <div className="col-span-2 text-center py-16 text-outline font-sans text-xs">
            <div className="flex flex-col items-center justify-center space-y-2">
              <span className="material-symbols-outlined text-[36px] text-outline/50">assignment_turned_in</span>
              <span className="font-semibold text-on-surface">No mission outcomes found</span>
              <p className="text-[11px] text-secondary max-w-sm">
                Zero mission outcome dossiers match the current filters. Complete sorties to generate evidence packages.
              </p>
            </div>
          </div>
        ) : (
          outcomes.map((out) => (
            <div
              key={out._id}
              className="p-5 rounded-xl bg-surface-container-low flex flex-col justify-between gap-4 shadow-xl border border-surface-variant/40 hover:border-surface-variant/70 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2 font-mono text-[11px] mb-1.5 flex-wrap">
                    <span className="text-primary-fixed font-bold">{out.outcomeId}</span>
                    <span className="text-outline">/</span>
                    <span className="text-secondary">{out.outcomeType}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getReviewStatusBadgeClass(out.reviewStatus)}`}>
                      {out.reviewStatus}
                    </span>
                  </div>
                  <h4 className="font-sans font-bold text-base text-on-surface mt-1 leading-snug">{out.summary}</h4>
                  <p className="font-sans text-xs text-secondary mt-1.5 line-clamp-2 leading-relaxed">{out.findings}</p>
                  <div className="font-sans text-[11px] text-outline mt-3 flex items-center gap-2">
                    <span>Mission:</span>
                    <strong className="text-on-surface font-semibold">{out.missionId?.title || 'General Sortie Log'}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 bg-surface-container-lowest/60 rounded-lg p-3 border border-surface-variant/30 text-xs">
                <div>
                  {out.isPublic ? (
                    <span className="bg-primary-fixed/15 text-primary-fixed border border-primary-fixed/30 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">public</span> Public in Citizen Feed
                    </span>
                  ) : (
                    <span className="bg-surface-container text-secondary border border-surface-variant px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">lock</span> Internal GCS Audit Only
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedOutcome(out)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface font-sans text-xs font-semibold border border-surface-variant/40 transition-colors"
                  >
                    Inspect & Audit
                  </button>

                  {out.reviewStatus === 'APPROVED' && !out.isPublic && (
                    <button
                      onClick={() => handleStagePublish(out.outcomeId)}
                      className="px-3.5 py-1.5 rounded-lg bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-sans text-xs font-bold transition-all shadow-[0_0_12px_rgba(191,244,46,0.25)] flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">publish</span>
                      Publish to Citizen App
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
