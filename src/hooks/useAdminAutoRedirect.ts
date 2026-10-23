import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate, routes } from '../router';

/**
 * When an admin signs in, show the admin dashboard once (instead of the public site).
 * The ref prevents trapping the admin in an endless redirect loop afterwards.
 */
export function useAdminAutoRedirect() {
  const { isAdmin } = useAuth();
  const hasAutoNavigatedRef = useRef(false);

  useEffect(() => {
    if (isAdmin && !hasAutoNavigatedRef.current) {
      hasAutoNavigatedRef.current = true;
      if (!window.location.pathname.startsWith('/admin')) {
        navigate(routes.adminDashboard, { replace: true });
      }
    } else if (!isAdmin) {
      hasAutoNavigatedRef.current = false;
    }
  }, [isAdmin]);
}
