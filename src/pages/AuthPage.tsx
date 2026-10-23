import React from 'react';
import { PageHeaderBanner } from '../components/common/PageHeaderBanner';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { useAuth } from '../contexts/AuthContext';
import { goBack, navigate, routes } from '../router';

const AuthModal = React.lazy(() => import('../components/AuthModal').then((m) => ({ default: m.AuthModal })));

/** /login and /register (wrapped by <GuestOnly> in App). */
export const AuthPage: React.FC<{ mode: 'login' | 'register' }> = ({ mode }) => {
  const { isAdmin, loginWithGoogle } = useAuth();

  return (
    <PageTransition>
      <PageHeaderBanner themeKey={mode} />
      <React.Suspense fallback={<SuspenseFallback />}>
        <AuthModal
          isOpen
          initialMode={mode}
          onModeChange={(next) => navigate(next === 'register' ? routes.register : routes.login, { replace: true })}
          loginWithGoogle={loginWithGoogle}
          onClose={() => goBack(routes.home)}
          onSuccess={() => navigate(isAdmin ? routes.adminDashboard : routes.profile, { replace: true })}
        />
      </React.Suspense>
    </PageTransition>
  );
};
