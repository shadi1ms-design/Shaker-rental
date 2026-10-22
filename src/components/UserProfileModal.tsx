import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Booking, UploadedFile } from '../types';
import { dataService } from '../services/dataService';
import { functionsService } from '../services/functionsService';
import {
  User,
  Phone,
  Calendar,
  Clock,
  Car,
  CheckCircle2,
  X,
  LogOut,
  MessageCircle,
  FolderOpen,
  Upload,
  FileText,
  Eye,
  Shield,
  Plus,
  RefreshCw,
  AlertCircle,
  Lock,
  Key,
  Save
} from 'lucide-react';
import { openWhatsAppChat } from '../services/whatsapp';
import { storageService } from '../services/storageService';
import { validateUploadedFile } from '../utils/security';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface UserProfileModalProps {
  isOpen: boolean;
  bookings: Booking[];
  onClose: () => void;
  onOpenBooking: () => void;
  onOpenAdminView?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  bookings,
  onClose,
  onOpenBooking,
  onOpenAdminView,
}) => {
  const modalRef = useFocusTrap({ isOpen, onClose });
  const { user, logout, isSuperAdmin, isAdmin, isEmployee, changePassword, changePhoneNumber } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'bookings' | 'files'>('bookings');
  const [userFiles, setUserFiles] = useState<UploadedFile[]>([]);
  const [liveProfile, setLiveProfile] = useState<any | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState<UploadedFile['category']>('driver_license');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [bookingCancelError, setBookingCancelError] = useState<string | null>(null);
  // Inline confirmation (replaces native window.confirm popups)
  const [pendingAction, setPendingAction] = useState<{ id: string; kind: 'cancel' | 'hide' } | null>(null);
  const [directCustomerBookings, setDirectCustomerBookings] = useState<Booking[] | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Direct real-time Firestore query for user's bookings by customerId
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

  // Security & Credentials Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [phoneInput, setPhoneInput] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneFeedback, setPhoneFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Synchronize phone input when profile is loaded
  useEffect(() => {
    if (user?.phone || liveProfile?.phone) {
      setPhoneInput(user?.phone || liveProfile?.phone || '');
    }
  }, [user?.phone, liveProfile?.phone]);

  const canEditCredentials = !isEmployee || isSuperAdmin;

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
    } catch (err: any) {
      console.error('Password change error:', err);
      let msg = 'تعذر تغيير كلمة المرور.';
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        msg = 'كلمة المرور الحالية غير صحيحة.';
      } else if (err?.code === 'auth/weak-password') {
        msg = 'كلمة المرور الجديدة ضعيفة جداً.';
      } else if (err?.message) {
        msg = err.message;
      }
      setPasswordFeedback({ type: 'error', message: msg });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSavePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneFeedback(null);

    const clean = phoneInput.trim();
    if (!clean || clean.length < 7) {
      setPhoneFeedback({ type: 'error', message: 'يرجى إدخال رقم هاتف صالح (7 أرقام على الأقل).' });
      return;
    }

    try {
      setIsSavingPhone(true);
      await changePhoneNumber(clean);
      setPhoneFeedback({ type: 'success', message: 'تم تحديث وتثبيت رقم الهاتف بنجاح.' });
    } catch (err: any) {
      console.error('Phone update error:', err);
      setPhoneFeedback({ type: 'error', message: err?.message || 'عذراً، فشل تحديث رقم الهاتف.' });
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleHideBooking = async (bookingId: string) => {
    setPendingAction(null);
    try {
      setBookingCancelError(null);
      await dataService.hideBookingForCustomer(bookingId);
      window.location.reload();
    } catch (err: unknown) {
      setBookingCancelError((err instanceof Error && err.message) || 'تعذر إتمام العملية.');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setPendingAction(null);
    try {
      setCancellingBookingId(bookingId);
      setBookingCancelError(null);
      const res = await functionsService.updateBookingStatusSecure({
        bookingId,
        status: 'cancelled',
      });
      if (!res.success) {
        throw new Error(res.error || 'عذراً، فشل إلغاء الحجز.');
      }
      // Refresh local view if possible
      window.location.reload();
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      setBookingCancelError(err?.message || 'عذراً، تعذر إلغاء الحجز.');
    } finally {
      setCancellingBookingId(null);
    }
  };

  const loadProfile = async () => {
    if (!user?.uid) return;
    try {
      const p = await dataService.getUserProfile(user.uid);
      if (p) setLiveProfile(p);
    } catch (err) {
      console.warn('Error loading live user profile:', err);
    }
  };

  const loadFiles = async () => {
    if (!user?.uid) return;
    setIsLoadingFiles(true);
    try {
      const files = await dataService.getFilesForUser(user.uid);
      setUserFiles(files);
    } catch (err) {
      console.error('Error loading files for user:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (isOpen && user?.uid) {
      loadFiles();
      loadProfile();
    }
  }, [isOpen, user?.uid]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateUploadedFile(file.name, file.size, file.type, 'document');
      if (!validation.valid) {
        setUploadError(validation.error || 'الملف غير صالح للرفع.');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      setUploadError(null);
      if (!newFileName.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setNewFileName(nameWithoutExt);
      }
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!selectedFile) {
      setUploadError('يرجى اختيار ملف حقيقي لرفعه، لا يمكن حفظ مستند بدون ملف.');
      return;
    }

    const validation = validateUploadedFile(selectedFile.name, selectedFile.size, selectedFile.type, 'document');
    if (!validation.valid) {
      setUploadError(validation.error || 'الملف غير صالح للرفع.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const cleanDocName = newFileName.trim() || selectedFile.name;

      // Upload to Firebase Storage with progress tracking
      const uploadResult = await storageService.uploadUserDocument(
        selectedFile,
        user.uid,
        newFileCategory || 'other',
        (percent) => {
          setUploadProgress(percent);
        }
      );

      await dataService.uploadUserFile({
        userId: user.uid,
        userEmail: user.email,
        fileName: cleanDocName,
        storagePath: uploadResult.storagePath,
        fileType: uploadResult.fileType,
        fileSize: uploadResult.fileSize,
        category: newFileCategory,
      });

      // Reset form
      setNewFileName('');
      setSelectedFile(null);
      setUploadProgress(0);
      setShowUploadForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadFiles();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setUploadError(err?.message || 'حدث خطأ أثناء رفع الوثيقة.');
    } finally {
      setIsUploading(false);
    }
  };

  // Filter bookings for this user primarily by customerId == user.uid, with email/phone as fallback
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">مؤكد</span>;
      case 'rented':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">جاري التأجير</span>;
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">مكتمل</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">ملغي</span>;
      case 'rejected':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">مرفوض</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">قيد المراجعة</span>;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center p-3 sm:p-6 bg-slate-950">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-modal-title"
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-clip text-slate-100"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
        id="user-profile-modal"
      >
        {/* Glow */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />

        {/* Header */}
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
                {liveProfile?.verificationStatus === 'verified' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>موثق الهوية</span>
                  </span>
                ) : liveProfile?.verificationStatus === 'manual_review' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>قيد التدقيق اليدوي</span>
                  </span>
                ) : liveProfile?.verificationStatus === 'rejected' ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>مرفوض التدقيق</span>
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold border border-slate-700 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>بانتظار الوثائق</span>
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 block font-mono">{user.email}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors text-xs font-bold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label="إغلاق الملف الشخصي"
            title="إغلاق النافذة"
          >
            <X className="w-4 h-4" />
            <span>إغلاق</span>
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-4 pb-2 border-b border-slate-800/60">
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
            onClick={() => setActiveTab('files')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'files'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>ملفاتي ووثائقي ({userFiles.length})</span>
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
            <span>بيانات الحساب</span>
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
              <span>لوحة المشرف (Admin View)</span>
            </button>
          )}
        </div>

        {/* Tab Content Body */}
        <div 
          className="py-4 space-y-4"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {activeTab === 'bookings' && (
            <div className="space-y-3">
              {bookingCancelError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{bookingCancelError}</span>
                </div>
              )}
              {userBookings.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <Car className="w-12 h-12 text-slate-600 mx-auto mb-3" />
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
                          <span className="font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 text-xs tracking-wider" dir="ltr">
                            #{booking.bookingNumber || booking.id.slice(0, 8)}
                          </span>
                          <span className="font-bold text-white text-sm">{booking.vehicleName}</span>
                        </div>
                        <div>{getStatusBadge(booking.status)}</div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-slate-300 mb-3">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>من: <strong className="text-white">{booking.pickupDate}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>إلى: <strong className="text-white">{booking.returnDate}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>المدة: <strong className="text-white">{booking.rentalDays} أيام</strong></span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/40">
                        <div>
                          <span className="text-slate-400">الإجمالي: </span>
                          <span className="font-bold text-white">${booking.totalPrice}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {pendingAction?.id === booking.id && (
                            <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-950 border border-slate-700 text-xs">
                              <span className="text-slate-300">
                                {pendingAction.kind === 'cancel'
                                  ? 'هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟'
                                  : 'سيتم إخفاء هذا الحجز من قائمتك فقط، مع بقاء سجله محفوظاً لدى الشركة. متابعة؟'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  pendingAction.kind === 'cancel'
                                    ? handleCancelBooking(booking.id)
                                    : handleHideBooking(booking.id)
                                }
                                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold"
                              >
                                تأكيد
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingAction(null)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                              >
                                تراجع
                              </button>
                            </div>
                          )}

                          {(booking.status === 'new' || booking.status === 'reviewing') && pendingAction?.id !== booking.id && (
                            <button
                              onClick={() => setPendingAction({ id: booking.id, kind: 'cancel' })}
                              disabled={cancellingBookingId === booking.id}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 transition-all text-xs font-semibold disabled:opacity-50"
                            >
                              {cancellingBookingId === booking.id ? 'جاري الإلغاء...' : 'إلغاء الحجز'}
                            </button>
                          )}

                          {['cancelled', 'rejected', 'completed'].includes(booking.status) && pendingAction?.id !== booking.id && (
                            <button
                              onClick={() => setPendingAction({ id: booking.id, kind: 'hide' })}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 text-slate-300 hover:text-white transition-all text-xs font-semibold"
                            >
                              حذف من القائمة
                            </button>
                          )}

                          <button
                            onClick={() => openWhatsAppChat(booking)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all text-xs font-semibold"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>متابعة عبر واتساب</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                    <span>المستندات والوثائق المرفوعة ({userFiles.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    رخصة القيادة، الهوية الشخصية، أو جواز السفر لتسهيل إجراءات استلام السيارة
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowUploadForm(!showUploadForm)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>رفع وثيقة جديدة</span>
                </button>
              </div>

              {/* Identity Verification Policy Notice */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>معايير توثيق الهوية وفحص المستندات:</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  تخضع جميع الوثائق المرفوعة لمرحلة فحص الصيغة ثم التدقيق الإداري اليدوي (Manual Review) من قبل موظفي إدارة شركة شاكر قبل اعتماد الحساب وتوثيقه. لا يُعتبر الحساب موثقاً لمجرد رفع المستند أو فحص صيغته.
                </p>
              </div>

              {/* Upload Form */}
              {showUploadForm && (
                <form
                  onSubmit={handleUploadFile}
                  className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3 animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>إرفاق وثيقة أو هوية رسمية (Firebase Storage)</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">الحد الأقصى: 20 ميجابايت</span>
                  </div>

                  {/* Drag and Drop or File Picker */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-xl p-3 text-center cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-colors"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2 text-xs text-amber-300 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="truncate max-w-[220px]">{selectedFile.name}</span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          ({(selectedFile.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-300">
                          انقر لاختيار ملف من جهازك (JPG, PNG, PDF)
                        </p>
                        <p className="text-[10px] text-slate-500">
                          سيتم الرفع مباشرة إلى حاوية التخزين السحابية في Firebase Storage
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">اسم الوثيقة *</label>
                      <input
                        type="text"
                        required
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        placeholder="مثال: رخصة قيادة سورية - 2025"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">نوع الوثيقة *</label>
                      <select
                        value={newFileCategory}
                        onChange={(e) => setNewFileCategory(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-500 outline-none"
                      >
                        <option value="driver_license">رخصة قيادة (Driver License)</option>
                        <option value="national_id">بطاقة هوية شخصية (National ID)</option>
                        <option value="passport">جواز سفر (Passport)</option>
                        <option value="contract">عقد إيجار موقع (Contract)</option>
                        <option value="other">وثيقة أخرى (Other)</option>
                      </select>
                    </div>
                  </div>

                  {uploadError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {isUploading && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold">
                        <span>جاري الرفع إلى Firebase Storage...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-500 h-full transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUploadForm(false);
                        setSelectedFile(null);
                        setUploadError(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || !selectedFile || !newFileName.trim()}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isUploading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري الرفع...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>حفظ ورفع الوثيقة</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Files List */}
              {isLoadingFiles ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  جاري تحميل المستندات...
                </div>
              ) : userFiles.length === 0 ? (
                <div className="py-10 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80 p-4">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-300">لا توجد ملفات مرفوعة في حسابك حتى الآن</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    يمكنك رفع رخصة القيادة أو الهوية الآن لتسريع تسليم السيارة عند الحجز.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {userFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 flex-shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate" title={file.fileName}>{file.fileName}</h4>
                          <span className="text-[10px] text-slate-400 block">
                            {file.category === 'driver_license'
                              ? 'رخصة قيادة'
                              : file.category === 'national_id'
                              ? 'هوية شخصية'
                              : file.category === 'passport'
                              ? 'جواز سفر'
                              : 'مستند'}
                            {file.fileSize ? ` • ${(file.fileSize / 1024).toFixed(0)} KB` : ''}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 mt-1 rounded-full font-bold border ${
                            file.verified
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          }`}>
                            {file.verified ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                            <span>{file.verified ? 'معتمدة وموثقة' : 'قيد التدقيق اليدوي'}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {file.storagePath && (
                          <button
                            type="button"
                            onClick={async () => {
                              const url = await storageService.getFileDownloadUrl(file.storagePath);
                              if (url) window.open(url, '_blank', 'noopener,noreferrer');
                            }}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            title="عرض الوثيقة"
                            aria-label="عرض وتحميل الوثيقة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                  <span className="text-slate-400">حالة توثيق الهوية (Server Firestore):</span>
                  <div>
                    {liveProfile?.verificationStatus === 'verified' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>هوية معتمدة وموثقة رسمياً</span>
                      </span>
                    ) : liveProfile?.verificationStatus === 'manual_review' ? (
                      <span className="text-amber-400 font-bold flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-400" />
                        <span>قيد التدقيق الإداري اليدوي (Manual Review)</span>
                      </span>
                    ) : liveProfile?.verificationStatus === 'rejected' ? (
                      <span className="text-rose-400 font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                        <span>الوثائق مرفوضة التدقيق - يرجى إعادة الرفع</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 font-bold flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>بانتظار رفع الوثائق للتدقيق</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {liveProfile?.verificationStatus === 'manual_review' && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">الطلب قيد المراجعة الإدارية اليدوية</span>
                    <span>تم استلام وثائقك وفحص صيغتها، وجاري تدقيقها ومطابقتها يدوياً من قبل موظفي إدارة شاكر. سيتم إشعارك فور اكتمال التوثيق.</span>
                  </div>
                </div>
              )}

              {liveProfile?.verificationStatus === 'verified' && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold block">الهوية معتمدة وموثقة رسمياً</span>
                    <span>حسابك مفعل بالكامل ومستوفٍ لجميع شروط التأجير السريع واستلام السيارات المباشر في دمشق.</span>
                  </div>
                </div>
              )}

              {/* Security & Credentials Section */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4 text-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <h4 className="font-black text-white text-sm">الأمان وبيانات الحساب</h4>
                </div>

                {!canEditCredentials ? (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs flex items-start gap-2">
                    <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-300 block mb-0.5">حساب طاقم العمل الإداري</span>
                      <span>بيانات حسابات الموظفين وصلاحياتهم وأرقام هواتفهم تُدار مركزياً من قبل المدير العام (Super Admin) حصراً.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 1. Phone Update Sub-form */}
                    <form onSubmit={handleSavePhoneSubmit} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="user-profile-phone-input" className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                          <Phone className="w-3.5 h-3.5 text-amber-400" />
                          <span>تعديل رقم الهاتف</span>
                        </label>
                        <span className="text-[10px] text-slate-400">للتواصل وتأكيد الحجوزات</span>
                      </div>

                      {phoneFeedback && (
                        <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                          phoneFeedback.type === 'success'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                        }`}>
                          {phoneFeedback.type === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          )}
                          <span>{phoneFeedback.message}</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <input
                          id="user-profile-phone-input"
                          type="tel"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          placeholder="مثال: +963 933 123 456"
                          className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-mono outline-none focus:border-amber-500 transition-all"
                          dir="ltr"
                        />
                        <button
                          type="submit"
                          disabled={isSavingPhone || !phoneInput.trim()}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                        >
                          <Save className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isSavingPhone ? 'جاري الحفظ...' : 'حفظ الرقم'}</span>
                        </button>
                      </div>
                    </form>

                    {/* 2. Password Change Sub-form */}
                    <form onSubmit={handleChangePasswordSubmit} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                          <Key className="w-3.5 h-3.5 text-amber-400" />
                          <span>تغيير كلمة المرور</span>
                        </span>
                        <span className="text-[10px] text-slate-400">تأمين الوصول للحساب</span>
                      </div>

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

                      <div className="space-y-2">
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
                      </div>
                    </form>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
                ✨ يتم ربط جميع حجوزاتك المستقبلية تلقائياً بحسابك لتقديم أولوية في الحجز وسرعة في استلام وتسليم السيارات عند فروعنا في دمشق.
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
