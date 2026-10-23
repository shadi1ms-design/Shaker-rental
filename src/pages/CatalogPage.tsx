import React from 'react';
import { CarCatalog } from '../components/CarCatalog';
import { PageHeaderBanner } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';
import { useAppData } from '../contexts/DataContext';
import { navigate, routes } from '../router';
import type { Vehicle } from '../types';

/** /cars - the full fleet catalog. */
export const CatalogPage: React.FC = () => {
  const { vehicles, activeBookingFilters } = useAppData();
  const bookVehicle = (v: Vehicle) => navigate(routes.book(v.id));
  const viewVehicle = (v: Vehicle) => navigate(routes.car(v.id));

  return (
    <PageTransition>
      <PageHeaderBanner themeKey="catalog" />
      <CarCatalog
        vehicles={vehicles}
        initialFilters={activeBookingFilters}
        onSelectVehicle={bookVehicle}
        onViewDetails={viewVehicle}
        onBookCar={bookVehicle}
        onSelectCar={viewVehicle}
      />
    </PageTransition>
  );
};
