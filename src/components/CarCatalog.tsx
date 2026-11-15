import React, { useState, useMemo, useRef, useEffect } from 'react';
import { VehicleCard } from './common/VehicleCard';
import { SearchInput } from './common/SearchInput';
import { EmptyState } from './common/EmptyState';
import { SkeletonLoader } from './common/SkeletonLoader';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useSearchParams } from '../router';
import {
  CatalogQueryState,
  buildBookingUrl,
  buildCatalogSearchParams,
  parseCatalogParams,
} from '../utils/catalogQuery';
import {
  Vehicle,
  VehicleCategory,
  FuelType,
  TransmissionType,
  SortField
} from '../types';
import { VEHICLE_CATEGORY_LABELS } from '../constants/vehicleCategories';
import { FUEL_LABEL, TRANSMISSION_LABEL } from '../constants/vehicleLabels';
import { formatMoney, formatArabicVehicleCount, formatArabicVehicleCountShort, formatDateDisplay } from '../utils/format';
import { openWhatsAppChat } from '../services/whatsapp';
import { isVehicleLocallyUnavailableForRange, useRangeAvailability } from '../utils/vehicleAvailability';
import {
  Filter,
  ArrowUpDown,
  Calendar,
  X,
  SlidersHorizontal,
  RotateCcw,
  MessageCircle
} from 'lucide-react';

interface CarCatalogProps {
  vehicles?: Vehicle[];
  onBook?: (vehicle: Vehicle) => void;
  onViewDetails?: (vehicle: Vehicle) => void;
  selectedCategory?: VehicleCategory | 'all';
}

const AVAILABILITY_CHIP_LABEL: Record<'available' | 'rented', string> = {
  available: 'متاحة فوراً',
  rented: 'مؤجرة حالياً',
};

export const CarCatalog: React.FC<CarCatalogProps> = ({
  vehicles = [],
  onBook,
  onViewDetails,
  selectedCategory = 'all',
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseCatalogParams(searchParams), [searchParams]);

  const category: VehicleCategory | 'all' =
    urlState.category !== 'all' ? urlState.category : selectedCategory;
  const searchQuery = urlState.q;
  const selectedBrand = urlState.brand;
  const selectedYear = urlState.year;
  const transmission = urlState.transmission;
  const fuelType = urlState.fuel;
  const seats = urlState.seats;
  const availability = urlState.availability;
  const maxPriceCap = urlState.max;
  const sortBy = urlState.sort;
  const activePickupDate = urlState.from || undefined;
  const activeReturnDate = urlState.to || undefined;

  const [searchInput, setSearchInput] = useState(searchQuery);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedQRef = useRef(searchQuery);

  useEffect(() => {
    if (searchQuery !== lastSyncedQRef.current) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      lastSyncedQRef.current = searchQuery;
      setSearchInput(searchQuery);
    }
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const mobileFilterRef = useRef<HTMLDivElement>(null);

  useFocusTrap(mobileFilterRef, {
    isOpen: showFiltersMobile,
    onClose: () => setShowFiltersMobile(false),
    lockScroll: true,
  });

  const [loadTimedOut, setLoadTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const safeVehicles = useMemo(() => vehicles || [], [vehicles]);

  const isDateFilterApplied = Boolean(
    activePickupDate &&
    activeReturnDate &&
    activeReturnDate >= activePickupDate
  );

  const { availabilityMap } = useRangeAvailability(
    safeVehicles,
    isDateFilterApplied ? activePickupDate : undefined,
    isDateFilterApplied ? activeReturnDate : undefined
  );

  const priceBounds = useMemo(() => {
    const prices = safeVehicles.map((v) => Number(v.dailyPrice)).filter((n) => Number.isFinite(n));
    if (prices.length === 0) return { min: 35, max: 100 };
    const min = Math.floor(Math.min(...prices) / 5) * 5;
    const max = Math.max(Math.ceil(Math.max(...prices) / 5) * 5, min + 5);
    return { min, max };
  }, [safeVehicles]);
  const maxPrice = maxPriceCap === null ? priceBounds.max : Math.min(Math.max(maxPriceCap, priceBounds.min), priceBounds.max);

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(safeVehicles.map((v) => v.brand)));
  }, [safeVehicles]);

  const uniqueYears = useMemo(() => {
    return Array.from(new Set(safeVehicles.map((v) => v.year))).sort((a, b) => b - a);
  }, [safeVehicles]);

  const uniqueSeats = useMemo(() => {
    return Array.from(new Set(safeVehicles.map((v) => v.seats))).sort((a, b) => a - b);
  }, [safeVehicles]);

  const hasPriceFilter = maxPriceCap !== null && maxPriceCap < priceBounds.max;

  const updateQuery = (patch: Partial<CatalogQueryState>) => {
    const nextState: CatalogQueryState = {
      ...urlState,
      ...patch,
    };
    const nextParams = buildCatalogSearchParams(nextState, priceBounds.max);
    setSearchParams(nextParams, { replace: true, scroll: false });
  };

  const handleSearchInputChange = (val: string) => {
    setSearchInput(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const trimmed = val.trim();
      lastSyncedQRef.current = trimmed;
      updateQuery({ q: trimmed });
    }, 300);
  };

  const clearSearchQuery = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    lastSyncedQRef.current = '';
    setSearchInput('');
    updateQuery({ q: '' });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (category !== 'all') count++;
    if (searchInput.trim()) count++;
    if (selectedBrand !== 'all') count++;
    if (selectedYear !== 'all') count++;
    if (transmission !== 'all') count++;
    if (fuelType !== 'all') count++;
    if (seats !== 'all') count++;
    if (availability !== 'all') count++;
    if (hasPriceFilter) count++;
    return count;
  }, [category, searchInput, selectedBrand, selectedYear, transmission, fuelType, seats, availability, hasPriceFilter]);

  const filteredVehicles = useMemo(() => {
    return safeVehicles
      .filter((vehicle) => {
        if (category !== 'all' && vehicle.category !== category) return false;

        if (searchInput.trim()) {
          const q = searchInput.trim().toLowerCase();
          const match =
            vehicle.brand.toLowerCase().includes(q) ||
            vehicle.model.toLowerCase().includes(q) ||
            vehicle.color.toLowerCase().includes(q);
          if (!match) return false;
        }

        if (selectedBrand !== 'all' && vehicle.brand !== selectedBrand) return false;
        if (selectedYear !== 'all' && vehicle.year !== selectedYear) return false;
        if (transmission !== 'all' && vehicle.transmission !== transmission) return false;
        if (fuelType !== 'all' && vehicle.fuelType !== fuelType) return false;
        if (seats !== 'all' && vehicle.seats !== seats) return false;
        if (vehicle.dailyPrice > maxPrice) return false;

        if (availability === 'available' && vehicle.status !== 'available') return false;
        if (availability === 'rented' && vehicle.status !== 'rented') return false;

        if (isDateFilterApplied && activePickupDate && activeReturnDate) {
          if (vehicle.id in availabilityMap) {
            if (!availabilityMap[vehicle.id]) return false;
          } else if (isVehicleLocallyUnavailableForRange(vehicle, activePickupDate, activeReturnDate)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.dailyPrice - b.dailyPrice;
        if (sortBy === 'price-desc') return b.dailyPrice - a.dailyPrice;
        if (sortBy === 'year-desc') return b.year - a.year;

        // 'recommended': available cars first, then lowest daily price
        if (a.status === 'available' && b.status !== 'available') return -1;
        if (b.status === 'available' && a.status !== 'available') return 1;
        return a.dailyPrice - b.dailyPrice;
      });
  }, [
    safeVehicles,
    category,
    searchInput,
    selectedBrand,
    selectedYear,
    transmission,
    fuelType,
    seats,
    maxPrice,
    availability,
    isDateFilterApplied,
    activePickupDate,
    activeReturnDate,
    availabilityMap,
    sortBy,
  ]);

  const resetFilters = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    lastSyncedQRef.current = '';
    setSearchInput('');
    setSearchParams(
      buildCatalogSearchParams({ from: urlState.from, to: urlState.to }, priceBounds.max),
      { replace: true, scroll: false }
    );
  };

  const handleClearActiveDates = () => {
    updateQuery({ from: '', to: '' });
  };

  return (
    <section className="py-10 sm:py-12 bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Active Dates Banner / Bar (rendered ONLY when a valid date filter is applied) */}
        {isDateFilterApplied && activePickupDate && activeReturnDate && (
          <div className="mb-6 bg-amber-500/10 border border-amber-500/40 rounded-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5 text-amber-300">
              <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
              <span>
                فترة الحجز المختارة: من <strong className="text-white font-mono inline-block tabular-nums" dir="ltr"><bdi dir="ltr">{formatDateDisplay(activePickupDate)}</bdi></strong> إلى <strong className="text-white font-mono inline-block tabular-nums" dir="ltr"><bdi dir="ltr">{formatDateDisplay(activeReturnDate)}</bdi></strong>
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearActiveDates}
              className="min-h-11 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>إزالة تواريخ الحجز</span>
            </button>
          </div>
        )}

        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              اختر سيارتك المفضلة
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-1" aria-live="polite">
              {formatArabicVehicleCount(filteredVehicles.length)}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowFiltersMobile(true)}
              className="lg:hidden min-h-11 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm font-semibold flex items-center gap-2 cursor-pointer relative"
              aria-label="فتح فلاتر البحث"
            >
              <Filter className="w-4 h-4 text-amber-400" />
              <span>الفلاتر والتصنيفات</span>
              {activeFiltersCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center tabular-nums">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 min-h-11">
              <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={sortBy || 'recommended'}
                onChange={(e) => updateQuery({ sort: e.target.value as SortField })}
                aria-label="ترتيب السيارات"
                className="bg-transparent min-h-11 text-sm text-slate-200 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
              >
                <option value="recommended" className="bg-slate-900">الأكثر ملاءمة (المتاح أولاً)</option>
                <option value="price-asc" className="bg-slate-900">السعر: من الأقل للأعلى</option>
                <option value="price-desc" className="bg-slate-900">السعر: من الأعلى للأقل</option>
                <option value="year-desc" className="bg-slate-900">الموديل: الأحدث أولاً</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Chips Bar (Covers EVERY filter counted in activeFiltersCount) */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6 p-4 rounded-card bg-slate-900/60 border border-slate-800 text-sm">
            <span className="text-slate-300 text-sm font-semibold me-1">الفلاتر النشطة:</span>
            {category !== 'all' && (
              <span className="inline-flex items-center gap-1 ps-3 pe-1 py-0.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                <span>الفئة: {VEHICLE_CATEGORY_LABELS[category as VehicleCategory]}</span>
                <button
                  type="button"
                  onClick={() => updateQuery({ category: 'all' })}
                  className="min-w-11 min-h-11 -my-2 -me-1 inline-flex items-center justify-center rounded-lg hover:text-white cursor-pointer"
                  aria-label="إزالة فلتر الفئة"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {searchInput.trim() && (
              <span className="inline-flex items-center gap-1 ps-3 pe-1 py-0.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                <span>بحث: "{searchInput.trim()}"</span>
                <button
                  type="button"
                  onClick={clearSearchQuery}
                  className="min-w-11 min-h-11 -my-2 -me-1 inline-flex items-center justify-center rounded-lg hover:text-white cursor-pointer"
                  aria-label="إزالة فلتر البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {selectedBrand !== 'all' && (
              <span className="inline-flex items-center gap-1 ps-3 pe-1 py-0.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                <span>الشركة: {selectedBrand}</span>
                <button
                  type="button"
                  onClick={() => updateQuery({ brand: 'all' })}
                  className="min-w-11 min-h-11 -my-2 -me-1 inline-flex items-center justify-center rounded-lg hover:text-white cursor-pointer"
                  aria-label="إزالة فلتر الشركة"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {selectedYear !== 'all' && (
              <span className="inline-flex items-center gap-1 ps-3 pe-1 py-0.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold tabular-nums">
                <span>السنة: {selectedYear}</span>
                <button
                  type="button"
                  onClick={() => updateQuery({ year: 'all' })}
                  className="min-w-11 min-h-11 -my-2 -me-1 inline-flex items-center justify-center rounded-lg hover:text-white cursor-pointer"
                  aria-label="إزالة فلتر سنة الصنع"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {transmission !== 'all' && (
              <span className="inline-flex items-center gap-1 ps-3 pe-1 py-0.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                <span>الناقل: {TRANSMISSION_LABEL[transmission]}</span>
                <button
                  type="button"
                  onClick={() => updateQuery({ transmission: 'all' })}
                  className="min-w-11 min-h-11 -my-2 -me-1 inline-flex items-center justify-center rounded-lg hover:text-white cursor-pointer"
                  aria-label="إزالة فلتر ناقل الحركة"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {fuelType !== 'all' && (
              <span className="inline-flex items-center gap-1 ps-3 pe-1 py-0.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                <span>الوقود: {FUEL_LABEL[fuelType]}</span>
                <button
                  type="button"
                  onClick={() => updateQuery({ fuel: 'all' })}
                  className="min-w-11 min-h-11 -my-2 -me-1 inline-flex items-center justify-center rounded-lg hover:text-white cursor-pointer"
                  aria-label="إزالة فلتر نوع الوقود"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {seats !== 'all' && (
              <span className="inline-flex items-center gap-1 ps-3 pe-1 py-0.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold tabular-nums">
                <span>المقاعد: {seats}</span>
                <button
                  type="button"
                  onClick={() => updateQuery({ seats: 'all' })}
                  className="min-w-11 min-h-11 -my-2 -me-1 inline-flex items-center justify-center rounded-lg hover:text-white cursor-pointer"
                  aria-label="إزالة فلتر عدد المقاعد"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {availability !== 'all' && (
              <span className="inline-flex items-center gap-1 ps-3 pe-1 py-0.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                <span>التوفر: {AVAILABILITY_CHIP_LABEL[availability]}</span>
                <button
                  type="button"
                  onClick={() => updateQuery({ availability: 'all' })}
                  className="min-w-11 min-h-11 -my-2 -me-1 inline-flex items-center justify-center rounded-lg hover:text-white cursor-pointer"
                  aria-label="إزالة فلتر التوفر"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            {hasPriceFilter && (
              <span className="inline-flex items-center gap-1 ps-3 pe-1 py-0.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold tabular-nums">
                <span>السعر الأقصى: {formatMoney(maxPrice)}</span>
                <button
                  type="button"
                  onClick={() => updateQuery({ max: null })}
                  className="min-w-11 min-h-11 -my-2 -me-1 inline-flex items-center justify-center rounded-lg hover:text-white cursor-pointer"
                  aria-label="إزالة فلتر السعر الأقصى"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="min-h-11 px-3 text-sm text-rose-400 hover:text-rose-300 underline font-semibold ms-auto cursor-pointer"
            >
              مسح الكل
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Desktop Sidebar Filters */}
          <div className="hidden lg:block bg-slate-900/90 border border-slate-800 rounded-modal p-6 space-y-6 sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <span className="font-bold text-white text-base flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-400" />
                تصفية النتائج
              </span>
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-11 px-2 text-sm text-amber-400 hover:underline font-semibold cursor-pointer"
              >
                إعادة ضبط
              </button>
            </div>

            <div>
              <label htmlFor="desktop-search-input" className="block text-sm font-semibold text-slate-300 mb-2">
                بحث بالاسم أو الطراز
              </label>
              <SearchInput
                id="desktop-search-input"
                value={searchInput}
                onChange={handleSearchInputChange}
                placeholder="مثال: أوبتيما، إلنترا، BYD..."
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-slate-300 mb-2">
                فئة السيارة
              </span>
              <div className="space-y-1.5">
                {[
                  { id: 'all', label: 'جميع الفئات' },
                  { id: 'light', label: VEHICLE_CATEGORY_LABELS.light },
                  { id: 'medium', label: VEHICLE_CATEGORY_LABELS.medium },
                  { id: 'jeep_7seats', label: VEHICLE_CATEGORY_LABELS.jeep_7seats },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateQuery({ category: item.id as VehicleCategory | 'all' })}
                    className={`w-full min-h-11 text-start px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      category === item.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="desktop-max-price-range" className="text-sm font-semibold text-slate-300">
                  الحد الأقصى للسعر اليومي
                </label>
                <span className="text-amber-400 font-bold text-sm tabular-nums">{formatMoney(maxPrice)} / يوم</span>
              </div>
              <input
                id="desktop-max-price-range"
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step="5"
                value={maxPrice}
                onChange={(e) => updateQuery({ max: Number(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
              <div className="flex justify-between text-sm text-slate-400 mt-1 tabular-nums">
                <span>{formatMoney(priceBounds.min)}</span>
                <span>{formatMoney(priceBounds.max)}</span>
              </div>
            </div>

            <div>
              <label htmlFor="desktop-brand-select" className="block text-sm font-semibold text-slate-300 mb-2">
                الشركة المصنعة
              </label>
              <select
                id="desktop-brand-select"
                value={selectedBrand || 'all'}
                onChange={(e) => updateQuery({ brand: e.target.value })}
                className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
              >
                <option value="all">جميع الشركات</option>
                {uniqueBrands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="desktop-year-select" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  سنة الصنع
                </label>
                <select
                  id="desktop-year-select"
                  value={selectedYear === 'all' ? 'all' : String(selectedYear)}
                  onChange={(e) => updateQuery({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer tabular-nums"
                >
                  <option value="all">الكل</option>
                  {uniqueYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="desktop-seats-select" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  عدد المقاعد
                </label>
                <select
                  id="desktop-seats-select"
                  value={seats === 'all' ? 'all' : String(seats)}
                  onChange={(e) => updateQuery({ seats: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer tabular-nums"
                >
                  <option value="all">الكل</option>
                  {uniqueSeats.map((s) => (
                    <option key={s} value={String(s)}>{s} مقاعد</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="desktop-transmission-select" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  ناقل الحركة
                </label>
                <select
                  id="desktop-transmission-select"
                  value={transmission || 'all'}
                  onChange={(e) => updateQuery({ transmission: e.target.value as TransmissionType | 'all' })}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                >
                  <option value="all">الكل</option>
                  <option value="automatic">{TRANSMISSION_LABEL.automatic}</option>
                  <option value="manual">{TRANSMISSION_LABEL.manual}</option>
                </select>
              </div>

              <div>
                <label htmlFor="desktop-fuel-select" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  نوع الوقود
                </label>
                <select
                  id="desktop-fuel-select"
                  value={fuelType || 'all'}
                  onChange={(e) => updateQuery({ fuel: e.target.value as FuelType | 'all' })}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                >
                  <option value="all">الكل</option>
                  <option value="petrol">{FUEL_LABEL.petrol}</option>
                  <option value="diesel">{FUEL_LABEL.diesel}</option>
                  <option value="hybrid">{FUEL_LABEL.hybrid}</option>
                  <option value="electric">{FUEL_LABEL.electric}</option>
                </select>
              </div>
            </div>

            <div>
              <span className="block text-sm font-semibold text-slate-300 mb-2">
                حالة السيارة
              </span>
              <div className="flex gap-2">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'available', label: 'متاحة فوراً' },
                  { id: 'rented', label: 'مؤجرة حالياً' },
                ].map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => updateQuery({ availability: a.id as 'all' | 'available' | 'rented' })}
                    className={`flex-1 min-h-11 py-2 px-1 text-sm rounded-xl border font-semibold cursor-pointer ${
                      availability === a.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cars Grid */}
          <div className="lg:col-span-3">
            {safeVehicles.length === 0 && !loadTimedOut ? (
              <SkeletonLoader type="card" lines={6} className="!grid-cols-1 md:!grid-cols-2 xl:!grid-cols-3" />
            ) : filteredVehicles.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-modal p-12 text-center space-y-4 shadow-xl">
                <EmptyState
                  title="لا توجد سيارات مطابقة لمعايير البحث"
                  description="جرّب تغيير فئة السيارة أو تمديد نطاق السعر أو إلغاء بعض الفلاتر لعرض المزيد من سيارات أسطول شاكر."
                  actionLabel="مسح الفلاتر"
                  onAction={resetFilters}
                />
                <div>
                  <button
                    type="button"
                    onClick={() => openWhatsAppChat(undefined, 'مرحباً شركة شاكر، أود الاستفسار عن سيارة مطابقة لطلبي')}
                    className="min-h-11 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm inline-flex items-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>اسألنا على واتساب</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredVehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    variant="catalog"
                    onViewDetails={onViewDetails}
                    onBook={onBook}
                    bookTo={buildBookingUrl(
                      vehicle.id,
                      isDateFilterApplied ? { from: activePickupDate, to: activeReturnDate } : undefined
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters Bottom Sheet */}
      {showFiltersMobile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="فلاتر البحث وتصنيفات الأسطول"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200 lg:hidden"
          onClick={() => setShowFiltersMobile(false)}
        >
          <div
            ref={mobileFilterRef}
            className="bg-slate-900 border-t border-slate-800 rounded-t-3xl p-6 max-h-[85dvh] overflow-y-auto space-y-6 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <span className="font-bold text-white text-base flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                تصفية النتائج والفلاتر
              </span>
              <button
                type="button"
                onClick={() => setShowFiltersMobile(false)}
                className="min-w-11 min-h-11 p-2.5 rounded-full bg-slate-800 text-slate-200 hover:text-white inline-flex items-center justify-center cursor-pointer"
                aria-label="إغلاق الفلاتر"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label htmlFor="mobile-search-input" className="block text-sm font-semibold text-slate-300 mb-2">
                بحث بالاسم أو الطراز
              </label>
              <SearchInput
                id="mobile-search-input"
                value={searchInput}
                onChange={handleSearchInputChange}
                placeholder="مثال: أوبتيما، إلنترا، BYD..."
              />
            </div>

            <div>
              <span className="block text-sm font-semibold text-slate-300 mb-2">
                فئة السيارة
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'all', label: 'جميع الفئات' },
                  { id: 'light', label: VEHICLE_CATEGORY_LABELS.light },
                  { id: 'medium', label: VEHICLE_CATEGORY_LABELS.medium },
                  { id: 'jeep_7seats', label: VEHICLE_CATEGORY_LABELS.jeep_7seats },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateQuery({ category: item.id as VehicleCategory | 'all' })}
                    className={`min-h-11 py-2 px-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                      category === item.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-950 text-slate-300 border border-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="mobile-max-price-range" className="text-sm font-semibold text-slate-300">
                  الحد الأقصى للسعر اليومي
                </label>
                <span className="text-amber-400 font-bold text-sm tabular-nums">{formatMoney(maxPrice)} / يوم</span>
              </div>
              <input
                id="mobile-max-price-range"
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step="5"
                value={maxPrice}
                onChange={(e) => updateQuery({ max: Number(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mobile-year-select" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  سنة الصنع
                </label>
                <select
                  id="mobile-year-select"
                  value={selectedYear === 'all' ? 'all' : String(selectedYear)}
                  onChange={(e) => updateQuery({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer tabular-nums"
                >
                  <option value="all">الكل</option>
                  {uniqueYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="mobile-seats-select" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  عدد المقاعد
                </label>
                <select
                  id="mobile-seats-select"
                  value={seats === 'all' ? 'all' : String(seats)}
                  onChange={(e) => updateQuery({ seats: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer tabular-nums"
                >
                  <option value="all">الكل</option>
                  {uniqueSeats.map((s) => (
                    <option key={s} value={String(s)}>{s} مقاعد</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mobile-transmission-select" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  ناقل الحركة
                </label>
                <select
                  id="mobile-transmission-select"
                  value={transmission || 'all'}
                  onChange={(e) => updateQuery({ transmission: e.target.value as TransmissionType | 'all' })}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                >
                  <option value="all">الكل</option>
                  <option value="automatic">{TRANSMISSION_LABEL.automatic}</option>
                  <option value="manual">{TRANSMISSION_LABEL.manual}</option>
                </select>
              </div>

              <div>
                <label htmlFor="mobile-fuel-select" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  نوع الوقود
                </label>
                <select
                  id="mobile-fuel-select"
                  value={fuelType || 'all'}
                  onChange={(e) => updateQuery({ fuel: e.target.value as FuelType | 'all' })}
                  className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                >
                  <option value="all">الكل</option>
                  <option value="petrol">{FUEL_LABEL.petrol}</option>
                  <option value="diesel">{FUEL_LABEL.diesel}</option>
                  <option value="hybrid">{FUEL_LABEL.hybrid}</option>
                  <option value="electric">{FUEL_LABEL.electric}</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-11 px-4 py-3 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة ضبط</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFiltersMobile(false)}
                className="flex-1 min-h-11 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <span>{formatArabicVehicleCountShort(filteredVehicles.length)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
