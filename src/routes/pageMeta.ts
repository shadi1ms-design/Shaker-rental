import type { RouteName } from '../router';
import type { Vehicle } from '../types';

export interface PageMeta {
  /** Browser tab title (prefix, the site name is appended by useDocumentTitle). */
  docTitle: string;
  /** Title shown in the minimal top bar of sub-pages. */
  topBarTitle: string;
  badge?: string;
}

const vehicleName = (v: Vehicle | null) => (v ? `${v.brand} ${v.model}` : null);

export function getPageMeta(name: RouteName, vehicle: Vehicle | null): PageMeta {
  switch (name) {
    case 'admin':
      return { docTitle: 'لوحة الإدارة', topBarTitle: 'لوحة الإدارة' };
    case 'profile':
      return { docTitle: 'حسابي', topBarTitle: 'حسابي وحجوزاتي' };
    case 'login':
      return { docTitle: 'تسجيل الدخول', topBarTitle: 'تسجيل الدخول' };
    case 'register':
      return { docTitle: 'إنشاء حساب جديد', topBarTitle: 'إنشاء حساب جديد' };
    case 'about':
      return { docTitle: 'تواصل معنا', topBarTitle: 'تواصل معنا وموقعنا', badge: 'خدمة العملاء' };
    case 'book': {
      const title = vehicle ? `حجز ${vehicleName(vehicle)}` : 'حجز سيارة';
      return { docTitle: title, topBarTitle: title, badge: 'حجز إلكتروني' };
    }
    case 'car': {
      const title = vehicleName(vehicle) ?? 'تفاصيل السيارة';
      return { docTitle: title, topBarTitle: title, badge: 'مواصفات المركبة' };
    }
    case 'cars':
      return { docTitle: 'أسطول السيارات', topBarTitle: 'أسطول السيارات', badge: 'الأسطول المتاح' };
    case 'notFound':
      return { docTitle: 'الصفحة غير موجودة', topBarTitle: 'الصفحة غير موجودة' };
    default:
      return { docTitle: 'الرئيسية', topBarTitle: 'شاكر لتأجير السيارات' };
  }
}
