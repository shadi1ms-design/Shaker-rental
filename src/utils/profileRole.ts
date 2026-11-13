import { VerificationStatus } from '../types';
import { NormalizedUserRole, normalizeRoleName } from './roles';

export type ProfileRole = NormalizedUserRole;
export type ProfileTabId = 'verification' | 'bookings' | 'profile' | 'security';

export interface ProfileRoleFlags {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
}

export interface ProfileRoleLabels {
  badge: string;
  accountType: string;
}

/**
 * تحديد دور الملف الشخصي بأولوية واضحة لأن isEmployee في AuthContext يشمل الأدمن والسوبر أدمن.
 */
export function resolveProfileRole({
  isSuperAdmin,
  isAdmin,
  isEmployee,
}: ProfileRoleFlags): ProfileRole {
  if (isSuperAdmin) return 'super_admin';
  if (isAdmin) return 'admin';
  if (isEmployee) return 'employee';
  return 'customer';
}

export function getProfileRoleLabels(role: ProfileRole | unknown): ProfileRoleLabels {
  switch (normalizeRoleName(role)) {
    case 'super_admin':
      return { badge: 'المدير العام', accountType: 'المدير العام' };
    case 'admin':
      return { badge: 'مسؤول النظام', accountType: 'مدير التشغيل' };
    case 'employee':
      return { badge: 'موظف', accountType: 'موظف تشغيل' };
    case 'customer':
    default:
      return { badge: 'عميل شاكر', accountType: 'حساب عميل' };
  }
}

export function getProfileTabs(
  role: ProfileRole
): { tabs: ProfileTabId[]; defaultTab: ProfileTabId } {
  if (role === 'customer') {
    return {
      tabs: ['verification', 'bookings', 'profile'],
      defaultTab: 'verification',
    };
  }

  return {
    tabs: ['profile', 'security'],
    defaultTab: 'profile',
  };
}

export function getCustomerDefaultTab(
  verificationStatus?: VerificationStatus | string | null
): 'bookings' | 'verification' {
  return verificationStatus === 'verified' ? 'bookings' : 'verification';
}
