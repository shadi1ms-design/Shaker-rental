import React from 'react';
import { BOOKING_STATUS_META, VEHICLE_STATUS_META } from '../../constants/statusMeta';

interface StatusBadgeProps {
  status: string;
  type?: 'booking' | 'vehicle' | 'custom';
  customLabel?: string;
  customClass?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'booking',
  customLabel,
  customClass,
  size = 'sm',
}) => {
  let label = customLabel || status;
  let badgeClass = 'bg-slate-800 text-slate-300 border border-slate-700';
  let dotClass = 'bg-slate-400';

  if (type === 'booking') {
    const meta = BOOKING_STATUS_META[status];
    if (meta) {
      label = customLabel || meta.label;
      badgeClass = meta.badgeClass;
      dotClass = meta.dotClass;
    }
  } else if (type === 'vehicle') {
    const meta = VEHICLE_STATUS_META[status as any];
    if (meta) {
      label = customLabel || meta.label;
      badgeClass = meta.badgeClass;
      dotClass = meta.dotClass;
    }
  }

  if (customClass) {
    badgeClass = customClass;
  }

  const sizeClass = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2.5 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold font-cairo shadow-xs select-none transition-colors ${badgeClass} ${sizeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <span>{label}</span>
    </span>
  );
};
