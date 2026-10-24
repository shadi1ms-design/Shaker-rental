/**
 * Shaker Car Rental — Server-side Image Quality & Integrity Inspector
 *
 * Parses JPEG structure, extracts true dimensions, scans EXIF for editing tags,
 * and calculates SHA-256 checksums without external binary dependencies.
 */

import * as crypto from 'crypto';
import sharp from 'sharp';
import {
  MIN_LAPLACIAN_BLUR_SCORE,
  MIN_IMAGE_BRIGHTNESS,
  MAX_IMAGE_BRIGHTNESS,
} from './constants';

export interface ServerQualityResult {
  passed: boolean;
  blurScore: number;
  brightness: number;
  failureReason?: string;
  message: string;
}

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

/**
 * Server-side sharpness and exposure analysis using sharp.
 * Resizes image to width 512, converts to grayscale, and evaluates:
 * 1. Luminance / brightness bounds
 * 2. Laplacian variance (sharpness score)
 */
export async function analyzeServerQuality(buffer: Buffer): Promise<ServerQualityResult> {
  if (!buffer || buffer.length === 0) {
    return {
      passed: false,
      blurScore: 0,
      brightness: 0,
      failureReason: 'بيانات الصورة غير صالحة أو فارغة.',
      message: 'بيانات الصورة غير صالحة أو فارغة.',
    };
  }

  try {
    const { data, info } = await sharp(buffer)
      .resize({ width: 512, withoutEnlargement: false })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const pixelCount = data.length;

    if (pixelCount === 0 || width < 3 || height < 3) {
      return {
        passed: false,
        blurScore: 0,
        brightness: 0,
        failureReason: 'أبعاد الصورة غير كافية لتحليل الجودة.',
        message: 'أبعاد الصورة غير كافية لتحليل الجودة.',
      };
    }

    // 1. Mean brightness calculation (0 - 255)
    let sumLuminance = 0;
    for (let i = 0; i < pixelCount; i++) {
      sumLuminance += data[i];
    }
    const brightness = Math.round(sumLuminance / pixelCount);

    if (brightness < MIN_IMAGE_BRIGHTNESS) {
      const msg = 'إضاءة الصورة ضعيفة جداً ومعتمة. يرجى التصوير في مكان جيد الإضاءة وتجنب الظلال.';
      return {
        passed: false,
        blurScore: 0,
        brightness,
        failureReason: msg,
        message: msg,
      };
    }

    if (brightness > MAX_IMAGE_BRIGHTNESS) {
      const msg = 'إضاءة الصورة ساطعة جداً أو تحتوي على انعكاس ضوئي ساطع يحجب تفاصيل الوثيقة.';
      return {
        passed: false,
        blurScore: 0,
        brightness,
        failureReason: msg,
        message: msg,
      };
    }

    // 2. Laplacian variance (Sharpness)
    // 3x3 Laplacian kernel:
    // [ 0,  1,  0 ]
    // [ 1, -4,  1 ]
    // [ 0,  1,  0 ]
    let lapSum = 0;
    let lapSumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      const prevRowOffset = (y - 1) * width;
      const nextRowOffset = (y + 1) * width;

      for (let x = 1; x < width - 1; x++) {
        const center = data[rowOffset + x];
        const top = data[prevRowOffset + x];
        const bottom = data[nextRowOffset + x];
        const left = data[rowOffset + (x - 1)];
        const right = data[rowOffset + (x + 1)];

        const lap = top + bottom + left + right - 4 * center;
        lapSum += lap;
        lapSumSq += lap * lap;
        count++;
      }
    }

    const meanLap = count > 0 ? lapSum / count : 0;
    const variance = count > 0 ? lapSumSq / count - meanLap * meanLap : 0;
    const blurScore = Math.round(Math.max(0, variance));

    if (blurScore < MIN_LAPLACIAN_BLUR_SCORE) {
      const msg = 'الصورة ضبابية وغير واضحة، ثبّت الجهاز وتأكد من تركيز العدسة (Focus) على تفاصيل الوثيقة.';
      return {
        passed: false,
        blurScore,
        brightness,
        failureReason: msg,
        message: msg,
      };
    }

    return {
      passed: true,
      blurScore,
      brightness,
      message: 'جودة الصورة ممتازة والتفاصيل واضحة ومقروءة.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[analyzeServerQuality] sharp error:', errorMsg);
    return {
      passed: false,
      blurScore: 0,
      brightness: 0,
      failureReason: 'تعذر معالجة أو فك تشفير بيانات الصورة.',
      message: 'تعذر معالجة أو فك تشفير بيانات الصورة.',
    };
  }
}

