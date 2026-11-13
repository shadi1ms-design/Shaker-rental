/**
 * Centralized Role Authority & Legacy Claims Resolution (Frontend)
 *
 * Mirrors functions/src/roles.ts, firestore.rules, and storage.rules 100% using exact,
 * case-sensitive string matching (no toLowerCase or trim) to match `hasTokenRole` in rules:
 * - Super Admin (rank 4): exact role in ['super_admin', 'superAdmin', 'owner'] or boolean claim super_admin / superAdmin / owner === true
 * - Admin (rank 3): Super Admin OR exact role === 'admin' or boolean claim admin === true
 * - Employee / Staff (rank 2): Admin OR exact role in ['employee', 'staff', 'manager'] or boolean claim employee / staff / manager === true
 * - Customer / User (rank 1): customer, user, or any unrecognized/unassigned value
 */

export type NormalizedUserRole = 'customer' | 'employee' | 'admin' | 'super_admin';

export const SUPER_ADMIN_ROLE_ALIASES = ['super_admin', 'superAdmin', 'owner'] as const;
export const SUPER_ADMIN_BOOLEAN_CLAIMS = ['super_admin', 'superAdmin', 'owner'] as const;

export const ADMIN_ROLE_ALIASES = ['admin'] as const;
export const ADMIN_BOOLEAN_CLAIMS = ['admin'] as const;

export const STAFF_ROLE_ALIASES = ['employee', 'staff', 'manager'] as const;
export const STAFF_BOOLEAN_CLAIMS = ['employee', 'staff', 'manager'] as const;

const SUPER_ADMIN_ROLE_SET = new Set<string>(SUPER_ADMIN_ROLE_ALIASES);
const ADMIN_ROLE_SET = new Set<string>(ADMIN_ROLE_ALIASES);
const STAFF_ROLE_SET = new Set<string>(STAFF_ROLE_ALIASES);

export function isSuperAdminRole(role?: unknown): boolean {
  if (typeof role !== 'string') return false;
  return SUPER_ADMIN_ROLE_SET.has(role);
}

export function isAdminRole(role?: unknown): boolean {
  if (isSuperAdminRole(role)) return true;
  if (typeof role !== 'string') return false;
  return ADMIN_ROLE_SET.has(role);
}

export function isEmployeeOnlyRole(role?: unknown): boolean {
  if (typeof role !== 'string') return false;
  return STAFF_ROLE_SET.has(role);
}

export function isStaffRole(role?: unknown): boolean {
  return isAdminRole(role) || isEmployeeOnlyRole(role);
}

export function normalizeRoleName(role?: unknown): NormalizedUserRole {
  if (isSuperAdminRole(role)) return 'super_admin';
  if (isAdminRole(role)) return 'admin';
  if (isEmployeeOnlyRole(role)) return 'employee';
  return 'customer';
}

function extractTokenObject(authOrToken?: unknown): Record<string, unknown> | null {
  if (!authOrToken || typeof authOrToken !== 'object') return null;
  const obj = authOrToken as Record<string, unknown>;
  const token = obj.token && typeof obj.token === 'object' ? (obj.token as Record<string, unknown>) : obj;
  return token && typeof token === 'object' ? token : null;
}

export function isSuperAdminClaims(authOrToken?: unknown): boolean {
  const token = extractTokenObject(authOrToken);
  if (!token) return false;

  if (isSuperAdminRole(token.role)) {
    return true;
  }

  return SUPER_ADMIN_BOOLEAN_CLAIMS.some((key) => token[key] === true);
}

export function isAdminClaims(authOrToken?: unknown): boolean {
  if (isSuperAdminClaims(authOrToken)) return true;

  const token = extractTokenObject(authOrToken);
  if (!token) return false;

  if (isAdminRole(token.role)) {
    return true;
  }

  return ADMIN_BOOLEAN_CLAIMS.some((key) => token[key] === true);
}

export function isStaffClaims(authOrToken?: unknown): boolean {
  if (isAdminClaims(authOrToken)) return true;

  const token = extractTokenObject(authOrToken);
  if (!token) return false;

  if (isEmployeeOnlyRole(token.role)) {
    return true;
  }

  return STAFF_BOOLEAN_CLAIMS.some((key) => token[key] === true);
}

export function getRoleRank(roleName?: string | null): number {
  if (!roleName) return 1;
  if (isSuperAdminRole(roleName)) return 4;
  if (isAdminRole(roleName)) return 3;
  if (isEmployeeOnlyRole(roleName)) return 2;
  return 1;
}

export function getUserRoleFromClaims(claims?: Record<string, unknown> | null): NormalizedUserRole {
  if (!claims || typeof claims !== 'object') return 'customer';

  if (isSuperAdminClaims(claims)) return 'super_admin';
  if (isAdminClaims(claims)) return 'admin';
  if (isStaffClaims(claims)) return 'employee';

  return 'customer';
}

/**
 * Checks whether a token claims object already has any role or legacy boolean claim populated.
 */
export function hasPopulatedRoleClaims(claims?: Record<string, unknown> | null): boolean {
  if (!claims || typeof claims !== 'object') return false;
  if (typeof claims.role === 'string' && claims.role.trim().length > 0) return true;
  return (
    SUPER_ADMIN_BOOLEAN_CLAIMS.some((k) => Boolean(claims[k])) ||
    ADMIN_BOOLEAN_CLAIMS.some((k) => Boolean(claims[k])) ||
    STAFF_BOOLEAN_CLAIMS.some((k) => Boolean(claims[k]))
  );
}
