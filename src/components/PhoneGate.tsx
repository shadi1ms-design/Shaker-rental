import React, { useState } from 'react';
import { Phone, LogOut, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Blocking one-time step shown to customers who signed in with Google and have no phone number yet.
 * The number can't be changed afterwards (enforced by Firestore rules).
 */
export const PhoneGate: React.FC = () => {
  const { user, logout, completePhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      await completePhone(phone);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ رقم الهاتف.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="phone-gate"
      className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-cairo"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 text-amber-500">
          <Phone className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-black text-slate-100 mb-2">إكمال التسجيل: رقم الهاتف</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-1">
          أهلاً {user?.displayName || ''}، نحتاج رقم هاتفك للتواصل معك وتأكيد حجوزاتك.
        </p>
        <p className="text-xs text-amber-400 mb-5">لن تتمكن من تغيير الرقم بعد حفظه، فتأكد من صحته.</p>

        {error && (
          <div className="p-2.5 mb-4 rounded-lg text-xs flex items-center gap-2 bg-rose-500/10 text-rose-300 border border-rose-500/30 text-right">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="tel"
            inputMode="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="مثال: +963 933 123 456"
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm font-mono outline-none focus:border-amber-500 transition-all"
            dir="ltr"
          />
          <button
            type="submit"
            disabled={isSaving || phone.replace(/\D/g, '').length < 7}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all disabled:opacity-50"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ ومتابعة'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => logout()}
          className="mt-4 text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1.5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};
