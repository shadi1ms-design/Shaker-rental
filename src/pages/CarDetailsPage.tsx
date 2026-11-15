import React from 'react';
import { PageIntro } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { VehicleNotFound } from '../components/routing/VehicleNotFound';
import { useAppData } from '../contexts/DataContext';
import { useVehicleJsonLd } from '../hooks/useVehicleJsonLd';
import { formatMoney } from '../utils/format';
import { useSearchParams } from '../router';
import { buildBookingUrl, parseCatalogParams } from '../utils/catalogQuery';
import { VEHICLE_STATUS_META } from '../constants/statusMeta';
import { getVehicleCategoryLabel } from '../constants/vehicleCategories';

const CarDetailsView = React.lazy(() =>
  import('../components/CarDetailsView').then((m) => ({ default: m.CarDetailsView })),
);

/** /cars/:id - vehicle details. */
export const CarDetailsPage: React.FC<{ id: string }> = ({ id }) => {
  const { vehicles } = useAppData();
  const [searchParams] = useSearchParams();
  const vehicle = vehicles.find((v) => v.id === id) || null;

  useVehicleJsonLd(vehicle);

  if (!vehicle) return <VehicleNotFound />;

  const { from, to } = parseCatalogParams(searchParams);
  const bookTo = buildBookingUrl(vehicle.id, from && to ? { from, to } : undefined);
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
          bookTo={bookTo}
        />
      </React.Suspense>
    </PageTransition>
  );
};
