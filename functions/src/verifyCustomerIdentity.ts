import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { isCallerStaff, assertNotRevoked } from './authz';

const db = getFirestore(getApp(), DATABASE_ID);

function sanitizeString(input: unknown, maxLen = 100): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>'"&;`\\]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Cloud Function: verifyCustomerIdentity (region: asia-south1)
 * Requirement 1:
 * - Administrative path: Staff cannot self-verify, session revocation check enforced.
 * - Self-service path: Does NOT overwrite verified/rejected statuses previously set by staff,
 *   and format validation failures NEVER set status to rejected.
 */
export const verifyCustomerIdentity = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب للتحقق من الهوية.');
    }

    const data = request.data || {};
    const action = typeof data.action === 'string' ? data.action : '';
    const isStaff = isCallerStaff(request.auth.token);

    // ---------------------------------------------------------------------------
    // Path A: Administrative Status Decision (Server-Authoritative)
    // ---------------------------------------------------------------------------
    if (action === 'set_status' || action === 'review_decision') {
      await assertNotRevoked(request);

      if (!isStaff) {
        throw new HttpsError(
          'permission-denied',
          'تعديل حالة توثيق هوية العملاء مقتصر حصراً على موظفي وإدارة الشركة.'
        );
      }

      const targetUserId = sanitizeString(data.targetUserId || data.targetCustomerId || data.userId, 128);
      const newStatus = typeof data.status === 'string' ? data.status.toLowerCase() : '';
      const validStatuses = ['pending', 'manual_review', 'verified', 'rejected'];

      if (!targetUserId) {
        throw new HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
      }

      // Security Invariant: Staff CANNOT self-verify!
      if (targetUserId === request.auth.uid) {
        throw new HttpsError(
          'permission-denied',
          'لا يمكن للموظف اعتماد توثيق حسابه الشخصي بنفسه (Self-Verification Forbidden).'
        );
      }

      if (!validStatuses.includes(newStatus)) {
        throw new HttpsError(
          'invalid-argument',
          `حالة التحقق غير صالحة. الحالات المقبولة: ${validStatuses.join(', ')}`
        );
      }

      const isVerified = newStatus === 'verified';
      const nowIso = new Date().toISOString();

      const updatePayload: Record<string, any> = {
        verificationStatus: newStatus,
        verified: isVerified,
        verifiedAt: isVerified ? nowIso : null,
        verifiedBy: request.auth.uid,
        updatedAt: nowIso,
      };

      if (data.notes) {
        updatePayload.verificationNotes = sanitizeString(data.notes, 255);
      }

      const userDocRef = db.collection('users').doc(targetUserId);
      const userSnap = await userDocRef.get();
      if (userSnap.exists) {
        await userDocRef.set(updatePayload, { merge: true });
      }

      const custDocRef = db.collection('customers').doc(targetUserId);
      const custSnap = await custDocRef.get();
      if (custSnap.exists) {
        await custDocRef.set(updatePayload, { merge: true });
      }

      await db.collection('auditLogs').add({
        action: 'CUSTOMER_VERIFICATION_STATUS_CHANGED',
        actorUid: request.auth.uid,
        actorEmail: request.auth.token?.email || null,
        actorType: 'staff',
        targetUserId,
        newStatus,
        isVerified,
        timestamp: nowIso,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        action: 'status_updated',
        targetUserId,
        verificationStatus: newStatus,
        verified: isVerified,
        verifiedAt: isVerified ? nowIso : undefined,
        verifiedBy: request.auth.uid,
        message: `تم تحديث حالة التحقق للعميل إلى [${newStatus}] بنجاح.`,
      };
    }

    // ---------------------------------------------------------------------------
    // Path B: Self-Service Customer Intake
    // ---------------------------------------------------------------------------
    const effectiveUserId = isStaff
      ? (sanitizeString(data.userId, 128) || request.auth.uid)
      : request.auth.uid;

    // Check user document for existing administrative status
    const userDocRef = db.collection('users').doc(effectiveUserId);
    const userSnap = await userDocRef.get();
    const existingUserData = userSnap.data();
    const existingStatus = existingUserData?.verificationStatus;

    // Invariant: Do not overwrite verified or rejected statuses previously set by staff
    if (existingStatus === 'verified') {
      return {
        success: true,
        formatValid: true,
        verified: existingStatus === 'verified',
        verificationStatus: existingStatus,
        requiresManualReview: false,
        message: existingStatus === 'verified'
          ? 'حسابك معتمد وموثق رسمياً لدى الشركة.'
          : 'طلب التوثيق مرفوض سابقاً بقرار إداري. يرجى مراجعة إدارة الشركة.',
      };
    }

    const { nationalId, phone, storagePath, documentType } = data || {};
    const cleanId = String(nationalId || '').trim().replace(/\D/g, '');
    const cleanPhone = String(phone || '').trim().replace(/[^\d+]/g, '');

    const hasNationalId = cleanId.length > 0;
    const isValidNationalId = hasNationalId ? (cleanId.length === 11 || cleanId.length === 10) : true;

    const hasPhone = cleanPhone.length > 0;
    const isValidPhone = hasPhone ? (cleanPhone.length >= 9 && cleanPhone.length <= 15) : true;

    const hasDocument = Boolean(storagePath && typeof storagePath === 'string');

    const formatValid = (hasNationalId ? isValidNationalId : true) &&
                        (hasPhone ? isValidPhone : true) &&
                        (hasNationalId || hasPhone || hasDocument);

    if (!formatValid) {
      return {
        success: false,
        formatValid: false,
        verified: false,
        verificationStatus: existingStatus || 'unverified',
        requiresManualReview: false,
        details: {
          nationalIdValid: hasNationalId ? isValidNationalId : undefined,
          phoneValid: hasPhone ? isValidPhone : undefined,
          documentReceived: hasDocument,
          documentType: sanitizeString(documentType, 50) || undefined,
        },
        message: 'صيغة الرقم الوطني أو رقم الهاتف غير مطابقة للمعايير المعتمدة.',
      };
    }

    if (userSnap.exists) {
      await userDocRef.set({
        verificationStatus: 'manual_review',
        verified: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return {
      success: true,
      formatValid: true,
      verified: false,
      verificationStatus: 'manual_review',
      requiresManualReview: true,
      details: {
        nationalIdValid: hasNationalId ? isValidNationalId : undefined,
        phoneValid: hasPhone ? isValidPhone : undefined,
        documentReceived: hasDocument,
        documentType: sanitizeString(documentType, 50) || undefined,
        requiresManualReview: true,
      },
      message: 'تم استلام البيانات والمستندات بنجاح. الطلب الآن قيد التدقيق الإداري اليدوي من قِبل فريق العمل.',
    };
  }
);
