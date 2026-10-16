import React, { useState } from 'react';
import { Booking, Vehicle, BookingStatus } from '../../types';
import { dataService } from '../../services/dataService';
import { functionsService } from '../../services/functionsService';
import { openWhatsAppChatWithCustomer } from '../../services/whatsapp';
import {
  Calendar,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ClipboardCheck,
  DollarSign,
  RefreshCw,
  X,
  MessageSquare,
  Filter,
  Trash2,
  Ban,
  Key
} from 'lucide-react';

interface AdminBookingsProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  onRefreshData: () => void;
  onOpenInspection: (vehicle: Vehicle, bookingId: string) => void;
  onDeleteBooking?: (bookingId: string) => Promise<void> | void;
  isSyncing: boolean;
  onSyncWithFirestore: () => Promise<void>;
  syncStatus: { message: string; success: boolean } | null;
}

export const AdminBookings: React.FC<AdminBookingsProps> = ({
  bookings,
  vehicles,
  onRefreshData,
  onOpenInspection,
  onDeleteBooking,
  isSyncing,
  onSyncWithFirestore,
  syncStatus,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  
  // Status Action Confirmation Modal
  const [statusActionConfirm, setStatusActionConfirm] = useState<{ booking: Booking; newStatus: BookingStatus } | null>(null);
  const [isExecutingStatusAction, setIsExecutingStatusAction] = useState(false);

  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);
  const [deleteBookingError, setDeleteBookingError] = useState<string | null>(null);

  // Client-side visual warning check for overlapping pending/active requests on the same vehicle
  const checkHasOverlappingBooking = (b: Booking) => {
    if (b.status !== 'new' && b.status !== 'reviewing') return false;
    if (!b.vehicleId || !b.pickupDate || !b.returnDate) return false;

    const bPickupMs = new Date(`${b.pickupDate}T${b.pickupTime || '10:00'}:00Z`).getTime();
    const bReturnMs = new Date(`${b.returnDate}T${b.returnTime || '10:00'}:00Z`).getTime();

    return bookings.some((other) => {
      if (other.id === b.id) return false;
      if (other.vehicleId !== b.vehicleId) return false;
      if (other.status !== 'new' && other.status !== 'reviewing' && other.status !== 'confirmed' && other.status !== 'rented') {
        return false;
      }
      if ((other as any).isDeleted) return false;

      const oPickupMs = new Date(`${other.pickupDate}T${other.pickupTime || '10:00'}:00Z`).getTime();
      const oReturnMs = new Date(`${other.returnDate}T${other.returnTime || '10:00'}:00Z`).getTime();

      if (isNaN(bPickupMs) || isNaN(bReturnMs) || isNaN(oPickupMs) || isNaN(oReturnMs)) {
        return b.pickupDate <= other.returnDate && b.returnDate >= other.pickupDate;
      }

      return bPickupMs < oReturnMs && bReturnMs > oPickupMs;
    });
  };

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'new':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">طلب جديد</span>;
      case 'reviewing':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">قيد المراجعة</span>;
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">مؤكد</span>;
      case 'rented':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">جاري التأجير</span>;
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">مكتمل ومستلم</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">ملغي</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-900/40 text-rose-400 border border-rose-800">مرفوض</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  const handleUpdateStatus = async (booking: Booking, newStatus: BookingStatus) => {
    try {
      const bookingId = booking.id;

      if (!bookingId || typeof bookingId !== 'string' || !bookingId.trim()) {
        setActionError('عذراً، تعذر تنفيذ العملية: معرف مستند الحجز (Firestore document ID) مفقود.');
        return;
      }

      setUpdatingBookingId(bookingId);
      setIsExecutingStatusAction(true);
      setActionError(null);
      setActionSuccess(null);
      const res = await functionsService.updateBookingStatusSecure({
        bookingId: bookingId,
        bookingNumber: booking.bookingNumber || bookingId,
        status: newStatus,
      });
      if (!res.success) {
        throw new Error(res.error || 'عذراً، تعذر تحديث حالة الحجز.');
      }
      onRefreshData();
      const statusLabels: Record<string, string> = {
        confirmed: 'تأكيد الحجز',
        rented: 'تسليم السيارة وبدء التأجير',
        completed: 'استلام السيارة وإتمام الحجز (إرجاع للأسطول)',
        cancelled: 'إلغاء الحجز',
        rejected: 'رفض طلب الحجز',
      };
      setActionSuccess(`تم ${statusLabels[newStatus] || newStatus} بنجاح ومزامنة قاعدة البيانات السحابية.`);
      setStatusActionConfirm(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('Update booking status error:', err);
      setActionError(err?.message || 'عذراً، حدث خطأ أثناء تحديث حالة الحجز.');
    } finally {
      setUpdatingBookingId(null);
      setIsExecutingStatusAction(false);
    }
  };

  const getActionModalDetails = (status: BookingStatus, booking: Booking) => {
    switch (status) {
      case 'confirmed':
        return {
          title: 'تأكيد الحجز',
          description: `هل أنت متأكد من تأكيد الحجز رقم "${booking.bookingNumber || booking.id}" للعميل "${booking.customerName}"؟`,
          note: 'سيتم نقل الحجز إلى الحالة المؤكدة وحجز السيارة للفترة المحددة في النظام.',
          confirmLabel: 'تأكيد الحجز',
          confirmBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          Icon: CheckCircle2,
        };
      case 'rented':
        return {
          title: 'تأكيد الحجز وتسليم السيارة',
          description: `هل أنت متأكد من تأكيد الحجز وتسليم السيارة فوراً للطلب رقم "${booking.bookingNumber || booking.id}" للعميل "${booking.customerName}"؟`,
          note: 'تنبيه: سيتم نقل الحجز مباشرة إلى (جاري التأجير) وتحديث حالة السيارة في الأسطول إلى (مؤجرة) تلقائياً.',
          confirmLabel: 'تأكيد وتسليم السيارة',
          confirmBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          Icon: Key,
        };
      case 'rejected':
        return {
          title: 'رفض طلب الحجز',
          description: `هل أنت متأكد من رفض طلب الحجز رقم "${booking.bookingNumber || booking.id}" للعميل "${booking.customerName}"؟`,
          note: 'تنبيه: سيتم نقل الحجز إلى الحالة (مرفوض) وإرجاع السيارة إلى حالة (متوفرة) في الأسطول.',
          confirmLabel: 'تأكيد رفض الحجز',
          confirmBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20',
          iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
          Icon: Ban,
        };
      case 'completed':
        return {
          title: 'استلام السيارة وإتمام الحجز',
          description: `هل أنت متأكد من استلام السيارة وإنهاء الحجز رقم "${booking.bookingNumber || booking.id}"؟`,
          note: 'سيتم نقل الحجز إلى مكتمل ومستلم وإرجاع حالة السيارة في الأسطول إلى (متوفرة) فوراً.',
          confirmLabel: 'تأكيد الاستلام والإتمام',
          confirmBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          Icon: CheckCircle2,
        };
      default:
        return {
          title: 'تغيير حالة الحجز',
          description: `هل أنت متأكد من تغيير حالة الحجز إلى "${status}"؟`,
          note: '',
          confirmLabel: 'تأكيد الإجراء',
          confirmBg: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20',
          iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          Icon: CheckCircle2,
        };
    }
  };

  // Status counts for badge pills
  const counts = {
    all: bookings.length,
    new: bookings.filter((b) => b.status === 'new').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    rented: bookings.filter((b) => b.status === 'rented').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled' || b.status === 'rejected').length,
  };

  const filteredBookings = bookings.filter((b) => {
    if (filterStatus === 'cancelled') {
      if (b.status !== 'cancelled' && b.status !== 'rejected') return false;
    } else if (filterStatus !== 'all' && b.status !== filterStatus) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = (b.bookingNumber || '').toLowerCase().includes(q);
      const matchCustomer = (b.customerName || '').toLowerCase().includes(q);
      const matchPhone = (b.customerPhone || '').includes(q);
      const matchVehicle = (b.vehicleName || '').toLowerCase().includes(q);
      return matchNumber || matchCustomer || matchPhone || matchVehicle;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Cloud Sync Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>إدارة الحجوزات والتأجير المباشر</span>
              <span className="text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Cloud Firestore متصل
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              تتبع الحجوزات، إصدار العقود الرسمية المطبوعة، وإدارة تسليم واستلام الأسطول
            </p>
          </div>

          <button
            onClick={onSyncWithFirestore}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            title="التحقق من تخزين كافة الحجوزات والسيارات في قاعدة بيانات Firestore ومزامنتها"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة مع السحابة'}</span>
          </button>
        </div>

        {/* Sync Status Alert Banner */}
        {syncStatus && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border animate-in fade-in ${
              syncStatus.success
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{syncStatus.message}</span>
          </div>
        )}

        {/* Quick Booking Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[11px] text-slate-400">إجمالي الحجوزات</div>
            <div className="text-lg font-black text-white font-mono">{bookings.length} حجز</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[11px] text-amber-400">طلبات جديدة ومؤكدة</div>
            <div className="text-lg font-black text-amber-400 font-mono">
              {bookings.filter((b) => b.status === 'new' || b.status === 'confirmed').length} حجز
            </div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[11px] text-blue-400">قيد التأجير حالياً</div>
            <div className="text-lg font-black text-blue-400 font-mono">
              {bookings.filter((b) => b.status === 'rented').length} سيارة
            </div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[11px] text-emerald-400">حجوزات مكتملة ومستلمة</div>
            <div className="text-lg font-black text-emerald-400 font-mono">
              {bookings.filter((b) => b.status === 'completed').length} حجز
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filter Pills with dynamic counts */}
        <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
          {[
            { id: 'all', label: 'الكل', count: counts.all },
            { id: 'new', label: 'طلبات جديدة', count: counts.new },
            { id: 'confirmed', label: 'مؤكدة', count: counts.confirmed },
            { id: 'rented', label: 'جاري التأجير', count: counts.rented },
            { id: 'completed', label: 'مكتملة', count: counts.completed },
            { id: 'cancelled', label: 'ملغاة', count: counts.cancelled },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setFilterStatus(st.id)}
              className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                filterStatus === st.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span>{st.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  filterStatus === st.id
                    ? 'bg-slate-950/30 text-slate-950 font-black'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {st.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input with Clear Button */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الحجز، العميل، الهاتف، أو السيارة..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 pl-9 pr-9 text-xs text-white focus:outline-none focus:border-amber-500 placeholder-slate-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Action Alerts */}
      {actionError && (
        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-2xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 hover:bg-rose-500/20 rounded-lg text-rose-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-2xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bookings List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="font-bold text-sm text-slate-300">لا توجد حجوزات مطابقة للبحث أو الفلتر المحدد</p>
            <p className="text-slate-500 text-[11px]">جرب تغيير حالة الفلتر أو مسح نص البحث</p>
            {(filterStatus !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold"
              >
                إعادة ضبط الفلاتر
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                  <th className="p-3.5">رقم الحجز</th>
                  <th className="p-3.5">المستأجر</th>
                  <th className="p-3.5">السيارة</th>
                  <th className="p-3.5">فترة الإيجار</th>
                  <th className="p-3.5">الإجمالي</th>
                  <th className="p-3.5">المتبقي</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5 text-center">الإجراءات والعمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredBookings.map((b) => {
                  const targetVehicle =
                    vehicles.find((v) => v.id === b.vehicleId) || vehicles?.[0] || null;
                  const remaining =
                    b.remainingAmount ?? (b.totalPrice - (b.paidAmount || 0));

                  return (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono font-black text-amber-400">
                        {b.bookingNumber}
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-white">{b.customerName}</div>
                        <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                          {b.customerPhone}
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-300 font-medium">
                        <div className="font-bold text-white">{b.vehicleName}</div>
                        {checkHasOverlappingBooking(b) && (
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                            <span>⚠️ يوجد طلب آخر متداخل على نفس السيارة</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-400">
                        <div>من: {b.pickupDate}</div>
                        <div>إلى: {b.returnDate} ({b.rentalDays} أيام)</div>
                      </td>

                      <td className="p-3.5 font-bold font-mono text-white text-sm">
                        ${b.totalPrice}
                      </td>

                      <td className="p-3.5 font-mono">
                        <span className={remaining > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          ${remaining}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {getStatusBadge(b.status)}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          {/* Inspection Sheet */}
                          <button
                            onClick={() => {
                              if (targetVehicle) {
                                onOpenInspection(targetVehicle, b.id);
                              }
                            }}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 transition-colors"
                            title="نموذج فحص واستلام السيارة"
                          >
                            <ClipboardCheck className="w-[18px] h-[18px]" />
                          </button>

                          {/* Workflow Status Actions with Clear Separation & Safety Confirmation */}
                          {(b.status === 'new' || b.status === 'reviewing') && (
                            <div className="flex items-center gap-2">
                              {/* Confirm Booking Button */}
                              <button
                                disabled={updatingBookingId === b.id}
                                onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'confirmed' })}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap"
                                title="تأكيد طلب الحجز والانتقال لمرحلة التجهيز والتسليم"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{updatingBookingId === b.id ? '...' : 'تأكيد الحجز'}</span>
                              </button>

                              {/* Clear Visual Vertical Separator */}
                              <div className="h-6 w-px bg-slate-700/80 mx-0.5" />

                              {/* Separate Distinct Rejection Button */}
                              <button
                                disabled={updatingBookingId === b.id}
                                onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'rejected' })}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 disabled:opacity-50 text-rose-300 hover:text-white border border-rose-500/40 font-black text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                                title="رفض طلب الحجز"
                              >
                                <Ban className="w-3.5 h-3.5 text-rose-400 group-hover:text-white" />
                                <span>{updatingBookingId === b.id ? '...' : 'رفض'}</span>
                              </button>
                            </div>
                          )}

                          {b.status === 'confirmed' && (
                            <button
                              disabled={updatingBookingId === b.id}
                              onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'rented' })}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                              title="تسليم السيارة للعميل وتغيير حالتها إلى مؤجرة في قاعدة البيانات"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>{updatingBookingId === b.id ? 'جاري التسليم...' : 'تسليم (تأجير)'}</span>
                            </button>
                          )}

                          {b.status === 'rented' && (
                            <button
                              disabled={updatingBookingId === b.id}
                              onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'completed' })}
                              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                              title="استلام السيارة من العميل وإرجاع حالتها إلى متاحة في الأسطول"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{updatingBookingId === b.id ? 'جاري الإتمام...' : 'استلام وإتمام (إرجاع للأسطول)'}</span>
                            </button>
                          )}

                          {/* WhatsApp Chat */}
                          <button
                            onClick={() => openWhatsAppChatWithCustomer(b)}
                            className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
                            title="مراسلة العميل عبر الواتساب"
                          >
                            <MessageSquare className="w-[18px] h-[18px]" />
                          </button>

                          {/* Hard Delete Booking */}
                          <button
                            onClick={() => {
                              setDeleteBookingError(null);
                              setBookingToDelete(b);
                            }}
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors border border-rose-500/20"
                            title="حذف الحجز نهائياً من قاعدة البيانات"
                          >
                            <Trash2 className="w-[18px] h-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Status Action Confirmation Modal */}
      {statusActionConfirm && (() => {
        const details = getActionModalDetails(statusActionConfirm.newStatus, statusActionConfirm.booking);
        const IconComponent = details.Icon;

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center mx-auto ${details.iconBg}`}>
                <IconComponent className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">{details.title}</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {details.description}
                </p>
                {details.note && (
                  <p className="text-[11px] text-amber-300 font-bold mt-2 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 leading-normal">
                    {details.note}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isExecutingStatusAction}
                  onClick={() => handleUpdateStatus(statusActionConfirm.booking, statusActionConfirm.newStatus)}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 ${details.confirmBg}`}
                >
                  {isExecutingStatusAction ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري التنفيذ...</span>
                    </>
                  ) : (
                    <span>{details.confirmLabel}</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isExecutingStatusAction}
                  onClick={() => setStatusActionConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Booking Permanent Deletion Confirmation Modal */}
      {bookingToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">حذف الحجز نهائياً</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف الحجز رقم <strong className="font-mono text-amber-400">{bookingToDelete.bookingNumber}</strong> للعميل &ldquo;{bookingToDelete.customerName}&rdquo; نهائياً؟
              </p>
              <p className="text-[11px] text-rose-400 font-bold mt-2 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 leading-normal">
                تنبيه هام: هذا الإجراء سيقوم بحذف مستند الحجز بالكامل من قاعدة بيانات Firestore بشكل دائم ونهائي ولا يمكن التراجع عنه بأي شكل.
              </p>
            </div>

            {deleteBookingError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold text-right flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{deleteBookingError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingBooking}
                onClick={async () => {
                  if (!bookingToDelete) return;
                  try {
                    setIsDeletingBooking(true);
                    setDeleteBookingError(null);
                    if (onDeleteBooking) {
                      await onDeleteBooking(bookingToDelete.id);
                    } else {
                      await dataService.deleteBooking(bookingToDelete.id);
                      onRefreshData();
                    }
                    setBookingToDelete(null);
                    setActionSuccess('تم حذف الحجز نهائياً من قاعدة البيانات بنجاح.');
                    setTimeout(() => setActionSuccess(null), 4000);
                  } catch (err: any) {
                    console.error('Delete booking error:', err);
                    setDeleteBookingError(err?.message || 'عذراً، تعذر حذف الحجز.');
                  } finally {
                    setIsDeletingBooking(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                <span>{isDeletingBooking ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}</span>
              </button>
              <button
                type="button"
                disabled={isDeletingBooking}
                onClick={() => {
                  setBookingToDelete(null);
                  setDeleteBookingError(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
