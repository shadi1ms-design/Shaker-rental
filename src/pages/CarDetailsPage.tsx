import React from 'react';
import { PageHeaderBanner } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { VehicleNotFound } from '../components/routing/VehicleNotFound';
import { useAppData } from '../contexts/DataContext';
import { goBack, navigate, routes } from '../router';
import type { Vehicle } from '../types';

const CarDetailsModal = React.lazy(() =>
  import('../components/CarDetailsModal').then((m) => ({ default: m.CarDetailsModal })),
);

/** /cars/:id - vehicle details. */
export const CarDetailsPage: React.FC<{ id: string }> = ({ id }) => {
  const { vehicles } = useAppData();
  const vehicle = vehicles.find((v) => v.id === id) || null;

  if (!vehicle) return <VehicleNotFound />;

  const bookVehicle = (v: Vehicle) => navigate(routes.book(v.id));
  const categoryLabel =
    vehicle.category === 'light' ? 'اقتصادي' : vehicle.category === 'medium' ? 'سيدان متوسط' : 'جيب 7 ركاب';

  return (
    <PageTransition key={`details-${vehicle.id}`}>
      <PageHeaderBanner
        themeKey="car_details"
        customTitle={`${vehicle.brand} ${vehicle.model} (${vehicle.year})`}
        customSubtitle={`فئة ${categoryLabel} • السعر: $${vehicle.dailyPrice}/يوم • جاهزة للتسليم`}
      />
      <React.Suspense fallback={<SuspenseFallback />}>
        <CarDetailsModal
          vehicle={vehicle}
          onClose={() => goBack(routes.cars)}
          onBook={bookVehicle}
          onBookNow={bookVehicle}
        />
      </React.Suspense>
    </PageTransition>
  );
};
