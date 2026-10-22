/**
 * Unified Backend Authorization & Role Authority Module
 * 
 * Implements identical role resolution and authorization hierarchy to firestore.rules:
 * - Super Admin (rank 4): super_admin, superAdmin, owner
 * - Admin (rank 3): admin
 * - Employee / Staff (rank 2): employee, staff, manager
 * - Customer / User (rank 1): customer, user, or unassigned
 * 
 * Strict Hierarchy Rules:
 * - Granting or revoking admin role is strictly restricted to Super Admin.
 * - Admin can only manage customer <-> employee transitions.
 * - Reject modifying any account whose role is >= the caller's role (equal or higher rank).
 * - No user can modify their own role.
 * - Super admin designation is protected and cannot be assigned via standard setUserRole.
 */

import { getAuth } from 'firebase-admin/auth';
import type { UserRecord } from 'firebase-admin/auth';
import { HttpsError } from 'firebase-functions/v2/https';
import { DESIGNATED_SUPER_ADMIN_UID } from './constants';

export type UserRoleName = 'customer' | 'employee' | 'admin' | 'super_admin';

/**
 * Extracts and checks if token custom claims confer Super Admin status.
 * Matches firestore.rules isSuperAdmin() logic exactly.
 */
export function isCallerSuperAdmin(authOrToken?: any): boolean {
  const token = authOrToken?.token || authOrToken;
  if (!token || typeof token !== 'object') return false;

  const role = typeof token.role === 'string' ? token.role.toLowerCase().trim() : '';
  if (['super_admin', 'superadmin', 'owner'].includes(role)) {
    return true;
  }

  return (
    token.super_admin === true ||
    token.superAdmin === true ||
    token.owner === true
  );
}

/**
 * Extracts and checks if token custom claims confer Admin status.
 * Matches firestore.rules isAdmin() logic exactly.
 */
export function isCallerAdmin(authOrToken?: any): boolean {
  if (isCallerSuperAdmin(authOrToken)) return true;

  const token = authOrToken?.token || authOrToken;
  if (!token || typeof token !== 'object') return false;

  const role = typeof token.role === 'string' ? token.role.toLowerCase().trim() : '';
  if (role === 'admin') {
    return true;
  }

  return token.admin === true;
}

/**
 * Extracts and checks if token custom claims confer Employee / Staff status.
 * Matches firestore.rules isEmployee() logic exactly.
 */
export function isCallerStaff(authOrToken?: any): boolean {
  if (isCallerAdmin(authOrToken)) return true;

  const token = authOrToken?.token || authOrToken;
  if (!token || typeof token !== 'object') return false;

  const role = typeof token.role === 'string' ? token.role.toLowerCase().trim() : '';
  if (['employee', 'staff', 'manager'].includes(role)) {
    return true;
  }

  return (
    token.employee === true ||
    token.staff === true ||
    token.manager === true
  );
}

/**
 * Returns numeric hierarchy rank for role comparisons:
 * super_admin = 4, admin = 3, employee = 2, customer = 1
 */
export function getRoleRank(roleName?: string | null): number {
  if (!roleName) return 1;
  const r = String(roleName).toLowerCase().trim();
  if (['super_admin', 'superadmin', 'owner'].includes(r)) return 4;
  if (r === 'admin') return 3;
  if (['employee', 'staff', 'manager'].includes(r)) return 2;
  return 1;
}

/**
 * Resolves normalized UserRoleName from Firebase Auth Custom Claims
 */
export function getUserRoleFromClaims(claims?: Record<string, any> | null): UserRoleName {
  if (!claims || typeof claims !== 'object') return 'customer';

  const role = typeof claims.role === 'string' ? claims.role.toLowerCase().trim() : '';
  if (['super_admin', 'superadmin', 'owner'].includes(role)) return 'super_admin';
  if (claims.super_admin === true || claims.superAdmin === true || claims.owner === true) return 'super_admin';

  if (role === 'admin' || claims.admin === true) return 'admin';
  if (['employee', 'staff', 'manager'].includes(role) || claims.employee === true || claims.staff === true || claims.manager === true) return 'employee';

  return 'customer';
}

/**
 * Evaluates whether a caller can manage a target user's role according to the strict hierarchy:
 * - Super admin only can grant or revoke admin.
 * - Admin can only manage customer <-> employee.
 * - Caller cannot modify accounts whose role rank >= caller role rank.
 * - Caller cannot modify their own role.
 * - Super admin rank cannot be granted via setUserRole.
 */
export function canManageUserRole(
  callerToken: any,
  callerUid: string,
  targetCurrentClaims: Record<string, any> | undefined | null,
  targetUid: string,
  newRole: string
): { allowed: boolean; reason?: string } {
  if (callerUid === targetUid) {
    return { allowed: false, reason: 'لا يمكن تعديل صلاحيات حسابك الخاص.' };
  }

  const isSuper = isCallerSuperAdmin(callerToken);
  const isAdmin = isCallerAdmin(callerToken);

  if (!isAdmin && !isSuper) {
    return {
      allowed: false,
      reason: 'غير مصرح لك بتعديل الصلاحيات. تعديل الصلاحيات مقتصر حصراً على مدراء النظام (Admin/Super Admin).',
    };
  }

  // Super admin role cannot be assigned via setUserRole
  const normalizedNewRole = String(newRole).toLowerCase().trim();
  if (['super_admin', 'superadmin', 'owner'].includes(normalizedNewRole)) {
    return {
      allowed: false,
      reason: 'لا يمكن منح صلاحية المدير العام (Super Admin) عبر واجهة تعديل الأدوار.',
    };
  }

  const validRoles = ['customer', 'employee', 'admin'];
  if (!validRoles.includes(normalizedNewRole)) {
    return {
      allowed: false,
      reason: 'الدور المحدد غير صالح. الأدوار المعتمدة: customer, employee, admin.',
    };
  }

  const callerRank = isSuper ? 4 : 3;
  const targetCurrentRole = getUserRoleFromClaims(targetCurrentClaims);
  const targetRank = getRoleRank(targetCurrentRole);

  // Protected root Super Admin
  if (targetUid === DESIGNATED_SUPER_ADMIN_UID) {
    return {
      allowed: false,
      reason: 'لا يمكن تعديل صلاحيات الحساب الرئيسي للنظام (Designated Super Admin).',
    };
  }

  // Caller cannot modify accounts with rank >= caller rank
  if (targetRank >= callerRank) {
    return {
      allowed: false,
      reason: 'غير مصرح بتعديل حساب ذو دور يوازي أو يعلو دور المنفّذ (Role hierarchy violation).',
    };
  }

  // Only super admin can grant or revoke admin
  const isAssigningAdmin = normalizedNewRole === 'admin';
  const isRevokingAdmin = targetCurrentRole === 'admin';

  if ((isAssigningAdmin || isRevokingAdmin) && !isSuper) {
    return {
      allowed: false,
      reason: 'منح أو سحب صلاحية المدير (Admin) مقتصر حصراً على المدير العام (Super Admin).',
    };
  }

  // Regular admin can only manage customer <-> employee
  if (!isSuper) {
    const isAllowedTransition =
      (targetCurrentRole === 'customer' || targetCurrentRole === 'employee') &&
      (normalizedNewRole === 'customer' || normalizedNewRole === 'employee');

    if (!isAllowedTransition) {
      return {
        allowed: false,
        reason: 'صلاحية المدير العادي تقتصر على إدارة أدوار (عميل ↔ موظف) فقط.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Evaluates whether a caller can toggle or delete another user account according to hierarchy:
 * - Admin or Super Admin only
 * - Caller cannot toggle/delete their own account
 * - Target rank must be < caller rank
 * - Target cannot be designated super admin
 */
export function canManageAccountLifecycle(
  callerToken: any,
  callerUid: string,
  targetCurrentClaims: Record<string, any> | undefined | null,
  targetUid: string,
  action: 'toggle' | 'delete'
): { allowed: boolean; reason?: string } {
  if (callerUid === targetUid) {
    return {
      allowed: false,
      reason: action === 'delete' ? 'لا يمكنك حذف حسابك الخاص.' : 'لا يمكنك تعطيل حسابك الخاص.',
    };
  }

  const isSuper = isCallerSuperAdmin(callerToken);
  const isAdmin = isCallerAdmin(callerToken);

  if (action === 'delete') {
    // Delete is strictly Super Admin
    if (!isSuper) {
      return {
        allowed: false,
        reason: 'حذف الحسابات نهائياً مقتصر حصراً على المدير العام (Super Admin).',
      };
    }
  } else {
    // Toggle is Admin or Super Admin
    if (!isAdmin && !isSuper) {
      return {
        allowed: false,
        reason: 'تعديل حالة الحساب مقتصر حصراً على مدراء النظام (Admin/Super Admin).',
      };
    }
  }

  if (targetUid === DESIGNATED_SUPER_ADMIN_UID) {
    return {
      allowed: false,
      reason: 'لا يمكن اتخاذ هذا الإجراء على حساب المدير العام الرئيسي للنظام.',
    };
  }

  const callerRank = isSuper ? 4 : 3;
  const targetCurrentRole = getUserRoleFromClaims(targetCurrentClaims);
  const targetRank = getRoleRank(targetCurrentRole);

  if (targetRank >= callerRank) {
    return {
      allowed: false,
      reason: 'لا يمكن إدارة حساب ذو دور يوازي أو يعلو دور المنفّذ.',
    };
  }

  return { allowed: true };
}

/**
 * Asserts that the caller account is active, not disabled, and that the ID token
 * was issued after tokensValidAfterTime (session not revoked).
 */
export async function assertNotRevoked(request: any): Promise<UserRecord> {
  const uid = request?.auth?.uid;
  if (!uid || typeof uid !== 'string') {
    throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب للتحقق من هوية وحالة الحساب.');
  }

  let userRecord: UserRecord;
  try {
    userRecord = await getAuth().getUser(uid);
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') {
      throw new HttpsError('unauthenticated', 'حساب المستخدم غير موجود في نظام التوثيق.');
    }
    throw new HttpsError('internal', 'حدث خطأ أثناء التحقق من حالة حساب المستخدم.');
  }

  if (userRecord.disabled) {
    throw new HttpsError('permission-denied', 'تم تعطيل هذا الحساب من قِبل إدارة النظام.');
  }

  const tokenIat = request.auth?.token?.iat;
  if (userRecord.tokensValidAfterTime && typeof tokenIat === 'number') {
    const validAfterMs = Date.parse(userRecord.tokensValidAfterTime);
    if (!isNaN(validAfterMs) && tokenIat * 1000 < validAfterMs) {
      throw new HttpsError(
        'unauthenticated',
        'انتهت صلاحية جلسة تسجيل الدخول أو تم إلغاؤها (Token Revoked). يرجى تسجيل الدخول مجدداً.'
      );
    }
  }

  return userRecord;
}
