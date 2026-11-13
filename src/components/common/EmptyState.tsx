import React from 'react';
import { LucideIcon, FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = FolderOpen,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-card p-12 text-center text-sm text-slate-400 space-y-4 shadow-xl ${className}`}
    >
      <div className="w-16 h-16 rounded-card bg-slate-950 border border-slate-800 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>

      <div className="space-y-1.5 max-w-sm mx-auto">
        <h3 className="font-bold text-base text-white">{title}</h3>
        {description && <p className="text-slate-400 text-sm leading-relaxed">{description}</p>}
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2.5 min-h-11 inline-flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
