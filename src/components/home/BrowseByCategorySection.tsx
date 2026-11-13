import React from 'react';
import { motion } from 'motion/react';
import { Car, CarFront, Truck, Users, ArrowLeft } from 'lucide-react';
import { Vehicle, VehicleCategory } from '../../types';
import {
  VEHICLE_CATEGORY_LABELS,
  VEHICLE_CATEGORY_DESCRIPTIONS,
} from '../../constants/vehicleCategories';
import { getItemVariants } from '../../constants/motion';
import { navigate, routes } from '../../router';
import { useAppData } from '../../contexts/DataContext';

interface BrowseByCategorySectionProps {
  vehicles: Vehicle[];
}

const CATEGORY_META: Record<
  VehicleCategory,
  {
    icon: React.ComponentType<{ className?: string }>;
    seatsLabel: string;
  }
> = {
  light: {
    icon: Car,
    seatsLabel: '5 ركاب',
  },
  medium: {
    icon: CarFront,
    seatsLabel: '5 ركاب',
  },
  jeep_7seats: {
    icon: Truck,
    seatsLabel: '7 ركاب',
  },
};

export const BrowseByCategorySection: React.FC<BrowseByCategorySectionProps> = ({ vehicles }) => {
  const { activeBookingFilters, setActiveBookingFilters } = useAppData();
  const categories: VehicleCategory[] = ['light', 'medium', 'jeep_7seats'];

  const getAvailableCount = (cat?: VehicleCategory) => {
    if (!cat) {
      return vehicles.filter((v) => v.status === 'available').length;
    }
    return vehicles.filter((v) => v.category === cat && v.status === 'available').length;
  };

  const handleSelect = (cat?: VehicleCategory) => {
    if (!cat) {
      setActiveBookingFilters(undefined);
    } else {
      setActiveBookingFilters({ category: cat });
    }
    navigate(routes.cars);
  };

  const currentCategory = activeBookingFilters?.category;

  return (
    <motion.section variants={getItemVariants()} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white">تصفح حسب الفئة</h2>
          <p className="text-sm text-slate-400 mt-0.5">اختر الفئة المناسبة لرحلتك وعدد الركاب</p>
        </div>

        <button
          type="button"
          onClick={() => handleSelect(undefined)}
          className="min-h-11 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-amber-400 font-bold text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span>جميع الفئات</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-xs font-mono tabular-nums">
            {getAvailableCount()} متاح
          </span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const count = getAvailableCount(cat);
          const isActive = currentCategory === cat;
          const { icon: Icon, seatsLabel } = CATEGORY_META[cat];

          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleSelect(cat)}
              className={`text-start rounded-card p-5 border transition-all flex flex-col justify-between gap-3 cursor-pointer min-h-[44px] ${
                isActive
                  ? 'bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-900/90 hover:bg-slate-900 border-slate-800 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3 w-full">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{VEHICLE_CATEGORY_LABELS[cat]}</h3>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-300 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>{seatsLabel}</span>
                    </span>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-bold tabular-nums shrink-0">
                  {count} متاح
                </span>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                {VEHICLE_CATEGORY_DESCRIPTIONS[cat]}
              </p>
            </button>
          );
        })}
      </div>
    </motion.section>
  );
};
