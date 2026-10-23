/**
 * Damascus Time Zone (UTC+3) and localized date utilities.
 * Avoids bugs where UTC ISO strings give the previous/next day between 00:00 and 03:00.
 */

export const DAMASCUS_TIMEZONE = 'Asia/Damascus';

/**
 * Returns the current date in Damascus local time as 'YYYY-MM-DD'.
 */
export function todayLocalISO(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: DAMASCUS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    // Fallback in environments without Intl timeZone support
    const offsetDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return offsetDate.toISOString().split('T')[0];
  }
}

/**
 * Checks if an ISO timestamp string belongs to today in Damascus local time.
 */
export function isTodayLocal(isoString?: string | null): boolean {
  if (!isoString) return false;
  try {
    const today = todayLocalISO();
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return false;
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: DAMASCUS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
    return formatted === today;
  } catch {
    return (isoString || '').startsWith(todayLocalISO());
  }
}

/**
 * Formats a date into localized Arabic string with Damascus context
 */
export function formatArabicDate(date: Date = new Date()): string {
  try {
    return date.toLocaleDateString('ar-SY', {
      timeZone: DAMASCUS_TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return date.toLocaleDateString('ar-SY');
  }
}

/**
 * Adds whole days to a 'YYYY-MM-DD' date string without any timezone drift.
 */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0];
}
