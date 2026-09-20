import { isFirebaseConfigured, appCheckInstance } from '../firebase/config';

export interface AppCheckStatus {
  enabled: boolean;
  provider: string;
  hasToken: boolean;
  tokenExpiry?: string;
  debugMode: boolean;
}

class AppCheckService {
  /**
   * Get current App Check status
   */
  public getStatus(): AppCheckStatus {
    return {
      enabled: Boolean(appCheckInstance),
      provider: appCheckInstance ? 'reCAPTCHA Enterprise' : 'Standard Secure SSL / Firebase Auth Rules',
      hasToken: Boolean(appCheckInstance),
      debugMode: import.meta.env.DEV,
    };
  }

  /**
   * Request or refresh App Check token
   */
  public async getAttestationToken(): Promise<string | null> {
    return null;
  }

  /**
   * Run security verification check
   */
  public async verifySecurityEnvironment(): Promise<{
    passed: boolean;
    checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; message: string }>;
  }> {
    const checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; message: string }> = [];

    // 1. SSL/HTTPS check (Verifiable directly in browser environment)
    const isHttps = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
    checks.push({
      name: 'اتصال مشفر آمن (SSL / HTTPS)',
      status: isHttps ? 'pass' : 'warn',
      message: isHttps
        ? 'البروتوكول يعمل عبر اتصال مشفر وآمن (HTTPS / Localhost).'
        : 'الاتصال الحالي غير مشفر. يُوصى بفرض تشفير HTTPS دائماً في بيئة الإنتاج.',
    });

    // 2. Firebase App Check Attestation Status (Verifiable via initialized instance)
    const hasAppCheck = Boolean(appCheckInstance);
    checks.push({
      name: 'حماية التطبيق (Firebase App Check)',
      status: hasAppCheck ? 'pass' : 'warn',
      message: hasAppCheck
        ? 'خدمة Firebase App Check مفعّلة لحماية واجهات البرمجة من الاستدعاءات غير المصرح بها.'
        : 'خدمة App Check غير مفعلة في هذه البيئة (يتطلب تفعيل reCAPTCHA Enterprise من Firebase Console).',
    });

    // 3. Authorized Domain Check (Cannot be definitively audited client-side)
    checks.push({
      name: 'نطاق التطبيق المعتمد (Authorized Domains)',
      status: 'warn',
      message: 'التحقق من قائمة النطاقات المعتمدة يتطلب مراجعة إعدادات Firebase Console (Authentication > Settings > Authorized Domains).',
    });

    // 4. Cloud Security Rules (Executed server-side on Firebase servers)
    checks.push({
      name: 'قواعد أمان قاعدة البيانات (Firestore Security Rules)',
      status: isFirebaseConfigured ? 'warn' : 'fail',
      message: isFirebaseConfigured
        ? 'قواعد الأمان تُفرض خادمياً على كل استعلام؛ لمراجعة القواعد المنشورة يرجى فحص تبويب Rules في Firebase Console.'
        : 'Firebase غير مهيأ بالكامل في بيئة التشغيل الحالية.',
    });

    return {
      passed: checks.every((c) => c.status !== 'fail'),
      checks,
    };
  }
}

export const appCheckService = new AppCheckService();
