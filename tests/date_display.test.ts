import { describe, it, expect } from 'vitest';
import { formatDateDisplay } from '../src/utils/dateUtils';

describe('formatDateDisplay', () => {
  it('formats valid ISO date string YYYY-MM-DD to DD/MM/YYYY in Latin numerals', () => {
    expect(formatDateDisplay('2026-11-12')).toBe('12/11/2026');
    expect(formatDateDisplay('2025-01-05')).toBe('05/01/2025');
    expect(formatDateDisplay('2026-09-30')).toBe('30/09/2026');
  });

  it('formats valid ISO timestamp strings to DD/MM/YYYY', () => {
    expect(formatDateDisplay('2026-11-12T14:30:00.000Z')).toBe('12/11/2026');
    expect(formatDateDisplay('2026-11-12 10:00:00')).toBe('12/11/2026');
  });

  it('returns empty string for empty, null, or undefined values', () => {
    expect(formatDateDisplay('')).toBe('');
    expect(formatDateDisplay('   ')).toBe('');
    expect(formatDateDisplay(null)).toBe('');
    expect(formatDateDisplay(undefined)).toBe('');
  });

  it('returns empty string for invalid date formats and out-of-range dates', () => {
    expect(formatDateDisplay('invalid')).toBe('');
    expect(formatDateDisplay('not-a-date')).toBe('');
    expect(formatDateDisplay('2026/11/12')).toBe('');
    expect(formatDateDisplay('12-11-2026')).toBe('');
    expect(formatDateDisplay('2026-13-01')).toBe(''); // invalid month
    expect(formatDateDisplay('2026-00-10')).toBe(''); // invalid month
    expect(formatDateDisplay('2026-05-32')).toBe(''); // invalid day
    expect(formatDateDisplay('2026-05-00')).toBe(''); // invalid day
  });
});
