import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, CheckCircle2, XCircle, AlertTriangle, Loader2, FileText, Calendar, Car } from 'lucide-react';
import { functionsService } from '../services/functionsService';
import { formatDateDisplay } from '../utils/format';

function getQueryParam(key: string): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get(key) || '';
}

function getCodeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  if (window.location.hash) {
    const hashStr = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(hashStr);
    const code = hashParams.get('code') || hashParams.get('verificationCode');
    if (code) return code.trim();
    if (!hashStr.includes('=') && hashStr.trim()) return hashStr.trim();
  }
  const params = new URLSearchParams(window.location.search);
  return (params.get('code') || params.get('verificationCode') || '').trim();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const formatted = formatDateDisplay(dateStr);
  if (formatted) return formatted;
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('ar-SY-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function translateStatus(status?: string): string {
  switch (status) {
    case 'active':
      return 'ساري المفعول (المركبة لدى المستأجر)';
    case 'closed':
      return 'مغلق (تم إرجاع المركبة وإتمام الحجز)';
    case 'terminated':
      return 'ملغى قانونياً';
    case 'issued':
    default:
      return 'مُصدر ومعتمد (بانتظار التسليم)';
  }
}

export const VerifyContractPage: React.FC = () => {
  const [contractNumberInput, setContractNumberInput] = useState<string>(
    () => getQueryParam('contract') || getQueryParam('contractNumber')
  );
  const [verificationCodeInput, setVerificationCodeInput] = useState<string>(
    () => getCodeFromUrl()
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid?: boolean;
    contractNumber?: string;
    bookingNumber?: string;
    vehicleName?: string;
    pickupDate?: string;
    returnDate?: string;
    status?: string;
    terminationReason?: string;
    issuedAt?: string;
    customerName?: string;
    totalAmount?: number;
    contentHashPrefix?: string;
    message?: string;
    isRateLimited?: boolean;
    errorText?: string;
  } | null>(null);

  const handleVerify = useCallback(async (cNum?: string, vCode?: string) => {
    const num = (cNum ?? contractNumberInput).trim();
    const code = (vCode ?? verificationCodeInput).trim();

    if (!num || !code) {
      setVerificationResult({
        isValid: false,
        errorText: 'يرجى إدخال رقم العقد ورمز التحقق الرقمي بشكل كامل.',
      });
      return;
    }

    setIsLoading(true);
    setVerificationResult(null);

    try {
      const res = await functionsService.verifyContractCode({
        contractNumber: num,
        verificationCode: code,
      });

      if (res.success && res.data) {
        setVerificationResult({
          isValid: res.data.isValid,
          contractNumber: res.data.contractNumber || num,
          bookingNumber: res.data.bookingNumber,
          vehicleName: res.data.vehicleName,
          pickupDate: res.data.pickupDate,
          returnDate: res.data.returnDate,
          status: res.data.status,
          terminationReason: res.data.terminationReason,
          issuedAt: res.data.issuedAt,
          customerName: res.data.terminationReason === 'deleted' ? undefined : res.data.customerName,
          totalAmount: res.data.totalAmount,
          contentHashPrefix: res.data.contentHashPrefix,
          message: res.data.message,
        });
      } else {
        const errorMsg = res.error || 'تعذر الاتصال بخدمة التحقق من العقود.';
        const isRateLimit = errorMsg.includes('تجاوز') || errorMsg.includes('عدد محاولات');
        setVerificationResult({
          isValid: false,
          isRateLimited: isRateLimit,
          errorText: isRateLimit
            ? 'تجاوزت الحد المسموح به من محاولات التحقق. يرجى الانتظار بضع دقائق ثم المحاولة مجدداً.'
            : errorMsg,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setVerificationResult({
        isValid: false,
        errorText: msg || 'حدث خطأ غير متوقع أثناء التحقق.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [contractNumberInput, verificationCodeInput]);

  useEffect(() => {
    const initialContract = getQueryParam('contract') || getQueryParam('contractNumber');
    const initialCode = getCodeFromUrl();

    if (initialContract && initialCode) {
      const timer = setTimeout(() => {
        handleVerify(initialContract, initialCode);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [handleVerify]);

  const onSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  return (
    <div className="min-h-[80dvh] bg-slate-950 text-slate-100 py-10 px-4 sm:px-6" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">التحقق من صحة عقد التأجير</h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            منظومة التدقيق السحابية والتحقق الرقمي المعتمدة لشركة شاكر لتأجير السيارات. أدخل رقم العقد ورمز التحقق للتيقن من أصالة الوثيقة.
          </p>
        </div>

        {/* Verification Input Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-card p-6 sm:p-8 shadow-xl">
          <form onSubmit={onSubmitForm} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="contractNumber" className="block text-sm font-bold text-slate-300">
                  رقم العقد الرقمي
                </label>
                <input
                  id="contractNumber"
                  type="text"
                  value={contractNumberInput}
                  onChange={(e) => setContractNumberInput(e.target.value)}
                  placeholder="مثال: CTR-1001"
                  className="w-full min-h-11 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none transition-colors font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="verificationCode" className="block text-sm font-bold text-slate-300">
                  رمز التحقق المشفّر (Verification Code)
                </label>
                <input
                  id="verificationCode"
                  type="text"
                  value={verificationCodeInput}
                  onChange={(e) => setVerificationCodeInput(e.target.value)}
                  placeholder="أدخل الرمز المكتوب أسفل العقد"
                  className="w-full min-h-11 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none transition-colors font-mono uppercase"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !contractNumberInput.trim() || !verificationCodeInput.trim()}
              className="w-full min-h-11 py-3.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-amber-500/10"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق من سجلات الخادم المجمّدة...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>التحقق من صحة العقد</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Verification Result Display */}
        {verificationResult && (
          <div className="transition-all animate-in fade-in duration-200">
            {verificationResult.status === 'terminated' ? (
              /* Dedicated Terminated Contract Card */
              <div className="bg-amber-950/40 border-2 border-amber-500/50 rounded-card p-6 sm:p-8 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20">
                      عقد ملغى رسمياً
                    </span>
                    <h2 className="text-lg sm:text-xl font-extrabold text-amber-200 mt-1">
                      العقد ملغى قانونياً وغير صالح للاستخدام
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      رقم العقد:
                    </span>
                    <p className="font-mono font-bold text-white text-base">{verificationResult.contractNumber}</p>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      رقم الحجز:
                    </span>
                    <p className="font-mono font-bold text-white text-base">{verificationResult.bookingNumber || '—'}</p>
                  </div>

                  {verificationResult.customerName && (
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400">المستأجر (المطابق للرمز):</span>
                      <p className="font-bold text-white">{verificationResult.customerName}</p>
                    </div>
                  )}

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-amber-400" />
                      المركبة:
                    </span>
                    <p className="font-bold text-white">{verificationResult.vehicleName || 'مركبة مسجلة'}</p>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                      الحالة القانونية:
                    </span>
                    <p className="font-bold text-rose-400">ملغى قانونياً</p>
                  </div>

                  {verificationResult.totalAmount !== undefined && (
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400">القيمة المسجلة:</span>
                      <p className="font-mono font-bold text-amber-300 text-base">{verificationResult.totalAmount}$</p>
                    </div>
                  )}

                  {verificationResult.contentHashPrefix && (
                    <div className="col-span-full bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400">بصمة التجميد الرقمية (SHA-256):</span>
                      <p className="font-mono text-xs text-amber-300/80 font-bold tracking-wider" dir="ltr">
                        {verificationResult.contentHashPrefix}...
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-card p-4 text-sm text-amber-300 leading-relaxed font-bold">
                  {verificationResult.message || 'العقد ملغى قانونياً وغير صالح للاستخدام.'}
                </div>
              </div>
            ) : verificationResult.isValid ? (
              /* Valid Authentic Contract Card */
              <div className="bg-emerald-950/40 border-2 border-emerald-500/40 rounded-card p-6 sm:p-8 space-y-6 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-4">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                      وثيقة أصلية ومعتمدة
                    </span>
                    <h2 className="text-lg sm:text-xl font-extrabold text-emerald-200 mt-1">
                      العقد مجمّد ومطابق لسجلات الشركة الرسمية
                    </h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      رقم العقد:
                    </span>
                    <p className="font-mono font-bold text-white text-base">{verificationResult.contractNumber}</p>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      رقم الحجز:
                    </span>
                    <p className="font-mono font-bold text-white text-base">{verificationResult.bookingNumber || '—'}</p>
                  </div>

                  {verificationResult.customerName && (
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400">المستأجر:</span>
                      <p className="font-bold text-white">{verificationResult.customerName}</p>
                    </div>
                  )}

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-amber-400" />
                      المركبة المؤجّرة:
                    </span>
                    <p className="font-bold text-white">{verificationResult.vehicleName || 'مركبة مسجلة'}</p>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      حالة العقد القانونية:
                    </span>
                    <p className="font-bold text-emerald-300">{translateStatus(verificationResult.status)}</p>
                  </div>

                  {verificationResult.totalAmount !== undefined && (
                    <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400">قيمة العقد الإجمالية:</span>
                      <p className="font-mono font-bold text-emerald-400 text-base">{verificationResult.totalAmount}$</p>
                    </div>
                  )}

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      فترة الإيجار:
                    </span>
                    <p className="font-bold text-white">
                      من <span dir="ltr" className="inline-block font-mono">{formatDate(verificationResult.pickupDate)}</span> إلى <span dir="ltr" className="inline-block font-mono">{formatDate(verificationResult.returnDate)}</span>
                    </p>
                  </div>

                  <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      تاريخ التحرير والإصدار:
                    </span>
                    <p className="font-bold text-white">{formatDate(verificationResult.issuedAt)}</p>
                  </div>

                  {verificationResult.contentHashPrefix && (
                    <div className="col-span-full bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-slate-400">بصمة التجميد الرقمية (SHA-256):</span>
                      <p className="font-mono text-xs text-amber-300 font-bold tracking-wider" dir="ltr">
                        {verificationResult.contentHashPrefix}...
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-card p-4 text-sm text-emerald-300 leading-relaxed">
                  {verificationResult.message || 'تمت مطابقة التوقيع الرقمي واللقطة المجمّدة بنجاح. هذه الوثيقة صادرة وقانونية.'}
                </div>
              </div>
            ) : verificationResult.isRateLimited ? (
              /* Rate Limit Error Card */
              <div className="bg-amber-950/40 border-2 border-amber-500/40 rounded-card p-6 sm:p-8 space-y-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-amber-200">تجاوز عدد المحاولات المسموح بها</h2>
                    <p className="text-sm text-amber-400 mt-1">
                      {verificationResult.errorText || 'لقد تجاوزت عدد محاولات التحقق المسموح بها. يرجى الانتظار عدة دقائق ثم المحاولة مجدداً.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Invalid or Tampered Contract Card */
              <div className="bg-rose-950/40 border-2 border-rose-500/40 rounded-card p-6 sm:p-8 space-y-4 shadow-xl">
                <div className="flex items-center gap-3 border-b border-rose-500/20 pb-4">
                  <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                    <XCircle className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-md border border-rose-500/20">
                      رمز غير مطابق
                    </span>
                    <h2 className="text-lg font-extrabold text-rose-200 mt-1">
                      الوثيقة غير مطابقة أو غير مسجلة للنظام
                    </h2>
                  </div>
                </div>

                <p className="text-sm text-rose-300 leading-relaxed">
                  {verificationResult.message || verificationResult.errorText || 'رمز التحقق الرقمي غير مطابق لبيانات هذا العقد، أو أنه قد تم التلاعب بقيم الوثيقة المجمّدة.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
