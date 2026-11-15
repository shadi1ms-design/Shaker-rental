import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search, AlertCircle } from 'lucide-react';
import { COUNTRIES, Country } from '../../constants/countries';
import { parsePhone, formatPhone, normalizeDigits, findCountry } from '../../utils/phone';

export interface PhoneInputProps {
  value?: string;
  onChange: (fullPhone: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  error?: string | null;
  autoFocus?: boolean;
  'aria-describedby'?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value = '',
  onChange,
  id,
  name,
  placeholder = '9331234567',
  disabled = false,
  required = false,
  className = '',
  error: externalError,
  autoFocus = false,
  'aria-describedby': ariaDescribedBy,
}) => {
  // Parse initial or incoming full value
  const parsed = useMemo(() => parsePhone(value), [value]);

  const [selectedCountry, setSelectedCountry] = useState<Country>(() =>
    findCountry(parsed.dialCode)
  );
  const [nationalNumber, setNationalNumber] = useState<string>(parsed.national);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTouched, setIsTouched] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when prop `value` changes from outside
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const p = parsePhone(value);
    setSelectedCountry(findCountry(p.dialCode));
    setNationalNumber(p.national);
  }

  // Click outside listener for country dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Filtered countries
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery('');
    const full = formatPhone(country.dialCode, nationalNumber);
    onChange(full);
  };

  const handleNationalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digitsOnly = normalizeDigits(raw).replace(/\D/g, '');
    const maxLen = 15 - selectedCountry.dialCode.replace(/\D/g, '').length;
    const trimmedDigits = digitsOnly.slice(0, Math.max(10, maxLen));

    setNationalNumber(trimmedDigits);
    const full = formatPhone(selectedCountry.dialCode, trimmedDigits);
    onChange(full);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation and edit controls
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Tab' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'Enter' ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    // Check if key is digit (Latin or Arabic numeral)
    const normalized = normalizeDigits(e.key);
    if (!/^\d$/.test(normalized)) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const normalized = normalizeDigits(pasted).replace(/\D/g, '');
    const current = nationalNumber;
    const combined = (current + normalized).slice(
      0,
      15 - selectedCountry.dialCode.replace(/\D/g, '').length
    );
    setNationalNumber(combined);
    const full = formatPhone(selectedCountry.dialCode, combined);
    onChange(full);
  };

  // Validation message
  const lengthWarning =
    isTouched && nationalNumber.length > 0 && nationalNumber.length < 9
      ? 'رقم الهاتف يجب ألا يقل عن 9 أرقام'
      : null;

  const displayError = externalError || lengthWarning;

  return (
    <div className={`space-y-1 ${className}`} ref={containerRef}>
      <div
        dir="ltr"
        className={`flex items-center rounded-xl bg-slate-950 border transition-all ${
          displayError
            ? 'border-rose-500 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-500/20'
            : 'border-slate-700/80 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-400/20'
        } ${disabled ? 'opacity-75 cursor-not-allowed bg-slate-900/70' : ''}`}
      >
        {/* Country Code Selector Button */}
        <div className="relative shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-label="اختر رمز الدولة"
            className="min-h-11 flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-l-xl border-r border-slate-800 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:hover:bg-slate-900 select-none"
          >
            <span className="text-base leading-none">{selectedCountry.flag}</span>
            <span className="font-mono text-amber-400 text-sm font-bold" dir="ltr">
              {selectedCountry.dialCode}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Searchable Country Dropdown */}
          {isDropdownOpen && (
            <div
              dir="rtl"
              className="absolute top-full left-0 mt-1.5 w-72 max-w-[calc(100vw-2rem)] max-h-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden text-right font-cairo"
            >
              {/* Search Box */}
              <div className="p-2 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10">
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم أو الرمز..."
                    className="w-full min-h-11 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 pe-9 text-base sm:text-sm text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute end-2.5 top-3" />
                </div>
              </div>

              {/* Countries List */}
              <div className="overflow-y-auto flex-1 divide-y divide-slate-800/40">
                {filteredCountries.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    لا توجد دولة مطابقة للبحث
                  </div>
                ) : (
                  filteredCountries.map((c) => {
                    const isSelected = c.code === selectedCountry.code;
                    return (
                      <button
                        key={`${c.code}-${c.dialCode}`}
                        type="button"
                        onClick={() => handleCountrySelect(c)}
                        className={`w-full min-h-11 px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-800 transition-colors text-right cursor-pointer ${
                          isSelected ? 'bg-amber-500/15 text-amber-300 font-bold' : 'text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base">{c.flag}</span>
                          <span className="truncate">{c.name}</span>
                        </div>
                        <span className="font-mono text-slate-400 font-bold shrink-0 ms-2" dir="ltr">
                          {c.dialCode}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* National Number Input */}
        <input
          id={id}
          name={name}
          type="text"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          value={nationalNumber}
          onChange={handleNationalChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => setIsTouched(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          aria-invalid={Boolean(displayError)}
          aria-describedby={ariaDescribedBy}
          className="w-full min-w-0 min-h-11 bg-transparent px-3 py-2 text-white placeholder:text-slate-400 text-base sm:text-sm font-mono text-left focus:outline-none disabled:cursor-not-allowed disabled:text-slate-300"
        />
      </div>

      {/* Validation Message */}
      {displayError && (
        <p className="text-sm text-rose-400 flex items-center gap-1 mt-1 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{displayError}</span>
        </p>
      )}
    </div>
  );
};
