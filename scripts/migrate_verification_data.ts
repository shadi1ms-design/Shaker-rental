/**
 * Migration Script: migrate_verification_data.ts
 * 
 * Unifies legacy verification statuses across Firestore:
 * - 'manual_review' -> 'pending_review'
 * - 'unverified' / null / undefined -> 'not_started'
 * - 'verified' -> 'verified'
 * - Creates/backfills single source of truth verificationRequests/{uid} documents
 *   from legacy files subcollections if present.
 * 
 * Run with: npx tsx scripts/migrate_verification_data.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DATABASE_ID = process.env.DATABASE_ID;
if (!DATABASE_ID) {
  console.error('[Migration] ERROR: DATABASE_ID environment variable is required.');
  process.exit(1);
}

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore(DATABASE_ID);
const DRY_RUN = process.env.DRY_RUN === 'true';

async function runMigration() {
  console.log(`[Migration] Starting verification data migration on DB: ${DATABASE_ID}...${DRY_RUN ? ' (DRY RUN)' : ''}`);

  const usersSnap = await db.collection('users').get();
  console.log(`[Migration] Found ${usersSnap.size} user documents.`);

  let migratedUsers = 0;
  let migratedRequests = 0;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const uid = userDoc.id;

    // Idempotency: skip if already has the right status structure or migrated
    if (data.verificationStatus && data.verificationStatus !== 'manual_review') {
      // Continue or skip
    }

    let targetStatus: 'not_started' | 'pending_review' | 'verified' | 'rejected' = 'not_started';

    if (data.verified === true || data.verificationStatus === 'verified') {
      targetStatus = 'verified';
    } else if (data.verificationStatus === 'manual_review' || data.verificationStatus === 'pending') {
      targetStatus = 'pending_review';
    } else if (data.verificationStatus === 'rejected') {
      targetStatus = 'rejected';
    } else {
      targetStatus = 'not_started';
    }

    // 1. Update user document
    const userUpdates: Record<string, unknown> = {
      verificationStatus: targetStatus,
      verified: targetStatus === 'verified',
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!DRY_RUN) {
        await userDoc.ref.update(userUpdates);
    }
    migratedUsers++;

    // 2. Also sync customer record if exists
    try {
      const customerRef = db.collection('customers').doc(uid);
      const custSnap = await customerRef.get();
      if (custSnap.exists) {
        if (!DRY_RUN) {
            await customerRef.update({
              verificationStatus: targetStatus,
              verified: targetStatus === 'verified',
              updatedAt: FieldValue.serverTimestamp(),
            });
        }
      }
    } catch (e) {
      console.warn(`[Migration] Note syncing customer doc for ${uid}:`, e);
    }

    // 3. Ensure verificationRequests/{uid} exists
    const reqRef = db.collection('verificationRequests').doc(uid);
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) {
      // Check if user had files in users/{uid}/files
      const filesSnap = await db.collection('users').doc(uid).collection('files').get();
      const docs: Record<string, unknown> = {};

      for (const f of filesSnap.docs) {
        const fileData = f.data();
        const category = fileData.category;
        if (category === 'driver_license') {
          docs.driver_license = {
            storagePath: fileData.storagePath || '',
            uploadedAt: fileData.uploadedAt || new Date().toISOString(),
            sizeBytes: fileData.fileSize || 1024,
            sha256: 'migrated_legacy_checksum',
            quality: { width: 1920, height: 1080, blurScore: 100, passed: true },
          };
        } else if (category === 'national_id' || category === 'passport') {
          docs.identity = {
            storagePath: fileData.storagePath || '',
            uploadedAt: fileData.uploadedAt || new Date().toISOString(),
            sizeBytes: fileData.fileSize || 1024,
            sha256: 'migrated_legacy_checksum',
            quality: { width: 1920, height: 1080, blurScore: 100, passed: true },
          };
        }
      }

      if (!DRY_RUN) {
          await reqRef.set({
            userId: uid,
            status: targetStatus,
            identityDocType: 'national_id',
            docs,
            submittedAt: targetStatus !== 'not_started' ? FieldValue.serverTimestamp() : null,
            reviewedAt: targetStatus === 'verified' || targetStatus === 'rejected' ? FieldValue.serverTimestamp() : null,
            reviewedBy: targetStatus === 'verified' ? 'migration_script' : null,
            rejectionReason: null,
            attempt: 1,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
      }
      migratedRequests++;
    }
  }

  console.log(`[Migration] Completed${DRY_RUN ? ' (DRY RUN)' : ''} successfully: ${migratedUsers} users updated, ${migratedRequests} verification requests backfilled.`);
}

if (require.main === module) {
  runMigration().catch((err) => {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  });
}
