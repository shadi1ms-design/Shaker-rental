/**
 * Centralized Role Authority & Legacy Claims Resolution (Backend)
 *
 * Single source of truth for role hierarchy, role string aliases, and legacy boolean claims.
 * Uses exact, case-sensitive string matching (no toLowerCase or trim) to match `hasTokenRole`
 * in `firestore.rules` and `storage.rules` 100%:
 * - Super Admin (rank 4): exact role in ['super_admin', 'superAdmin', 'owner'] or boolean claim super_admin / superAdmin / owner === true
 * - Admin (rank 3): Super Admin OR exact role === 'admin' or boolean claim admin === true
 * - Employee / Staff (rank 2): Admin OR exact role in ['employee', 'staff', 'manager'] or boolean claim employee / staff / manager === true
 * - Customer / User (rank 1): customer, user, or any unrecognized/unassigned value
 */

export type UserRoleName = 'customer' | 'employee' | 'admin' | 'super_admin';

export const SUPER_ADMIN_ROLE_ALIASES = ['super_admin', 'superAdmin', 'owner'] as const;
export const SUPER_ADMIN_BOOLEAN_CLAIMS = ['super_admin', 'superAdmin', 'owner'] as const;

export const ADMIN_ROLE_ALIASES = ['admin'] as const;
export const ADMIN_BOOLEAN_CLAIMS = ['admin'] as const;

export const STAFF_ROLE_ALIASES = ['employee', 'staff', 'manager'] as const;
export const STAFF_BOOLEAN_CLAIMS = ['employee', 'staff', 'manager'] as const;

const SUPER_ADMIN_ROLE_SET = new Set<string>(SUPER_ADMIN_ROLE_ALIASES);
const ADMIN_ROLE_SET = new Set<string>(ADMIN_ROLE_ALIASES);
const STAFF_ROLE_SET = new Set<string>(STAFF_ROLE_ALIASES);

/**
 * Checks if a raw role string represents a Super Admin role (exact match).
 */
export function isSuperAdminRole(role?: unknown): boolean {
  if (typeof role !== 'string') return false;
  return SUPER_ADMIN_ROLE_SET.has(role);
}

/**
 * Checks if a raw role string represents an Admin or Super Admin role (exact match).
 */
export function isAdminRole(role?: unknown): boolean {
  if (isSuperAdminRole(role)) return true;
  if (typeof role !== 'string') return false;
  return ADMIN_ROLE_SET.has(role);
}

/**
 * Checks if a raw role string represents an Employee/Staff role (excluding Admin/Super Admin, exact match).
 */
export function isEmployeeOnlyRole(role?: unknown): boolean {
  if (typeof role !== 'string') return false;
  return STAFF_ROLE_SET.has(role);
}

/**
 * Checks if a raw role string represents any Staff member (Employee, Admin, or Super Admin).
 */
export function isStaffRole(role?: unknown): boolean {
  return isAdminRole(role) || isEmployeeOnlyRole(role);
}

/**
 * Normalizes any raw role string into canonical UserRoleName.
 */
export function normalizeRoleName(role?: unknown): UserRoleName {
  if (isSuperAdminRole(role)) return 'super_admin';
  if (isAdminRole(role)) return 'admin';
  if (isEmployeeOnlyRole(role)) return 'employee';
  return 'customer';
}

function extractTokenObject(authOrToken?: any): Record<string, any> | null {
  if (!authOrToken || typeof authOrToken !== 'object') return null;
  const token = authOrToken.token && typeof authOrToken.token === 'object' ? authOrToken.token : authOrToken;
  return token && typeof token === 'object' ? token : null;
}

/**
 * Extracts and checks if token custom claims confer Super Admin status.
 * Matches firestore.rules & storage.rules isSuperAdmin() logic 100%.
 */
export function isCallerSuperAdmin(authOrToken?: any): boolean {
  const token = extractTokenObject(authOrToken);
  if (!token) return false;

  if (isSuperAdminRole(token.role)) {
    return true;
  }

  return SUPER_ADMIN_BOOLEAN_CLAIMS.some((key) => token[key] === true);
}

/**
 * Extracts and checks if token custom claims confer Admin status (includes Super Admin).
 * Matches firestore.rules & storage.rules isAdmin() logic 100%.
 */
export function isCallerAdmin(authOrToken?: any): boolean {
  if (isCallerSuperAdmin(authOrToken)) return true;

  const token = extractTokenObject(authOrToken);
  if (!token) return false;

  if (isAdminRole(token.role)) {
    return true;
  }

  return ADMIN_BOOLEAN_CLAIMS.some((key) => token[key] === true);
}

/**
 * Extracts and checks if token custom claims confer Employee / Staff status (includes Admin & Super Admin).
 * Matches firestore.rules & storage.rules isEmployee() logic 100%.
 */
export function isCallerStaff(authOrToken?: any): boolean {
  if (isCallerAdmin(authOrToken)) return true;

  const token = extractTokenObject(authOrToken);
  if (!token) return false;

  if (isEmployeeOnlyRole(token.role)) {
    return true;
  }

  return STAFF_BOOLEAN_CLAIMS.some((key) => token[key] === true);
}

/**
 * Returns numeric hierarchy rank for role comparisons:
 * super_admin = 4, admin = 3, employee = 2, customer = 1
 */
export function getRoleRank(roleName?: string | null): number {
  if (!roleName) return 1;
  if (isSuperAdminRole(roleName)) return 4;
  if (isAdminRole(roleName)) return 3;
  if (isEmployeeOnlyRole(roleName)) return 2;
  return 1;
}

/**
 * Resolves normalized UserRoleName from Firebase Auth Custom Claims.
 * Priority matches firestore.rules & storage.rules:
 * 1) role string claim (if present and recognized, or falls back when role is explicitly set unless boolean claims override when role is unset)
 * 2) boolean claims (super_admin/superAdmin/owner -> admin -> employee/staff/manager)
 */
export function getUserRoleFromClaims(claims?: Record<string, any> | null): UserRoleName {
  if (!claims || typeof claims !== 'object') return 'customer';

  if (isCallerSuperAdmin(claims)) return 'super_admin';
  if (isCallerAdmin(claims)) return 'admin';
  if (isCallerStaff(claims)) return 'employee';

  return 'customer';
}
