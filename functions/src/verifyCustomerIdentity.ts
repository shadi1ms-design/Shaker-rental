import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as crypto from 'crypto';
import { FUNCTION_REGION, DATABASE_ID, DEFAULT_STORAGE_BUCKET } from './constants';
import { isCallerAdmin, assertNotRevoked } from './authz';
import { inspectServerImage, analyzeServerQuality } from './imageQuality';

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
  // Equality-only query (served by the automatic single-field indexes, no composite index needed);
  // the 30-day window is applied in memory.
  const logsSnap = await db.collection('auditLogs')
    .where('action', '==', 'VERIFICATION_SUBMITTED')
    .where('targetUserId', '==', userId)
    .get();

  return logsSnap.docs.filter((d) => String(d.data().timestamp || '') >= thirtyDaysAgo).length;
}

const MAX_SESSIONS_PER_HOUR = 15;
const SESSION_WINDOW_MS = 60 * 60 * 1000;

/**
 * Caps how many upload sessions a user may open per hour (the 5-attempt limit only counts final
 * submissions, so without this a user could open unlimited sessions).
 */
async function consumeSessionQuota(userId: string, userEmail: string): Promise<void> {
  const reqRef = db.collection('verificationRequests').doc(userId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const d = snap.data() || {};
    const windowStart = d.sessionWindowStart ? new Date(d.sessionWindowStart).getTime() : 0;
    const inWindow = windowStart && nowMs - windowStart < SESSION_WINDOW_MS;
    const used = inWindow ? Number(d.sessionsInWindow || 0) : 0;
    if (used >= MAX_SESSIONS_PER_HOUR) {
      throw new HttpsError('resource-exhausted', 'تجاوزت عدد محاولات التصوير المسموح بها خلال ساعة. حاول لاحقاً.');
    }
    const quota = {
      sessionWindowStart: inWindow ? d.sessionWindowStart : nowIso,
      sessionsInWindow: used + 1,
    };
    if (!snap.exists) {
      tx.set(reqRef, {
        id: userId,
        userId,
        userEmail,
        status: 'not_started',
        identityDocType: 'national_id',
        docs: {},
        attempt: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        ...quota,
      });
    } else {
      tx.update(reqRef, quota);
    }
  });
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

    await consumeSessionQuota(userId, (request.auth.token?.email || '').toLowerCase().trim());

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
      sessionId: nonce,
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

    const nonce = sanitizeString(data.nonce ?? data.sessionId, 100);
    const rawDocType = data.docType ?? data.docKey;
    const docType = rawDocType === 'driver_license' ? 'driver_license' : rawDocType === 'identity' ? 'identity' : null;
    const identityDocType = data.identityDocType === 'passport' ? 'passport' : 'national_id';
    const imageBase64 =
      typeof data.imageBase64 === 'string' ? data.imageBase64 : typeof data.base64Data === 'string' ? data.base64Data : '';

    // Client-supplied metadata: mimeType and clientQuality are read for contract parity,
    // but clientQuality is strictly ignored for the acceptance decision — server quality rules.
    const _clientMimeType = data.mimeType;
    const _clientQuality = data.clientQuality;
    void _clientMimeType;
    void _clientQuality;

    if (!nonce || !docType || !imageBase64) {
      throw new HttpsError('invalid-argument', 'البيانات غير مكتملة (الجلسة، نوع الوثيقة، أو بيانات الصورة مفقودة).');
    }

    // 0. A request that is locked (pending review / verified) can never receive new images.
    {
      const lockSnap = await db.collection('verificationRequests').doc(userId).get();
      const lockStatus = lockSnap.data()?.status;
      if (lockStatus === 'pending_review' || lockStatus === 'verified') {
        throw new HttpsError(
          'failed-precondition',
          lockStatus === 'verified'
            ? 'حسابك موثق ولا يمكن تعديل وثائقه.'
            : 'طلبك قيد المراجعة ولا يمكن تعديل الوثائق المرسلة.'
        );
      }
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

    // Server-side sharpness / exposure analysis. Client-reported numbers are NEVER trusted.
    let serverQuality;
    try {
      serverQuality = await analyzeServerQuality(buffer);
    } catch (qErr) {
      console.error('[submitVerificationDocument] Server quality analysis failed:', qErr);
      throw new HttpsError('internal', 'تعذر فحص جودة الصورة حالياً. يرجى المحاولة لاحقاً.');
    }
    if (!serverQuality.passed) {
      throw new HttpsError('invalid-argument', serverQuality.failureReason || 'الصورة غير واضحة بما يكفي. أعد التصوير.');
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

    // 4. Write to a UNIQUE staging object (never overwrites an object a submitted request points at).
    const bucket = getStorage().bucket(DEFAULT_STORAGE_BUCKET);
    const storagePath = `verification_pending/${userId}/${docType}_${crypto.randomUUID()}.jpg`;
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
        blurScore: serverQuality.blurScore,
        brightness: serverQuality.brightness,
        passed: true,
      },
      docType,
      subType: docType === 'identity' ? identityDocType : 'driver_license',
    };

    // 5. Attach to the request inside a transaction that re-checks the lock (closes the race with
    //    submitVerificationRequest / reviewVerification).
    const reqRef = db.collection('verificationRequests').doc(userId);
    let previousPath: string | undefined;
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(reqRef);
        const cur = snap.data();
        if (cur?.status === 'pending_review' || cur?.status === 'verified') {
          throw new HttpsError('failed-precondition', 'تم قفل الطلب أثناء الرفع. لا يمكن تعديل الوثائق الآن.');
        }
        previousPath = cur?.docs?.[docType]?.storagePath;
        if (!snap.exists) {
          tx.set(reqRef, {
            id: userId,
            userId,
            userEmail,
            status: 'not_started',
            identityDocType,
            docs: { [docType]: docRecord },
            attempt: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        } else {
          tx.update(reqRef, {
            [`docs.${docType}`]: docRecord,
            identityDocType,
            updatedAt: nowIso,
          });
        }
      });
    } catch (txErr) {
      await file.delete({ ignoreNotFound: true }).catch(() => {});
      throw txErr;
    }

    // Replacing a not-yet-submitted photo: remove the superseded staging object.
    if (previousPath && previousPath !== storagePath && previousPath.startsWith(`verification_pending/${userId}/`)) {
      await bucket.file(previousPath).delete({ ignoreNotFound: true }).catch(() => {});
    }

    return {
      success: true,
      docType,
      uploadedAt: nowIso,
      quality: docRecord.quality,
      docKey: docType,
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

    // Update verification request (transaction: re-check the state to avoid double submission)
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(reqRef);
      const st = fresh.data()?.status;
      if (st === 'pending_review' || st === 'verified') {
        throw new HttpsError('failed-precondition', 'الطلب مرسل بالفعل أو موثق.');
      }
      tx.update(reqRef, {
        status: 'pending_review',
        identityDocType,
        submittedAt: nowIso,
        attempt: newAttempt,
        rejectionReason: null,
        updatedAt: nowIso,
      });
    });

    // Invalidate every open upload session so nothing can be attached after submission.
    try {
      const openSessions = await db.collection('verificationSessions').where('userId', '==', userId).get();
      await Promise.all(openSessions.docs.map((d) => d.ref.delete()));
    } catch (sessErr) {
      console.warn('[submitVerificationRequest] Failed to clear sessions:', sessErr);
    }

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

    const targetUserId = sanitizeString(data.targetUserId || data.targetUid || data.userId, 128);
    const rawDecision = String(data.decision || data.action || '').toLowerCase().trim();
    // Legacy router action names map onto the new decisions
    const decision = rawDecision === 'verified' ? 'approve' : rawDecision === 'rejected' ? 'reject' : rawDecision;
    const rejectionReason = sanitizeString(data.rejectionReason || data.reason || data.notes, 500);

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

    // Only a submitted request can be decided (prevents approving incomplete requests and
    // rejecting already-verified accounts, which would orphan vault images).
    if (reqData.status !== 'pending_review') {
      throw new HttpsError(
        'failed-precondition',
        reqData.status === 'verified'
          ? 'الحساب موثق بالفعل. استخدم "إلغاء التوثيق" إن لزم.'
          : 'لا يوجد طلب مُرسَل قيد المراجعة لهذا المستخدم.'
      );
    }

    // -------------------------------------------------------------------------
    // Decision: APPROVE
    // -------------------------------------------------------------------------
    if (decision === 'approve') {
      const updatedDocs: Record<string, any> = {};

      // Both documents must exist in staging; move them to the vault. ANY failure aborts the
      // approval (nothing is marked verified) and rolls back copies already made.
      const copied: string[] = [];
      try {
        for (const key of ['driver_license', 'identity']) {
          const item = reqData.docs?.[key];
          if (!item?.storagePath) {
            throw new HttpsError('failed-precondition', 'الطلب غير مكتمل: إحدى الوثيقتين مفقودة.');
          }
          const oldPath: string = item.storagePath;
          const newPath = `verification_vault/${targetUserId}/${key}.jpg`;
          const srcFile = bucket.file(oldPath);
          const [srcExists] = await srcFile.exists();
          if (!srcExists) {
            throw new HttpsError('failed-precondition', 'ملف إحدى الوثائق غير موجود في التخزين. اطلب من العميل إعادة التقديم.');
          }
          await srcFile.copy(bucket.file(newPath));
          copied.push(newPath);
          updatedDocs[key] = { ...item, storagePath: newPath };
        }
      } catch (moveErr) {
        await Promise.all(copied.map((p) => bucket.file(p).delete({ ignoreNotFound: true }).catch(() => {})));
        if (moveErr instanceof HttpsError) throw moveErr;
        console.error('[reviewVerification] Vault move failed:', moveErr);
        throw new HttpsError('internal', 'تعذر نقل الوثائق إلى الخزنة. لم يتم اعتماد التوثيق، حاول مرة أخرى.');
      }

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(reqRef);
        if (snap.data()?.status !== 'pending_review') {
          throw new HttpsError('failed-precondition', 'لا يوجد طلب توثيق قيد المراجعة لهذا المستخدم.');
        }
        tx.update(reqRef, {
          status: 'verified',
          docs: updatedDocs,
          reviewedAt: nowIso,
          reviewedBy: callerUid,
          reviewedByEmail: callerEmail,
          rejectionReason: null,
          updatedAt: nowIso,
        });
      });

      // Staging copies are removed only after the vault copies and the status are committed.
      await bucket.deleteFiles({ prefix: `verification_pending/${targetUserId}/`, force: true }).catch((e) => {
        console.warn('[reviewVerification] Staging cleanup failed:', e);
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

    // Atomic Reject
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(reqRef);
      if (snap.data()?.status !== 'pending_review') {
        throw new HttpsError('failed-precondition', 'لا يوجد طلب توثيق قيد المراجعة لهذا المستخدم.');
      }
      tx.update(reqRef, {
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

    const targetUserId = sanitizeString(data.targetUserId || data.targetUid || data.userId, 128);
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
    // Atomic Revoke
    await db.runTransaction(async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (reqSnap.data()?.status !== 'verified') {
        throw new HttpsError('failed-precondition', 'الحساب غير موثق حالياً.');
      }
      tx.set(reqRef, {
        id: targetUserId,
        userId: targetUserId,
        status: 'not_started',
        identityDocType: 'national_id',
        docs: {},
        attempt: 0,
        rejectionReason: `تم إلغاء التوثيق بقرار إداري: ${reason}`,
        updatedAt: nowIso,
      }, { merge: true });
    });

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

    const targetUserId = sanitizeString(data.targetUserId || data.targetUid || data.userId, 128);
    const rawDoc = data.docType ?? data.docKey;
    const docType = rawDoc === 'driver_license' ? 'driver_license' : rawDoc === 'identity' ? 'identity' : null;

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
      url: signedUrl,
      expiresAt: new Date(expiresAtMs).toISOString(),
      docType,
      docKey: docType,
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

// =============================================================================
// 8. SCHEDULED CLEANUP: cleanupVerificationStaging
// =============================================================================
export const cleanupVerificationStaging = onSchedule(
  {
    region: FUNCTION_REGION,
    schedule: 'every 24 hours',
  },
  async () => {
    // 1. Delete expired sessions (ttl 5 mins, cleanup every 24h for > 1h old)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const expiredSessions = await db.collection('verificationSessions')
      .where('createdAt', '<', hourAgo)
      .get();
    await Promise.all(expiredSessions.docs.map(d => d.ref.delete()));

    // 2. Delete verification_pending files for not_started/rejected requests > 7 days old
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const requestsSnap = await db.collection('verificationRequests')
       .where('updatedAt', '<', sevenDaysAgo)
       .get();
    
    const requests = requestsSnap.docs.filter(d => ['not_started', 'rejected'].includes(d.data().status));

    const bucket = getStorage().bucket(DEFAULT_STORAGE_BUCKET);
    for (const reqSnap of requests) {
        const req = reqSnap.data();
        await bucket.deleteFiles({ prefix: `verification_pending/${req.userId}/`, force: true }).catch(console.error);
        await reqSnap.ref.update({ docs: {}, updatedAt: new Date().toISOString() }).catch(console.error);
    }
  }
);

