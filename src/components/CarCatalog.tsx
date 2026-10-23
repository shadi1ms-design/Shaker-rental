import React, { useState, useMemo } from 'react';
import { VehicleImageCarousel } from './common/VehicleImageCarousel';
import {
  Vehicle,
  VehicleCategory,
  FuelType,
  TransmissionType,
  SearchFilters,
  SortField
} from '../types';
import { DEFAULT_SETTINGS } from '../services/pricing';
import { VEHICLE_CATEGORY_LABELS, getVehicleCategoryLabel } from '../constants/vehicleCategories';
import {
  Users,
  Fuel,
  Settings,
  Sparkles,
  Search,
  Filter,
  ArrowUpDown,
  AlertCircle,
  Clock,
  Info,
  Calendar,
} from 'lucide-react';

interface CarCatalogProps {
  vehicles?: Vehicle[];
  onSelectCar?: (vehicle: Vehicle) => void;
  onBookCar?: (vehicle: Vehicle) => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  onViewDetails?: (vehicle: Vehicle) => void;
  selectedCategory?: VehicleCategory | 'all';
  initialFilters?: SearchFilters | null;
}

export const CarCatalog: React.FC<CarCatalogProps> = ({
  vehicles = [],
  onSelectCar,
  onBookCar,
  onSelectVehicle,
  onViewDetails,
  selectedCategory = 'all',
  initialFilters,
}) => {
  // Safe resolved handlers
  const handleBooking = (v: Vehicle) => {
    if (typeof onBookCar === 'function') {
      onBookCar(v);
    } else if (typeof onSelectVehicle === 'function') {
      onSelectVehicle(v);
    }
  };

  const handleDetails = (v: Vehicle) => {
    if (typeof onSelectCar === 'function') {
      onSelectCar(v);
    } else if (typeof onViewDetails === 'function') {
      onViewDetails(v);
    }
  };

  // Filter states
  const [category, setCategory] = useState<VehicleCategory | 'all'>(
    initialFilters?.category || selectedCategory
  );
  const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery || '');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [transmission, setTransmission] = useState<TransmissionType | 'all'>(
    initialFilters?.transmission || 'all'
  );
  const [fuelType, setFuelType] = useState<FuelType | 'all'>('all');
  const [seats, setSeats] = useState<number | 'all'>('all');
  const [availability, setAvailability] = useState<'all' | 'available' | 'rented'>('all');
  // null = no cap (follows the most expensive vehicle), so no vehicle is hidden by default
  const [maxPriceCap, setMaxPriceCap] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortField>('price-asc');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Sync category or initialFilters prop if updated from Hero search
  React.useEffect(() => {
    if (initialFilters?.category) {
      setCategory(initialFilters.category);
    } else if (selectedCategory) {
      setCategory(selectedCategory);
    }
    if (initialFilters?.searchQuery) {
      setSearchQuery(initialFilters.searchQuery);
    }
    if (initialFilters?.transmission) {
      setTransmission(initialFilters.transmission);
    }
  }, [selectedCategory, initialFilters]);

  // Unique lists for filters
  const safeVehicles = vehicles || [];

  // Slider bounds follow the real fleet prices instead of a hard-coded 35$-100$ range
  const priceBounds = useMemo(() => {
    const prices = safeVehicles.map((v) => Number(v.dailyPrice)).filter((n) => Number.isFinite(n));
    if (prices.length === 0) return { min: 35, max: 100 };
    const min = Math.floor(Math.min(...prices) / 5) * 5;
    const max = Math.max(Math.ceil(Math.max(...prices) / 5) * 5, min + 5);
    return { min, max };
  }, [safeVehicles]);
  const maxPrice = maxPriceCap === null ? priceBounds.max : Math.min(Math.max(maxPriceCap, priceBounds.min), priceBounds.max);

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(safeVehicles.map(v => v.brand)));
  }, [safeVehicles]);

  // Filter and sort logic
  const filteredVehicles = useMemo(() => {
    return safeVehicles
      .filter((vehicle) => {
        // Category
        if (category !== 'all' && vehicle.category !== category) return false;

        // Search Query (brand, model, color)
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            vehicle.brand.toLowerCase().includes(q) ||
            vehicle.model.toLowerCase().includes(q) ||
            vehicle.color.toLowerCase().includes(q);
          if (!match) return false;
        }

        // Brand
        if (selectedBrand !== 'all' && vehicle.brand !== selectedBrand) return false;

        // Year
        if (selectedYear !== 'all' && vehicle.year !== selectedYear) return false;

        // Transmission
        if (transmission !== 'all' && vehicle.transmission !== transmission) return false;

        // Fuel
        if (fuelType !== 'all' && vehicle.fuelType !== fuelType) return false;

        // Seats
        if (seats !== 'all' && vehicle.seats !== seats) return false;

        // Price
        if (vehicle.dailyPrice > maxPrice) return false;

        // Availability
        if (availability === 'available' && vehicle.status !== 'available') return false;
        if (availability === 'rented' && vehicle.status !== 'rented') return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.dailyPrice - b.dailyPrice;
        if (sortBy === 'price-desc') return b.dailyPrice - a.dailyPrice;
        if (sortBy === 'year-desc') return b.year - a.year;
        if (sortBy === 'popularity') return b.year - a.year; // Fallback
        return 0;
      });
  }, [
    vehicles,
    category,
    searchQuery,
    selectedBrand,
    selectedYear,
    transmission,
    fuelType,
    seats,
    maxPrice,
    availability,
    sortBy,
  ]);

  const getCategoryLabel = (cat: VehicleCategory) => {
    return getVehicleCategoryLabel(cat);
  };

  const resetFilters = () => {
    setCategory('all');
    setSearchQuery('');
    setSelectedBrand('all');
    setSelectedYear('all');
    setTransmission('all');
    setFuelType('all');
    setSeats('all');
    setAvailability('all');
    setMaxPriceCap(null);
    setSortBy('price-asc');
  };

  return (
    <section className="py-12 bg-slate-950 text-slate-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2">
              <Sparkles className="w-4 h-4" />
              <span>أسطول شركة شاكر لتأجير السيارات</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              اختر سيارتك المفضلة
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              متاح لدينا {filteredVehicles.length} سيارة جاهزة للتأجير الفوري في دمشق وجرمانا
            </p>
          </div>

          {/* Quick Sort & Mobile Filter Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
              className="lg:hidden px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-sm font-semibold flex items-center gap-2"
            >
              <Filter className="w-4 h-4 text-amber-400" />
              <span>الفلاتر والتصنيفات</span>
            </button>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
              <ArrowUpDown className="w-4 h-4 text-slate-400" />
              <select
                value={sortBy || 'price-asc'}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="bg-transparent text-sm text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="price-asc" className="bg-slate-900">السعر: من الأقل للأعلى</option>
                <option value="price-desc" className="bg-slate-900">السعر: من الأعلى للأقل</option>
                <option value="year-desc" className="bg-slate-900">الموديل: الأحدث أولاً</option>
                <option value="popularity" className="bg-slate-900">الأكثر طلباً</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Sidebar Filters */}
          <div
            className={`lg:block ${
              showFiltersMobile ? 'block' : 'hidden'
            } bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 sticky top-28 backdrop-blur-md`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <span className="font-bold text-white text-base flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-400" />
                تصفية النتائج
              </span>
              <button
                onClick={resetFilters}
                className="text-xs text-amber-400 hover:underline"
              >
                إعادة ضبط
              </button>
            </div>

            {/* Search Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                بحث بالاسم أو الطراز
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery || ''}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="مثال: أوبتيما، إلنترا، BYD..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 pl-9 text-sm text-white focus:outline-none focus:border-amber-500"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                فئة السيارة
              </label>
              <div className="space-y-1.5">
                {[
                  { id: 'all', label: 'جميع الفئات' },
                  { id: 'light', label: VEHICLE_CATEGORY_LABELS.light },
                  { id: 'medium', label: VEHICLE_CATEGORY_LABELS.medium },
                  { id: 'jeep_7seats', label: VEHICLE_CATEGORY_LABELS.jeep_7seats },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setCategory(item.id as VehicleCategory | 'all')}
                    className={`w-full text-right px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
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

            {/* Price Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-400">
                  الحد الأقصى للسعر اليومي
                </label>
                <span className="text-amber-400 font-bold text-xs">{maxPrice}$ / يوم</span>
              </div>
              <input
                type="range"
                min={priceBounds.min}
                max={priceBounds.max}
                step="5"
                value={maxPrice}
                onChange={(e) => setMaxPriceCap(Number(e.target.value))}
                className="w-full accent-amber-500 bg-slate-800 h-2 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>{priceBounds.min}$</span>
                <span>{Math.round((priceBounds.min * 2 + priceBounds.max) / 3 / 5) * 5}$</span>
                <span>{Math.round((priceBounds.min + priceBounds.max * 2) / 3 / 5) * 5}$</span>
                <span>{priceBounds.max}$</span>
              </div>
            </div>

            {/* Brand Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                الشركة المصنعة
              </label>
              <select
                value={selectedBrand || 'all'}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="all">جميع الشركات</option>
                {uniqueBrands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Transmission & Fuel */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  ناقل الحركة
                </label>
                <select
                  value={transmission || 'all'}
                  onChange={(e) => setTransmission(e.target.value as TransmissionType | 'all')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="automatic">أوتوماتيك</option>
                  <option value="manual">عادي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  نوع الوقود
                </label>
                <select
                  value={fuelType || 'all'}
                  onChange={(e) => setFuelType(e.target.value as FuelType | 'all')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                >
                  <option value="all">الكل</option>
                  <option value="petrol">بنزين</option>
                  <option value="hybrid">هايبرد هجين</option>
                  <option value="electric">كهرباء</option>
                </select>
              </div>
            </div>

            {/* Number of seats */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                عدد المقاعد
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 'all', label: 'الكل' },
                  { val: 5, label: '5 مقاعد' },
                  { val: 7, label: '7 مقاعد' },
                ].map((s) => (
                  <button
                    key={String(s.val)}
                    onClick={() => setSeats(s.val as number | 'all')}
                    className={`py-1.5 text-xs rounded-lg border font-semibold ${
                      seats === s.val
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Availability */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                حالة السيارة
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'available', label: 'متاحة فوراً' },
                  { id: 'rented', label: 'مؤجرة حالياً' },
                ].map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAvailability(a.id as 'all' | 'available' | 'rented')}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-semibold ${
                      availability === a.id
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'border-slate-800 text-slate-400 hover:bg-slate-800'
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
            {filteredVehicles.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center">
                <AlertCircle className="w-12 h-12 text-amber-400/80 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">لا توجد سيارات مطابقة لمعايير البحث</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                  جرّب تغيير فئة السيارة أو تمديد نطاق السعر أو إلغاء بعض الفلاتر لعرض المزيد من سيارات أسطول شاكر.
                </p>
                <button
                  onClick={resetFilters}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-sm hover:bg-amber-400 transition-colors"
                >
                  عرض جميع السيارات
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredVehicles.map((vehicle) => {
                  const isAvailable = vehicle.status === 'available';
                  const isRented = vehicle.status === 'rented';
                  const isMaintenance = vehicle.status === 'maintenance';

                  return (
                    <div
                      key={vehicle.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/50 hover:-translate-y-1 flex flex-col group"
                    >
                      {/* Car Image gallery (swipe between photos) */}
                      <VehicleImageCarousel vehicle={vehicle}>
                        {/* Category & Status Badges */}
                        <div className="absolute top-3 right-3">
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-950/85 text-amber-400 border border-amber-500/40 shadow-md">
                            {getCategoryLabel(vehicle.category)}
                          </span>
                        </div>

                        <div className="absolute top-3 left-3">
                          {isAvailable ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md bg-emerald-950/90 text-emerald-300 border border-emerald-500/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span>متاحة الآن</span>
                            </span>
                          ) : isRented ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md bg-rose-950/90 text-rose-300 border border-rose-500/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                              <span>مؤجرة حالياً</span>
                            </span>
                          ) : isMaintenance ? (
                            <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md bg-amber-950/90 text-amber-300 border border-amber-500/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                              <span>في الصيانة</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md bg-blue-950/90 text-blue-300 border border-blue-500/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                              <span>محجوزة</span>
                            </span>
                          )}
                        </div>
                      </VehicleImageCarousel>

                      {/* Car Details Content */}
                      <div className="p-5 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Title */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <span className="text-xs text-slate-400 font-semibold">{vehicle.brand}</span>
                              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                                {vehicle.model}
                              </h3>
                              <span className="text-xs text-slate-400 block mt-0.5">
                                موديل {vehicle.year} • {vehicle.color}
                              </span>
                            </div>
                            <div className="text-left">
                              <span className="text-2xl font-black text-amber-400">${vehicle.dailyPrice}</span>
                              <span className="text-xs text-slate-400 block font-normal">/ يوم</span>
                            </div>
                          </div>

                          {/* Quick Spec Icons */}
                          <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 my-3 text-xs text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-slate-400" />
                              <span>{vehicle.seats} مقاعد</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Settings className="w-4 h-4 text-slate-400" />
                              <span>{vehicle.transmission === 'automatic' ? 'أوتوماتيك' : 'عادي'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Fuel className="w-4 h-4 text-slate-400" />
                              <span>
                                {vehicle.fuelType === 'hybrid' ? 'هايبرد' : vehicle.fuelType === 'petrol' ? 'بنزين' : vehicle.fuelType}
                              </span>
                            </div>
                          </div>

                          {/* Member Discount Badge */}
                          <div className="bg-slate-950/60 rounded-xl p-2.5 mb-4 text-xs flex items-center justify-between border border-slate-800/60">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>خصم الأعضاء المسجلين:</span>
                            </span>
                            <span className="text-emerald-400 font-bold font-mono">
                              حتى {DEFAULT_SETTINGS.discountConfig?.percentage || 10}%
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleDetails(vehicle)}
                            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            <Info className="w-3.5 h-3.5 text-slate-400" />
                            <span>التفاصيل</span>
                          </button>

                          {isAvailable ? (
                            <button
                              type="button"
                              onClick={() => handleBooking(vehicle)}
                              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>احجز الآن</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="flex-1 py-2.5 rounded-xl bg-slate-800/80 text-rose-300 text-xs font-bold flex items-center justify-center gap-1 border border-rose-500/20 cursor-not-allowed opacity-90"
                              title="السيارة مؤجرة حالياً أو غير متاحة للحجز"
                            >
                              <Clock className="w-3.5 h-3.5 text-rose-400" />
                              <span>{isRented ? 'مؤجرة حالياً' : 'غير متاحة'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
