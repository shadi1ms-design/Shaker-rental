import React from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export type MfaFlowStep = 'idle' | 'reauth_enroll' | 'verify_code' | 'reauth_unenroll';

export interface MfaSecurityCardProps {
  isMfaEnrolled: boolean;
  isEmailVerifiedForMfa: boolean;
  hasPasswordProvider: boolean;
  hasGoogleProvider: boolean;
  mfaStep: MfaFlowStep;
  setMfaStep: (step: MfaFlowStep) => void;
  mfaReauthPassword: string;
  setMfaReauthPassword: (val: string) => void;
  totpQrSvg: { path: string; totalSize: number } | null;
  totpSecretKey: string;
  totpCode: string;
  setTotpCode: (val: string) => void;
  mfaLoading: boolean;
  mfaFeedback: { type: 'success' | 'error'; message: string } | null;
  setMfaFeedback: (fb: { type: 'success' | 'error'; message: string } | null) => void;
  secretCopied: boolean;
  onCopySecret: () => void;
  onStartMfaEnrollment: (mode: 'password' | 'google') => void;
  onConfirmMfaEnrollment: (e: React.FormEvent) => void;
  onCancelMfaEnrollment: () => void;
  onInitiateMfaUnenroll: () => void;
  onConfirmMfaUnenroll: (mode: 'password' | 'google') => void;
  showAdminUnenrollWarning?: boolean;
  onConfirmAdminUnenrollWarning?: () => void;
  onCancelAdminUnenrollWarning?: () => void;
}

export const MfaSecurityCard: React.FC<MfaSecurityCardProps> = ({
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
  onCopySecret,
  onStartMfaEnrollment,
  onConfirmMfaEnrollment,
  onCancelMfaEnrollment,
  onInitiateMfaUnenroll,
  onConfirmMfaUnenroll,
  showAdminUnenrollWarning = false,
  onConfirmAdminUnenrollWarning,
  onCancelAdminUnenrollWarning,
}) => {
  return (
    <div className="p-4 rounded-card bg-slate-950/70 border border-slate-800 space-y-4 text-sm">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
          <h3 className="font-extrabold text-white text-sm">المصادقة الثنائية (Google Authenticator)</h3>
        </div>
        {isMfaEnrolled ? (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>مفعّلة</span>
          </span>
        ) : (
          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-bold text-xs">
            غير مفعّلة
          </span>
        )}
      </div>

      {mfaFeedback && (
        <div
          className={`p-2.5 rounded-xl text-sm flex items-center gap-2 ${
            mfaFeedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
          }`}
        >
          {mfaFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{mfaFeedback.message}</span>
        </div>
      )}

      {!isEmailVerifiedForMfa ? (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            يرجى تأكيد البريد الإلكتروني أولاً قبل تفعيل المصادقة الثنائية (Google Authenticator).
          </span>
        </div>
      ) : isMfaEnrolled ? (
        <div className="space-y-3">
          <p className="text-slate-300 leading-relaxed">
            حسابك الإداري محمي حالياً بالمصادقة الثنائية عبر تطبيق Google Authenticator.
          </p>

          {showAdminUnenrollWarning ? (
            // ملاحظة: هذا حاجز واجهة (UI Guard) فقط للأدمن غير السوبر قبل المتابعة، وليس حدًا أمنيًا.
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
              <div className="flex items-start gap-2 text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="font-bold">
                  قد لا تتمكن من تنفيذ العمليات الحساسة بعد إلغاء المصادقة الثنائية
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onConfirmAdminUnenrollWarning}
                  className="px-4 py-2 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all"
                >
                  تأكيد المتابعة
                </button>
                <button
                  type="button"
                  onClick={onCancelAdminUnenrollWarning}
                  className="px-3 py-2 min-h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all"
                >
                  تراجع
                </button>
              </div>
            </div>
          ) : mfaStep !== 'reauth_unenroll' ? (
            <button
              type="button"
              disabled={mfaLoading}
              onClick={onInitiateMfaUnenroll}
              className="px-4 py-2 min-h-11 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-sm font-bold transition-all disabled:opacity-50"
            >
              إلغاء التفعيل
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <p className="font-bold text-slate-200">
                لتأكيد إلغاء تفعيل المصادقة الثنائية، يرجى إعادة تأكيد هويتك:
              </p>
              {(hasPasswordProvider || !hasGoogleProvider) && (
                <div className="space-y-2">
                  <input
                    type="password"
                    value={mfaReauthPassword}
                    onChange={(e) => setMfaReauthPassword(e.target.value)}
                    placeholder="كلمة المرور الحالية"
                    dir="ltr"
                    className="w-full min-h-11 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    disabled={mfaLoading || !mfaReauthPassword}
                    onClick={() => onConfirmMfaUnenroll('password')}
                    className="px-4 py-2 min-h-11 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-sm font-extrabold transition-all disabled:opacity-50"
                  >
                    {mfaLoading ? 'جاري الإلغاء...' : 'تأكيد إلغاء التفعيل'}
                  </button>
                </div>
              )}
              {hasGoogleProvider && (
                <button
                  type="button"
                  disabled={mfaLoading}
                  onClick={() => onConfirmMfaUnenroll('google')}
                  className="px-4 py-2 min-h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold transition-all disabled:opacity-50"
                >
                  {mfaLoading ? 'جاري التحقق...' : 'تأكيد الهوية عبر Google وإلغاء التفعيل'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMfaStep('idle')}
                className="block min-h-11 px-2 text-sm text-slate-400 hover:text-white"
              >
                تراجع
              </button>
            </div>
          )}
        </div>
      ) : mfaStep === 'idle' ? (
        <div className="space-y-3">
          <p className="text-slate-400 leading-relaxed">
            أضف طبقة حماية ثانية لحسابك الإداري باستخدام تطبيق Google Authenticator لتوليد رموز تحقق متجددة كل 30 ثانية.
          </p>
          <button
            type="button"
            onClick={() => {
              setMfaFeedback(null);
              setMfaReauthPassword('');
              setMfaStep('reauth_enroll');
            }}
            className="px-4 py-2 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>تفعيل المصادقة الثنائية</span>
          </button>
        </div>
      ) : mfaStep === 'reauth_enroll' ? (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <p className="font-bold text-slate-200">
            يرجى تأكيد هويتك أولاً لبدء إعداد المصادقة الثنائية:
          </p>
          {(hasPasswordProvider || !hasGoogleProvider) && (
            <div className="space-y-2">
              <input
                type="password"
                value={mfaReauthPassword}
                onChange={(e) => setMfaReauthPassword(e.target.value)}
                placeholder="كلمة المرور الحالية"
                dir="ltr"
                className="w-full min-h-11 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm outline-none focus:border-amber-500"
              />
              <button
                type="button"
                disabled={mfaLoading || !mfaReauthPassword}
                onClick={() => onStartMfaEnrollment('password')}
                className="px-4 py-2 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all disabled:opacity-50"
              >
                {mfaLoading ? 'جاري التحقق وتوليد المفتاح...' : 'متابعة وإظهار رمز QR'}
              </button>
            </div>
          )}
          {hasGoogleProvider && (
            <button
              type="button"
              disabled={mfaLoading}
              onClick={() => onStartMfaEnrollment('google')}
              className="px-4 py-2 min-h-11 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold transition-all disabled:opacity-50"
            >
              {mfaLoading ? 'جاري التحقق...' : 'تأكيد الهوية عبر Google ومتابعة الإعداد'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMfaStep('idle')}
            className="block min-h-11 px-2 text-sm text-slate-400 hover:text-white"
          >
            إلغاء
          </button>
        </div>
      ) : (
        <form onSubmit={onConfirmMfaEnrollment} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <p className="text-slate-200 font-bold">
            امسح رمز الاستجابة السريعة (QR) عبر تطبيق Google Authenticator أو انسخ المفتاح النصي:
          </p>

          {totpQrSvg && (
            <div className="bg-white p-3 rounded-2xl w-fit mx-auto shadow-md">
              <svg
                width={totpQrSvg.totalSize}
                height={totpQrSvg.totalSize}
                viewBox={`0 0 ${totpQrSvg.totalSize} ${totpQrSvg.totalSize}`}
                role="img"
                aria-label="رمز QR لإعداد المصادقة الثنائية"
              >
                <rect width="100%" height="100%" fill="#ffffff" />
                <path d={totpQrSvg.path} fill="#000000" />
              </svg>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="block text-slate-400 text-sm">المفتاح النصي (للإدخال اليدوي):</span>
            <div className="flex items-center gap-2">
              <code
                dir="ltr"
                className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 font-mono text-xs select-all break-all"
              >
                {totpSecretKey}
              </code>
              <button
                type="button"
                onClick={onCopySecret}
                className="px-3.5 py-2 min-h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold shrink-0"
              >
                {secretCopied ? 'تم النسخ' : 'نسخ المفتاح'}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="totp-enroll-code" className="block text-slate-300 font-bold mb-1.5">
              أدخل رمز التحقق المكوّن من 6 أرقام من التطبيق:
            </label>
            <input
              id="totp-enroll-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              dir="ltr"
              required
              className="w-full min-h-11 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-center font-mono text-base tracking-widest outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onCancelMfaEnrollment}
              className="px-3.5 py-2 min-h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={mfaLoading || totpCode.length !== 6}
              className="px-4 py-2 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all disabled:opacity-50"
            >
              {mfaLoading ? 'جاري التفعيل...' : 'تأكيد وتفعيل المصادقة الثنائية'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
