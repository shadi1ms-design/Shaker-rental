/**
 * Centralized Firebase Error Diagnostics & User-Friendly Arabic Messages
 * Shaker Car Rental (شركة شاكر لتأجير السيارات)
 */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType | string;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface FirestoreErrorContext {
  collection: string;
  path: string;
  operation: 'read' | 'write' | 'create' | 'update' | 'delete' | 'query' | 'transaction';
  userId?: string | null;
  rawError?: unknown;
}

/**
 * Maps Firebase error codes to user-friendly Arabic messages
 */
export function getArabicErrorMessage(error: unknown): string {
  if (!error) return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';

  const errObj = typeof error === 'object' && error !== null ? (error as { code?: string; message?: string }) : null;
  const code = typeof error === 'string' ? error : (errObj?.code || errObj?.message || '');

  // Firebase Authentication specific errors
  if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password')) {
    return 'كلمة المرور أو البريد الإلكتروني غير صحيح. يرجى التحقق وإعادة المحاولة.';
  }

  if (code.includes('auth/user-not-found')) {
    return 'البريد الإلكتروني غير مسجل لدينا. يمكنك إنشاء حساب جديد.';
  }

  if (code.includes('auth/email-already-in-use')) {
    return 'هذا البريد الإلكتروني مسجل مسبقاً في النظام. يمكنك تسجيل الدخول مباشرة.';
  }

  if (code.includes('auth/weak-password')) {
    return 'كلمة المرور ضعيفة. يجب أن تتكون من 6 خانات أو أحرف على الأقل.';
  }

  if (code.includes('auth/invalid-email')) {
    return 'صيغة البريد الإلكتروني غير صالحة.';
  }

  if (code.includes('auth/operation-not-allowed')) {
    return 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في لوحة Firebase.';
  }

  if (code.includes('auth/too-many-requests')) {
    return 'تم تعليق المحاولات مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار قليلاً ثم المحاولة ثانية.';
  }

  if (code.includes('auth/user-disabled')) {
    return 'تم تعطيل هذا الحساب من قبل إدارة النظام.';
  }

  // Firebase Storage specific errors
  if (code.includes('storage/unauthorized') || code.includes('storage/canceled')) {
    return 'لا توجد صلاحية كافية لرفع هذا الملف إلى مساحة التخزين.';
  }

  if (code.includes('storage/quota-exceeded')) {
    return 'تم تجاوز السعة التخزينية المسموحة في خادم التخزين السحابي.';
  }

  if (code.includes('storage/object-not-found')) {
    return 'الملف المطلوب غير موجود في مساحة التخزين.';
  }

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

  if (code.includes('failed-precondition')) {
    return 'لم يتم استيفاء الشروط اللازمة لإتمام العملية (مثل تفعيل البريد أو توفر الرصيد).';
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
  return errObj?.message || 'حدث خطأ أثناء تحميل البيانات.';
}

export const getErrorMessage = getArabicErrorMessage;
export const getFriendlyErrorMessage = getArabicErrorMessage;

/**
 * Diagnostic logger & error handler:
 * Logs structured diagnostics and returns user-friendly Arabic messages.
 */
export function handleFirestoreError(
  collection: string,
  path: string,
  operation: 'read' | 'write' | 'create' | 'update' | 'delete' | 'query' | 'transaction',
  error: unknown,
  userId?: string | null
): string {
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';
  const errObj = typeof error === 'object' && error !== null ? (error as { code?: string; message?: string }) : null;

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : (errObj?.message || String(error)),
    operationType: operation as OperationType,
    path: `/${collection}/${path}`,
    authInfo: {
      userId: userId || null,
    }
  };

  if (isDev) {
    console.groupCollapsed(`🔥 [Firestore Error] ${operation.toUpperCase()} on /${collection}/${path}`);
    console.warn(`Structured Error:`, JSON.stringify(errInfo, null, 2));
    console.warn(`Error Code:       ${errObj?.code || 'N/A'}`);
    console.warn(`Technical Msg:    ${errObj?.message || error}`);
    console.groupEnd();
  }

  return getArabicErrorMessage(error);
}
