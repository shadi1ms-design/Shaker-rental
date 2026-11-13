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

import { getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { UserRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { DATABASE_ID, DESIGNATED_SUPER_ADMIN_UID } from './constants';
import {
  isCallerSuperAdmin,
  isCallerAdmin,
  isCallerStaff,
  getRoleRank,
  getUserRoleFromClaims,
  isSuperAdminRole,
  isAdminRole,
  isEmployeeOnlyRole,
  isStaffRole,
  normalizeRoleName,
  SUPER_ADMIN_ROLE_ALIASES,
  SUPER_ADMIN_BOOLEAN_CLAIMS,
  ADMIN_ROLE_ALIASES,
  ADMIN_BOOLEAN_CLAIMS,
  STAFF_ROLE_ALIASES,
  STAFF_BOOLEAN_CLAIMS,
} from './roles';
import type { UserRoleName } from './roles';

export type { UserRoleName };
export {
  isCallerSuperAdmin,
  isCallerAdmin,
  isCallerStaff,
  getRoleRank,
  getUserRoleFromClaims,
  isSuperAdminRole,
  isAdminRole,
  isEmployeeOnlyRole,
  isStaffRole,
  normalizeRoleName,
  SUPER_ADMIN_ROLE_ALIASES,
  SUPER_ADMIN_BOOLEAN_CLAIMS,
  ADMIN_ROLE_ALIASES,
  ADMIN_BOOLEAN_CLAIMS,
  STAFF_ROLE_ALIASES,
  STAFF_BOOLEAN_CLAIMS,
};

if (!DESIGNATED_SUPER_ADMIN_UID) {
  console.warn('[SECURITY WARNING] DESIGNATED_SUPER_ADMIN_UID is empty in environment! Root Super Admin protection may be degraded.');
}

/**
 * ملاحظة معمارية: مصدر الحقيقة (Source of Truth) للصلاحيات هو الحقل `role` في Custom Claims
 * والمعرّف مركزياً في `functions/src/roles.ts`.
 * أما الحقول المنطقية القديمة (booleans: admin, super_admin, superAdmin, owner, employee, staff, manager)
 * فهي مدعومة للتوافق العكسي فقط (Backward Compatibility).
 */

function getDesignatedSuperAdminUid(): string {
  const envVal = process.env.DESIGNATED_SUPER_ADMIN_UID;
  if (envVal !== undefined) {
    return envVal.trim();
  }
  return (DESIGNATED_SUPER_ADMIN_UID || '').trim();
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
  const designatedSuperAdminUid = getDesignatedSuperAdminUid();
  if (!designatedSuperAdminUid) {
    return {
      allowed: false,
      reason: 'إعداد الخادم ناقص: لم يتم ضبط معرّف المدير العام الرئيسي (DESIGNATED_SUPER_ADMIN_UID).',
    };
  }

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
  if (isSuperAdminRole(newRole) || isSuperAdminRole(normalizedNewRole)) {
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
  if (targetUid === designatedSuperAdminUid) {
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
  const designatedSuperAdminUid = getDesignatedSuperAdminUid();
  if (!designatedSuperAdminUid) {
    return {
      allowed: false,
      reason: 'إعداد الخادم ناقص: لم يتم ضبط معرّف المدير العام الرئيسي (DESIGNATED_SUPER_ADMIN_UID).',
    };
  }

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

  if (targetUid === designatedSuperAdminUid) {
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

export const assertCallerActiveAndValidToken = assertNotRevoked;

const MFA_CONFIG_CACHE_TTL_MS = 60 * 1000;

interface MfaConfigCache {
  value: boolean;
  expiresAt: number;
}

let mfaConfigCache: MfaConfigCache | null = null;

export function clearAdminMfaCache(): void {
  mfaConfigCache = null;
}

export function setAdminMfaCacheValue(value: boolean, ttlMs: number = MFA_CONFIG_CACHE_TTL_MS): void {
  mfaConfigCache = {
    value: Boolean(value),
    expiresAt: Date.now() + ttlMs,
  };
}

/**
 * Reads requireAdminMfa from Firestore document system_config/security with a 60s cache.
 * Falls back to process.env.REQUIRE_ADMIN_MFA (default false) if document does not exist.
 * Fails closed (returns true) if reading fails.
 */
export async function getRequireAdminMfa(dbOverride?: any): Promise<boolean> {
  const now = Date.now();
  if (mfaConfigCache && now < mfaConfigCache.expiresAt) {
    return mfaConfigCache.value;
  }

  try {
    const firestoreDb = dbOverride || getFirestore(getApp(), DATABASE_ID);
    const docSnap = await firestoreDb.collection('system_config').doc('security').get();
    let resolved: boolean;
    if (docSnap && docSnap.exists) {
      const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap.data;
      if (typeof data?.requireAdminMfa === 'boolean') {
        resolved = data.requireAdminMfa;
      } else {
        resolved = String(process.env.REQUIRE_ADMIN_MFA || '').toLowerCase().trim() === 'true';
      }
    } else {
      resolved = String(process.env.REQUIRE_ADMIN_MFA || '').toLowerCase().trim() === 'true';
    }
    mfaConfigCache = {
      value: resolved,
      expiresAt: Date.now() + MFA_CONFIG_CACHE_TTL_MS,
    };
    return resolved;
  } catch (err) {
    console.error('[authz] Failed reading system_config/security for MFA enforcement; failing closed:', err);
    return true;
  }
}

/**
 * If MFA enforcement is enabled and the caller is Admin or Super Admin,
 * rejects with permission-denied unless request.auth.token.firebase.sign_in_second_factor is present.
 */
export async function assertAdminMfa(request: any, dbOverride?: any): Promise<void> {
  const token = request?.auth?.token;
  if (!isCallerAdmin(token)) {
    return;
  }

  const requireMfa = await getRequireAdminMfa(dbOverride);
  if (!requireMfa) {
    return;
  }

  const secondFactor = token?.firebase?.sign_in_second_factor;
  if (!secondFactor || typeof secondFactor !== 'string' || !secondFactor.trim()) {
    throw new HttpsError(
      'permission-denied',
      'يشترط تفعيل المصادقة الثنائية (2FA) وتسجيل الدخول بالرمز الثنائي لتنفيذ هذه العملية الإدارية الحساسة.'
    );
  }
}



