import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isValidEmail, isValidPhone } from '../utils/security';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  Mail,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  KeyRound,
  Tag
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess?: () => void;
  loginWithGoogle?: (preferredEmail?: string) => Promise<boolean>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
  loginWithGoogle: propLoginWithGoogle,
}) => {
  const modalRef = useFocusTrap({ isOpen, onClose });
  const authContext = useAuth();
  const effectiveLoginWithGoogle = propLoginWithGoogle || authContext?.loginWithGoogle;
  const loginWithEmail = authContext?.loginWithEmail;
  const registerWithEmail = authContext?.registerWithEmail;
  const resetPassword = authContext?.resetPassword;

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');

  // Status State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (typeof effectiveLoginWithGoogle === 'function') {
        await effectiveLoginWithGoogle(email?.trim() || undefined);
      } else {
        throw new Error('خدمة تسجيل الدخول عبر Google غير متوفرة حالياً.');
      }
      setSuccessMessage('تم تسجيل الدخول بواسطة Google بنجاح! مرحباً بك.');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        else onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err?.message || 'تعذر تسجيل الدخول عبر Google. يرجى المحاولة ثانية.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.toLowerCase().trim();
    setIsLoading(true);

    try {
      if (mode === 'login') {
        if (!cleanEmail || !password) {
          throw new Error('يرجى ملء جميع الحقول المطلوبة');
        }
        if (!isValidEmail(cleanEmail)) {
          throw new Error('صيغة البريد الإلكتروني غير صحيحة');
        }

        await loginWithEmail!(cleanEmail, password);
        setSuccessMessage('تم تسجيل الدخول بنجاح! مرحباً بك.');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          else onClose();
        }, 600);
      } else if (mode === 'register') {
        const cleanName = displayName.trim();
        const cleanPhone = phone.trim();

        if (!cleanName.trim()) {
          throw new Error('يرجى إدخال الاسم الكامل');
        }
        if (!cleanEmail) {
          throw new Error('يرجى إدخال البريد الإلكتروني');
        }
        if (!isValidEmail(cleanEmail)) {
          throw new Error('صيغة البريد الإلكتروني غير صالحة');
        }
        if (cleanPhone && !isValidPhone(cleanPhone)) {
          throw new Error('رقم الهاتف غير صالح، يرجى كتابة أرقام صحيحة');
        }
        if (!password || password.length < 8) {
          throw new Error('كلمة المرور يجب أن تتكون من 8 خانات على الأقل لضمان الأمان');
        }
        if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
          throw new Error('كلمة المرور يجب أن تحتوي على حرف واحد ورقم واحد على الأقل');
        }
        if (password !== confirmPassword) {
          throw new Error('كلمتا المرور غير متطابقتين، يرجى التأكد');
        }

        await registerWithEmail({
          email: cleanEmail,
          pass: password,
          displayName: cleanName,
          phone: cleanPhone,
        });

        setSuccessMessage('تم إنشاء حسابك بنجاح! تم تطبيق خصومات العضوية تلقائياً.');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          else onClose();
        }, 800);
      } else if (mode === 'forgot') {
        if (!cleanEmail) {
          throw new Error('يرجى إدخال البريد الإلكتروني المسجل لدينا');
        }
        if (!isValidEmail(cleanEmail)) {
          throw new Error('صيغة البريد الإلكتروني غير صالحة');
        }
        await resetPassword(cleanEmail);
        setSuccessMessage('إذا كان البريد مسجلاً، تم إرسال تعليمات إعادة تعيين كلمة المرور إليه.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء إتمام العملية. يرجى المحاولة ثانية.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center p-3 sm:p-6 bg-slate-950 items-center">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative text-slate-100 my-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
        id="auth-modal"
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-amber-600/10 blur-[90px] rounded-full pointer-events-none" />

        {/* Close Button Top */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 left-4 sm:top-5 sm:left-5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs font-bold shadow-md z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          aria-label="إغلاق نافذة تسجيل الدخول"
          id="close-auth-modal"
          title="إغلاق نافذة تسجيل الدخول"
        >
          <X className="w-4 h-4" />
          <span>إغلاق</span>
        </button>

        {/* Header Icon & Title */}
        <div className="text-center mb-6">
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-3.5 text-slate-950 shadow-lg shadow-amber-500/20">
            {mode === 'forgot' ? (
              <KeyRound className="w-7 h-7 stroke-[2.2]" />
            ) : mode === 'register' ? (
              <Sparkles className="w-7 h-7 stroke-[2.2]" />
            ) : (
              <User className="w-7 h-7 stroke-[2.2]" />
            )}
          </div>

          <h2 id="auth-modal-title" className="text-xl sm:text-2xl font-black text-white">
            {mode === 'login' && 'تسجيل الدخول'}
            {mode === 'register' && 'إنشاء حساب جديد'}
            {mode === 'forgot' && 'استعادة كلمة المرور'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login' && 'سجّل دخولك بالبريد الإلكتروني للوصول إلى حسابك وإدارة حجوزاتك'}
            {mode === 'register' && 'أنشئ حسابك خلال لحظات لتسهيل تأجير ومتابعة السيارات في دمشق'}
            {mode === 'forgot' && 'أدخل بريدك الإلكتروني لإرسال رابط تعيين كلمة المرور'}
          </p>
        </div>

        {/* Switcher Tabs (Login / Register) */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`min-h-[44px] py-2.5 rounded-xl font-bold text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                mode === 'login'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              id="tab-login-btn"
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`min-h-[44px] py-2.5 rounded-xl font-bold text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                mode === 'register'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              id="tab-register-btn"
            >
              إنشاء حساب
            </button>
          </div>
        )}

        {/* Alert Messages */}
        {errorMessage && (
          <div id="auth-error-alert" aria-live="polite" className="p-3 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Full Name (Register only) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-display-name" className="block text-slate-300 mb-1.5 font-bold">
                الاسم الكامل <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="auth-display-name"
                  type="text"
                  autoComplete="name"
                  value={displayName || ''}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: شادي المحمد"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? 'auth-error-alert' : undefined}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 text-sm"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div>
            <label htmlFor="auth-email" className="block text-slate-300 mb-1.5 font-bold">
              البريد الإلكتروني <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email || ''}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
                aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? 'auth-error-alert' : undefined}
                className="w-full min-h-[44px] bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 text-left text-sm"
                required
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            </div>
          </div>

          {/* Phone Number (Register only) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-phone" className="block text-slate-300 mb-1.5 font-bold">
                رقم الهاتف / الواتساب <span className="text-slate-400 font-normal">(اختياري)</span>
              </label>
              <div className="relative">
                <input
                  id="auth-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone || ''}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0944331774"
                  dir="ltr"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? 'auth-error-alert' : undefined}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 text-left text-sm"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>
          )}

          {/* Password (Login and Register) */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="auth-password" className="text-slate-300 font-bold">
                  كلمة المرور <span className="text-amber-400">*</span>
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                    }}
                    className="text-xs text-amber-400 hover:underline focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password || ''}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? 'auth-error-alert' : undefined}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 pr-10 text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 text-left text-sm"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'register' && (
                <span className="text-xs text-slate-400 mt-1 block">
                  يجب أن تتكون كلمة المرور من 8 خانات على الأقل وتحتوي على حرف ورقم
                </span>
              )}
            </div>
          )}

          {/* Confirm Password (Register only) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-confirm-password" className="block text-slate-300 mb-1.5 font-bold">
                تأكيد كلمة المرور <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword || ''}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? 'auth-error-alert' : undefined}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 pr-10 text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400 text-left text-sm"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                  aria-label={showConfirmPassword ? 'إخفاء تأكيد كلمة المرور' : 'إظهار تأكيد كلمة المرور'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-[44px] mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            id="auth-submit-btn"
          >
            {isLoading ? (
              <span>جاري المعالجة...</span>
            ) : mode === 'login' ? (
              <span>تسجيل الدخول</span>
            ) : mode === 'register' ? (
              <span>إنشاء الحساب وتفعيل الخصم</span>
            ) : (
              <span>إرسال رابط استعادة كلمة المرور</span>
            )}
          </button>

          {/* OR Divider & Google Sign-in (For Login and Register) */}
          {mode !== 'forgot' && (
            <div className="space-y-3 pt-2">
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-xs text-slate-400 font-medium whitespace-nowrap">
                  أو يمكنك المتابعة عبر
                </span>
                <div className="border-t border-slate-800 w-full" />
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2.5 border border-slate-300 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                id="google-auth-btn"
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{mode === 'register' ? 'إنشاء الحساب عبر حساب Google' : 'تسجيل الدخول السريع عبر Google'}</span>
              </button>
            </div>
          )}

          {/* Discount Tip Box */}
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-200/90 mt-3">
            <Tag className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-300 mb-0.5">خصومات حصرية للأعضاء المسجلين:</strong>
              <span>
                عند إنشاء حساب أو تسجيل الدخول، يتم تطبيق خصومات خاصة تصل حتى 25% على تكلفة إيجار سيارتك المختارة فوراً!
              </span>
            </div>
          </div>
        </form>

        {/* Bottom Switcher Links */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-xs text-slate-400">
          {mode === 'login' && (
            <p>
              ليس لديك حساب بعد؟{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMessage(null);
                }}
                className="text-amber-400 hover:underline font-bold mr-1"
              >
                إنشاء حساب جديد
              </button>
            </p>
          )}

          {mode === 'register' && (
            <p>
              لديك حساب بالفعل؟{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                }}
                className="text-amber-400 hover:underline font-bold mr-1"
              >
                تسجيل الدخول
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className="text-slate-400 hover:text-amber-400 flex items-center justify-center gap-1 mx-auto font-bold"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة إلى تسجيل الدخول</span>
            </button>
          )}
        </div>

        {/* Security & Support Note */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-500/70" />
          <span>بياناتك محمية ومحفوظة وفق معايير الخصوصية والأمان</span>
        </div>
      </div>
    </div>
  );
};
