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
  weeklyDiscountPerDay: 5,
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
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

/**
 * Centralized Pricing Engine
 * Implements the exact business rules defined in Section 7 & 8 of the requirements.
 */
export function calculateRentalPrice(
  category: VehicleCategory,
  dailyPrice: number,
  days: number,
  settings: AppSettings = DEFAULT_SETTINGS
): PricingCalculation {
  const rentalDays = Math.max(1, Math.round(days));
  const rawBase = rentalDays * dailyPrice;

  // Monthly flat rates by category
  let monthlyCategoryRate = settings.monthlyRateMedium;
  if (category === 'light') {
    monthlyCategoryRate = settings.monthlyRateLight;
  } else if (category === 'jeep_7seats') {
    monthlyCategoryRate = settings.monthlyRateJeep;
  }

  let basePrice = rawBase;
  let discountAmount = 0;
  let subtotal = rawBase;
  let pricingType: 'daily' | 'weekly' | 'monthly' | 'proportional' = 'daily';
  let explanation = '';

  if (rentalDays >= 30) {
    // Monthly calculation (multiples of 30 days or flat base)
    pricingType = 'monthly';
    const months = Math.floor(rentalDays / 30);
    const extraDays = rentalDays % 30;
    const monthlyCost = months * monthlyCategoryRate;
    const extraDaysCost = extraDays * (monthlyCategoryRate / 30);
    subtotal = Math.round(monthlyCost + extraDaysCost);
    discountAmount = Math.max(0, rawBase - subtotal);
    basePrice = rawBase;
    explanation = `تعرفة شهرية (${monthlyCategoryRate}$ / شهر)`;
  } else if (rentalDays >= 14 && rentalDays <= 29) {
    // 14–29 days: Proportional based on monthly rate
    pricingType = 'proportional';
    subtotal = Math.round(rentalDays * (monthlyCategoryRate / 30));
    discountAmount = Math.max(0, rawBase - subtotal);
    basePrice = rawBase;
    explanation = `سعر نسبي مخفض للفترات الطويلة (محسوب على أساس التعرفة الشهرية)`;
  } else if (rentalDays >= 7) {
    // Weekly rule: $5 discount per day (e.g., 7 * dailyPrice - 5 * 7)
    pricingType = 'weekly';
    discountAmount = rentalDays * settings.weeklyDiscountPerDay;
    subtotal = Math.max(0, rawBase - discountAmount);
    basePrice = rawBase;
    explanation = `خصم أسبوعي بقيمة ${settings.weeklyDiscountPerDay}$ يومياً (${discountAmount}$ إجمالي الخصم)`;
  } else {
    // Standard Daily
    pricingType = 'daily';
    discountAmount = 0;
    subtotal = rawBase;
    basePrice = rawBase;
    explanation = `سعر يومي نظامي (${dailyPrice}$ / يوم)`;
  }

  // Insurance calculation rule (Section 8):
  // 1 or 2 days: $500
  // More than 2 days: $300
  const insuranceAmount =
    rentalDays <= 2 ? settings.insurance1to2Days : settings.insuranceAbove2Days;

  const totalPrice = subtotal + insuranceAmount;

  return {
    rentalDays,
    dailyPrice,
    basePrice,
    discountAmount,
    insuranceAmount,
    subtotal,
    totalPrice,
    pricingType,
    explanation,
  };
}

/**
 * Format currency with Arabic locale and USD symbol
 */
export function formatCurrency(amount: number, currency = '$'): string {
  return `${amount.toLocaleString('ar-SY')} ${currency}`;
}
