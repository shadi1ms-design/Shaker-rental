import React from 'react';
import { PageHeaderBanner } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { VehicleNotFound } from '../components/routing/VehicleNotFound';
import { useAppData } from '../contexts/DataContext';
import { goBack, navigate, routes } from '../router';

const BookingModal = React.lazy(() =>
  import('../components/BookingModal').then((m) => ({ default: m.BookingModal })),
);

/** /cars/:id/book - booking form. */
export const BookingPage: React.FC<{ id: string }> = ({ id }) => {
  const { vehicles, activeBookingFilters, handleBookingCreated } = useAppData();
  const vehicle = vehicles.find((v) => v.id === id) || null;

  if (!vehicle) return <VehicleNotFound />;

  return (
    <PageTransition key={`booking-${vehicle.id}`}>
      <PageHeaderBanner
        themeKey="booking"
        customTitle={`حجز ${vehicle.brand} ${vehicle.model}`}
        customSubtitle="حدد تواريخ الاستلام والإرجاع وأكمل بيانات الحجز للاستفادة من خصومات الأعضاء"
      />
      <React.Suspense fallback={<SuspenseFallback />}>
        <BookingModal
          key={id}
          vehicles={vehicles}
          selectedVehicle={vehicle}
          vehicle={vehicle}
          initialDates={
            activeBookingFilters?.pickupDate && activeBookingFilters?.returnDate
              ? {
                  pickupDate: activeBookingFilters.pickupDate,
                  returnDate: activeBookingFilters.returnDate,
                }
              : undefined
          }
          initialStartDate={activeBookingFilters?.pickupDate}
          initialEndDate={activeBookingFilters?.returnDate}
          onClose={() => goBack(routes.car(id))}
          onOpenAuth={() => navigate(routes.login)}
          onOpenProfile={() => navigate(routes.profile)}
          onBookingCreated={handleBookingCreated}
          onBookingComplete={handleBookingCreated}
        />
      </React.Suspense>
    </PageTransition>
  );
};
