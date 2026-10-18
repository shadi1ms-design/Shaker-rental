/**
 * Server-Side Pricing Engine
 * 
 * Computes rental days with Damascus timezone (Asia/Damascus: UTC+3),
 * date + time boundaries (Math.ceil), insurance, dynamic member discount (0-25%),
 * and optional driver fee.
 */

export interface PricingServerSettings {
  insurance1to2Days?: number;
  insuranceAbove2Days?: number;
  insuranceShortTerm?: number;
  insuranceLongTerm?: number;
  driverDailyRate?: number;
  discountConfig?: {
    enabled?: boolean;
    percentage?: number;
    scope?: 'all' | 'specific';
    vehicleIds?: string[];
  };
}

export interface PricingCalculationResult {
  rentalDays: number;
  dailyPrice: number;
  basePrice: number;
  discountAmount: number;
  discountPercentage: number;
  insuranceAmount: number;
  driverFee: number;
  subtotal: number;
  totalPrice: number;
  explanation: string;
}

/**
 * Parses a date + time in Asia/Damascus timezone (UTC+3) and returns epoch ms.
 */
export function parseDamascusDateTime(dateStr: string, timeStr = '10:00'): number {
  const cleanDate = String(dateStr || '').trim();
  const cleanTime = String(timeStr || '10:00').trim();
  // Asia/Damascus operates on permanent UTC+3
  return new Date(`${cleanDate}T${cleanTime}:00+03:00`).getTime();
}

/**
 * Calculates rental days strictly using Asia/Damascus timestamps with Math.ceil.
 * Returns 0 or negative if return <= pickup.
 */
export function calculateRentalDaysDamascus(
  pickupDate: string,
  returnDate: string,
  pickupTime = '10:00',
  returnTime = '10:00'
): number {
  const pickupMs = parseDamascusDateTime(pickupDate, pickupTime);
  const returnMs = parseDamascusDateTime(returnDate, returnTime);

  if (isNaN(pickupMs) || isNaN(returnMs)) {
    return 1;
  }

  const diffMs = returnMs - pickupMs;
  if (diffMs <= 0) {
    return 0; // Invalid duration
  }

  const durationHours = diffMs / (1000 * 60 * 60);
  return Math.max(1, Math.ceil(durationHours / 24));
}

/**
 * Computes the authoritative rental price on the server.
 */
export function calculateRentalPriceServer(
  dailyPrice: number,
  rentalDaysInput: number,
  settings: PricingServerSettings | null | undefined,
  isUserLoggedIn: boolean,
  vehicleId?: string,
  withDriver = false
): PricingCalculationResult {
  const rentalDays = Math.max(1, Math.round(rentalDaysInput));
  const rawBase = rentalDays * Math.max(0, dailyPrice);

  let discountAmount = 0;
  let discountPercentage = 0;
  const discountCfg = settings?.discountConfig;

  if (discountCfg && discountCfg.enabled) {
    const rawPct = Number(discountCfg.percentage) || 0;
    const safePercentage = Math.min(25, Math.max(0, Math.round(rawPct)));

    const isVehicleMatched =
      discountCfg.scope === 'all' ||
      !discountCfg.vehicleIds ||
      discountCfg.vehicleIds.length === 0 ||
      (vehicleId ? discountCfg.vehicleIds.includes(vehicleId) : true);

    if (isVehicleMatched && safePercentage > 0 && isUserLoggedIn) {
      discountPercentage = safePercentage;
      discountAmount = Math.round(rawBase * (safePercentage / 100));
    }
  }

  const subtotal = Math.max(0, rawBase - discountAmount);

  // Insurance calculation: <= 2 days is short-term, > 2 days is long-term
  const insuranceAmount =
    rentalDays <= 2
      ? Number(settings?.insuranceShortTerm ?? settings?.insurance1to2Days ?? 500)
      : Number(settings?.insuranceLongTerm ?? settings?.insuranceAbove2Days ?? 300);

  // Driver fee calculation
  let driverFee = 0;
  if (withDriver) {
    const driverRate = Number(settings?.driverDailyRate ?? 40);
    driverFee = Math.max(0, driverRate * rentalDays);
  }

  const totalPrice = subtotal + insuranceAmount + driverFee;

  // Single clean Arabic explanation without duplication
  let explanation = `أجرة يومية (${dailyPrice}$ × ${rentalDays} يوم)`;
  if (discountAmount > 0) {
    explanation += ` • خصم الأعضاء (${discountPercentage}%: -$${discountAmount})`;
  }
  if (driverFee > 0) {
    explanation += ` • خدمة سائق خاص (${driverFee}$)`;
  }
  explanation += ` • تأمين مسترد (${insuranceAmount}$)`;

  return {
    rentalDays,
    dailyPrice,
    basePrice: rawBase,
    discountAmount,
    discountPercentage,
    insuranceAmount,
    driverFee,
    subtotal,
    totalPrice,
    explanation,
  };
}
