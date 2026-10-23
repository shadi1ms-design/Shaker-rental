import React, { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { navigate, routes } from '../../router';
import { PageSpinner } from './Spinners';

interface GuardProps {
  children: React.ReactNode;
}

/** Only signed-in users may see the children; visitors are sent to /login. */
export const RequireAuth: React.FC<GuardProps> = ({ children }) => {
  const { user, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && !user) navigate(routes.login, { replace: true });
  }, [isLoadingAuth, user]);

  return user ? <>{children}</> : null;
};

/** Only visitors may see the children (login / register); signed-in users are sent to their home page. */
export const GuestOnly: React.FC<GuardProps> = ({ children }) => {
  const { user, isAdmin, isLoadingAuth } = useAuth();

  useEffect(() => {
    if (!isLoadingAuth && user) {
      navigate(isAdmin ? routes.adminDashboard : routes.profile, { replace: true });
    }
  }, [isLoadingAuth, user, isAdmin]);

  return user ? null : <>{children}</>;
};

/** /dashboard: staff -> admin panel, customers -> their account page, visitors -> login. */
export const DashboardRedirect: React.FC = () => {
  const { user, isAdmin, isEmployee, isLoadingAuth } = useAuth();
  const isStaffAuthorized = isAdmin || isEmployee;

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) navigate(routes.login, { replace: true });
    else if (isStaffAuthorized) navigate(routes.adminDashboard, { replace: true });
    else navigate(routes.profile, { replace: true });
  }, [isLoadingAuth, user, isStaffAuthorized]);

  return <PageSpinner />;
};
