import React, { useState } from 'react';
import { Calendar, Search, ShieldCheck, Clock, MapPin, Sparkles, Car, CheckCircle2 } from 'lucide-react';
import { Vehicle, VehicleCategory } from '../types';

interface HeroSectionProps {
  vehicles?: Vehicle[];
  onSearch: (filters: { pickupDate: string; returnDate: string; category: VehicleCategory | 'all' }) => void;
  onExploreCars?: () => void;
  onSelectVehicle?: (v: Vehicle) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onSearch, onExploreCars }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const afterTomorrow = new Date();
  afterTomorrow.setDate(afterTomorrow.getDate() + 4);

  const [pickupDate, setPickupDate] = useState(tomorrow.toISOString().split('T')[0]);
  const [returnDate, setReturnDate] = useState(afterTomorrow.toISOString().split('T')[0]);
  const [category, setCategory] = useState<VehicleCategory | 'all'>('all');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ pickupDate, returnDate, category });
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute -top-10 -right-20 w-80 h-80 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-10 lg:mb-14">
          {/* Tag badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/30 text-amber-400 text-xs sm:text-sm font-semibold mb-6 shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>الخيار الأول والفاخر لتأجير السيارات في دمشق وريفها</span>
          </div>

          {/* Company Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-4">
            شاكر <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500">لتأجير السيارات</span>
          </h1>

          {/* Professional Slogan mandated by Prompt */}
          <p className="text-2xl sm:text-3xl lg:text-3xl font-extrabold text-slate-200 mb-6 font-tajawal tracking-wide">
            "سيارتك جاهزة عندما تكون أنت جاهزاً"
          </p>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            أسطول حديث من السيارات الاقتصادية، السيدان المتوسطة، وجيب العائلات 7 ركاب. أسعار واضحة ومنافسة، مع خصومات أسبوعية وشهرية وعقود إيجار نظامية معتمدة.
          </p>
        </div>

        {/* Search Availability Card (mandated in section 4) */}
        <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60 max-w-5xl mx-auto backdrop-blur-md">
          <div className="flex items-center gap-2 pb-5 border-b border-slate-800/80 mb-6 text-slate-300 font-bold text-base sm:text-lg">
            <Search className="w-5 h-5 text-amber-400" />
            <span>فحص توفر السيارات والحجز الفوري</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Pickup Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                تاريخ الاستلام
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* Return Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                تاريخ التسليم (الإعادة)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  min={pickupDate}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* Car Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                فئة السيارة المطلوبة
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VehicleCategory | 'all')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              >
                <option value="all">جميع الفئات المتاحة</option>
                <option value="light">سيدان اقتصادي (سبيكترا، فورتي)</option>
                <option value="medium">سيدان متوسط (أوبتيما، سوناتا، إلنترا، BYD)</option>
                <option value="jeep_7seats">جيب عائلي 7 مقاعد (سورينتو، فيراكروز)</option>
              </select>
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full h-[46px] rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                id="hero-search-btn"
              >
                <Search className="w-4 h-4 stroke-[2.5]" />
                <span>بحث عن سيارة متاحة</span>
              </button>
            </div>
          </form>

          {/* Quick Category shortcuts */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">الفئات الشائعة:</span>
              <button
                type="button"
                onClick={() => { setCategory('light'); onSearch({ pickupDate, returnDate, category: 'light' }); }}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                اقتصادي (من 35$ / يوم)
              </button>
              <button
                type="button"
                onClick={() => { setCategory('medium'); onSearch({ pickupDate, returnDate, category: 'medium' }); }}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                سيدان فاخر (أوبتيما، سوناتا، إلنترا)
              </button>
              <button
                type="button"
                onClick={() => { setCategory('jeep_7seats'); onSearch({ pickupDate, returnDate, category: 'jeep_7seats' }); }}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                جيب 7 مقاعد (65$ - 75$)
              </button>
            </div>

            <button
              type="button"
              onClick={onExploreCars}
              className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-4"
            >
              عرض كامل الأسطول (13 سيارة) ←
            </button>
          </div>
        </div>

        {/* Value Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 max-w-5xl mx-auto">
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
            <div className="text-xs text-slate-400 mt-1">شارع الخضر، مقابل المركز الثقافي</div>
          </div>
        </div>
      </div>
    </section>
  );
};
