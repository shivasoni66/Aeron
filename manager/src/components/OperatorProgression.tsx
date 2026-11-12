import React from 'react';

interface OperatorProgressionProps {
  completedMissions: number;
  totalMissions: number;
  pendingReviews: number;
}

export interface OperatorTier {
  rank: string;
  level: number;
  minXp: number;
  maxXp: number;
  badge: string;
  callsignPrefix: string;
}

const TIERS: OperatorTier[] = [
  { rank: 'Flight Cadet', level: 1, minXp: 0, maxXp: 300, badge: 'military_tech', callsignPrefix: 'FC' },
  { rank: 'Mission Operator', level: 2, minXp: 300, maxXp: 800, badge: 'shield', callsignPrefix: 'MO' },
  { rank: 'Senior Operator', level: 3, minXp: 800, maxXp: 1800, badge: 'workspace_premium', callsignPrefix: 'SO' },
  { rank: 'Mission Specialist', level: 4, minXp: 1800, maxXp: 3500, badge: 'stars', callsignPrefix: 'MS' },
  { rank: 'Fleet Marshal', level: 5, minXp: 3500, maxXp: 6000, badge: 'diamond', callsignPrefix: 'FM' }
];

export const OperatorProgression: React.FC<OperatorProgressionProps> = ({
  completedMissions,
  totalMissions,
  pendingReviews
}) => {
  // Compute authentic XP: 250 XP per completed mission + 50 XP per verified outcome
  const baseMissionXp = completedMissions * 250;
  const reviewBonusXp = Math.max(0, (totalMissions - pendingReviews) * 50);
  const currentXp = Math.max(150, baseMissionXp + reviewBonusXp);

  const currentTier = TIERS.slice().reverse().find((t) => currentXp >= t.minXp) || TIERS[0];
  const nextTier = TIERS.find((t) => t.level === currentTier.level + 1) || currentTier;

  const xpInLevel = currentXp - currentTier.minXp;
  const levelRange = Math.max(1, nextTier.maxXp - currentTier.minXp);
  const progressPct = Math.min(100, Math.round((xpInLevel / levelRange) * 100));

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-5">
      {/* Insignia & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-aeron-lime/20 via-surface-elevated to-surface-secondary flex items-center justify-center border border-aeron-lime/30 shadow-[0_0_15px_rgba(191,244,46,0.15)]">
            <span className="material-symbols-outlined text-aeron-lime text-[26px]">
              {currentTier.badge}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-[11px] text-aeron-lime font-semibold tracking-wide bg-aeron-lime/10 px-2 py-0.5 rounded border border-aeron-lime/20">
                Command clearance
              </span>
              <span className="text-text-muted text-xs font-mono">
                • {currentTier.callsignPrefix}-01
              </span>
            </div>
            <h3 className="font-sans text-base font-bold text-text-primary mt-0.5">
              Operator progression
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right font-sans">
            <div className="text-xs text-text-muted">Current rank</div>
            <div className="text-sm font-semibold text-aeron-lime">
              Level {currentTier.level} • {currentTier.rank}
            </div>
          </div>
        </div>
      </div>

      {/* Experience Bar with Glowing Accent */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-sans">
          <span className="text-text-secondary flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-aeron-lime" />
            Flight experience
          </span>
          <span className="text-text-primary font-medium font-mono">
            <span className="text-aeron-lime font-bold">{currentXp}</span> / {nextTier.maxXp} XP
          </span>
        </div>
        <div className="w-full h-2.5 bg-surface-elevated rounded-full overflow-hidden border border-border/80">
          <div
            className="h-full bg-gradient-to-r from-accent-soft via-aeron-lime to-aeron-lime transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(191,244,46,0.4)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-text-muted font-sans">
          <span>{completedMissions} missions completed</span>
          <span className="text-aeron-lime font-medium">{progressPct}% to next rank</span>
        </div>
      </div>

      {/* Four Specific Operational Merit Badges */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {/* Civic Guardian */}
        <div className="p-3 bg-surface-elevated rounded-xl border border-border/80 flex items-center gap-3 hover:border-aeron-lime/40 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-aeron-lime/15 text-aeron-lime border border-aeron-lime/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">verified</span>
          </div>
          <div className="min-w-0 font-sans">
            <div className="text-xs font-semibold text-text-primary truncate">Civic Guardian</div>
            <div className="text-[11px] text-aeron-lime">Infrastructure</div>
          </div>
        </div>

        {/* Crowd Mesh Sentinel */}
        <div className="p-3 bg-surface-elevated rounded-xl border border-border/80 flex items-center gap-3 hover:border-telemetry-cyan/40 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-telemetry-cyan/15 text-telemetry-cyan border border-telemetry-cyan/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">cell_tower</span>
          </div>
          <div className="min-w-0 font-sans">
            <div className="text-xs font-semibold text-text-primary truncate">Rapid Dispatcher</div>
            <div className="text-[11px] text-telemetry-cyan">Mesh Comm Link</div>
          </div>
        </div>

        {/* Eco Sentinel */}
        <div className="p-3 bg-surface-elevated rounded-xl border border-border/80 flex items-center gap-3 hover:border-caution-amber/40 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-caution-amber/15 text-caution-amber border border-caution-amber/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">thermostat</span>
          </div>
          <div className="min-w-0 font-sans">
            <div className="text-xs font-semibold text-text-primary truncate">Eco Sentinel</div>
            <div className="text-[11px] text-caution-amber">Micro-Climate</div>
          </div>
        </div>

        {/* SAR Wings */}
        <div className="p-3 bg-surface-elevated rounded-xl border border-border/80 flex items-center gap-3 hover:border-sar-violet/40 transition-colors">
          <div className="w-9 h-9 rounded-lg bg-sar-violet/15 text-sar-violet border border-sar-violet/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">emergency</span>
          </div>
          <div className="min-w-0 font-sans">
            <div className="text-xs font-semibold text-text-primary truncate">SAR Wings</div>
            <div className="text-[11px] text-sar-violet">Rescue Operations</div>
          </div>
        </div>
      </div>
    </div>
  );
};
