/**
 * Security utilities for Shaker Car Rental
 * Provides input sanitization, file validation, rate limiting, and defensive security measures
 */

// XSS Sanitization for text inputs (names, emails, phones, notes, comments)
export function sanitizeInput(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/[<>]/g, '') // Strip literal angle brackets
    .replace(/javascript:/gi, '') // Strip javascript: protocol
    .replace(/data:/gi, '') // Strip data: URIs in text
    .replace(/on\w+=/gi, '') // Strip inline event handlers like onclick=, onerror=
    .trim();
}

// Strict email format validator
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

// Phone format validator (Supports Syrian +963, regional numbers, and international digits)
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  // Allows digits, optional leading +, spaces, hyphens, min 7 digits, max 16 digits
  const clean = phone.replace(/[\s\-()]/g, '');
  const phoneRegex = /^\+?[0-9]{7,16}$/;
  return phoneRegex.test(clean);
}

// Secure file upload validation
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

const FORBIDDEN_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'asp', 'aspx', 'jsp', 'cgi',
  'pl', 'py', 'vbs', 'scr', 'msi', 'com', 'jar', 'dll', 'sys', 'html', 'htm', 'xhtml'
];

const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v'];

export function validateUploadedFile(
  fileName: string,
  fileSize: number,
  fileType: string,
  type: 'document' | 'video' = 'document'
): FileValidationResult {
  // Prevent path traversal in file names
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'اسم الملف غير آمن ويحتوي على محارف غير مسموحة' };
  }

  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // Block dangerous executable extensions unconditionally
  if (FORBIDDEN_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'نوع الملف غير مسموح به لأسباب أمنية مشددة' };
  }

  if (type === 'document') {
    // Max 10MB for documents
    const MAX_DOC_SIZE = 10 * 1024 * 1024;
    if (fileSize > MAX_DOC_SIZE) {
      return { valid: false, error: 'حجم الملف يتجاوز الحد الأقصى المسموح (10 ميجابايت)' };
    }

    if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension)) {
      return { valid: false, error: 'يرجى رفع ملفات بصيغة PDF أو صور فقط (JPG, PNG, WEBP, PDF)' };
    }
  } else if (type === 'video') {
    // Max 30MB for videos
    const MAX_VIDEO_SIZE = 30 * 1024 * 1024;
    if (fileSize > MAX_VIDEO_SIZE) {
      return { valid: false, error: 'حجم مقطع الفيديو يتجاوز 30 ميجابايت' };
    }

    if (!ALLOWED_VIDEO_EXTENSIONS.includes(extension)) {
      return { valid: false, error: 'يرجى رفع مقطع فيديو بصيغة صالحة (MP4, WEBM, MOV)' };
    }
  }

  return { valid: true };
}

// In-Memory Login Rate Limiter (Defends against brute-force attacks)
class RateLimiter {
  private attempts: Map<string, { count: number; lockedUntil: number }> = new Map();

  check(identifier: string): { allowed: boolean; waitSeconds?: number } {
    const key = identifier.toLowerCase().trim();
    const record = this.attempts.get(key);
    if (!record) return { allowed: true };

    const now = Date.now();
    if (record.lockedUntil > now) {
      const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { allowed: false, waitSeconds };
    }

    // Reset if lockout period has expired
    if (record.lockedUntil > 0 && record.lockedUntil <= now) {
      this.attempts.delete(key);
      return { allowed: true };
    }

    return { allowed: true };
  }

  isAllowed(identifier: string): { allowed: boolean; message?: string } {
    const res = this.check(identifier);
    if (!res.allowed) {
      return {
        allowed: false,
        message: `تم تعليق محاولات تسجيل الدخول مؤقتاً بسبب المحاولات الخاطئة المتكررة. يرجى الانتظار لمدة ${res.waitSeconds} ثانية.`,
      };
    }
    return { allowed: true };
  }

  recordFailedAttempt(identifier: string): { locked: boolean; waitSeconds?: number } {
    const key = identifier.toLowerCase().trim();
    const record = this.attempts.get(key) || { count: 0, lockedUntil: 0 };
    record.count += 1;

    // After 5 failed attempts, lock for 30 seconds; after 10, lock for 2 minutes
    if (record.count >= 10) {
      record.lockedUntil = Date.now() + 120 * 1000;
      this.attempts.set(key, record);
      return { locked: true, waitSeconds: 120 };
    } else if (record.count >= 5) {
      record.lockedUntil = Date.now() + 30 * 1000;
      this.attempts.set(key, record);
      return { locked: true, waitSeconds: 30 };
    }

    this.attempts.set(key, record);
    return { locked: false };
  }

  reset(identifier: string) {
    this.attempts.delete(identifier.toLowerCase().trim());
  }
}

export const loginRateLimiter = new RateLimiter();
