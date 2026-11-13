import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'بحث...',
  className = '',
  id,
  autoFocus = false,
  ariaLabel = 'بحث',
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute start-3 pointer-events-none" />
      <input
        type="search"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className="w-full min-h-11 bg-slate-900 border border-slate-800 rounded-xl ps-9 pe-12 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute end-0.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-11 min-w-11 inline-flex items-center justify-center"
          aria-label="مسح البحث"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
