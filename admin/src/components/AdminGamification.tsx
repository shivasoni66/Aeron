import React from 'react';

interface AdminGamificationProps {
  verifiedChecksCount: number;
  totalChecksCount: number;
  isOnline: boolean;
  streakDays?: number;
  lastAuditDate?: string;
}

export const AdminGamification: React.FC<AdminGamificationProps> = ({
  verifiedChecksCount,
  totalChecksCount,
  isOnline = false,
  streakDays = 14,
  lastAuditDate
}) => {
  const readinessPct = totalChecksCount > 0 ? Math.round((verifiedChecksCount / totalChecksCount) * 100) : 0;
  const auditFormattedDate = lastAuditDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const activeStreak = isOnline ? streakDays : Math.max(1, streakDays - 1);

  return (
    <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-aeron-lime/15 border border-aeron-lime/30 flex items-center justify-center text-aeron-lime">
            <span className="material-symbols-outlined text-[22px]">military_tech</span>
          </div>
          <div>
            <h3 className="font-sans text-sm font-bold text-text-primary">
              Flight Engineer Progression
            </h3>
            <p className="text-[11px] text-text-muted">Aeronautical maintenance & readiness tier</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-[11px] font-sans text-aeron-lime font-semibold">
          Tier 3 • Chief Avionics Tech
        </span>
      </div>

      {/* Progress Metric */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-sans">
          <span className="text-text-secondary">System readiness integrity</span>
          <span className="text-aeron-lime font-mono font-bold">{readinessPct}% verified</span>
        </div>
        <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden border border-border/60">
          <div 
            className="h-full bg-gradient-to-r from-accent-soft to-aeron-lime transition-all duration-500 rounded-full shadow-[0_0_8px_#BFF42E]"
            style={{ width: `${readinessPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-text-muted font-sans">
          <span>{verifiedChecksCount} of {totalChecksCount} hardware tests passed</span>
          <span className="text-telemetry-cyan font-semibold">Streak: {activeStreak} days verified</span>
        </div>
      </div>

      {/* Engineering Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="p-3 bg-surface-elevated rounded-xl border border-border/80 flex flex-col items-center text-center hover:border-aeron-lime/40 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-aeron-lime/15 text-aeron-lime border border-aeron-lime/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">verified</span>
          </div>
          <span className="text-[11px] font-semibold text-text-primary mt-1.5 font-sans">Bus Certified</span>
          <span className="text-[10px] text-aeron-lime font-mono">I2C • SPI • CAN</span>
        </div>

        <div className="p-3 bg-surface-elevated rounded-xl border border-border/80 flex flex-col items-center text-center hover:border-telemetry-cyan/40 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-telemetry-cyan/15 text-telemetry-cyan border border-telemetry-cyan/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">speed</span>
          </div>
          <span className="text-[11px] font-semibold text-text-primary mt-1.5 font-sans">IMU Calibrated</span>
          <span className="text-[10px] text-telemetry-cyan font-mono">IMU & Mag 100%</span>
        </div>

        <div className="p-3 bg-surface-elevated rounded-xl border border-border/80 flex flex-col items-center text-center hover:border-caution-amber/40 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-caution-amber/15 text-caution-amber border border-caution-amber/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">battery_charging_full</span>
          </div>
          <span className="text-[11px] font-semibold text-text-primary mt-1.5 font-sans">Power Discipline</span>
          <span className="text-[10px] text-caution-amber font-mono">Failsafe tested</span>
        </div>

        <div className="p-3 bg-surface-elevated rounded-xl border border-border/80 flex flex-col items-center text-center hover:border-navigation-blue/40 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-navigation-blue/15 text-navigation-blue border border-navigation-blue/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">satellite_alt</span>
          </div>
          <span className="text-[11px] font-semibold text-text-primary mt-1.5 font-sans">GNSS Precision</span>
          <span className="text-[10px] text-navigation-blue font-mono">RTK sub-meter lock</span>
        </div>
      </div>

      <div className="text-[11px] text-text-muted font-sans flex items-center justify-between border-t border-border/60 pt-3">
        <span>Last audit: {auditFormattedDate} • {isOnline ? 'Bench linked' : 'Bench standby'}</span>
        <span className="text-aeron-lime font-mono font-semibold text-[10px]">ISO-21384-3</span>
      </div>
    </div>
  );
};
