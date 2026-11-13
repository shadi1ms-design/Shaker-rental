import React from 'react';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { useAppData } from '../contexts/DataContext';
import { useBookFirstVehicle } from '../hooks/useBookFirstVehicle';
import { navigate, routes } from '../router';

const ProfileView = React.lazy(() =>
  import('../components/ProfileView').then((m) => ({ default: m.ProfileView })),
);

/** /profile (wrapped by <RequireAuth> in App). */
export const ProfilePage: React.FC = () => {
  const { bookings } = useAppData();
  const bookFirstVehicle = useBookFirstVehicle();

  return (
    <PageTransition>
      <React.Suspense fallback={<SuspenseFallback />}>
        <ProfileView
          isOpen
          bookings={bookings}
          onClose={() => navigate(routes.home)}
          onOpenBooking={bookFirstVehicle}
          onOpenAdminView={() => navigate(routes.adminDashboard)}
        />
      </React.Suspense>
    </PageTransition>
  );
};
