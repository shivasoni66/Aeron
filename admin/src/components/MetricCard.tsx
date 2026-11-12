import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  trend?: string;
  status?: 'normal' | 'active' | 'warning' | 'danger' | 'info';
  secondaryValue?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  icon,
  trend,
  status = 'normal',
  secondaryValue
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return 'text-aeron-lime';
      case 'warning':
        return 'text-caution-amber';
      case 'danger':
        return 'text-critical-coral';
      case 'info':
        return 'text-telemetry-cyan';
      default:
        return 'text-text-primary';
    }
  };

  const getIconTileStyle = () => {
    switch (status) {
      case 'active':
        return 'bg-aeron-lime/15 text-aeron-lime border-aeron-lime/30';
      case 'warning':
        return 'bg-caution-amber/15 text-caution-amber border-caution-amber/30';
      case 'danger':
        return 'bg-critical-coral/15 text-critical-coral border-critical-coral/30';
      case 'info':
        return 'bg-telemetry-cyan/15 text-telemetry-cyan border-telemetry-cyan/30';
      default:
        return 'bg-surface-elevated text-text-secondary border-border';
    }
  };

  const getBorderColor = () => {
    switch (status) {
      case 'active':
        return 'border-border hover:border-aeron-lime/50';
      case 'warning':
        return 'border-border hover:border-caution-amber/50';
      case 'danger':
        return 'border-border hover:border-critical-coral/50';
      case 'info':
        return 'border-border hover:border-telemetry-cyan/50';
      default:
        return 'border-border hover:border-border-subtle';
    }
  };

  return (
    <div className={`p-4 bg-surface rounded-xl border ${getBorderColor()} shadow-sm transition-all flex flex-col justify-between`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text-muted font-sans">
          {label}
        </span>
        {icon && (
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${getIconTileStyle()}`}>
            <span className="material-symbols-outlined text-[18px]">
              {icon}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 font-mono mt-1">
        <span className={`text-2xl font-extrabold tracking-tight ${getStatusColor()}`}>
          {value}
        </span>
        {unit && (
          <span className="text-xs text-text-muted font-normal uppercase">
            {unit}
          </span>
        )}
      </div>

      {(trend || secondaryValue) && (
        <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono text-text-muted">
          {trend && <span>{trend}</span>}
          {secondaryValue && <span className="text-text-secondary font-semibold">{secondaryValue}</span>}
        </div>
      )}
    </div>
  );
};
