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
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl relative text-text-primary">
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[22px]">task_alt</span>
            <h3 className="font-sans font-bold text-base text-text-primary">MISSION OUTCOME VERIFICATION</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary flex items-center justify-center border border-border transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-danger/15 border border-danger/40 text-danger font-mono text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3 font-mono text-xs mb-6">
          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-text-muted">OUTCOME ID</span>
            <span className="text-accent-primary font-bold">{outcome.outcomeId}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-text-muted">MISSION</span>
            <span className="text-text-primary font-bold">{outcome.missionId?.title || 'Unknown Mission'}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-text-muted">VERTICAL</span>
            <span className="text-text-secondary">{outcome.outcomeType}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-border/50">
            <span className="text-text-muted">REVIEW STATUS</span>
            <span className="px-2 py-0.5 rounded bg-surface-elevated text-accent-primary font-bold border border-border">
              {outcome.reviewStatus}
            </span>
          </div>

          <div className="py-2">
            <span className="text-text-muted block mb-1 font-semibold">EXECUTIVE SUMMARY</span>
            <p className="font-sans text-xs text-text-secondary bg-surface-elevated p-3 rounded-lg border border-border/80 leading-relaxed">
              {outcome.summary}
            </p>
          </div>

          <div className="py-1">
            <label className="text-text-muted block mb-1 font-semibold uppercase">ADD AUDIT FINDINGS / NOTES</label>
            <textarea
              rows={2}
              placeholder="Verification observations, sensory data corroboration..."
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-accent-primary focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-border flex items-center justify-between">
          <button
            onClick={() => handleReview('REJECTED')}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 font-sans font-bold text-xs transition-colors disabled:opacity-50"
          >
            REJECT AUDIT
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReview('APPROVED')}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-success/15 hover:bg-success/25 text-success border border-success/30 font-sans font-bold text-xs transition-colors disabled:opacity-50"
            >
              APPROVE OUTCOME
            </button>
            {outcome.reviewStatus === 'APPROVED' && !outcome.isPublic && (
              <button
                onClick={handlePublish}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-accent-primary text-background font-sans font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                PUBLISH TO PUBLIC FEED
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
