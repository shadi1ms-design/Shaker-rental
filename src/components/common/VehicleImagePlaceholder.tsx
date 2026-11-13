import React from 'react';
import { Car } from 'lucide-react';

interface VehicleImagePlaceholderProps {
  className?: string;
  brand?: string;
  model?: string;
}

export const VehicleImagePlaceholder: React.FC<VehicleImagePlaceholderProps> = ({
  className = 'w-full h-full min-h-[160px]',
  brand,
  model,
}) => {
  return (
    <div
      className={`bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 border border-slate-800/80 flex flex-col items-center justify-center p-4 text-slate-400 relative overflow-hidden select-none group-hover:border-amber-500/30 transition-colors ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative z-10 w-14 h-14 rounded-card bg-slate-900/90 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 shadow-lg shadow-black/50 group-hover:scale-105 transition-transform">
        <Car className="w-7 h-7" strokeWidth={1.6} />
      </div>
      <span className="relative z-10 text-xs font-bold text-slate-300 text-center truncate max-w-full">
        {brand || model ? `${brand || ''} ${model || ''}`.trim() : 'لا تتوفر صورة للسيارة'}
      </span>
      <span className="relative z-10 text-xs text-slate-400 mt-0.5">
        أسطول شركة شاكر
      </span>
    </div>
  );
};
