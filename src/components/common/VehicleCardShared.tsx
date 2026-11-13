import React, { useState } from 'react';
import { VehicleStatus } from '../../types';
import { VEHICLE_STATUS_META } from '../../constants/statusMeta';
import { formatMoney } from '../../utils/format';
import { VehicleImagePlaceholder } from './VehicleImagePlaceholder';

interface VehicleStatusPillProps {
  status: VehicleStatus;
  nextAvailableDate?: string | null;
  pulseAvailable?: boolean;
  className?: string;
}

/**
 * Shared status badge for public and admin vehicle cards.
 */
export const VehicleStatusPill: React.FC<VehicleStatusPillProps> = ({
  status,
  nextAvailableDate,
  pulseAvailable = false,
  className = '',
}) => {
  const isAvailable = status === 'available';
  const isReservedOrRented = status === 'reserved' || status === 'rented';

  if (isReservedOrRented && nextAvailableDate !== undefined) {
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-md bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap shrink-0 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
        <span>
          {nextAvailableDate ? `متاحة بدءاً من ${nextAvailableDate}` : 'محجوزة حالياً'}
        </span>
      </span>
    );
  }

  const meta = VEHICLE_STATUS_META[status] || VEHICLE_STATUS_META.available;

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-md whitespace-nowrap shrink-0 ${meta.badgeClass} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass} ${
          pulseAvailable && isAvailable ? 'animate-pulse' : ''
        }`}
      />
      <span>{meta.label}</span>
    </span>
  );
};

interface VehicleDailyPriceTagProps {
  dailyPrice: number;
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * Shared daily price display with tabular Latin numerals.
 */
export const VehicleDailyPriceTag: React.FC<VehicleDailyPriceTagProps> = ({
  dailyPrice,
  size = 'lg',
  className = '',
}) => {
  if (size === 'sm') {
    return (
      <span className={`font-bold text-amber-400 font-mono tabular-nums ${className}`}>
        {formatMoney(dailyPrice)} <span className="text-xs text-slate-400 font-sans font-normal">/ يوم</span>
      </span>
    );
  }

  return (
    <div className={`text-end shrink-0 ${className}`}>
      <span className="text-xl sm:text-2xl font-extrabold text-amber-400 tabular-nums">
        {formatMoney(dailyPrice)}
      </span>
      <span className="text-sm text-slate-400 block font-normal">/ يوم</span>
    </div>
  );
};

interface VehicleSingleImageFrameProps {
  imageUrl?: string;
  brand: string;
  model: string;
  className?: string;
  imgClassName?: string;
  children?: React.ReactNode;
}

/**
 * Shared 16:10 single-image container with fallback placeholder and overlay slot.
 */
export const VehicleSingleImageFrame: React.FC<VehicleSingleImageFrameProps> = ({
  imageUrl,
  brand,
  model,
  className = 'aspect-[16/10] w-full bg-slate-950 overflow-hidden',
  imgClassName = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300',
  children,
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {!imageError && imageUrl ? (
        <img
          src={imageUrl}
          alt={`${brand} ${model}`}
          loading="lazy"
          decoding="async"
          onError={() => setImageError(true)}
          className={imgClassName}
        />
      ) : (
        <VehicleImagePlaceholder brand={brand} model={model} />
      )}
      {children}
    </div>
  );
};
