import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight, Printer, AlertTriangle, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { AppSettings, Booking, Vehicle, ContractResponsePayload } from '../types';
import { functionsService } from '../services/functionsService';
import { getQrSvgPath } from '../utils/qrCode';
import { formatDateDisplay } from '../utils/format';
import { formatSavedBookingDiscountLabel } from '../shared/discount';

interface RentalContractProps {
  booking: Booking;
  settings: AppSettings;
  vehicle?: Vehicle | null;
  onBack: () => void;
}

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #contract-sheet, #contract-sheet * { visibility: visible !important; }
  #contract-sheet {
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: #fff !important;
    color: #000 !important;
  }
  @page { size: A4 portrait; margin: 10mm; }
}
`;

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const formatted = formatDateDisplay(dateStr);
  if (formatted) return formatted;
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('ar-SY-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function money(value: number | undefined, currency: string): string {
  return `${Number(value || 0).toLocaleString('en-US')} ${currency}`;
}

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex gap-2 py-1 border-b border-dotted border-contract-border">
    <span className="font-bold text-contract-ink shrink-0">{label}:</span>
    <span className="text-contract-muted break-words">{value || '............................'}</span>
  </div>
);

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return {
        label: 'ساري (المركبة مع العميل)',
        bg: 'bg-status-confirmed-bg text-contract-ink border-status-confirmed-border',
      };
    case 'closed':
      return {
        label: 'مغلق (تم الاستلام)',
        bg: 'bg-status-rented-bg text-contract-ink border-status-rented-border',
      };
    case 'terminated':
      return {
        label: 'ملغى قانونياً',
        bg: 'bg-status-danger-bg text-contract-ink border-status-danger-border',
      };
    case 'issued':
    default:
      return {
        label: 'مُصدر (بانتظار التسليم)',
        bg: 'bg-status-new-bg text-contract-ink border-status-new-border',
      };
  }
};

/**
 * Server-authoritative, frozen rental contract component.
 * Loads the frozen contract snapshot via generateRentalContractPdf Cloud Function,
 * guarantees cryptographic verification code visibility, odometer readings, and QR verification.
 */
export const RentalContract: React.FC<RentalContractProps> = ({ booking, settings, vehicle, onBack }) => {
  const initialFallbackSnapshot = useMemo<ContractResponsePayload>(() => {
    const bNumber = booking.bookingNumber || booking.id.slice(-6).toUpperCase();
    return {
      contractId: `CTR_${booking.id}`,
      contractNumber: `CTR-${bNumber}`,
      bookingId: booking.id,
      bookingNumber: bNumber,
      verificationCode: '........................',
      status: (booking.status === 'completed'
        ? 'closed'
        : booking.status === 'rented'
        ? 'active'
        : 'issued') as ContractResponsePayload['status'],
      customerId: booking.customerId || '',
      customerName: booking.customerName || 'المستأجر',
      customerPhone: booking.customerPhone || booking.customerWhatsApp || '',
      customerAddress: booking.customerAddress || '',
      vehicleId: booking.vehicleId || '',
      vehicleName: booking.vehicleName || 'المركبة',
      vehicleYear: vehicle?.year,
      vehicleColor: vehicle?.color,
      plateNumber: vehicle?.plateNumber,
      pickupDate: booking.pickupDate,
      returnDate: booking.returnDate,
      pickupTime: booking.pickupTime || '',
      returnTime: booking.returnTime || '',
      rentalDays: booking.rentalDays || 1,
      dailyPrice: booking.dailyPrice || 0,
      basePrice: booking.basePrice || 0,
      discountAmount: booking.discountAmount || 0,
      ...(typeof booking.discountPercentage === 'number' ? { discountPercentage: booking.discountPercentage } : {}),
      ...(typeof booking.discountBase === 'number' ? { discountBase: booking.discountBase } : {}),
      insuranceAmount: booking.insuranceAmount || 0,
      driverFee: booking.driverFee || 0,
      totalPrice: booking.totalPrice || 0,
      withDriver: Boolean(booking.withDriver),
      deliveryLocation: booking.deliveryLocation || 'مقر شركة شاكر لتأجير السيارات - دمشق',
      mileageAtPickup: booking.mileageAtPickup,
      mileageAtReturn: booking.mileageAtReturn,
      termsAndConditions: (settings.rentalTerms || '')
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean),
      issuedAt: booking.createdAt || new Date().toISOString(),
    };
  }, [booking, settings, vehicle]);

  const [contract, setContract] = useState<ContractResponsePayload>(initialFallbackSnapshot);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currency = settings.currency || '$';

  useEffect(() => {
    let isCancelled = false;

    functionsService
      .generateRentalContractPdf({
        bookingId: booking.id,
      })
      .then((res) => {
        if (isCancelled) return;
        if (res.success && res.data?.contract) {
          setContract(res.data.contract);
        } else if (res.error) {
          setErrorMessage(res.error);
        }
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg || 'حدث خطأ غير متوقع أثناء استرجاع وثيقة العقد.');
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [booking.id]);

  // Construct verification URL and QR Code SVG path
  const qrData = useMemo(() => {
    if (!contract?.contractNumber || !contract?.verificationCode) return null;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const verificationUrl = `${origin}/verify-contract?contract=${encodeURIComponent(
      contract.contractNumber
    )}#code=${encodeURIComponent(contract.verificationCode)}`;
    return getQrSvgPath(verificationUrl, 3, 2);
  }, [contract?.contractNumber, contract?.verificationCode]);

  const statusBadge = getStatusBadge(contract.status);
  const termsList = Array.isArray(contract.termsAndConditions) ? contract.termsAndConditions : [];

  return (
    <div className="space-y-4" dir="rtl">
      <style>{PRINT_STYLES}</style>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-card bg-brand-elevated hover:bg-brand-border text-brand-text text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors border border-brand-border"
        >
          <ArrowRight className="w-4 h-4" />
          <span>رجوع للحجوزات</span>
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={Boolean(errorMessage || isLoading)}
          className="px-5 py-2 rounded-card bg-brand-gold hover:bg-brand-gold-light disabled:opacity-40 disabled:cursor-not-allowed text-brand-obsidian font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-gold"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة العقد</span>
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-status-new bg-brand-gold-bg px-3.5 py-2 rounded-card border border-brand-gold-border">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-brand-gold-light" />
          <span>جاري مزامنة بيانات العقد المجمّدة والموقعة مع السيرفر...</span>
        </div>
      )}

      {errorMessage ? (
        <div className="bg-status-danger-bg border-2 border-status-danger-border rounded-card p-6 sm:p-8 text-center space-y-4 max-w-2xl mx-auto shadow-card">
          <div className="inline-flex items-center justify-center p-3 rounded-card bg-status-danger-bg text-status-danger-dot border border-status-danger-border">
            <AlertTriangle className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-status-danger">
            تعذر جلب أو إصدار وثيقة العقد المجمّدة من السيرفر
          </h3>
          <p className="text-xs sm:text-sm text-status-danger leading-relaxed bg-brand-obsidian/60 p-3.5 rounded-card border border-status-danger-border font-medium">
            {errorMessage}
          </p>
          <p className="text-xs text-brand-muted">
            تم منع طباعة العقد تلقائياً لحماية الموثوقية ولضمان المطابقة التامة مع السجلات الرسمية.
          </p>
        </div>
      ) : (
        <div
          id="contract-sheet"
          className="bg-contract-paper text-contract-ink rounded-card border border-contract-border p-6 sm:p-10 text-xs sm:text-sm leading-relaxed max-w-4xl mx-auto shadow-contract"
        >
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-contract-ink pb-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold">{settings.companyName || 'شركة شاكر لتأجير السيارات'}</h1>
              {settings.companyNameEn && <p className="text-xs text-contract-muted">{settings.companyNameEn}</p>}
              {settings.address && <p className="text-xs text-contract-muted">العنوان: {settings.address}</p>}
              {settings.companyPhone && (
                <p className="text-xs text-contract-muted" dir="ltr" style={{ textAlign: 'right' }}>
                  {settings.companyPhone}
                </p>
              )}
            </div>
            <div className="text-xs space-y-1.5 bg-contract-surface border border-contract-border rounded-card p-3 min-w-[220px]">
              <div className="flex justify-between items-center gap-3">
                <span className="font-bold">رقم العقد:</span>
                <span className="font-mono font-extrabold text-contract-ink text-sm">{contract.contractNumber}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-bold">رقم الحجز:</span>
                <span className="tabular-nums font-bold">{contract.bookingNumber}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-bold">تاريخ التحرير:</span>
                <span>{formatDate(contract.issuedAt)}</span>
              </div>
              <div className="flex justify-between items-center gap-3 pt-1 border-t border-contract-border">
                <span className="font-bold">حالة العقد:</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${statusBadge.bg}`}>
                  {statusBadge.label}
                </span>
              </div>
            </div>
          </div>

          <h2 className="text-center text-base sm:text-lg font-extrabold py-4">عقد تأجير مركبة سياحية</h2>

          {/* Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <section className="border border-contract-border rounded-card p-3.5 bg-contract-surface">
              <h3 className="font-extrabold text-sm mb-2 border-b border-contract-border pb-1">الطرف الأول (المؤجّر)</h3>
              <Field label="الاسم" value={settings.companyName || 'شركة شاكر لتأجير السيارات'} />
              <Field label="العنوان" value={settings.address || 'دمشق - سوريا'} />
              <Field label="الهاتف" value={settings.companyPhone} />
            </section>

            <section className="border border-contract-border rounded-card p-3.5 bg-contract-surface">
              <h3 className="font-extrabold text-sm mb-2 border-b border-contract-border pb-1">الطرف الثاني (المستأجر)</h3>
              {contract.status === 'terminated' && contract.terminationReason === 'deleted' ? (
                <div className="py-2 text-xs text-contract-muted italic font-medium">
                  تم حجب بيانات العميل الشخصية لإلغاء وحذف الحجز.
                </div>
              ) : (
                <>
                  <Field label="الاسم الكامل" value={contract.customerName} />
                  <Field label="الهاتف" value={contract.customerPhone} />
                  <Field label="العنوان" value={contract.customerAddress} />
                </>
              )}
            </section>
          </div>

          {/* Vehicle Details */}
          <section className="border border-contract-border rounded-card p-3.5 mt-4">
            <h3 className="font-extrabold text-sm mb-2 border-b border-contract-border pb-1">بيانات المركبة</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <Field label="السيارة" value={contract.vehicleName} />
              <Field label="سنة الصنع" value={contract.vehicleYear || vehicle?.year} />
              <Field label="اللون" value={contract.vehicleColor || vehicle?.color} />
              <Field label="رقم اللوحة" value={contract.plateNumber || vehicle?.plateNumber} />
            </div>
          </section>

          {/* Rental Period */}
          <section className="border border-contract-border rounded-card p-3.5 mt-4">
            <h3 className="font-extrabold text-sm mb-2 border-b border-contract-border pb-1">مدة الإيجار</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <Field
                label="تاريخ الاستلام"
                value={
                  <>
                    <span dir="ltr" className="inline-block font-mono">{formatDate(contract.pickupDate)}</span>
                    {contract.pickupTime ? ` — ${contract.pickupTime}` : ''}
                  </>
                }
              />
              <Field
                label="تاريخ الإرجاع"
                value={
                  <>
                    <span dir="ltr" className="inline-block font-mono">{formatDate(contract.returnDate)}</span>
                    {contract.returnTime ? ` — ${contract.returnTime}` : ''}
                  </>
                }
              />
              <Field label="عدد الأيام" value={`${contract.rentalDays} يوم`} />
              <Field label="مكان التسليم" value={contract.deliveryLocation} />
              <Field label="سائق خاص" value={contract.withDriver ? 'نعم' : 'لا'} />
            </div>
          </section>

          {/* Financial Details */}
          <section className="border border-contract-border rounded-card p-3.5 mt-4">
            <h3 className="font-extrabold text-sm mb-2 border-b border-contract-border pb-1">التفاصيل المالية</h3>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-contract-border">
                  <td className="py-1.5">الأجرة اليومية</td>
                  <td className="py-1.5 text-left font-bold">{money(contract.dailyPrice, currency)}</td>
                </tr>
                <tr className="border-b border-contract-border">
                  <td className="py-1.5">أجرة المدة ({contract.rentalDays} يوم)</td>
                  <td className="py-1.5 text-left font-bold">{money(contract.basePrice, currency)}</td>
                </tr>
                {contract.discountAmount > 0 && (
                  <tr className="border-b border-contract-border font-bold">
                    <td className="py-1.5">
                      {formatSavedBookingDiscountLabel({
                        discountAmount: contract.discountAmount,
                        discountPercentage: contract.discountPercentage,
                        discountBase: contract.discountBase,
                        basePrice: contract.basePrice,
                        currency,
                      }) || 'الخصم المطبق'}
                    </td>
                    <td className="py-1.5 text-left font-bold">- {money(contract.discountAmount, currency)}</td>
                  </tr>
                )}
                {contract.insuranceAmount > 0 && (
                  <tr className="border-b border-contract-border">
                    <td className="py-1.5">مبلغ التأمين</td>
                    <td className="py-1.5 text-left font-bold">{money(contract.insuranceAmount, currency)}</td>
                  </tr>
                )}
                {contract.driverFee > 0 && (
                  <tr className="border-b border-contract-border">
                    <td className="py-1.5">أجرة السائق الخاص</td>
                    <td className="py-1.5 text-left font-bold">{money(contract.driverFee, currency)}</td>
                  </tr>
                )}
                {Number(contract.extraCharges || 0) > 0 && (
                  <tr className="border-b border-contract-border text-amber-600 font-bold">
                    <td className="py-1.5">رسوم إضافية عند الإرجاع</td>
                    <td className="py-1.5 text-left font-bold">+ {money(contract.extraCharges, currency)}</td>
                  </tr>
                )}
                <tr className="font-extrabold bg-contract-surface text-contract-ink text-sm">
                  <td className="py-2 px-2">
                    {contract.finalTotal !== undefined && contract.finalTotal !== null ? 'الإجمالي النهائي المسدد' : 'الإجمالي المستحق'}
                  </td>
                  <td className="py-2 px-2 text-left font-mono font-extrabold">
                    {money(contract.finalTotal ?? contract.totalPrice, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Handover & Return Odometer Readings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <section className="border border-contract-border rounded-card p-3.5 bg-contract-surface">
              <div className="flex items-center justify-between mb-2 border-b border-contract-border pb-1">
                <h3 className="font-extrabold text-sm">قراءة العداد عند التسليم</h3>
                {(contract.mileageAtPickup !== undefined || booking.mileageAtPickup !== undefined) && (
                  <span className="text-xs font-bold text-contract-ink flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-status-confirmed-solid" />
                    <span>تم التسليم</span>
                  </span>
                )}
              </div>
              <Field
                label="عداد الكيلومترات (الاستلام)"
                value={
                  contract.mileageAtPickup !== undefined
                    ? `${contract.mileageAtPickup.toLocaleString('en-US')} كم`
                    : booking.mileageAtPickup !== undefined
                    ? `${booking.mileageAtPickup.toLocaleString('en-US')} كم`
                    : 'يُسجَّل عند تسليم المركبة'
                }
              />
            </section>

            <section className="border border-contract-border rounded-card p-3.5 bg-contract-surface">
              <div className="flex items-center justify-between mb-2 border-b border-contract-border pb-1">
                <h3 className="font-extrabold text-sm">قراءة العداد عند الإرجاع</h3>
                {(contract.mileageAtReturn !== undefined || booking.mileageAtReturn !== undefined) && (
                  <span className="text-xs font-bold text-contract-ink flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-status-rented-solid" />
                    <span>تم الإرجاع</span>
                  </span>
                )}
              </div>
              <Field
                label="عداد الكيلومترات (الإرجاع)"
                value={
                  contract.mileageAtReturn !== undefined
                    ? `${contract.mileageAtReturn.toLocaleString('en-US')} كم`
                    : booking.mileageAtReturn !== undefined
                    ? `${booking.mileageAtReturn.toLocaleString('en-US')} كم`
                    : 'يُسجَّل عند استلام المركبة'
                }
              />
            </section>
          </div>

          {/* Terms and Conditions */}
          {termsList.length > 0 && (
            <section className="mt-4">
              <h3 className="font-extrabold text-sm mb-1.5">الشروط والأحكام العامة</h3>
              <ol className="list-decimal list-inside space-y-1 text-xs text-contract-muted border border-contract-border rounded-card p-3.5 bg-contract-surface">
                {termsList.map((term, i) => (
                  <li key={i} className="leading-relaxed">{term}</li>
                ))}
              </ol>
            </section>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-8 mt-4 border-t border-contract-border">
            <div className="text-center space-y-8">
              <p className="font-bold">توقيع وختم المؤجّر</p>
              <div className="border-b border-dashed border-contract-border w-3/4 mx-auto h-8" />
            </div>
            <div className="text-center space-y-8">
              <p className="font-bold">توقيع المستأجر</p>
              <div className="border-b border-dashed border-contract-border w-3/4 mx-auto h-8" />
            </div>
          </div>

          {/* Verification Footer & QR */}
          <div className="mt-8 pt-4 border-t-2 border-contract-ink flex flex-wrap items-center justify-between gap-4 bg-contract-surface rounded-card p-4">
            <div className="space-y-1.5 max-w-md">
              <div className="flex items-center gap-2 text-contract-ink font-extrabold text-xs">
                <ShieldCheck className="w-4 h-4 text-status-confirmed-solid" />
                <span>رمز التحقق الرقمي المعتمد للعقد:</span>
              </div>
              <div className="font-mono text-xs sm:text-sm font-extrabold bg-contract-paper px-3 py-1.5 rounded-lg border border-contract-border text-contract-ink tracking-wider inline-block">
                {contract.verificationCode}
              </div>
              <p className="text-xs text-contract-muted leading-relaxed">
                هذا العقد معتمد وموقع رقمياً من خوادم شركة شاكر لتأجير السيارات. يمكن التحقق من صحته عبر مسح رمز الاستجابة السريعة (QR) أو إدخال رمز التحقق في صفحة التدقيق.
              </p>
            </div>

            {/* QR Code SVG */}
            {qrData && (
              <div className="flex flex-col items-center gap-1 bg-contract-paper p-2 rounded-card border border-contract-border shrink-0">
                <svg
                  width="84"
                  height="84"
                  viewBox={`0 0 ${qrData.totalSize} ${qrData.totalSize}`}
                  className="w-20 h-20"
                  shapeRendering="crispEdges"
                >
                  <path d={qrData.path} fill="#0f172a" />
                </svg>
                <span className="text-xs font-mono text-contract-muted font-bold">{contract.contractNumber}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
