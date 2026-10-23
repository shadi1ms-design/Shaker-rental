/**
 * CLOUD STORAGE TRIGGER: validateUploadedFileSignature
 * 
 * Inspects uploaded file magic bytes asynchronously upon object finalization.
 * 
 * SCOPE & COVERAGE:
 * - Public media paths: 'vehicles/' and 'public/' (JPEG, PNG, WEBP).
 * - Document & user upload paths: 'users/', 'uploads/', and 'contracts/' (PDF, JPEG, PNG, WEBP, <= 25MB).
 * - Video inspection paths: 'contracts/{contractId}/videos/' (MP4/ftyp, WebM/1A45DFA3, MOV, <= 100MB).
 * - Exports validation functions for direct unit testing (Requirement 4).
 */

import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { DATABASE_ID, DEFAULT_STORAGE_BUCKET, STORAGE_TRIGGER_REGION } from './constants';

if (!getApps().length) {
  initializeApp();
}
const db = getFirestore(getApp(), DATABASE_ID);

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB for docs/images
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;   // 100MB for inspection videos

/**
 * Validates whether the given buffer matches known image signatures (JPEG, PNG, WEBP)
 */
export function isValidImageSignature(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 12) {
    return false;
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }

  // 3. WEBP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  const isRiff =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46; // "RIFF"
  const isWebp =
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50; // "WEBP"

  if (isRiff && isWebp) {
    return true;
  }

  return false;
}

/**
 * Validates whether the given buffer matches standard PDF signature (%PDF -> 25 50 44 46)
 */
export function isValidPdfSignature(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) {
    return false;
  }
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

/**
 * Validates whether the given buffer matches video signatures:
 * - MP4 / QuickTime: bytes 4-7 are 'ftyp' (0x66 0x74 0x79 0x70)
 * - WebM / Matroska: bytes 0-3 are 0x1A 0x45 0xDF 0xA3
 */
export function isValidVideoSignature(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 8) {
    return false;
  }

  // 1. WebM / Matroska: 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return true;
  }

  // 2. MP4 / MOV / QuickTime: bytes 4-7 == 'ftyp' (0x66 0x74 0x79 0x70)
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return true;
  }

  return false;
}

// Storage trigger MUST match the exact region of the storage bucket ('us-east1' for shaker-rentalcars.firebasestorage.app)
export const validateUploadedFileSignature = onObjectFinalized(
  {
    cpu: 1,
    bucket: DEFAULT_STORAGE_BUCKET,
    region: STORAGE_TRIGGER_REGION, // us-east1 (bucket location)
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (event) => {
    const object = event.data;
    if (!object || !object.name) {
      return;
    }

    const filePath = object.name;
    const bucketName = object.bucket;
    const isTargetPublicPath = filePath.startsWith('vehicles/') || filePath.startsWith('public/');
    const isInspectionVideoPath = filePath.startsWith('contracts/') && filePath.includes('/videos/');
    const isVerificationPath = filePath.startsWith('verification_pending/') || filePath.startsWith('verification_vault/');
    const isDocumentPath =
      (filePath.startsWith('users/') ||
       filePath.startsWith('uploads/') ||
       filePath.startsWith('contracts/')) &&
      !isInspectionVideoPath;

    if (!isTargetPublicPath && !isDocumentPath && !isInspectionVideoPath && !isVerificationPath) {
      return;
    }

    try {
      const bucket = getStorage().bucket(bucketName);
      const file = bucket.file(filePath);

      const [exists] = await file.exists();
      if (!exists) return;

      const fileSize = Number(object.size || 0);

      // 1. Inspection Video Validation (<= 100MB, mp4/webm/quicktime)
      if (isInspectionVideoPath) {
        if (fileSize <= 0 || fileSize > MAX_VIDEO_SIZE_BYTES) {
          console.warn(`[Security Alert] Deleting inspection video exceeding 100MB: ${filePath} (${fileSize} bytes)`);
          await file.delete({ ignoreNotFound: true });
          await db.collection('auditLogs').add({
            action: 'SUSPICIOUS_VIDEO_SIZE_VIOLATION',
            actorUid: null,
            actorEmail: null,
            actorType: 'system',
            filePath,
            fileSizeBytes: fileSize,
            timestamp: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          });
          return;
        }

        const lowerPath = filePath.toLowerCase();
        const allowedVideoExts = ['.mp4', '.webm', '.mov', '.quicktime', '.mkv'];
        const hasValidExt = allowedVideoExts.some((ext) => lowerPath.endsWith(ext));
        if (!hasValidExt) {
          console.warn(`[Security Alert] Deleting inspection video with invalid extension: ${filePath}`);
          await file.delete({ ignoreNotFound: true });
          return;
        }

        const [buffer] = await file.download({ start: 0, end: 11 });
        if (!isValidVideoSignature(buffer)) {
          console.warn(`[Security Alert] Deleting file with invalid video signature: ${filePath}`);
          await file.delete({ ignoreNotFound: true });
          await db.collection('auditLogs').add({
            action: 'SUSPICIOUS_VIDEO_SIGNATURE_MISMATCH',
            actorUid: null,
            actorEmail: null,
            actorType: 'system',
            filePath,
            detectedSignatureHex: buffer ? buffer.toString('hex') : 'empty',
            timestamp: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          });
          return;
        }

        // Legitimate video - preserved
        return;
      }

      // 1.5. Identity Verification Paths (verification_pending/ and verification_vault/)
      if (isVerificationPath) {
        const MAX_VERIFICATION_DOC_SIZE = 10 * 1024 * 1024; // 10MB
        if (fileSize <= 0 || fileSize > MAX_VERIFICATION_DOC_SIZE) {
          console.warn(`[Security Alert] Deleting verification doc exceeding 10MB: ${filePath} (${fileSize} bytes)`);
          await file.delete({ ignoreNotFound: true });
          return;
        }

        const lowerPath = filePath.toLowerCase();
        if (!lowerPath.endsWith('.jpg') && !lowerPath.endsWith('.jpeg')) {
          console.warn(`[Security Alert] Deleting verification doc with non-JPEG extension: ${filePath}`);
          await file.delete({ ignoreNotFound: true });
          return;
        }

        const [buffer] = await file.download({ start: 0, end: 11 });
        const isJpeg = buffer && buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        if (!isJpeg) {
          console.warn(`[Security Alert] Deleting verification doc with invalid JPEG magic bytes: ${filePath}`);
          await file.delete({ ignoreNotFound: true });
          await db.collection('auditLogs').add({
            action: 'SUSPICIOUS_VERIFICATION_DOC_SIGNATURE',
            actorUid: null,
            actorType: 'system',
            filePath,
            detectedSignatureHex: buffer ? buffer.toString('hex') : 'empty',
            timestamp: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          });
          return;
        }

        // Cap enforcement for pending uploads: maximum 2 files per user (driver_license and identity)
        if (filePath.startsWith('verification_pending/')) {
          const segments = filePath.split('/');
          const ownerUid = segments[1];
          if (ownerUid) {
            const prefix = `verification_pending/${ownerUid}/`;
            const [pendingFiles] = await bucket.getFiles({ prefix, maxResults: 5 });
            if (pendingFiles.length > 2) {
              console.warn(`[Security Alert] Pending verification cap exceeded for ${ownerUid}, deleting excess: ${filePath}`);
              await file.delete({ ignoreNotFound: true });
              await db.collection('auditLogs').add({
                action: 'VERIFICATION_QUOTA_EXCEEDED',
                actorUid: ownerUid,
                actorType: 'system',
                filePath,
                timestamp: FieldValue.serverTimestamp(),
                createdAt: FieldValue.serverTimestamp(),
              });
            }
          }
        }

        return;
      }

      // 2. Document & User Image Validation (<= 25MB)
      if (isDocumentPath) {
        if (fileSize <= 0 || fileSize > MAX_DOCUMENT_SIZE_BYTES) {
          console.warn(`[Security Alert] Deleting document exceeding limit: ${filePath} (${fileSize} bytes)`);
          await file.delete({ ignoreNotFound: true });
          return;
        }

        const lowerPath = filePath.toLowerCase();
        const allowedDocExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
        const hasValidDocExt = allowedDocExts.some((ext) => lowerPath.endsWith(ext));
        if (!hasValidDocExt) {
          console.warn(`[Security Alert] Deleting document with forbidden extension: ${filePath}`);
          await file.delete({ ignoreNotFound: true });
          return;
        }

        const [buffer] = await file.download({ start: 0, end: 11 });
        const isValid = isValidPdfSignature(buffer) || isValidImageSignature(buffer);

        if (!isValid) {
          console.warn(`[Security Alert] Deleting document with invalid signature: ${filePath}`);
          await file.delete({ ignoreNotFound: true });
          await db.collection('auditLogs').add({
            action: 'SUSPICIOUS_FILE_SIGNATURE_MISMATCH',
            actorUid: null,
            actorEmail: null,
            actorType: 'system',
            filePath,
            detectedSignatureHex: buffer ? buffer.toString('hex') : 'empty',
            timestamp: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          });
          return;
        }

        // Per-user cap on identity documents: 3 files in users/{uid}/documents/ (or uploads/{uid}/)
        const segments = filePath.split('/');
        const isUserDocPath =
          (segments[0] === 'users' && segments[2] === 'documents' && Boolean(segments[1])) ||
          (segments[0] === 'uploads' && Boolean(segments[1]));
        if (isUserDocPath) {
          const MAX_FILES_PER_USER = 3;
          const ownerUid = segments[1];
          const prefix = segments[0] === 'users' ? `users/${ownerUid}/documents/` : `uploads/${ownerUid}/`;
          const [userFiles] = await bucket.getFiles({ prefix, maxResults: MAX_FILES_PER_USER + 2 });
          if (userFiles.length > MAX_FILES_PER_USER) {
            console.warn(`[Security Alert] Document cap exceeded for ${ownerUid}, deleting ${filePath}`);
            await file.delete({ ignoreNotFound: true });
            // Remove any Firestore index records that point at the deleted object
            try {
              const orphanSnap = await db.collection('files').where('storagePath', '==', filePath).get();
              const batch = db.batch();
              orphanSnap.docs.forEach((d) => batch.delete(d.ref));
              const subSnap = await db.collection('users').doc(ownerUid).collection('files')
                .where('storagePath', '==', filePath).get();
              subSnap.docs.forEach((d) => batch.delete(d.ref));
              await batch.commit();
            } catch (cleanupErr) {
              console.warn('[validateUploadedFileSignature] Orphan record cleanup failed:', cleanupErr);
            }
            await db.collection('auditLogs').add({
              action: 'UPLOAD_QUOTA_EXCEEDED',
              actorUid: ownerUid,
              actorType: 'system',
              filePath,
              timestamp: FieldValue.serverTimestamp(),
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }

        return;
      }

      // 3. Public Vehicle Images (<= 30MB)
      if (isTargetPublicPath) {
        const [buffer] = await file.download({ start: 0, end: 11 });
        if (!isValidImageSignature(buffer)) {
          console.warn(`[Security Alert] Deleting public asset with invalid signature: ${filePath}`);
          await file.delete({ ignoreNotFound: true });
          return;
        }
      }
    } catch (err) {
      console.error(`[validateUploadedFileSignature] Error validating ${filePath}:`, err);
    }
  }
);
