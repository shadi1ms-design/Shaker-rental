import React from 'react';
import { PageTransition } from '../components/routing/PageTransition';
import { SuspenseFallback } from '../components/routing/Spinners';
import { useAuth } from '../contexts/AuthContext';
import { goBack, navigate, routes } from '../router';
import { isStaffRole } from '../utils/roles';

const AuthView = React.lazy(() => import('../components/AuthView').then((m) => ({ default: m.AuthView })));

/** /login and /register (wrapped by <GuestOnly> in App). */
export const AuthPage: React.FC<{ mode: 'login' | 'register' }> = ({ mode }) => {
  const { isAdmin, isEmployee, loginWithGoogle } = useAuth();

  return (
    <PageTransition>
      <React.Suspense fallback={<SuspenseFallback />}>
        <AuthView
          isOpen
          initialMode={mode}
          onModeChange={(next) => navigate(next === 'register' ? routes.register : routes.login, { replace: true })}
          loginWithGoogle={loginWithGoogle}
          onClose={() => goBack(routes.home)}
          onSuccess={(resolvedRole) => {
            const isStaff = resolvedRole
              ? isStaffRole(resolvedRole)
              : (isAdmin || isEmployee);
            navigate(isStaff ? routes.adminDashboard : routes.profile, { replace: true });
          }}
        />
      </React.Suspense>
    </PageTransition>
  );
};
