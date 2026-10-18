import { describe, it, expect } from 'vitest';
import {
  isValidImageSignature,
  isValidPdfSignature,
  isValidVideoSignature,
} from '../functions/src/validateUploadedFileSignature';

describe('File Signature & Magic Bytes Inspector Tests', () => {
  it('should validate JPEG magic bytes (FF D8 FF)', () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(isValidImageSignature(jpegHeader)).toBe(true);
  });

  it('should validate PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(isValidImageSignature(pngHeader)).toBe(true);
  });

  it('should validate WEBP magic bytes (RIFF...WEBP)', () => {
    const webpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(isValidImageSignature(webpHeader)).toBe(true);
  });

  it('should validate PDF magic bytes (%PDF)', () => {
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    expect(isValidPdfSignature(pdfHeader)).toBe(true);
  });

  it('should validate MP4 / MOV video ftyp magic bytes (bytes 4-7 == ftyp)', () => {
    const mp4Header = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
    expect(isValidVideoSignature(mp4Header)).toBe(true);
  });

  it('should validate WebM video magic bytes (1A 45 DF A3)', () => {
    const webmHeader = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x99, 0x42, 0x86, 0x81]);
    expect(isValidVideoSignature(webmHeader)).toBe(true);
  });

  it('should reject invalid or malicious magic bytes', () => {
    const exeHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    expect(isValidImageSignature(exeHeader)).toBe(false);
    expect(isValidPdfSignature(exeHeader)).toBe(false);
    expect(isValidVideoSignature(exeHeader)).toBe(false);
  });
});
