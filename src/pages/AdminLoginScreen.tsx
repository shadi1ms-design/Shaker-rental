import React, { useState } from 'react';
import { ArrowRight, KeyRound, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navigate, routes } from '../router';

/** Sign-in screen shown on /admin/* to visitors and non-staff accounts. */
export const AdminLoginScreen: React.FC = () => {
  const { loginWithEmail, loginWithGoogle } = useAuth();

  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);
    setAdminLoginLoading(true);
    try {
      await loginWithEmail(adminEmail, adminPassword);
      navigate(routes.adminDashboard, { replace: true });
    } catch (err: unknown) {
      setAdminLoginError((err instanceof Error && err.message) || 'فشل تسجيل الدخول. يرجى التأكد من البريد وكلمة المرور.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-cairo" dir="rtl">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-inner">
            <Shield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white">تسجيل دخول إدارة شاكر</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            لوحة التحكم الإدارية المعتمدة لشركة شاكر لتأجير السيارات (دمشق - جرمانا)
          </p>
        </div>

        {adminLoginError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {adminLoginError}
          </div>
        )}

        <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">البريد الإلكتروني الإداري</label>
            <input
              type="email"
              value={adminEmail || ''}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="name@example.com"
              required
              dir="ltr"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة المرور</label>
            <input
              type="password"
              value={adminPassword || ''}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••"
              required
              dir="ltr"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={adminLoginLoading}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            {adminLoginLoading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>دخول لوحة التحكم</span>
              </>
            )}
          </button>

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-2.5 text-[10px] text-slate-400 font-medium">أو</span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          <button
            type="button"
            onClick={async () => {
              setAdminLoginError(null);
              setAdminLoginLoading(true);
              try {
                if (typeof loginWithGoogle === 'function') {
                  await loginWithGoogle();
                }
              } catch (err: unknown) {
                setAdminLoginError((err instanceof Error && err.message) || 'تعذر تسجيل الدخول الإداري عبر Google.');
              } finally {
                setAdminLoginLoading(false);
              }
            }}
            disabled={adminLoginLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 border border-slate-300 disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
            <span>دخول إداري معتمد عبر Google</span>
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={() => navigate(routes.home)}
            className="w-full py-2 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>العودة للموقع الرئيسي</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
