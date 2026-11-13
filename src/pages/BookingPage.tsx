import React from 'react';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { VehicleNotFound } from '../components/routing/VehicleNotFound';
import { useAppData } from '../contexts/DataContext';
import { goBack, navigate, routes } from '../router';

const BookingView = React.lazy(() =>
  import('../components/BookingView').then((m) => ({ default: m.BookingView })),
);

/** /cars/:id/book - booking form. */
export const BookingPage: React.FC<{ id: string }> = ({ id }) => {
  const { vehicles, activeBookingFilters, handleBookingCreated } = useAppData();
  const vehicle = vehicles.find((v) => v.id === id) || null;

  if (!vehicle) return <VehicleNotFound />;

  return (
    <PageTransition key={`booking-${vehicle.id}`}>
      <React.Suspense fallback={<SuspenseFallback />}>
        <BookingView
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
          onBookingCreated={handleBookingCreated}
          onBookingComplete={handleBookingCreated}
        />
      </React.Suspense>
    </PageTransition>
  );
};
