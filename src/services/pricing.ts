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
  driverDailyRate: 40,
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
  rentalTerms: `1. يلتزم المستأجر بالمحافظة على السيارة وإعادتها بنفس الحالة التي استلمها بها.
2. يتم سداد التأمين المسترد نقداً أو بتحويل بنكي عند استلام السيارة ويُعاد فور فحص السيارة بعد الإرجاع.
3. يحظر استخدام السيارة لأغراض السباقات أو التدريب أو نقل المواد المحظورة أو قيادتها خارج الحدود المصرح بها.
4. يلتزم المستأجر بتزويد السيارة بالوقود المطابق للمواصفات وتحمل تكاليف المخالفات المرورية المسجلة خلال فترة التأجير.
5. في حال وقوع حادث لا قدر الله، يجب إبلاغ الشركة فوراً والحصول على تقرير شرطة المرور الرسمي.
6. كل تأخير في تسليم السيارة عن الموعد المحدد يُحسب بسعر ساعة إضافي يعادل 15% من الأجرة اليومية.`,
  updatedAt: new Date().toISOString(),
};

/**
 * Calculates rental days strictly using Asia/Damascus timezone (+03:00) with Math.ceil.
 * Rejects return <= pickup (returns 0).
 */
export function calculateRentalDays(
  pickupDateStr: string,
  returnDateStr: string,
  pickupTimeStr = '10:00',
  returnTimeStr = '10:00'
): number {
  if (!pickupDateStr || !returnDateStr) return 1;

  const pTime = pickupTimeStr || '10:00';
  const rTime = returnTimeStr || '10:00';

  const pickupMs = new Date(`${pickupDateStr}T${pTime}:00+03:00`).getTime();
  const returnMs = new Date(`${returnDateStr}T${rTime}:00+03:00`).getTime();

  if (isNaN(pickupMs) || isNaN(returnMs)) return 1;

  const diffMs = returnMs - pickupMs;
  if (diffMs <= 0) return 0; // Reject return <= pickup

  const hours = diffMs / (1000 * 60 * 60);
  return Math.max(1, Math.ceil(hours / 24));
}

/**
 * Centralized Pricing Engine (Frontend & Shared UI)
 */
export function calculateRentalPrice(
  category: VehicleCategory,
  dailyPrice: number,
  days: number,
  settings: AppSettings = DEFAULT_SETTINGS,
  options?: {
    isUserLoggedIn?: boolean;
    vehicleId?: string;
    vehicleDocId?: string;
    vehicleDataId?: string;
    withDriver?: boolean;
  }
): PricingCalculation {
  const rentalDays = Math.max(1, Math.round(days));
  const rawBase = rentalDays * Math.max(0, dailyPrice);

  const durationDiscountAmount = 0;
  const durationDiscountType: 'none' | 'weekly' | 'monthly' | 'proportional' = 'none';
  const durationDiscountDescription = '';

  // Dynamic Member Discount (0-25%)
  const discountCfg = settings.discountConfig;
  let memberDiscountEligible = false;
  let memberDiscountApplied = false;
  let memberDiscountPercentage = 0;
  let potentialMemberSavings = 0;
  let memberDiscountAmount = 0;

  if (discountCfg && discountCfg.enabled) {
    const rawPct = Number(discountCfg.percentage) || 0;
    // Treats 0 as no discount, matching server logic
    const safePercentage = Math.min(25, Math.max(0, Math.round(rawPct)));

    const candidateIds = new Set<string>();
    if (options?.vehicleId) candidateIds.add(String(options.vehicleId).trim());
    if (options?.vehicleDocId) candidateIds.add(String(options.vehicleDocId).trim());
    if (options?.vehicleDataId) candidateIds.add(String(options.vehicleDataId).trim());

    // Matches vehicleId with both doc id and data.id
    const isVehicleMatched =
      discountCfg.scope === 'specific'
        ? Boolean(
            discountCfg.vehicleIds &&
            discountCfg.vehicleIds.length > 0 &&
            candidateIds.size > 0 &&
            discountCfg.vehicleIds.some((id) => candidateIds.has(String(id).trim()))
          )
        : true;

    if (isVehicleMatched && safePercentage > 0) {
      memberDiscountEligible = true;
      memberDiscountPercentage = safePercentage;
      potentialMemberSavings = Math.round(rawBase * (safePercentage / 100));

      if (options?.isUserLoggedIn) {
        memberDiscountApplied = true;
        memberDiscountAmount = potentialMemberSavings;
      }
    }
  }

  const finalSubtotal = Math.max(0, rawBase - memberDiscountAmount);

  // Insurance calculation rule
  const insuranceAmount =
    rentalDays <= 2
      ? settings.insuranceShortTerm ?? settings.insurance1to2Days ?? 500
      : settings.insuranceLongTerm ?? settings.insuranceAbove2Days ?? 300;

  // Driver fee calculation
  let driverFee = 0;
  if (options?.withDriver) {
    const rate = Number(settings.driverDailyRate ?? 40);
    driverFee = rate * rentalDays;
  }

  const totalPrice = finalSubtotal + insuranceAmount + driverFee;

  // Single clean Arabic explanation without duplication
  let explanation = `أجرة يومية (${dailyPrice}$ × ${rentalDays} يوم)`;
  if (memberDiscountApplied && memberDiscountAmount > 0) {
    explanation += ` • خصم الأعضاء (${memberDiscountPercentage}%: -$${memberDiscountAmount})`;
  }
  if (driverFee > 0) {
    explanation += ` • خدمة سائق خاص (${driverFee}$)`;
  }
  explanation += ` • تأمين مسترد (${insuranceAmount}$)`;

  return {
    rentalDays,
    dailyPrice,
    basePrice: rawBase,
    discountAmount: memberDiscountAmount,
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
    pricingType: 'daily',
    explanation,
  };
}

export function formatCurrency(amount: number, currency = '$'): string {
  return `${amount.toLocaleString('ar-SY')} ${currency}`;
}
