import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';

export interface DateFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  size?: 'md' | 'sm';
}

/**
 * Accessible date input wrapper that prevents locale-induced flipped text
 * and native browser placeholders (such as mm/dd/yyyy) in RTL layouts.
 * Always renders date as DD/MM/YYYY in Latin numerals while storing ISO format.
 */
export const DateField: React.FC<DateFieldProps> = ({
  id,
  value,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  ariaLabel,
  placeholder = 'اختر التاريخ',
  className = '',
  size = 'md',
}) => {
  // Build DD/MM/YYYY manually from ISO without Intl to prevent locale reversal
  const formattedDisplay = useMemo(() => {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return '';
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }, [value]);

  const isSmall = size === 'sm';

  return (
    <div
      className={`group relative w-full rounded-xl border transition-all flex items-center justify-between gap-2 select-none ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800'
          : 'bg-slate-950 border-slate-700 hover:border-slate-600 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20'
      } ${
        isSmall
          ? 'min-h-11 px-3 py-1.5 text-sm'
          : 'min-h-[44px] px-3.5 py-2.5 text-base sm:text-sm'
      } ${className}`}
    >
      {/* Display layer for visual text presentation */}
      <div
        aria-hidden="true"
        className="flex-1 flex items-center justify-start min-w-0 pointer-events-none"
      >
        {formattedDisplay ? (
          <span
            dir="ltr"
            className="font-mono tabular-nums text-white tracking-wide"
          >
            {formattedDisplay}
          </span>
        ) : (
          <span className="text-slate-400 truncate">
            {placeholder}
          </span>
        )}
      </div>

      {/* Calendar icon at the end */}
      <Calendar
        aria-hidden="true"
        className={`shrink-0 pointer-events-none text-slate-400 group-hover:text-amber-400 transition-colors ${
          isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4 text-amber-400'
        }`}
      />

      {/* Transparent native date picker overlay with 16px font to prevent iOS zoom */}
      <input
        id={id}
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // Ignore if showPicker is unsupported or already open
          }
        }}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        className={`absolute inset-0 w-full h-full opacity-0 z-10 text-base [color-scheme:dark] ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      />
    </div>
  );
};

export default DateField;
