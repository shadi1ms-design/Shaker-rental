/**
 * Script: strip-public-vehicle-internals.ts
 * 
 * Inspects all documents in the 'vehicles' collection.
 * Identifies and strips sensitive internal fields ('currentMileage', 'plateNumber')
 * from the public collection, ensuring they are safely preserved in
 * 'vehicles/{id}/internal/details' before deleting them from the root document.
 * 
 * Safety:
 * - Default: DRY RUN (no writes or deletions)
 * - To execute: pass `--execute`
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DATABASE_ID =
  process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
  'ai-studio-shakercarrental-8ca1f5c8-9251-4c7d-b28c-5a1ee6a1a1e1';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore(DATABASE_ID);

export interface StripResult {
  totalScanned: number;
  flaggedCount: number;
  remediatedCount: number;
  details: Array<{
    vehicleId: string;
    hasPlateNumber: boolean;
    hasCurrentMileage: boolean;
    plateNumber?: string;
    currentMileage?: number;
  }>;
}

export async function runStripPublicInternals(execute = false): Promise<StripResult> {
  console.log(`[strip-public-vehicle-internals] Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`[strip-public-vehicle-internals] Database: ${DATABASE_ID}`);

  const snap = await db.collection('vehicles').get();
  const result: StripResult = {
    totalScanned: snap.size,
    flaggedCount: 0,
    remediatedCount: 0,
    details: [],
  };

  for (const doc of snap.docs) {
    const data = doc.data();
    const hasPlate = data.plateNumber !== undefined && data.plateNumber !== null;
    const hasMileage = data.currentMileage !== undefined && data.currentMileage !== null;

    if (hasPlate || hasMileage) {
      result.flaggedCount++;
      result.details.push({
        vehicleId: doc.id,
        hasPlateNumber: hasPlate,
        hasCurrentMileage: hasMileage,
        plateNumber: hasPlate ? String(data.plateNumber) : undefined,
        currentMileage: hasMileage ? Number(data.currentMileage) : undefined,
      });

      console.log(
        `[FLAGGED] Vehicle ${doc.id}: ${hasPlate ? `plateNumber="${data.plateNumber}" ` : ''}${
          hasMileage ? `currentMileage=${data.currentMileage}` : ''
        }`
      );

      if (execute) {
        const internalRef = doc.ref.collection('internal').doc('details');
        const internalSnap = await internalRef.get();
        const internalUpdates: Record<string, unknown> = {
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (hasPlate && (!internalSnap.exists || !internalSnap.data()?.plateNumber)) {
          internalUpdates.plateNumber = data.plateNumber;
        }
        if (hasMileage && (!internalSnap.exists || internalSnap.data()?.currentMileage === undefined)) {
          internalUpdates.currentMileage = Number(data.currentMileage);
        }

        if (Object.keys(internalUpdates).length > 1) {
          await internalRef.set(internalUpdates, { merge: true });
        }

        await doc.ref.update({
          plateNumber: FieldValue.delete(),
          currentMileage: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        result.remediatedCount++;
        console.log(`[REMEDIATED] Vehicle ${doc.id}: stripped sensitive fields from public doc.`);
      }
    }
  }

  console.log(
    `[strip-public-vehicle-internals] Summary: Scanned ${result.totalScanned}, Flagged: ${result.flaggedCount}, Remediated: ${result.remediatedCount}`
  );
  return result;
}

// Direct execution from CLI
const isDirectRun =
  process.argv[1]?.endsWith('strip-public-vehicle-internals.ts') ||
  process.argv[1]?.endsWith('strip-public-vehicle-internals.js');

if (isDirectRun) {
  const isExecute = process.argv.includes('--execute');
  runStripPublicInternals(isExecute)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[strip-public-vehicle-internals] Error:', err);
      process.exit(1);
    });
}
