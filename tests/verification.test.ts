import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  parseJpegDimensions,
  scanExifSoftware,
  computeBufferSha256,
  analyzeServerQuality,
} from '../functions/src/imageQuality';

describe('Verification & Image Inspection Tests', () => {
  it('should detect suspicious image editing software from buffer', () => {
    // Needs >= 100 bytes buffer per scanExifSoftware requirement
    const rawBuffer = Buffer.alloc(150, 0x20);
    rawBuffer.write('JFIF... Adobe Photoshop CC 2024 ...EXIF', 0, 'utf-8');
    const editor = scanExifSoftware(rawBuffer);
    expect(editor).toBe('photoshop');

    const canvaBuffer = Buffer.alloc(120, 0x20);
    canvaBuffer.write('Made with Canva graphics software version 12', 0, 'utf-8');
    expect(scanExifSoftware(canvaBuffer)).toBe('canva');

    const cleanBuffer = Buffer.alloc(120, 0x20);
    cleanBuffer.write('Apple iPhone 15 Pro back camera 6.86mm f/1.78 lens', 0, 'utf-8');
    expect(scanExifSoftware(cleanBuffer)).toBeNull();
  });

  it('should compute valid SHA-256 checksums', () => {
    const data = Buffer.from('test-camera-image-data-payload');
    const hash = computeBufferSha256(data);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should reject non-JPEG data for dimension parsing', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const res = parseJpegDimensions(pngBuffer);
    expect(res.isValid).toBe(false);
  });

  it('should parse synthetic JPEG SOF marker dimensions', () => {
    // Construct minimal valid JPEG with SOF0 marker:
    // SOI: FF D8
    // SOF0: FF C0, length: 00 11 (17 bytes), precision: 08, height: 04 38 (1080), width: 07 80 (1920)
    const jpegWithSof = Buffer.from([
      0xff, 0xd8, // SOI
      0xff, 0xc0, // SOF0
      0x00, 0x11, // length (17)
      0x08,       // precision (8 bits)
      0x04, 0x38, // height = 1080
      0x07, 0x80, // width = 1920
      0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xff, 0xd9, // EOI
    ]);

    const res = parseJpegDimensions(jpegWithSof);
    expect(res.isValid).toBe(true);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
  });

  describe('analyzeServerQuality tests with synthetic JPEGs', () => {
    it('should pass with a sharp, well-lit synthetic JPEG', async () => {
      // High-contrast alternating grid pattern creates high Laplacian edge variance
      const sharpSvg = `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#808080"/>
        ${Array.from({ length: 30 }, (_, i) => `<line x1="${i * 20}" y1="0" x2="${i * 20}" y2="400" stroke="#000000" stroke-width="4"/>`).join('')}
        ${Array.from({ length: 20 }, (_, i) => `<line x1="0" y1="${i * 20}" x2="600" y2="${i * 20}" stroke="#ffffff" stroke-width="4"/>`).join('')}
      </svg>`;
      const sharpJpeg = await sharp(Buffer.from(sharpSvg)).jpeg().toBuffer();

      const res = await analyzeServerQuality(sharpJpeg);
      expect(res.passed).toBe(true);
      expect(res.blurScore).toBeGreaterThanOrEqual(80);
      expect(res.brightness).toBeGreaterThanOrEqual(35);
      expect(res.brightness).toBeLessThanOrEqual(230);
      expect(res.message).toContain('جودة الصورة ممتازة');
    });

    it('should fail with a heavily blurred synthetic JPEG', async () => {
      // Create a smooth blurred image with very low edge variance
      const smoothSvg = `<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#7f7f7f"/>
      </svg>`;
      const blurryJpeg = await sharp(Buffer.from(smoothSvg))
        .blur(20)
        .jpeg({ quality: 40 })
        .toBuffer();

      const res = await analyzeServerQuality(blurryJpeg);
      expect(res.passed).toBe(false);
      expect(res.blurScore).toBeLessThan(80);
      expect(res.failureReason).toContain('ضبابية');
    });

    it('should fail with a pure black synthetic JPEG due to underexposure', async () => {
      const blackJpeg = await sharp({
        create: {
          width: 600,
          height: 400,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      const res = await analyzeServerQuality(blackJpeg);
      expect(res.passed).toBe(false);
      expect(res.brightness).toBeLessThan(35);
      expect(res.failureReason).toContain('ضعيفة جداً ومعتمة');
    });
  });
});
