import React, { useRef } from 'react';
import { Booking, Vehicle, AppSettings } from '../types';
import { Printer, Download, X, Car, Shield, CheckCircle2 } from 'lucide-react';

interface ContractModalProps {
  booking: Booking;
  vehicle: Vehicle;
  settings: AppSettings;
  onClose: () => void;
}

export const ContractModal: React.FC<ContractModalProps> = ({
  booking,
  vehicle,
  settings,
  onClose,
}) => {
  const contractRef = useRef<HTMLDivElement>(null);
  const contractNumber = `CNT-2026-${booking.bookingNumber.replace(/[^0-9]/g, '').slice(-6) || '0001'}`;
  const currentDate = new Date().toLocaleDateString('ar-SY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-6 animate-in zoom-in-95 duration-200">
        {/* Top Control Bar (Hidden during print) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 print:hidden text-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">عقد إيجار سيارة رسمي</h3>
              <span className="text-xs text-slate-400">رقم العقد: {contractNumber} • جاهز للطباعة والتوقيع</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all"
              id="print-contract-btn"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة العقد (A4)</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Contract Document Container */}
        <div className="p-4 sm:p-8 bg-slate-800/40 overflow-y-auto max-h-[80vh] print:max-h-none print:p-0 print:bg-white">
          <div
            ref={contractRef}
            className="printable-contract bg-white text-slate-900 rounded-2xl shadow-xl p-8 sm:p-10 mx-auto max-w-3xl border border-slate-200 print:border-none print:shadow-none print:rounded-none print:w-full"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-950 mb-1">
                  شركة شاكر لتأجير السيارات
                </h1>
                <h2 className="text-sm font-bold text-slate-600 tracking-wider">
                  SHAKER CAR RENTAL
                </h2>
                <p className="text-xs text-slate-700 mt-2 font-medium">
                  الجمهورية العربية السورية • دمشق – جرمانا، شارع الخضر
                </p>
                <p className="text-xs text-slate-700 font-medium">
                  هاتف / واتساب: <span dir="ltr">00963 944 331 774</span>
                </p>
              </div>

              <div className="text-left">
                <div className="inline-block bg-slate-950 text-white px-3 py-1.5 rounded-lg text-xs font-black mb-2">
                  عقد إيجار سيارة سياحية
                </div>
                <div className="text-xs text-slate-800 space-y-1">
                  <div><strong>رقم العقد:</strong> <span className="font-mono">{contractNumber}</span></div>
                  <div><strong>رقم الحجز:</strong> <span className="font-mono">{booking.bookingNumber}</span></div>
                  <div><strong>تاريخ التحرير:</strong> {currentDate}</div>
                </div>
              </div>
            </div>

            {/* Preamble */}
            <div className="text-xs leading-relaxed text-slate-700 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-200">
              تم بعون الله وتوفيقه في هذا اليوم إبرام هذا العقد بين كل من:
              <br />
              <strong>الطرف الأول (المؤجر):</strong> شركة شاكر لتأجير السيارات، ويمثلها مدير الفرع.
              <br />
              <strong>الطرف الثاني (المستأجر):</strong> السيد/ة المبيّنة بياناته/ا أدناه، حيث اتفق الطرفان وهما بكامل الأهلية المعتبرة قانوناً على الشروط الآتية:
            </div>

            {/* Section 1: Customer Details */}
            <div className="mb-6">
              <h3 className="text-xs font-black bg-slate-100 text-slate-900 px-3 py-1.5 rounded-md border border-slate-200 mb-3">
                أولاً: بيانات الطرف الثاني (المستأجر)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">الاسم الكامل:</span>
                  <span className="font-bold text-slate-900">{booking.customerName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم الهاتف:</span>
                  <span className="font-bold text-slate-900" dir="ltr">{booking.customerPhone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم الواتساب:</span>
                  <span className="font-bold text-slate-900" dir="ltr">{booking.customerWhatsApp}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الرقم الوطني / جواز السفر:</span>
                  <span className="font-bold text-slate-900">{booking.customerNationalId || 'مُطابق بالهوية'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم رخصة القيادة:</span>
                  <span className="font-bold text-slate-900">{booking.customerLicenseNumber || 'سارية المفعول'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">العنوان / مكان الإقامة:</span>
                  <span className="font-bold text-slate-900">{booking.customerAddress || 'دمشق'}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Vehicle Details */}
            <div className="mb-6">
              <h3 className="text-xs font-black bg-slate-100 text-slate-900 px-3 py-1.5 rounded-md border border-slate-200 mb-3">
                ثانياً: بيانات السيارة المؤجرة
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">الشركة والطراز:</span>
                  <span className="font-bold text-slate-900">{vehicle?.brand || 'شاكر'} {vehicle?.model || booking.vehicleName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">سنة الصنع واللون:</span>
                  <span className="font-bold text-slate-900">{vehicle?.year || 2024} - {vehicle?.color || 'فضي'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">رقم اللوحة:</span>
                  <span className="font-bold text-slate-900 font-mono">{vehicle?.plateNumber || 'دمشق'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">عداد الكيلومتر عند الاستلام:</span>
                  <span className="font-bold text-slate-900">{vehicle?.currentMileage != null ? vehicle.currentMileage.toLocaleString() : '50,000'} كم</span>
                </div>
              </div>
            </div>

            {/* Section 3: Rental Terms & Financials */}
            <div className="mb-6">
              <h3 className="text-xs font-black bg-slate-100 text-slate-900 px-3 py-1.5 rounded-md border border-slate-200 mb-3">
                ثالثاً: تفاصيل مدة التأجير والحساب المالي
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                <div>
                  <span className="text-slate-500 block">تاريخ ووقت الاستلام:</span>
                  <span className="font-bold text-slate-900">{booking.pickupDate} ({booking.pickupTime})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">تاريخ ووقت التسليم:</span>
                  <span className="font-bold text-slate-900">{booking.returnDate} ({booking.returnTime})</span>
                </div>
                <div>
                  <span className="text-slate-500 block">إجمالي أيام الإيجار:</span>
                  <span className="font-bold text-slate-900">{booking.rentalDays} أيام</span>
                </div>
                <div>
                  <span className="text-slate-500 block">الأجرة اليومية المعتمدة:</span>
                  <span className="font-bold text-slate-900">${booking.dailyPrice}</span>
                </div>
              </div>

              {/* Financial Calculation Table */}
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden text-right">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-2 border-b">البيان</th>
                    <th className="p-2 border-b">القيمة</th>
                    <th className="p-2 border-b">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2">أجرة السيارة الإجمالية ({booking.rentalDays} أيام)</td>
                    <td className="p-2 font-bold">${booking.basePrice - (booking.discountAmount || 0)}</td>
                    <td className="p-2 text-slate-500">
                      {booking.discountAmount ? `تم تطبيق خصم بقيمة $${booking.discountAmount}` : 'سعر يومي قياسي'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2">مبلغ التأمين المسترد (Deposit)</td>
                    <td className="p-2 font-bold text-amber-700">${booking.insuranceAmount}</td>
                    <td className="p-2 text-slate-500">
                      {booking.rentalDays <= 2 ? 'تأمين حجز قصير 1-2 يوم ($500)' : 'تأمين حجز أكثر من يومين ($300)'}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-black">
                    <td className="p-2">المبلغ الإجمالي المستحق</td>
                    <td className="p-2 text-sm text-slate-950">${booking.totalPrice}</td>
                    <td className="p-2">الأجرة + التأمين المسترد</td>
                  </tr>
                  <tr>
                    <td className="p-2">المبلغ المسدد</td>
                    <td className="p-2 font-bold text-emerald-700">${booking.paidAmount || 0}</td>
                    <td className="p-2">نقداً / حوالة معتمدة</td>
                  </tr>
                  <tr className="bg-slate-100 font-bold">
                    <td className="p-2">المبلغ المتبقي بذمة المستأجر</td>
                    <td className="p-2 text-rose-700">${booking.remainingAmount ?? (booking.totalPrice - (booking.paidAmount || 0))}</td>
                    <td className="p-2">يُسدد عند استلام مفتاح السيارة</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 4: Terms & Conditions */}
            <div className="mb-6">
              <h3 className="text-xs font-black bg-slate-100 text-slate-900 px-3 py-1.5 rounded-md border border-slate-200 mb-2">
                رابعاً: شروط وأحكام العقد والتزامات المستأجر
              </h3>
              <div className="text-[11px] leading-relaxed text-slate-700 space-y-1.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200">
                <p>1. يقر المستأجر بأنه عاين السيارة موضوع هذا العقد وتأكد من سلامتها الميكانيكية والجسدية وخلوها من العيوب واستلمها بحالة ممتازة.</p>
                <p>2. يتعهد المستأجر بقيادة السيارة بنفسه فقط، ويحظر عليه تسليم قيادتها لأي شخص آخر تحت طائلة المسؤولية المدنية والجزائية وتحمل كامل الأضرار.</p>
                <p>3. يُحظر استخدام السيارة في السباقات، أو تعليم القيادة، أو سحب مركبات أخرى، أو نقل مواد ممنوعة أو مخالفة للقوانين والأنظمة المعمول بها.</p>
                <p>4. يلتزم المستأجر بتبديل زيت المحرك وفلاتره كل 5000 كم بالتنسيق المباشر مع إدارة شركة شاكر لتأجير السيارات لتجنب أي أعطال ميكانيكية.</p>
                <p>5. في حال وقوع أي حادث (لا قدر الله)، يلتزم المستأجر بإبلاغ الشركة فوراً والحصول على ضبط شرطة رسمي، ولا يحق له إجراء أي إصلاحات دون إذن خطي.</p>
                <p>6. يُلزم المستأجر بإعادة السيارة بنفس مستوى الوقود ونظافة المقصورة كما استلمها، وإلا يحق للمؤجر اقتطاع فرق الوقود وتكاليف التنظيف من مبلغ التأمين.</p>
                <p>7. التأخير عن موعد التسليم المحدد يحتسب بسعر أجرة يوم كامل عن كل 3 ساعات تأخير ما لم يتم التنسيق وتجديد العقد خطياً مسبقاً.</p>
                <p>8. يُسترد مبلغ التأمين النقدي فور تسليم السيارة وإجراء الفحص الفني والتأكد من خلوها من المخالفات المرورية والأضرار.</p>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <span className="font-bold block mb-1">الطرف الأول (المؤجر)</span>
                <span className="text-slate-600 block text-[11px] mb-8">شركة شاكر لتأجير السيارات</span>
                <div className="border-t border-dashed border-slate-400 w-40 mx-auto pt-2">
                  الختم والتوقيع
                </div>
              </div>

              <div>
                <span className="font-bold block mb-1">الطرف الثاني (المستأجر)</span>
                <span className="text-slate-600 block text-[11px] mb-8">{booking.customerName}</span>
                <div className="border-t border-dashed border-slate-400 w-40 mx-auto pt-2">
                  توقيع المستأجر وبصمة الإبهام
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
