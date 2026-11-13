import React, { useState } from 'react';
import {
  Calendar,
  Search,
  Clock,
  MapPin,
  Phone,
  ArrowLeft,
} from 'lucide-react';
import { SearchFilters } from '../types';
import { addDaysISO, todayLocalISO } from '../utils/dateUtils';
import { DateField } from './ui/DateField';
import { COMPANY_INFO } from '../constants/company';
import { navigate, routes } from '../router';

interface HeroSectionProps {
  onSearch?: (filters: SearchFilters) => void;
  onBrowseFleet?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onSearch, onBrowseFleet }) => {
  const todayDamascus = todayLocalISO();
  const tomorrowDamascus = addDaysISO(todayDamascus, 1);

  const [pickupDate, setPickupDate] = useState(todayDamascus);
  const [returnDate, setReturnDate] = useState(tomorrowDamascus);

  const handlePickupChange = (val: string) => {
    setPickupDate(val);
    if (val && (!returnDate || returnDate <= val)) {
      setReturnDate(addDaysISO(val, 1));
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch({
        pickupDate: pickupDate || undefined,
        returnDate: returnDate || undefined,
      });
    }
  };

  const handleBrowseClick = () => {
    if (onBrowseFleet) {
      onBrowseFleet();
    } else {
      navigate(routes.cars);
    }
  };

  return (
    <section className="relative overflow-hidden py-12 lg:py-20 bg-slate-950">
      {/* Background Hero Image (Single LCP image with fetchPriority="high") */}
      <img
        src="/hero-v2.webp"
        alt=""
        aria-hidden="true"
        width="1600"
        height="900"
        fetchPriority="high"
        className="absolute inset-0 w-full h-full object-cover object-[70%_center] sm:object-center z-0"
      />

      {/* Strong dark gradient overlay for WCAG AA contrast readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/75 to-slate-950 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-slate-950/40 to-slate-950 pointer-events-none z-0" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-8 space-y-3">
          {/* Company Title (Single H1 on Home) */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            شاكر <span className="text-amber-400">لتأجير السيارات</span>
          </h1>

          {/* Starting price line */}
          <p className="text-base sm:text-lg font-bold text-amber-300 tabular-nums">
            تبدأ الأسعار من 30 دولاراً في اليوم
          </p>

          <p className="text-sm sm:text-base text-slate-200 max-w-2xl mx-auto">
            أسطول حديث من سيارات السيدان الاقتصادية، السيدان الفسيحة، وسيارات SUV العائلية في دمشق وريفها.
          </p>

          <div className="pt-1 flex items-center justify-center">
            <button
              type="button"
              onClick={handleBrowseClick}
              className="min-h-11 px-5 py-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/40 font-bold text-sm inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>تصفح الأسطول</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hero Search Box (pickup date, return date, search) */}
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={handleSearchSubmit}
            className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-modal p-4 sm:p-5 shadow-2xl shadow-black/70"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end">
              <div>
                <label htmlFor="hero-pickup-date" className="text-sm font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>تاريخ الاستلام</span>
                </label>
                <DateField
                  id="hero-pickup-date"
                  value={pickupDate}
                  onChange={handlePickupChange}
                  min={todayDamascus}
                  ariaLabel="تاريخ الاستلام"
                />
              </div>

              <div>
                <label htmlFor="hero-return-date" className="text-sm font-semibold text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>تاريخ الإرجاع</span>
                </label>
                <DateField
                  id="hero-return-date"
                  value={returnDate}
                  onChange={setReturnDate}
                  min={pickupDate || todayDamascus}
                  ariaLabel="تاريخ الإرجاع"
                />
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full min-h-[44px] py-2.5 sm:py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Search className="w-4 h-4 text-slate-950" />
                  <span>ابحث عن المتاح</span>
                </button>
              </div>
            </div>
          </form>

          {/* Trust bar using strictly verified COMPANY_INFO facts */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 mt-5 text-sm text-slate-200 font-semibold flex-wrap text-center px-4">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{COMPANY_INFO.location}</span>
            </span>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{COMPANY_INFO.workingHours}</span>
            </span>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">•</span>
            <a
              href={`tel:${COMPANY_INFO.phoneRaw}`}
              className="inline-flex items-center gap-1.5 hover:text-amber-300 transition-colors"
            >
              <Phone className="w-4 h-4 text-amber-400 shrink-0" />
              <span dir="ltr" className="tabular-nums font-mono">{COMPANY_INFO.phone}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
