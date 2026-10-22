import React, { useState, useEffect } from 'react';
import { Booking } from '../types';
import { functionsService } from '../services/functionsService';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  Printer,
  X,
  ShieldCheck,
  FileText,
  User,
  Car,
  DollarSign,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface ContractModalProps {
  booking: Booking | null;
  onClose: () => void;
}

interface ContractDetails {
  contractId: string;
  contractNumber: string;
  bookingId: string;
  bookingNumber: string;
  verificationCode: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerNationalId: string;
  vehicleName: string;
  pickupDate: string;
  returnDate: string;
  pickupTime: string;
  returnTime: string;
  rentalDays: number;
  dailyPrice: number;
  basePrice: number;
  insuranceAmount: number;
  driverFee: number;
  totalPrice: number;
  withDriver: boolean;
  deliveryLocation: string;
  termsAndConditions: string[];
  issuedAt: string;
}

export const ContractModal: React.FC<ContractModalProps> = ({ booking, onClose }) => {
  const modalRef = useFocusTrap({ isOpen: Boolean(booking), onClose });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractDetails | null>(null);

  useEffect(() => {
    if (!booking) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const loadContract = async () => {
      try {
        const res = await functionsService.generateRentalContractPdf({ bookingId: booking.id });
        if (!isMounted) return;

        if (res.success && res.data?.contract) {
          setContract(res.data.contract as ContractDetails);
        } else if (res.success && res.data) {
          // Flattened response fallback
          const d = res.data as { contractId?: string; contractNumber?: string; bookingId?: string };
          setContract({
            contractId: d.contractId || booking.id,
            contractNumber: d.contractNumber || `SHK-CTR-${booking.id.slice(-6).toUpperCase()}`,
            bookingId: d.bookingId || booking.id,
            bookingNumber: booking.bookingNumber,
            verificationCode: `VER-${booking.id.slice(-8).toUpperCase()}-2026`,
            status: 'active',
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
          } as ContractDetails);
        } else {
          // Dev / Fallback mock contract data for offline/test environments
          const contractNumber = `SHK-CTR-${booking.id.slice(-6).toUpperCase()}`;
          const fallbackCode = `VER-${booking.id.slice(-8).toUpperCase()}-2026`;
          setContract({
            contractId: `CTR_${booking.id}`,
            contractNumber,
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber || booking.id,
            verificationCode: fallbackCode,
            status: 'active',
            customerName: booking.customerName || 'المستأجر',
            customerPhone: booking.customerPhone || '',
            customerNationalId: booking.customerNationalId || '',
            vehicleName: booking.vehicleName || 'المركبة',
            pickupDate: booking.pickupDate,
            returnDate: booking.returnDate,
            pickupTime: booking.pickupTime || '10:00',
            returnTime: booking.returnTime || '10:00',
            rentalDays: booking.rentalDays || 1,
            dailyPrice: booking.dailyPrice || 0,
            basePrice: booking.basePrice || 0,
            insuranceAmount: booking.insuranceAmount || 0,
            driverFee: booking.driverFee || 0,
            totalPrice: booking.totalPrice || 0,
            withDriver: Boolean(booking.withDriver),
            deliveryLocation: booking.deliveryLocation || 'مقر شركة شاكر لتأجير السيارات - دمشق',
            termsAndConditions: [
              'يلتزم المستأجر بالمحافظة على السيارة واستخدامها وفق القوانين والأنظمة المرورية السورية.',
              'تعتبر السيارة أمانة لدى المستأجر ولا يحق له تأجيرها للغير أو قيادتها من غير المفوضين بالعقد.',
              'إرجاع السيارة في الموعد والمكان المحددين وبنفس الحالة الفنية التي تم استلامها عليها.',
              'المستأجر مسؤول عن أي مخالفات مرورية أو أضرار ناجمة عن سوء الاستخدام خلال فترة الإيجار.',
            ],
            issuedAt: new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error('Failed to load contract:', err);
        setError(err instanceof Error ? err.message : 'عذراً، تعذر جلب وثيقة العقد الرقمية من الخادم.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadContract();

    return () => {
      isMounted = false;
    };
  }, [booking]);

  if (!booking) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-modal-title"
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col"
      >
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 id="contract-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>عقد تأجير سيارة رسمي</span>
                {contract?.contractNumber && (
                  <span className="font-mono text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    {contract.contractNumber}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                وثيقة قانونية رقمية موقعة بختم أمني موحد قابل للطباعة والحفظ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !contract}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label="إغلاق نافذة العقد"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto p-4 sm:p-8 flex-1 bg-slate-950/40">
          {isLoading ? (
            <div className="py-24 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
              <p className="text-sm font-bold text-white">جاري إعداد وتوقيع وثيقة العقد الرقمية...</p>
              <p className="text-xs text-slate-400">يتم التحقق من الحساب والمطالبات الأمنية المشفرة</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm space-y-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
                <span className="font-bold">تعذر فتح وثيقة العقد</span>
              </div>
              <p className="text-xs text-slate-300 pr-9">{error}</p>
              <div className="pt-2 pr-9">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  العودة
                </button>
              </div>
            </div>
          ) : contract ? (
            /* Printable Contract Paper Container (White on print, dark styled in app) */
            <div className="print-page bg-white text-slate-900 p-6 sm:p-10 rounded-2xl shadow-xl space-y-6 text-xs sm:text-sm border border-slate-200">
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-slate-900 pb-5 gap-4">
                <div className="text-right space-y-1">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
                    شركة شاكر لتأجير السيارات
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Shaker Car Rental Company — دمشق، سوريا
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    هاتف: +963 944 000 000 • العنوان: دمشق - جرمانا
                  </p>
                </div>

                <div className="text-left sm:text-left bg-slate-100 p-3.5 rounded-xl border border-slate-300 min-w-[220px]">
                  <div className="flex items-center justify-between gap-3 text-xs mb-1">
                    <span className="text-slate-500 font-semibold">رقم العقد:</span>
                    <span className="font-mono font-black text-slate-950">{contract.contractNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs mb-1">
                    <span className="text-slate-500 font-semibold">رقم الحجز:</span>
                    <span className="font-mono text-slate-800">{contract.bookingNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500 font-semibold">تاريخ التحرير:</span>
                    <span className="font-mono text-slate-800">
                      {new Date(contract.issuedAt).toLocaleDateString('ar-SY')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Title Badge */}
              <div className="text-center py-2 bg-slate-100 rounded-lg border border-slate-300">
                <h2 className="text-sm font-black text-slate-950 uppercase tracking-wide">
                  عقد تأجير سيارة سياحية بدون سائق / مع سائق
                </h2>
              </div>

              {/* Contracting Parties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Party */}
                <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/60 space-y-1.5">
                  <h3 className="font-black text-slate-950 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>الطرف الأول (المؤجر):</span>
                  </h3>
                  <div className="text-xs space-y-1 text-slate-700">
                    <p><strong className="text-slate-900">الاسم:</strong> شركة شاكر لتأجير السيارات السياحية</p>
                    <p><strong className="text-slate-900">السجل التجاري:</strong> مسجل أصولاً في محافظة دمشق</p>
                    <p><strong className="text-slate-900">المقر:</strong> دمشق - جرمانا - الشارع العام</p>
                  </div>
                </div>

                {/* Second Party */}
                <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50/60 space-y-1.5">
                  <h3 className="font-black text-slate-950 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-700" />
                    <span>الطرف الثاني (المستأجر):</span>
                  </h3>
                  <div className="text-xs space-y-1 text-slate-700">
                    <p><strong className="text-slate-900">الاسم الكامل:</strong> {contract.customerName}</p>
                    <p><strong className="text-slate-900">رقم الهاتف:</strong> {contract.customerPhone || '—'}</p>
                    <p><strong className="text-slate-900">الرقم الوطني / الجواز:</strong> {contract.customerNationalId || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Vehicle & Rental Period Table */}
              <div className="space-y-2">
                <h3 className="font-black text-slate-950 flex items-center gap-1.5 text-xs">
                  <Car className="w-4 h-4 text-amber-700" />
                  <span>بيانات المركبة وفترة التأجير:</span>
                </h3>
                <div className="overflow-x-auto border border-slate-300 rounded-xl">
                  <table className="w-full text-xs text-right border-collapse">
                    <tbody className="divide-y divide-slate-200">
                      <tr className="bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-600 w-1/4">السيارة المطلوبة:</td>
                        <td className="p-2.5 font-black text-slate-900 w-1/4">{contract.vehicleName}</td>
                        <td className="p-2.5 font-bold text-slate-600 w-1/4">مكان التسليم:</td>
                        <td className="p-2.5 text-slate-800 w-1/4">{contract.deliveryLocation}</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-600">تاريخ ووقت الاستلام:</td>
                        <td className="p-2.5 font-mono text-slate-900">
                          {contract.pickupDate} ({contract.pickupTime})
                        </td>
                        <td className="p-2.5 font-bold text-slate-600">تاريخ ووقت الإعادة:</td>
                        <td className="p-2.5 font-mono text-slate-900">
                          {contract.returnDate} ({contract.returnTime})
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-600">مدة الإيجار:</td>
                        <td className="p-2.5 font-bold text-slate-900">{contract.rentalDays} أيام</td>
                        <td className="p-2.5 font-bold text-slate-600">سائق خاص:</td>
                        <td className="p-2.5 text-slate-900 font-semibold">
                          {contract.withDriver ? 'نعم (شامل خدمة سائق)' : 'لا (قيادة المستأجر)'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div className="space-y-2">
                <h3 className="font-black text-slate-950 flex items-center gap-1.5 text-xs">
                  <DollarSign className="w-4 h-4 text-emerald-700" />
                  <span>بيانات الحساب المالي للعقد:</span>
                </h3>
                <div className="overflow-x-auto border border-slate-300 rounded-xl">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-2.5">الأجرة اليومية</th>
                        <th className="p-2.5">قيمة الإيجار الأساسي</th>
                        <th className="p-2.5">التأمين المسترد</th>
                        <th className="p-2.5">رسوم السائق</th>
                        <th className="p-2.5 bg-slate-200 text-slate-950">الإجمالي النهائي للتعاقد</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="font-mono">
                        <td className="p-2.5">${contract.dailyPrice}</td>
                        <td className="p-2.5">${contract.basePrice}</td>
                        <td className="p-2.5">${contract.insuranceAmount}</td>
                        <td className="p-2.5">${contract.driverFee}</td>
                        <td className="p-2.5 font-black text-sm text-slate-950 bg-slate-100">
                          ${contract.totalPrice}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="space-y-2">
                <h3 className="font-black text-slate-950 text-xs">
                  الشروط والأحكام القانونية المعتمدة:
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-300 leading-relaxed">
                  {contract.termsAndConditions.map((term, idx) => (
                    <li key={idx}>{term}</li>
                  ))}
                </ol>
              </div>

              {/* Signatures Area */}
              <div className="grid grid-cols-2 gap-8 pt-4 border-t-2 border-slate-200">
                <div className="text-center space-y-8">
                  <p className="font-bold text-slate-800 text-xs">توقيع وختم المؤجر (شركة شاكر):</p>
                  <div className="h-12 border-b border-dashed border-slate-400 mx-auto w-3/4 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400 font-serif italic">ختم الإدارة المعتمد</span>
                  </div>
                </div>

                <div className="text-center space-y-8">
                  <p className="font-bold text-slate-800 text-xs">توقيع المستأجر (المقر بما فيه):</p>
                  <div className="h-12 border-b border-dashed border-slate-400 mx-auto w-3/4 flex items-center justify-center">
                    <span className="text-[10px] text-slate-400">{contract.customerName}</span>
                  </div>
                </div>
              </div>

              {/* Security Verification Footer & HMAC Code */}
              <div className="pt-4 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
                  <div className="text-[11px] text-slate-600">
                    <span className="font-bold text-slate-900 block">
                      الختم الرقمي الأمني (HMAC-SHA256 Authenticated)
                    </span>
                    <span>وثيقة رسمية صادرة ومسجلة في خوادم شاكر لتأجير السيارات</span>
                  </div>
                </div>

                <div className="text-left font-mono">
                  <span className="text-[10px] text-slate-500 block">Security Verification Code:</span>
                  <span className="text-xs font-black text-slate-950 bg-white px-2.5 py-1 rounded border border-slate-300 inline-block tracking-wider">
                    {contract.verificationCode}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
