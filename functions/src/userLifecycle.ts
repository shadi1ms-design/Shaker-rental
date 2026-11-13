import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { writeAuditAsync } from './audit';

const db = getFirestore(getApp(), DATABASE_ID);

/**
 * Blocking Function: beforeUserCreated (Identity Platform GCIP v2)
 * Single authoritative pathway for user provisioning and custom claims assignment (Requirement 6).
 */
export const beforeUserCreatedHandler = beforeUserCreated(
  { region: FUNCTION_REGION },
  async (event) => {
    const user = event.data;
    if (!user) return;

    const email = (user.email || '').toLowerCase().trim();
    const displayName = user.displayName || email.split('@')[0] || 'مستخدم';
    const phone = user.phoneNumber || '';

    try {
      const userRef = db.collection('users').doc(user.uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        try {
          await userRef.set({
            uid: user.uid,
            email,
            name: displayName,
            displayName,
            phone,
            role: 'customer',
            active: true,
            uploadedFilesCount: 0,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          // Audit Log for user registration via unified writeAuditAsync
          await writeAuditAsync(db, {
            action: 'USER_REGISTERED',
            actorUid: user.uid,
            actorEmail: email,
            actorRole: 'customer',
            actorType: 'customer',
            entity: 'user',
            entityId: user.uid,
            entityName: displayName,
            targetUserId: user.uid,
            details: `تسجيل مستخدم جديد في النظام: ${displayName} (${email})`,
          });
        } catch (dbWriteErr) {
          console.error('[beforeUserCreatedHandler] DB write failure, continuing registration:', dbWriteErr);
        }
      }
    } catch (dbErr) {
      console.error('[beforeUserCreatedHandler] Error fetching user doc:', dbErr);
    }

    // Default customer claims
    return {
      customClaims: {
        role: 'customer',
        admin: false,
        employee: false,
        super_admin: false,
      },
    };
  }
);
