/**
 * Shaker Car Rental — Document Image Quality Assessment
 *
 * Implements client-side real-time image validation:
 * - Minimum resolution checks (>= 1280x720)
 * - Laplacian variance sharpness/blur analysis
 * - Luminance / exposure bounds validation
 */

import {
  MIN_DOC_IMAGE_WIDTH,
  MIN_DOC_IMAGE_HEIGHT,
  MIN_LAPLACIAN_BLUR_SCORE,
  MIN_IMAGE_BRIGHTNESS,
  MAX_IMAGE_BRIGHTNESS,
  MAX_DOC_FILE_SIZE_BYTES,
} from '../constants/limits';
import { DocQualityMetric } from '../types';

/**
 * Computes mean brightness and standard deviation from 8-bit grayscale pixels.
 */
function analyzeLuminance(grayPixels: Uint8ClampedArray): { mean: number; min: number; max: number } {
  let sum = 0;
  let min = 255;
  let max = 0;
  const len = grayPixels.length;

  for (let i = 0; i < len; i++) {
    const val = grayPixels[i];
    sum += val;
    if (val < min) min = val;
    if (val > max) max = val;
  }

  const mean = sum / (len || 1);
  return { mean, min, max };
}

/**
 * Computes the variance of the Laplacian filter over grayscale pixels.
 * Laplacian kernel:
 *  [ 0,  1,  0 ]
 *  [ 1, -4,  1 ]
 *  [ 0,  1,  0 ]
 * A high variance corresponds to sharp edges, while blurry images produce low variance.
 */
function computeLaplacianVariance(
  gray: Uint8ClampedArray,
  width: number,
  height: number
): number {
  if (width < 3 || height < 3) return 0;

  // We sample down for performance if image is very large
  const stepX = width > 1200 ? 2 : 1;
  const stepY = height > 1200 ? 2 : 1;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += stepY) {
    const rowOffset = y * width;
    const prevRowOffset = (y - 1) * width;
    const nextRowOffset = (y + 1) * width;

    for (let x = 1; x < width - 1; x += stepX) {
      const center = gray[rowOffset + x];
      const top = gray[prevRowOffset + x];
      const bottom = gray[nextRowOffset + x];
      const left = gray[rowOffset + (x - 1)];
      const right = gray[rowOffset + (x + 1)];

      const lap = top + bottom + left + right - 4 * center;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.max(0, variance);
}

/**
 * Analyzes an HTMLCanvasElement or ImageData for document quality.
 */
export function analyzeCanvasQuality(canvas: HTMLCanvasElement): DocQualityMetric {
  const width = canvas.width;
  const height = canvas.height;

  // 1. Resolution Check
  const meetsResolution =
    (width >= MIN_DOC_IMAGE_WIDTH && height >= MIN_DOC_IMAGE_HEIGHT) ||
    (height >= MIN_DOC_IMAGE_WIDTH && width >= MIN_DOC_IMAGE_HEIGHT);

  if (!meetsResolution) {
    return {
      width,
      height,
      blurScore: 0,
      passed: false,
      message: `دقة الصورة (${width}×${height}) أقل من الحد الأدنى المطلوب (${MIN_DOC_IMAGE_WIDTH}×${MIN_DOC_IMAGE_HEIGHT}). يرجى تقريب الكاميرا والتصوير بدقة أعلى.`,
    };
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      width,
      height,
      blurScore: 100,
      passed: true,
    };
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const pixelCount = width * height;
  const gray = new Uint8ClampedArray(pixelCount);

  // Convert to Grayscale using standard ITU-R BT.601 luminance weights
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // 2. Exposure & Brightness Analysis
  const { mean: brightness } = analyzeLuminance(gray);
  const roundedBrightness = Math.round(brightness);

  if (brightness < MIN_IMAGE_BRIGHTNESS) {
    return {
      width,
      height,
      blurScore: 0,
      brightness: roundedBrightness,
      passed: false,
      message: 'إضاءة الصورة ضعيفة جداً ومعتمة. يرجى التصوير في مكان جيد الإضاءة وتجنب الظلال.',
    };
  }

  if (brightness > MAX_IMAGE_BRIGHTNESS) {
    return {
      width,
      height,
      blurScore: 0,
      brightness: roundedBrightness,
      passed: false,
      message: 'إضاءة الصورة ساطعة جداً أو تحتوي على انعكاس ضوئي ساطع يحجب تفاصيل الوثيقة.',
    };
  }

  // 3. Blur / Sharpness via Laplacian Variance
  const blurScore = Math.round(computeLaplacianVariance(gray, width, height));

  if (blurScore < MIN_LAPLACIAN_BLUR_SCORE) {
    return {
      width,
      height,
      blurScore,
      brightness: roundedBrightness,
      passed: false,
      message: 'الصورة ضبابية وغير واضحة، ثبّت الجهاز وتأكد من تركيز العدسة (Focus) على تفاصيل الوثيقة.',
    };
  }

  return {
    width,
    height,
    blurScore,
    brightness: roundedBrightness,
    passed: true,
    message: 'جودة الصورة ممتازة والتفاصيل واضحة ومقروءة.',
  };
}

/**
 * Analyzes an image Blob or File using browser Image and Canvas APIs.
 */
export async function analyzeImageFileQuality(file: File | Blob): Promise<DocQualityMetric> {
  if (file.size > MAX_DOC_FILE_SIZE_BYTES) {
    return {
      width: 0,
      height: 0,
      blurScore: 0,
      passed: false,
      message: `حجم الملف (${Math.round(file.size / (1024 * 1024))}MB) يتجاوز الحد الأقصى المسموح به (${MAX_DOC_FILE_SIZE_BYTES / (1024 * 1024)}MB).`,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({
          width: canvas.width,
          height: canvas.height,
          blurScore: 100,
          passed: true,
        });
        return;
      }
      ctx.drawImage(img, 0, 0);
      const metric = analyzeCanvasQuality(canvas);
      resolve(metric);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: 0,
        height: 0,
        blurScore: 0,
        passed: false,
        message: 'تعذر قراءة ملف الصورة. يرجى إعادة التصوير بالكاميرا.',
      });
    };

    img.src = objectUrl;
  });
}
