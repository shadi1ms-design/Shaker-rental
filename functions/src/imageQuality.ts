/**
 * Shaker Car Rental — Server-side Image Quality & Integrity Inspector
 *
 * Parses JPEG structure, extracts true dimensions, scans EXIF for editing tags,
 * and calculates SHA-256 checksums without external binary dependencies.
 */

import * as crypto from 'crypto';

export interface ServerImageMetadata {
  width: number;
  height: number;
  sha256: string;
  sizeBytes: number;
  suspiciousEditorFound?: string | null;
  isValidJpeg: boolean;
}

/**
 * Known photo manipulation software indicators in EXIF
 */
const SUSPICIOUS_EDITORS = [
  'photoshop',
  'gimp',
  'canva',
  'lightroom',
  'snapseed',
  'picsart',
  'pixlr',
  'facetune',
  'vsco',
  'photopea',
  'affinity',
  'paint.net',
];

/**
 * Extracts true width and height from standard JPEG SOF0/SOF2 marker segments
 */
export function parseJpegDimensions(buffer: Buffer): { width: number; height: number; isValid: boolean } {
  if (!buffer || buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return { width: 0, height: 0, isValid: false };
  }

  let offset = 2;
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];

    // SOF0 (Baseline DCT), SOF1 (Extended Sequential), SOF2 (Progressive DCT)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height, isValid: true };
    }

    // Skip to next marker using length bytes
    const length = buffer.readUInt16BE(offset + 2);
    if (length <= 0) break;
    offset += 2 + length;
  }

  return { width: 0, height: 0, isValid: false };
}

/**
 * Scans JPEG APP1 EXIF segment for known editing software identifiers
 */
export function scanExifSoftware(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 100) return null;

  try {
    const rawString = buffer.slice(0, Math.min(buffer.length, 65536)).toString('latin1').toLowerCase();
    for (const editor of SUSPICIOUS_EDITORS) {
      if (rawString.includes(editor)) {
        return editor;
      }
    }
  } catch {
    // Ignore scan error
  }

  return null;
}

/**
 * Computes SHA-256 hex digest of image buffer
 */
export function computeBufferSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Comprehensive server inspection of raw JPEG buffer
 */
export function inspectServerImage(buffer: Buffer): ServerImageMetadata {
  const sizeBytes = buffer.length;
  const sha256 = computeBufferSha256(buffer);
  const { width, height, isValid } = parseJpegDimensions(buffer);
  const suspiciousEditorFound = scanExifSoftware(buffer);

  return {
    width,
    height,
    sha256,
    sizeBytes,
    suspiciousEditorFound,
    isValidJpeg: isValid,
  };
}
