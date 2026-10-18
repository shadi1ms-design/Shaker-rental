import React, { useState } from 'react';
import {
  ShieldCheck,
  Clock,
  MapPin,
  Sparkles,
  Car,
  CheckCircle2,
  Calendar,
  Search,
  Users,
  Fuel,
  Tag
} from 'lucide-react';
import { Vehicle, VehicleCategory, SearchFilters } from '../types';
import { VEHICLE_CATEGORY_LABELS } from '../constants/vehicleCategories';

interface HeroSectionProps {
  vehicles?: Vehicle[];
  onSearch?: (filters: SearchFilters) => void;
  onExploreCars?: () => void;
  onSelectVehicle?: (v: Vehicle) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onSearch }) => {
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [category, setCategory] = useState<VehicleCategory | 'all'>('all');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        pickupDate: pickupDate || undefined,
        returnDate: returnDate || undefined,
        category,
      });
    }
  };

  const handleQuickCategory = (cat: VehicleCategory | 'all') => {
    if (onSearch) {
      onSearch({
        category: cat,
      });
    }
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Background visual image layer (Skyline/Automotive) with subtle opacity */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-10 mix-blend-luminosity"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1920&q=80')`,
        }}
      />

      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute -top-10 -right-20 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-8">
          {/* Tag badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/30 text-amber-400 text-xs sm:text-sm font-semibold mb-6 shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>الخيار الأول والفاخر لتأجير السيارات في دمشق وريفها</span>
          </div>

          {/* Company Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-4">
            شاكر <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500">لتأجير السيارات</span>
          </h1>

          {/* Professional Slogan */}
          <p className="text-2xl sm:text-3xl lg:text-3xl font-extrabold text-slate-200 mb-6 font-tajawal tracking-wide">
            "سيارتك جاهزة عندما تكون أنت جاهزاً"
          </p>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            أسطول حديث من السيارات الاقتصادية، السيدان المتوسطة، وجيب العائلات 7 ركاب. أسعار واضحة ومنافسة، مع خصومات أسبوعية وشهرية وعقود إيجار نظامية معتمدة.
          </p>
        </div>

        {/* Hero Search Box */}
        <div className="max-w-4xl mx-auto mb-6">
          <form
            onSubmit={handleSearchSubmit}
            className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl shadow-black/60"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>تاريخ الاستلام</span>
                </label>
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>تاريخ الإرجاع</span>
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-amber-400" />
                  <span>فئة السيارة</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as VehicleCategory | 'all')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="all">جميع فئات الأسطول</option>
                  <option value="light">{VEHICLE_CATEGORY_LABELS.light}</option>
                  <option value="medium">{VEHICLE_CATEGORY_LABELS.medium}</option>
                  <option value="jeep_7seats">{VEHICLE_CATEGORY_LABELS.jeep_7seats}</option>
                </select>
              </div>

              <div className="sm:col-span-3 lg:col-span-1">
                <button
                  type="submit"
                  className="w-full py-2.5 sm:py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Search className="w-4 h-4 text-slate-950" />
                  <span>بحث عن سيارة</span>
                </button>
              </div>
            </div>
          </form>

          {/* Quick Category Chips with 16-18px icons */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4">
            <span className="text-xs text-slate-400 font-medium ml-1">تصفح سريع:</span>
            
            <button
              type="button"
              onClick={() => handleQuickCategory('light')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-slate-200 hover:text-emerald-300 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
            >
              <Fuel className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>اقتصادي أقل من 35$</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickCategory('medium')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-amber-300 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
            >
              <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>سيدان متوسط فاخر</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickCategory('jeep_7seats')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 text-slate-200 hover:text-blue-300 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
            >
              <Users className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
              <span>جيب 7 مقاعد</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickCategory('all')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/40 text-slate-200 hover:text-rose-300 text-xs font-semibold transition-all cursor-pointer shadow-sm group"
            >
              <Tag className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              <span>خصومات أسبوعية وشهرية</span>
            </button>
          </div>
        </div>

        {/* Value Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 max-w-5xl mx-auto">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <div className="text-white font-bold text-sm">صيانة وتأمين شامل</div>
            <div className="text-xs text-slate-400 mt-1">تغيير زيت دوري كل 5000 كم</div>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 text-center">
            <ShieldCheck className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <div className="text-white font-bold text-sm">عقود رسمية نظامية</div>
            <div className="text-xs text-slate-400 mt-1">شروط واضحة وحماية للمستأجر</div>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 text-center">
            <Clock className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <div className="text-white font-bold text-sm">تسليم واستلام فوري</div>
            <div className="text-xs text-slate-400 mt-1">خدمة تسليم بالموقع أو المطار</div>
          </div>
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 text-center">
            <MapPin className="w-6 h-6 text-rose-400 mx-auto mb-2" />
            <div className="text-white font-bold text-sm">دمشق – جرمانا</div>
            <div className="text-xs text-slate-400 mt-1">شارع النسيم</div>
          </div>
        </div>
      </div>
    </section>
  );
};
