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
      <div className="w-full max-w-lg bg-surface-container-low border border-surface-variant rounded-lg p-space-lg shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-surface-variant mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-fixed">add_circle</span>
            <h3 className="font-headline-md text-headline-md text-primary">INITIALIZE NEW MISSION SORTIE</h3>
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

        <form onSubmit={handleSubmit} className="space-y-4 font-label-telemetry text-xs">
          <div>
            <label className="block text-outline uppercase tracking-wider mb-1">MISSION VERTICAL</label>
            <select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value as MissionType)}
              className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:border-primary-fixed focus:outline-none"
            >
              <option value="CIVIC_ISSUE_VERIFICATION">M01 // CIVIC ISSUE VERIFICATION</option>
              <option value="CROWD_SAFETY">M02 // CROWD SAFETY & AERIAL MESH</option>
              <option value="MICRO_CLIMATE">M03 // MICRO-CLIMATE & HEAT ISLAND</option>
              <option value="SUBTERRANEAN_SEARCH_RESCUE">M04 // SUBTERRANEAN SEARCH & RESCUE</option>
            </select>
          </div>

          <div>
            <label className="block text-outline uppercase tracking-wider mb-1">MISSION TITLE</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={200}
              placeholder="e.g. Sector 04 Road Pavement Quality Survey"
              className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:border-primary-fixed focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-outline uppercase tracking-wider mb-1">OPERATIONAL DESCRIPTION</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="Describe mission flight goals, target zones, and evidence verification parameters..."
              className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:border-primary-fixed focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-outline uppercase tracking-wider mb-1">ASSIGNED AIRFRAME</label>
              <select
                value={selectedDroneId}
                onChange={(e) => setSelectedDroneId(e.target.value)}
                className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:border-primary-fixed focus:outline-none"
              >
                <option value="">-- NO DRONE ASSIGNED --</option>
                {availableDrones.map((d) => (
                  <option key={d.droneId} value={d.droneId}>
                    {d.droneId} ({d.displayName}) [{d.operationalStatus}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-outline uppercase tracking-wider mb-1">PLANNED START TIME</label>
              <input
                type="datetime-local"
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-surface-variant text-on-surface focus:border-primary-fixed focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-surface-container hover:bg-surface-variant text-secondary text-xs font-label-pill"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-full bg-primary-fixed hover:bg-surface-tint text-on-primary-fixed font-bold text-xs font-label-pill flex items-center gap-1.5 shadow-[0_0_12px_rgba(191,244,46,0.3)] disabled:opacity-50"
            >
              {isSubmitting ? 'CREATING...' : 'AUTHORIZE MISSION +'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

