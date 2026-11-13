import { VehicleStatus } from '../types';

export interface StatusMeta {
  label: string;
  badgeClass: string;
  dotClass: string;
}

export const BOOKING_STATUS_META: Record<string, StatusMeta> = {
  new: {
    label: 'طلب جديد',
    badgeClass: 'bg-status-new-bg text-status-new border border-status-new-border',
    dotClass: 'bg-status-new-dot',
  },
  reviewing: {
    label: 'قيد المراجعة',
    badgeClass: 'bg-status-reviewing-bg text-status-reviewing border border-status-reviewing-border',
    dotClass: 'bg-status-reviewing-dot',
  },
  confirmed: {
    label: 'مؤكد',
    badgeClass: 'bg-status-confirmed-bg text-status-confirmed border border-status-confirmed-border',
    dotClass: 'bg-status-confirmed-dot',
  },
  rented: {
    label: 'جاري التأجير',
    badgeClass: 'bg-status-rented-bg text-status-rented border border-status-rented-border',
    dotClass: 'bg-status-rented-dot',
  },
  completed: {
    label: 'مكتمل',
    badgeClass: 'bg-status-completed-bg text-status-completed border border-status-completed-border',
    dotClass: 'bg-status-completed-dot',
  },
  cancelled: {
    label: 'ملغي',
    badgeClass: 'bg-status-danger-bg text-status-danger border border-status-danger-border',
    dotClass: 'bg-status-danger-dot',
  },
  rejected: {
    label: 'مرفوض',
    badgeClass: 'bg-status-danger-bg text-status-danger border border-status-danger-border',
    dotClass: 'bg-status-danger-dot',
  },
};

export const VEHICLE_STATUS_META: Record<VehicleStatus, StatusMeta> = {
  available: {
    label: 'متاح للتأجير',
    badgeClass: 'bg-status-confirmed-bg text-status-confirmed border border-status-confirmed-border',
    dotClass: 'bg-status-confirmed-dot',
  },
  reserved: {
    label: 'محجوز',
    badgeClass: 'bg-status-new-bg text-status-new border border-status-new-border',
    dotClass: 'bg-status-new-dot',
  },
  rented: {
    label: 'مؤجر حالياً',
    badgeClass: 'bg-status-rented-bg text-status-rented border border-status-rented-border',
    dotClass: 'bg-status-rented-dot',
  },
  maintenance: {
    label: 'في الصيانة',
    badgeClass: 'bg-status-danger-bg text-status-danger border border-status-danger-border',
    dotClass: 'bg-status-danger-dot',
  },
  inactive: {
    label: 'معطل / غير نشط',
    badgeClass: 'bg-status-completed-bg text-status-completed border border-status-completed-border',
    dotClass: 'bg-status-completed-dot',
  },
};

export const USER_VERIFICATION_STATUS_META: Record<string, StatusMeta> = {
  verified: {
    label: 'موثق',
    badgeClass: 'bg-status-confirmed-bg text-status-confirmed border border-status-confirmed-border',
    dotClass: 'bg-status-confirmed-dot',
  },
  manual_review: {
    label: 'تدقيق يدوي',
    badgeClass: 'bg-status-new-bg text-status-new border border-status-new-border',
    dotClass: 'bg-status-new-dot',
  },
  rejected: {
    label: 'مرفوض',
    badgeClass: 'bg-status-danger-bg text-status-danger border border-status-danger-border',
    dotClass: 'bg-status-danger-dot',
  },
  pending: {
    label: 'بانتظار الوثائق',
    badgeClass: 'bg-status-completed-bg text-status-completed border border-status-completed-border',
    dotClass: 'bg-status-completed-dot',
  },
};
