# شاطر لتأجير السيارات — Shaker Car Rental Platform

نظام متكامل لتأجير السيارات مدعوم بخدمات Firebase السحابية، مع هيكل حماية متعدد الطبقات للمصادقة وتفويض الصلاحيات (RBAC).

---

## دالة حجب تسجيل الدخول السحابية (Blocking Cloud Function)

### `enforceLoginLockout` (Google Cloud Identity Platform v2)

تتواجد هذه الدالة في المسار `functions/src/index.ts` وتعمل كحاجز أمني خادمي من نوع `beforeUserSignedIn` (Blocking Function). 

#### آلية العمل:
1. يتم إطلاق الدالة خادمياً قبل اكتمال تسجيل دخول المستخدم في Firebase Authentication.
2. تقرأ مفتاح البريد الإلكتروني عبر دالة التشفير `getEmailRateLimitKey(email)`.
3. تتحقق من مستند الحماية في المسار `rateLimits/{emailKey}` في قاعدة بيانات Firestore.
4. إذا كان حقل `lockedUntil` أكبر من التوقيت الحالي (أي أن الحساب مجمد مؤقتاً بسبب تكرار المحاولات الخاطئة)، يتم رمي استثناء `HttpsError('permission-denied')` باللغة العربية مع إيضاح عدد الثواني المتبقية قبل إتاحة المحاولة مجدداً، مما يمنع إنشاء جلسة تسجيل الدخول تماماً.
5. في حال عدم وجود قفل نشط، تسمح الدالة بإكمال عملية تسجيل الدخول بسلاسة ودون تأخير.

---

## ⚠️ خطوات التفعيل والتسجيل اليدوي بعد النشر (Manual Registration Required)

> **ملاحظة أمنية بالغة الأهمية:**
> دوال الحجب (Blocking Functions) مثل `beforeUserSignedIn` لا يتم تفعيلها تلقائياً بمجرد تشغيل أمر النشر `firebase deploy --only functions`، ولا يمكن لأي أداة برمجية أو CLI ربطها آلياً، بل تتطلب خطوة ربط يدوية لمرة واحدة (أو بعد أي إعادة تسمية أو إعادة نشر رئيسية) من خلال لوحة تحكم Firebase:

### الخطوات المطلوبة:

1. **الترقية إلى Identity Platform (في حال لم تتم مسبقاً):**
   - افتح [Firebase Console](https://console.firebase.google.com/).
   - اختر مشروع التطبيق، ثم انتقل إلى: **Build → Authentication**.
   - تأكد من ترقية المشروع إلى **Authentication with Identity Platform** عبر النقر على زر **Upgrade** في الإشعار أو من علامة تبويب الإعدادات. (هذه الميزة تتطلب Identity Platform إجبارياً).

2. **ربط الدالة في لوحة التحكم:**
   - من قسم **Authentication**، افتح تبويب الإعدادات: **Settings**.
   - اختر من القائمة الجانبية: **Blocking Functions** (دوال الحجب).
   - في خانة **Before sign-in** (قبل تسجيل الدخول)، حدد الدالة: `enforceLoginLockout`.
   - انقر على **Save** (حفظ) لتفعيل الحظر الخادمي الفوري.
