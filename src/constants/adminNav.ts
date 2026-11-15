import {
  LayoutDashboard,
  CalendarCheck,
  Car,
  BarChart3,
  Bell,
  ShieldCheck,
  Users,
  History,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type AdminTabType =
  | 'overview'
  | 'bookings'
  | 'vehicles'
  | 'reports'
  | 'notifications'
  | 'firestore_users'
  | 'staff'
  | 'activity_log'
  | 'settings';

export interface AdminNavItem {
  id: AdminTabType;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  path: string;
  section: 0 | 1 | 2;
}

export interface AdminNavSection {
  id: 0 | 1 | 2;
  title: string;
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  { id: 0, title: 'الرئيسية' },
  { id: 1, title: 'الإدارة والتحليلات' },
  { id: 2, title: 'النظام والطاقم' },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    id: 'overview',
    label: 'لوحة المؤشرات العامة',
    shortLabel: 'مؤشرات',
    icon: LayoutDashboard,
    path: '/admin/dashboard',
    section: 0,
  },
  {
    id: 'bookings',
    label: 'الحجوزات والتأجير',
    shortLabel: 'حجوزات',
    icon: CalendarCheck,
    path: '/admin/bookings',
    section: 0,
  },
  {
    id: 'vehicles',
    label: 'أسطول السيارات',
    shortLabel: 'أسطول',
    icon: Car,
    path: '/admin/vehicles',
    section: 0,
  },
  {
    id: 'reports',
    label: 'التقارير المالية والتشغيلية',
    shortLabel: 'تقارير',
    icon: BarChart3,
    path: '/admin/reports',
    section: 1,
  },
  {
    id: 'notifications',
    label: 'مركز التنبيهات',
    shortLabel: 'إشعارات',
    icon: Bell,
    path: '/admin/notifications',
    section: 1,
  },
  {
    id: 'firestore_users',
    label: 'توثيق الحسابات والعملاء',
    shortLabel: 'مستخدمين',
    icon: ShieldCheck,
    path: '/admin/users',
    section: 1,
  },
  {
    id: 'staff',
    label: 'فريق العمل والصلاحيات',
    shortLabel: 'صلاحيات',
    icon: Users,
    path: '/admin/staff',
    section: 2,
  },
  {
    id: 'activity_log',
    label: 'سجل النشاطات والأحداث',
    shortLabel: 'سجل',
    icon: History,
    path: '/admin/activity-log',
    section: 2,
  },
  {
    id: 'settings',
    label: 'إعدادات النظام',
    shortLabel: 'إعدادات',
    icon: Settings,
    path: '/admin/settings',
    section: 2,
  },
];

export const ADMIN_TAB_LABEL: Record<AdminTabType, string> = {
  overview: 'لوحة المؤشرات العامة',
  bookings: 'الحجوزات والتأجير',
  vehicles: 'أسطول السيارات',
  reports: 'التقارير المالية والتشغيلية',
  notifications: 'مركز التنبيهات',
  firestore_users: 'توثيق الحسابات والعملاء',
  staff: 'فريق العمل والصلاحيات',
  activity_log: 'سجل النشاطات والأحداث',
  settings: 'إعدادات النظام',
};

export const ADMIN_TAB_PATH: Record<AdminTabType, string> = {
  overview: '/admin/dashboard',
  bookings: '/admin/bookings',
  vehicles: '/admin/vehicles',
  reports: '/admin/reports',
  notifications: '/admin/notifications',
  firestore_users: '/admin/users',
  staff: '/admin/staff',
  activity_log: '/admin/activity-log',
  settings: '/admin/settings',
};

export type AdminRequiredRole = 'employee' | 'admin' | 'super_admin';

export interface AdminRouteConfig {
  tab: AdminTabType;
  requiredRole: AdminRequiredRole;
}

export const ADMIN_ROUTES: Record<string, AdminRouteConfig> = {
  '/admin/dashboard': { tab: 'overview', requiredRole: 'admin' },
  '/admin/bookings': { tab: 'bookings', requiredRole: 'employee' },
  '/admin/vehicles': { tab: 'vehicles', requiredRole: 'admin' },
  '/admin/reports': { tab: 'reports', requiredRole: 'admin' },
  '/admin/notifications': { tab: 'notifications', requiredRole: 'admin' },
  '/admin/users': { tab: 'firestore_users', requiredRole: 'admin' },
  '/admin/staff': { tab: 'staff', requiredRole: 'super_admin' },
  '/admin/activity-log': { tab: 'activity_log', requiredRole: 'super_admin' },
  '/admin/settings': { tab: 'settings', requiredRole: 'admin' },
};

export const ROLE_LABEL: Record<string, string> = {
  superAdmin: 'المدير العام',
  admin: 'مدير النظام',
  staff: 'موظف تنفيذ',
  employee: 'موظف تنفيذ',
  customer: 'عميل',
};
