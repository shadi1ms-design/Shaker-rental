# شاكر لتأجير السيارات — Shaker Car Rental Platform

نظام متكامل لتأجير السيارات مدعوم بخدمات Firebase السحابية، مع هيكل حماية متعدد الطبقات للمصادقة وتفويض الصلاحيات (RBAC).

---

## إدارة حسابات المدراء (Super Admin Management)

لإنشاء مدير عام جديد استخدم Admin SDK من جهاز المطوّر بسكربت مؤقت يضبط custom claims ثم يُحذف السكربت. لا توجد نقطة نهاية عامة لذلك.

---

## 🔒 حماية الحسابات والمصادقة (Authentication & Enterprise Security)

- **reCAPTCHA Enterprise & App Check**: مفعل لتأمين عمليات الحجز والتحقق من الهوية ضد البوتات وسوء الاستخدام.
- **Enumeration Protection**: حماية أسماء المستخدمين والبريد الإلكتروني من محاولات التخمين والاستكشاف.
- **MFA (Multi-Factor Authentication)**: توثيق متعدد العوامل اختياري/موصى به لحسابات الموظفين والمدراء.

## 🚀 النشر والترحيل (Deployment & Migration)

1. **Service Account Setup**: امنح حساب الدوال (Service Account) دور `Service Account Token Creator` (ضروري لـ `getSignedUrl`).
2. **Deploy**: شغّل `firebase deploy --only firestore:rules,firestore:indexes,storage,functions`.
3. **Data Migration**:
   - للترحيل التجريبي: `DRY_RUN=true DATABASE_ID=<your-db-id> npx tsx scripts/migrate_verification_data.ts`
   - للترحيل الفعلي: `DATABASE_ID=<your-db-id> npx tsx scripts/migrate_verification_data.ts`
