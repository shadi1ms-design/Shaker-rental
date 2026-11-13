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
    return date.toLocaleDateString('ar-SY-u-nu-latn', {
      timeZone: DAMASCUS_TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return date.toLocaleDateString('ar-SY-u-nu-latn');
  }
}

/**
 * Formats an ISO date ('YYYY-MM-DD' or ISO timestamp) to 'DD/MM/YYYY' using Latin numerals.
 * Builds manually without Intl to avoid locale-induced text reversal and directional control chars.
 * Returns empty string for empty, null, undefined, or invalid inputs.
 */
export function formatDateDisplay(iso?: string | null): string {
  if (!iso || typeof iso !== 'string') return '';
  const trimmed = iso.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (!match) return '';
  const year = match[1];
  const monthNum = parseInt(match[2], 10);
  const dayNum = parseInt(match[3], 10);
  if (
    isNaN(monthNum) ||
    isNaN(dayNum) ||
    monthNum < 1 ||
    monthNum > 12 ||
    dayNum < 1 ||
    dayNum > 31
  ) {
    return '';
  }
  const month = String(monthNum).padStart(2, '0');
  const day = String(dayNum).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

/**
 * Adds whole days to a 'YYYY-MM-DD' date string without any timezone drift.
 */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split('T')[0];
}

export function isThisMonthLocal(isoString?: string | null): boolean {
  if (!isoString) return false;
  try {
    const d = new Date(isoString);
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: DAMASCUS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
    });
    return formatter.format(d) === formatter.format(now);
  } catch {
    return false;
  }
}

export function isWithinLastDaysLocal(isoString: string | null, days: number): boolean {
  if (!isoString) return false;
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days;
  } catch {
    return false;
  }
}
