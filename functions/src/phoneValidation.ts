/**
 * Pure Phone Validation Module for Cloud Functions
 * Self-contained without firebase-admin dependencies.
 * Follows E.164: +{dialCode}{national}, national >= 10 digits, total digits <= 15.
 */

export const VALID_DIAL_CODES: readonly string[] = [
  '963', '971', '966', '962', '961', '964', '965', '968', '974', '973',
  '20', '212', '213', '216', '218', '249', '967', '970', '252', '253',
  '222', '269', '1', '44', '33', '49', '39', '34', '7', '90', '98',
  '86', '81', '82', '91', '92', '880', '62', '60', '65', '66', '84',
  '63', '31', '32', '41', '43', '46', '47', '45', '358', '48', '30',
  '351', '420', '36', '40', '359', '380', '375', '370', '371', '372',
  '385', '381', '387', '357', '356', '55', '54', '57', '56', '51',
  '58', '52', '27', '234', '254', '255', '256', '251', '233', '225',
  '221', '237', '260', '263', '61', '64', '994', '374', '995', '992',
  '993', '998', '996', '976', '977', '975', '960', '94', '95', '855',
  '856', '886', '852', '853', '297', '291', '268', '93', '593', '355',
  '1268', '244', '1264', '376', '353', '354', '675', '595', '680', '1441',
  '673', '501', '507', '229', '1242', '267', '226', '257', '591', '689',
  '1868', '235', '228', '688', '690', '676', '670', '1876', '350', '1684',
  '211', '1767', '250', '266', '378', '1784', '1869', '1758', '508', '239',
  '503', '421', '386', '597', '232', '248', '241', '220', '1473', '502',
  '590', '1671', '592', '224', '240', '245', '379', '678', '679', '599',
  '850', '506', '242', '243', '686', '352', '231', '423', '692', '223',
  '261', '389', '230', '258', '373', '377', '691', '264', '674', '227',
  '505', '687', '509', '504', '972', '685', '53'
];

export const VALID_DIAL_CODES_SET: ReadonlySet<string> = new Set(VALID_DIAL_CODES);

// Longest dial codes first for prefix matching
export const SORTED_DIAL_CODES_DESC: readonly string[] = [...VALID_DIAL_CODES].sort(
  (a, b) => b.length - a.length
);

/**
 * Maps Eastern Arabic / Indic and Persian numerals to Latin digits.
 */
export function normalizePhoneDigits(input?: string | null): string {
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
 * Parses full phone string into dialCode and national part.
 */
export function parsePhoneNumber(full?: string | null): { dialCode: string; national: string } {
  if (!full || typeof full !== 'string') {
    return { dialCode: '963', national: '' };
  }

  let normalized = normalizePhoneDigits(full.trim());
  if (normalized.startsWith('00')) {
    normalized = '+' + normalized.slice(2);
  }

  if (normalized.startsWith('+')) {
    const withoutPlus = normalized.slice(1);
    for (const code of SORTED_DIAL_CODES_DESC) {
      if (withoutPlus.startsWith(code)) {
        return { dialCode: code, national: withoutPlus.slice(code.length) };
      }
    }
    return { dialCode: '963', national: withoutPlus };
  }

  // Without leading +: check if starts with known dial code and remaining national digits >= 9
  for (const code of SORTED_DIAL_CODES_DESC) {
    if (normalized.startsWith(code) && (normalized.length - code.length) >= 9) {
      return { dialCode: code, national: normalized.slice(code.length) };
    }
  }

  // Local number (e.g. 0933123456)
  return { dialCode: '963', national: normalized };
}

/**
 * Validates dialCode and national number:
 * - dialCode must be in valid list
 * - national must have >= 9 digits
 * - total digits <= 15
 */
export function isValidPhoneNumber(dialCodeOrFull?: string | null, nationalInput?: string | null): boolean {
  let dial = dialCodeOrFull || '';
  let national = nationalInput || '';

  if (!nationalInput && dialCodeOrFull) {
    const parsed = parsePhoneNumber(dialCodeOrFull);
    dial = parsed.dialCode;
    national = parsed.national;
  }

  const cleanDial = dial.replace(/\D/g, '');
  const cleanNat = national.replace(/\D/g, '');

  if (!VALID_DIAL_CODES_SET.has(cleanDial)) {
    return false;
  }

  if (cleanNat.length < 9) {
    return false;
  }

  const total = cleanDial.length + cleanNat.length;
  if (total > 15) {
    return false;
  }

  return true;
}

/**
 * Normalizes phone into standard E.164 string: +{dialCode}{national}
 * Throws an Error with Arabic message if invalid.
 */
export function formatAndValidatePhone(input?: string | null): string {
  if (!input || !input.trim()) {
    throw new Error('يرجى إدخال رقم هاتف صالح.');
  }

  const parsed = parsePhoneNumber(input);
  const cleanDial = parsed.dialCode.replace(/\D/g, '');
  const cleanNat = parsed.national.replace(/\D/g, '');

  if (!VALID_DIAL_CODES_SET.has(cleanDial)) {
    throw new Error('رمز الدولة في رقم الهاتف غير صالح.');
  }

  if (cleanNat.length < 9) {
    throw new Error('رقم الهاتف يجب ألا يقل عن 9 أرقام.');
  }

  const total = cleanDial.length + cleanNat.length;
  if (total > 15) {
    throw new Error('مجموع أرقام الهاتف مع رمز الدولة لا يجوز أن يتجاوز 15 رقماً.');
  }

  return `+${cleanDial}${cleanNat}`;
}
