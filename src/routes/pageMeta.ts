import type { RouteName } from '../router';
import type { Vehicle } from '../types';

export interface PageMeta {
  /** Browser tab title (prefix, the site name is appended by useDocumentTitle). */
  docTitle: string;
  /** Title shown in the minimal top bar of sub-pages. */
  topBarTitle: string;
  badge?: string;
  description: string;
  /** True for non-indexable auth, profile, admin, booking, contract verification, and error routes. */
  noindex?: boolean;
}

const vehicleName = (v: Vehicle | null) => (v ? `${v.brand} ${v.model}` : null);

export function getPageMeta(name: RouteName, vehicle: Vehicle | null): PageMeta {
  switch (name) {
    case 'admin':
      return {
        docTitle: 'لوحة الإدارة',
        topBarTitle: 'لوحة الإدارة',
        description: 'لوحة تحكم إدارة شركة شاكر لتأجير السيارات لمتابعة الحجوزات والعقود والأسطول.',
        noindex: true,
      };
    case 'dashboard':
      return {
        docTitle: 'لوحة التحكم',
        topBarTitle: 'لوحة التحكم',
        description: 'توجيه تلقائي إلى لوحة التحكم الخاصة بحسابك لدى شركة شاكر لتأجير السيارات.',
        noindex: true,
      };
    case 'profile':
      return {
        docTitle: 'حسابي',
        topBarTitle: 'حسابي وحجوزاتي',
        description: 'عرض حجوزاتك السابقة والحالية ومتابعة حالة العقود والفحوصات لدى شركة شاكر لتأجير السيارات.',
        noindex: true,
      };
    case 'login':
      return {
        docTitle: 'تسجيل الدخول',
        topBarTitle: 'تسجيل الدخول',
        description: 'تسجيل الدخول إلى حسابك في شركة شاكر لتأجير السيارات لمتابعة حجزك وتوثيق عقودك.',
        noindex: true,
      };
    case 'register':
      return {
        docTitle: 'إنشاء حساب جديد',
        topBarTitle: 'إنشاء حساب جديد',
        description: 'أنشئ حساباً جديداً لدى شركة شاكر لتأجير السيارات واستمتع بحجز أسرع وعقود موثقة.',
        noindex: true,
      };
    case 'contact':
      return {
        docTitle: 'تواصل معنا',
        topBarTitle: 'تواصل معنا وموقعنا',
        badge: 'خدمة العملاء',
        description: 'تواصل مع فريق شركة شاكر لتأجير السيارات في دمشق عبر الهاتف أو الواتساب أو قم بزيارة فرعنا الرئيسي.',
      };
    case 'verifyContract':
      return {
        docTitle: 'التحقق من صحة العقد',
        topBarTitle: 'التحقق من صحة العقد',
        description: 'منظومة التدقيق السحابية والتحقق الرقمي المعتمدة لشركة شاكر لتأجير السيارات.',
        noindex: true,
      };
    case 'book': {
      const nameStr = vehicleName(vehicle);
      const title = nameStr ? `حجز ${nameStr}` : 'حجز سيارة';
      return {
        docTitle: title,
        topBarTitle: title,
        badge: 'حجز إلكتروني',
        description: nameStr
          ? `احجز سيارة ${nameStr} موديل ${vehicle?.year} فوراً من شركة شاكر لتأجير السيارات في دمشق بأسعار منافسة.`
          : 'احجز سيارتك المفضلة إلكترونياً من أسطول شاكر لتأجير السيارات في دمشق.',
        noindex: true,
      };
    }
    case 'car': {
      const nameStr = vehicleName(vehicle);
      const title = nameStr ?? 'تفاصيل السيارة';
      return {
        docTitle: title,
        topBarTitle: title,
        badge: 'مواصفات المركبة',
        description: nameStr
          ? `استعرض مواصفات سيارة ${nameStr} موديل ${vehicle?.year} (${vehicle?.color}) المتاحة للتأجير اليومي في دمشق.`
          : 'استعرض مواصفات وأسعار السيارات المتاحة للتأجير اليومي في دمشق لدى شركة شاكر.',
        noindex: false,
      };
    }
    case 'cars':
      return {
        docTitle: 'أسطول السيارات',
        topBarTitle: 'أسطول السيارات',
        badge: 'الأسطول المتاح',
        description: 'استعرض أسطول شركة شاكر لتأجير السيارات بدمشق. سيارات سيدان، سيدان (اقتصادي)، وSUV جاهزة للتسليم الفوري.',
      };
    case 'notFound':
      return {
        docTitle: 'الصفحة غير موجودة',
        topBarTitle: 'الصفحة غير موجودة',
        description: 'عذراً، الصفحة التي تبحث عنها غير موجودة في موقع شركة شاكر لتأجير السيارات.',
        noindex: true,
      };
    default:
      return {
        docTitle: 'الرئيسية',
        topBarTitle: 'شاكر لتأجير السيارات',
        description: 'شركة شاكر لتأجير السيارات في دمشق - الخيار الأول لتأجير سيارات السيدان، سيدان (اقتصادي)، وSUV بأسعار منافسة وعقود رسمية.',
      };
  }
}
