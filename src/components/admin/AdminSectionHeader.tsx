import React from 'react';

interface AdminSectionHeaderProps {
  title: string;
  description?: string;
  count?: number;
  badgeText?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const AdminSectionHeader: React.FC<AdminSectionHeaderProps> = ({
  title,
  description,
  count,
  badgeText,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-6 ${className}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold text-white">
            {title}
          </h1>
          {typeof count === 'number' && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400">
              {count}
            </span>
          )}
          {badgeText && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300">
              {badgeText}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
