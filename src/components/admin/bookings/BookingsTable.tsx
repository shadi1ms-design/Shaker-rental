import React from 'react';
import { Booking, BookingStatus } from '../../../types';
import { StatusBadge } from '../../common/StatusBadge';
import { formatDateDisplay, formatMoney } from '../../../utils/format';
import { formatSavedBookingDiscountLabel } from '../../../shared/discount';
import { getWhatsAppChatUrl } from '../../../services/whatsapp';
import {
  CheckCircle,
  XCircle,
  MessageCircle,
  Sparkles,
  AlertTriangle,
  MapPin,
  Printer,
  Key,
  CheckCircle2,
  Eye,
  Trash2,
  Gauge,
  User,
} from 'lucide-react';

export interface BookingsTableProps {
  paginatedBookings: Booking[];
  totalFilteredCount: number;
  selectedBookingIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectBooking: (id: string) => void;
  userDocsMap: Record<
    string,
    {
      idCardFrontUrl?: string;
      idCardBackUrl?: string;
      driverLicenseUrl?: string;
      foreignerEntrySealUrl?: string;
      passportUrl?: string;
      identityDocChoice?: string;
    }
  >;
  customerBookingStats: Record<string, { total: number; rejected: number }>;
  canDeleteBookings: boolean;
  onOpenDetails: (booking: Booking, initialSection?: string) => void;
  onUpdateStatus: (bookingId: string, newStatus: BookingStatus) => void;
  onOpenRejectModal: (bookingId: string) => void;
  onOpenHandover: (booking: Booking) => void;
  onOpenReturn: (booking: Booking) => void;
  onOpenContract: (booking: Booking) => void;
  onOpenDeleteConfirm: (booking: Booking) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const BookingsTable: React.FC<BookingsTableProps> = ({
  paginatedBookings,
  totalFilteredCount,
  selectedBookingIds,
  onToggleSelectAll,
  onToggleSelectBooking,
  customerBookingStats,
  canDeleteBookings,
  onOpenDetails,
  onUpdateStatus,
  onOpenRejectModal,
  onOpenHandover,
  onOpenReturn,
  onOpenContract,
  onOpenDeleteConfirm,
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-card overflow-hidden shadow-card">
      {/* Mobile Cards View (< 768px) */}
      <div className="md:hidden divide-y divide-brand-border/70">
        {paginatedBookings.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-brand-obsidian border-b border-brand-border text-sm text-brand-muted">
            <label className="inline-flex items-center gap-2 min-h-11 cursor-pointer select-none">
              <input
                type="checkbox"
                aria-label="تحديد جميع الحجوزات"
                checked={
                  paginatedBookings.length > 0 &&
                  selectedBookingIds.length === totalFilteredCount
                }
                onChange={onToggleSelectAll}
                className="w-4 h-4 accent-brand-gold rounded cursor-pointer"
              />
              <span className="font-bold text-brand-text">تحديد الكل ({totalFilteredCount})</span>
            </label>
          </div>
        )}

        {paginatedBookings.map((b) => {
          const custKey = b.customerId || b.customerPhone;
          const stats = custKey ? customerBookingStats[custKey] : undefined;
          const isSelected = selectedBookingIds.includes(b.id);

          return (
            <div
              key={b.id}
              onClick={() => onOpenDetails(b)}
              className={`p-4 space-y-3 transition-colors cursor-pointer ${
                isSelected ? 'bg-brand-gold-bg' : 'hover:bg-brand-elevated/40'
              }`}
            >
              {/* Top row: Checkbox + Booking Number + Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <label className="min-w-11 min-h-11 -ms-2 -mt-2 inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        aria-label={`تحديد حجز ${b.customerName}`}
                        checked={isSelected}
                        onChange={() => onToggleSelectBooking(b.id)}
                        className="w-4 h-4 accent-brand-gold rounded cursor-pointer"
                      />
                    </label>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {b.bookingNumber && (
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-brand-gold-bg text-status-new border border-brand-gold-border">
                          {b.bookingNumber}
                        </span>
                      )}
                      <span className="font-bold text-base text-brand-text truncate">{b.customerName}</span>
                    </div>

                    {((stats && stats.total > 1) || (stats && stats.rejected > 0)) && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {stats && stats.total > 1 && (
                          <span
                            title={`لدى هذا العميل ${stats.total} حجوزات`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-800/80 text-sky-300 border border-sky-500/25"
                          >
                            <User className="w-3 h-3 text-sky-400 shrink-0" />
                            <span>عميل سابق · {stats.total} حجوزات</span>
                          </span>
                        )}
                        {stats && stats.rejected > 0 && (
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-status-danger-bg text-status-danger border border-status-danger-border inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>مرفوض سابقاً ({stats.rejected})</span>
                          </span>
                        )}
                      </div>
                    )}

                    <div dir="ltr" className="text-sm text-brand-muted text-right font-mono">
                      {b.customerPhone}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <StatusBadge status={b.status} type="booking" />
                </div>
              </div>

              {b.customerAddress && (
                <div className="text-xs text-brand-muted flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-gold-light shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{b.customerAddress}</span>
                </div>
              )}

              {/* Vehicle & Price Card */}
              <div className="bg-brand-obsidian/70 border border-brand-border rounded-card p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-brand-text">{b.vehicleName}</span>
                  <span className="font-extrabold text-brand-gold-light shrink-0">{formatMoney(b.totalPrice)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-muted">
                  <span>
                    من: <span dir="ltr" className="font-mono font-bold text-brand-text">{formatDateDisplay(b.pickupDate)}</span> ({b.pickupTime})
                  </span>
                  <span>
                    إلى: <span dir="ltr" className="font-mono font-bold text-brand-text">{formatDateDisplay(b.returnDate)}</span> ({b.returnTime})
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-brand-muted">
                  <span>{b.rentalDays} أيام</span>
                  {(() => {
                    const discountLabel = formatSavedBookingDiscountLabel({
                      discountAmount: b.discountAmount,
                      discountPercentage: b.discountPercentage,
                      discountBase: b.discountBase,
                      basePrice: b.basePrice,
                    });
                    if (!discountLabel) return null;
                    return (
                      <span
                        title={discountLabel}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-status-confirmed-bg text-status-confirmed border border-status-confirmed-border font-bold"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{discountLabel}</span>
                      </span>
                    );
                  })()}
                  {b.extraCharges && b.extraCharges > 0 ? (
                    <span className="text-status-danger font-bold">
                      (+{formatMoney(b.extraCharges)} رسوم إضافية)
                    </span>
                  ) : null}
                </div>
                {(b.mileageAtPickup !== undefined || b.mileageAtReturn !== undefined) && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {b.mileageAtPickup !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-elevated text-brand-text border border-brand-border font-mono text-xs">
                        <Gauge className="w-3 h-3 text-brand-gold-light" />
                        تسليم: {b.mileageAtPickup.toLocaleString('en-US')} كم
                      </span>
                    )}
                    {b.mileageAtReturn !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-status-confirmed-bg text-status-confirmed border border-status-confirmed-border font-mono text-xs">
                        <Gauge className="w-3 h-3 text-status-confirmed-dot" />
                        إرجاع: {b.mileageAtReturn.toLocaleString('en-US')} كم
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                {(b.status === 'new' || b.status === 'reviewing') && (
                  <>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(b.id, 'confirmed')}
                      className="min-h-11 px-3 py-2 rounded-lg bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian border border-status-confirmed-border text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="تأكيد الحجز"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>تأكيد</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenRejectModal(b.id)}
                      className="min-h-11 px-3 py-2 rounded-lg bg-status-danger-bg hover:bg-status-danger-solid text-status-danger hover:text-brand-text border border-status-danger-border text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="رفض الحجز"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>رفض</span>
                    </button>
                  </>
                )}

                {b.status === 'confirmed' && (
                  <button
                    type="button"
                    onClick={() => onOpenHandover(b)}
                    className="min-h-11 px-3 py-2 rounded-lg bg-status-rented-bg hover:bg-status-rented-solid text-status-rented hover:text-brand-obsidian text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-status-rented-border"
                    title="تسليم السيارة للعميل وتفعيل الإيجار"
                  >
                    <Key className="w-4 h-4" />
                    <span>تسليم السيارة</span>
                  </button>
                )}

                {b.status === 'rented' && (
                  <button
                    type="button"
                    onClick={() => onOpenReturn(b)}
                    className="min-h-11 px-3 py-2 rounded-lg bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-status-confirmed-border"
                    title="استلام السيارة من العميل وتسجيل العداد وإتمام الحجز"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>استلام السيارة</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenDetails(b)}
                  className="min-h-11 px-3 py-2 rounded-lg bg-brand-gold-bg hover:bg-brand-gold text-status-new hover:text-brand-obsidian text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-brand-gold-border"
                  title="عرض ملف الحجز الكامل (7 أقسام)"
                >
                  <Eye className="w-4 h-4" />
                  <span>تفاصيل الحجز</span>
                </button>

                {['confirmed', 'rented', 'completed'].includes(b.status) && (
                  <button
                    type="button"
                    onClick={() => onOpenContract(b)}
                    className="min-h-11 px-3 py-2 rounded-lg bg-brand-elevated hover:bg-brand-gold text-brand-text hover:text-brand-obsidian text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-brand-border"
                    title="طباعة العقد الرسمي"
                  >
                    <Printer className="w-4 h-4" />
                    <span>عقد</span>
                  </button>
                )}

                <a
                  href={getWhatsAppChatUrl(
                    b.customerWhatsApp || b.customerPhone,
                    `مرحباً ${b.customerName}، نتواصل معك من شركة شاكر لتأجير السيارات بخصوص حجز سيارة ${b.vehicleName} من تاريخ ${formatDateDisplay(b.pickupDate)} إلى ${formatDateDisplay(b.returnDate)}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`مراسلة ${b.customerName} عبر واتساب`}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian border border-status-confirmed-border transition-colors"
                  title="مراسلة عبر واتساب"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>

                {canDeleteBookings && (
                  <button
                    type="button"
                    onClick={() => onOpenDeleteConfirm(b)}
                    aria-label={`حذف حجز ${b.customerName} نهائياً`}
                    className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg bg-status-danger-bg hover:bg-status-danger-solid text-status-danger hover:text-brand-text transition-colors border border-status-danger-border cursor-pointer"
                    title="حذف الحجز نهائياً (للمدير فقط)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {paginatedBookings.length === 0 && (
          <div className="py-12 px-4 text-center text-sm text-brand-muted font-semibold">
            لا توجد حجوزات مطابقة للفلتر المحدد
          </div>
        )}
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[920px] text-right border-collapse">
          <thead>
            <tr className="bg-brand-obsidian border-b border-brand-border text-xs text-brand-muted font-bold">
              <th className="py-3.5 px-3 w-12">
                <label className="min-w-11 min-h-11 inline-flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label="تحديد جميع الحجوزات"
                    checked={
                      paginatedBookings.length > 0 &&
                      selectedBookingIds.length === totalFilteredCount
                    }
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 accent-brand-gold rounded cursor-pointer"
                  />
                </label>
              </th>
              <th className="py-3.5 px-4">رقم الحجز / العميل</th>
              <th className="py-3.5 px-4">السيارة</th>
              <th className="py-3.5 px-4">التواريخ والعداد</th>
              <th className="py-3.5 px-4">المدة والإجمالي</th>
              <th className="py-3.5 px-4">الحالة</th>
              <th className="py-3.5 px-4">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/60 text-sm">
            {paginatedBookings.map((b) => {
              const custKey = b.customerId || b.customerPhone;
              const stats = custKey ? customerBookingStats[custKey] : undefined;
              const isSelected = selectedBookingIds.includes(b.id);

              return (
                <tr
                  key={b.id}
                  onClick={() => onOpenDetails(b)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-brand-gold-bg'
                      : 'hover:bg-brand-elevated/50'
                  }`}
                >
                  <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                    <label className="min-w-11 min-h-11 inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        aria-label={`تحديد حجز ${b.customerName}`}
                        checked={isSelected}
                        onChange={() => onToggleSelectBooking(b.id)}
                        className="w-4 h-4 accent-brand-gold rounded cursor-pointer"
                      />
                    </label>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {b.bookingNumber && (
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-brand-gold-bg text-status-new border border-brand-gold-border">
                          {b.bookingNumber}
                        </span>
                      )}
                      <div className="font-bold text-brand-text">{b.customerName}</div>

                      {((stats && stats.total > 1) || (stats && stats.rejected > 0)) && (
                        <div className="w-full sm:w-auto flex items-center gap-1.5 flex-wrap mt-0.5 sm:mt-0">
                          {stats && stats.total > 1 && (
                            <span
                              title={`لدى هذا العميل ${stats.total} حجوزات`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-800/80 text-sky-300 border border-sky-500/25"
                            >
                              <User className="w-3 h-3 text-sky-400 shrink-0" />
                              <span>عميل سابق · {stats.total} حجوزات</span>
                            </span>
                          )}
                          {stats && stats.rejected > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-status-danger-bg text-status-danger border border-status-danger-border inline-flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>مرفوض سابقاً ({stats.rejected})</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div dir="ltr" className="text-sm text-brand-muted text-right font-mono mt-0.5">
                      {b.customerPhone}
                    </div>
                    {b.customerAddress && (
                      <div className="text-xs text-brand-muted mt-1 flex items-start gap-1 max-w-xs">
                        <MapPin className="w-3 h-3 text-brand-gold-light shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{b.customerAddress}</span>
                      </div>
                    )}
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-semibold text-brand-text">{b.vehicleName}</div>
                    <div className="text-xs text-brand-muted">
                      تاريخ الطلب: <span dir="ltr" className="inline-block font-mono">{formatDateDisplay(b.createdAt)}</span>
                    </div>
                  </td>

                  <td className="py-4 px-4 text-xs text-brand-text space-y-1">
                    <div>
                      من: <span dir="ltr" className="inline-block font-mono font-bold">{formatDateDisplay(b.pickupDate)}</span> ({b.pickupTime})
                    </div>
                    <div>
                      إلى: <span dir="ltr" className="inline-block font-mono font-bold">{formatDateDisplay(b.returnDate)}</span> ({b.returnTime})
                    </div>
                    {(b.mileageAtPickup !== undefined || b.mileageAtReturn !== undefined) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {b.mileageAtPickup !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-elevated text-brand-text border border-brand-border font-mono text-xs">
                            <Gauge className="w-3 h-3 text-brand-gold-light" />
                            تسليم: {b.mileageAtPickup.toLocaleString('en-US')} كم
                          </span>
                        )}
                        {b.mileageAtReturn !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-status-confirmed-bg text-status-confirmed border border-status-confirmed-border font-mono text-xs">
                            <Gauge className="w-3 h-3 text-status-confirmed-dot" />
                            إرجاع: {b.mileageAtReturn.toLocaleString('en-US')} كم
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="py-4 px-4">
                    <div className="font-extrabold text-brand-gold-light">{formatMoney(b.totalPrice)}</div>
                    <div className="text-xs text-brand-muted flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span>{b.rentalDays} أيام</span>
                      {(() => {
                        const discountLabel = formatSavedBookingDiscountLabel({
                          discountAmount: b.discountAmount,
                          discountPercentage: b.discountPercentage,
                          discountBase: b.discountBase,
                          basePrice: b.basePrice,
                        });
                        if (!discountLabel) return null;
                        return (
                          <span
                            title={discountLabel}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-status-confirmed-bg text-status-confirmed border border-status-confirmed-border font-bold text-xs"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{discountLabel}</span>
                          </span>
                        );
                      })()}
                      {b.extraCharges && b.extraCharges > 0 ? (
                        <span className="text-status-danger font-bold">
                          (+{formatMoney(b.extraCharges)} رسوم إضافية)
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="py-4 px-4">
                    <StatusBadge status={b.status} type="booking" />
                  </td>

                  <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(b.status === 'new' || b.status === 'reviewing') && (
                        <>
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(b.id, 'confirmed')}
                            className="min-h-11 px-3 py-2 rounded-lg bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian border border-status-confirmed-border text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="تأكيد الحجز"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>تأكيد</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenRejectModal(b.id)}
                            className="min-h-11 px-3 py-2 rounded-lg bg-status-danger-bg hover:bg-status-danger-solid text-status-danger hover:text-brand-text border border-status-danger-border text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                            title="رفض الحجز"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>رفض</span>
                          </button>
                        </>
                      )}

                      {b.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => onOpenHandover(b)}
                          className="min-h-11 px-3 py-2 rounded-lg bg-status-rented-bg hover:bg-status-rented-solid text-status-rented hover:text-brand-obsidian text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-status-rented-border"
                          title="تسليم السيارة للعميل وتفعيل الإيجار"
                        >
                          <Key className="w-4 h-4" />
                          <span>تسليم السيارة</span>
                        </button>
                      )}

                      {b.status === 'rented' && (
                        <button
                          type="button"
                          onClick={() => onOpenReturn(b)}
                          className="min-h-11 px-3 py-2 rounded-lg bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-status-confirmed-border"
                          title="استلام السيارة من العميل وتسجيل العداد وإتمام الحجز"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>استلام السيارة</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenDetails(b)}
                        className="min-h-11 px-3 py-2 rounded-lg bg-brand-gold-bg hover:bg-brand-gold text-status-new hover:text-brand-obsidian text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-brand-gold-border"
                        title="عرض ملف الحجز الكامل (7 أقسام)"
                      >
                        <Eye className="w-4 h-4" />
                        <span>تفاصيل الحجز</span>
                      </button>

                      {['confirmed', 'rented', 'completed'].includes(b.status) && (
                        <button
                          type="button"
                          onClick={() => onOpenContract(b)}
                          className="min-h-11 px-3 py-2 rounded-lg bg-brand-elevated hover:bg-brand-gold text-brand-text hover:text-brand-obsidian text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-brand-border"
                          title="طباعة العقد الرسمي"
                        >
                          <Printer className="w-4 h-4" />
                          <span>عقد</span>
                        </button>
                      )}

                      <a
                        href={getWhatsAppChatUrl(
                          b.customerWhatsApp || b.customerPhone,
                          `مرحباً ${b.customerName}، نتواصل معك من شركة شاكر لتأجير السيارات بخصوص حجز سيارة ${b.vehicleName} من تاريخ ${formatDateDisplay(b.pickupDate)} إلى ${formatDateDisplay(b.returnDate)}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`مراسلة ${b.customerName} عبر واتساب`}
                        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian border border-status-confirmed-border transition-colors"
                        title="مراسلة عبر واتساب"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>

                      {canDeleteBookings && (
                        <button
                          type="button"
                          onClick={() => onOpenDeleteConfirm(b)}
                          aria-label={`حذف حجز ${b.customerName} نهائياً`}
                          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg bg-status-danger-bg hover:bg-status-danger-solid text-status-danger hover:text-brand-text transition-colors border border-status-danger-border cursor-pointer"
                          title="حذف الحجز نهائياً (للمدير فقط)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {paginatedBookings.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-brand-muted font-semibold">
                  لا توجد حجوزات مطابقة للفلتر المحدد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-brand-obsidian border-t border-brand-border text-sm text-brand-muted">
          <span>
            صفحة {currentPage} من {totalPages} (إجمالي {totalFilteredCount} حجز)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="min-h-11 px-4 py-2 rounded-lg bg-brand-elevated hover:bg-brand-border disabled:opacity-40 text-brand-text font-bold cursor-pointer border border-brand-border text-sm"
            >
              السابق
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className="min-h-11 px-4 py-2 rounded-lg bg-brand-elevated hover:bg-brand-border disabled:opacity-40 text-brand-text font-bold cursor-pointer border border-brand-border text-sm"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
