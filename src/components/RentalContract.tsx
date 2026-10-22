import React from 'react';
import { ArrowRight, Printer } from 'lucide-react';
import { AppSettings, Booking, Vehicle } from '../types';

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
  @page { size: A4 portrait; margin: 12mm; }
}
`;

function formatDate(date: string): string {
  if (!date) return '—';
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('ar-SY-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function money(value: number | undefined, currency: string): string {
  return `${Number(value || 0).toLocaleString('en-US')} ${currency}`;
}

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex gap-2 py-1 border-b border-dotted border-slate-300">
    <span className="font-bold text-slate-900 shrink-0">{label}:</span>
    <span className="text-slate-800 break-words">{value || '............................'}</span>
  </div>
);

/**
 * Simple printable rental contract. Generated entirely from the booking data and the
 * company settings (name, phone, address, rental terms) — no server call required.
 */
export const RentalContract: React.FC<RentalContractProps> = ({ booking, settings, vehicle, onBack }) => {
  const currency = settings.currency || '$';
  const contractNumber = `CTR-${booking.bookingNumber || booking.id.slice(-6).toUpperCase()}`;
  const issuedAt = new Date().toLocaleDateString('ar-SY-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const terms = (settings.rentalTerms || '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4" dir="rtl">
      <style>{PRINT_STYLES}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          <span>رجوع للحجوزات</span>
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة العقد</span>
        </button>
      </div>

      <div
        id="contract-sheet"
        className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-6 sm:p-10 text-xs sm:text-sm leading-relaxed max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black">{settings.companyName || 'شركة شاكر لتأجير السيارات'}</h1>
            {settings.companyNameEn && <p className="text-xs text-slate-600">{settings.companyNameEn}</p>}
            {settings.address && <p className="text-xs text-slate-600">العنوان: {settings.address}</p>}
            {settings.companyPhone && (
              <p className="text-xs text-slate-600" dir="ltr" style={{ textAlign: 'right' }}>
                {settings.companyPhone}
              </p>
            )}
          </div>
          <div className="text-xs space-y-1 bg-slate-100 border border-slate-300 rounded-xl p-3 min-w-[200px]">
            <div className="flex justify-between gap-3">
              <span className="font-bold">رقم العقد:</span>
              <span className="font-mono">{contractNumber}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-bold">رقم الحجز:</span>
              <span className="font-mono">{booking.bookingNumber || booking.id}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-bold">تاريخ التحرير:</span>
              <span>{issuedAt}</span>
            </div>
          </div>
        </div>

        <h2 className="text-center text-base font-black py-4">عقد تأجير سيارة</h2>

        {/* Parties */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <section className="border border-slate-300 rounded-xl p-3">
            <h3 className="font-black mb-1">الطرف الأول (المؤجّر)</h3>
            <Field label="الاسم" value={settings.companyName} />
            <Field label="العنوان" value={settings.address} />
            <Field label="الهاتف" value={settings.companyPhone} />
          </section>
          <section className="border border-slate-300 rounded-xl p-3">
            <h3 className="font-black mb-1">الطرف الثاني (المستأجر)</h3>
            <Field label="الاسم الكامل" value={booking.customerName} />
            <Field label="الهاتف" value={booking.customerPhone || booking.customerWhatsApp} />
            <Field label="الرقم الوطني / الجواز" value={booking.customerNationalId} />
            <Field label="رقم رخصة القيادة" value={booking.customerLicenseNumber} />
            <Field label="العنوان" value={booking.customerAddress} />
          </section>
        </div>

        {/* Vehicle */}
        <section className="border border-slate-300 rounded-xl p-3 mt-4">
          <h3 className="font-black mb-1">بيانات السيارة</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Field label="السيارة" value={booking.vehicleName} />
            <Field label="سنة الصنع" value={vehicle?.year} />
            <Field label="اللون" value={vehicle?.color} />
            <Field label="رقم اللوحة" />
            <Field label="عداد الكيلومترات عند الاستلام" />
            <Field label="مستوى الوقود عند الاستلام" />
          </div>
        </section>

        {/* Period */}
        <section className="border border-slate-300 rounded-xl p-3 mt-4">
          <h3 className="font-black mb-1">مدة الإيجار</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Field label="تاريخ الاستلام" value={`${formatDate(booking.pickupDate)} — ${booking.pickupTime || ''}`} />
            <Field label="تاريخ الإرجاع" value={`${formatDate(booking.returnDate)} — ${booking.returnTime || ''}`} />
            <Field label="عدد الأيام" value={booking.rentalDays} />
            <Field label="مكان التسليم" value={booking.deliveryLocation} />
            <Field label="سائق خاص" value={booking.withDriver ? 'نعم' : 'لا'} />
          </div>
        </section>

        {/* Financial */}
        <section className="border border-slate-300 rounded-xl p-3 mt-4">
          <h3 className="font-black mb-2">التفاصيل المالية</h3>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-1">الأجرة اليومية</td>
                <td className="py-1 text-left">{money(booking.dailyPrice, currency)}</td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-1">أجرة المدة ({booking.rentalDays} يوم)</td>
                <td className="py-1 text-left">{money(booking.basePrice, currency)}</td>
              </tr>
              {booking.discountAmount > 0 && (
                <tr className="border-b border-slate-200">
                  <td className="py-1">الخصم</td>
                  <td className="py-1 text-left">- {money(booking.discountAmount, currency)}</td>
                </tr>
              )}
              {booking.insuranceAmount > 0 && (
                <tr className="border-b border-slate-200">
                  <td className="py-1">التأمين</td>
                  <td className="py-1 text-left">{money(booking.insuranceAmount, currency)}</td>
                </tr>
              )}
              {Number(booking.driverFee) > 0 && (
                <tr className="border-b border-slate-200">
                  <td className="py-1">أجرة السائق</td>
                  <td className="py-1 text-left">{money(booking.driverFee, currency)}</td>
                </tr>
              )}
              <tr className="font-black bg-slate-100">
                <td className="py-1.5 px-1">الإجمالي</td>
                <td className="py-1.5 px-1 text-left">{money(booking.totalPrice, currency)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Terms */}
        {terms.length > 0 && (
          <section className="mt-4">
            <h3 className="font-black mb-1">الشروط والأحكام</h3>
            <ul className="space-y-1 text-[11px] text-slate-700 border border-slate-300 rounded-xl p-3 bg-slate-50">
              {terms.map((term, i) => (
                <li key={i}>{term}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-8 mt-4">
          <div className="text-center space-y-10">
            <p className="font-bold">توقيع وختم المؤجّر</p>
            <div className="border-b border-dashed border-slate-500 w-3/4 mx-auto h-6" />
          </div>
          <div className="text-center space-y-10">
            <p className="font-bold">توقيع المستأجر</p>
            <div className="border-b border-dashed border-slate-500 w-3/4 mx-auto h-6" />
          </div>
        </div>
      </div>
    </div>
  );
};
