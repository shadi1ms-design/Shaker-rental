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
    icon: LayoutDashboard,
    path: '/admin/dashboard',
    section: 0,
  },
  {
    id: 'bookings',
    label: 'الحجوزات والتأجير',
    icon: CalendarCheck,
    path: '/admin/bookings',
    section: 0,
  },
  {
    id: 'vehicles',
    label: 'أسطول السيارات',
    icon: Car,
    path: '/admin/vehicles',
    section: 0,
  },
  {
    id: 'reports',
    label: 'التقارير المالية والتشغيلية',
    icon: BarChart3,
    path: '/admin/reports',
    section: 1,
  },
  {
    id: 'notifications',
    label: 'مركز التنبيهات',
    icon: Bell,
    path: '/admin/notifications',
    section: 1,
  },
  {
    id: 'firestore_users',
    label: 'توثيق الحسابات والعملاء',
    icon: ShieldCheck,
    path: '/admin/users',
    section: 1,
  },
  {
    id: 'staff',
    label: 'فريق العمل والصلاحيات',
    icon: Users,
    path: '/admin/staff',
    section: 2,
  },
  {
    id: 'activity_log',
    label: 'سجل النشاطات والأحداث',
    icon: History,
    path: '/admin/activity-log',
    section: 2,
  },
  {
    id: 'settings',
    label: 'إعدادات النظام',
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

export const ROLE_LABEL: Record<string, string> = {
  superAdmin: 'المدير العام',
  admin: 'مدير النظام',
  staff: 'موظف تنفيذ',
  employee: 'موظف تنفيذ',
  customer: 'عميل',
};
