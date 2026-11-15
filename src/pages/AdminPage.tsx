import React from 'react';
import { AdminDashboard } from '../components/AdminDashboard';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/DataContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { navigate, routes } from '../router';
import { getAdminTabFromPath } from '../utils/adminTabs';
import { NotFoundPage } from './NotFoundPage';

/** /admin/* - the staff dashboard. Unauthenticated visitors or non-staff see 404. */
export const AdminPage: React.FC<{ pathname: string }> = ({ pathname }) => {
  const { user, isAdmin, isEmployee, isSuperAdmin, isLoadingAuth } = useAuth();
  const { vehicles, bookings, settings, refreshData } = useAppData();
  const isStaffAuthorized = isAdmin || isEmployee;

  useDocumentTitle('لوحة الإدارة', undefined, {
    canonicalPath: routes.adminDashboard,
    noindex: true,
  });

  // Do not render protected routes before the auth state is ready
  if (isLoadingAuth) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-cairo" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-300">جاري التحقق من صلاحيات الدخول المعتمدة...</p>
        </div>
      </div>
    );
  }

  // If not authenticated or not staff, display standard 404 NotFoundPage without revealing admin status
  if (!user || !isStaffAuthorized) {
    return <NotFoundPage />;
  }

  return (
    <AdminDashboard
      vehicles={vehicles}
      bookings={bookings}
      settings={settings}
      initialTab={getAdminTabFromPath(pathname, { isAdmin, isSuperAdmin }) ?? undefined}
      onRefreshData={refreshData}
      onBackToSite={() => navigate(routes.home)}
    />
  );
};
