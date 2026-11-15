import { ADMIN_ROUTES, AdminRequiredRole, AdminTabType } from '../constants/adminNav';
import { matchPath } from '../router';

export interface AdminRoleFlags {
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export type ResolvedAdminRoute =
  | { type: 'root' }
  | { type: 'tab'; path: string; tab: AdminTabType; requiredRole: AdminRequiredRole }
  | { type: 'vehicleNew' }
  | { type: 'vehicleEdit'; id: string }
  | { type: 'contract'; id: string };

export function normalizeAdminPath(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '');
  return clean === '' ? '/' : clean;
}

export function isAdminRoleAuthorized(
  requiredRole: AdminRequiredRole,
  { isAdmin, isSuperAdmin }: AdminRoleFlags
): boolean {
  if (requiredRole === 'super_admin') return Boolean(isSuperAdmin);
  if (requiredRole === 'admin') return Boolean(isAdmin || isSuperAdmin);
  return true;
}

export function getDefaultAdminPath({ isAdmin, isSuperAdmin }: AdminRoleFlags): string {
  return isAdmin || isSuperAdmin ? '/admin/dashboard' : '/admin/bookings';
}

export function getDefaultAdminTab({ isAdmin, isSuperAdmin }: AdminRoleFlags): AdminTabType {
  return isAdmin || isSuperAdmin ? 'overview' : 'bookings';
}

export function resolveAdminRoute(pathname: string): ResolvedAdminRoute | null {
  const normalized = normalizeAdminPath(pathname);
  if (normalized === '/admin') return { type: 'root' };

  const tabConfig = ADMIN_ROUTES[normalized];
  if (tabConfig) {
    return {
      type: 'tab',
      path: normalized,
      tab: tabConfig.tab,
      requiredRole: tabConfig.requiredRole,
    };
  }

  if (normalized === '/admin/vehicles/new') {
    return { type: 'vehicleNew' };
  }

  const editMatch = matchPath('/admin/vehicles/:id/edit', normalized);
  if (editMatch?.id) {
    return { type: 'vehicleEdit', id: editMatch.id };
  }

  const contractMatch = matchPath('/admin/contracts/:id', normalized);
  if (contractMatch?.id) {
    return { type: 'contract', id: contractMatch.id };
  }

  return null;
}

/** Maps an exact /admin/* URL to the dashboard tab that should open, or null for unknown routes. */
export function getAdminTabFromPath(path: string, roles: AdminRoleFlags): AdminTabType | null {
  const normalized = normalizeAdminPath(path);
  if (normalized === '/admin') {
    return getDefaultAdminTab(roles);
  }
  const exact = ADMIN_ROUTES[normalized];
  if (!exact) return null;
  if (!isAdminRoleAuthorized(exact.requiredRole, roles)) {
    return getDefaultAdminTab(roles);
  }
  return exact.tab;
}
