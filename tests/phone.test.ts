import { describe, it, expect } from 'vitest';
import {
  normalizeDigits,
  parsePhone,
  formatPhone,
  isValidPhone,
} from '../src/utils/phone';
import {
  normalizePhoneDigits,
  parsePhoneNumber,
  isValidPhoneNumber,
  formatAndValidatePhone,
  VALID_DIAL_CODES,
} from '../functions/src/phoneValidation';
import { COUNTRIES } from '../src/constants/countries';

describe('Client Phone Utilities (src/utils/phone.ts)', () => {
  it('should accept valid phone with valid dial code and >= 9 national digits', () => {
    // Syria + 9 digits
    expect(isValidPhone('+963', '933123456')).toBe(true);
    // UAE + 9 digits
    expect(isValidPhone('+971', '501234567')).toBe(true);
    // Full string passed
    expect(isValidPhone('+963933123456')).toBe(true);
  });

  it('should reject phone when national digits < 9 (e.g. 8 digits)', () => {
    expect(isValidPhone('+963', '93312345')).toBe(false);
    expect(isValidPhone('+96393312345')).toBe(false);
  });

  it('should reject non-existent dial code', () => {
    expect(isValidPhone('+999', '9331234567')).toBe(false);
    expect(isValidPhone('+0001234567890')).toBe(false);
  });

  it('should reject when total digits exceed 15 (E.164 max length)', () => {
    // 3 digits dial code + 13 digits national = 16 digits
    expect(isValidPhone('+963', '1234567890123')).toBe(false);
  });

  it('should convert Eastern Arabic (Indic) numerals to Latin digits', () => {
    expect(normalizeDigits('٠٩٣٣١٢٣٤٥٦')).toBe('0933123456');
    expect(normalizeDigits('۰۹۳۳۱۲۳۴۵۶')).toBe('0933123456');
    expect(isValidPhone('+963', '٩٣٣١٢٣٤٥٦')).toBe(true);
  });

  it('should parse legacy phone formats correctly requiring >= 9 remaining digits for dial codes without +', () => {
    // "933123456" gives +963
    const p1 = parsePhone('933123456');
    expect(p1.dialCode).toBe('+963');
    expect(p1.national).toBe('933123456');

    // "2025551234" (length 10) starts with "20" (Egypt), but remaining = 8 digits < 9, so it is NOT parsed as Egypt
    const p2 = parsePhone('2025551234');
    expect(p2.dialCode).toBe('+963');
    expect(p2.national).toBe('2025551234');

    // Local Syrian with leading zero "0933123456"
    const parsed1 = parsePhone('0933123456');
    expect(parsed1.dialCode).toBe('+963');
    expect(parsed1.national).toBe('0933123456');

    // Spaced international "+963 933 123 456"
    const parsed2 = parsePhone('+963 933 123 456');
    expect(parsed2.dialCode).toBe('+963');
    expect(parsed2.national).toBe('933123456');

    // Formatting
    expect(formatPhone('+963', '933123456')).toBe('+963933123456');
  });
});

describe('Server Phone Validation (functions/src/phoneValidation.ts)', () => {
  it('should accept valid phone with valid dial code and >= 9 national digits', () => {
    expect(isValidPhoneNumber('963', '933123456')).toBe(true);
    expect(isValidPhoneNumber('+963933123456')).toBe(true);
    expect(formatAndValidatePhone('+963933123456')).toBe('+963933123456');
  });

  it('should reject phone when national digits < 9 (e.g. 8 digits)', () => {
    expect(isValidPhoneNumber('963', '93312345')).toBe(false);
    expect(() => formatAndValidatePhone('+96393312345')).toThrow('لا يقل عن 9 أرقام');
  });

  it('should reject invalid dial code', () => {
    expect(isValidPhoneNumber('999', '9331234567')).toBe(false);
    expect(() => formatAndValidatePhone('+9999331234567')).toThrow('رمز الدولة');
  });

  it('should reject when total digits exceed 15', () => {
    expect(isValidPhoneNumber('963', '1234567890123')).toBe(false);
    expect(() => formatAndValidatePhone('+9631234567890123')).toThrow('15');
  });

  it('should parse legacy numbers requiring >= 9 remaining digits for dial codes', () => {
    const p1 = parsePhoneNumber('933123456');
    expect(p1.dialCode).toBe('963');
    expect(p1.national).toBe('933123456');

    const p2 = parsePhoneNumber('2025551234');
    expect(p2.dialCode).toBe('963');
    expect(p2.national).toBe('2025551234');
  });
});

describe('Dial Codes Equivalence Test', () => {
  it('COUNTRIES and VALID_DIAL_CODES dial codes must match 1:1', () => {
    const countryDialCodes = Array.from(
      new Set(COUNTRIES.map((c) => c.dialCode.replace(/^\+/, '')))
    ).sort();
    const funcDialCodes = Array.from(new Set(VALID_DIAL_CODES)).sort();
    expect(countryDialCodes).toEqual(funcDialCodes);
  });
});

