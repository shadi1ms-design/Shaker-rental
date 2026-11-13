import React from 'react';
import { PageIntro } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { VehicleNotFound } from '../components/routing/VehicleNotFound';
import { useAppData } from '../contexts/DataContext';
import { formatMoney } from '../utils/format';
import { goBack, navigate, routes } from '../router';
import type { Vehicle } from '../types';

const CarDetailsView = React.lazy(() =>
  import('../components/CarDetailsView').then((m) => ({ default: m.CarDetailsView })),
);

import { VEHICLE_STATUS_META } from '../constants/statusMeta';
import { getVehicleCategoryLabel } from '../constants/vehicleCategories';

/** /cars/:id - vehicle details. */
export const CarDetailsPage: React.FC<{ id: string }> = ({ id }) => {
  const { vehicles } = useAppData();
  const vehicle = vehicles.find((v) => v.id === id) || null;

  if (!vehicle) return <VehicleNotFound />;

  const bookVehicle = (v: Vehicle) => navigate(routes.book(v.id));
  const categoryLabel = getVehicleCategoryLabel(vehicle.category);

  const statusLabel = VEHICLE_STATUS_META[vehicle.status].label;

  return (
    <PageTransition key={`details-${vehicle.id}`}>
      <PageIntro
        themeKey="car_details"
        customSubtitle={`فئة ${categoryLabel} • السعر: ${formatMoney(vehicle.dailyPrice)}/يوم • ${statusLabel}`}
      />
      <React.Suspense fallback={<SuspenseFallback />}>
        <CarDetailsView
          vehicle={vehicle}
          onClose={() => goBack(routes.cars)}
          onBook={bookVehicle}
          onBookNow={bookVehicle}
        />
      </React.Suspense>
    </PageTransition>
  );
};
