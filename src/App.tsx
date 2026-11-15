import React, { Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { MenuProvider } from './contexts/MenuContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  DashboardRedirect,
  GuestOnly,
  RequireAuth,
  RequirePhone,
  RequireVerifiedEmail,
} from './components/routing/Guards';
import { SiteLayout } from './layouts/SiteLayout';
import { useAdminAutoRedirect } from './hooks/useAdminAutoRedirect';
import { useRoute, type ResolvedRoute } from './router';
import { HomePage } from './pages/HomePage';
import { SuspenseFallback } from './components/routing/Spinners';
import { lazyWithRetry, ROUTE_IMPORTERS } from './utils/lazyWithRetry';

const ContactRoutePage = lazyWithRetry(ROUTE_IMPORTERS.contact);
const AdminPage = lazyWithRetry(ROUTE_IMPORTERS.admin);
const AuthPage = lazyWithRetry(ROUTE_IMPORTERS.login);
const BookingPage = lazyWithRetry(ROUTE_IMPORTERS.book);
const CarDetailsPage = lazyWithRetry(ROUTE_IMPORTERS.car);
const CatalogPage = lazyWithRetry(ROUTE_IMPORTERS.cars);
const NotFoundPage = lazyWithRetry(ROUTE_IMPORTERS.notFound);
const ProfilePage = lazyWithRetry(ROUTE_IMPORTERS.profile);
const VerifyContractPage = lazyWithRetry(ROUTE_IMPORTERS.verifyContract);

/** Route name -> page. Add a new page here (and in the route table in router.tsx). */
function renderPage(route: ResolvedRoute): React.ReactNode {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      {(() => {
        switch (route.name) {
          case 'home':
            return <HomePage />;
          case 'cars':
            return <CatalogPage />;
          case 'car':
            return <CarDetailsPage id={route.params.id} />;
          case 'book':
            return (
              <RequireVerifiedEmail>
                <RequirePhone>
                  <BookingPage id={route.params.id} />
                </RequirePhone>
              </RequireVerifiedEmail>
            );
          case 'contact':
            return <ContactRoutePage />;
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
                <RequireVerifiedEmail>
                  <RequirePhone>
                    <ProfilePage />
                  </RequirePhone>
                </RequireVerifiedEmail>
              </RequireAuth>
            );
          case 'dashboard':
            return <DashboardRedirect />;
          case 'verifyContract':
            return <VerifyContractPage />;
          default:
            return <NotFoundPage />;
        }
      })()}
    </Suspense>
  );
}

function MainAppContent() {
  const route = useRoute();

  useAdminAutoRedirect();

  // The staff dashboard has its own full-screen UI and skips the customer gates below.
  if (route.name === 'admin') {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <AdminPage pathname={route.pathname} />
      </Suspense>
    );
  }

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
