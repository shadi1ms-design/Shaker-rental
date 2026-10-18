# CHANGELOG_FIXES.md - توثيق إصلاحات وتحديثات مشفى ومؤسسة شاكر لتأجير السيارات

هذا المستند يوثّق جميع التعديلات الهيكلية، والأمنية، والوظيفية التي تم إنجازها في مشروع **شاكر لتأجير السيارات (Shaker Car Rental)** وفق الشروط والتوجيهات المحددة.

---

## 1. الصلاحيات والمصادقة (Permissions & Auth)
- **وحدة الصلاحيات الموحدة (`functions/src/authz.ts`)**:
  - إنشاء نظام صلاحيات وهرمية أدوار موحدة تطابق تماماً قواعد الأمان في `firestore.rules`.
  - الهرمية المقبولة: `super_admin` / `superAdmin` / `owner` (الرتبة 4) > `admin` (الرتبة 3) > `employee` (الرتبة 2) > `customer` (الرتبة 1).
  - التأكد من عدم السماح بتعديل أو ترقية أي حساب يمتلك دوراً أكبر أو يساوى دور المنفّذ.
  - دمج المطالبات الحالية (`getUser(uid).customClaims`) عند تعيين الدور وتجنّب الاستبدال الكامل.
  - إلغاء رموز التحديث (`revokeRefreshTokens`) وتسجيل حدث تدقيق أمني (`auditLog`).

- **إلغاء نظام الإغلاق المخصص والتأمين الخارجي**:
  - حذف آليات قفل الدخول القديمة القابلة للاستغلال (`checkLoginAllowed`, `recordFailedLogin`, `enforceLoginLockout`, إلخ).
  - توثيق تفعيل reCAPTCHA Enterprise وحماية enumeration وMFA للموظفين في `README.md`.
  - تحديث `syncMyRole` لقراءة custom claims مباشرةً من `getUser(uid)`.

- **حذف نظام الإقلاع الأولي (Super Admin Bootstrap)**:
  - إزالة كافة آليات ورموز التهيئة الأولية للمدير العام بالكامل من السيرفر والعميل والسكربتات والمستندات.
  - الاعتماد حصراً على المعرّف المخصص الثابت للمدير الفائق (`DESIGNATED_SUPER_ADMIN_UID`).
  - ملاحظة: لإنشاء مدير عام جديد استخدم Admin SDK من جهاز المطوّر بسكربت مؤقت يضبط custom claims ثم يُحذف السكربت. لا توجد نقطة نهاية عامة لذلك.

- **فرض App Check و HMAC**:
  - إضافة `enforceAppCheck: true` على جميع الدوال القابلة للاستدعاء (`createBookingSecure`, `generateRentalContractPdf`, `syncMyRole`, `setUserRole`, `toggleUserAccountStatus`, `deleteUserAccount`, `syncFleetMaintenance`, إلخ).
  - تكوين مفتاح reCAPTCHA Site Key ديناميكياً من `VITE_RECAPTCHA_SITE_KEY`.
  - تأمين مفتاح HMAC لعقود الإيجار بحيث يتطلب وجود السر `CONTRACT_HMAC_SECRET` من البيئة دون استخدام قيم افتراضية.
  - توليد مستند العقد وإعادة البيانات الأمنية الموثوقة.

---

## 2. قواعد الأمان والاستضافة (Security Rules & Hosting)
- **تحديث `firestore.rules`**:
  - منع الموظفين من التعديل الحر في الحجوزات إلا للحقول المحددة (`affectedKeys().hasOnly(...)`).
  - تحويل تعديلات الأسعار/الحالة/المدفوعات لتكون عبر Cloud Functions حصراً.
  - إخفاء وتشفير بيانات اللوحات ومسافات الزيت الحساسة من المستندات العامة للمركبات (`vehicles/{vehicleId}`).
  - اشتراط بريد إلكتروني مفعل (`email_verified == true`) لرفع الملفات الحساسة والتأكد من ملكية الملفات غير المعتمدة قبل الحذف.

- **تحديث `storage.rules` و `firebase.json`**:
  - ضبط القواعد لحظر رفع الفيديوهات أكبر من 100MB ومطابقة الامتدادات المسموحة (`mp4`, `webm`, `quicktime`) تحت `contracts/{contractId}/videos/`.
  - إضافة هيدرات الأمان الشاملة في `firebase.json`:
    - `Content-Security-Policy` (CSP)
    - `Strict-Transport-Security` (HSTS)
    - `Cross-Origin-Opener-Policy: same-origin-allow-popups`
    - ضبط `Cache-Control: no-cache` لمستند `index.html` وتفعيل `immutable` للأصول المكونة من هاش.

---

## 3. التسعير، الحجز والمدفوعات (Pricing, Bookings & Payments)
- **محرك التسعير الموحد (`src/services/pricing.ts`)**:
  - حساب أوقات الاستلام والإرجاع وفق توقيت دمشق الصريح (`Asia/Damascus` / `+03:00`).
  - استخدام `Math.ceil` لحساب الأيام ورفض التواريخ غير الشرعية (`return <= pickup`).
  - دعم رسوم السائق الخاص (`driverFee`) وتطبيق الخصومات الديناميكية للأعضاء (1% - 25%).
  - إلغاء التكرار في نصوص التوضيح والتأكد من دقة حساب المبالغ المتبقية والتأمين المسترد.

- **تسجيل المدفوعات الآمن (`recordPaymentSecure`)**:
  - تنفيذ معاملة ذرية (`db.runTransaction`) تُحدّث `paidAmount`, `remainingAmount`, `paymentStatus` باستخدام `FieldValue.increment`.
  - التثبت من عدم تجاوز المبلغ المدفوع للمتبقي مع توليد رقم إيصال تسلسلي تلقائي وموثق.

---

## 4. التكامل مع تيليجرام والجداول والمصادقة المتقدمة (Telegram & Scheduled Tasks)
- **بوت تيليجرام (`telegramWebhook` & `sendTelegramBookingAlert`)**:
  - تقييد الاستخدام بالمعرفات المصرحة فقط (`TELEGRAM_ALLOWED_USER_IDS` و `TELEGRAM_CHAT_ID`).
  - تفعيل وضع `HTML` مع تشفير النص لمنع ثغرات الحقن (XSS).
  - ضمان عدم التكرار (`idempotency`) عبر حفظ معرّفات التفاعلات وحالة `telegramAlertSentAt`.
  - توحيد كافة مناطق الدوال السحابية والفرع لتكون `asia-south1`.

- **فحص الصيانة المجدول وتدقيق الملفات المرفوعة**:
  - فحص المركبات التي تجاوزت مسافة تغيير الزيت وتوليد تذكيرات مع تجنب تكرار التنبيهات خلال 7 أيام.
  - دالة `validateUploadedFileSignature` للتحقق من Magic Bytes الحقيقية للصور والمستندات وفيديوهات المعاينة.

---

## 5. خصوصية الواجهة وجودة الكود (UI Privacy & Quality)
- **تنظيف البيانات وتأمين الجلسة**:
  - مسح كافة البيانات الحساسة المتبقية في `localStorage` وحذف المفتاح القديم `shaker_auth_session_v1`.
  - عند تسجيل الخروج: استدعاء `terminate(db)` و `clearIndexedDbPersistence(db)` وتنظيف التخزين المؤقت.
  - فصل تفاصيل اللوحات وحالة الصيانة للموظفين فقط من خلال استعلامات مجمعة وآمنة.
  - دعم تسجيل الدخول عبر Google بأسلوب `signInWithRedirect` ومعالجة خطأ الحسابات المزدوجة.
  - استبدال النوافذ التنبيهية النمطية (`window.alert` / `window.confirm`) بمكونات React احترافية (`ConfirmModal`, `Toast`).

---

## 6. نتائج الفحص والتكامل (Verification & Test Results)
- **فحص التوافقية والأخطاء البرمجية**:
  - `npx tsc --noEmit`: نجاح تام بدون أي أخطاء نوعية (0 errors).
  - `npm --prefix functions run build`: نجاح بناء Cloud Functions للنسخة الثانية v2 و Firebase Functions v6.
  - `npx vitest run`: نجاح كافة وحدات الاختبار للـ Pricing Engine, File Signatures, Authorization Hierarchy.
