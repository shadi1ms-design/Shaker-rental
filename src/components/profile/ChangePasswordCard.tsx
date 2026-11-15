import React from 'react';
import { Lock, Key, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ChangePasswordCardProps {
  canEditCredentials: boolean;
  currentPassword: string;
  onCurrentPasswordChange: (val: string) => void;
  newPassword: string;
  onNewPasswordChange: (val: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (val: string) => void;
  isChangingPassword: boolean;
  passwordFeedback: { type: 'success' | 'error'; message: string } | null;
  onSubmit: (e: React.FormEvent) => void;
}

export const ChangePasswordCard: React.FC<ChangePasswordCardProps> = ({
  canEditCredentials,
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  isChangingPassword,
  passwordFeedback,
  onSubmit,
}) => {
  return (
    <div className="p-4 rounded-card bg-slate-950/70 border border-slate-800 space-y-4 text-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
        <Lock className="w-4 h-4 text-amber-400 shrink-0" />
        <h3 className="font-extrabold text-white text-sm">الأمان وكلمة المرور</h3>
      </div>

      {!canEditCredentials ? (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-sm flex items-start gap-2">
          <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-300 block mb-0.5">حساب طاقم العمل الإداري</span>
            <span>بيانات حسابات الموظفين تُدار مركزياً من قبل المدير العام حصراً.</span>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          {passwordFeedback && (
            <div
              className={`p-2.5 rounded-xl text-sm flex items-center gap-2 ${
                passwordFeedback.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}
            >
              {passwordFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{passwordFeedback.message}</span>
            </div>
          )}

          <div>
            <label htmlFor="user-profile-current-pass" className="text-sm text-slate-400 block mb-1">
              كلمة المرور الحالية
            </label>
            <input
              id="user-profile-current-pass"
              type="password"
              value={currentPassword}
              onChange={(e) => onCurrentPasswordChange(e.target.value)}
              placeholder="••••••••"
              className="w-full min-h-11 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-400 text-base sm:text-sm tabular-nums outline-none focus:border-amber-500 transition-all"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label htmlFor="user-profile-new-pass" className="text-sm text-slate-400 block mb-1">
                كلمة المرور الجديدة
              </label>
              <input
                id="user-profile-new-pass"
                type="password"
                value={newPassword}
                onChange={(e) => onNewPasswordChange(e.target.value)}
                placeholder="6 أحرف على الأقل"
                className="w-full min-h-11 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-400 text-base sm:text-sm tabular-nums outline-none focus:border-amber-500 transition-all"
                dir="ltr"
              />
            </div>

            <div>
              <label htmlFor="user-profile-confirm-pass" className="text-sm text-slate-400 block mb-1">
                تأكيد كلمة المرور
              </label>
              <input
                id="user-profile-confirm-pass"
                type="password"
                value={confirmPassword}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                placeholder="إعادة إدخال الجديدة"
                className="w-full min-h-11 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-400 text-base sm:text-sm tabular-nums outline-none focus:border-amber-500 transition-all"
                dir="ltr"
              />
            </div>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="submit"
              disabled={isChangingPassword || !currentPassword || !newPassword}
              className="px-4 py-2 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Key className="w-4 h-4" />
              <span>{isChangingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
