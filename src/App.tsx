import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { MenuProvider } from './contexts/MenuContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EmailVerificationGate } from './components/EmailVerificationGate';
import { PhoneGate } from './components/PhoneGate';
import { DashboardRedirect, GuestOnly, RequireAuth } from './components/routing/Guards';
import { SiteLayout } from './layouts/SiteLayout';
import { useAdminAutoRedirect } from './hooks/useAdminAutoRedirect';
import { useRoute, type ResolvedRoute } from './router';
import { AboutPage } from './pages/AboutPage';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './pages/AuthPage';
import { BookingPage } from './pages/BookingPage';
import { CarDetailsPage } from './pages/CarDetailsPage';
import { CatalogPage } from './pages/CatalogPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';

// Mandatory email verification for customer accounts created on/after 2026-09-19
const EMAIL_VERIFICATION_CUTOFF_DATE = new Date('2026-09-19T00:00:00.000Z').getTime();

/** Route name -> page. Add a new page here (and in the route table in router.tsx). */
function renderPage(route: ResolvedRoute): React.ReactNode {
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'cars':
      return <CatalogPage />;
    case 'car':
      return <CarDetailsPage id={route.params.id} />;
    case 'book':
      return <BookingPage id={route.params.id} />;
    case 'about':
      return <AboutPage />;
    case 'login':
    case 'register':
      return (
        <GuestOnly>
          <AuthPage mode={route.name} />
        </GuestOnly>
      );
    case 'profile':
      return (
        <RequireAuth>
          <ProfilePage />
        </RequireAuth>
      );
    case 'dashboard':
      return <DashboardRedirect />;
    default:
      return <NotFoundPage />;
  }
}

function MainAppContent() {
  const { user, isAdmin, isEmployee, isLoadingAuth, requiresPhone } = useAuth();
  const route = useRoute();

  useAdminAutoRedirect();

  // The staff dashboard has its own full-screen UI and skips the customer gates below.
  if (route.name === 'admin') {
    return <AdminPage pathname={route.pathname} />;
  }

  const isAccountNewerThanCutoff = user?.createdAt
    ? new Date(user.createdAt).getTime() >= EMAIL_VERIFICATION_CUTOFF_DATE
    : true;

  const requiresEmailVerification = Boolean(
    user &&
      !isAdmin &&
      !isEmployee &&
      user.isPasswordProvider !== false &&
      !user.emailVerified &&
      isAccountNewerThanCutoff,
  );

  if (!isLoadingAuth && requiresEmailVerification) return <EmailVerificationGate />;

  // Google sign-in customers must give a phone number once to complete registration
  if (!isLoadingAuth && requiresPhone) return <PhoneGate />;

  return <SiteLayout route={route}>{renderPage(route)}</SiteLayout>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <MenuProvider>
            <MainAppContent />
          </MenuProvider>
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
