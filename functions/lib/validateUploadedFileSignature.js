"use strict";
/**
 * CLOUD STORAGE TRIGGER: validateUploadedFileSignature
 *
 * Inspects uploaded file magic bytes asynchronously upon object finalization.
 *
 * SCOPE & COVERAGE NOTE:
 * - This function strictly validates public media paths: 'vehicles/' and 'public/'.
 * - Allowed MIME / magic bytes for these paths:
 *     1. JPEG (image/jpeg) -> FF D8 FF
 *     2. PNG (image/png)   -> 89 50 4E 47 0D 0A 1A 0A
 *     3. WEBP (image/webp) -> Bytes 0-3 "RIFF" (52 49 46 46) & Bytes 8-11 "WEBP" (57 45 42 50)
 *
 * NOTE: Paths like 'users/', 'uploads/', and 'contracts/' (which support PDF documents and contract videos)
 * are deliberately excluded from this trigger to prevent false-positive deletions, and will be handled with
 * dedicated multi-format validators in a separate stage if requested by the project owner.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUploadedFileSignature = void 0;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-functions/v2/storage");
const FUNCTION_REGION = 'us-east1';
const DATABASE_ID = 'ai-studio-shakercarrental-8ca1f5c8-9251-4c7d-b28c-5a1ee6a1a1e1';
// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = (0, firestore_1.getFirestore)(admin.app(), DATABASE_ID);
/**
 * Validates whether the given buffer matches known image signatures (JPEG, PNG, WEBP)
 */
function isValidImageSignature(buffer) {
    if (!buffer || buffer.length < 12) {
        return false;
    }
    // 1. JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return true;
    }
    // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a) {
        return true;
    }
    // 3. WEBP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
    const isRiff = buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46; // "RIFF"
    const isWebp = buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50; // "WEBP"
    if (isRiff && isWebp) {
        return true;
    }
    return false;
}
exports.validateUploadedFileSignature = (0, storage_1.onObjectFinalized)({
    region: FUNCTION_REGION,
    memory: '256MiB',
    timeoutSeconds: 60,
}, async (event) => {
    const object = event.data;
    if (!object || !object.name) {
        return;
    }
    const filePath = object.name;
    const bucketName = object.bucket;
    const contentType = object.contentType || 'unknown';
    // 1. Path Filtering: Strictly handle vehicles/ and public/ only
    const isTargetPublicPath = filePath.startsWith('vehicles/') || filePath.startsWith('public/');
    if (!isTargetPublicPath) {
        return;
    }
    try {
        const bucket = admin.storage().bucket(bucketName);
        const file = bucket.file(filePath);
        // Check if file still exists
        const [exists] = await file.exists();
        if (!exists) {
            return;
        }
        // 2. Read only the first 12 bytes to verify magic signature efficiently
        const [buffer] = await file.download({ start: 0, end: 11 });
        const isValid = isValidImageSignature(buffer);
        // 3. If signature is valid, exit cleanly
        if (isValid) {
            return;
        }
        // 4. Invalid signature: Delete file and record security audit log
        const detectedHex = buffer ? buffer.toString('hex') : 'empty';
        console.warn(`[Security Alert] Deleting file with invalid signature: ${filePath} (Hex: ${detectedHex}, Type: ${contentType})`);
        await file.delete({ ignoreNotFound: true });
        await db.collection('auditLogs').add({
            action: 'SUSPICIOUS_FILE_SIGNATURE_MISMATCH',
            filePath,
            declaredContentType: contentType,
            detectedSignatureHex: detectedHex,
            bucket: bucketName,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        console.error(`[Security Trigger Error] Failed while validating signature for ${filePath}:`, error);
    }
});
//# sourceMappingURL=validateUploadedFileSignature.js.map