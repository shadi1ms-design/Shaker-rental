import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate, routes } from '../router';

/**
 * When an admin signs in, show the admin dashboard once (instead of the public site).
 * The ref prevents trapping the admin in an endless redirect loop afterwards.
 */
export function useAdminAutoRedirect() {
  const { user, isAdmin, isEmployee } = useAuth();
  const isStaff = isAdmin || isEmployee;
  const prevUidRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUid = user?.uid || null;

    // Detect new login (user.uid transitions from null to a valid string)
    if (currentUid && prevUidRef.current === null && isStaff) {
      const currentPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
      const autoRedirectPaths = ['/', '/login', '/register', '/profile'];
      if (autoRedirectPaths.includes(currentPath)) {
        navigate(routes.adminDashboard, { replace: true });
      }
    }

    // Reset ref on logout (when user becomes null)
    prevUidRef.current = currentUid;
  }, [user?.uid, isStaff]);
}
