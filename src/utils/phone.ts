import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  SORTED_DIAL_CODES,
  VALID_DIAL_CODES_SET,
  Country,
} from '../constants/countries';

/**
 * Maps Arabic and Persian numerals to ASCII standard Latin digits (0-9).
 * Also trims and strips out spaces, dashes, parentheses, and formatting dots.
 */
export function normalizeDigits(input?: string | null): string {
  if (!input) return '';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  let out = '';
  for (const char of String(input)) {
    const arIdx = arabicDigits.indexOf(char);
    if (arIdx !== -1) {
      out += arIdx.toString();
      continue;
    }
    const peIdx = persianDigits.indexOf(char);
    if (peIdx !== -1) {
      out += peIdx.toString();
      continue;
    }
    // Keep plus only if at beginning
    if (char === '+' && out.length === 0) {
      out += '+';
      continue;
    }
    if (/\d/.test(char)) {
      out += char;
    }
  }
  return out;
}

/**
 * Extracts digits only from an input, converting any Eastern Arabic numerals.
 */
export function extractRawDigits(input?: string | null): string {
  return normalizeDigits(input).replace(/\D/g, '');
}

/**
 * Parses a stored or raw phone string into dialCode and national digits.
 * Handles legacy stored formats such as "+963 933 123 456" and "0933123456".
 */
export function parsePhone(full?: string | null): { dialCode: string; national: string } {
  if (!full || typeof full !== 'string') {
    return { dialCode: DEFAULT_COUNTRY.dialCode, national: '' };
  }

  const trimmed = full.trim();
  if (!trimmed) {
    return { dialCode: DEFAULT_COUNTRY.dialCode, national: '' };
  }

  // Normalize numbers (handles Arabic numerals)
  let normalized = normalizeDigits(trimmed);

  // If starts with 00, treat as international +
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.slice(2);
  }

  // 1. If starts with +, match against longest dial code
  if (normalized.startsWith('+')) {
    for (const code of SORTED_DIAL_CODES) {
      if (normalized.startsWith(code)) {
        const national = normalized.slice(code.length);
        return { dialCode: code, national };
      }
    }
    // Unknown +, keep it or fallback
    return { dialCode: DEFAULT_COUNTRY.dialCode, national: normalized.replace(/^\+/, '') };
  }

  // 2. Check if normalized starts with a known country code directly (e.g. 963944331774 or 97150...)
  // Only consider prefix a dial code if at least 9 national digits remain
  for (const code of SORTED_DIAL_CODES) {
    const rawCode = code.replace(/^\+/, '');
    if (normalized.startsWith(rawCode) && (normalized.length - rawCode.length) >= 9) {
      return { dialCode: code, national: normalized.slice(rawCode.length) };
    }
  }

  // 3. If local national format or no dial code match, default to Syria (+963)
  return {
    dialCode: DEFAULT_COUNTRY.dialCode,
    national: normalized,
  };
}

/**
 * Formats dialCode and national number into standard E.164 string: +{dialCode}{national}
 */
export function formatPhone(dialCode: string, national: string): string {
  const cleanDial = dialCode.replace(/\D/g, '');
  const cleanNat = extractRawDigits(national);
  if (!cleanNat) return '';
  return `+${cleanDial}${cleanNat}`;
}

/**
 * Validates phone according to rule:
 * - Dial code exists in the world countries list
 * - National number contains digits only and length >= 9
 * - Total digits (dialCode digits + national digits) <= 15 (E.164 standard)
 */
export function isValidPhone(dialCode?: string | null, national?: string | null): boolean {
  if (!dialCode && !national) return false;

  let dCode = dialCode || '';
  let nat = national || '';

  // If only one parameter passed (e.g. full phone string)
  if (!national && dialCode && (dialCode.startsWith('+') || dialCode.startsWith('00'))) {
    const parsed = parsePhone(dialCode);
    dCode = parsed.dialCode;
    nat = parsed.national;
  }

  const cleanDial = dCode.replace(/\D/g, '');
  const cleanNat = extractRawDigits(nat);

  if (!VALID_DIAL_CODES_SET.has(cleanDial)) {
    return false;
  }

  if (cleanNat.length < 9) {
    return false;
  }

  const totalLength = cleanDial.length + cleanNat.length;
  if (totalLength > 15) {
    return false;
  }

  return true;
}

/**
 * Finds country metadata by dial code or ISO code.
 */
export function findCountry(dialCodeOrCode: string): Country {
  const clean = dialCodeOrCode.trim().toUpperCase();
  const byCode = COUNTRIES.find((c) => c.code === clean);
  if (byCode) return byCode;

  const dialClean = clean.startsWith('+') ? clean : `+${clean}`;
  const byDial = COUNTRIES.find((c) => c.dialCode === dialClean);
  if (byDial) return byDial;

  return DEFAULT_COUNTRY;
}
