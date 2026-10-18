import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import {
  canManageUserRole,
  canManageAccountLifecycle,
  getUserRoleFromClaims,
} from './authz';

const db = getFirestore(admin.app(), DATABASE_ID);

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
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لإجراء هذا الطلب.');
    }

    const { targetUid, newRole } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
      throw new HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }

    const cleanTargetUid = targetUid.trim();
    const callerUid = request.auth.uid;
    const callerToken = request.auth.token;

    // 1. Verify target user exists in Firebase Authentication
    let targetUserRecord: admin.auth.UserRecord;
    try {
      targetUserRecord = await admin.auth().getUser(cleanTargetUid);
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
    };

    try {
      await admin.auth().setCustomUserClaims(cleanTargetUid, mergedClaims);
      // Revoke refresh tokens to force client re-authentication and immediate claim adoption
      await admin.auth().revokeRefreshTokens(cleanTargetUid);
    } catch (authErr: any) {
      console.error('[setUserRole] Failed setting custom claims:', authErr);
      throw new HttpsError('internal', 'فشل تعيين مطالبات التوثيق للمستخدم في خادم المصادقة.');
    }

    // 4. Synchronize display role metadata in Firestore users/{targetUid}
    try {
      await db.collection('users').doc(cleanTargetUid).set(
        {
          role: normalizedRole,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لإجراء هذا الطلب.');
    }

    const { targetUid, disabled } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
      throw new HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }

    const cleanTargetUid = targetUid.trim();
    const callerUid = request.auth.uid;
    const callerToken = request.auth.token;

    // 1. Verify target user exists
    let targetUserRecord: admin.auth.UserRecord;
    try {
      targetUserRecord = await admin.auth().getUser(cleanTargetUid);
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
      await admin.auth().updateUser(cleanTargetUid, { disabled: isDisabled });
      await admin.auth().revokeRefreshTokens(cleanTargetUid);
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
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لإجراء هذا الطلب.');
    }

    const { targetUid } = request.data || {};
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
      throw new HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }

    const cleanTargetUid = targetUid.trim();
    const callerUid = request.auth.uid;
    const callerToken = request.auth.token;

    // 1. Verify target user exists
    let targetUserRecord: admin.auth.UserRecord;
    try {
      targetUserRecord = await admin.auth().getUser(cleanTargetUid);
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

    // 3. Purge user files from Storage
    try {
      const bucket = admin.storage().bucket();
      await bucket.deleteFiles({ prefix: `users/${cleanTargetUid}/`, force: true }).catch(() => {});
      await bucket.deleteFiles({ prefix: `uploads/${cleanTargetUid}/`, force: true }).catch(() => {});
    } catch (storageErr) {
      console.warn('[deleteUserAccount] Storage purge warning:', storageErr);
    }

    // 4. Anonymize customer identity in bookings instead of deleting bookings (Financial & Legal audit history preservation)
    try {
      const bookingsSnap = await db.collection('bookings')
        .where('customerId', '==', cleanTargetUid)
        .get();

      const batch = db.batch();
      for (const bDoc of bookingsSnap.docs) {
        batch.update(bDoc.ref, {
          customerName: 'عميل محذوف (حساب ملغى)',
          customerEmail: 'deleted-user@shakercars.com',
          customerPhone: '',
          customerWhatsApp: '',
          customerNationalId: '',
          customerLicenseNumber: '',
          customerAddress: '',
          isAnonymized: true,
          anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (bkErr) {
      console.warn('[deleteUserAccount] Failed to anonymize bookings:', bkErr);
    }

    // 5. Delete Firestore documents (users, customers)
    try {
      await db.collection('users').doc(cleanTargetUid).delete();
      await db.collection('customers').doc(cleanTargetUid).delete();
    } catch (dbErr) {
      console.warn('[deleteUserAccount] Firestore deletion warning:', dbErr);
    }

    // 6. Delete user from Firebase Authentication
    try {
      await admin.auth().revokeRefreshTokens(cleanTargetUid);
      await admin.auth().deleteUser(cleanTargetUid);
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
        details: `حذف الحساب نهائياً، مسح ملفات التخزين، وإخفاء هوية العميل في الحجوزات السابقة بنجاح`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
      const userRecord = await admin.auth().getUser(uid);
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

      await admin.auth().setCustomUserClaims(uid, defaultClaims);

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
