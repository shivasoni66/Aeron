import React, { useEffect, useState } from 'react';
import { createMission, fetchAvailableDrones } from '../services/api';
import { DroneData, MissionType } from '../types';

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCategory?: MissionType;
}

export const CreateMissionModal: React.FC<CreateMissionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCategory = 'CIVIC_ISSUE_VERIFICATION'
}) => {
  const [missionType, setMissionType] = useState<MissionType>(defaultCategory);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDroneId, setSelectedDroneId] = useState<string>('');
  const [availableDrones, setAvailableDrones] = useState<DroneData[]>([]);
  const [plannedStart, setPlannedStart] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMissionType(defaultCategory);
      setError(null);
      fetchAvailableDrones()
        .then((res) => {
          setAvailableDrones(res.drones || []);
          const readyDrone = res.drones.find((d) => d.operationalStatus === 'READY');
          if (readyDrone) {
            setSelectedDroneId(readyDrone.droneId);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, defaultCategory]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await createMission({
        missionType,
        title,
        description,
        assignedDrones: selectedDroneId ? [selectedDroneId] : undefined,
        plannedStart: plannedStart ? new Date(plannedStart).toISOString() : undefined
      });
      setIsSubmitting(false);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to create mission');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl relative text-text-primary">
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-accent-primary text-[22px]">add_circle</span>
            <h3 className="font-sans font-bold text-base text-text-primary">INITIALIZE NEW MISSION SORTIE</h3>
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

        <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
          <div>
            <label className="block text-text-muted uppercase tracking-wider mb-1.5 font-medium">MISSION VERTICAL</label>
            <select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value as MissionType)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-accent-primary focus:outline-none font-sans text-xs"
            >
              <option value="CIVIC_ISSUE_VERIFICATION">M01 — Civic Issue Verification</option>
              <option value="CROWD_SAFETY">M02 — Crowd Safety & Aerial Mesh</option>
              <option value="MICRO_CLIMATE">M03 — Micro-Climate & Heat Island</option>
              <option value="SUBTERRANEAN_SEARCH_RESCUE">M04 — Subterranean Search & Rescue</option>
            </select>
          </div>

          <div>
            <label className="block text-text-muted text-xs mb-1.5 font-medium font-sans">Mission Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Sector 7 Urban Infrastructure Survey"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-accent-primary focus:outline-none font-sans text-xs"
            />
          </div>

          <div>
            <label className="block text-text-muted uppercase tracking-wider mb-1.5 font-medium">OPERATIONAL DESCRIPTION</label>
            <textarea
              required
              rows={3}
              placeholder="Operational objectives, flight corridors, safety constraints..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-accent-primary focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-text-muted uppercase tracking-wider mb-1.5 font-medium">ASSIGN AIRFRAME</label>
              <select
                value={selectedDroneId}
                onChange={(e) => setSelectedDroneId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-accent-primary focus:outline-none"
              >
                <option value="">AUTO-SELECT DISPATCH</option>
                {availableDrones.map((d) => (
                  <option key={d.droneId} value={d.droneId}>
                    {d.droneId} ({d.displayName}) — {d.operationalStatus}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-text-muted uppercase tracking-wider mb-1.5 font-medium">PLANNED DEPLOYMENT</label>
              <input
                type="datetime-local"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface-elevated border border-border text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-surface-elevated hover:bg-surface-muted text-text-secondary rounded-lg border border-border font-sans font-semibold text-xs transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-accent-primary text-background font-sans font-bold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  <span>INITIALIZING SORTIE...</span>
                </>
              ) : (
                <span>DISPATCH MISSION</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
