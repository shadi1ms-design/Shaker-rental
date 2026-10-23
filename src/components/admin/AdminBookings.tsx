import React, { useState, useEffect, useMemo } from 'react';
import { Booking, Vehicle, BookingStatus } from '../../types';
import { getRemaining } from '../../utils/bookingCalculations';
import { dataService } from '../../services/dataService';
import { functionsService } from '../../services/functionsService';
import { openWhatsAppChatWithCustomer } from '../../services/whatsapp';
import { Toast, ToastMessage } from '../common/Toast';
import { StatusBadge } from '../common/StatusBadge';
import {
  Calendar,
  Search,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  RefreshCw,
  X,
  MessageSquare,
  Trash2,
  Ban,
  Key,
  Copy,
  Phone,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  FileText
} from 'lucide-react';
import { todayLocalISO } from '../../utils/dateUtils';
import { navigate } from '../../router';

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
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const handleWhatsAppToCustomer = (booking: Booking) => {
    if (!openWhatsAppChatWithCustomer(booking)) {
      setToast({ id: String(Date.now()), type: 'warning', message: 'رقم هاتف العميل غير متوفر بهذا الحجز.' });
    }
  };

  // Read initial params from URL if present
  const getUrlParams = () => {
    if (typeof window === 'undefined') return { status: 'all', q: '' };
    const params = new URLSearchParams(window.location.search);
    return {
      status: params.get('status') || 'all',
      q: params.get('q') || '',
    };
  };

  const initialParams = getUrlParams();
  const [filterStatus, setFilterStatus] = useState<string>(initialParams.status);
  const [searchInput, setSearchInput] = useState<string>(initialParams.q);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialParams.q);
  
  // Date range filter
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Sorting
  const [sortField, setSortField] = useState<'date' | 'total' | 'remaining'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination (25 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;

  // Batch Selection
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [isBatchActionRunning, setIsBatchActionRunning] = useState<boolean>(false);

  // Copied booking feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Search Debounce (300ms) and URL Synchronization
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1); // reset to page 1 on search change
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        const url = new URL(window.location.href);
        if (searchInput.trim()) {
          url.searchParams.set('q', searchInput.trim());
        } else {
          url.searchParams.delete('q');
        }
        if (filterStatus !== 'all') {
          url.searchParams.set('status', filterStatus);
        } else {
          url.searchParams.delete('status');
        }
        window.history.replaceState(null, '', url.pathname + url.search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filterStatus]);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  
  // Status Action Confirmation Modal
  const [statusActionConfirm, setStatusActionConfirm] = useState<{ booking: Booking; newStatus: BookingStatus } | null>(null);
  const [isExecutingStatusAction, setIsExecutingStatusAction] = useState(false);

  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);
  const [deleteBookingError, setDeleteBookingError] = useState<string | null>(null);

  // Pre-calculate active vehicle bookings map for instant O(1) overlap checks
  const vehicleActiveBookingsMap = React.useMemo(() => {
    const map = new Map<string, Array<{ id: string; pickupMs: number; returnMs: number; pickupDate: string; returnDate: string }>>();
    for (const b of bookings) {
      if (b.isDeleted) continue;
      if (b.status !== 'new' && b.status !== 'reviewing' && b.status !== 'confirmed' && b.status !== 'rented') {
        continue;
      }
      if (!b.vehicleId || !b.pickupDate || !b.returnDate) continue;

      const pMs = new Date(`${b.pickupDate}T${b.pickupTime || '10:00'}:00Z`).getTime();
      const rMs = new Date(`${b.returnDate}T${b.returnTime || '10:00'}:00Z`).getTime();

      const list = map.get(b.vehicleId) || [];
      list.push({
        id: b.id,
        pickupMs: pMs,
        returnMs: rMs,
        pickupDate: b.pickupDate,
        returnDate: b.returnDate,
      });
      map.set(b.vehicleId, list);
    }
    return map;
  }, [bookings]);

  // Client-side visual warning check for overlapping pending/active requests on the same vehicle
  const checkHasOverlappingBooking = React.useCallback((b: Booking) => {
    if (b.status !== 'new' && b.status !== 'reviewing') return false;
    if (!b.vehicleId || !b.pickupDate || !b.returnDate) return false;

    const list = vehicleActiveBookingsMap.get(b.vehicleId);
    if (!list || list.length <= 1) return false;

    const bPickupMs = new Date(`${b.pickupDate}T${b.pickupTime || '10:00'}:00Z`).getTime();
    const bReturnMs = new Date(`${b.returnDate}T${b.returnTime || '10:00'}:00Z`).getTime();

    return list.some((other) => {
      if (other.id === b.id) return false;
      if (isNaN(bPickupMs) || isNaN(bReturnMs) || isNaN(other.pickupMs) || isNaN(other.returnMs)) {
        return b.pickupDate <= other.returnDate && b.returnDate >= other.pickupDate;
      }
      return bPickupMs < other.returnMs && bReturnMs > other.pickupMs;
    });
  }, [vehicleActiveBookingsMap]);

  const getStatusBadge = (status: BookingStatus) => {
    return <StatusBadge status={status} type="booking" />;
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
      if (newStatus === 'confirmed') {
        // Booking confirmed: open the printable rental contract
        navigate(`/admin/contracts/${encodeURIComponent(bookingId)}`);
      }
    } catch (err: unknown) {
      console.error('Update booking status error:', err);
      setActionError(err instanceof Error ? err.message : 'عذراً، حدث خطأ أثناء تحديث حالة الحجز.');
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
  const counts = useMemo(() => ({
    all: bookings.length,
    new: bookings.filter((b) => b.status === 'new').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    rented: bookings.filter((b) => b.status === 'rented').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled' || b.status === 'rejected').length,
  }), [bookings]);

  // Filtered and Sorted Bookings
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        // Status filter
        if (filterStatus === 'cancelled') {
          if (b.status !== 'cancelled' && b.status !== 'rejected') return false;
        } else if (filterStatus !== 'all' && b.status !== filterStatus) {
          return false;
        }

        // Date Range filter (pickupDate or createdAt)
        if (startDate && b.pickupDate < startDate) return false;
        if (endDate && b.pickupDate > endDate) return false;

        // Search query filter
        if (debouncedSearch.trim()) {
          const q = debouncedSearch.toLowerCase().trim();
          const matchNumber = (b.bookingNumber || '').toLowerCase().includes(q);
          const matchCustomer = (b.customerName || '').toLowerCase().includes(q);
          const matchPhone = (b.customerPhone || '').includes(q);
          const matchVehicle = (b.vehicleName || '').toLowerCase().includes(q);
          return matchNumber || matchCustomer || matchPhone || matchVehicle;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'date') {
          const dateA = new Date(a.pickupDate || a.createdAt || 0).getTime();
          const dateB = new Date(b.pickupDate || b.createdAt || 0).getTime();
          diff = dateA - dateB;
        } else if (sortField === 'total') {
          diff = (a.totalPrice || 0) - (b.totalPrice || 0);
        } else if (sortField === 'remaining') {
          diff = getRemaining() - getRemaining();
        }
        return sortDirection === 'asc' ? diff : -diff;
      });
  }, [bookings, filterStatus, startDate, endDate, debouncedSearch, sortField, sortDirection]);

  // Paginated Slice
  const totalPages = Math.ceil(filteredBookings.length / pageSize) || 1;
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, currentPage, pageSize]);

  // Quick Copy to Clipboard
  const handleCopyBookingNumber = (bNumber: string) => {
    navigator.clipboard.writeText(bNumber);
    setCopiedId(bNumber);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedBookingIds.length === paginatedBookings.length) {
      setSelectedBookingIds([]);
    } else {
      setSelectedBookingIds(paginatedBookings.map((b) => b.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Batch action (Confirm or Reject)
  const handleExecuteBatchStatus = async (targetStatus: 'confirmed' | 'rejected') => {
    if (selectedBookingIds.length === 0) return;
    try {
      setIsBatchActionRunning(true);
      setActionError(null);
      for (const id of selectedBookingIds) {
        const targetBooking = bookings.find((b) => b.id === id);
        if (targetBooking && (targetBooking.status === 'new' || targetBooking.status === 'reviewing')) {
          await functionsService.updateBookingStatusSecure({
            bookingId: targetBooking.id,
            bookingNumber: targetBooking.bookingNumber || targetBooking.id,
            status: targetStatus,
          });
        }
      }
      setSelectedBookingIds([]);
      onRefreshData();
      setActionSuccess(`تم ${targetStatus === 'confirmed' ? 'تأكيد' : 'رفض'} الحجوزات المحددة بنجاح.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'حدث خطأ أثناء تنفيذ الإجراء الجماعي');
    } finally {
      setIsBatchActionRunning(false);
    }
  };

  // Export filtered results as CSV
  const handleExportFilteredCSV = () => {
    const headers = ['رقم الحجز', 'العميل', 'الهاتف', 'السيارة', 'تاريخ الاستلام', 'تاريخ الإعادة', 'المدة', 'الإجمالي', 'الحالة'];
    const rows = filteredBookings.map((b) => [
      `"${b.bookingNumber || ''}"`,
      `"${b.customerName || ''}"`,
      `"${b.customerPhone || ''}"`,
      `"${b.vehicleName || ''}"`,
      `"${b.pickupDate || ''}"`,
      `"${b.returnDate || ''}"`,
      b.rentalDays || 1,
      b.totalPrice || 0,
      `"${b.status}"`,
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shaker_filtered_bookings_${todayLocalISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      {/* Filter, Date Range & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Status Filter Pills with dynamic counts */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'all', label: 'الكل', count: counts.all },
              { id: 'new', label: 'طلبات جديدة', count: counts.new },
              { id: 'confirmed', label: 'مؤكدة', count: counts.confirmed },
              { id: 'rented', label: 'جاري التأجير', count: counts.rented },
              { id: 'completed', label: 'مكتملة', count: counts.completed },
              { id: 'cancelled', label: 'ملغاة ومرفوضة', count: counts.cancelled },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => {
                  setFilterStatus(st.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  filterStatus === st.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono ${
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
          <div className="relative w-full lg:w-80">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="بحث سريع (رقم الحجز، العميل، الهاتف، السيارة)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 pl-9 pr-9 text-xs text-white focus:outline-none focus:border-amber-500 placeholder-slate-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-white cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Second Row: Date Range Filters & Export Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-bold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>نطاق تاريخ الاستلام:</span>
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:border-amber-500 focus:outline-none"
              title="تاريخ البداية"
            />
            <span className="text-slate-500">إلى</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:border-amber-500 focus:outline-none"
              title="تاريخ النهاية"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[11px] text-amber-400 hover:underline px-2 cursor-pointer"
              >
                مسح التواريخ
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportFilteredCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
              title="تصدير الحجوزات المفلترة الحالية كملف CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>تصدير النتائج ({filteredBookings.length})</span>
            </button>
          </div>
        </div>

        {/* Batch Actions Bar (When multiple bookings selected) */}
        {selectedBookingIds.length > 0 && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white">
                تم تحديد <span className="font-mono text-amber-400 font-black">{selectedBookingIds.length}</span> حجز
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBatchActionRunning}
                onClick={() => handleExecuteBatchStatus('confirmed')}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <span>تأكيد المحددة</span>
              </button>
              <button
                type="button"
                disabled={isBatchActionRunning}
                onClick={() => handleExecuteBatchStatus('rejected')}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <span>رفض المحددة</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedBookingIds([])}
                className="px-2.5 py-1.5 text-slate-400 hover:text-white"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}
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

      {/* Bookings List Table & Mobile Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-3">
            <Calendar className="w-10 h-10 text-slate-500 mx-auto" />
            <p className="font-bold text-sm text-slate-300">لا توجد حجوزات مطابقة للبحث أو الفلتر المحدد</p>
            <p className="text-slate-500 text-[11px]">جرب تغيير حالة الفلتر أو مسح نص البحث أو تعديل نطاق التاريخ</p>
            {(filterStatus !== 'all' || searchInput || startDate || endDate) && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setSearchInput('');
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold cursor-pointer"
              >
                إعادة ضبط كافة الفلاتر
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                    <th className="p-3.5 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-slate-400 hover:text-white cursor-pointer"
                        title={selectedBookingIds.length === paginatedBookings.length ? 'إلغاء تحديد الكل' : 'تحديد كل الصفحة'}
                      >
                        {selectedBookingIds.length === paginatedBookings.length && paginatedBookings.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">رقم الحجز</th>
                    <th className="p-3.5">المستأجر</th>
                    <th className="p-3.5">السيارة</th>
                    <th className="p-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortField === 'date') {
                            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('date');
                            setSortDirection('desc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-white cursor-pointer"
                      >
                        <span>فترة الإيجار</span>
                        {sortField === 'date' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortField === 'total') {
                            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('total');
                            setSortDirection('desc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-white cursor-pointer"
                      >
                        <span>الإجمالي</span>
                        {sortField === 'total' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortField === 'remaining') {
                            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('remaining');
                            setSortDirection('desc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-white cursor-pointer"
                      >
                        <span>المتبقي</span>
                        {sortField === 'remaining' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </button>
                    </th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات والعمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {paginatedBookings.map((b) => {
                    const targetVehicle = vehicles.find((v) => v.id === b.vehicleId) || null;
                    const remaining = getRemaining();
                    const isSelected = selectedBookingIds.includes(b.id);

                    return (
                      <tr
                        key={b.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectOne(b.id)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center gap-1.5 font-mono font-black text-amber-400">
                            <span>{b.bookingNumber}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyBookingNumber(b.bookingNumber || b.id)}
                              className="text-slate-500 hover:text-amber-300 p-1 rounded transition-colors cursor-pointer"
                              title="نسخ رقم الحجز"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            {copiedId === (b.bookingNumber || b.id) && (
                              <span className="text-[10px] text-emerald-400 font-sans">تم النسخ</span>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-white">{b.customerName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
                              {b.customerPhone}
                            </span>
                            {b.customerPhone && (
                              <a
                                href={`tel:${b.customerPhone}`}
                                className="text-slate-500 hover:text-amber-400 p-0.5 rounded transition-colors"
                                title="اتصال مباشر"
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                            )}
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
                              disabled={!targetVehicle}
                              onClick={() => {
                                if (targetVehicle) {
                                  onOpenInspection(targetVehicle, b.id);
                                }
                              }}
                              className={`p-2 rounded-xl transition-colors ${
                                targetVehicle
                                  ? 'bg-slate-800 hover:bg-slate-700 text-blue-400 cursor-pointer'
                                  : 'bg-slate-800/40 text-slate-500 cursor-not-allowed opacity-50'
                              }`}
                              title={targetVehicle ? 'نموذج فحص واستلام السيارة' : 'تعذر الفحص: بيانات السيارة غير متوفرة في الأسطول الحالي'}
                              aria-label={targetVehicle ? 'نموذج فحص واستلام السيارة' : 'بيانات السيارة غير متوفرة'}
                            >
                              <ClipboardCheck className="w-[18px] h-[18px]" />
                            </button>

                            {/* Workflow Status Actions with Clear Separation & Safety Confirmation */}
                            {(b.status === 'new' || b.status === 'reviewing') && (
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={updatingBookingId === b.id}
                                  onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'confirmed' })}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap cursor-pointer"
                                  title="تأكيد طلب الحجز والانتقال لمرحلة التجهيز والتسليم"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{updatingBookingId === b.id ? '...' : 'تأكيد الحجز'}</span>
                                </button>

                                <div className="h-6 w-px bg-slate-700/80 mx-0.5" />

                                <button
                                  disabled={updatingBookingId === b.id}
                                  onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'rejected' })}
                                  className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 disabled:opacity-50 text-rose-300 hover:text-white border border-rose-500/40 font-black text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
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
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
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
                                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                                title="استلام السيارة من العميل وإرجاع حالتها إلى متاحة في الأسطول"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{updatingBookingId === b.id ? 'جاري الإتمام...' : 'استلام وإتمام'}</span>
                              </button>
                            )}

                            {/* Print rental contract (confirmed / rented / completed bookings) */}
                            {['confirmed', 'rented', 'completed'].includes(b.status) && (
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/contracts/${encodeURIComponent(b.id)}`)}
                                className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/30 transition-colors cursor-pointer"
                                title="عقد الإيجار (عرض وطباعة)"
                              >
                                <FileText className="w-[18px] h-[18px]" />
                              </button>
                            )}

                            {/* WhatsApp Chat */}
                            <button
                              onClick={() => handleWhatsAppToCustomer(b)}
                              className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
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
                              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors border border-rose-500/20 cursor-pointer"
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

            {/* Mobile Responsive Cards View (Visible on small screens) */}
            <div className="md:hidden divide-y divide-slate-800/80 p-3 space-y-3">
              {paginatedBookings.map((b) => {
                const targetVehicle = vehicles.find((v) => v.id === b.vehicleId) || null;
                const remaining = getRemaining();
                const isSelected = selectedBookingIds.includes(b.id);

                return (
                  <div
                    key={b.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/40'
                        : 'bg-slate-950/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectOne(b.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                        <span className="font-mono font-black text-amber-400 text-xs">
                          {b.bookingNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyBookingNumber(b.bookingNumber || b.id)}
                          className="text-slate-500 hover:text-amber-300 p-1"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      {getStatusBadge(b.status)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-[11px] text-slate-500 block">المستأجر:</span>
                        <span className="font-bold text-white">{b.customerName}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-slate-400 font-mono text-[11px]" dir="ltr">
                            {b.customerPhone}
                          </span>
                          {b.customerPhone && (
                            <a href={`tel:${b.customerPhone}`} className="text-amber-400">
                              <Phone className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 block">السيارة:</span>
                        <span className="font-bold text-white">{b.vehicleName}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-900 p-2.5 rounded-xl border border-slate-800/80">
                      <div>
                        <span className="text-[11px] text-slate-400 block">{b.pickupDate} إلى {b.returnDate}</span>
                        <span className="text-[10px] text-slate-500">المدة: {b.rentalDays} أيام</span>
                      </div>
                      <div className="text-left font-mono">
                        <span className="text-white font-bold block">${b.totalPrice}</span>
                        <span className={remaining > 0 ? 'text-rose-400 text-[11px]' : 'text-emerald-400 text-[11px]'}>
                          المتبقي: ${remaining}
                        </span>
                      </div>
                    </div>

                    {checkHasOverlappingBooking(b) && (
                      <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold">
                        ⚠️ يوجد طلب آخر متداخل على نفس السيارة
                      </div>
                    )}

                    {/* Mobile Action Buttons Row */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/60">
                      <button
                        disabled={!targetVehicle}
                        onClick={() => targetVehicle && onOpenInspection(targetVehicle, b.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-blue-400 text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        <span>فحص</span>
                      </button>

                      {(b.status === 'new' || b.status === 'reviewing') && (
                        <>
                          <button
                            disabled={updatingBookingId === b.id}
                            onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'confirmed' })}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تأكيد</span>
                          </button>
                          <button
                            disabled={updatingBookingId === b.id}
                            onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'rejected' })}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>رفض</span>
                          </button>
                        </>
                      )}

                      {b.status === 'confirmed' && (
                        <button
                          disabled={updatingBookingId === b.id}
                          onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'rented' })}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>تسليم</span>
                        </button>
                      )}

                      {b.status === 'rented' && (
                        <button
                          disabled={updatingBookingId === b.id}
                          onClick={() => setStatusActionConfirm({ booking: b, newStatus: 'completed' })}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>استلام</span>
                        </button>
                      )}

                      {/* Print rental contract (confirmed / rented / completed bookings) */}
                      {['confirmed', 'rented', 'completed'].includes(b.status) && (
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/contracts/${encodeURIComponent(b.id)}`)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="عقد الإيجار (عرض وطباعة)"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>العقد</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleWhatsAppToCustomer(b)}
                        className="p-1.5 rounded-xl bg-emerald-600/20 text-emerald-400"
                        title="واتساب"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setDeleteBookingError(null);
                          setBookingToDelete(b);
                        }}
                        className="p-1.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-slate-400">
                  عرض الصفحة <span className="font-bold text-white font-mono">{currentPage}</span> من{' '}
                  <span className="font-bold text-white font-mono">{totalPages}</span> (إجمالي{' '}
                  <span className="font-bold text-amber-400 font-mono">{filteredBookings.length}</span> حجز)
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNum = Math.min(totalPages - 4 + i, currentPage - 2 + i);
                    }
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-xl font-bold font-mono transition-all cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Booking Status Action Confirmation Modal */}
      {statusActionConfirm && (() => {
        const details = getActionModalDetails(statusActionConfirm.newStatus, statusActionConfirm.booking);
        const IconComponent = details.Icon;

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-h-[90vh] overflow-y-auto overscroll-contain p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-h-[90vh] overflow-y-auto overscroll-contain p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
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
                  } catch (err: unknown) {
                    console.error('Delete booking error:', err);
                    setDeleteBookingError(err instanceof Error ? err.message : 'عذراً، تعذر حذف الحجز.');
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

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
