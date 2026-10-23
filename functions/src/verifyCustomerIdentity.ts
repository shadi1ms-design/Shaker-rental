import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as crypto from 'crypto';
import { FUNCTION_REGION, DATABASE_ID, DEFAULT_STORAGE_BUCKET } from './constants';
import { isCallerAdmin, assertNotRevoked } from './authz';
import { inspectServerImage } from './imageQuality';

const db = getFirestore(getApp(), DATABASE_ID);

function sanitizeString(input: unknown, maxLen = 250): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>'"&;`\\]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function getClientIp(rawReq: any): string {
  const forwarded = rawReq?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return rawReq?.ip || rawReq?.connection?.remoteAddress || 'unknown';
}

function getUserAgent(rawReq: any): string {
  const ua = rawReq?.headers?.['user-agent'];
  return typeof ua === 'string' ? sanitizeString(ua, 250) : 'unknown';
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ATTEMPTS_30_DAYS = 5;
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SIGNED_URL_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Validates attempt rate limit (max 5 within 30 days)
 */
async function checkVerificationAttemptLimit(userId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const logsSnap = await db.collection('auditLogs')
    .where('action', '==', 'VERIFICATION_SUBMITTED')
    .where('targetUserId', '==', userId)
    .where('timestamp', '>=', thirtyDaysAgo)
    .get();

  return logsSnap.size;
}

// =============================================================================
// 1. INITIATE VERIFICATION SESSION (Single-use Nonce, 5-min TTL)
// =============================================================================
export const initiateVerificationSession = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لبدء جلسة التوثيق.');
    }

    const callerRecord = await assertNotRevoked(request);
    const userId = request.auth.uid;

    // Check account status
    if (callerRecord.disabled) {
      throw new HttpsError('permission-denied', 'الحساب معطل ولا يمكن تقديم طلب توثيق.');
    }

    // Rate limit check
    const attemptsLast30Days = await checkVerificationAttemptLimit(userId);
    if (attemptsLast30Days >= MAX_ATTEMPTS_30_DAYS) {
      throw new HttpsError(
        'resource-exhausted',
        `تجاوزت الحد الأقصى لمحاولات التوثيق (${MAX_ATTEMPTS_30_DAYS} محاولات خلال 30 يوماً). يرجى مراجعة إدارة الشركة.`
      );
    }

    // Check existing request status
    const reqRef = db.collection('verificationRequests').doc(userId);
    const reqSnap = await reqRef.get();
    const existingReq = reqSnap.data();

    if (existingReq?.status === 'verified') {
      throw new HttpsError('failed-precondition', 'حسابك موثق ومعتمد رسمياً ولا يحتاج إلى إعادة توثيق.');
    }

    if (existingReq?.status === 'pending_review') {
      throw new HttpsError('failed-precondition', 'لديك طلب توثيق قيد المراجعة الإدارية حالياً. يرجى انتظار قرار المدير.');
    }

    const nonce = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();

    // Store temporary session with TTL
    await db.collection('verificationSessions').doc(`${userId}_${nonce}`).set({
      userId,
      nonce,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      ip: getClientIp(request.rawRequest),
      userAgent: getUserAgent(request.rawRequest),
      consumed: false,
    });

    return {
      success: true,
      nonce,
      expiresAt,
      allowedDocTypes: ['driver_license', 'identity'],
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS_30_DAYS - attemptsLast30Days),
    };
  }
);

// =============================================================================
// 2. SUBMIT VERIFICATION DOCUMENT (Server-side camera JPEG upload)
// =============================================================================
export const submitVerificationDocument = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لرفع وثيقة التوثيق.');
    }

    await assertNotRevoked(request);
    const userId = request.auth.uid;
    const userEmail = (request.auth.token?.email || '').toLowerCase().trim();
    const data = request.data || {};

    const nonce = sanitizeString(data.nonce, 100);
    const docType = data.docType === 'driver_license' ? 'driver_license' : data.docType === 'identity' ? 'identity' : null;
    const identityDocType = data.identityDocType === 'passport' ? 'passport' : 'national_id';
    const imageBase64 = typeof data.imageBase64 === 'string' ? data.imageBase64 : '';

    if (!nonce || !docType || !imageBase64) {
      throw new HttpsError('invalid-argument', 'البيانات غير مكتملة (الجلسة، نوع الوثيقة، أو بيانات الصورة مفقودة).');
    }

    // 1. Consume session nonce (single-use validation)
    const sessionRef = db.collection('verificationSessions').doc(`${userId}_${nonce}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      throw new HttpsError('failed-precondition', 'جلسة الرفع غير صالحة أو انتهت مدتها. يرجى إعادة بدء التصوير.');
    }

    const sessionData = sessionSnap.data()!;
    if (sessionData.consumed || new Date(sessionData.expiresAt).getTime() < Date.now()) {
      await sessionRef.delete();
      throw new HttpsError('failed-precondition', 'انتهت صلاحية جلسة الرفع (5 دقائق). يرجى إعادة المحاولة بالكاميرا.');
    }

    // Invalidate session immediately
    await sessionRef.delete();

    // 2. Decode and sanitize image buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0 || buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new HttpsError('invalid-argument', 'حجم الصورة غير صالح (الحد الأقصى 10 ميغابايت).');
    }

    // 3. Deep server inspection
    const inspectResult = inspectServerImage(buffer);
    if (!inspectResult.isValidJpeg) {
      throw new HttpsError('invalid-argument', 'صيغة الملف غير مدعومة. يُقبل فقط تنسيق JPEG الملتقط بالكاميرا الحية.');
    }

    // Check resolution
    const meetsResolution =
      (inspectResult.width >= 1280 && inspectResult.height >= 720) ||
      (inspectResult.height >= 1280 && inspectResult.width >= 720);

    if (!meetsResolution) {
      throw new HttpsError(
        'invalid-argument',
        `دقة الصورة (${inspectResult.width}×${inspectResult.height}) أقل من الحد الأدنى المطلوب (1280×720). يرجى تقريب العدسة وإعادة التصوير.`
      );
    }

    // Rejection of edited or screenshot photos
    if (inspectResult.suspiciousEditorFound) {
      await db.collection('auditLogs').add({
        action: 'SUSPICIOUS_IMAGE_EDITOR_REJECTED',
        actorUid: userId,
        actorEmail: userEmail,
        editor: inspectResult.suspiciousEditorFound,
        timestamp: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError(
        'invalid-argument',
        'تم رصد بيانات معالجة رقمية في الصورة. يجب التقاط الوثيقة الأصلية بكاميرا الجهاز مباشرة دون تعديل.'
      );
    }

    // 4. Write directly to private storage path: verification_pending/{userId}/{docType}.jpg
    const bucket = getStorage().bucket(DEFAULT_STORAGE_BUCKET);
    const storagePath = `verification_pending/${userId}/${docType}.jpg`;
    const file = bucket.file(storagePath);

    await file.save(buffer, {
      contentType: 'image/jpeg',
      metadata: {
        cacheControl: 'no-store, max-age=0',
        contentDisposition: `inline; filename="${docType}.jpg"`,
        metadata: {
          uploadedBy: userId,
          docType,
          subType: docType === 'identity' ? identityDocType : 'driver_license',
          sha256: inspectResult.sha256,
          width: String(inspectResult.width),
          height: String(inspectResult.height),
          source: 'camera_direct_session',
        },
      },
    });

    const nowIso = new Date().toISOString();
    const docRecord = {
      storagePath,
      uploadedAt: nowIso,
      sizeBytes: buffer.length,
      sha256: inspectResult.sha256,
      quality: {
        width: inspectResult.width,
        height: inspectResult.height,
        blurScore: typeof data.clientQuality?.blurScore === 'number' ? data.clientQuality.blurScore : 100,
        brightness: typeof data.clientQuality?.brightness === 'number' ? data.clientQuality.brightness : 128,
        passed: true,
      },
      docType,
      subType: docType === 'identity' ? identityDocType : 'driver_license',
    };

    // 5. Update or create verificationRequests document
    const reqRef = db.collection('verificationRequests').doc(userId);
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) {
      await reqRef.set({
        id: userId,
        userId,
        userEmail,
        status: 'not_started',
        identityDocType,
        docs: {
          [docType]: docRecord,
        },
        attempt: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    } else {
      await reqRef.update({
        [`docs.${docType}`]: docRecord,
        identityDocType,
        updatedAt: nowIso,
      });
    }

    return {
      success: true,
      docType,
      uploadedAt: nowIso,
      quality: docRecord.quality,
      message: 'تم استلام وفحص الوثيقة بنجاح ومطابقتها لمعايير الأمان والجودة.',
    };
  }
);

// =============================================================================
// 3. SUBMIT FINAL VERIFICATION REQUEST (Locks request for review)
// =============================================================================
export const submitVerificationRequest = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لإرسال طلب التوثيق.');
    }

    const callerRecord = await assertNotRevoked(request);
    const userId = request.auth.uid;
    const userEmail = (request.auth.token?.email || callerRecord.email || '').toLowerCase().trim();
    const data = request.data || {};
    const identityDocType = data.identityDocType === 'passport' ? 'passport' : 'national_id';

    const reqRef = db.collection('verificationRequests').doc(userId);
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) {
      throw new HttpsError('failed-precondition', 'يرجى تصوير الوثائق المطلوبة أولاً قبل إرسال الطلب.');
    }

    const reqData = reqSnap.data()!;
    if (reqData.status === 'verified') {
      throw new HttpsError('failed-precondition', 'الحساب موثق بالفعل ولا يحتاج لمراجعة.');
    }

    if (reqData.status === 'pending_review') {
      throw new HttpsError('failed-precondition', 'طلبك مرسل بالفعل وقيد المراجعة حالياً.');
    }

    // Require both documents
    const hasDriverLicense = Boolean(reqData.docs?.driver_license?.storagePath);
    const hasIdentityDoc = Boolean(reqData.docs?.identity?.storagePath);

    if (!hasDriverLicense || !hasIdentityDoc) {
      throw new HttpsError(
        'failed-precondition',
        'يجب إكمال تصوير شهادة القيادة والوثيقة الشخصية (الهوية أو الجواز) قبل إرسال الطلب.'
      );
    }

    const nowIso = new Date().toISOString();
    const newAttempt = (reqData.attempt || 0) + 1;

    // Update verification request
    await reqRef.update({
      status: 'pending_review',
      identityDocType,
      submittedAt: nowIso,
      attempt: newAttempt,
      rejectionReason: null,
      updatedAt: nowIso,
    });

    // Sync to user and customer records
    const userUpdate = {
      verificationStatus: 'pending_review',
      verified: false,
      identityVerified: false,
      updatedAt: nowIso,
    };

    await db.collection('users').doc(userId).set(userUpdate, { merge: true });
    const custRef = db.collection('customers').doc(userId);
    const custSnap = await custRef.get();
    if (custSnap.exists) {
      await custRef.set(userUpdate, { merge: true });
    }

    // Audit log
    await db.collection('auditLogs').add({
      action: 'VERIFICATION_SUBMITTED',
      actorUid: userId,
      actorEmail: userEmail,
      actorType: 'customer',
      targetUserId: userId,
      attempt: newAttempt,
      identityDocType,
      timestamp: nowIso,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      status: 'pending_review',
      submittedAt: nowIso,
      attempt: newAttempt,
      message: 'تم إرسال طلب التوثيق بنجاح. سيقوم فريق الإدارة بمراجعته والرد قريباً.',
    };
  }
);

// =============================================================================
// 4. REVIEW VERIFICATION DECISION (Admin Only: Approve / Reject)
// =============================================================================
export const reviewVerification = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    await assertNotRevoked(request);

    if (!isCallerAdmin(request.auth?.token)) {
      throw new HttpsError('permission-denied', 'مراجعة وتوثيق الحسابات مقتصر حصراً على مدراء النظام.');
    }

    const callerUid = request.auth!.uid;
    const callerEmail = request.auth!.token?.email || 'admin';
    const data = request.data || {};

    const targetUserId = sanitizeString(data.targetUserId || data.userId, 128);
    const decision = String(data.decision || data.action || '').toLowerCase().trim();
    const rejectionReason = sanitizeString(data.rejectionReason || data.notes, 500);

    if (!targetUserId) {
      throw new HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }

    // Invariant: Self-verification forbidden
    if (targetUserId === callerUid) {
      throw new HttpsError('permission-denied', 'لا يمكن للمدير اعتماد أو رفض توثيق حسابه الشخصي بنفسه.');
    }

    if (decision !== 'approve' && decision !== 'reject') {
      throw new HttpsError('invalid-argument', 'القرار غير صالح. يجب اختيار (approve) أو (reject).');
    }

    const reqRef = db.collection('verificationRequests').doc(targetUserId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      throw new HttpsError('not-found', 'لا يوجد طلب توثيق مسجل لهذا المستخدم.');
    }

    const reqData = reqSnap.data()!;
    const bucket = getStorage().bucket(DEFAULT_STORAGE_BUCKET);
    const nowIso = new Date().toISOString();

    // -------------------------------------------------------------------------
    // Decision: APPROVE
    // -------------------------------------------------------------------------
    if (decision === 'approve') {
      const updatedDocs: Record<string, any> = {};

      // Move files from verification_pending to verification_vault
      for (const key of ['driver_license', 'identity']) {
        const item = reqData.docs?.[key];
        if (item?.storagePath) {
          const oldPath: string = item.storagePath;
          const fileName = oldPath.split('/').pop() || `${key}.jpg`;
          const newPath = `verification_vault/${targetUserId}/${fileName}`;

          try {
            const srcFile = bucket.file(oldPath);
            const [srcExists] = await srcFile.exists();
            if (srcExists) {
              await srcFile.copy(bucket.file(newPath));
              await srcFile.delete({ ignoreNotFound: true });
            }
          } catch (moveErr) {
            console.error(`[reviewVerification] Failed moving ${oldPath} to vault:`, moveErr);
          }

          updatedDocs[key] = {
            ...item,
            storagePath: newPath,
          };
        }
      }

      await reqRef.update({
        status: 'verified',
        docs: updatedDocs,
        reviewedAt: nowIso,
        reviewedBy: callerUid,
        reviewedByEmail: callerEmail,
        rejectionReason: null,
        updatedAt: nowIso,
      });

      const userVerifiedPayload = {
        verificationStatus: 'verified',
        verified: true,
        identityVerified: true,
        verifiedAt: nowIso,
        verifiedBy: callerUid,
        updatedAt: nowIso,
      };

      await db.collection('users').doc(targetUserId).set(userVerifiedPayload, { merge: true });
      const custRef = db.collection('customers').doc(targetUserId);
      const custSnap = await custRef.get();
      if (custSnap.exists) {
        await custRef.set(userVerifiedPayload, { merge: true });
      }

      await db.collection('auditLogs').add({
        action: 'VERIFICATION_APPROVED',
        actorUid: callerUid,
        actorEmail: callerEmail,
        actorType: 'staff',
        targetUserId,
        timestamp: nowIso,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        decision: 'approved',
        targetUserId,
        verificationStatus: 'verified',
        message: 'تم توثيق واعتماد حساب العميل بنجاح ونقل الوثائق إلى الخزنة المشفرة.',
      };
    }

    // -------------------------------------------------------------------------
    // Decision: REJECT
    // -------------------------------------------------------------------------
    if (!rejectionReason) {
      throw new HttpsError('invalid-argument', 'سبب الرفض إلزامي عند رفض طلب التوثيق لتوضيح السبب للعميل.');
    }

    // Purge pending photos from storage
    try {
      await bucket.deleteFiles({ prefix: `verification_pending/${targetUserId}/`, force: true });
    } catch (delErr) {
      console.warn(`[reviewVerification] Failed deleting pending files for ${targetUserId}:`, delErr);
    }

    await reqRef.update({
      status: 'rejected',
      docs: {
        driver_license: null,
        identity: null,
      },
      reviewedAt: nowIso,
      reviewedBy: callerUid,
      reviewedByEmail: callerEmail,
      rejectionReason,
      updatedAt: nowIso,
    });

    const userRejectedPayload = {
      verificationStatus: 'rejected',
      verified: false,
      identityVerified: false,
      verificationNotes: rejectionReason,
      updatedAt: nowIso,
    };

    await db.collection('users').doc(targetUserId).set(userRejectedPayload, { merge: true });
    const custRef = db.collection('customers').doc(targetUserId);
    const custSnap = await custRef.get();
    if (custSnap.exists) {
      await custRef.set(userRejectedPayload, { merge: true });
    }

    await db.collection('auditLogs').add({
      action: 'VERIFICATION_REJECTED',
      actorUid: callerUid,
      actorEmail: callerEmail,
      actorType: 'staff',
      targetUserId,
      reason: rejectionReason,
      timestamp: nowIso,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      decision: 'rejected',
      targetUserId,
      verificationStatus: 'rejected',
      rejectionReason,
      message: 'تم رفض طلب التوثيق وحذف الصور المعلقة، مع إتاحة إعادة التقديم للعميل.',
    };
  }
);

// =============================================================================
// 5. REVOKE VERIFICATION (Admin Only)
// =============================================================================
export const revokeVerification = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    await assertNotRevoked(request);

    if (!isCallerAdmin(request.auth?.token)) {
      throw new HttpsError('permission-denied', 'إلغاء التوثيق مقتصر حصراً على مدراء النظام.');
    }

    const callerUid = request.auth!.uid;
    const callerEmail = request.auth!.token?.email || 'admin';
    const data = request.data || {};

    const targetUserId = sanitizeString(data.targetUserId || data.userId, 128);
    const reason = sanitizeString(data.reason || data.notes, 500);

    if (!targetUserId || !reason) {
      throw new HttpsError('invalid-argument', 'معرف المستخدم وسبب الإلغاء إلزاميان لإلغاء التوثيق.');
    }

    if (targetUserId === callerUid) {
      throw new HttpsError('permission-denied', 'لا يمكن للمدير إلغاء توثيق حسابه بنفسه.');
    }

    const bucket = getStorage().bucket(DEFAULT_STORAGE_BUCKET);
    try {
      await bucket.deleteFiles({ prefix: `verification_vault/${targetUserId}/`, force: true });
      await bucket.deleteFiles({ prefix: `verification_pending/${targetUserId}/`, force: true });
    } catch (err) {
      console.warn(`[revokeVerification] File purge failed for ${targetUserId}:`, err);
    }

    const nowIso = new Date().toISOString();
    const reqRef = db.collection('verificationRequests').doc(targetUserId);
    await reqRef.set({
      id: targetUserId,
      userId: targetUserId,
      status: 'not_started',
      identityDocType: 'national_id',
      docs: {},
      attempt: 0,
      rejectionReason: `تم إلغاء التوثيق بقرار إداري: ${reason}`,
      updatedAt: nowIso,
    }, { merge: true });

    const userPayload = {
      verificationStatus: 'not_started',
      verified: false,
      identityVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      verificationNotes: reason,
      updatedAt: nowIso,
    };

    await db.collection('users').doc(targetUserId).set(userPayload, { merge: true });
    const custRef = db.collection('customers').doc(targetUserId);
    const custSnap = await custRef.get();
    if (custSnap.exists) {
      await custRef.set(userPayload, { merge: true });
    }

    await db.collection('auditLogs').add({
      action: 'VERIFICATION_REVOKED',
      actorUid: callerUid,
      actorEmail: callerEmail,
      actorType: 'staff',
      targetUserId,
      reason,
      timestamp: nowIso,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      targetUserId,
      message: 'تم إلغاء توثيق الحساب وإزالة الوثائق من الخزنة بنجاح.',
    };
  }
);

// =============================================================================
// 6. GET VERIFICATION DOCUMENT URL (Admin Only, 60s Signed URL + Audit Log)
// =============================================================================
export const getVerificationDocumentUrl = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    await assertNotRevoked(request);

    // Strictly Admin or Super Admin (regular employees CANNOT view identity docs)
    if (!isCallerAdmin(request.auth?.token)) {
      throw new HttpsError(
        'permission-denied',
        'معاينة وثائق الهوية ورخص القيادة مقتصرة حصراً على مدراء النظام (Admins).'
      );
    }

    const callerUid = request.auth!.uid;
    const callerEmail = request.auth!.token?.email || 'admin';
    const data = request.data || {};

    const targetUserId = sanitizeString(data.targetUserId || data.userId, 128);
    const docType = data.docType === 'driver_license' ? 'driver_license' : data.docType === 'identity' ? 'identity' : null;

    if (!targetUserId || !docType) {
      throw new HttpsError('invalid-argument', 'معرف المستخدم ونوع الوثيقة مطلوبان.');
    }

    const reqRef = db.collection('verificationRequests').doc(targetUserId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      throw new HttpsError('not-found', 'طلب التوثيق غير موجود.');
    }

    const reqData = reqSnap.data()!;
    const docItem = reqData.docs?.[docType];

    if (!docItem?.storagePath) {
      throw new HttpsError('not-found', 'الوثيقة المطلوبة غير متوفرة أو تم حذفها.');
    }

    const bucket = getStorage().bucket(DEFAULT_STORAGE_BUCKET);
    const file = bucket.file(docItem.storagePath);
    const [exists] = await file.exists();

    if (!exists) {
      throw new HttpsError('not-found', 'ملف الوثيقة غير موجود في مساحة التخزين.');
    }

    const expiresAtMs = Date.now() + SIGNED_URL_TTL_MS;
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAtMs,
      responseDisposition: 'inline',
      responseResponseHeaders: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });

    // Mandatory Audit Trail for Every Single View
    await db.collection('auditLogs').add({
      action: 'DOCUMENT_VIEWED',
      actorUid: callerUid,
      actorEmail: callerEmail,
      actorType: 'staff',
      targetUserId,
      docType,
      storagePath: docItem.storagePath,
      timestamp: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      signedUrl,
      expiresAt: new Date(expiresAtMs).toISOString(),
      docType,
      quality: docItem.quality || null,
    };
  }
);

// =============================================================================
// 7. COMPATIBLE ROUTER: verifyCustomerIdentity
// =============================================================================
export const verifyCustomerIdentity = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    const data = request.data || {};
    const action = String(data.action || '').trim();

    if (action === 'initiate_session') {
      return (initiateVerificationSession as any).run(request);
    }
    if (action === 'submit_document') {
      return (submitVerificationDocument as any).run(request);
    }
    if (action === 'submit_request') {
      return (submitVerificationRequest as any).run(request);
    }
    if (action === 'review' || action === 'set_status' || action === 'review_decision') {
      return (reviewVerification as any).run(request);
    }
    if (action === 'revoke') {
      return (revokeVerification as any).run(request);
    }
    if (action === 'get_url') {
      return (getVerificationDocumentUrl as any).run(request);
    }

    // Default: Check self status
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب.');
    }

    const targetUid = isCallerAdmin(request.auth?.token) && data.targetUserId
      ? sanitizeString(data.targetUserId, 128)
      : request.auth.uid;

    const reqSnap = await db.collection('verificationRequests').doc(targetUid).get();
    const reqData = reqSnap.data();

    return {
      success: true,
      verificationStatus: reqData?.status || 'not_started',
      request: reqData || null,
    };
  }
);
