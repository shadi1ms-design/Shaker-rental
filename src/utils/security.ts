/**
 * Security & Validation Utilities for Shaker Car Rental
 * 
 * Strict Zod/Regex format validation and upload constraints.
 * Raw input text is preserved without damaging Arabic typography, and escaped safely at render time.
 */

// Format validators
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const clean = phone.replace(/[\s\-()]/g, '');
  const phoneRegex = /^\+?[0-9]{7,16}$/;
  return phoneRegex.test(clean);
}

// Pass-through helper for backwards compatibility without corrupting Arabic input
export function sanitizeInput(input: string | undefined | null): string {
  if (input === null || input === undefined) return '';
  return String(input);
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

const FORBIDDEN_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'asp', 'aspx', 'jsp', 'cgi',
  'pl', 'py', 'vbs', 'scr', 'msi', 'com', 'jar', 'dll', 'sys', 'html', 'htm', 'xhtml'
];

const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'quicktime', 'mkv'];

export function validateUploadedFile(
  fileName: string,
  fileSize: number,
  fileType: string,
  type: 'document' | 'video' = 'document'
): FileValidationResult {
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'اسم الملف غير آمن ويحتوي على مسارات غير مسموحة.' };
  }

  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (FORBIDDEN_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'نوع الملف غير مسموح به لأسباب أمنية.' };
  }

  if (type === 'document') {
    const MAX_DOC_SIZE = 25 * 1024 * 1024; // 25MB
    if (fileSize > MAX_DOC_SIZE) {
      return { valid: false, error: 'حجم المستند يتجاوز الحد الأقصى المسموح (25 ميجابايت).' };
    }

    if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(extension)) {
      return { valid: false, error: 'يرجى رفع ملفات بصيغة PDF أو صور فقط (JPG, PNG, WEBP, PDF).' };
    }
  } else if (type === 'video') {
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB for contract inspection videos
    if (fileSize > MAX_VIDEO_SIZE) {
      return { valid: false, error: 'حجم مقطع الفيديو يتجاوز الحد الأقصى المسموح (100 ميجابايت).' };
    }

    if (!ALLOWED_VIDEO_EXTENSIONS.includes(extension)) {
      return { valid: false, error: 'يرجى رفع مقطع فيديو بصيغة صالحة (MP4, WEBM, MOV).' };
    }
  }

  return { valid: true };
}
