import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Booking, FirestoreUser, VerificationRequest, IdentityDocChoice, DocQualityMetric } from '../types';
import { dataService } from '../services/dataService';
import { functionsService } from '../services/functionsService';
import {
  User,
  Clock,
  Car,
  CheckCircle2,
  LogOut,
  MessageCircle,
  FileText,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  Lock,
  Key,
  Camera,
  Send,
} from 'lucide-react';
import { openWhatsAppChat } from '../services/whatsapp';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { CameraCapture } from './CameraCapture';

interface UserProfileModalProps {
  isOpen: boolean;
  bookings: Booking[];
  onClose: () => void;
  onOpenBooking: () => void;
  onOpenAdminView?: () => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  bookings,
  onClose,
  onOpenBooking,
  onOpenAdminView,
}) => {
  const modalRef = useFocusTrap({ isOpen, onClose, trapTab: false });
  const { user, logout, isSuperAdmin, isAdmin, isEmployee, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'bookings' | 'verification'>('verification');
  const [liveProfile, setLiveProfile] = useState<FirestoreUser | null>(null);

  // Unified Verification Request State (Single Source of Truth)
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [identityChoice, setIdentityChoice] = useState<IdentityDocChoice>('national_id');
  const [capturedDocs, setCapturedDocs] = useState<{
    driver_license?: { file: File; quality: DocQualityMetric; uploaded: boolean };
    identity?: { file: File; quality: DocQualityMetric; uploaded: boolean };
  }>({});
  const [activeCameraSlot, setActiveCameraSlot] = useState<'driver_license' | 'identity' | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccessNotice, setVerificationSuccessNotice] = useState<string | null>(null);

  // Bookings state
  const [directCustomerBookings, setDirectCustomerBookings] = useState<Booking[] | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canEditCredentials = !isEmployee || isSuperAdmin;

  // Real-time subscription to customer bookings
  useEffect(() => {
    if (!isOpen || !user?.uid) {
      setDirectCustomerBookings(null);
      return;
    }
    const unsubscribe = dataService.subscribeToCustomerBookings(user.uid, (customerBookings) => {
      setDirectCustomerBookings(customerBookings);
    });
    return () => unsubscribe();
  }, [isOpen, user?.uid]);

  // Real-time subscription to verificationRequest
  useEffect(() => {
    if (!isOpen || !user?.uid) {
      setVerificationRequest(null);
      return;
    }
    const unsubscribe = dataService.subscribeToVerificationRequest(user.uid, (req) => {
      setVerificationRequest(req);
      if (req?.identityDocType) {
        setIdentityChoice(req.identityDocType);
      }
    });
    return () => unsubscribe();
  }, [isOpen, user?.uid]);

  // Load live user profile
  useEffect(() => {
    if (!isOpen || !user?.uid) return;
    dataService.getUserProfile(user.uid).then((p) => {
      if (p) setLiveProfile(p);
    }).catch(() => {});
  }, [isOpen, user?.uid]);

  // Handle live photo capture from camera
  const handleSlotCapture = async (file: File, quality: DocQualityMetric) => {
    const slot = activeCameraSlot;
    if (!user || !slot) return;

    setIsUploadingDoc(true);
    setVerificationError(null);
    setVerificationSuccessNotice(null);

    try {
      // 1. Initiate 5-minute single-use secure session
      const sessionRes = await functionsService.initiateVerificationSession();
      if (!sessionRes.success || !sessionRes.data) {
        throw new Error(sessionRes.error || 'تعذر بدء جلسة تصوير آمنة، يرجى المحاولة ثانية.');
      }
      const { sessionId, nonce } = sessionRes.data;

      // 2. Convert captured canvas blob to Base64
      const base64Data = await fileToBase64(file);

      // 3. Upload to server-authoritative intake
      const submitDocRes = await functionsService.submitVerificationDocument({
        sessionId,
        nonce,
        docKey: slot,
        base64Data,
        mimeType: 'image/jpeg',
        clientQuality: {
          width: quality.width,
          height: quality.height,
          blurScore: quality.blurScore,
          brightness: quality.brightness ?? 128,
        },
      });

      if (!submitDocRes.success) {
        throw new Error(submitDocRes.error || 'فشل فحص الوثيقة أو لم تطابق معايير الأمان.');
      }

      setCapturedDocs((prev) => ({
        ...prev,
        [slot]: { file, quality, uploaded: true },
      }));

      setVerificationSuccessNotice(
        slot === 'driver_license'
          ? 'تم التقاط وفحص شهادة القيادة بنجاح.'
          : 'تم التقاط وفحص وثيقة إثبات الشخصية بنجاح.'
      );
    } catch (err: unknown) {
      console.error('Error submitting verification document:', err);
      setVerificationError(err instanceof Error ? err.message : 'تعذر رفع الوثيقة، يرجى إعادة المحاولة.');
    } finally {
      setIsUploadingDoc(false);
      setActiveCameraSlot(null);
    }
  };

  // Submit full verification request for admin review
  const handleFinalSubmit = async () => {
    if (!user) return;
    setIsSubmittingRequest(true);
    setVerificationError(null);
    setVerificationSuccessNotice(null);

    try {
      const res = await functionsService.submitVerificationRequest({
        identityDocType: identityChoice,
      });

      if (!res.success) {
        throw new Error(res.error || 'تعذر إرسال طلب التوثيق للمراجعة.');
      }

      setVerificationSuccessNotice('تم إرسال طلب التوثيق بنجاح، وهو الآن قيد التدقيق الإداري من قبل فريق العمل.');
    } catch (err: unknown) {
      console.error('Submit verification request error:', err);
      setVerificationError(err instanceof Error ? err.message : 'تعذر إرسال طلب التوثيق.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Reset verification for rejected status to start fresh
  const handleRestartVerification = () => {
    setCapturedDocs({});
    setVerificationError(null);
    setVerificationSuccessNotice(null);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', message: 'يرجى إدخال كلمة المرور الحالية.' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'يجب أن تتكون كلمة المرور الجديدة من 6 أحرف أو أرقام على الأقل.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'كلمتا المرور غير متطابقتين.' });
      return;
    }

    try {
      setIsChangingPassword(true);
      await changePassword(currentPassword, newPassword);
      setPasswordFeedback({ type: 'success', message: 'تم تحديث كلمة المرور بنجاح.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      console.error('Password change error:', err);
      let msg = 'تعذر تغيير كلمة المرور.';
      if (err instanceof Error) {
        const authErr = err as { code?: string };
        if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
          msg = 'كلمة المرور الحالية غير صحيحة.';
        } else if (authErr.code === 'auth/weak-password') {
          msg = 'كلمة المرور الجديدة ضعيفة جداً.';
        } else {
          msg = err.message;
        }
      }
      setPasswordFeedback({ type: 'error', message: msg });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const userBookings = useMemo(() => {
    if (!user) return [];
    const sourceBookings = directCustomerBookings ?? bookings;
    return sourceBookings.filter((b) => {
      if (user.uid && b.customerId === user.uid) return true;
      if (user.email && b.customerEmail && b.customerEmail.toLowerCase() === user.email.toLowerCase()) return true;
      if (user.phone && b.customerPhone && user.phone.replace(/\D/g, '') && b.customerPhone.replace(/\D/g, '').includes(user.phone.replace(/\D/g, ''))) return true;
      if (b.customerName && user.displayName && b.customerName.trim().toLowerCase() === user.displayName.trim().toLowerCase()) return true;
      return false;
    });
  }, [directCustomerBookings, bookings, user]);

  if (!isOpen || !user) return null;

  // Resolve current verification status: single source of truth is verificationRequest.status
  const currentStatus = verificationRequest?.status || (liveProfile?.verificationStatus === 'verified' ? 'verified' : 'not_started');

  // Are both documents ready for submission?
  const hasDriverLicense = Boolean(verificationRequest?.docs?.driver_license || capturedDocs.driver_license?.uploaded);
  const hasIdentityDoc = Boolean(verificationRequest?.docs?.identity || capturedDocs.identity?.uploaded);
  const canSubmitVerification = hasDriverLicense && hasIdentityDoc && currentStatus !== 'pending_review' && currentStatus !== 'verified';

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center p-3 sm:p-6 bg-slate-950">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="user-profile-modal-title"
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-clip text-slate-100"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
        id="user-profile-modal"
      >
        {/* Ambient Glow */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />

        {/* Header - Note: close button was deliberately removed per User Request 4 */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-lg">
              {user.displayName.charAt(0) || <User className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="user-profile-modal-title" className="text-lg sm:text-xl font-black text-white">{user.displayName}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                  {isSuperAdmin ? 'المدير العام' : isAdmin ? 'مسؤول النظام' : 'عميل شاكر'}
                </span>
                {currentStatus === 'verified' ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>موثق الهوية</span>
                  </span>
                ) : currentStatus === 'pending_review' ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>قيد المراجعة</span>
                  </span>
                ) : currentStatus === 'rejected' ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-400" />
                    <span>مرفوض التوثيق</span>
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold border border-slate-700 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-slate-400" />
                    <span>غير موثق</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 block font-mono">{user.email}</span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-4 pb-2 border-b border-slate-800/60">
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'verification'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>توثيق الحساب</span>
            {currentStatus === 'verified' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
            {currentStatus === 'pending_review' && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'bookings'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>حجوزاتي ({userBookings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>بيانات الحساب والأمان</span>
          </button>

          {isAdmin && onOpenAdminView && (
            <button
              onClick={() => {
                onClose();
                onOpenAdminView();
              }}
              className="mr-auto px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
              title="الانتقال إلى لوحة تحكم المشرف (Admin View)"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>لوحة المشرف</span>
            </button>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="py-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* TAB 1: VERIFICATION (توثيق الحساب) */}
          {activeTab === 'verification' && (
            <div className="space-y-4">
              {/* Feedback messages */}
              {verificationError && (
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{verificationError}</span>
                </div>
              )}

              {verificationSuccessNotice && (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{verificationSuccessNotice}</span>
                </div>
              )}

              {/* STATE A: VERIFIED */}
              {currentStatus === 'verified' && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">حسابك موثق رسمياً ومعتمد</h3>
                      <p className="text-xs text-emerald-300/80">
                        تم التحقق من رخصة القيادة والهوية بنجاح، يمكنك الآن حجز أي سيارة من الأسطول مباشرة.
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20 text-slate-300">
                      <span className="text-[11px] text-slate-400 block mb-0.5">تاريخ التوثيق:</span>
                      <span className="font-mono text-emerald-300">
                        {verificationRequest?.reviewedAt
                          ? new Date(verificationRequest.reviewedAt).toLocaleDateString('ar-SY')
                          : 'معتمد'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20 text-slate-300">
                      <span className="text-[11px] text-slate-400 block mb-0.5">وثيقة إثبات الشخصية:</span>
                      <span className="text-emerald-300 font-bold">
                        {verificationRequest?.identityDocType === 'passport' ? 'جواز السفر' : 'الهوية الشخصية'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => {
                        onClose();
                        onOpenBooking();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                    >
                      <Car className="w-4 h-4" />
                      <span>تصفح الأسطول واحجز سيارتك</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STATE B: PENDING REVIEW */}
              {currentStatus === 'pending_review' && (
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-amber-500/40 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 animate-pulse">
                      <Clock className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">طلب التوثيق قيد المراجعة الإدارية</h3>
                      <p className="text-xs text-amber-300/80">
                        تم استلام وثائقك بنجاح وجاري فحصها من قبل إدارة شاكر لتأجير السيارات في دمشق.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">تاريخ تقديم الطلب:</span>
                      <span className="font-mono text-white">
                        {verificationRequest?.submittedAt
                          ? new Date(verificationRequest.submittedAt).toLocaleString('ar-SY')
                          : 'اليوم'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">نوع وثيقة الإثبات:</span>
                      <span className="font-bold text-amber-400">
                        {verificationRequest?.identityDocType === 'passport' ? 'جواز السفر' : 'الهوية الشخصية'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">حالة المستندات:</span>
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>محفوظة ومقفلة للأمان</span>
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 leading-relaxed">
                    🔒 <strong className="font-bold">حماية وتأمين البيانات:</strong> تبقى الوثائق مشفرة في مساحة التدقيق ولا يمكن حذفها أو استبدالها أثناء سريان المراجعة حرصاً على مصداقية وسرعة التدقيق.
                  </div>
                </div>
              )}

              {/* STATE C: REJECTED */}
              {currentStatus === 'rejected' && (
                <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                      <ShieldAlert className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-rose-200">تم رفض طلب التوثيق</h3>
                      <p className="text-xs text-rose-300/80">
                        يرجى مراجعة سبب الرفض وإعادة تصوير الوثائق المطلوبة بدقة ووضوح.
                      </p>
                    </div>
                  </div>

                  {verificationRequest?.rejectionReason && (
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-rose-500/30 text-xs">
                      <span className="text-[11px] text-rose-400 font-bold block mb-1">سبب الرفض المسجل من الإدارة:</span>
                      <p className="text-white font-medium">{verificationRequest.rejectionReason}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleRestartVerification}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>بدء محاولة توثيق جديدة</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STATE D: NOT STARTED / INTAKE FORM */}
              {(currentStatus === 'not_started' || (currentStatus === 'rejected' && Object.keys(capturedDocs).length > 0)) && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
                    <div className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>خطوات توثيق الحساب (إلزامية لحجز السيارات):</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      وفقاً لشروط تأجير السيارات في سوريا، يلزم توثيق الحساب بصورتين حصراً تم التقاطهما مباشرة بالكاميرا:
                      <strong className="text-white font-bold"> شهادة القيادة</strong> + <strong className="text-white font-bold">الهوية الشخصية أو جواز السفر</strong>.
                    </p>
                  </div>

                  {/* Document Choice Selector (National ID vs Passport) */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-white block">
                      اختر وثيقة إثبات الشخصية الثانية:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIdentityChoice('national_id')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                          identityChoice === 'national_id'
                            ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>الهوية الشخصية (الوجه الأمامي)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIdentityChoice('passport')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                          identityChoice === 'passport'
                            ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>جواز السفر (صفحة البيانات)</span>
                      </button>
                    </div>
                  </div>

                  {/* Document Slots Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* SLOT 1: DRIVER LICENSE */}
                    <div className={`p-4 rounded-2xl border flex flex-col items-center text-center gap-3 transition-all ${
                      hasDriverLicense
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}>
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                        hasDriverLicense
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-amber-400'
                      }`}>
                        {hasDriverLicense ? <CheckCircle2 className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-white">شهادة القيادة (إلزامي)</h4>
                        <p className="text-[11px] text-slate-400 mt-1">صوّر الوجه الأمامي لشهادة القيادة بوضوح تام</p>
                      </div>

                      {hasDriverLicense ? (
                        <div className="w-full space-y-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تم الالتقاط بنجاح</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveCameraSlot('driver_license')}
                            className="w-full px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>إعادة التصوير</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveCameraSlot('driver_license')}
                          disabled={isUploadingDoc}
                          className="w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                        >
                          <Camera className="w-4 h-4" />
                          <span>التقاط بالكاميرا</span>
                        </button>
                      )}
                    </div>

                    {/* SLOT 2: IDENTITY DOC (NATIONAL ID OR PASSPORT) */}
                    <div className={`p-4 rounded-2xl border flex flex-col items-center text-center gap-3 transition-all ${
                      hasIdentityDoc
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}>
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${
                        hasIdentityDoc
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-amber-400'
                      }`}>
                        {hasIdentityDoc ? <CheckCircle2 className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                      </div>

                      <div>
                        <h4 className="text-sm font-black text-white">
                          {identityChoice === 'passport' ? 'جواز السفر' : 'الهوية الشخصية'}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {identityChoice === 'passport' ? 'صوّر صفحة البيانات الشخصية في الجواز' : 'صوّر الوجه الأمامي للبطاقة بوضوح'}
                        </p>
                      </div>

                      {hasIdentityDoc ? (
                        <div className="w-full space-y-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تم الالتقاط بنجاح</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveCameraSlot('identity')}
                            className="w-full px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>إعادة التصوير</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveCameraSlot('identity')}
                          disabled={isUploadingDoc}
                          className="w-full px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                        >
                          <Camera className="w-4 h-4" />
                          <span>التقاط بالكاميرا</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Submission CTA Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={!canSubmitVerification || isSubmittingRequest}
                      onClick={handleFinalSubmit}
                      className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98"
                    >
                      {isSubmittingRequest ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري إرسال الطلب واعتماد الوثائق...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>إرسال طلب التوثيق للمراجعة الإدارية</span>
                        </>
                      )}
                    </button>
                    {!canSubmitVerification && (
                      <p className="text-[11px] text-slate-400 text-center mt-2">
                        يجب إكمال تصوير شهادة القيادة ووثيقة إثبات الشخصية لتفعيل زر الإرسال.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Camera Modal component */}
              <CameraCapture
                isOpen={activeCameraSlot !== null}
                title={
                  activeCameraSlot === 'driver_license'
                    ? 'تصوير شهادة القيادة (الوجه الأمامي)'
                    : `تصوير ${identityChoice === 'passport' ? 'جواز السفر' : 'الهوية الشخصية'}`
                }
                docLabel={
                  activeCameraSlot === 'driver_license'
                    ? 'تأكد من وضوح بيانات الرخصة وتاريخ الصلاحية'
                    : 'تأكد من وضوح الاسم والرقم الوطني والصورة'
                }
                onClose={() => setActiveCameraSlot(null)}
                onCapture={handleSlotCapture}
              />
            </div>
          )}

          {/* TAB 2: BOOKINGS */}
          {activeTab === 'bookings' && (
            <div className="space-y-3">
              {userBookings.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <Car className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white mb-1">لا توجد حجوزات مسجلة حتى الآن</h3>
                  <p className="text-xs text-slate-400 mb-5 max-w-sm mx-auto">
                    يمكنك تصفح أسطول سياراتنا المميز في دمشق وحجز سيارتك المفضلة فوراً
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenBooking();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20"
                  >
                    احجز سيارتك الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {userBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-amber-500/30 transition-all text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-sm">{booking.vehicleName || 'سيارة شاكر'}</span>
                          <span className="font-mono text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            {booking.bookingNumber || booking.id.substring(0, 8)}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {booking.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-slate-300 mb-3">
                        <div>
                          <span className="text-slate-400 block text-[10px]">تاريخ الاستلام:</span>
                          <span className="font-mono">{booking.pickupDate} ({booking.pickupTime})</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">تاريخ الإرجاع:</span>
                          <span className="font-mono">{booking.returnDate} ({booking.returnTime})</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                        <div className="font-bold text-amber-400">
                          الإجمالي: {booking.totalPrice?.toLocaleString('ar-SY')} ل.س
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openWhatsAppChat(booking)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold transition flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>تواصل واتساب</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PROFILE & CREDENTIALS */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">الاسم الكامل:</span>
                  <span className="font-bold text-white">{user.displayName}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">البريد الإلكتروني:</span>
                  <span className="font-mono text-white">{user.email}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">رقم الهاتف:</span>
                  <span className="font-mono text-white">{user.phone || 'غير محدد'}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">نوع الحساب والصلاحية:</span>
                  <span className="text-amber-400 font-bold">
                    {isSuperAdmin ? 'المدير العام (Super Admin)' : isAdmin ? 'مدير التشغيل' : 'حساب عميل'}
                  </span>
                </div>
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
                        <Shield className="w-4 h-4 text-slate-500" />
                        <span>غير موثق بعد</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Password Change Sub-form */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4 text-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <h4 className="font-black text-white text-sm">الأمان وكلمة المرور</h4>
                </div>

                {!canEditCredentials ? (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs flex items-start gap-2">
                    <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-300 block mb-0.5">حساب طاقم العمل الإداري</span>
                      <span>بيانات حسابات الموظفين تُدار مركزياً من قبل المدير العام حصراً.</span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
                    {passwordFeedback && (
                      <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                        passwordFeedback.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                      }`}>
                        {passwordFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span>{passwordFeedback.message}</span>
                      </div>
                    )}

                    <div>
                      <label htmlFor="user-profile-current-pass" className="text-[11px] text-slate-400 block mb-1">
                        كلمة المرور الحالية
                      </label>
                      <input
                        id="user-profile-current-pass"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs font-mono outline-none focus:border-amber-500 transition-all"
                        dir="ltr"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="user-profile-new-pass" className="text-[11px] text-slate-400 block mb-1">
                          كلمة المرور الجديدة
                        </label>
                        <input
                          id="user-profile-new-pass"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="6 أحرف على الأقل"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs font-mono outline-none focus:border-amber-500 transition-all"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label htmlFor="user-profile-confirm-pass" className="text-[11px] text-slate-400 block mb-1">
                          تأكيد كلمة المرور
                        </label>
                        <input
                          id="user-profile-confirm-pass"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="إعادة إدخال الجديدة"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs font-mono outline-none focus:border-amber-500 transition-all"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="submit"
                        disabled={isChangingPassword || !currentPassword || !newPassword}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>{isChangingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold px-3 py-2 rounded-xl hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج من الحساب</span>
          </button>
        </div>
      </div>
    </div>
  );
};
