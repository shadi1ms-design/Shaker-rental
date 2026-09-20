import React from 'react';
import { Car } from 'lucide-react';

interface VehicleImagePlaceholderProps {
  brand?: string;
  model?: string;
  className?: string;
}

export const VehicleImagePlaceholder: React.FC<VehicleImagePlaceholderProps> = ({
  brand,
  model,
  className = 'w-full h-full',
}) => {
  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 border border-slate-800/80 select-none ${className}`}
    >
      {/* Subtle grid pattern background */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(251, 191, 36, 0.3) 1px, transparent 0)`,
          backgroundSize: '16px 16px',
        }}
      />
      {/* Ambient gradient glow */}
      <div className="absolute w-32 h-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-900/90 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-black/60 mb-2">
          <Car className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400" strokeWidth={1.5} />
        </div>
        <span className="text-xs font-bold text-amber-400/90 font-mono tracking-wider">
          SHAKER FLEET
        </span>
        {brand && model ? (
          <span className="text-xs font-semibold text-slate-300 mt-0.5">
            {brand} {model}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 mt-0.5">
            سيارة معتمدة • أسطول دمشق
          </span>
        )}
      </div>
    </div>
  );
};
