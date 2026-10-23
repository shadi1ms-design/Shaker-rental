import React from 'react';
import { PageHeaderBanner } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { useAppData } from '../contexts/DataContext';
import { useBookFirstVehicle } from '../hooks/useBookFirstVehicle';
import { navigate, routes } from '../router';

const UserProfileModal = React.lazy(() =>
  import('../components/UserProfileModal').then((m) => ({ default: m.UserProfileModal })),
);

/** /profile (wrapped by <RequireAuth> in App). */
export const ProfilePage: React.FC = () => {
  const { bookings } = useAppData();
  const bookFirstVehicle = useBookFirstVehicle();

  return (
    <PageTransition>
      <PageHeaderBanner themeKey="profile" />
      <React.Suspense fallback={<SuspenseFallback />}>
        <UserProfileModal
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
