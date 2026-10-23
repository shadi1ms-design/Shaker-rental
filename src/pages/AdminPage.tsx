import React, { useEffect } from 'react';
import { AdminDashboard } from '../components/AdminDashboard';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/DataContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { navigate, routes } from '../router';
import { getAdminTabFromPath } from '../utils/adminTabs';
import { AdminLoginScreen } from './AdminLoginScreen';

/** /admin/* - the staff dashboard, or the admin sign-in screen for everyone else. */
export const AdminPage: React.FC<{ pathname: string }> = ({ pathname }) => {
  const { user, isAdmin, isEmployee, isSuperAdmin, isLoadingAuth } = useAuth();
  const { vehicles, bookings, settings, refreshData } = useAppData();
  const isStaffAuthorized = isAdmin || isEmployee;

  useDocumentTitle('لوحة الإدارة');

  // Visitors and non-staff accounts belong on /admin/login
  useEffect(() => {
    if (!isLoadingAuth && (!user || !isStaffAuthorized) && pathname !== routes.adminLogin) {
      navigate(routes.adminLogin, { replace: true });
    }
  }, [isLoadingAuth, user, isStaffAuthorized, pathname]);

  // Do not render protected routes before the auth state is ready
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-cairo" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-300">جاري التحقق من صلاحيات الدخول المعتمدة...</p>
        </div>
      </div>
    );
  }

  if (!user || !isStaffAuthorized) {
    return <AdminLoginScreen />;
  }

  return (
    <AdminDashboard
      vehicles={vehicles}
      bookings={bookings}
      settings={settings}
      initialTab={getAdminTabFromPath(pathname, { isAdmin, isSuperAdmin })}
      onRefreshData={refreshData}
      onBackToSite={() => navigate(routes.home)}
    />
  );
};
