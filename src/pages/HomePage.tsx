import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Info } from 'lucide-react';
import { HeroSection } from '../components/HeroSection';
import { BrowseByCategorySection } from '../components/home/BrowseByCategorySection';
import { HowItWorksSection } from '../components/home/HowItWorksSection';
import { VehicleCard } from '../components/common/VehicleCard';
import { FaqSection } from '../components/home/FaqSection';
import { CollapsibleSection } from '../components/common/CollapsibleSection';
import { PageTransition } from '../components/routing/PageTransition';
import { useAppData } from '../contexts/DataContext';
import { getItemVariants } from '../constants/motion';
import { navigate, routes } from '../router';
import { COMPANY_INFO } from '../constants/company';
import type { SearchFilters, Vehicle } from '../types';

/** / - hero search, browse by category, featured fleet, how it works, faq and about us. */
export const HomePage: React.FC = () => {
  const { vehicles, setActiveBookingFilters } = useAppData();
  const [aboutOpen, setAboutOpen] = useState(() => {
    return typeof window !== 'undefined' && window.location.hash === '#about-us';
  });
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#about-us') {
        setAboutOpen(true);
        setTimeout(() => {
          const el = document.getElementById('about-us');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      }
    };
    window.addEventListener('hashchange', handleHash);
    window.addEventListener('shaker:navigate', handleHash);
    if (window.location.hash === '#about-us') {
      handleHash();
    }
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('shaker:navigate', handleHash);
    };
  }, []);

  const handleHeroSearch = (filters: SearchFilters) => {
    setActiveBookingFilters(filters);
    navigate(routes.cars);
  };
  const handleBrowseFleet = () => {
    setActiveBookingFilters(undefined);
    navigate(routes.cars);
  };
  const bookVehicle = (v: Vehicle) => navigate(routes.book(v.id));
  const viewVehicle = (v: Vehicle) => navigate(routes.car(v.id));

  // Sort featured vehicles: available first, then others, up to 3 cards
  const featuredVehicles = [...vehicles]
    .sort((a, b) => {
      if (a.status === 'available' && b.status !== 'available') return -1;
      if (b.status === 'available' && a.status !== 'available') return 1;
      return b.year - a.year;
    })
    .slice(0, 3);

  // Track visible slide on mobile horizontal RTL carousel via IntersectionObserver
  useEffect(() => {
    const root = carouselRef.current;
    if (!root || featuredVehicles.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idxAttr = entry.target.getAttribute('data-slide-idx');
            if (idxAttr !== null) {
              const parsed = Number(idxAttr);
              if (Number.isInteger(parsed)) {
                setActiveSlide(parsed);
              }
            }
          }
        }
      },
      { root, threshold: 0.6 }
    );

    for (let i = 0; i < featuredVehicles.length; i++) {
      const el = slideRefs.current[i];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [featuredVehicles.length]);

  const scrollToSlide = (idx: number) => {
    setActiveSlide(idx);
    const el = slideRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  return (
    <PageTransition className="space-y-12 lg:space-y-16">
      <motion.div variants={getItemVariants()}>
        <HeroSection onSearch={handleHeroSearch} onBrowseFleet={handleBrowseFleet} />
      </motion.div>

      {/* Browse By Category Section */}
      <BrowseByCategorySection vehicles={vehicles} />

      {/* Featured Fleet Catalog Section */}
      <motion.section variants={getItemVariants()} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-2">
              الأسطول المختار بعناية
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">أحدث سيارات شركة شاكر في دمشق</h2>
          </div>

          <button
            type="button"
            onClick={handleBrowseFleet}
            className="min-h-11 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer"
          >
            <span>تصفح كامل الأسطول</span>
            <span className="text-sm opacity-90 tabular-nums font-semibold">({vehicles.length})</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Cars Grid: md:grid-cols-3 with mobile horizontal RTL scroll peek */}
        <div
          ref={carouselRef}
          dir="rtl"
          className="flex md:grid md:grid-cols-3 gap-6 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-none [-webkit-overflow-scrolling:touch]"
        >
          {featuredVehicles.map((vehicle, idx) => (
            <div
              key={vehicle.id}
              data-slide-idx={idx}
              ref={(el) => {
                slideRefs.current[idx] = el;
              }}
              className="w-[84%] sm:w-[68%] md:w-auto shrink-0 snap-center flex flex-col"
            >
              <VehicleCard vehicle={vehicle} variant="featured" onViewDetails={viewVehicle} onBook={bookVehicle} />
            </div>
          ))}
        </div>

        {/* Mobile scroll affordance indicator (tracks active slide) */}
        {featuredVehicles.length > 1 && (
          <div className="md:hidden flex items-center justify-center gap-1 mt-2 text-slate-300 text-sm">
            <div className="flex items-center">
              {featuredVehicles.map((v, idx) => {
                const isActive = activeSlide === idx;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => scrollToSlide(idx)}
                    aria-label={`عرض السيارة ${idx + 1}`}
                    aria-current={isActive ? 'true' : undefined}
                    className="min-w-11 min-h-11 inline-flex items-center justify-center cursor-pointer"
                  >
                    <span
                      className={`h-2 rounded-full transition-all ${
                        isActive ? 'w-5 bg-amber-400' : 'w-2 bg-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <span className="ms-1 text-slate-400 text-sm">اسحب للمزيد من السيارات</span>
          </div>
        )}
      </motion.section>

      {/* Grouped Collapsible Sections: How it works, FAQ, About Us (All collapsed by default) */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3 pb-8">
        <HowItWorksSection />

        <FaqSection />

        <motion.section variants={getItemVariants()}>
          <CollapsibleSection
            id="about-us"
            title={COMPANY_INFO.aboutTitle}
            icon={<Info className="w-4 h-4 text-amber-400" />}
            defaultOpen={false}
            isOpen={aboutOpen}
            onToggle={setAboutOpen}
          >
            <div className="space-y-4 text-sm text-slate-300 leading-relaxed pt-2">
              <p>
                {COMPANY_INFO.aboutDescription}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-card bg-slate-950/60 border border-slate-800">
                  <h3 className="font-bold text-white mb-1">المقر الرئيسي</h3>
                  <p className="text-sm text-slate-300">{COMPANY_INFO.fullAddress}</p>
                </div>
                <div className="p-4 rounded-card bg-slate-950/60 border border-slate-800">
                  <h3 className="font-bold text-white mb-1">ساعات العمل والدعم</h3>
                  <p className="text-sm text-slate-300">{COMPANY_INFO.workingHours} • {COMPANY_INFO.emergencyHours}</p>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </motion.section>
      </div>
    </PageTransition>
  );
};
