import { VehicleCategory } from '../types';

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  light: 'اقتصادي',
  medium: 'متوسط',
  jeep_7seats: 'جيب 7 مقاعد',
};

export const VEHICLE_CATEGORY_DESCRIPTIONS: Record<VehicleCategory, string> = {
  light: 'سيارات سيدان مدمجة واقتصادية في استهلاك الوقود',
  medium: 'سيارات سيدان فسيحة ومريحة للرحلات اليومية ورجال الأعمال',
  jeep_7seats: 'سيارات دفع رباعي وجيب عائلي فسيح يتسع لـ 7 ركاب',
};

export const getVehicleCategoryLabel = (category?: string | null): string => {
  if (!category) return 'غير محدد';
  if (category === 'suv') return VEHICLE_CATEGORY_LABELS.jeep_7seats;
  if (category in VEHICLE_CATEGORY_LABELS) {
    return VEHICLE_CATEGORY_LABELS[category as VehicleCategory];
  }
  return category;
};
