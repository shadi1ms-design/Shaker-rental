import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Booking, VerificationStatus } from '../types';
import { isUserVerified } from '../utils/verification';
import {
  getCustomerDefaultTab,
  getProfileRoleLabels,
  getProfileTabs,
  ProfileTabId,
  resolveProfileRole,
} from '../utils/profileRole';
import { isStaffRole } from '../utils/roles';
import { RoleBadge } from './common/RoleBadge';
import {
  User,
  Car,
  LogOut,
  Shield,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useMfaEnrollment } from '../hooks/useMfaEnrollment';
import { useProfileVerification } from '../hooks/useProfileVerification';
import { useCustomerBookings } from '../hooks/useCustomerBookings';
import { useLiveProfile } from '../hooks/useLiveProfile';
import { HeaderVerificationBadge, VerificationTab } from './profile/VerificationTab';
import { BookingsTab } from './profile/BookingsTab';
import { AccountInfoTab } from './profile/AccountInfoTab';
import { SecurityTab } from './profile/SecurityTab';

export interface ProfileViewProps {
  isOpen: boolean;
  bookings: Booking[];
  onClose: () => void;
  onOpenBooking: () => void;
  onOpenAdminView?: () => void;
}

export type UserProfileModalProps = ProfileViewProps;

export const ProfileView: React.FC<ProfileViewProps> = ({
  isOpen,
  bookings,
  onClose,
  onOpenBooking,
  onOpenAdminView,
}) => {
  const modalRef = useFocusTrap({ isOpen, onClose, trapTab: false });
  const { user, logout, isSuperAdmin, isAdmin, isEmployee } = useAuth();

  const role = resolveProfileRole({ isSuperAdmin, isAdmin, isEmployee });
  const isStaff = isStaffRole(role);
  const roleLabels = getProfileRoleLabels(role);

  const { tabs, defaultTab } = useMemo(() => getProfileTabs(role), [role]);
  const [activeTab, setActiveTab] = useState<ProfileTabId>(defaultTab);
  const [prevRole, setPrevRole] = useState(role);
  if (role !== prevRole) {
    setPrevRole(role);
    setActiveTab(getProfileTabs(role).defaultTab);
  }

  const hasUserSelectedTabRef = useRef(false);
  const hasAppliedDefaultTabRef = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    return () => {
      hasUserSelectedTabRef.current = false;
      hasAppliedDefaultTabRef.current = false;
    };
  }, [isOpen]);

  const shouldLoadCustomerData = role === 'customer';
  const canEditCredentials = !isEmployee || isSuperAdmin;

  const profileData = useLiveProfile({ isOpen, user });
  const mfa = useMfaEnrollment({ isOpen, user, isSuperAdmin, isAdmin });
  const verification = useProfileVerification({
    isOpen,
    enabled: shouldLoadCustomerData,
    userId: user?.uid,
  });
  const bookingsHook = useCustomerBookings({
    isOpen,
    enabled: shouldLoadCustomerData,
    user,
    bookings,
  });

  // Only compute verification status for customers
  const isVerified = shouldLoadCustomerData
    ? isUserVerified(profileData.liveProfile) || isUserVerified(user)
    : false;
  const currentStatus: VerificationStatus | null = shouldLoadCustomerData
    ? verification.verificationRequest?.status || (isVerified ? 'verified' : 'not_started')
    : null;

  // Smart default tab for customers only: once verificationLoaded settles, switch once unless user already chose a tab
  useEffect(() => {
    if (role !== 'customer' || !verification.verificationLoaded || !currentStatus) return;
    queueMicrotask(() => {
      if (!hasUserSelectedTabRef.current && !hasAppliedDefaultTabRef.current) {
        hasAppliedDefaultTabRef.current = true;
        setActiveTab(getCustomerDefaultTab(currentStatus));
      }
    });
  }, [role, verification.verificationLoaded, currentStatus]);

  if (!isOpen || !user) return null;

  const handleSelectTab = (tab: ProfileTabId) => {
    hasUserSelectedTabRef.current = true;
    setActiveTab(tab);
  };

  return (
    <div className="flex items-start justify-center p-3 sm:p-6 bg-slate-950">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="user-profile-modal-title"
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-modal p-5 sm:p-8 shadow-2xl relative overflow-clip text-slate-100"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
        id="user-profile-modal"
      >
        <div className="absolute -top-24 -start-24 w-52 h-52 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-lg">
              {user.displayName.charAt(0) || <User className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="user-profile-modal-title" className="text-lg sm:text-xl font-extrabold text-white">{user.displayName}</h2>
                {isStaff ? (
                  <RoleBadge role={role} />
                ) : (
                  <>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                      {roleLabels.badge}
                    </span>
                    <HeaderVerificationBadge
                      verificationLoaded={verification.verificationLoaded}
                      profileLoaded={profileData.profileLoaded}
                      isVerified={isVerified}
                      currentStatus={currentStatus}
                    />
                  </>
                )}
              </div>
              <span className="text-sm text-slate-400 block tabular-nums">{user.email}</span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-4 pb-2 border-b border-slate-800/60">
          {tabs.map((tabId) => {
            const isActive = activeTab === tabId;
            const cls = `px-4 py-2 min-h-11 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
              isActive
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`;

            if (tabId === 'verification') {
              return (
                <button key={tabId} onClick={() => handleSelectTab('verification')} className={cls}>
                  <ShieldCheck className="w-4 h-4" />
                  <span>توثيق الحساب</span>
                  {currentStatus === 'verified' && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                  {currentStatus === 'pending_review' && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                </button>
              );
            }
            if (tabId === 'bookings') {
              return (
                <button key={tabId} onClick={() => handleSelectTab('bookings')} className={cls}>
                  <Car className="w-4 h-4" />
                  <span>حجوزاتي ({bookingsHook.userBookings.length})</span>
                </button>
              );
            }
            if (tabId === 'security') {
              return (
                <button key={tabId} onClick={() => handleSelectTab('security')} className={cls}>
                  <Lock className="w-4 h-4" />
                  <span>الأمان</span>
                </button>
              );
            }
            return (
              <button key={tabId} onClick={() => handleSelectTab('profile')} className={cls}>
                <User className="w-4 h-4" />
                <span>{isStaff ? 'حسابي' : 'بيانات الحساب والأمان'}</span>
              </button>
            );
          })}

          {isEmployee && onOpenAdminView && (
            <button
              onClick={() => onOpenAdminView()}
              className="ms-auto min-h-11 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-sm font-extrabold flex items-center gap-1.5 transition-all shadow-sm"
              title="الانتقال إلى لوحة تحكم المشرف"
            >
              <Shield className="w-4 h-4" />
              <span>لوحة المشرف</span>
            </button>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="py-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {activeTab === 'verification' && shouldLoadCustomerData && currentStatus && (
            <VerificationTab
              currentStatus={currentStatus}
              verificationRequest={verification.verificationRequest}
              identityChoice={verification.identityChoice}
              onIdentityChoiceChange={verification.setIdentityChoice}
              capturedDocs={verification.capturedDocs}
              activeCameraSlot={verification.activeCameraSlot}
              onActiveCameraSlotChange={verification.setActiveCameraSlot}
              isUploadingDoc={verification.isUploadingDoc}
              isSubmittingRequest={verification.isSubmittingRequest}
              verificationError={verification.verificationError}
              verificationSuccessNotice={verification.verificationSuccessNotice}
              isRestartingVerification={verification.isRestartingVerification}
              onSlotCapture={verification.handleSlotCapture}
              onFinalSubmit={verification.handleFinalSubmit}
              onRestartVerification={verification.handleRestartVerification}
              onOpenBooking={onOpenBooking}
            />
          )}

          {activeTab === 'bookings' && shouldLoadCustomerData && (
            <BookingsTab
              sortedBookings={bookingsHook.sortedBookings}
              directCustomerBookings={bookingsHook.directCustomerBookings}
              bookingsTimedOut={bookingsHook.bookingsTimedOut}
              bookingsError={bookingsHook.bookingsError}
              isRetryingBookings={bookingsHook.isRetryingBookings}
              onRetryBookings={bookingsHook.handleRetryBookings}
              cancelTarget={bookingsHook.cancelTarget}
              onCancelTargetChange={bookingsHook.setCancelTarget}
              isCancelling={bookingsHook.isCancelling}
              cancelError={bookingsHook.cancelError}
              onClearCancelError={() => bookingsHook.setCancelError(null)}
              onConfirmCancel={bookingsHook.handleConfirmCancel}
              onOpenBooking={onOpenBooking}
            />
          )}

          {activeTab === 'profile' && (
            <AccountInfoTab
              user={user}
              role={role}
              accountTypeLabel={roleLabels.accountType}
              isEmployee={isEmployee}
              onOpenAdminView={onOpenAdminView}
              userAddress={profileData.userAddress}
              onUserAddressChange={profileData.setUserAddress}
              isSavingAddress={profileData.isSavingAddress}
              addressFeedback={profileData.addressFeedback}
              onSaveAddressSubmit={profileData.handleSaveAddressSubmit}
              currentStatus={currentStatus}
              canEditCredentials={canEditCredentials}
              mfa={mfa}
            />
          )}

          {activeTab === 'security' && isStaff && (
            <SecurityTab
              showMfaCard={isAdmin || isSuperAdmin}
              canEditCredentials={canEditCredentials}
              mfa={mfa}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="flex items-center gap-1.5 min-h-11 text-sm text-rose-400 hover:text-rose-300 font-bold px-3 py-2 rounded-xl hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج من الحساب</span>
          </button>
        </div>

        {/* Reauthentication MFA Modal */}
        {mfa.reauthResolver && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reauth-mfa-modal-title"
            onClick={(e) => {
              if (e.target === e.currentTarget && !mfa.reauthLoading) {
                mfa.handleCancelMfaReauth();
              }
            }}
          >
            <div
              className="bg-slate-900 border border-slate-800 rounded-modal p-6 sm:p-7 max-w-md w-full shadow-2xl relative space-y-4 text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 id="reauth-mfa-modal-title" className="text-base font-extrabold text-white">
                    تأكيد الهوية عبر Authenticator
                  </h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {mfa.reauthPendingAction?.type === 'unenroll'
                      ? 'مطلوب تأكيد الهوية لإلغاء تفعيل المصادقة الثنائية'
                      : 'مطلوب تأكيد الهوية لإتمام تحديث كلمة المرور'}
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                حسابك محمي بالمصادقة الثنائية. يرجى إدخال رمز التحقق المكوّن من 6 أرقام من تطبيق Google Authenticator لمتابعة العملية:
              </p>

              {mfa.reauthError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{mfa.reauthError}</span>
                </div>
              )}

              <form onSubmit={mfa.handleResolveMfaReauth} className="space-y-4">
                <div>
                  <label htmlFor="reauth-totp-code" className="block text-sm font-bold text-slate-300 mb-1.5">
                    رمز التحقق (6 أرقام):
                  </label>
                  <input
                    id="reauth-totp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={mfa.reauthTotpCode}
                    onChange={(e) => mfa.setReauthTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    dir="ltr"
                    required
                    className="w-full min-h-11 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-center font-mono text-xl tracking-widest outline-none focus:border-amber-500 transition-all placeholder:text-slate-700"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={mfa.reauthLoading || mfa.reauthTotpCode.length !== 6}
                    className="flex-1 min-h-11 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
                  >
                    {mfa.reauthLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري التحقق...</span>
                      </>
                    ) : (
                      <span>تأكيد ومتابعة العملية</span>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={mfa.reauthLoading}
                    onClick={mfa.handleCancelMfaReauth}
                    className="px-4 py-2.5 min-h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileView;
