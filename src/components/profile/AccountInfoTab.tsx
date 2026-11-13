import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Shield } from 'lucide-react';
import { VerificationStatus } from '../../types';
import { ProfileRole } from '../../utils/profileRole';
import { isStaffRole } from '../../utils/roles';
import { RoleBadge } from '../common/RoleBadge';
import { ChangePasswordCard } from './ChangePasswordCard';
import { StaffWorkspaceCard } from './StaffWorkspaceCard';
import type { MfaEnrollmentState } from './SecurityTab';

export interface AccountInfoTabProps {
  user: {
    displayName: string;
    email: string;
    phone?: string;
  };
  role: ProfileRole;
  accountTypeLabel: string;
  isEmployee: boolean;
  onOpenAdminView?: () => void;
  userAddress: string;
  onUserAddressChange: (val: string) => void;
  isSavingAddress: boolean;
  addressFeedback: { type: 'success' | 'error'; message: string } | null;
  onSaveAddressSubmit: (e: React.FormEvent) => void;
  currentStatus: VerificationStatus | null;
  canEditCredentials: boolean;
  mfa: MfaEnrollmentState;
}

export const AccountInfoTab: React.FC<AccountInfoTabProps> = ({
  user,
  role,
  accountTypeLabel,
  isEmployee,
  onOpenAdminView,
  userAddress,
  onUserAddressChange,
  isSavingAddress,
  addressFeedback,
  onSaveAddressSubmit,
  currentStatus,
  canEditCredentials,
  mfa,
}) => {
  const isStaff = isStaffRole(role);

  return (
    <div className="space-y-4">
      {isStaff && role !== 'customer' && (
        <StaffWorkspaceCard
          role={role}
          accountTypeLabel={accountTypeLabel}
          isEmployee={isEmployee}
          onOpenAdminView={onOpenAdminView}
        />
      )}

      <div className="p-4 rounded-card bg-slate-950/70 border border-slate-800 space-y-3 text-sm">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <span className="text-slate-400">الاسم الكامل:</span>
          <span className="font-bold text-white">{user.displayName}</span>
        </div>
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <span className="text-slate-400">البريد الإلكتروني:</span>
          <span className="tabular-nums text-white">{user.email}</span>
        </div>
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <span className="text-slate-400">رقم الهاتف:</span>
          <span className="tabular-nums text-white">{user.phone || 'غير محدد'}</span>
        </div>
        <form
          onSubmit={onSaveAddressSubmit}
          className="space-y-2 pb-2 border-b border-slate-800/60"
        >
          <div className="flex items-center justify-between">
            <label htmlFor="user-profile-address" className="text-slate-400 text-sm font-semibold">
              العنوان (اختياري):
            </label>
            <span className={`text-xs font-mono ${userAddress.trim().length >= 20 || userAddress.trim().length === 0 ? 'text-slate-400' : 'text-rose-400'}`}>
              {userAddress.trim().length} / 300 حرف
            </span>
          </div>
          {addressFeedback && (
            <div className={`p-2 rounded-xl text-sm flex items-center gap-2 ${
              addressFeedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
            }`}>
              <span>{addressFeedback.message}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              id="user-profile-address"
              type="text"
              maxLength={300}
              value={userAddress}
              onChange={(e) => onUserAddressChange(e.target.value)}
              placeholder="العنوان بالتفصيل (20 إلى 300 حرف)..."
              className="flex-1 min-h-11 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-base sm:text-sm outline-none focus:border-amber-500 transition-all"
            />
            <button
              type="submit"
              disabled={isSavingAddress}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all disabled:opacity-50 shrink-0 cursor-pointer min-h-11 inline-flex items-center justify-center"
            >
              {isSavingAddress ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
        <div className={`flex items-center justify-between ${isStaff || currentStatus ? 'pb-2 border-b border-slate-800/60' : ''}`}>
          <span className="text-slate-400">نوع الحساب والصلاحية:</span>
          <span className="text-amber-400 font-bold">
            {accountTypeLabel}
          </span>
        </div>
        {isStaff ? (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">شارة الصلاحية:</span>
            <RoleBadge role={role} />
          </div>
        ) : (
          currentStatus && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">حالة توثيق الهوية:</span>
              <div>
                {currentStatus === 'verified' ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>موثق رسمياً ومعتمد</span>
                  </span>
                ) : currentStatus === 'pending_review' ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>قيد المراجعة الإدارية</span>
                  </span>
                ) : currentStatus === 'rejected' ? (
                  <span className="text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>مرفوض - يلزم إعادة الرفع</span>
                  </span>
                ) : (
                  <span className="text-slate-400 font-bold flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-slate-400" />
                    <span>غير موثق بعد</span>
                  </span>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Password Change Sub-form — stays inside AccountInfoTab for customers; moved to SecurityTab for staff */}
      {!isStaff && (
        <ChangePasswordCard
          canEditCredentials={canEditCredentials}
          currentPassword={mfa.currentPassword}
          onCurrentPasswordChange={mfa.setCurrentPassword}
          newPassword={mfa.newPassword}
          onNewPasswordChange={mfa.setNewPassword}
          confirmPassword={mfa.confirmPassword}
          onConfirmPasswordChange={mfa.setConfirmPassword}
          isChangingPassword={mfa.isChangingPassword}
          passwordFeedback={mfa.passwordFeedback}
          onSubmit={mfa.handleChangePasswordSubmit}
        />
      )}
    </div>
  );
};
