import React, { useState, useMemo } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  TotpMultiFactorGenerator,
  TotpSecret,
  multiFactor,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  getMultiFactorResolver,
  MultiFactorResolver,
  MultiFactorError,
  updatePassword,
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { functionsService } from '../services/functionsService';
import { getQrSvgPath } from '../utils/qrCode';
import type { MfaFlowStep } from '../components/profile/MfaSecurityCard';

export type ReauthPendingAction =
  | { type: 'unenroll' }
  | { type: 'change_password'; newPassword: string };

export const ADMIN_UNENROLL_WARNING_TEXT =
  'قد لا تتمكن من تنفيذ العمليات الحساسة بعد إلغاء المصادقة الثنائية';
export const SUPER_ADMIN_MFA_REQUIRED_BLOCK_TEXT =
  'عطّل فرض المصادقة الثنائية من الإعدادات أولًا';
export const SUPER_ADMIN_MFA_CHECK_FAILED_TEXT =
  'تعذّر التحقق من حالة الفرض، حاول لاحقًا';

export const getArabicAuthErrorMessage = (err: unknown, fallback: string): string => {
  if (!err) return fallback;
  const authErr = err as { code?: string; message?: string };
  const code = authErr.code || '';
  switch (code) {
    case 'auth/invalid-verification-code':
      return 'رمز التحقق غير صحيح. يرجى التأكد من الرمز المكوّن من 6 أرقام في تطبيق Authenticator.';
    case 'auth/code-expired':
      return 'انتهت صلاحية رمز التحقق. يرجى استخدام الرمز الجديد الظاهر في التطبيق.';
    case 'auth/too-many-requests':
      return 'تم تجاوز عدد المحاولات المسموحة. يرجى الانتظار قليلاً قبل المحاولة مجدداً.';
    case 'auth/user-token-expired':
    case 'auth/requires-recent-login':
      return 'انتهت صلاحية الجلسة الأمنية. يلزم إعادة تسجيل الدخول للمتابعة.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'كلمة المرور الحالية غير صحيحة.';
    case 'auth/weak-password':
      return 'كلمة المرور الجديدة ضعيفة جداً. يرجى اختيار كلمة مرور أقوى.';
    case 'auth/user-not-found':
      return 'لم يتم العثور على الحساب. يلزم إعادة تسجيل الدخول.';
    case 'auth/popup-closed-by-user':
      return 'تم إغلاق نافذة التحقق قبل اكتمال العملية.';
    case 'auth/cancelled-popup-request':
      return 'تم إلغاء عملية التحقق.';
    case 'auth/popup-blocked':
      return 'تم حظر النافذة المنبثقة من قبل المتصفح. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.';
    default:
      if (typeof authErr.message === 'string' && authErr.message && !authErr.message.includes('auth/')) {
        return authErr.message;
      }
      return fallback;
  }
};

export interface UnenrollGuardOptions {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  adminWarningConfirmed: boolean;
  getMfaRequirementFn?: () => Promise<{
    success: boolean;
    data?: { requireAdminMfa?: boolean };
    error?: string;
  }>;
}

export interface UnenrollGuardResult {
  allowed: boolean;
  errorMessage?: string;
  requiresWarningConfirmation?: boolean;
  warningMessage?: string;
}

/**
 * ملاحظة: هذا حاجز واجهة (UI Guard) فقط لمنع قفل النفس بالخطأ عند إلغاء تسجيل Authenticator،
 * وليس حدًا أمنيًا (الحد الأمني الفعلي مفروض على الخادم عبر assertAdminMfa).
 */
export async function evaluateMfaUnenrollGuard(
  options: UnenrollGuardOptions
): Promise<UnenrollGuardResult> {
  const {
    isSuperAdmin,
    isAdmin,
    adminWarningConfirmed,
    getMfaRequirementFn = () => functionsService.setAdminMfaRequirement({ action: 'get' }),
  } = options;

  if (isSuperAdmin) {
    try {
      const res = await getMfaRequirementFn();
      if (!res || !res.success || typeof res.data?.requireAdminMfa !== 'boolean') {
        return {
          allowed: false,
          errorMessage: SUPER_ADMIN_MFA_CHECK_FAILED_TEXT,
        };
      }
      if (res.data.requireAdminMfa === true) {
        return {
          allowed: false,
          errorMessage: SUPER_ADMIN_MFA_REQUIRED_BLOCK_TEXT,
        };
      }
      return { allowed: true };
    } catch {
      return {
        allowed: false,
        errorMessage: SUPER_ADMIN_MFA_CHECK_FAILED_TEXT,
      };
    }
  }

  if (isAdmin && !adminWarningConfirmed) {
    return {
      allowed: false,
      requiresWarningConfirmation: true,
      warningMessage: ADMIN_UNENROLL_WARNING_TEXT,
    };
  }

  return { allowed: true };
}

export interface UseMfaEnrollmentParams {
  isOpen: boolean;
  user: {
    uid: string;
    email: string;
    emailVerified?: boolean;
  } | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
}

export function useMfaEnrollment({
  isOpen,
  user,
  isSuperAdmin,
  isAdmin,
}: UseMfaEnrollmentParams) {
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Two-Factor Authentication (TOTP) state (Admin & Super Admin only; never persisted in localStorage/Firestore)
  const [mfaStep, setMfaStep] = useState<MfaFlowStep>('idle');
  const [mfaReauthPassword, setMfaReauthPassword] = useState('');
  const [totpSecretObj, setTotpSecretObj] = useState<TotpSecret | null>(null);
  const [totpQrUrl, setTotpQrUrl] = useState<string>('');
  const [totpSecretKey, setTotpSecretKey] = useState<string>('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaFeedback, setMfaFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [mfaEnrolledTick, setMfaEnrolledTick] = useState(0);

  // Self-lockout UI guard state for unenroll (UI guard only, not a security boundary)
  const [showAdminUnenrollWarning, setShowAdminUnenrollWarning] = useState(false);
  const [adminUnenrollWarningConfirmed, setAdminUnenrollWarningConfirmed] = useState(false);

  // Shared Reauthentication & MFA Challenge state (never persisted)
  const [reauthResolver, setReauthResolver] = useState<MultiFactorResolver | null>(null);
  const [reauthTotpCode, setReauthTotpCode] = useState('');
  const [reauthPendingAction, setReauthPendingAction] = useState<ReauthPendingAction | null>(null);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);

  // Reset reauth challenge state on modal close
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
    setReauthResolver(null);
    setReauthPendingAction(null);
    setReauthTotpCode('');
    setReauthError(null);
    setShowAdminUnenrollWarning(false);
    setAdminUnenrollWarningConfirmed(false);
  } else if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
  }

  const fbCurrentUser = auth?.currentUser || null;
  const enrolledFactors = useMemo(() => {
    void mfaEnrolledTick;
    if (!fbCurrentUser) return [];
    try {
      return multiFactor(fbCurrentUser).enrolledFactors || [];
    } catch {
      return [];
    }
  }, [fbCurrentUser, mfaEnrolledTick]);

  const enrolledTotpFactor = useMemo(
    () =>
      enrolledFactors.find((f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID) ||
      enrolledFactors[0] ||
      null,
    [enrolledFactors]
  );
  const isMfaEnrolled = Boolean(enrolledTotpFactor);
  const isEmailVerifiedForMfa = Boolean(fbCurrentUser?.emailVerified ?? user?.emailVerified);
  const hasPasswordProvider = Boolean(
    fbCurrentUser?.providerData?.some((p) => p.providerId === 'password')
  );
  const hasGoogleProvider = Boolean(
    fbCurrentUser?.providerData?.some((p) => p.providerId === 'google.com')
  );

  // Shared reauthentication helper: handles password and Google reauthentication,
  // intercepts 'auth/multi-factor-auth-required', extracts the resolver, and defers
  // execution until the 6-digit TOTP challenge is answered.
  const reauthenticateCurrentAdmin = async (
    mode: 'password' | 'google',
    passwordOverride?: string,
    pendingAction?: ReauthPendingAction
  ): Promise<boolean> => {
    if (!auth || !fbCurrentUser) {
      throw new Error('انتهت جلسة تسجيل الدخول. يرجى إعادة تسجيل الدخول والمحاولة مجدداً.');
    }

    try {
      if (mode === 'google') {
        await reauthenticateWithPopup(fbCurrentUser, new GoogleAuthProvider());
        return true;
      }

      const pass = passwordOverride || mfaReauthPassword;
      if (!pass) {
        throw new Error('يرجى إدخال كلمة المرور الحالية لتأكيد الهوية.');
      }
      const credential = EmailAuthProvider.credential(
        fbCurrentUser.email || user?.email || '',
        pass
      );
      await reauthenticateWithCredential(fbCurrentUser, credential);
      return true;
    } catch (err: unknown) {
      const authErr = err as { code?: string };
      if (authErr?.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, err as MultiFactorError);
        setReauthResolver(resolver);
        setReauthTotpCode('');
        setReauthError(null);
        if (pendingAction) {
          setReauthPendingAction(pendingAction);
        }
        return false;
      }
      throw err;
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', message: 'يرجى إدخال كلمة المرور الحالية.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف أو أرقام على الأقل.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'كلمتا المرور غير متطابقتين.' });
      return;
    }
    if (!fbCurrentUser) {
      setPasswordFeedback({ type: 'error', message: 'انتهت جلسة تسجيل الدخول. يرجى إعادة تسجيل الدخول.' });
      return;
    }

    try {
      setIsChangingPassword(true);
      const ok = await reauthenticateCurrentAdmin('password', currentPassword, {
        type: 'change_password',
        newPassword,
      });
      if (!ok) {
        // Multi-factor challenge triggered: modal will prompt for TOTP code and then update password seamlessly
        return;
      }
      await updatePassword(fbCurrentUser, newPassword);
      setPasswordFeedback({ type: 'success', message: 'تم تحديث كلمة المرور بنجاح.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      console.error('Password change error:', err);
      const msg = getArabicAuthErrorMessage(err, 'تعذر تغيير كلمة المرور.');
      setPasswordFeedback({ type: 'error', message: msg });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleStartMfaEnrollment = async (reauthMode: 'password' | 'google') => {
    if (!fbCurrentUser || !user) return;
    setMfaFeedback(null);
    setMfaLoading(true);
    try {
      const ok = await reauthenticateCurrentAdmin(reauthMode);
      if (!ok) {
        return;
      }
      const session = await multiFactor(fbCurrentUser).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      const qrUrl = secret.generateQrCodeUrl(
        fbCurrentUser.email || user.email,
        'Shaker Cars'
      );
      setTotpSecretObj(secret);
      setTotpQrUrl(qrUrl);
      setTotpSecretKey(secret.secretKey);
      setTotpCode('');
      setMfaReauthPassword('');
      setMfaStep('verify_code');
    } catch (err: unknown) {
      const msg = getArabicAuthErrorMessage(
        err,
        'تعذر بدء إعداد المصادقة الثنائية. يرجى التحقق من بيانات الدخول.'
      );
      setMfaFeedback({ type: 'error', message: msg });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleConfirmMfaEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbCurrentUser || !totpSecretObj) return;
    const cleanCode = totpCode.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setMfaFeedback({ type: 'error', message: 'يرجى إدخال الرمز المكون من 6 أرقام من تطبيق Google Authenticator.' });
      return;
    }

    setMfaFeedback(null);
    setMfaLoading(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(totpSecretObj, cleanCode);
      await multiFactor(fbCurrentUser).enroll(assertion, 'Authenticator');
      await fbCurrentUser.getIdToken(true);
      setTotpSecretObj(null);
      setTotpQrUrl('');
      setTotpSecretKey('');
      setTotpCode('');
      setMfaStep('idle');
      setMfaEnrolledTick((t) => t + 1);
      setMfaFeedback({ type: 'success', message: 'تم تفعيل المصادقة الثنائية (Google Authenticator) بنجاح.' });
    } catch (err: unknown) {
      const msg = getArabicAuthErrorMessage(
        err,
        'فشل التحقق من الرمز. يرجى التأكد من الرمز والمحاولة مجدداً.'
      );
      setMfaFeedback({ type: 'error', message: msg });
    } finally {
      setMfaLoading(false);
    }
  };

  // ملاحظة: هذا حاجز واجهة (UI Guard) فقط لمنع قفل النفس بالخطأ، وليس حدًا أمنيًا.
  const handleInitiateMfaUnenroll = async () => {
    setMfaFeedback(null);
    setMfaReauthPassword('');

    if (isSuperAdmin) {
      setMfaLoading(true);
      try {
        const guard = await evaluateMfaUnenrollGuard({
          isSuperAdmin: true,
          isAdmin,
          adminWarningConfirmed: true,
        });
        if (!guard.allowed) {
          setMfaFeedback({
            type: 'error',
            message: guard.errorMessage || SUPER_ADMIN_MFA_CHECK_FAILED_TEXT,
          });
          return;
        }
        setMfaStep('reauth_unenroll');
      } finally {
        setMfaLoading(false);
      }
      return;
    }

    if (isAdmin && !adminUnenrollWarningConfirmed) {
      setShowAdminUnenrollWarning(true);
      return;
    }

    setMfaStep('reauth_unenroll');
  };

  const handleConfirmAdminUnenrollWarning = () => {
    setAdminUnenrollWarningConfirmed(true);
    setShowAdminUnenrollWarning(false);
    setMfaFeedback(null);
    setMfaReauthPassword('');
    setMfaStep('reauth_unenroll');
  };

  const handleCancelAdminUnenrollWarning = () => {
    setShowAdminUnenrollWarning(false);
    setAdminUnenrollWarningConfirmed(false);
  };

  const handleConfirmMfaUnenroll = async (reauthMode: 'password' | 'google') => {
    if (!fbCurrentUser || !enrolledTotpFactor) return;
    setMfaFeedback(null);
    setMfaLoading(true);
    try {
      // ملاحظة: هذا حاجز واجهة (UI Guard) فقط قبل تنفيذ unenroll، وليس حدًا أمنيًا.
      const guard = await evaluateMfaUnenrollGuard({
        isSuperAdmin,
        isAdmin,
        adminWarningConfirmed: adminUnenrollWarningConfirmed,
      });
      if (!guard.allowed) {
        if (guard.requiresWarningConfirmation) {
          setShowAdminUnenrollWarning(true);
          setMfaStep('idle');
        } else {
          setMfaFeedback({
            type: 'error',
            message: guard.errorMessage || SUPER_ADMIN_MFA_CHECK_FAILED_TEXT,
          });
        }
        return;
      }

      const ok = await reauthenticateCurrentAdmin(reauthMode, undefined, { type: 'unenroll' });
      if (!ok) {
        // Multi-factor challenge triggered: modal will prompt for TOTP code and then unenroll seamlessly
        return;
      }
      await multiFactor(fbCurrentUser).unenroll(enrolledTotpFactor);
      await fbCurrentUser.getIdToken(true);
      setMfaReauthPassword('');
      setAdminUnenrollWarningConfirmed(false);
      setShowAdminUnenrollWarning(false);
      setMfaStep('idle');
      setMfaEnrolledTick((t) => t + 1);
      setMfaFeedback({ type: 'success', message: 'تم إلغاء تفعيل المصادقة الثنائية بنجاح.' });
    } catch (err: unknown) {
      const msg = getArabicAuthErrorMessage(
        err,
        'تعذر إلغاء تفعيل المصادقة الثنائية.'
      );
      setMfaFeedback({ type: 'error', message: msg });
    } finally {
      setMfaLoading(false);
    }
  };

  const handleResolveMfaReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reauthResolver || !fbCurrentUser) return;

    const cleanCode = reauthTotpCode.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setReauthError('يرجى إدخال رمز التحقق المكوّن من 6 أرقام من تطبيق Authenticator.');
      return;
    }

    const totpHint =
      reauthResolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) ||
      reauthResolver.hints[0];

    if (!totpHint) {
      setReauthError('لم يتم العثور على وسيلة تحقق مطابقة لهذا الحساب.');
      return;
    }

    setReauthLoading(true);
    setReauthError(null);

    try {
      if (reauthPendingAction?.type === 'unenroll') {
        // ملاحظة: هذا حاجز واجهة (UI Guard) فقط قبل تنفيذ unenroll، وليس حدًا أمنيًا.
        const guard = await evaluateMfaUnenrollGuard({
          isSuperAdmin,
          isAdmin,
          adminWarningConfirmed: adminUnenrollWarningConfirmed,
        });
        if (!guard.allowed) {
          setReauthResolver(null);
          setReauthPendingAction(null);
          setReauthTotpCode('');
          if (guard.requiresWarningConfirmation) {
            setShowAdminUnenrollWarning(true);
            setMfaStep('idle');
          } else {
            setMfaFeedback({
              type: 'error',
              message: guard.errorMessage || SUPER_ADMIN_MFA_CHECK_FAILED_TEXT,
            });
          }
          return;
        }
      }

      const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, cleanCode);
      await reauthResolver.resolveSignIn(assertion);

      if (reauthPendingAction?.type === 'unenroll') {
        if (enrolledTotpFactor) {
          await multiFactor(fbCurrentUser).unenroll(enrolledTotpFactor);
          await fbCurrentUser.getIdToken(true);
          setMfaReauthPassword('');
          setAdminUnenrollWarningConfirmed(false);
          setShowAdminUnenrollWarning(false);
          setMfaStep('idle');
          setMfaEnrolledTick((t) => t + 1);
          setMfaFeedback({ type: 'success', message: 'تم إلغاء تفعيل المصادقة الثنائية بنجاح.' });
        }
      } else if (reauthPendingAction?.type === 'change_password' && reauthPendingAction.newPassword) {
        await updatePassword(fbCurrentUser, reauthPendingAction.newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordFeedback({ type: 'success', message: 'تم تحديث كلمة المرور بنجاح.' });
      }

      setReauthResolver(null);
      setReauthPendingAction(null);
      setReauthTotpCode('');
    } catch (err: unknown) {
      const msg = getArabicAuthErrorMessage(
        err,
        'رمز التحقق غير صحيح أو انتهت صلاحيته. يرجى التأكد من الرمز الظاهر في تطبيق Authenticator.'
      );
      setReauthError(msg);
    } finally {
      setReauthLoading(false);
      setIsChangingPassword(false);
    }
  };

  const handleCancelMfaReauth = () => {
    setReauthResolver(null);
    setReauthPendingAction(null);
    setReauthTotpCode('');
    setReauthError(null);
    setIsChangingPassword(false);
    setMfaLoading(false);
  };

  const handleCancelMfaEnrollment = () => {
    setTotpSecretObj(null);
    setTotpQrUrl('');
    setTotpSecretKey('');
    setTotpCode('');
    setMfaStep('idle');
  };

  const handleCopySecret = () => {
    navigator.clipboard?.writeText(totpSecretKey);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const totpQrSvg = useMemo(() => {
    if (!totpQrUrl) return null;
    try {
      return getQrSvgPath(totpQrUrl, 3, 2);
    } catch {
      return null;
    }
  }, [totpQrUrl]);

  return {
    // Password state & handlers
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isChangingPassword,
    passwordFeedback,
    handleChangePasswordSubmit,

    // MFA state & handlers
    isMfaEnrolled,
    isEmailVerifiedForMfa,
    hasPasswordProvider,
    hasGoogleProvider,
    mfaStep,
    setMfaStep,
    mfaReauthPassword,
    setMfaReauthPassword,
    totpQrSvg,
    totpSecretKey,
    totpCode,
    setTotpCode,
    mfaLoading,
    mfaFeedback,
    setMfaFeedback,
    secretCopied,
    handleCopySecret,
    handleStartMfaEnrollment,
    handleConfirmMfaEnrollment,
    handleCancelMfaEnrollment,
    handleInitiateMfaUnenroll,
    handleConfirmMfaUnenroll,
    showAdminUnenrollWarning,
    handleConfirmAdminUnenrollWarning,
    handleCancelAdminUnenrollWarning,

    // Shared Reauth MFA Challenge modal state & handlers
    reauthResolver,
    reauthTotpCode,
    setReauthTotpCode,
    reauthPendingAction,
    reauthLoading,
    reauthError,
    handleResolveMfaReauth,
    handleCancelMfaReauth,
  };
}
