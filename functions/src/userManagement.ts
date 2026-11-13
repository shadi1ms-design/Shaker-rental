import { HttpsError } from 'firebase-functions/v2/https';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { DocumentReference } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { UserRecord } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import {
  canManageUserRole,
  canManageAccountLifecycle,
  getUserRoleFromClaims,
  assertNotRevoked,
  isCallerSuperAdmin,
  getRequireAdminMfa,
  setAdminMfaCacheValue,
} from './authz';
import { isStaffRole } from './roles';
import { secureCall } from './secureCall';
import { writeAuditAsync } from './audit';

let _dbInstance: ReturnType<typeof getFirestore> | null = null;
function getDb() {
  if (!_dbInstance) {
    _dbInstance = getFirestore(getApp(), DATABASE_ID);
  }
  return _dbInstance;
}
const db = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const val = Reflect.get(instance, prop, receiver);
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});

export const VERIFICATION_FIELDS_TO_REMOVE = [
  'verified',
  'verificationStatus',
  'identityVerified',
  'verifiedAt',
  'verifiedBy',
  'verificationNotes',
  'verificationSubmittedAt',
] as const;

export interface StaffVerificationCleanupResult {
  verificationFieldsCleaned: boolean;
  archivedVerificationRequestId: string | null;
}

/**
 * Cleans verification fields from users/customers and archives any active
 * verificationRequests/{uid} document when a customer is promoted to a staff role.
 * Never deletes Storage files.
 */
export async function cleanupStaffVerificationOnPromotion(
  firestoreDb: any,
  params: {
    targetUid: string;
    callerUid: string;
    previousRole: string;
    newRole: string;
    nowIso?: string;
  }
): Promise<StaffVerificationCleanupResult> {
  const { targetUid, callerUid, previousRole, newRole } = params;
  const nowIso = params.nowIso || new Date().toISOString();

  const deletePayload: Record<string, any> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  for (const field of VERIFICATION_FIELDS_TO_REMOVE) {
    deletePayload[field] = FieldValue.delete();
  }

  await firestoreDb.collection('users').doc(targetUid).set(deletePayload, { merge: true });

  const custRef = firestoreDb.collection('customers').doc(targetUid);
  const custSnap = await custRef.get();
  if (custSnap.exists) {
    await custRef.set(deletePayload, { merge: true });
  }

  const reqRef = firestoreDb.collection('verificationRequests').doc(targetUid);
  const archiveId = `${targetUid}_${Date.now()}`;
  const archiveRef = firestoreDb.collection('verificationRequestsArchive').doc(archiveId);

  const archivedId = await firestoreDb.runTransaction(async (tx: any) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists) {
      return null;
    }
    const reqData = reqSnap.data() || {};
    tx.set(archiveRef, {
      ...reqData,
      originalUserId: targetUid,
      archived: true,
      archivedReason: 'promoted_to_staff',
      archivedBy: callerUid,
      archivedAt: nowIso,
      previousRole,
      newRole,
    });
    tx.delete(reqRef);
    return archiveId;
  });

  return {
    verificationFieldsCleaned: true,
    archivedVerificationRequestId: archivedId,
  };
}

/**
 * Cloud Function: setUserRole (region: asia-south1)
 * Enforces strict role hierarchy and claims merging.
 */
export const setUserRole = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'admin',
    requireMfa: true,
    dbOverride: db,
    permissionDeniedMessage:
      'غير مصرح لك بتعديل الصلاحيات. تعديل الصلاحيات مقتصر حصراً على مدراء النظام (Admin/Super Admin).',
  },
  async (request) => {
    const { targetUid, newRole } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
      throw new HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }

    const cleanTargetUid = targetUid.trim();
    const callerUid = request.auth!.uid;
    const callerToken = request.auth!.token;

    // 1. Verify target user exists in Firebase Authentication
    let targetUserRecord: UserRecord;
    try {
      targetUserRecord = await getAuth().getUser(cleanTargetUid);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        throw new HttpsError('not-found', 'المستخدم المستهدف غير موجود في نظام التوثيق.');
      }
      throw new HttpsError('internal', 'حدث خطأ أثناء التحقق من حساب المستخدم المستهدف.');
    }

    const targetExistingClaims = targetUserRecord.customClaims || {};

    // 2. Strict hierarchy authorization check
    const authzCheck = canManageUserRole(
      callerToken,
      callerUid,
      targetExistingClaims,
      cleanTargetUid,
      newRole
    );

    if (!authzCheck.allowed) {
      throw new HttpsError(
        'permission-denied',
        authzCheck.reason || 'غير مصرح بتعديل هذا الحساب وفق قواعد الهرمية الإدارية.'
      );
    }

    const normalizedRole = String(newRole).toLowerCase().trim();

    // 3. Merge existing claims instead of replacing
    const mergedClaims = {
      ...targetExistingClaims,
      role: normalizedRole,
      admin: normalizedRole === 'admin',
      employee: normalizedRole === 'employee' || normalizedRole === 'admin',
      super_admin: false,
      // Clear legacy boolean claims that Firestore/Storage rules would still honor
      staff: false,
      manager: false,
      superAdmin: false,
      owner: false,
    };

    try {
      await getAuth().setCustomUserClaims(cleanTargetUid, mergedClaims);
      // Revoke refresh tokens to force client re-authentication and immediate claim adoption
      await getAuth().revokeRefreshTokens(cleanTargetUid);
    } catch (authErr: any) {
      console.error('[setUserRole] Failed setting custom claims:', authErr);
      throw new HttpsError('internal', 'فشل تعيين مطالبات التوثيق للمستخدم في خادم المصادقة.');
    }

    const previousRole = getUserRoleFromClaims(targetExistingClaims);

    // 4. Synchronize display role metadata in Firestore users/{targetUid}
    try {
      await db.collection('users').doc(cleanTargetUid).set(
        {
          role: normalizedRole,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (dbErr) {
      console.warn('[setUserRole] Failed to sync users doc role display:', dbErr);
    }

    // 4.5. When promoted to a staff role, clear verification fields & archive verificationRequests
    //      without touching Storage files.
    let promotionCleanup: StaffVerificationCleanupResult = {
      verificationFieldsCleaned: false,
      archivedVerificationRequestId: null,
    };
    if (isStaffRole(normalizedRole)) {
      try {
        promotionCleanup = await cleanupStaffVerificationOnPromotion(db, {
          targetUid: cleanTargetUid,
          callerUid,
          previousRole,
          newRole: normalizedRole,
        });
      } catch (cleanupErr) {
        console.warn('[setUserRole] Failed cleaning verification state on staff promotion:', cleanupErr);
      }
    }

    // 5. Immutable audit log record
    await writeAuditAsync(db, {
      actorUid: callerUid,
      actorEmail: callerToken.email || null,
      actorRole: String(callerToken.role || 'admin'),
      actorType: 'staff',
      action: 'ROLE_MODIFIED',
      entity: 'user',
      entityId: cleanTargetUid,
      entityName: cleanTargetUid,
      details: `تعديل صلاحيات المستخدم ${cleanTargetUid} إلى ${normalizedRole} مع إبطال الجلسات السابقة`,
      metadata: {
        oldRole: previousRole,
        newRole: normalizedRole,
        verificationFieldsCleaned: promotionCleanup.verificationFieldsCleaned,
        archivedVerificationRequestId: promotionCleanup.archivedVerificationRequestId,
      },
    }).catch((auditErr) => {
      console.warn('[setUserRole] Audit write failed:', auditErr);
    });

    return {
      success: true,
      targetUid: cleanTargetUid,
      newRole: normalizedRole,
      message: `تم تحديث صلاحيات المستخدم بنجاح إلى "${normalizedRole}" وإبطال الجلسات السابقة.`,
    };
  }
);

/**
 * Cloud Function: toggleUserAccountStatus (region: asia-south1)
 * Enables or disables a user account in Auth and Firestore with token revocation.
 */
export const toggleUserAccountStatus = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'admin',
    requireMfa: (req) => req.data?.disabled !== false,
    dbOverride: db,
    permissionDeniedMessage:
      'تعديل حالة الحساب مقتصر حصراً على مدراء النظام (Admin/Super Admin).',
  },
  async (request) => {
    const { targetUid, disabled } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
      throw new HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }

    const cleanTargetUid = targetUid.trim();
    const callerUid = request.auth!.uid;
    const callerToken = request.auth!.token;

    // 1. Verify target user exists
    let targetUserRecord: UserRecord;
    try {
      targetUserRecord = await getAuth().getUser(cleanTargetUid);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        throw new HttpsError('not-found', 'المستخدم المستهدف غير موجود في نظام التوثيق.');
      }
      throw new HttpsError('internal', 'حدث خطأ أثناء التحقق من حساب المستخدم المستهدف.');
    }

    // 2. Strict hierarchy check
    const authzCheck = canManageAccountLifecycle(
      callerToken,
      callerUid,
      targetUserRecord.customClaims,
      cleanTargetUid,
      'toggle'
    );

    if (!authzCheck.allowed) {
      throw new HttpsError('permission-denied', authzCheck.reason || 'غير مصرح بتعديل هذا الحساب.');
    }

    const isDisabled = Boolean(disabled);

    // 3. Update status in Auth and revoke tokens
    try {
      await getAuth().updateUser(cleanTargetUid, { disabled: isDisabled });
      await getAuth().revokeRefreshTokens(cleanTargetUid);
    } catch (authErr: any) {
      console.error('[toggleUserAccountStatus] Auth update failed:', authErr);
      throw new HttpsError('internal', 'فشل تحديث حالة الحساب في خادم المصادقة.');
    }

    // 4. Update in Firestore
    try {
      await db.collection('users').doc(cleanTargetUid).set(
        {
          accountDisabled: isDisabled,
          disabled: isDisabled,
          active: !isDisabled,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (dbErr) {
      console.warn('[toggleUserAccountStatus] Firestore sync failed:', dbErr);
    }

    // 5. Audit log
    await writeAuditAsync(db, {
      actorUid: callerUid,
      actorEmail: callerToken.email || null,
      actorRole: String(callerToken.role || 'admin'),
      actorType: 'staff',
      action: isDisabled ? 'USER_ACCOUNT_DISABLED' : 'USER_ACCOUNT_ENABLED',
      entity: 'user',
      entityId: cleanTargetUid,
      entityName: cleanTargetUid,
      details: isDisabled ? `تعطيل حساب المستخدم ${cleanTargetUid} وإبطال جلساته` : `تفعيل حساب المستخدم ${cleanTargetUid}`,
    }).catch((auditErr) => {
      console.warn('[toggleUserAccountStatus] Audit write failed:', auditErr);
    });

    return {
      success: true,
      disabled: isDisabled,
      targetUid: cleanTargetUid,
      message: isDisabled ? 'تم تعطيل الحساب وإبطال جلساته النشطة بنجاح.' : 'تم تفعيل الحساب بنجاح.',
    };
  }
);

/**
 * Cloud Function: deleteUserAccount (region: asia-south1)
 * Deletes user account, purges storage files, anonymizes customer identity in bookings.
 */
export const deleteUserAccount = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'super_admin',
    requireMfa: true,
    dbOverride: db,
    permissionDeniedMessage:
      'حذف الحسابات نهائياً مقتصر حصراً على المدير العام (Super Admin).',
  },
  async (request) => {
    const { targetUid } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
      throw new HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }

    const cleanTargetUid = targetUid.trim();
    const callerUid = request.auth!.uid;
    const callerToken = request.auth!.token;

    // 1. Verify target user exists
    let targetUserRecord: UserRecord;
    try {
      targetUserRecord = await getAuth().getUser(cleanTargetUid);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        throw new HttpsError('not-found', 'المستخدم المستهدف غير موجود في نظام التوثيق.');
      }
      throw new HttpsError('internal', 'حدث خطأ أثناء التحقق من حساب المستخدم المستهدف.');
    }

    // 2. Strict hierarchy check (Super Admin only, rank < caller rank)
    const authzCheck = canManageAccountLifecycle(
      callerToken,
      callerUid,
      targetUserRecord.customClaims,
      cleanTargetUid,
      'delete'
    );

    if (!authzCheck.allowed) {
      throw new HttpsError('permission-denied', authzCheck.reason || 'غير مصرح بحذف هذا الحساب.');
    }

    // 2.5. Never delete an account that still holds a live reservation or a rented vehicle:
    try {
      const liveSnap = await db.collection('bookings')
        .where('customerId', '==', cleanTargetUid)
        .where('status', 'in', ['confirmed', 'rented'])
        .limit(1)
        .get();
      if (!liveSnap.empty) {
        throw new HttpsError(
          'failed-precondition',
          'لا يمكن حذف هذا الحساب لوجود حجز مؤكد أو سيارة مؤجرة قيد الاستخدام. أنهِ الحجوزات النشطة أو ألغها أولاً.'
        );
      }
    } catch (liveErr) {
      if (liveErr instanceof HttpsError) throw liveErr;
      console.error('[deleteUserAccount] Active bookings check failed:', liveErr);
      throw new HttpsError('internal', 'تعذر التحقق من الحجوزات النشطة للمستخدم. تم إيقاف عملية الحذف.');
    }

    // STEP 1: Disable Auth user first & revoke refresh tokens
    try {
      await getAuth().updateUser(cleanTargetUid, { disabled: true });
      await getAuth().revokeRefreshTokens(cleanTargetUid);
    } catch (disableErr: any) {
      if (disableErr.code !== 'auth/user-not-found') {
        console.warn('[deleteUserAccount] Warning: failed to disable user record first:', disableErr);
      }
    }

    // STEP 2: Cancel pending bookings (new / reviewing)
    try {
      const pendingSnap = await db.collection('bookings')
        .where('customerId', '==', cleanTargetUid)
        .where('status', 'in', ['new', 'reviewing'])
        .get();

      for (const doc of pendingSnap.docs) {
        await doc.ref.update({
          status: 'cancelled',
          statusReason: 'تم إلغاء الحجز تلقائياً بسبب حذف حساب المستخدم من النظام',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (pendingErr) {
      console.warn('[deleteUserAccount] Failed to cancel pending bookings:', pendingErr);
    }

    // STEP 3: Purge user files from Storage (including verification vaults) and delete verificationRequests
    try {
      const bucket = getStorage().bucket();
      await bucket.deleteFiles({ prefix: `verification_vault/${cleanTargetUid}/`, force: true }).catch(() => {});
      await bucket.deleteFiles({ prefix: `verification_pending/${cleanTargetUid}/`, force: true }).catch(() => {});
      await bucket.deleteFiles({ prefix: `users/${cleanTargetUid}/`, force: true }).catch(() => {});
      await bucket.deleteFiles({ prefix: `uploads/${cleanTargetUid}/`, force: true }).catch(() => {});
      await db.collection('verificationRequests').doc(cleanTargetUid).delete().catch(() => {});
    } catch (storageErr) {
      console.error('[deleteUserAccount] Storage/verification purge failed:', storageErr);
    }

    // Delete Firestore user-related files and rate limits
    try {
      const deleteInChunks = async (refs: DocumentReference[]) => {
        for (let i = 0; i < refs.length; i += 400) {
          const batch = db.batch();
          refs.slice(i, i + 400).forEach((r) => batch.delete(r));
          await batch.commit();
        }
      };

      const filesSnap = await db.collection('files').where('userId', '==', cleanTargetUid).get();
      await deleteInChunks(filesSnap.docs.map((d) => d.ref));

      const userFilesSnap = await db.collection('users').doc(cleanTargetUid).collection('files').get();
      await deleteInChunks(userFilesSnap.docs.map((d) => d.ref));
    } catch (dbErr) {
      console.warn('[deleteUserAccount] Firestore files cleanup note:', dbErr);
    }

    // STEP 4: Anonymize customer identity in contracts and bookings
    try {
      const contractsSnap = await db.collection('contracts')
        .where('customerId', '==', cleanTargetUid)
        .get();
      for (const cDoc of contractsSnap.docs) {
        await cDoc.ref.update({
          customerName: 'عميل ملغى',
          customerPhone: '',
          customerAddress: '',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      const bookingsSnap = await db.collection('bookings')
        .where('customerId', '==', cleanTargetUid)
        .get();

      const batchSize = 400;
      for (let i = 0; i < bookingsSnap.docs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = bookingsSnap.docs.slice(i, i + batchSize);
        chunk.forEach(bDoc => {
          batch.update(bDoc.ref, {
            customerName: 'عميل محذوف (حساب ملغى)',
            customerEmail: 'deleted-user@shakercars.com',
            customerPhone: '',
            customerWhatsApp: '',
            customerAddress: '',
            isAnonymized: true,
            anonymizedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }
    } catch (anonErr) {
      console.error('[deleteUserAccount] Failed to anonymize bookings/contracts:', anonErr);
    }

    // STEP 5: Delete Firestore documents (users, customers)
    try {
      await db.collection('users').doc(cleanTargetUid).delete();
      await db.collection('customers').doc(cleanTargetUid).delete();
    } catch (dbErr) {
      console.error('[deleteUserAccount] Firestore user document deletion failed:', dbErr);
    }

    // STEP 6: Delete user from Firebase Authentication last
    try {
      await getAuth().deleteUser(cleanTargetUid);
    } catch (authErr: any) {
      console.error('[deleteUserAccount] Auth user deletion failed:', authErr);
      if (authErr.code !== 'auth/user-not-found') {
        throw new HttpsError('internal', 'حدث خطأ أثناء حذف المستخدم من نظام المصادقة.');
      }
    }

    // STEP 7: Audit log record
    await writeAuditAsync(db, {
      actorUid: callerUid,
      actorEmail: callerToken.email || null,
      actorRole: String(callerToken.role || 'super_admin'),
      actorType: 'staff',
      action: 'USER_ACCOUNT_DELETED',
      entity: 'user',
      entityId: cleanTargetUid,
      entityName: cleanTargetUid,
      details: 'حذف الحساب نهائياً، تعطيله أولاً، مسح وثائق التوثيق والملفات، وإخفاء هوية العميل في الحجوزات والعقود.',
    }).catch((auditErr) => {
      console.warn('[deleteUserAccount] Audit write failed:', auditErr);
    });

    return {
      success: true,
      targetUid: cleanTargetUid,
      message: 'تم حذف حساب المستخدم نهائياً، مسح ملفاته الخاصة، وإخفاء هويته في سجلات الحجوزات والعقود بنجاح.',
    };
  }
);

/**
 * Cloud Function: syncMyRole (region: asia-south1)
 * Reads Custom Claims directly from getUser(uid) in Firebase Authentication
 * and normalizes legacy boolean claims into unified role claim.
 */
export const syncMyRole = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'user',
    unauthenticatedMessage: 'تسجيل الدخول مطلوب لمزامنة الصلاحيات.',
  },
  async (request) => {
    const uid = request.auth!.uid;

    try {
      const userRecord = await getAuth().getUser(uid);
      const claims = userRecord.customClaims || {};
      const normalizedRole = getUserRoleFromClaims(claims);

      const targetClaims = {
        ...claims,
        role: normalizedRole,
        admin: normalizedRole === 'admin' || normalizedRole === 'super_admin',
        employee: normalizedRole === 'employee',
        super_admin: normalizedRole === 'super_admin',
      };

      if (
        claims.role !== normalizedRole ||
        claims.admin !== targetClaims.admin ||
        claims.employee !== targetClaims.employee ||
        claims.super_admin !== targetClaims.super_admin
      ) {
        await getAuth().setCustomUserClaims(uid, targetClaims);
      }

      return {
        success: true,
        role: normalizedRole,
        alreadyMinted: Boolean(claims.role),
      };
    } catch (err: any) {
      console.error('[syncMyRole] Error reading or minting claims:', err);
      throw new HttpsError('internal', 'حدث خطأ أثناء قراءة صلاحيات الحساب.');
    }
  }
);

export interface SetAdminMfaDeps {
  db?: any;
  getUser?: (uid: string) => Promise<UserRecord>;
  assertNotRevokedFn?: (req: any) => Promise<UserRecord>;
  writeAuditFn?: typeof writeAuditAsync;
}

export async function executeSetAdminMfaRequirement(
  request: any,
  deps?: SetAdminMfaDeps
) {
  const effectiveAssertNotRevoked = deps?.assertNotRevokedFn || assertNotRevoked;
  await effectiveAssertNotRevoked(request);

  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب.');
  }

  const callerUid = request.auth.uid;
  const callerToken = request.auth.token || {};
  const firestoreDb = deps?.db || db;

  if (!isCallerSuperAdmin(callerToken)) {
    throw new HttpsError(
      'permission-denied',
      'تعديل إعداد فرض المصادقة الثنائية مقتصر حصراً على المدير العام (Super Admin).'
    );
  }

  if (request.data?.action === 'get') {
    const currentVal = await getRequireAdminMfa(firestoreDb);
    return {
      success: true,
      requireAdminMfa: currentVal,
    };
  }

  const secondFactor = callerToken?.firebase?.sign_in_second_factor;
  if (!secondFactor || typeof secondFactor !== 'string' || !secondFactor.trim()) {
    throw new HttpsError(
      'permission-denied',
      'يجب تسجيل الدخول باستخدام المصادقة الثنائية (2FA) لتعديل إعداد فرض المصادقة الثنائية.'
    );
  }

  const rawValue =
    typeof request.data?.requireAdminMfa === 'boolean'
      ? request.data.requireAdminMfa
      : typeof request.data?.enabled === 'boolean'
      ? request.data.enabled
      : undefined;

  if (typeof rawValue !== 'boolean') {
    throw new HttpsError(
      'invalid-argument',
      'قيمة requireAdminMfa مطلوبة ويجب أن تكون منطقية (boolean).'
    );
  }

  if (rawValue === true) {
    const getUserFn = deps?.getUser || ((uid: string) => getAuth().getUser(uid));
    const callerRecord = await getUserFn(callerUid);
    const enrolledFactors = callerRecord?.multiFactor?.enrolledFactors;
    if (!Array.isArray(enrolledFactors) || enrolledFactors.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'لا يمكن فرض المصادقة الثنائية قبل تفعيل عامل مصادقة ثانٍ (Google Authenticator) على حسابك أولاً.'
      );
    }
  }

  await firestoreDb.collection('system_config').doc('security').set(
    {
      requireAdminMfa: rawValue,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    },
    { merge: true }
  );

  setAdminMfaCacheValue(rawValue);

  const auditWriter = deps?.writeAuditFn || writeAuditAsync;
  await auditWriter(firestoreDb, {
    actorUid: callerUid,
    actorEmail: callerToken.email || null,
    actorRole: 'super_admin',
    actorType: 'staff',
    action: rawValue ? 'ADMIN_MFA_REQUIREMENT_ENABLED' : 'ADMIN_MFA_REQUIREMENT_DISABLED',
    entity: 'system_config',
    entityId: 'security',
    entityName: 'security',
    details: rawValue
      ? 'تفعيل فرض المصادقة الثنائية (TOTP) على حسابات المدراء والمدير العام'
      : 'إيقاف فرض المصادقة الثنائية (TOTP) على حسابات المدراء والمدير العام',
    metadata: {
      requireAdminMfa: rawValue,
      secondFactor,
    },
  });

  return {
    success: true,
    requireAdminMfa: rawValue,
    message: rawValue
      ? 'تم تفعيل فرض المصادقة الثنائية على حسابات المدراء بنجاح.'
      : 'تم إيقاف فرض المصادقة الثنائية على حسابات المدراء.',
  };
}

/**
 * Cloud Function: setAdminMfaRequirement (region: asia-south1)
 * Super Admin only; requires 2FA in token and enrolled second factor when enabling.
 */
export const setAdminMfaRequirement = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'super_admin',
    permissionDeniedMessage:
      'تعديل إعداد فرض المصادقة الثنائية مقتصر حصراً على المدير العام (Super Admin).',
  },
  async (request) => {
    return executeSetAdminMfaRequirement(request, {
      assertNotRevokedFn: async () => request.callerRecord!,
    });
  }
);

