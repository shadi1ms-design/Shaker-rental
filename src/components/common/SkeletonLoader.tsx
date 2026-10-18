import React from 'react';

interface SkeletonLoaderProps {
  lines?: number;
  type?: 'card' | 'table' | 'text';
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  lines = 4,
  type = 'text',
  className = '',
}) => {
  if (type === 'card') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-slate-800 rounded-md w-1/3" />
              <div className="w-8 h-8 rounded-xl bg-slate-800" />
            </div>
            <div className="h-8 bg-slate-800 rounded-lg w-1/2" />
            <div className="h-3 bg-slate-800 rounded-md w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 animate-pulse ${className}`}>
        <div className="h-10 bg-slate-950 rounded-xl" />
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-800/40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-slate-800/60 rounded-md"
          style={{ width: `${Math.max(40, 100 - i * 15)}%` }}
        />
      ))}
    </div>
  );
};
