import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, X, CalendarCheck, Car } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { AdminTabType, ADMIN_NAV_ITEMS } from '../../constants/adminNav';
import { Vehicle, Booking } from '../../types';
import { formatDateDisplay } from '../../utils/format';

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: AdminTabType, searchFilter?: string) => void;
  vehicles: Vehicle[];
  bookings: Booking[];
}

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  vehicles,
  bookings,
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose });
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setQuery('');
        setSelectedIndex(0);
      });
    }
  }, [isOpen]);

  const results = useMemo(() => {
    if (!isOpen) return [];
    const q = query.trim().toLowerCase();
    const items: Array<{
      id: string;
      title: string;
      subtitle?: string;
      icon: React.ElementType;
      type: 'tab' | 'vehicle' | 'booking';
      tab: AdminTabType;
      searchFilter?: string;
    }> = [];

    // 1. Navigation Tabs
    ADMIN_NAV_ITEMS.forEach((nav) => {
      if (!q || nav.label.toLowerCase().includes(q) || nav.id.toLowerCase().includes(q)) {
        items.push({
          id: `tab-${nav.id}`,
          title: nav.label,
          subtitle: 'الانتقال للقسم',
          icon: nav.icon,
          type: 'tab',
          tab: nav.id,
        });
      }
    });

    if (q) {
      // 2. Vehicles
      vehicles.forEach((v) => {
        const title = `${v.brand} ${v.model} (${v.year})`;
        if (
          title.toLowerCase().includes(q) ||
          v.plateNumber?.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q)
        ) {
          items.push({
            id: `vehicle-${v.id}`,
            title: title,
            subtitle: `لوحة: ${v.plateNumber ? v.plateNumber : v._internalDetailsLoaded ? '—' : 'جاري التحميل...'} • ${v.status === 'available' ? 'متاحة' : v.status === 'rented' ? 'مؤجرة' : 'صيانة'}`,
            icon: Car,
            type: 'vehicle',
            tab: 'vehicles',
            searchFilter: v.plateNumber || v.model || v.brand,
          });
        }
      });

      // 3. Bookings
      bookings.forEach((b) => {
        const num = b.bookingNumber || b.id;
        if (
          num.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.customerPhone?.includes(q)
        ) {
          items.push({
            id: `booking-${b.id}`,
            title: `حجز رقم ${num} - ${b.customerName}`,
            subtitle: `${b.vehicleName || ''} • ${formatDateDisplay(b.pickupDate)} إلى ${formatDateDisplay(b.returnDate)}`,
            icon: CalendarCheck,
            type: 'booking',
            tab: 'bookings',
            searchFilter: num,
          });
        }
      });
    }

    return items.slice(0, 12);
  }, [isOpen, query, vehicles, bookings]);

  const handleSelect = useCallback(
    (item: typeof results[number]) => {
      onClose();
      onNavigateTab(item.tab, item.searchFilter);
    },
    [onClose, onNavigateTab]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, handleSelect]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="البحث السريع والتنقل (Ctrl+K)"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden space-y-3 relative outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-950">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ابحث عن سيارة، رقم حجز، اسم عميل، أو قسم... (Ctrl+K)"
            className="w-full bg-transparent text-base sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer min-h-11 min-w-11 inline-flex items-center justify-center"
              aria-label="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto px-3 pb-3 space-y-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              لا توجد نتائج مطابقة للبحث &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full min-h-11 text-right p-3 rounded-2xl flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-500 text-slate-950 font-bold' : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-extrabold truncate">{item.title}</div>
                      {item.subtitle && (
                        <div
                          className={`text-xs truncate ${
                            isSelected ? 'text-slate-900 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <span
                    className={`text-xs font-mono shrink-0 px-2 py-0.5 rounded-md ${
                      isSelected ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {item.type === 'tab' ? 'قسم' : item.type === 'vehicle' ? 'سيارة' : 'حجز'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
