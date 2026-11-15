import { VehicleCategory, AppSettings, PricingCalculation } from '../types';
import { resolveMemberDiscount } from '../shared/discount';
import { COMPANY_INFO } from '../constants/company';

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'global_settings',
  companyName: COMPANY_INFO.name,
  companyNameEn: COMPANY_INFO.nameEn,
  companyPhone: COMPANY_INFO.phoneRaw,
  whatsappNumber: COMPANY_INFO.phoneRaw,
  address: COMPANY_INFO.location,
  currency: '$',
  insurance1to2Days: 500,
  insuranceAbove2Days: 300,
  insuranceShortTerm: 500,
  insuranceLongTerm: 300,
  driverDailyRate: 40,
  discountConfig: {
    enabled: false,
    percentage: 0,
    scope: 'all',
    vehicleIds: [],
    title: 'خصم خاص للأعضاء المسجلين',
  },
  monthlyRateLight: 800,
  monthlyRateMedium: 1200,
  monthlyRateJeep: 1500,
  rentalTerms: `1. يلتزم المستأجر بإعادة المركبة في التاريخ والوقت المحددين بحالتها المستلمة.
2. المركبة مخصصة للاستخدام الشخصي داخل الأراضي السورية ولا يجوز تأجيرها للغير أو الرهن.
3. المستأجر مسؤول قانونياً ومالياً عن المخالفات المرورية والأضرار الناتجة عن سوء الاستخدام طيلة فترة الإيجار.
4. يُسترد مبلغ التأمين كاملاً عند إرجاع المركبة سليمة وبعد تسوية أية التزامات مالية.
5. يمنع قيادة المركبة من قبل أي شخص غير مذكور في هذا العقد دون موافقة خطية مسبقة من الشركة.`,
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

  // Dynamic Member Discount (0-25%) via unified shared resolver
  const resolvedDiscount = resolveMemberDiscount(settings.discountConfig, {
    vehicleId: options?.vehicleId,
    vehicleDocId: options?.vehicleDocId,
    vehicleDataId: options?.vehicleDataId,
    isUserLoggedIn: Boolean(options?.isUserLoggedIn),
  });

  const memberDiscountEligible = resolvedDiscount.eligible;
  const memberDiscountApplied = resolvedDiscount.applied;
  const memberDiscountPercentage = resolvedDiscount.percentage;
  const potentialMemberSavings =
    memberDiscountEligible && memberDiscountPercentage > 0
      ? Math.round(rawBase * (memberDiscountPercentage / 100))
      : 0;
  const memberDiscountAmount = memberDiscountApplied ? potentialMemberSavings : 0;

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
    driverFee,
    subtotal: finalSubtotal,
    totalPrice,
    pricingType: 'daily',
    explanation,
  };
}

export function formatCurrency(amount: number, currency = '$'): string {
  return `${currency}${amount.toLocaleString('en-US')}`;
}
