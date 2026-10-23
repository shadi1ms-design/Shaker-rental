import React from 'react';
import { motion } from 'motion/react';
import type { Vehicle } from '../../types';
import { VehicleImageCarousel } from '../common/VehicleImageCarousel';
import { getItemVariants } from '../../constants/motion';

interface FeaturedVehicleCardProps {
  vehicle: Vehicle;
  onViewDetails: (vehicle: Vehicle) => void;
  onBook: (vehicle: Vehicle) => void;
}

/** One vehicle card in the "featured fleet" grid of the home page. */
export const FeaturedVehicleCard: React.FC<FeaturedVehicleCardProps> = ({ vehicle, onViewDetails, onBook }) => {
  return (
    <motion.div
      variants={getItemVariants()}
      whileHover={{ scale: 1.01 }}
      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden transition-colors duration-300 hover:shadow-2xl hover:shadow-amber-500/5 group flex flex-col justify-between"
    >
      <div>
        {/* Image gallery (swipe between photos) */}
        <VehicleImageCarousel vehicle={vehicle} className="aspect-[4/3] sm:aspect-[16/10]">
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-950/85 text-[11px] font-bold text-amber-400 border border-amber-500/40 shadow-md">
            {vehicle.category === 'light'
              ? 'اقتصادي (Light)'
              : vehicle.category === 'medium'
              ? 'سيدان متوسط (Medium)'
              : 'جيب عائلي 7 ركاب'}
          </div>
          {vehicle.status === 'available' && (
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md bg-emerald-950/90 text-emerald-300 border border-emerald-500/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>متاحة الآن</span>
              </span>
            </div>
          )}
        </VehicleImageCarousel>

        {/* Content Info */}
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold">{vehicle.brand}</span>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                {vehicle.model} ({vehicle.year})
              </h3>
            </div>
            <div className="text-left">
              <span className="text-2xl font-black text-amber-400 font-mono">
                ${vehicle.dailyPrice}
              </span>
              <span className="text-[11px] text-slate-400 block font-medium">/ اليوم</span>
            </div>
          </div>

          {/* Badges */}
          <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/80 text-center text-slate-400 text-xs">
            <div>
              <span className="block text-[10px] text-slate-500">ناقل الحركة</span>
              <span className="font-semibold text-slate-200">
                {vehicle.transmission === 'automatic' ? 'أوتوماتيك' : 'عادي'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">المقاعد</span>
              <span className="font-semibold text-slate-200">{vehicle.seats} ركاب</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">الوقود</span>
              <span className="font-semibold text-slate-200">
                {vehicle.fuelType === 'petrol'
                  ? 'بنزين'
                  : vehicle.fuelType === 'hybrid'
                  ? 'هايبرد'
                  : vehicle.fuelType === 'diesel'
                  ? 'ديزل'
                  : 'كهرباء'}
              </span>
            </div>
          </div>

          {/* Features chips */}
          <div className="flex flex-wrap gap-1.5">
            {vehicle.features.slice(0, 3).map((feat, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onViewDetails(vehicle)}
          className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-[0.97] cursor-pointer"
        >
          تفاصيل السيارة
        </button>
        <button
          type="button"
          onClick={() => onBook(vehicle)}
          className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 active:scale-[0.97] cursor-pointer"
        >
          احجز الآن
        </button>
      </div>
    </motion.div>
  );
};
