import { VehicleCategory, AppSettings, PricingCalculation } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'global_settings',
  companyName: 'شاكر لتأجير السيارات',
  companyNameEn: 'Shaker Car Rental',
  companyPhone: '00963944331774',
  whatsappNumber: '00963944331774',
  address: 'دمشق – جرمانا، شارع الخضر',
  currency: '$',
  insurance1to2Days: 500,
  insuranceAbove2Days: 300,
  insuranceShortTerm: 500,
  insuranceLongTerm: 300,
  weeklyDiscountPerDay: 5,
  discountConfig: {
    enabled: true,
    percentage: 10,
    scope: 'all',
    vehicleIds: [],
    title: 'خصم خاص للأعضاء المسجلين',
  },
  monthlyRateLight: 800,
  monthlyRateMedium: 1200,
  monthlyRateJeep: 1500,
  oilChangeIntervalKm: 5000,
  rentalTerms: `1. يلتزم المستأجر بالمحافظة على السيارة وإعادتها بنفس الحالة التي استلمها بها.
2. يتم سداد التأمين المسترد نقداً أو بتحويل بنكي عند استلام السيارة ويُعاد فور فحص السيارة بعد الإرجاع.
3. يحظر استخدام السيارة لأغراض السباقات أو التدريب أو نقل المواد المحظورة أو قيادتها خارج الحدود المصرح بها.
4. يلتزم المستأجر بتزويد السيارة بالوقود المطابق للمواصفات وتحمل تكاليف المخالفات المرورية المسجلة خلال فترة التأجير.
5. في حال وقوع حادث لا قدر الله، يجب إبلاغ الشركة فوراً والحصول على تقرير شرطة المرور الرسمي.
6. كل تأخير في تسليم السيارة عن الموعد المحدد يُحسب بسعر ساعة إضافي يعادل 15% من الأجرة اليومية.`,
  updatedAt: new Date().toISOString(),
};

/**
 * Calculates the number of calendar rental days between two dates.
 * Minimum is 1 day.
 */
export function calculateRentalDays(pickupDateStr: string, returnDateStr: string): number {
  if (!pickupDateStr || !returnDateStr) return 1;
  const start = new Date(pickupDateStr);
  const end = new Date(returnDateStr);
  if (end < start) {
    return 0;
  }
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Centralized Pricing Engine
 *
 * System 1 (Duration/Period-based Discount) has been CANCELLED as requested.
 * All bookings are priced based on the daily rental rate (days × dailyPrice).
 *
 * System 2 (Dynamic Member Account Discount 1% - 25%) is ACTIVE:
 *   - Configurable percentage from AppSettings (1% to 25%)
 *   - Applies to all cars or specific vehicle IDs
 *   - Strictly requires authentication (logged-in user)
 */
export function calculateRentalPrice(
  category: VehicleCategory,
  dailyPrice: number,
  days: number,
  settings: AppSettings = DEFAULT_SETTINGS,
  options?: {
    isUserLoggedIn?: boolean;
    vehicleId?: string;
  }
): PricingCalculation {
  const rentalDays = Math.max(1, Math.round(days));
  const rawBase = rentalDays * dailyPrice;

  // Duration/Period discount is cancelled as requested
  const durationDiscountAmount = 0;
  const durationDiscountType: 'none' | 'weekly' | 'monthly' | 'proportional' = 'none';
  const durationDiscountDescription = '';
  const subtotalAfterDuration = rawBase;

  // --- ACTIVE DISCOUNT SYSTEM: Dynamic Member Account Discount (1% - 25%, requires login) ---
  const discountCfg = settings.discountConfig;
  let memberDiscountEligible = false;
  let memberDiscountApplied = false;
  let memberDiscountPercentage = 0;
  let potentialMemberSavings = 0;
  let memberDiscountAmount = 0;

  if (discountCfg && discountCfg.enabled) {
    const rawPct = Number(discountCfg.percentage) || 0;
    const safePercentage = Math.min(25, Math.max(1, Math.round(rawPct)));

    // Check if this vehicle is eligible:
    // If scope === 'all', all vehicles are eligible.
    // If scope === 'specific', check if options.vehicleId is in discountCfg.vehicleIds
    const isVehicleMatched =
      discountCfg.scope === 'all' ||
      !discountCfg.vehicleIds ||
      discountCfg.vehicleIds.length === 0 ||
      (options?.vehicleId ? discountCfg.vehicleIds.includes(options.vehicleId) : true);

    if (isVehicleMatched && safePercentage > 0) {
      memberDiscountEligible = true;
      memberDiscountPercentage = safePercentage;
      potentialMemberSavings = Math.round(rawBase * (safePercentage / 100));

      // Strictly require authentication to apply the member discount
      if (options?.isUserLoggedIn) {
        memberDiscountApplied = true;
        memberDiscountAmount = potentialMemberSavings;
      }
    }
  }

  // Final subtotal and total discount
  const finalSubtotal = Math.max(0, rawBase - memberDiscountAmount);
  const totalDiscountAmount = memberDiscountAmount;

  // Clear human-readable explanation
  let explanation = `سعر يومي (${dailyPrice}$ × ${rentalDays} يوم)`;
  if (memberDiscountApplied && memberDiscountAmount > 0) {
    explanation += ` • خصم الأعضاء (${memberDiscountPercentage}%: -$${memberDiscountAmount})`;
  }

  if (memberDiscountApplied && memberDiscountAmount > 0) {
    explanation += ` • خصم الأعضاء (${memberDiscountPercentage}%: -$${memberDiscountAmount})`;
  }

  // Insurance calculation rule:
  // 1 or 2 days: $500
  // More than 2 days: $300
  const insuranceAmount =
    rentalDays <= 2
      ? settings.insuranceShortTerm ?? settings.insurance1to2Days ?? 500
      : settings.insuranceLongTerm ?? settings.insuranceAbove2Days ?? 300;

  const totalPrice = finalSubtotal + insuranceAmount;

  return {
    rentalDays,
    dailyPrice,
    basePrice: rawBase,
    discountAmount: totalDiscountAmount,
    durationDiscountAmount,
    durationDiscountType,
    durationDiscountDescription,
    memberDiscountAmount,
    memberDiscountPercentage,
    memberDiscountEligible,
    memberDiscountApplied,
    potentialMemberSavings,
    insuranceAmount,
    subtotal: finalSubtotal,
    totalPrice,
    pricingType: durationDiscountType === 'none' ? 'daily' : durationDiscountType,
    explanation,
  };
}

/**
 * Format currency with Arabic locale and USD symbol
 */
export function formatCurrency(amount: number, currency = '$'): string {
  return `${amount.toLocaleString('ar-SY')} ${currency}`;
}
