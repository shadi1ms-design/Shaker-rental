import React from 'react';
import { motion } from 'motion/react';
import { Vehicle } from '../../types';
import { VehicleImageCarousel } from './VehicleImageCarousel';
import { VehicleStatusPill, VehicleDailyPriceTag } from './VehicleCardShared';
import { getVehicleCategoryLabel } from '../../constants/vehicleCategories';
import { getFuelLabel, getTransmissionLabel } from '../../constants/vehicleLabels';
import { isPrefersReducedMotion } from '../../constants/motion';
import { Link } from '../routing/Link';
import { routes } from '../../router';
import { Users, Settings, Fuel, Calendar, Info, Clock } from 'lucide-react';

interface VehicleCardProps {
  vehicle: Vehicle;
  variant?: 'featured' | 'catalog';
  onViewDetails?: (vehicle: Vehicle) => void;
  onBook?: (vehicle: Vehicle) => void;
  bookTo?: string;
  nextAvailableDate?: string | null;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  variant = 'catalog',
  onViewDetails,
  onBook,
  bookTo,
  nextAvailableDate,
}) => {
  const isAvailable = vehicle.status === 'available';
  const isReservedOrRented = vehicle.status === 'reserved' || vehicle.status === 'rented';
  const detailsUrl = routes.car(vehicle.id);
  const bookUrl = bookTo || routes.book(vehicle.id);

  return (
    <motion.div
      whileHover={isPrefersReducedMotion() ? undefined : { scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={`rounded-card overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/50 flex flex-col h-full group border ${
        variant === 'featured'
          ? 'bg-slate-900 border-amber-500/25 hover:border-amber-500/45 shadow-lg shadow-black/40 w-[85vw] max-w-[340px] sm:w-[320px] md:w-full shrink-0 snap-start'
          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Car Image gallery */}
      <VehicleImageCarousel vehicle={vehicle} className="aspect-[16/10] object-cover">
        {/* Category Badge */}
        <div className="absolute top-3 end-3 shrink-0 z-10">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-950/90 text-amber-400 border border-amber-500/40 shadow-md whitespace-nowrap shrink-0">
            {getVehicleCategoryLabel(vehicle.category)}
          </span>
        </div>

        {/* Status Badge */}
        <div className="absolute top-3 start-3 shrink-0 z-10">
          <VehicleStatusPill
            status={vehicle.status}
            nextAvailableDate={isReservedOrRented ? (nextAvailableDate ?? null) : undefined}
            pulseAvailable
          />
        </div>
      </VehicleImageCarousel>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand, Model, Year, Price */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <span className="text-sm text-slate-400 font-semibold block">{vehicle.brand}</span>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                {vehicle.model}
              </h3>
              <span className="text-sm text-slate-400 block mt-0.5 truncate tabular-nums">
                موديل {vehicle.year} • {vehicle.color}
              </span>
            </div>
            <VehicleDailyPriceTag dailyPrice={vehicle.dailyPrice} size="lg" />
          </div>

          {/* 3 Spec Icons */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 py-3 border-y border-slate-800/80 my-3 text-sm text-slate-300">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="tabular-nums">{vehicle.seats} ركاب</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{getTransmissionLabel(vehicle.transmission)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Fuel className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{getFuelLabel(vehicle.fuelType)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons pinned at bottom */}
        <div className="flex items-center gap-2 pt-2 mt-auto">
          <Link
            to={detailsUrl}
            prefetch
            onClick={onViewDetails ? () => onViewDetails(vehicle) : undefined}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Info className="w-4 h-4 text-slate-400" />
            <span>التفاصيل</span>
          </Link>

          {isAvailable ? (
            <Link
              to={bookUrl}
              prefetch
              onClick={onBook ? () => onBook(vehicle) : undefined}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-extrabold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Calendar className="w-4 h-4" />
              <span>احجز الآن</span>
            </Link>
          ) : isReservedOrRented ? (
            <Link
              to={bookUrl}
              prefetch
              onClick={onBook ? () => onBook(vehicle) : undefined}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-sm font-bold transition-all flex items-center justify-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              title={nextAvailableDate ? `متاحة بدءاً من ${nextAvailableDate} - انقر لإجراء حجز مسبق` : 'محجوزة حالياً - انقر لإجراء حجز مسبق'}
            >
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>حجز مسبق</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-800/80 text-rose-300 text-sm font-bold flex items-center justify-center gap-1 border border-rose-500/20 cursor-not-allowed opacity-90"
              title="السيارة قيد الصيانة الدورية أو خارج الخدمة حالياً"
            >
              <Clock className="w-4 h-4 text-rose-400" />
              <span>في الصيانة</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
