import { VehicleStatus } from '../types';

export interface StatusMeta {
  label: string;
  badgeClass: string;
  dotClass: string;
}

export const BOOKING_STATUS_META: Record<string, StatusMeta> = {
  new: {
    label: 'طلب جديد',
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    dotClass: 'bg-amber-400',
  },
  reviewing: {
    label: 'قيد المراجعة',
    badgeClass: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    dotClass: 'bg-purple-400',
  },
  confirmed: {
    label: 'مؤكد',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
  rented: {
    label: 'جاري التأجير',
    badgeClass: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    dotClass: 'bg-blue-400',
  },
  completed: {
    label: 'مكتمل',
    badgeClass: 'bg-slate-800 text-slate-300 border border-slate-700',
    dotClass: 'bg-slate-400',
  },
  cancelled: {
    label: 'ملغي',
    badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    dotClass: 'bg-rose-400',
  },
  rejected: {
    label: 'مرفوض',
    badgeClass: 'bg-rose-950/60 text-rose-300 border border-rose-800/40',
    dotClass: 'bg-rose-500',
  },
};

export const VEHICLE_STATUS_META: Record<VehicleStatus, StatusMeta> = {
  available: {
    label: 'متاح للتأجير',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  reserved: {
    label: 'محجوز',
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
  rented: {
    label: 'مؤجر حالياً',
    badgeClass: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
  maintenance: {
    label: 'في الصيانة',
    badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    dotClass: 'bg-rose-400',
  },
  inactive: {
    label: 'معطل / غير نشط',
    badgeClass: 'bg-slate-800 text-slate-400 border border-slate-700',
    dotClass: 'bg-slate-500',
  },
};

export const USER_VERIFICATION_STATUS_META: Record<string, StatusMeta> = {
  verified: {
    label: 'موثق',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    dotClass: 'bg-emerald-400',
  },
  manual_review: {
    label: 'تدقيق يدوي',
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
  rejected: {
    label: 'مرفوض',
    badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    dotClass: 'bg-rose-400',
  },
  pending: {
    label: 'بانتظار الوثائق',
    badgeClass: 'bg-slate-800 text-slate-400 border border-slate-700',
    dotClass: 'bg-slate-500',
  },
};

