import React from 'react';
import { Booking, BookingStatus } from '../../../types';
import { StatusBadge } from '../../common/StatusBadge';
import { formatDateDisplay, formatMoney } from '../../../utils/format';
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
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-brand-obsidian border-b border-brand-border text-xs text-brand-muted font-bold">
              <th className="py-3.5 px-3 w-10">
                <input
                  type="checkbox"
                  aria-label="تحديد جميع الحجوزات"
                  checked={
                    paginatedBookings.length > 0 &&
                    selectedBookingIds.length === totalFilteredCount
                  }
                  onChange={onToggleSelectAll}
                  className="accent-brand-gold rounded cursor-pointer"
                />
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
                  <td className="py-4 px-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`تحديد حجز ${b.customerName}`}
                      checked={isSelected}
                      onChange={() => onToggleSelectBooking(b.id)}
                      className="accent-brand-gold rounded cursor-pointer"
                    />
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {b.bookingNumber && (
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-brand-gold-bg text-status-new border border-brand-gold-border">
                          {b.bookingNumber}
                        </span>
                      )}
                      <div className="font-bold text-brand-text">{b.customerName}</div>

                      {stats && stats.total > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-status-rented-bg text-status-rented border border-status-rented-border">
                          عميل مكرر ({stats.total})
                        </span>
                      )}
                      {stats && stats.rejected > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-status-danger-bg text-status-danger border border-status-danger-border flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>مرفوض سابقاً ({stats.rejected})</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-brand-muted dir-ltr text-right font-mono mt-0.5">
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-elevated text-brand-text border border-brand-border font-mono text-[11px]">
                            <Gauge className="w-3 h-3 text-brand-gold-light" />
                            تسليم: {b.mileageAtPickup.toLocaleString('en-US')} كم
                          </span>
                        )}
                        {b.mileageAtReturn !== undefined && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-status-confirmed-bg text-status-confirmed border border-status-confirmed-border font-mono text-[11px]">
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
                      {b.discountAmount > 0 && (
                        <span
                          title={`قيمة الخصم: ${formatMoney(b.discountAmount)}`}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-status-confirmed-bg text-status-confirmed border border-status-confirmed-border font-bold text-xs"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>خصم عضو (-{formatMoney(b.discountAmount)})</span>
                        </span>
                      )}
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
                            className="px-2.5 py-1.5 rounded-lg bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian border border-status-confirmed-border text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="تأكيد الحجز"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>تأكيد</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenRejectModal(b.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-status-danger-bg hover:bg-status-danger-solid text-status-danger hover:text-brand-text border border-status-danger-border text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            title="رفض الحجز"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>رفض</span>
                          </button>
                        </>
                      )}

                      {b.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => onOpenHandover(b)}
                          className="px-2.5 py-1.5 rounded-lg bg-status-rented-bg hover:bg-status-rented-solid text-status-rented hover:text-brand-obsidian text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border border-status-rented-border"
                          title="تسليم السيارة للعميل وتفعيل الإيجار"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>تسليم السيارة</span>
                        </button>
                      )}

                      {b.status === 'rented' && (
                        <button
                          type="button"
                          onClick={() => onOpenReturn(b)}
                          className="px-2.5 py-1.5 rounded-lg bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border border-status-confirmed-border"
                          title="استلام السيارة من العميل وتسجيل العداد وإتمام الحجز"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>استلام السيارة</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenDetails(b)}
                        className="px-2.5 py-1.5 rounded-lg bg-brand-gold-bg hover:bg-brand-gold text-status-new hover:text-brand-obsidian text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border border-brand-gold-border"
                        title="عرض ملف الحجز الكامل (7 أقسام)"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>تفاصيل الحجز</span>
                      </button>

                      {['confirmed', 'rented', 'completed'].includes(b.status) && (
                        <button
                          type="button"
                          onClick={() => onOpenContract(b)}
                          className="px-2.5 py-1.5 rounded-lg bg-brand-elevated hover:bg-brand-gold text-brand-text hover:text-brand-obsidian text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border border-brand-border"
                          title="طباعة العقد الرسمي"
                        >
                          <Printer className="w-3.5 h-3.5" />
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
                        className="p-1.5 rounded-lg bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian border border-status-confirmed-border transition-colors"
                        title="مراسلة عبر واتساب"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>

                      {canDeleteBookings && (
                        <button
                          type="button"
                          onClick={() => onOpenDeleteConfirm(b)}
                          aria-label={`حذف حجز ${b.customerName} نهائياً`}
                          className="p-1.5 rounded-lg bg-status-danger-bg hover:bg-status-danger-solid text-status-danger hover:text-brand-text transition-colors border border-status-danger-border cursor-pointer"
                          title="حذف الحجز نهائياً (للمدير فقط)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
        <div className="flex items-center justify-between px-4 py-3 bg-brand-obsidian border-t border-brand-border text-xs text-brand-muted">
          <span>
            صفحة {currentPage} من {totalPages} (إجمالي {totalFilteredCount} حجز)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="px-3 py-1.5 rounded-lg bg-brand-elevated hover:bg-brand-border disabled:opacity-40 text-brand-text font-bold cursor-pointer border border-brand-border"
            >
              السابق
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              className="px-3 py-1.5 rounded-lg bg-brand-elevated hover:bg-brand-border disabled:opacity-40 text-brand-text font-bold cursor-pointer border border-brand-border"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
