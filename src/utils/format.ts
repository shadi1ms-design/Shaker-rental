/**
 * Formats a monetary number with currency prefix (default '$')
 */
export function formatMoney(val: number | undefined | null, currency = '$'): string {
  if (val === undefined || val === null || isNaN(val)) return `${currency}0`;
  return `${currency}${val.toLocaleString('en-US')}`;
}

/**
 * Formats a number using Arabic or localized digit formatting
 */
export function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return val.toLocaleString('en-US');
}

/**
 * Formats a count of vehicles into proper Arabic pluralized grammar
 */
export function formatArabicVehicleCount(count: number): string {
  if (count === 0) return 'لا توجد سيارات مطابقة لبحثك حالياً';
  if (count === 1) return 'تم العثور على سيارة واحدة جاهزة للتأجير الفوري في دمشق وجرمانا';
  if (count === 2) return 'تم العثور على سيارتين جاهزتين للتأجير الفوري في دمشق وجرمانا';
  if (count >= 3 && count <= 10) return `تم العثور على ${count} سيارات جاهزة للتأجير الفوري في دمشق وجرمانا`;
  return `تم العثور على ${count} سيارة جاهزة للتأجير الفوري في دمشق وجرمانا`;
}

/**
 * Short button variant for mobile filter drawer
 */
export function formatArabicVehicleCountShort(count: number): string {
  if (count === 0) return 'عرض النتائج';
  if (count === 1) return 'عرض سيارة واحدة';
  if (count === 2) return 'عرض سيارتين';
  if (count >= 3 && count <= 10) return `عرض ${count} سيارات`;
  return `عرض ${count} سيارة`;
}

export { formatDateDisplay } from './dateUtils';

