export const FUEL_LABEL: Record<string, string> = {
  petrol: 'بنزين',
  diesel: 'ديزل',
  hybrid: 'هايبرد',
  electric: 'كهرباء',
};

export const TRANSMISSION_LABEL: Record<string, string> = {
  automatic: 'أوتوماتيك',
  manual: 'عادي',
};

import { VEHICLE_CATEGORY_LABELS } from './vehicleCategories';

export const CATEGORY_LABEL: Record<string, string> = VEHICLE_CATEGORY_LABELS;

export const getFuelLabel = (fuel?: string | null): string => {
  if (!fuel) return 'بنزين';
  return FUEL_LABEL[fuel.toLowerCase()] || fuel;
};

export const getTransmissionLabel = (trans?: string | null): string => {
  if (!trans) return 'أوتوماتيك';
  return TRANSMISSION_LABEL[trans.toLowerCase()] || trans;
};
