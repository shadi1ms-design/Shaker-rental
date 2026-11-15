import React from 'react';
import { AlertCircle, Car, MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import { Booking } from '../../types';
import { formatDateDisplay } from '../../utils/dateUtils';
import { formatMoney } from '../../utils/format';
import { formatSavedBookingDiscountLabel } from '../../shared/discount';
import { openWhatsAppChat } from '../../services/whatsapp';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { EmptyState } from '../common/EmptyState';
import { ConfirmModal } from '../common/ConfirmModal';

const CANCELLABLE = ['new', 'reviewing', 'confirmed'];

export interface BookingsTabProps {
  sortedBookings: Booking[];
  directCustomerBookings: Booking[] | null;
  bookingsTimedOut: boolean;
  bookingsError: string | null;
  isRetryingBookings: boolean;
  onRetryBookings: () => void;
  cancelTarget: Booking | null;
  onCancelTargetChange: (booking: Booking | null) => void;
  isCancelling: boolean;
  cancelError: string | null;
  onClearCancelError: () => void;
  onConfirmCancel: () => void;
  onOpenBooking: () => void;
}

export const BookingsTab: React.FC<BookingsTabProps> = ({
  sortedBookings,
  directCustomerBookings,
  bookingsTimedOut,
  bookingsError,
  isRetryingBookings,
  onRetryBookings,
  cancelTarget,
  onCancelTargetChange,
  isCancelling,
  cancelError,
  onClearCancelError,
  onConfirmCancel,
  onOpenBooking,
}) => {
  return (
    <div className="space-y-3">
      {cancelError && (
        <div role="alert" className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm flex items-start justify-between gap-2">
          <span>{cancelError}</span>
          <button type="button" onClick={onClearCancelError} className="font-bold underline shrink-0 min-h-11 px-2 inline-flex items-center">إغلاق</button>
        </div>
      )}
      {bookingsError ? (
        <div className="p-8 text-center rounded-card bg-slate-900 border border-rose-500/30 text-rose-300 space-y-4">
          <div className="w-14 h-14 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-white">تعذر تحميل قائمة الحجوزات</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">{bookingsError}</p>
          </div>
          <button
            type="button"
            onClick={onRetryBookings}
            disabled={isRetryingBookings}
            className="px-4 py-2 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRetryingBookings ? 'animate-spin' : ''}`} />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      ) : (sortedBookings.length === 0 && directCustomerBookings === null && !bookingsTimedOut) || isRetryingBookings ? (
        <SkeletonLoader type="card" lines={3} className="!grid-cols-1 sm:!grid-cols-1 lg:!grid-cols-1" />
      ) : sortedBookings.length === 0 ? (
        <EmptyState
          icon={Car}
          title="لا توجد حجوزات مسجلة حتى الآن"
          description="يمكنك تصفح أسطول سياراتنا المميز في دمشق وحجز سيارتك المفضلة فوراً"
          actionLabel="احجز سيارتك الآن"
          onAction={onOpenBooking}
        />
      ) : (
        <div className="space-y-3">
          {sortedBookings.map((booking) => {
            const isActive = ['new', 'reviewing', 'confirmed', 'rented'].includes(String(booking.status));
            return (
              <div
                key={booking.id}
                className={`p-4 rounded-card border transition-all text-sm ${
                  isActive
                    ? 'bg-slate-950/70 border-slate-800/80 hover:border-amber-500/30'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-80'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-extrabold text-white text-sm truncate">{booking.vehicleName || 'سيارة شاكر'}</span>
                    <span className="tabular-nums text-xs text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {booking.bookingNumber || booking.id.substring(0, 8)}
                    </span>
                  </div>
                  <StatusBadge status={String(booking.status)} type="booking" size="md" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300 mb-3">
                  <div>
                    <span className="text-slate-400 block text-sm">تاريخ الاستلام:</span>
                    <span className="tabular-nums"><span dir="ltr" className="inline-block font-mono">{formatDateDisplay(booking.pickupDate)}</span> ({booking.pickupTime})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-sm">تاريخ الإرجاع:</span>
                    <span className="tabular-nums"><span dir="ltr" className="inline-block font-mono">{formatDateDisplay(booking.returnDate)}</span> ({booking.returnTime})</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                  <div className="space-y-1">
                    <div className="font-bold text-amber-400 tabular-nums">
                      الإجمالي: {formatMoney(booking.finalTotal ?? booking.totalPrice ?? 0)}
                    </div>
                    {(() => {
                      const discountLabel = formatSavedBookingDiscountLabel({
                        discountAmount: booking.discountAmount,
                        discountPercentage: booking.discountPercentage,
                        discountBase: booking.discountBase,
                        basePrice: booking.basePrice,
                      });
                      const hasBreakdown =
                        discountLabel ||
                        Number(booking.basePrice || 0) > 0 ||
                        Number(booking.insuranceAmount || 0) > 0 ||
                        Number(booking.driverFee || 0) > 0 ||
                        Number(booking.extraCharges || 0) > 0;
                      if (!hasBreakdown) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 tabular-nums">
                          {Number(booking.basePrice || 0) > 0 && (
                            <span>الإيجار: {formatMoney(booking.basePrice)}</span>
                          )}
                          {discountLabel && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                              <Sparkles className="w-3 h-3" />
                              <span>{discountLabel}</span>
                            </span>
                          )}
                          {Number(booking.insuranceAmount || 0) > 0 && (
                            <span>التأمين: {formatMoney(booking.insuranceAmount)}</span>
                          )}
                          {Number(booking.driverFee || 0) > 0 && (
                            <span>السائق: {formatMoney(booking.driverFee)}</span>
                          )}
                          {Number(booking.extraCharges || 0) > 0 && (
                            <span className="text-rose-300 font-bold">
                              إضافي: +{formatMoney(booking.extraCharges)}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {CANCELLABLE.includes(String(booking.status)) && (
                      <button
                        type="button"
                        onClick={() => onCancelTargetChange(booking)}
                        className="px-3.5 py-2 min-h-11 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-sm font-bold transition inline-flex items-center"
                      >
                        إلغاء الحجز
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openWhatsAppChat(booking)}
                      className="px-3.5 py-2 min-h-11 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-sm font-bold transition flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>تواصل واتساب</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(cancelTarget)}
        type="danger"
        title="إلغاء الحجز"
        message={`هل تريد إلغاء حجز ${cancelTarget?.vehicleName || 'السيارة'} رقم ${cancelTarget?.bookingNumber || ''}؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="نعم، إلغاء الحجز"
        cancelLabel="تراجع"
        isLoading={isCancelling}
        onConfirm={onConfirmCancel}
        onCancel={() => onCancelTargetChange(null)}
      />
    </div>
  );
};
