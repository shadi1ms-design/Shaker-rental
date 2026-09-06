/**
 * Centralized Firebase Error Diagnostics & User-Friendly Arabic Messages
 * Shaker Car Rental (شركة شاكر لتأجير السيارات)
 */

export interface FirestoreErrorContext {
  collection: string;
  path: string;
  operation: 'read' | 'write' | 'create' | 'update' | 'delete' | 'query' | 'transaction';
  userId?: string | null;
  rawError?: any;
}

/**
 * Maps Firebase error codes to user-friendly Arabic messages
 */
export function getArabicErrorMessage(error: any): string {
  if (!error) return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';

  const code = typeof error === 'string' ? error : (error.code || error.message || '');

  if (code.includes('permission-denied') || code.includes('insufficient permissions')) {
    return 'لا توجد صلاحية لتنفيذ هذه العملية.';
  }

  if (code.includes('unauthenticated') || code.includes('auth/user-token-expired')) {
    return 'يرجى تسجيل الدخول أولاً للمتابعة.';
  }

  if (code.includes('not-found')) {
    return 'السجل أو العنصر المطلوب غير موجود في قاعدة البيانات.';
  }

  if (code.includes('already-exists')) {
    return 'هذا السجل مسجل مسبقاً في النظام.';
  }

  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'خدمة الاتصال بقاعدة البيانات غير متاحة حالياً، تم تفعيل العمل في الوضع المحلي الاحتياطي.';
  }

  if (code.includes('resource-exhausted')) {
    return 'تم تجاوز حد الاستعلامات المسموح به مؤقتاً. يرجى الانتظار قليلاً.';
  }

  if (code.includes('cancelled')) {
    return 'تم إلغاء العملية.';
  }

  if (code.includes('deadline-exceeded')) {
    return 'استغرقت العملية وقتاً أطول من المتوقع، يرجى التحقق من اتصال الإنترنت.';
  }

  // Double-booking specific message
  if (code.includes('غير متاحة') || code.includes('conflict')) {
    return 'عذراً، السيارة غير متاحة في الفترة المحددة.';
  }

  // Default fallback
  return error.message || 'حدث خطأ أثناء تحميل البيانات.';
}

/**
 * Diagnostic logger for developers:
 * Only outputs detailed collection, path, UID, and error code in development mode.
 */
export function handleFirestoreError(
  collection: string,
  path: string,
  operation: 'read' | 'write' | 'create' | 'update' | 'delete' | 'query' | 'transaction',
  error: any,
  userId?: string | null
): string {
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';

  if (isDev) {
    console.groupCollapsed(`🔥 [Firestore Error] ${operation.toUpperCase()} on /${collection}/${path}`);
    console.warn(`Collection:       ${collection}`);
    console.warn(`Document Path:    ${path}`);
    console.warn(`Operation:        ${operation}`);
    console.warn(`Authenticated UID:${userId || 'Unauthenticated / Guest'}`);
    console.warn(`Error Code:       ${error?.code || 'N/A'}`);
    console.warn(`Technical Msg:    ${error?.message || error}`);
    console.groupEnd();
  }

  return getArabicErrorMessage(error);
}
