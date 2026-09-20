import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, RefreshCw, LogOut, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const EmailVerificationGate: React.FC = () => {
  const { user, logout, resendVerificationEmail, refreshEmailVerificationStatus } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage(null);
    setResendSuccess(false);

    try {
      await resendVerificationEmail();
      setResendSuccess(true);
      setCooldown(60);
    } catch (err: any) {
      console.error('Failed to resend verification email:', err);
      setErrorMessage(err.message || 'تعذر إعادة إرسال رابط التفعيل. يرجى المحاولة بعد قليل.');
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckStatus = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setErrorMessage(null);

    try {
      const verified = await refreshEmailVerificationStatus();
      if (!verified) {
        setErrorMessage('لم يتم تأكيد البريد الإلكتروني بعد. يرجى النقر على الرابط المرسل إلى بريدك ثم المحاولة مجدداً.');
      }
    } catch (err: any) {
      console.error('Failed to refresh email verification status:', err);
      setErrorMessage('حدث خطأ أثناء فحص حالة التفعيل. يرجى المحاولة مجدداً.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      id="email-verification-gate"
      className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950 font-sans"
      dir="rtl"
    >
      {/* Ambient background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -right-24 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl" />
      </div>

      <div
        id="email-verification-card"
        className="w-full max-w-lg bg-slate-900 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 text-center backdrop-blur-sm"
      >
        {/* Icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-500 shadow-inner">
          <Mail className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        {/* Heading */}
        <h1 className="text-xl sm:text-2xl font-black text-slate-100 mb-2">
          تأكيد البريد الإلكتروني مطلوب
        </h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          لقد أرسلنا رابط تفعيل إلى بريدك الإلكتروني. يرجى فتح الرابط لتأكيد حسابك وتفعيل كافة الميزات.
        </p>

        {/* Email Badge */}
        {user?.email && (
          <div
            id="verification-email-badge"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 font-mono text-xs sm:text-sm mb-6 max-w-full truncate"
          >
            <Mail className="w-4 h-4 shrink-0 text-slate-400" />
            <span className="truncate">{user.email}</span>
          </div>
        )}

        {/* Status Alerts */}
        {resendSuccess && (
          <div
            id="resend-success-alert"
            className="mb-6 p-4 bg-emerald-950/50 border border-emerald-800/60 rounded-xl flex items-start gap-3 text-right text-emerald-300 text-xs sm:text-sm"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <p className="font-bold">تم إرسال رابط التفعيل بنجاح!</p>
              <p className="text-emerald-400/80 text-xs mt-0.5">يرجى فحص صندوق الوارد ورسائل الترويج/غير المرغوب فيها (Spam).</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            id="resend-error-alert"
            className="mb-6 p-4 bg-rose-950/50 border border-rose-800/60 rounded-xl flex items-start gap-3 text-right text-rose-300 text-xs sm:text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <button
            id="btn-check-verification-status"
            type="button"
            onClick={handleCheckStatus}
            disabled={isChecking}
            className="w-full h-12 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:pointer-events-none text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'جاري التحقق...' : 'لقد قمت بتأكيد البريد، متابعة'}</span>
          </button>

          <button
            id="btn-resend-verification-email"
            type="button"
            onClick={handleResend}
            disabled={isResending || cooldown > 0}
            className="w-full h-12 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 active:bg-slate-750 disabled:opacity-50 disabled:pointer-events-none text-slate-200 font-medium rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {cooldown > 0 ? (
              <>
                <Clock className="w-4 h-4 text-slate-400" />
                <span>إعادة الإرسال بعد {cooldown} ثانية</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{isResending ? 'جاري الإرسال...' : 'إعادة إرسال رابط التفعيل'}</span>
              </>
            )}
          </button>
        </div>

        {/* Logout Option */}
        <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">تريد استخدام حساب آخر؟</span>
          <button
            id="btn-verification-logout"
            type="button"
            onClick={logout}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );
};
