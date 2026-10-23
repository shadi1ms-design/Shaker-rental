import { onCall, HttpsError } from 'firebase-functions/v2/https';
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
} from './authz';

const db = getFirestore(getApp(), DATABASE_ID);

/**
 * Cloud Function: setUserRole (region: asia-south1)
 * Enforces strict role hierarchy and claims merging.
 */
export const setUserRole = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    await assertNotRevoked(request);

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

    // 5. Immutable audit log record
    try {
      await db.collection('auditLogs').add({
        action: 'ROLE_MODIFIED',
        actorUid: callerUid,
        actorEmail: callerToken.email || null,
        actorType: 'staff',
        performedBy: callerUid,
        targetUser: cleanTargetUid,
        oldRole: getUserRoleFromClaims(targetExistingClaims),
        newRole: normalizedRole,
        timestamp: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        details: `تعديل صلاحيات المستخدم ${cleanTargetUid} إلى ${normalizedRole} مع إبطال الجلسات السابقة`,
      });
    } catch (auditErr) {
      console.warn('[setUserRole] Audit write failed:', auditErr);
    }

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
export const toggleUserAccountStatus = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    await assertNotRevoked(request);

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
    try {
      await db.collection('auditLogs').add({
        action: isDisabled ? 'USER_ACCOUNT_DISABLED' : 'USER_ACCOUNT_ENABLED',
        actorUid: callerUid,
        actorEmail: callerToken.email || null,
        actorType: 'staff',
        performedBy: callerUid,
        targetUser: cleanTargetUid,
        timestamp: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('[toggleUserAccountStatus] Audit write failed:', auditErr);
    }

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
export const deleteUserAccount = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    await assertNotRevoked(request);

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

    // 2.5. Prevent deleting the last Super Admin
    const targetRole = getUserRoleFromClaims(targetUserRecord.customClaims);
    if (targetRole === 'super_admin') {
      const superAdminsSnap = await db.collection('users')
        .where('role', '==', 'super_admin')
        .limit(2)
        .get();
      
      if (superAdminsSnap.size <= 1) {
        throw new HttpsError('failed-precondition', 'لا يمكن حذف آخر مدير عام (Super Admin) في النظام.');
      }
    }

    // 2.6. Never delete an account that still holds a live reservation or a rented vehicle:
    //      the booking would be anonymised while the car is still out, and staff could not trace the renter.
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

    // 3. Purge user files from Storage
    try {
      const bucket = getStorage().bucket();
      await bucket.deleteFiles({ prefix: `users/${cleanTargetUid}/`, force: true });
      await bucket.deleteFiles({ prefix: `uploads/${cleanTargetUid}/`, force: true });
    } catch (storageErr) {
      console.error('[deleteUserAccount] Storage purge failed:', storageErr);
      throw new HttpsError(
        'internal',
        'فشل تنظيف ملفات المستخدم في مساحة التخزين السحابية (Storage). تم إيقاف عملية الحذف لمنع وجود بيانات يتيمة.'
      );
    }

    // Delete Firestore user-related files and rate limits
    try {
      // 1. Delete top-level files docs
      // (Firestore batches are capped at 500 operations, so delete in chunks.)
      const deleteInChunks = async (refs: DocumentReference[]) => {
        for (let i = 0; i < refs.length; i += 400) {
          const batch = db.batch();
          refs.slice(i, i + 400).forEach((r) => batch.delete(r));
          await batch.commit();
        }
      };

      const filesSnap = await db.collection('files').where('userId', '==', cleanTargetUid).get();
      await deleteInChunks(filesSnap.docs.map((d) => d.ref));

      // 2. Delete user-subcollection files
      const userFilesSnap = await db.collection('users').doc(cleanTargetUid).collection('files').get();
      await deleteInChunks(userFilesSnap.docs.map((d) => d.ref));
    } catch (dbErr) {
      console.error('[deleteUserAccount] Firestore files cleanup failed:', dbErr);
      throw new HttpsError(
        'internal',
        'فشل تنظيف سجلات الوثائق التابعة للمستخدم في قاعدة البيانات. تم إيقاف عملية الحذف.'
      );
    }

    // 4. Anonymize customer identity in bookings (Batched 400)
    try {
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
            customerNationalId: '',
            customerLicenseNumber: '',
            customerAddress: '',
            isAnonymized: true,
            anonymizedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }
    } catch (bkErr) {
      console.error('[deleteUserAccount] Failed to anonymize bookings:', bkErr);
      throw new HttpsError(
        'internal',
        'فشل إخفاء هوية المستخدم في سجلات الحجوزات. تم إيقاف عملية الحذف.'
      );
    }

    // 5. Delete Firestore documents (users, customers)
    try {
      await db.collection('users').doc(cleanTargetUid).delete();
      await db.collection('customers').doc(cleanTargetUid).delete();
    } catch (dbErr) {
      console.error('[deleteUserAccount] Firestore user document deletion failed:', dbErr);
      throw new HttpsError(
        'internal',
        'فشل حذف سجل المستخدم الرئيسي من قاعدة البيانات. تم إيقاف عملية الحذف.'
      );
    }

    // 6. Delete user from Firebase Authentication
    try {
      await getAuth().revokeRefreshTokens(cleanTargetUid);
      await getAuth().deleteUser(cleanTargetUid);
    } catch (authErr: any) {
      console.error('[deleteUserAccount] Auth user deletion failed:', authErr);
      if (authErr.code !== 'auth/user-not-found') {
        throw new HttpsError('internal', 'حدث خطأ أثناء حذف المستخدم من نظام المصادقة.');
      }
    }

    // 7. Audit log
    try {
      await db.collection('auditLogs').add({
        action: 'USER_ACCOUNT_DELETED',
        actorUid: callerUid,
        actorEmail: callerToken.email || null,
        actorType: 'staff',
        performedBy: callerUid,
        targetUser: cleanTargetUid,
        details: 'حذف الحساب نهائياً، مسح ملفات التخزين، وإخفاء هوية العميل في الحجوزات السابقة بنجاح.',
        timestamp: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (auditErr) {
      console.warn('[deleteUserAccount] Audit write failed:', auditErr);
    }

    return {
      success: true,
      targetUid: cleanTargetUid,
      message: 'تم حذف حساب المستخدم نهائياً، مسح ملفاته الخاصة، وإخفاء هويته في سجلات الحجوزات بنجاح.',
    };
  }
);

/**
 * Cloud Function: syncMyRole (region: asia-south1)
 * Reads Custom Claims directly from getUser(uid) in Firebase Authentication.
 */
export const syncMyRole = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لمزامنة الصلاحيات.');
    }

    const uid = request.auth.uid;

    try {
      const userRecord = await getAuth().getUser(uid);
      const claims = userRecord.customClaims || {};

      if (claims.role || claims.admin || claims.employee || claims.super_admin) {
        const role = getUserRoleFromClaims(claims);
        return {
          success: true,
          role,
          alreadyMinted: true,
        };
      }

      // Default role for newly registered accounts is strictly 'customer'
      const defaultClaims = {
        ...claims,
        role: 'customer',
        admin: false,
        employee: false,
        super_admin: false,
      };

      await getAuth().setCustomUserClaims(uid, defaultClaims);

      return {
        success: true,
        role: 'customer',
        alreadyMinted: false,
      };
    } catch (err: any) {
      console.error('[syncMyRole] Error reading or minting claims:', err);
      throw new HttpsError('internal', 'حدث خطأ أثناء قراءة صلاحيات الحساب.');
    }
  }
);
