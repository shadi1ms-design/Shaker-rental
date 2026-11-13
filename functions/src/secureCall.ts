import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableOptions, CallableRequest, CallableFunction } from 'firebase-functions/v2/https';
import type { UserRecord } from 'firebase-admin/auth';
import { FUNCTION_REGION } from './constants';
import {
  assertNotRevoked,
  assertAdminMfa,
} from './authz';
import {
  isCallerSuperAdmin,
  isCallerAdmin,
  isCallerStaff,
} from './roles';

export type SecureCallRole = 'public' | 'user' | 'staff' | 'admin' | 'super_admin';

export interface SecureCallOptions extends CallableOptions {
  role?: SecureCallRole;
  requireMfa?: boolean | ((request: CallableRequest<any>) => boolean);
  unauthenticatedMessage?: string;
  permissionDeniedMessage?: string;
  dbOverride?: any;
}

export interface SecureCallDeps {
  assertNotRevokedFn?: (request: any) => Promise<UserRecord>;
  assertAdminMfaFn?: (request: any, dbOverride?: any) => Promise<void>;
}

export type SecureCallableRequest<T = any> = Omit<CallableRequest<T>, 'auth'> & {
  auth: NonNullable<CallableRequest<T>['auth']>;
  callerRecord?: UserRecord;
};

const DEFAULT_ROLE_DENIED_MESSAGES: Record<Exclude<SecureCallRole, 'public' | 'user'>, string> = {
  staff: 'هذه العملية مخصصة للموظفين والإدارة فقط.',
  admin: 'هذه العملية مخصصة للمدير (Admin) فقط.',
  super_admin: 'هذه العملية مقتصرة حصراً على المدير العام (Super Admin).',
};

/**
 * Executes the unified security guard pipeline in strict order:
 * 1. Reject unauthenticated callers (unless role === 'public')
 * 2. Verify account is active & session token is not revoked (assertNotRevoked)
 * 3. Enforce role requirement ('staff' | 'admin' | 'super_admin')
 * 4. Enforce Admin MFA when requireMfa is enabled (assertAdminMfa)
 * 5. Invoke the handler
 */
export async function executeSecureCall<TData = any, TResult = any>(
  options: SecureCallOptions,
  handler: (request: SecureCallableRequest<TData>) => Promise<TResult> | TResult,
  request: CallableRequest<TData>,
  deps?: SecureCallDeps
): Promise<TResult> {
  const role: SecureCallRole = options.role ?? 'user';

  if (role !== 'public') {
    if (!request?.auth || !request.auth.uid) {
      throw new HttpsError(
        'unauthenticated',
        options.unauthenticatedMessage || 'تسجيل الدخول مطلوب للتحقق من هوية وحالة الحساب.'
      );
    }

    const effectiveAssertNotRevoked = deps?.assertNotRevokedFn || assertNotRevoked;
    const existingRecord = !deps?.assertNotRevokedFn
      ? (request as SecureCallableRequest<TData>).callerRecord
      : undefined;
    const callerRecord = existingRecord || (await effectiveAssertNotRevoked(request));
    (request as SecureCallableRequest<TData>).callerRecord = callerRecord;

    const token = request.auth.token;
    const deniedMsg =
      options.permissionDeniedMessage ||
      (role !== 'user' ? DEFAULT_ROLE_DENIED_MESSAGES[role] : 'غير مصرح لك بتنفيذ هذه العملية.');

    if (role === 'super_admin' && !isCallerSuperAdmin(token)) {
      throw new HttpsError('permission-denied', deniedMsg);
    } else if (role === 'admin' && !isCallerAdmin(token)) {
      throw new HttpsError('permission-denied', deniedMsg);
    } else if (role === 'staff' && !isCallerStaff(token)) {
      throw new HttpsError('permission-denied', deniedMsg);
    }

    const shouldRequireMfa =
      typeof options.requireMfa === 'function'
        ? options.requireMfa(request)
        : Boolean(options.requireMfa);

    if (shouldRequireMfa) {
      const effectiveAssertAdminMfa = deps?.assertAdminMfaFn || assertAdminMfa;
      await effectiveAssertAdminMfa(request, options.dbOverride);
    }
  }

  return await handler(request as SecureCallableRequest<TData>);
}

/**
 * Unified wrapper around Firebase v2 onCall that enforces authentication,
 * token revocation checks, role-based access control, and optional MFA verification.
 */
export function secureCall<TData = any, TResult = any>(
  options: SecureCallOptions,
  handler: (request: SecureCallableRequest<TData>) => Promise<TResult> | TResult
): CallableFunction<TData, Promise<TResult>> {
  const callableOptions: CallableOptions = { ...options };
  delete (callableOptions as Partial<SecureCallOptions>).role;
  delete (callableOptions as Partial<SecureCallOptions>).requireMfa;
  delete (callableOptions as Partial<SecureCallOptions>).unauthenticatedMessage;
  delete (callableOptions as Partial<SecureCallOptions>).permissionDeniedMessage;
  delete (callableOptions as Partial<SecureCallOptions>).dbOverride;

  const finalCallableOptions: CallableOptions = {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    ...callableOptions,
  };

  return onCall<TData, Promise<TResult>>(finalCallableOptions, async (request) => {
    return executeSecureCall(options, handler, request);
  });
}
