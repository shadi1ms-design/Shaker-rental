/**
 * Cleanup Script: cleanup_staff_verification_fields.ts
 *
 * Removes legacy identity verification fields from staff accounts
 * (employee, admin, super_admin) in `users` and `customers` collections, and
 * archives any lingering `verificationRequests/{uid}` documents into
 * `verificationRequestsArchive/{uid}_{timestamp}` WITHOUT deleting any Storage files.
 *
 * SAFE BY DEFAULT (DRY-RUN):
 *   DATABASE_ID=... npx tsx scripts/cleanup_staff_verification_fields.ts
 *
 * APPLY CHANGES EXPLICITLY:
 *   DATABASE_ID=... npx tsx scripts/cleanup_staff_verification_fields.ts --apply
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getUserRoleFromClaims, isStaffRole } from '../functions/src/roles';

export const STAFF_VERIFICATION_FIELDS = [
  'verified',
  'verificationStatus',
  'identityVerified',
  'verifiedAt',
  'verifiedBy',
  'verificationNotes',
  'verificationSubmittedAt',
] as const;

export function shouldApplyChanges(argv: string[] = process.argv): boolean {
  return argv.includes('--apply');
}

export function hasAnyVerificationField(data?: Record<string, unknown> | null): boolean {
  if (!data || typeof data !== 'object') return false;
  return STAFF_VERIFICATION_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(data, field)
  );
}

async function resolveIsStaffUid(
  uid: string,
  userData: Record<string, unknown>
): Promise<{ isStaff: boolean; resolvedRole: string }> {
  if (isStaffRole(userData.role)) {
    return { isStaff: true, resolvedRole: String(userData.role) };
  }

  try {
    const authUser = await getAuth().getUser(uid);
    const claimsRole = getUserRoleFromClaims(authUser.customClaims || {});
    if (isStaffRole(claimsRole)) {
      return { isStaff: true, resolvedRole: claimsRole };
    }
  } catch (err: any) {
    if (err?.code !== 'auth/user-not-found') {
      console.warn(`[StaffCleanup] Note checking Auth claims for ${uid}:`, err?.message || err);
    }
  }

  return { isStaff: false, resolvedRole: 'customer' };
}

export async function runStaffVerificationCleanup(options?: {
  apply?: boolean;
  databaseId?: string;
}) {
  const apply = options?.apply ?? shouldApplyChanges(process.argv);
  const databaseId = options?.databaseId || process.env.DATABASE_ID;

  if (!databaseId) {
    console.error('[StaffCleanup] ERROR: DATABASE_ID environment variable is required.');
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp();
  }

  const db = getFirestore(databaseId);
  const modeLabel = apply ? 'APPLY (WRITING TO FIRESTORE)' : 'DRY-RUN (NO WRITES)';
  console.log(`[StaffCleanup] Starting cleanup on DB: ${databaseId} | Mode: ${modeLabel}`);

  const usersSnap = await db.collection('users').get();
  console.log(`[StaffCleanup] Scanning ${usersSnap.size} user documents...`);

  let staffScanned = 0;
  let usersCleaned = 0;
  let customersCleaned = 0;
  let requestsArchived = 0;

  const deletePayload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  for (const field of STAFF_VERIFICATION_FIELDS) {
    deletePayload[field] = FieldValue.delete();
  }

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const userData = userDoc.data() as Record<string, unknown>;
    const { isStaff, resolvedRole } = await resolveIsStaffUid(uid, userData);

    if (!isStaff) {
      continue;
    }
    staffScanned++;

    // 1. Clean users/{uid}
    if (hasAnyVerificationField(userData)) {
      console.log(
        `[StaffCleanup] ${apply ? 'Cleaning' : '[DRY-RUN] Would clean'} verification fields from users/${uid} (role=${resolvedRole})`
      );
      if (apply) {
        await userDoc.ref.update(deletePayload);
      }
      usersCleaned++;
    }

    // 2. Clean customers/{uid} if present
    const custRef = db.collection('customers').doc(uid);
    const custSnap = await custRef.get();
    if (custSnap.exists) {
      const custData = custSnap.data() as Record<string, unknown>;
      if (hasAnyVerificationField(custData)) {
        console.log(
          `[StaffCleanup] ${apply ? 'Cleaning' : '[DRY-RUN] Would clean'} verification fields from customers/${uid} (role=${resolvedRole})`
        );
        if (apply) {
          await custRef.update(deletePayload);
        }
        customersCleaned++;
      }
    }

    // 3. Archive verificationRequests/{uid} without deleting any Storage files
    const reqRef = db.collection('verificationRequests').doc(uid);
    const reqSnap = await reqRef.get();
    if (reqSnap.exists) {
      const archiveId = `${uid}_${Date.now()}`;
      console.log(
        `[StaffCleanup] ${apply ? 'Archiving' : '[DRY-RUN] Would archive'} verificationRequests/${uid} -> verificationRequestsArchive/${archiveId} (Storage untouched)`
      );
      if (apply) {
        const archiveRef = db.collection('verificationRequestsArchive').doc(archiveId);
        await db.runTransaction(async (tx) => {
          const freshSnap = await tx.get(reqRef);
          if (!freshSnap.exists) return;
          tx.set(archiveRef, {
            ...(freshSnap.data() || {}),
            originalUserId: uid,
            archived: true,
            archivedReason: 'staff_verification_cleanup_script',
            archivedBy: 'cleanup_script',
            archivedAt: new Date().toISOString(),
            staffRole: resolvedRole,
          });
          tx.delete(reqRef);
        });
      }
      requestsArchived++;
    }
  }

  console.log(
    `[StaffCleanup] Finished (${modeLabel}): staffScanned=${staffScanned}, usersCleaned=${usersCleaned}, customersCleaned=${customersCleaned}, requestsArchived=${requestsArchived}`
  );
}

if (require.main === module) {
  runStaffVerificationCleanup().catch((err) => {
    console.error('[StaffCleanup] Failed:', err);
    process.exit(1);
  });
}
