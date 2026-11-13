import React, { useState } from 'react';
import { Phone, LogOut, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PhoneInput } from './ui/PhoneInput';
import { isValidPhone } from '../utils/phone';

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
    if (!isValidPhone(phone)) {
      setError('رقم الهاتف يجب ألا يقل عن 9 أرقام.');
      return;
    }
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
      className="min-h-dvh bg-slate-950 flex items-center justify-center p-4 font-cairo"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-card p-6 sm:p-8 shadow-2xl text-center">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mx-auto mb-5 text-amber-500">
          <Phone className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-extrabold text-slate-100 mb-2">إكمال التسجيل: رقم الهاتف</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-1">
          أهلاً {user?.displayName || ''}، نحتاج رقم هاتفك للتواصل معك وتأكيد حجوزاتك.
        </p>
        <p className="text-sm text-amber-400 mb-5">لن تتمكن من تغيير الرقم بعد حفظه، فتأكد من صحته.</p>

        {error && (
          <div className="p-2.5 mb-4 rounded-xl text-sm flex items-center gap-2 bg-rose-500/10 text-rose-300 border border-rose-500/30 text-start">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PhoneInput
            id="gate-phone"
            name="phone"
            value={phone}
            onChange={setPhone}
            autoFocus
            required
            placeholder="9331234567"
          />
          <button
            type="submit"
            disabled={isSaving || !isValidPhone(phone)}
            className="w-full min-h-11 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ ومتابعة'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => logout()}
          className="mt-4 min-h-11 px-4 text-sm text-slate-400 hover:text-slate-300 inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};
