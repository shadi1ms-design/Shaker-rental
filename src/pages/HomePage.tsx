import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { HeroSection } from '../components/HeroSection';
import { FeaturedVehicleCard } from '../components/home/FeaturedVehicleCard';
import { FaqSection } from '../components/home/FaqSection';
import { PageTransition } from '../components/routing/PageTransition';
import { useAppData } from '../contexts/DataContext';
import { getItemVariants, getStaggerVariants } from '../constants/motion';
import { navigate, routes } from '../router';
import type { SearchFilters, Vehicle } from '../types';

/** / - hero search, featured fleet and FAQ. */
export const HomePage: React.FC = () => {
  const { vehicles, setActiveBookingFilters } = useAppData();

  const handleHeroSearch = (filters: SearchFilters) => {
    setActiveBookingFilters(filters);
    navigate(routes.cars);
  };
  const bookVehicle = (v: Vehicle) => navigate(routes.book(v.id));
  const viewVehicle = (v: Vehicle) => navigate(routes.car(v.id));

  return (
    <PageTransition className="space-y-16">
      <motion.div variants={getItemVariants()}>
        <HeroSection vehicles={vehicles} onSearch={handleHeroSearch} onSelectVehicle={bookVehicle} />
      </motion.div>

      {/* Featured Fleet Catalog Section */}
      <motion.section variants={getItemVariants()} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-2">
              الأسطول المختار بعناية
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">أحدث سيارات شركة شاكر في دمشق</h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveBookingFilters(undefined);
              navigate(routes.cars);
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer"
          >
            <span>تصفح كامل الأسطول</span>
            <span className="text-xs opacity-90 font-mono font-medium">({vehicles.length})</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Cars Grid with Staggered Entrance */}
        <motion.div variants={getStaggerVariants()} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {vehicles.slice(0, 2).map((vehicle) => (
            <FeaturedVehicleCard key={vehicle.id} vehicle={vehicle} onViewDetails={viewVehicle} onBook={bookVehicle} />
          ))}
        </motion.div>
      </motion.section>

      <FaqSection />
    </PageTransition>
  );
};
