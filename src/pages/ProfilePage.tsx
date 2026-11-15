import React from 'react';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { useAppData } from '../contexts/DataContext';
import { useBrowseFleet } from '../hooks/useBrowseFleet';
import { navigate, routes } from '../router';

const ProfileView = React.lazy(() =>
  import('../components/ProfileView').then((m) => ({ default: m.ProfileView })),
);

/** /profile (wrapped by <RequireAuth> in App). */
export const ProfilePage: React.FC = () => {
  const { bookings } = useAppData();
  const browseFleet = useBrowseFleet();

  return (
    <PageTransition>
      <React.Suspense fallback={<SuspenseFallback />}>
        <ProfileView
          bookings={bookings}
          onOpenBooking={browseFleet}
          onOpenAdminView={() => navigate(routes.adminDashboard)}
        />
      </React.Suspense>
    </PageTransition>
  );
};
