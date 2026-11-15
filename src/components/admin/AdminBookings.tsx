import React, { useState, useMemo, useEffect } from 'react';
import { Booking, BookingStatus, AppSettings, Vehicle } from '../../types';
import { dataService } from '../../services/dataService';
import { functionsService } from '../../services/functionsService';
import { DEFAULT_SETTINGS } from '../../services/pricing';
import { useAuth } from '../../contexts/AuthContext';
import { Toast, ToastMessage } from '../common/Toast';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { formatDateDisplay } from '../../utils/format';
import { isAdminRole } from '../../utils/roles';
import { RentalContract } from '../RentalContract';
import { AdminBookingDetailsModal } from './AdminBookingDetailsModal';
import { BookingsFilterBar } from './bookings/BookingsFilterBar';
import { BookingsBatchBar } from './bookings/BookingsBatchBar';
import { BookingsTable } from './bookings/BookingsTable';
import { HandoverReturnModal } from './bookings/HandoverReturnModal';
import { Trash2 } from 'lucide-react';

export interface AdminBookingsProps {
  bookings: Booking[];
  setBookings?: React.Dispatch<React.SetStateAction<Booking[]>>;
  vehicles: Vehicle[];
  setVehicles?: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  settings?: AppSettings;
  logAction?: (action: string, details: string) => void;
  onRefreshData?: () => void;
  externalSearch?: string;
}

export const AdminBookings: React.FC<AdminBookingsProps> = ({
  bookings: propBookings,
  setBookings: propSetBookings,
  vehicles,
  setVehicles,
  settings = DEFAULT_SETTINGS,
  logAction: propLogAction,
  onRefreshData,
  externalSearch,
}) => {
  const { user, isAdmin } = useAuth();
  const [localBookings, setLocalBookings] = useState<Booking[]>(propBookings);
  useEffect(() => {
    const t = setTimeout(() => setLocalBookings(propBookings), 0);
    return () => clearTimeout(t);
  }, [propBookings]);

  const bookings = propSetBookings ? propBookings : localBookings;
  const setBookings: React.Dispatch<React.SetStateAction<Booking[]>> = (updater) => {
    if (propSetBookings) {
      propSetBookings(updater);
    } else {
      setLocalBookings(updater);
    }
    onRefreshData?.();
  };
  const logAction = (action: string, details: string) => {
    propLogAction?.(action, details);
  };

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
    setToast({ id: String(Date.now()), message, type });
  };
  const canDeleteBookings = isAdmin || isAdminRole(user?.role);

  const [bookingStatusFilter, setBookingStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [bookingSearch, setBookingSearch] = useState(externalSearch || '');
  useEffect(() => {
    if (externalSearch !== undefined) {
      const t = setTimeout(() => setBookingSearch(externalSearch), 0);
      return () => clearTimeout(t);
    }
  }, [externalSearch]);
  const [dateRangeFrom, setDateRangeFrom] = useState('');
  const [dateRangeTo, setDateRangeTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const [rejectModalBookingId, setRejectModalBookingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Handover & Return modal state
  const [handoverReturnTarget, setHandoverReturnTarget] = useState<{
    booking: Booking;
    mode: 'handover' | 'return';
  } | null>(null);

  // Contract printing view
  const [contractBooking, setContractBooking] = useState<Booking | null>(null);

  // Unified Booking Details Modal state
  const [detailsModalBooking, setDetailsModalBooking] = useState<{
    booking: Booking;
    initialTab?: 'info' | 'contract';
  } | null>(null);

  // Admin Delete Confirmation state
  const [deleteConfirmBooking, setDeleteConfirmBooking] = useState<Booking | null>(null);
  const [isDeletingBooking, setIsDeletingBooking] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const rejectModalRef = useFocusTrap({
    isOpen: Boolean(rejectModalBookingId),
    onClose: () => setRejectModalBookingId(null),
  });
  const deleteConfirmModalRef = useFocusTrap({
    isOpen: Boolean(deleteConfirmBooking),
    onClose: () => setDeleteConfirmBooking(null),
  });
  const batchDeleteModalRef = useFocusTrap({
    isOpen: showBatchDeleteConfirm,
    onClose: () => setShowBatchDeleteConfirm(false),
  });

  const [userDocsMap, setUserDocsMap] = useState<
    Record<
      string,
      {
        idCardFrontUrl?: string;
        idCardBackUrl?: string;
        driverLicenseUrl?: string;
        foreignerEntrySealUrl?: string;
        passportUrl?: string;
        identityDocChoice?: string;
      }
    >
  >({});

  const customerIdsKey = useMemo(() => {
    const ids = Array.from(
      new Set(bookings.map((b) => b.customerId).filter((id): id is string => Boolean(id)))
    );
    ids.sort();
    return ids.join(',');
  }, [bookings]);

  useEffect(() => {
    let isMounted = true;
    const customerIds = customerIdsKey ? customerIdsKey.split(',').filter(Boolean) : [];
    if (customerIds.length === 0) return;

    dataService
      .getUsersMapByIds(customerIds)
      .then((map) => {
        if (!isMounted) return;
        const docs: typeof userDocsMap = {};
        Object.entries(map).forEach(([uid, u]) => {
          docs[uid] = {
            idCardFrontUrl: u.idCardFrontUrl,
            idCardBackUrl: u.idCardBackUrl,
            driverLicenseUrl: u.driverLicenseUrl,
            foreignerEntrySealUrl: u.foreignerEntrySealUrl,
            passportUrl: u.passportUrl,
            identityDocChoice: u.identityDocChoice,
          };
        });
        setUserDocsMap(docs);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [customerIdsKey]);

  const customerBookingStats = useMemo(() => {
    const stats: Record<string, { total: number; rejected: number }> = {};
    bookings.forEach((b) => {
      const key = b.customerId || b.customerPhone;
      if (!key) return;
      if (!stats[key]) stats[key] = { total: 0, rejected: 0 };
      stats[key].total += 1;
      if (b.status === 'rejected') stats[key].rejected += 1;
    });
    return stats;
  }, [bookings]);

  const statusCounts = useMemo(
    () => ({
      all: bookings.length,
      new: bookings.filter((b) => b.status === 'new').length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
      rented: bookings.filter((b) => b.status === 'rented').length,
      completed: bookings.filter((b) => b.status === 'completed').length,
      rejected: bookings.filter((b) => b.status === 'rejected' || b.status === 'cancelled').length,
    }),
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesStatus =
        bookingStatusFilter === 'all' ||
        (bookingStatusFilter === 'rejected'
          ? b.status === 'rejected' || b.status === 'cancelled'
          : b.status === bookingStatusFilter);
      const q = bookingSearch.toLowerCase();
      const matchesSearch =
        (b.customerName || '').toLowerCase().includes(q) ||
        (b.customerPhone || '').includes(bookingSearch) ||
        (b.vehicleName || '').toLowerCase().includes(q) ||
        (b.bookingNumber || '').toLowerCase().includes(q);

      const matchesFrom = !dateRangeFrom || b.pickupDate >= dateRangeFrom;
      const matchesTo = !dateRangeTo || b.pickupDate <= dateRangeTo;

      return matchesStatus && matchesSearch && matchesFrom && matchesTo;
    });
  }, [bookings, bookingStatusFilter, bookingSearch, dateRangeFrom, dateRangeTo]);

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1);
    }, 0);
  }, [bookingStatusFilter, bookingSearch, dateRangeFrom, dateRangeTo]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredBookings.slice(start, start + PAGE_SIZE);
  }, [filteredBookings, currentPage]);

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: BookingStatus) => {
    const target = bookings.find((b) => b.id === bookingId);
    const res = await functionsService.updateBookingStatusSecure({
      bookingId,
      nextStatus: newStatus,
    });
    if (!res.success) {
      showToast(res.error || 'تعذر تحديث حالة الحجز. يرجى المحاولة مرة أخرى.', 'error');
      return;
    }
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
    );
    showToast('تم تحديث حالة الحجز بنجاح', 'success');
    logAction(
      'تحديث حالة حجز',
      `تغيير حالة حجز العميل ${target?.customerName || ''} إلى ${newStatus}`
    );
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalBookingId) return;
    const target = bookings.find((b) => b.id === rejectModalBookingId);
    const res = await functionsService.updateBookingStatusSecure({
      bookingId: rejectModalBookingId,
      nextStatus: 'rejected',
      reason: rejectionReason,
    });
    if (!res.success) {
      showToast(res.error || 'تعذر رفض الحجز. يرجى المحاولة مرة أخرى.', 'error');
      return;
    }
    setBookings((prev) =>
      prev.map((b) =>
        b.id === rejectModalBookingId
          ? { ...b, status: 'rejected', rejectionReason }
          : b
      )
    );
    logAction(
      'رفض حجز',
      `رفض حجز العميل ${target?.customerName || ''}: ${rejectionReason}`
    );
    setRejectModalBookingId(null);
    setRejectionReason('');
  };

  const handleHandoverReturnSuccess = (updated: {
    bookingId: string;
    nextStatus: 'rented' | 'completed';
    mileageAtPickup?: number;
    mileageAtReturn?: number;
    returnCondition?: string;
    extraCharges?: number;
  }) => {
    const target = bookings.find((b) => b.id === updated.bookingId);
    setBookings((prev) =>
      prev.map((b) =>
        b.id === updated.bookingId
          ? {
              ...b,
              status: updated.nextStatus,
              ...(updated.mileageAtPickup !== undefined
                ? { mileageAtPickup: updated.mileageAtPickup }
                : {}),
              ...(updated.mileageAtReturn !== undefined
                ? { mileageAtReturn: updated.mileageAtReturn }
                : {}),
              ...(updated.returnCondition !== undefined
                ? { returnCondition: updated.returnCondition }
                : {}),
              ...(updated.extraCharges !== undefined
                ? { extraCharges: updated.extraCharges }
                : {}),
              updatedAt: new Date().toISOString(),
            }
          : b
      )
    );

    if (setVehicles && target?.vehicleId) {
      const latestMileage = updated.mileageAtReturn ?? updated.mileageAtPickup;
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === target.vehicleId
            ? {
                ...v,
                status: updated.nextStatus === 'rented' ? 'rented' : 'available',
                ...(latestMileage !== undefined ? { currentMileage: latestMileage } : {}),
              }
            : v
        )
      );
    }

    setDetailsModalBooking((prev) =>
      prev && prev.booking.id === updated.bookingId
        ? {
            ...prev,
            booking: {
              ...prev.booking,
              status: updated.nextStatus,
              ...(updated.mileageAtPickup !== undefined
                ? { mileageAtPickup: updated.mileageAtPickup }
                : {}),
              ...(updated.mileageAtReturn !== undefined
                ? { mileageAtReturn: updated.mileageAtReturn }
                : {}),
              ...(updated.returnCondition !== undefined
                ? { returnCondition: updated.returnCondition }
                : {}),
              ...(updated.extraCharges !== undefined
                ? { extraCharges: updated.extraCharges }
                : {}),
              updatedAt: new Date().toISOString(),
            },
          }
        : prev
    );

    showToast(
      updated.nextStatus === 'rented'
        ? 'تم تسليم السيارة للعميل وتفعيل العقد بنجاح'
        : 'تم استلام السيارة من العميل وتحديث عداد الكيلومترات وإغلاق العقد بنجاح',
      'success'
    );

    logAction(
      updated.nextStatus === 'rented' ? 'تسليم السيارة للعميل' : 'استلام السيارة من العميل',
      `${updated.nextStatus === 'rented' ? 'تسليم' : 'استلام'} مركبة الحجز #${target?.bookingNumber || updated.bookingId.slice(-6).toUpperCase()}`
    );
  };

  const toggleSelectBooking = (id: string) => {
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllBookings = () => {
    if (selectedBookingIds.length === filteredBookings.length) {
      setSelectedBookingIds([]);
    } else {
      setSelectedBookingIds(filteredBookings.map((b) => b.id));
    }
  };

  const handleBatchUpdateStatus = async (newStatus: BookingStatus) => {
    if (selectedBookingIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      const eligibleIds = selectedBookingIds.filter((id) => {
        const b = bookings.find((item) => item.id === id);
        if (!b) return false;
        if (newStatus === 'confirmed' || newStatus === 'rejected') {
          return b.status === 'new' || b.status === 'reviewing';
        }
        return true;
      });
      const skippedCount = selectedBookingIds.length - eligibleIds.length;
      if (eligibleIds.length === 0) {
        showToast(
          `لا يمكن تطبيق هذا الإجراء على الحجوزات المحددة (${skippedCount} حجز بحالة غير متوافقة).`,
          'warning'
        );
        return;
      }

      const results = await Promise.all(
        eligibleIds.map((id) =>
          functionsService.updateBookingStatusSecure({
            bookingId: id,
            nextStatus: newStatus,
          })
        )
      );
      const succeededIds = eligibleIds.filter((_, idx) => results[idx]?.success);
      const failedCount = eligibleIds.length - succeededIds.length;

      if (succeededIds.length > 0) {
        setBookings((prev) =>
          prev.map((b) =>
            succeededIds.includes(b.id) ? { ...b, status: newStatus } : b
          )
        );
        logAction(
          'تحديث جماعي للحجوزات',
          `تحديث حالة ${succeededIds.length} حجز إلى ${newStatus}`
        );
      }

      if (failedCount > 0 || skippedCount > 0) {
        showToast(
          `تم تحديث ${succeededIds.length} حجز بنجاح، وتخطي/فشل ${failedCount + skippedCount} حجز.`,
          'warning'
        );
      } else {
        showToast(`تم تحديث ${succeededIds.length} حجز بنجاح`, 'success');
      }
      setSelectedBookingIds([]);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleDeleteSingleBooking = async () => {
    if (!deleteConfirmBooking) return;
    setIsDeletingBooking(true);
    try {
      const res = await functionsService.deleteBookingByAdmin({
        bookingIds: [deleteConfirmBooking.id],
      });
      if (!res.success) {
        showToast(res.error || 'تعذر حذف الحجز. يرجى المحاولة مرة أخرى.', 'error');
        return;
      }
      const deletedId = deleteConfirmBooking.id;
      setBookings((prev) => prev.filter((b) => b.id !== deletedId));
      setSelectedBookingIds((prev) => prev.filter((id) => id !== deletedId));
      if (detailsModalBooking?.booking.id === deletedId) {
        setDetailsModalBooking(null);
      }
      showToast('تم حذف الحجز نهائياً بنجاح', 'success');
      logAction(
        'حذف حجز نهائياً',
        `حذف حجز العميل ${deleteConfirmBooking.customerName} (#${deleteConfirmBooking.bookingNumber || deletedId.slice(-6)})`
      );
      setDeleteConfirmBooking(null);
    } finally {
      setIsDeletingBooking(false);
    }
  };

  const handleBatchDeleteBookings = async () => {
    if (selectedBookingIds.length === 0) return;
    setIsBatchProcessing(true);
    try {
      const res = await functionsService.deleteBookingByAdmin({
        bookingIds: selectedBookingIds,
      });
      if (!res.success) {
        showToast(res.error || 'تعذر حذف الحجوزات المحددة.', 'error');
        return;
      }
      const deletedSet = new Set(selectedBookingIds);
      setBookings((prev) => prev.filter((b) => !deletedSet.has(b.id)));
      showToast(`تم حذف ${res.data?.deletedCount || selectedBookingIds.length} حجز نهائياً`, 'success');
      logAction('حذف جماعي للحجوزات', `حذف ${selectedBookingIds.length} حجز نهائياً`);
      setSelectedBookingIds([]);
      setShowBatchDeleteConfirm(false);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const exportBookingsCSV = () => {
    const headers = [
      'رقم الحجز',
      'العميل',
      'الهاتف',
      'العنوان',
      'السيارة',
      'تاريخ الاستلام',
      'تاريخ الإرجاع',
      'الأيام',
      'عداد التسليم',
      'عداد الإرجاع',
      'الإجمالي ($)',
      'الحالة',
      'ملاحظات',
    ];
    const rows = filteredBookings.map((b) => [
      b.bookingNumber || b.id,
      `"${(b.customerName || '').replace(/"/g, '""')}"`,
      `"${b.customerPhone || ''}"`,
      `"${(b.customerAddress || '').replace(/"/g, '""')}"`,
      `"${(b.vehicleName || '').replace(/"/g, '""')}"`,
      formatDateDisplay(b.pickupDate),
      formatDateDisplay(b.returnDate),
      b.rentalDays,
      b.mileageAtPickup ?? '',
      b.mileageAtReturn ?? '',
      b.totalPrice,
      b.status,
      `"${(b.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `shaker_bookings_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (contractBooking) {
    const matchedVehicle = vehicles.find((v) => v.id === contractBooking.vehicleId) || null;
    return (
      <RentalContract
        booking={contractBooking}
        settings={settings}
        vehicle={matchedVehicle}
        onBack={() => setContractBooking(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <BookingsFilterBar
        bookingStatusFilter={bookingStatusFilter}
        onStatusFilterChange={setBookingStatusFilter}
        bookingSearch={bookingSearch}
        onSearchChange={setBookingSearch}
        dateRangeFrom={dateRangeFrom}
        onDateFromChange={setDateRangeFrom}
        dateRangeTo={dateRangeTo}
        onDateToChange={setDateRangeTo}
        onClearDates={() => {
          setDateRangeFrom('');
          setDateRangeTo('');
        }}
        onExportCSV={exportBookingsCSV}
        statusCounts={statusCounts}
      />

      <BookingsBatchBar
        selectedCount={selectedBookingIds.length}
        isBatchProcessing={isBatchProcessing}
        canDeleteBookings={canDeleteBookings}
        onBatchConfirm={() => handleBatchUpdateStatus('confirmed')}
        onBatchReject={() => handleBatchUpdateStatus('rejected')}
        onOpenBatchDelete={() => setShowBatchDeleteConfirm(true)}
        onClearSelection={() => setSelectedBookingIds([])}
      />

      <BookingsTable
        paginatedBookings={paginatedBookings}
        totalFilteredCount={filteredBookings.length}
        selectedBookingIds={selectedBookingIds}
        onToggleSelectAll={toggleSelectAllBookings}
        onToggleSelectBooking={toggleSelectBooking}
        userDocsMap={userDocsMap}
        customerBookingStats={customerBookingStats}
        canDeleteBookings={canDeleteBookings}
        onOpenDetails={(booking) => setDetailsModalBooking({ booking, initialTab: 'info' })}
        onUpdateStatus={handleUpdateBookingStatus}
        onOpenRejectModal={(bookingId) => setRejectModalBookingId(bookingId)}
        onOpenHandover={(booking) => setHandoverReturnTarget({ booking, mode: 'handover' })}
        onOpenReturn={(booking) => setHandoverReturnTarget({ booking, mode: 'return' })}
        onOpenContract={(booking) => setContractBooking(booking)}
        onOpenDeleteConfirm={(booking) => setDeleteConfirmBooking(booking)}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* Reject Reason Modal */}
      {rejectModalBookingId && (
        <div className="fixed inset-0 z-50 bg-brand-obsidian/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            ref={rejectModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-booking-modal-title"
            className="bg-brand-surface border border-brand-border rounded-modal max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain p-section space-y-4 shadow-card"
          >
            <h3 id="reject-booking-modal-title" className="text-lg font-extrabold text-brand-text">
              سبب رفض الحجز
            </h3>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="reject-booking-reason"
                  className="block text-sm font-semibold text-brand-muted mb-1.5 cursor-pointer"
                >
                  يرجى توضيح سبب الرفض (يُحفظ في السجل)
                </label>
                <textarea
                  id="reject-booking-reason"
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="مثال: الوثائق غير واضحة، أو السيارة محجوزة..."
                  className="w-full bg-brand-obsidian border border-brand-border rounded-card px-3 py-2 text-base sm:text-sm text-brand-text placeholder:text-slate-400 focus:outline-none focus:border-status-danger-solid"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalBookingId(null)}
                  className="flex-1 min-h-11 py-2.5 rounded-card bg-brand-elevated hover:bg-brand-border text-brand-text font-bold text-sm cursor-pointer border border-brand-border"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-11 py-2.5 rounded-card bg-status-danger-solid hover:opacity-90 text-brand-text font-extrabold text-sm cursor-pointer"
                >
                  تأكيد الرفض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Handover & Return Odometer Modal */}
      {handoverReturnTarget && (
        <HandoverReturnModal
          mode={handoverReturnTarget.mode}
          booking={handoverReturnTarget.booking}
          vehicle={vehicles.find((v) => v.id === handoverReturnTarget.booking.vehicleId) || null}
          onClose={() => setHandoverReturnTarget(null)}
          onSuccess={handleHandoverReturnSuccess}
        />
      )}

      {/* Unified Booking Details Modal (7 Sections) */}
      {detailsModalBooking && (
        <AdminBookingDetailsModal
          booking={detailsModalBooking.booking}
          vehicle={vehicles.find((v) => v.id === detailsModalBooking.booking.vehicleId) || null}
          settings={settings}
          userDocs={
            detailsModalBooking.booking.customerId
              ? userDocsMap[detailsModalBooking.booking.customerId]
              : undefined
          }
          initialTab={detailsModalBooking.initialTab}
          onClose={() => setDetailsModalBooking(null)}
          onOpenHandover={(booking) => setHandoverReturnTarget({ booking, mode: 'handover' })}
          onOpenReturn={(booking) => setHandoverReturnTarget({ booking, mode: 'return' })}
        />
      )}

      {/* Single Booking Delete Confirmation Modal */}
      {deleteConfirmBooking && (
        <div className="fixed inset-0 z-50 bg-brand-obsidian/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            ref={deleteConfirmModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-booking-modal-title"
            className="bg-brand-surface border border-status-danger-border rounded-modal max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain p-section space-y-4 shadow-card"
          >
            <div className="flex items-center gap-3 text-status-danger">
              <div className="w-10 h-10 rounded-card bg-status-danger-bg border border-status-danger-border flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-booking-modal-title" className="text-base font-extrabold text-brand-text">
                  تأكيد حذف الحجز نهائياً
                </h3>
                <p className="text-sm text-brand-muted">هذا الإجراء خاص بالمدير ولا يمكن التراجع عنه</p>
              </div>
            </div>
            <div className="bg-brand-obsidian border border-brand-border rounded-card p-3.5 text-sm space-y-1.5 text-brand-muted">
              <div>
                <span>العميل: </span>
                <span className="font-bold text-brand-text">{deleteConfirmBooking.customerName}</span>
              </div>
              <div>
                <span>السيارة: </span>
                <span className="font-bold text-brand-gold-light">{deleteConfirmBooking.vehicleName}</span>
              </div>
              <div>
                <span>رقم الحجز: </span>
                <span className="font-mono text-brand-text">
                  #{deleteConfirmBooking.bookingNumber || deleteConfirmBooking.id.slice(-6).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingBooking}
                onClick={() => setDeleteConfirmBooking(null)}
                className="flex-1 min-h-11 py-2.5 rounded-card bg-brand-elevated hover:bg-brand-border text-brand-text font-bold text-sm cursor-pointer border border-brand-border"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeletingBooking}
                onClick={handleDeleteSingleBooking}
                className="flex-1 min-h-11 py-2.5 rounded-card bg-status-danger-solid hover:opacity-90 disabled:opacity-50 text-brand-text font-extrabold text-sm cursor-pointer"
              >
                {isDeletingBooking ? 'جاري الحذف...' : 'حذف الحجز نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-brand-obsidian/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            ref={batchDeleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-delete-booking-modal-title"
            className="bg-brand-surface border border-status-danger-border rounded-modal max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain p-section space-y-4 shadow-card"
          >
            <div className="flex items-center gap-3 text-status-danger">
              <div className="w-10 h-10 rounded-card bg-status-danger-bg border border-status-danger-border flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="batch-delete-booking-modal-title" className="text-base font-extrabold text-brand-text">
                  حذف {selectedBookingIds.length} حجز نهائياً
                </h3>
                <p className="text-sm text-brand-muted">سيتم مسح جميع الحجوزات المحددة وعقودها المرتبطة</p>
              </div>
            </div>
            <p className="text-sm text-brand-text leading-relaxed">
              هل أنت متأكد من رغبتك في حذف <strong>{selectedBookingIds.length}</strong> حجز بشكل نهائي من قاعدة البيانات؟
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="flex-1 min-h-11 py-2.5 rounded-card bg-brand-elevated hover:bg-brand-border text-brand-text font-bold text-sm cursor-pointer border border-brand-border"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={handleBatchDeleteBookings}
                className="flex-1 min-h-11 py-2.5 rounded-card bg-status-danger-solid hover:opacity-90 disabled:opacity-50 text-brand-text font-extrabold text-sm cursor-pointer"
              >
                {isBatchProcessing ? 'جاري الحذف...' : `تأكيد حذف (${selectedBookingIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
