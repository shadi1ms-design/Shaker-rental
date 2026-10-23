import type { AdminTabType } from '../components/AdminDashboard';

interface Roles {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/** Maps an /admin/* URL to the dashboard tab that should open, respecting the user's role. */
export function getAdminTabFromPath(path: string, { isAdmin, isSuperAdmin }: Roles): AdminTabType {
  const adminOr = (tab: AdminTabType): AdminTabType => (isAdmin ? tab : 'bookings');
  const superOr = (tab: AdminTabType): AdminTabType =>
    isSuperAdmin ? tab : isAdmin ? 'overview' : 'bookings';

  if (path.includes('/admin/vehicles')) return adminOr('vehicles');
  if (path.includes('/admin/customers')) return adminOr('overview');
  if (path.includes('/admin/bookings')) return 'bookings';
  if (path.includes('/admin/calendar')) return 'bookings';
  if (path.includes('/admin/rentals')) return 'bookings';
  if (path.includes('/admin/contracts')) return 'bookings';
  if (path.includes('/admin/maintenance')) return adminOr('vehicles');
  if (path.includes('/admin/reports')) return adminOr('reports');
  if (path.includes('/admin/settings')) return adminOr('settings');
  if (path.includes('/admin/notifications')) return adminOr('notifications');
  if (path.includes('/admin/firebase')) return superOr('firestore_users');
  if (path.includes('/admin/users')) return superOr('firestore_users');
  if (path.includes('/admin/staff')) return superOr('staff');
  if (path.includes('/admin/activity') || path.includes('/admin/audit')) return superOr('activity_log');
  if (path.includes('/admin/dashboard')) return adminOr('overview');
  if (isSuperAdmin) return 'firestore_users';
  if (isAdmin) return 'overview';
  return 'bookings';
}
