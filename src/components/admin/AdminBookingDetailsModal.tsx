import React, { useState } from 'react';
import { Booking, Vehicle, AppSettings } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { RentalContract } from '../RentalContract';
import { BookingStatusProgress } from './bookings/BookingStatusProgress';
import { formatDateDisplay, formatMoney } from '../../utils/format';
import { getWhatsAppChatUrl } from '../../services/whatsapp';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  X,
  User,
  Car,
  Calendar,
  MapPin,
  FileText,
  ExternalLink,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ShieldCheck,
  Key,
  Gauge,
  DollarSign,
  StickyNote,
  History,
} from 'lucide-react';

export interface AdminBookingDetailsModalProps {
  booking: Booking;
  vehicle?: Vehicle | null;
  settings: AppSettings;
  userDocs?: {
    idCardFrontUrl?: string;
    idCardBackUrl?: string;
    driverLicenseUrl?: string;
    foreignerEntrySealUrl?: string;
    passportUrl?: string;
    identityDocChoice?: string;
  };
  initialTab?: 'info' | 'contract';
  onClose: () => void;
  onOpenHandover?: (booking: Booking) => void;
  onOpenReturn?: (booking: Booking) => void;
}

type SectionKey =
  | 'all'
  | 'summary'
  | 'customer'
  | 'pricing'
  | 'timeline'
  | 'contract'
  | 'notes'
  | 'log';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'all', label: 'عرض الكل (7 أقسام)' },
  { key: 'summary', label: '1. الملخص' },
  { key: 'customer', label: '2. العميل والوثائق' },
  { key: 'pricing', label: '3. الأسعار' },
  { key: 'timeline', label: '4. الجدول الزمني' },
  { key: 'contract', label: '5. العقد' },
  { key: 'notes', label: '6. الملاحظات' },
  { key: 'log', label: '7. السجل' },
];

export const AdminBookingDetailsModal: React.FC<AdminBookingDetailsModalProps> = ({
  booking,
  vehicle,
  settings,
  userDocs,
  initialTab = 'info',
  onClose,
  onOpenHandover,
  onOpenReturn,
}) => {
  const [activeSection, setActiveSection] = useState<SectionKey>(
    initialTab === 'contract' ? 'contract' : 'all'
  );
  const modalRef = useFocusTrap({ isOpen: true, onClose, lockScroll: true });

  const docEntries = [
    { label: 'الهوية الأمامية', url: userDocs?.idCardFrontUrl },
    { label: 'الهوية الخلفية', url: userDocs?.idCardBackUrl },
    { label: 'شهادة القيادة', url: userDocs?.driverLicenseUrl },
    { label: 'جواز السفر', url: userDocs?.passportUrl },
    { label: 'ختم الدخول للقطر', url: userDocs?.foreignerEntrySealUrl },
  ].filter((d) => Boolean(d.url));

  const showSection = (key: SectionKey) => activeSection === 'all' || activeSection === key;

  const drivenKm =
    booking.mileageAtPickup !== undefined &&
    booking.mileageAtReturn !== undefined &&
    booking.mileageAtReturn >= booking.mileageAtPickup
      ? booking.mileageAtReturn - booking.mileageAtPickup
      : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-brand-obsidian/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      dir="rtl"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-booking-details-title"
        className="bg-brand-surface border border-brand-border rounded-modal max-w-5xl w-full max-h-[92vh] flex flex-col shadow-card overflow-hidden my-auto"
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-brand-obsidian border-b border-brand-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-card bg-brand-gold-bg border border-brand-gold-border flex items-center justify-center text-brand-gold-light">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  id="admin-booking-details-title"
                  className="text-base sm:text-lg font-extrabold text-brand-text"
                >
                  ملف الحجز الكامل
                </h3>
                {booking.bookingNumber && (
                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-brand-gold-bg text-status-new border border-brand-gold-border">
                    #{booking.bookingNumber}
                  </span>
                )}
                <StatusBadge status={booking.status} type="booking" />
              </div>
              <p className="text-xs text-brand-muted mt-0.5">
                {booking.customerName} • {booking.vehicleName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {booking.status === 'confirmed' && onOpenHandover && (
              <button
                type="button"
                onClick={() => onOpenHandover(booking)}
                className="px-3.5 py-2 rounded-card bg-status-rented-solid hover:opacity-90 text-brand-obsidian text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Key className="w-4 h-4" />
                <span>تسليم السيارة</span>
              </button>
            )}
            {booking.status === 'rented' && onOpenReturn && (
              <button
                type="button"
                onClick={() => onOpenReturn(booking)}
                className="px-3.5 py-2 rounded-card bg-status-confirmed-solid hover:opacity-90 text-brand-obsidian text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>استلام السيارة</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق تفاصيل الحجز"
              className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-card bg-brand-elevated hover:bg-brand-border text-brand-text transition-colors cursor-pointer border border-brand-border"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 7-Section Navigation Bar */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 py-3 bg-brand-obsidian border-b border-brand-border overflow-x-auto shrink-0">
          {SECTIONS.map((sec) => (
            <button
              key={sec.key}
              type="button"
              onClick={() => setActiveSection(sec.key)}
              className={`px-3 py-1.5 rounded-card text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeSection === sec.key
                  ? 'bg-brand-gold text-brand-obsidian font-extrabold shadow-gold'
                  : 'bg-brand-elevated text-brand-text hover:bg-brand-border'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* 1. قسم الملخص (Summary) */}
          {showSection('summary') && (
            <section
              aria-label="الملخص"
              className="bg-brand-obsidian/60 border border-brand-border rounded-card p-card space-y-4"
            >
              <div className="flex items-center justify-between border-b border-brand-border pb-3">
                <h4 className="text-sm font-extrabold text-brand-gold-light flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  <span>1. الملخص وحالة الحجز</span>
                </h4>
                <span className="text-xs font-mono text-brand-muted">
                  معرف الحجز: {booking.bookingNumber || booking.id.slice(-6).toUpperCase()}
                </span>
              </div>

              <BookingStatusProgress status={booking.status} />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-brand-surface border border-brand-border rounded-card p-3.5 space-y-1">
                  <span className="text-brand-muted block">المركبة المحجوزة</span>
                  <span className="font-extrabold text-brand-text text-sm block">{booking.vehicleName}</span>
                  {vehicle && (
                    <span className="text-brand-muted block">
                      لوحة: {vehicle.plateNumber ? vehicle.plateNumber : vehicle._internalDetailsLoaded ? '—' : 'جاري التحميل...'} • اللون: {vehicle.color}
                    </span>
                  )}
                </div>

                <div className="bg-brand-surface border border-brand-border rounded-card p-3.5 space-y-1">
                  <span className="text-brand-muted block">المستأجر</span>
                  <span className="font-extrabold text-brand-text text-sm block">{booking.customerName}</span>
                  <span className="font-mono text-brand-muted block" dir="ltr">
                    {booking.customerPhone}
                  </span>
                </div>

                <div className="bg-brand-surface border border-brand-border rounded-card p-3.5 space-y-1">
                  <span className="text-brand-muted block">المبلغ الإجمالي والمدة</span>
                  <span className="font-extrabold text-brand-gold-light text-base block">
                    {formatMoney(booking.totalPrice)}
                  </span>
                  <span className="text-brand-muted block">{booking.rentalDays} أيام إيجار</span>
                </div>
              </div>
            </section>
          )}

          {/* 2. قسم العميل والوثائق (Customer & Documents) */}
          {showSection('customer') && (
            <section
              aria-label="العميل والوثائق"
              className="bg-brand-obsidian/60 border border-brand-border rounded-card p-card space-y-4"
            >
              <h4 className="text-sm font-extrabold text-brand-gold-light flex items-center gap-2 border-b border-brand-border pb-3">
                <User className="w-4 h-4" />
                <span>2. العميل والوثائق الرسمية</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2.5 bg-brand-surface border border-brand-border rounded-card p-3.5">
                  <div className="flex justify-between">
                    <span className="text-brand-muted">الاسم الكامل:</span>
                    <span className="font-bold text-brand-text">{booking.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-muted">رقم الهاتف:</span>
                    <span className="font-mono font-bold text-brand-text" dir="ltr">
                      {booking.customerPhone}
                    </span>
                  </div>
                  {booking.customerWhatsApp && (
                    <div className="flex justify-between items-center">
                      <span className="text-brand-muted">رقم الواتساب:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-status-confirmed" dir="ltr">
                          {booking.customerWhatsApp}
                        </span>
                        <a
                          href={getWhatsAppChatUrl(
                            booking.customerWhatsApp || booking.customerPhone,
                            `مرحباً ${booking.customerName}، نتواصل معك من شركة شاكر لتأجير السيارات بخصوص حجز #${booking.bookingNumber || booking.id.slice(-6).toUpperCase()}.`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-0.5 rounded bg-status-confirmed-bg hover:bg-status-confirmed-solid text-status-confirmed hover:text-brand-obsidian border border-status-confirmed-border text-[11px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>محادثة</span>
                        </a>
                      </div>
                    </div>
                  )}
                  {booking.customerEmail && (
                    <div className="flex justify-between">
                      <span className="text-brand-muted">البريد الإلكتروني:</span>
                      <span className="font-mono text-brand-text">{booking.customerEmail}</span>
                    </div>
                  )}
                  {booking.customerAddress && (
                    <div className="pt-2 border-t border-brand-border">
                      <span className="text-brand-muted block mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-gold-light" />
                        عنوان الإقامة / التسليم:
                      </span>
                      <p className="text-brand-text font-semibold leading-relaxed bg-brand-obsidian p-2.5 rounded-lg border border-brand-border">
                        {booking.customerAddress}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-brand-surface border border-brand-border rounded-card p-3.5 space-y-3">
                  <span className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-brand-gold-light" />
                    الوثائق الثبوتية المرفوعة ({docEntries.length})
                  </span>
                  {docEntries.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {docEntries.map((doc, idx) => (
                        <a
                          key={idx}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative rounded-card overflow-hidden border border-brand-border bg-brand-obsidian aspect-video flex flex-col justify-end"
                        >
                          <img
                            src={doc.url}
                            alt={doc.label}
                            loading="lazy"
                            decoding="async"
                            width="240"
                            height="135"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-brand-obsidian/90 via-brand-obsidian/20 to-transparent flex items-end justify-between p-2">
                            <span className="text-[11px] font-bold text-brand-text">{doc.label}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-brand-gold-light" />
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-brand-muted py-4 text-center">
                      لا توجد وثائق مرفوعة في ملف هذا العميل حتى الآن.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 3. قسم الأسعار (Pricing) */}
          {showSection('pricing') && (
            <section
              aria-label="الأسعار"
              className="bg-brand-obsidian/60 border border-brand-border rounded-card p-card space-y-4"
            >
              <h4 className="text-sm font-extrabold text-brand-gold-light flex items-center gap-2 border-b border-brand-border pb-3">
                <DollarSign className="w-4 h-4" />
                <span>3. التفاصيل المالية والأسعار</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-brand-surface border border-brand-border rounded-card p-3">
                  <span className="text-brand-muted block">الأجرة اليومية</span>
                  <span className="text-sm font-extrabold text-brand-text mt-1 block">
                    {formatMoney(booking.dailyPrice)}
                  </span>
                </div>
                <div className="bg-brand-surface border border-brand-border rounded-card p-3">
                  <span className="text-brand-muted block">أجرة المدة ({booking.rentalDays} يوم)</span>
                  <span className="text-sm font-extrabold text-brand-text mt-1 block">
                    {formatMoney(booking.basePrice)}
                  </span>
                </div>
                <div className="bg-brand-surface border border-brand-border rounded-card p-3">
                  <span className="text-brand-muted block">التأمين المسترد</span>
                  <span className="text-sm font-extrabold text-brand-gold-light mt-1 block">
                    {formatMoney(booking.insuranceAmount)}
                  </span>
                </div>
                <div className="bg-brand-gold-bg border border-brand-gold-border rounded-card p-3">
                  <span className="text-status-new block font-bold">الإجمالي النهائي</span>
                  <span className="text-base font-extrabold text-brand-gold-light mt-1 block">
                    {formatMoney(booking.totalPrice)}
                  </span>
                </div>
              </div>

              {(booking.discountAmount > 0 || (booking.extraCharges && booking.extraCharges > 0)) && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {booking.discountAmount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-card bg-status-confirmed-bg border border-status-confirmed-border text-status-confirmed font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>خصم مطبق: -{formatMoney(booking.discountAmount)}</span>
                    </div>
                  )}
                  {booking.extraCharges && booking.extraCharges > 0 ? (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-card bg-status-danger-bg border border-status-danger-border text-status-danger font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>رسوم إضافية عند الإرجاع: +{formatMoney(booking.extraCharges)}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          )}

          {/* 4. قسم الجدول الزمني والعداد (Timeline & Odometer) */}
          {showSection('timeline') && (
            <section
              aria-label="الجدول الزمني"
              className="bg-brand-obsidian/60 border border-brand-border rounded-card p-card space-y-4"
            >
              <h4 className="text-sm font-extrabold text-brand-gold-light flex items-center gap-2 border-b border-brand-border pb-3">
                <Calendar className="w-4 h-4" />
                <span>4. الجدول الزمني وقراءات عداد الكيلومترات</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-brand-surface border border-brand-border rounded-card p-3.5 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-brand-muted">تاريخ ووقت الاستلام:</span>
                    <span className="font-bold text-status-confirmed">
                      <span dir="ltr" className="inline-block font-mono">
                        {formatDateDisplay(booking.pickupDate)}
                      </span>{' '}
                      — {booking.pickupTime}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-muted">تاريخ ووقت الإرجاع:</span>
                    <span className="font-bold text-brand-gold-light">
                      <span dir="ltr" className="inline-block font-mono">
                        {formatDateDisplay(booking.returnDate)}
                      </span>{' '}
                      — {booking.returnTime}
                    </span>
                  </div>
                  {booking.deliveryLocation && (
                    <div className="flex justify-between">
                      <span className="text-brand-muted">موقع التسليم:</span>
                      <span className="font-bold text-brand-text">{booking.deliveryLocation}</span>
                    </div>
                  )}
                </div>

                <div className="bg-brand-surface border border-brand-border rounded-card p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-brand-muted flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-brand-gold-light" />
                      عداد التسليم (الاستلام):
                    </span>
                    <span className="font-mono font-extrabold text-brand-text">
                      {booking.mileageAtPickup !== undefined
                        ? `${booking.mileageAtPickup.toLocaleString('en-US')} كم`
                        : 'لم يُسجّل بعد'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-brand-muted flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-status-confirmed-dot" />
                      عداد الإرجاع (الاستلام النهائي):
                    </span>
                    <span className="font-mono font-extrabold text-status-confirmed">
                      {booking.mileageAtReturn !== undefined
                        ? `${booking.mileageAtReturn.toLocaleString('en-US')} كم`
                        : 'لم يُسجّل بعد'}
                    </span>
                  </div>
                  {drivenKm !== null && (
                    <div className="flex justify-between items-center pt-1.5 border-t border-brand-border">
                      <span className="text-brand-muted">المسافة المقطوعة خلال الإيجار:</span>
                      <span className="font-mono font-extrabold text-brand-gold-light">
                        {drivenKm.toLocaleString('en-US')} كم
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 5. قسم العقد (Contract) */}
          {showSection('contract') && (
            <section
              aria-label="العقد"
              className="bg-brand-obsidian/60 border border-brand-border rounded-card p-card space-y-4"
            >
              <div className="flex items-center justify-between border-b border-brand-border pb-3">
                <h4 className="text-sm font-extrabold text-brand-gold-light flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  <span>5. عقد التأجير الرقمي المعتمد</span>
                </h4>
                {activeSection !== 'contract' && (
                  <button
                    type="button"
                    onClick={() => setActiveSection('contract')}
                    className="px-3 py-1 rounded-lg bg-brand-gold-bg hover:bg-brand-gold text-status-new hover:text-brand-obsidian border border-brand-gold-border text-xs font-bold transition-colors cursor-pointer"
                  >
                    عرض العقد بملء النافذة
                  </button>
                )}
              </div>

              <RentalContract
                booking={booking}
                settings={settings}
                vehicle={vehicle}
                onBack={() => setActiveSection('all')}
              />
            </section>
          )}

          {/* 6. قسم الملاحظات (Notes) */}
          {showSection('notes') && (
            <section
              aria-label="الملاحظات"
              className="bg-brand-obsidian/60 border border-brand-border rounded-card p-card space-y-3"
            >
              <h4 className="text-sm font-extrabold text-brand-gold-light flex items-center gap-2 border-b border-brand-border pb-3">
                <StickyNote className="w-4 h-4" />
                <span>6. الملاحظات وحالة الإرجاع</span>
              </h4>

              {booking.notes ? (
                <div className="p-3.5 rounded-card bg-brand-gold-bg border border-brand-gold-border text-xs text-status-new">
                  <span className="font-bold block mb-1">ملاحظات العميل عند الطلب:</span>
                  {booking.notes}
                </div>
              ) : (
                <p className="text-xs text-brand-muted">لا توجد ملاحظات مسجلة من العميل.</p>
              )}

              {booking.returnCondition && (
                <div className="p-3.5 rounded-card bg-status-confirmed-bg border border-status-confirmed-border text-xs text-status-confirmed">
                  <span className="font-bold block mb-1">حالة المركبة عند الإرجاع:</span>
                  {booking.returnCondition}
                </div>
              )}

              {booking.rejectionReason && (
                <div className="p-3.5 rounded-card bg-status-danger-bg border border-status-danger-border text-xs text-status-danger">
                  <span className="font-bold block mb-1">سبب رفض الطلب:</span>
                  {booking.rejectionReason}
                </div>
              )}
            </section>
          )}

          {/* 7. قسم السجل (Log) */}
          {showSection('log') && (
            <section
              aria-label="السجل"
              className="bg-brand-obsidian/60 border border-brand-border rounded-card p-card space-y-3"
            >
              <h4 className="text-sm font-extrabold text-brand-gold-light flex items-center gap-2 border-b border-brand-border pb-3">
                <History className="w-4 h-4" />
                <span>7. سجل العمليات والتدقيق</span>
              </h4>

              <ol className="space-y-2.5 text-xs text-brand-muted">
                <li className="flex items-center justify-between bg-brand-surface border border-brand-border rounded-card px-3.5 py-2.5">
                  <span className="font-bold text-brand-text">إنشاء طلب الحجز</span>
                  <span className="font-mono text-brand-muted" dir="ltr">
                    {formatDateDisplay(booking.createdAt)}
                  </span>
                </li>
                {booking.mileageAtPickup !== undefined && (
                  <li className="flex items-center justify-between bg-brand-surface border border-brand-border rounded-card px-3.5 py-2.5">
                    <span className="font-bold text-status-rented">
                      تسليم السيارة للعميل (العداد: {booking.mileageAtPickup.toLocaleString('en-US')} كم)
                    </span>
                    <span className="text-status-rented font-bold">مؤجرة</span>
                  </li>
                )}
                {booking.mileageAtReturn !== undefined && (
                  <li className="flex items-center justify-between bg-brand-surface border border-brand-border rounded-card px-3.5 py-2.5">
                    <span className="font-bold text-status-confirmed">
                      استلام السيارة من العميل (العداد: {booking.mileageAtReturn.toLocaleString('en-US')} كم)
                    </span>
                    <span className="text-status-confirmed font-bold">مكتمل</span>
                  </li>
                )}
                {booking.updatedAt && (
                  <li className="flex items-center justify-between bg-brand-surface border border-brand-border rounded-card px-3.5 py-2.5">
                    <span className="font-bold text-brand-text">آخر تحديث مسجل على الحجز</span>
                    <span className="font-mono text-brand-muted" dir="ltr">
                      {formatDateDisplay(booking.updatedAt)}
                    </span>
                  </li>
                )}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
