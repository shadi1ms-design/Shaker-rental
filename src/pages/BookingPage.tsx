import React from 'react';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { VehicleNotFound } from '../components/routing/VehicleNotFound';
import { useAppData } from '../contexts/DataContext';
import { navigate, routes, useSearchParams } from '../router';
import { parseCatalogParams } from '../utils/catalogQuery';

const BookingView = React.lazy(() =>
  import('../components/BookingView').then((m) => ({ default: m.BookingView })),
);

/** /cars/:id/book - booking form. */
export const BookingPage: React.FC<{ id: string }> = ({ id }) => {
  const { vehicles, handleBookingCreated } = useAppData();
  const [searchParams] = useSearchParams();
  const vehicle = vehicles.find((v) => v.id === id) || null;

  if (!vehicle) return <VehicleNotFound />;

  const { from, to } = parseCatalogParams(searchParams);
  const initialDates = from && to ? { pickupDate: from, returnDate: to } : undefined;

  return (
    <PageTransition key={`booking-${vehicle.id}`}>
      <React.Suspense fallback={<SuspenseFallback />}>
        <BookingView
          key={id}
          vehicles={vehicles}
          vehicle={vehicle}
          initialDates={initialDates}
          onOpenAuth={() => {
            const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : routes.book(id);
            navigate(`${routes.login}?redirect=${encodeURIComponent(returnTo)}`);
          }}
          onBookingCreated={handleBookingCreated}
        />
      </React.Suspense>
    </PageTransition>
  );
};
