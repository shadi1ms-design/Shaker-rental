import React, { useState } from 'react';

export interface NumberInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  className?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  allowEmpty?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}

/**
 * Maps Arabic and Persian numerals and decimal marks to ASCII decimal digits.
 */
export function normalizeNumericString(input?: string | null): string {
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
    if (char === '.' || char === '٫' || char === ',') {
      out += '.';
      continue;
    }
    if (char === '-') {
      out += '-';
      continue;
    }
    if (/\d/.test(char)) {
      out += char;
    }
  }
  return out;
}

/**
 * Pure parsing and normalization helper for numeric inputs.
 */
export function parseNumberInput(
  rawText: string,
  allowEmpty: boolean = false
): number | null {
  const normalized = normalizeNumericString(rawText).trim();
  if (normalized === '' || normalized === '-') {
    return allowEmpty ? null : 0;
  }
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? (allowEmpty ? null : 0) : parsed;
}

/**
 * Normalizes display text on blur (strips leading zeroes while preserving decimals; empty or '-' stays empty).
 */
export function normalizeNumberText(
  rawText: string
): string {
  const normalized = normalizeNumericString(rawText).trim();
  if (normalized === '' || normalized === '-') {
    return '';
  }
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    return normalized;
  }
  return String(parsed);
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(({
  value,
  onChange,
  min,
  max,
  step,
  className,
  required,
  placeholder,
  disabled,
  id,
  name,
  'aria-label': ariaLabel,
  allowEmpty = false,
  onBlur,
  onFocus,
  autoFocus,
}, ref) => {
  const [text, setText] = useState<string>(() => {
    if (value === null || value === undefined) {
      return '';
    }
    if (value === 0 && allowEmpty) {
      return '';
    }
    return String(value);
  });

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const targetValue = value === undefined ? null : value;
    const currentParsed = parseNumberInput(text, allowEmpty);
    if (currentParsed !== targetValue) {
      if (targetValue === null || (targetValue === 0 && allowEmpty && text === '')) {
        setText('');
      } else {
        setText(targetValue === null ? '' : String(targetValue));
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const normalized = normalizeNumericString(raw);
    setText(normalized);

    const parsed = parseNumberInput(normalized, allowEmpty);
    if (parsed !== null) {
      onChange(parsed);
    } else if (allowEmpty) {
      onChange(null);
    } else {
      onChange(0);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const normalizedDisplay = normalizeNumberText(text);
    setText(normalizedDisplay);
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <input
      ref={ref}
      type="number"
      inputMode="decimal"
      id={id}
      name={name}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={onFocus}
      min={min}
      max={max}
      step={step}
      className={className}
      required={required}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
    />
  );
});

NumberInput.displayName = 'NumberInput';
