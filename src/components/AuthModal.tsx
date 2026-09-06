import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
  KeyRound
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const { loginWithEmail, registerWithEmail, resetPassword } = useAuth();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password.trim()) {
          throw new Error('يرجى ملء جميع الحقول المطلوبة');
        }
        await loginWithEmail(email, password);
        setSuccessMessage('تم تسجيل الدخول بنجاح! مرحباً بك.');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 600);
      } else if (mode === 'register') {
        if (!displayName.trim()) {
          throw new Error('يرجى إدخال الاسم الكامل');
        }
        if (!email.trim()) {
          throw new Error('يرجى إدخال البريد الإلكتروني');
        }
        if (!password.trim() || password.length < 6) {
          throw new Error('كلمة المرور يجب أن تتكون من 6 خانات أو أكثر');
        }
        if (password !== confirmPassword) {
          throw new Error('كلمتا المرور غير متطابقتين، يرجى التأكد');
        }

        await registerWithEmail({
          email,
          pass: password,
          displayName,
          phone,
        });

        setSuccessMessage('تم إنشاء حسابك بنجاح! تم تسجيل دخولك تلقائياً.');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 800);
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          throw new Error('يرجى إدخال البريد الإلكتروني المسجل لدينا');
        }
        await resetPassword(email);
        setSuccessMessage('إذا كان البريد مسجلاً، تم إرسال تعليمات إعادة تعيين كلمة المرور إليه.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء إتمام العملية. يرجى المحاولة ثانية.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
        id="auth-modal"
      >
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-amber-600/10 blur-[90px] rounded-full pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          aria-label="إغلاق"
          id="close-auth-modal"
        >
          <X className="w-5 h-5" />
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

          <h2 className="text-xl sm:text-2xl font-black text-white">
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
              className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
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
              className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
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
          <div className="p-3 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
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
              <label className="block text-slate-300 mb-1.5 font-bold">
                الاسم الكامل <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: شادي المحمد"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  required
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-slate-300 mb-1.5 font-bold">
              البريد الإلكتروني <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                dir="ltr"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-left"
                required
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
          </div>

          {/* Phone Number (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-slate-300 mb-1.5 font-bold">
                رقم الهاتف / الواتساب <span className="text-slate-500 font-normal">(اختياري)</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0944331774"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-left"
                />
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>
          )}

          {/* Password (Login and Register) */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-bold">
                  كلمة المرور <span className="text-amber-400">*</span>
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                    }}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-left"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                  aria-label="إظهار كلمة المرور"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'register' && (
                <span className="text-[10px] text-slate-500 mt-1 block">
                  يجب أن تكون كلمة المرور 6 خانات على الأقل
                </span>
              )}
            </div>
          )}

          {/* Confirm Password (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-slate-300 mb-1.5 font-bold">
                تأكيد كلمة المرور <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 pl-10 pr-10 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-left"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                  aria-label="إظهار تأكيد كلمة المرور"
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
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            id="auth-submit-btn"
          >
            {isLoading ? (
              <span>جاري المعالجة...</span>
            ) : mode === 'login' ? (
              <span>تسجيل الدخول</span>
            ) : mode === 'register' ? (
              <span>إنشاء الحساب والمتابعة</span>
            ) : (
              <span>إرسال رابط استعادة كلمة المرور</span>
            )}
          </button>
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
