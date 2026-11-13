export const DEFAULT_OIL_CHANGE_INTERVAL_KM = 5000;
export const OIL_CHANGE_SOON_THRESHOLD_KM = 500;

export type OilChangeStatus = 'ok' | 'soon' | 'overdue';

export interface OilChangeInput {
  currentMileage?: number | null;
  lastOilChangeMileage?: number | null;
  oilChangeIntervalKm?: number | null;
}

export interface OilChangeSummary {
  currentMileage: number;
  lastOilChangeMileage: number;
  oilChangeIntervalKm: number;
  nextOilChangeMileage: number;
  remainingKm: number;
  status: OilChangeStatus;
  label: string;
  needsAttention: boolean;
}

/**
 * Pure function to calculate oil change status and remaining kilometers for a vehicle.
 * Formula: remainingKm = lastOilChangeMileage + oilChangeIntervalKm - currentMileage
 * Status:
 * - 'overdue': remainingKm < 0
 * - 'soon': 0 <= remainingKm < 500
 * - 'ok': remainingKm >= 500
 */
export function calculateOilChange(input: OilChangeInput): OilChangeSummary {
  const rawCurrent = Number(input.currentMileage ?? 0);
  const currentMileage = Number.isFinite(rawCurrent) && rawCurrent >= 0 ? Math.round(rawCurrent) : 0;

  const rawLast = Number(input.lastOilChangeMileage ?? 0);
  const lastOilChangeMileage = Number.isFinite(rawLast) && rawLast >= 0 ? Math.round(rawLast) : 0;

  const rawInterval = Number(input.oilChangeIntervalKm);
  const oilChangeIntervalKm =
    Number.isFinite(rawInterval) && rawInterval > 0
      ? Math.round(rawInterval)
      : DEFAULT_OIL_CHANGE_INTERVAL_KM;

  const nextOilChangeMileage = lastOilChangeMileage + oilChangeIntervalKm;
  const remainingKm = nextOilChangeMileage - currentMileage;

  let status: OilChangeStatus = 'ok';
  let label = 'الزيت جيد';

  if (remainingKm < 0) {
    status = 'overdue';
    label = `تجاوز بـ ${Math.abs(remainingKm).toLocaleString('en-US')} كم`;
  } else if (remainingKm < OIL_CHANGE_SOON_THRESHOLD_KM) {
    status = 'soon';
    label = `تغيير قريب (${remainingKm.toLocaleString('en-US')} كم)`;
  } else {
    status = 'ok';
    label = `متبقي ${remainingKm.toLocaleString('en-US')} كم`;
  }

  return {
    currentMileage,
    lastOilChangeMileage,
    oilChangeIntervalKm,
    nextOilChangeMileage,
    remainingKm,
    status,
    label,
    needsAttention: status === 'soon' || status === 'overdue',
  };
}
