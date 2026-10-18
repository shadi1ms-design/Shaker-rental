import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  iconColor?: string;
  valueColor?: string;
  onClick?: () => void;
  badge?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  iconColor = 'text-amber-400',
  valueColor = 'text-white',
  onClick,
  badge,
  className = '',
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-2 transition-all shadow-md ${
        isClickable
          ? 'hover:border-amber-500/40 hover:bg-slate-800/50 cursor-pointer active:scale-[0.99] group'
          : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between text-slate-400 text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
            <Icon className={`w-4 h-4 ${iconColor} transition-transform ${isClickable ? 'group-hover:scale-110' : ''}`} />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${valueColor}`}>
          {value}
        </span>
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {badge}
          </span>
        )}
      </div>

      {subtext && (
        <p className="text-[11px] text-slate-400 font-medium truncate">
          {subtext}
        </p>
      )}
    </div>
  );
};
