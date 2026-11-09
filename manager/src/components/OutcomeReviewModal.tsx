import React, { useState } from 'react';
import { reviewOutcome, publishOutcome } from '../services/api';
import { MissionOutcomeData } from '../types';

interface OutcomeReviewModalProps {
  outcome: MissionOutcomeData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const OutcomeReviewModal: React.FC<OutcomeReviewModalProps> = ({
  outcome,
  isOpen,
  onClose,
  onUpdated
}) => {
  const [findings, setFindings] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !outcome) return null;

  const handleReview = async (decision: 'APPROVED' | 'REJECTED') => {
    setError(null);
    setIsSubmitting(true);
    try {
      await reviewOutcome(outcome.outcomeId, decision, findings || undefined);
      setIsSubmitting(false);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Review action failed');
    }
  };

  const handlePublish = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await publishOutcome(outcome.outcomeId);
      setIsSubmitting(false);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Publishing action failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface-container-low border border-surface-variant rounded-lg p-space-lg shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-surface-variant mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-fixed">task_alt</span>
            <h3 className="font-headline-md text-headline-md text-primary">MISSION OUTCOME REVIEW</h3>
          </div>
          <button onClick={onClose} className="text-outline hover:text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-error-container/30 border border-error/50 text-error font-label-telemetry text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3 font-label-telemetry text-xs mb-6">
          <div className="flex justify-between items-center py-1 border-b border-surface-variant/40">
            <span className="text-outline">OUTCOME ID</span>
            <span className="text-primary-fixed font-bold">{outcome.outcomeId}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-surface-variant/40">
            <span className="text-outline">MISSION</span>
            <span className="text-primary font-bold">{outcome.missionId?.title || 'Unknown Mission'}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-surface-variant/40">
            <span className="text-outline">VERTICAL TYPE</span>
            <span className="text-secondary">{outcome.outcomeType}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-surface-variant/40">
            <span className="text-outline">CURRENT REVIEW STATUS</span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-primary-fixed font-bold">
              {outcome.reviewStatus}
            </span>
          </div>

          <div className="py-2">
            <span className="text-outline block mb-1">EXECUTIVE SUMMARY</span>
            <p className="font-body-sm text-sm text-on-surface bg-surface-container-lowest p-2.5 rounded border border-surface-variant/40">
              {outcome.summary}
            </p>
          </div>

          <div className="py-2">
            <span className="text-outline block mb-1">DETAILED FINDINGS / REASONING</span>
            <textarea
              defaultValue={outcome.findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={3}
              placeholder="Enter verified findings or rejection rationale..."
              className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:border-primary-fixed focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-surface-variant">
          <button
            onClick={() => handleReview('REJECTED')}
            disabled={isSubmitting}
            className="px-4 py-2 rounded bg-error-container/30 hover:bg-error-container text-error font-label-pill text-xs font-bold transition-colors disabled:opacity-50"
          >
            REJECT OUTCOME
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReview('APPROVED')}
              disabled={isSubmitting}
              className="px-4 py-2 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-pill text-xs font-bold transition-colors disabled:opacity-50"
            >
              APPROVE FINDINGS
            </button>

            {outcome.reviewStatus === 'APPROVED' && !outcome.isPublic && (
              <button
                onClick={handlePublish}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-label-pill text-xs font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(191,244,46,0.3)] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">publish</span>
                STAGE FOR CITIZEN APP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

