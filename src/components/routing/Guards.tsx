import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { EMAIL_VERIFICATION_CUTOFF_DATE } from '../../constants/company';
import { getSafeRedirectTarget, navigate, routes } from '../../router';
import { EmailVerificationGate } from '../EmailVerificationGate';
import { PhoneGate } from '../PhoneGate';
import { PageSpinner } from './Spinners';

interface GuardProps {
  children: React.ReactNode;
}

/** Only signed-in users may see the children; visitors are sent to /login?redirect=... */
export const RequireAuth: React.FC<GuardProps> = ({ children }) => {
  const { user, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && !user) {
      const currentTarget =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search + window.location.hash
          : '';
      const loginTarget =
        currentTarget && currentTarget !== '/'
          ? `${routes.login}?redirect=${encodeURIComponent(currentTarget)}`
          : routes.login;
      navigate(loginTarget, { replace: true });
    }
  }, [isLoadingAuth, user]);

  if (isLoadingAuth || !user) return <PageSpinner />;
  return <>{children}</>;
};

/**
 * Requires customer accounts created on/after EMAIL_VERIFICATION_CUTOFF_DATE with password provider
 * to verify their email before accessing sensitive routes (/cars/:id/book, /profile).
 * Staff/admins and guests are exempt.
 */
export const RequireVerifiedEmail: React.FC<GuardProps> = ({ children }) => {
  const { user, isAdmin, isEmployee, isLoadingAuth } = useAuth();

  if (isLoadingAuth) return <PageSpinner />;

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

  if (requiresEmailVerification) {
    return <EmailVerificationGate />;
  }

  return <>{children}</>;
};

/** Requires customers who signed in via Google to complete their phone number once before accessing /cars/:id/book or /profile. */
export const RequirePhone: React.FC<GuardProps> = ({ children }) => {
  const { isLoadingAuth, requiresPhone } = useAuth();

  if (isLoadingAuth) return <PageSpinner />;
  if (requiresPhone) return <PhoneGate />;

  return <>{children}</>;
};

/** Only visitors may see the children (login / register); signed-in users are sent to their target or home page. */
export const GuestOnly: React.FC<GuardProps> = ({ children }) => {
  const { user, isAdmin, isEmployee, isLoadingAuth } = useAuth();
  const isStaffAuthorized = isAdmin || isEmployee;

  useEffect(() => {
    if (!isLoadingAuth && user) {
      const redirectTo = getSafeRedirectTarget();
      navigate(
        redirectTo || (isStaffAuthorized ? routes.adminDashboard : routes.profile),
        { replace: true },
      );
    }
  }, [isLoadingAuth, user, isStaffAuthorized]);

  if (isLoadingAuth) return <PageSpinner />;
  return user ? null : <>{children}</>;
};

/** /dashboard: staff -> admin panel, customers -> their account page, visitors -> login. */
export const DashboardRedirect: React.FC = () => {
  const { user, isAdmin, isEmployee, isLoadingAuth } = useAuth();
  const isStaffAuthorized = isAdmin || isEmployee;

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      navigate(`${routes.login}?redirect=${encodeURIComponent(routes.dashboard)}`, {
        replace: true,
      });
    } else if (isStaffAuthorized) {
      navigate(routes.adminDashboard, { replace: true });
    } else {
      navigate(routes.profile, { replace: true });
    }
  }, [isLoadingAuth, user, isStaffAuthorized]);

  return <PageSpinner />;
};
