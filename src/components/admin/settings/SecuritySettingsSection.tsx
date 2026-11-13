import React from 'react';
import { Shield, CheckCircle2, AlertCircle } from 'lucide-react';

export interface SecuritySettingsSectionProps {
  requireAdminMfa: boolean | null;
  isUpdatingMfaReq: boolean;
  mfaLoadError: boolean;
  mfaReqFeedback: { type: 'success' | 'error'; message: string } | null;
  onToggleAdminMfaRequirement: (nextVal: boolean) => void;
}

export const SecuritySettingsSection: React.FC<SecuritySettingsSectionProps> = ({
  requireAdminMfa,
  isUpdatingMfaReq,
  mfaLoadError,
  mfaReqFeedback,
  onToggleAdminMfaRequirement,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
      <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
        <Shield className="w-4 h-4 text-amber-400" />
        الأمان
      </h4>

      <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="font-extrabold text-white text-sm block">
              فرض المصادقة الثنائية على المدراء
            </span>
            <p className="text-slate-400 text-xs">
              عند التفعيل، يُشترط تسجيل الدخول بالعامل الثاني (Google Authenticator) لتنفيذ عمليات إدارة الصلاحيات وتعطيل أو حذف الحسابات.
            </p>
          </div>

          <div dir="ltr" className="inline-flex items-center">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={requireAdminMfa === true}
                disabled={isUpdatingMfaReq || requireAdminMfa === null}
                onChange={(e) => onToggleAdminMfaRequirement(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 relative dir-ltr peer-disabled:opacity-50"
                dir="ltr"
              />
            </label>
            <span className="ms-3 text-xs font-bold text-slate-300" dir="rtl">
              {mfaLoadError
                ? 'تعذّر تحميل الحالة'
                : requireAdminMfa === null
                ? 'جاري التحميل...'
                : isUpdatingMfaReq
                ? 'جاري التحديث...'
                : requireAdminMfa
                ? 'مفعّل'
                : 'معطّل'}
            </span>
          </div>
        </div>

        {mfaReqFeedback && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              mfaReqFeedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
            }`}
          >
            {mfaReqFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{mfaReqFeedback.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
