import React from 'react';
import {
  AlertCircle,
  Camera,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { DocQualityMetric, IdentityDocChoice, VerificationRequest, VerificationStatus } from '../../types';
import { CameraCapture } from '../CameraCapture';

export interface HeaderVerificationBadgeProps {
  verificationLoaded: boolean;
  profileLoaded: boolean;
  isVerified: boolean;
  currentStatus: VerificationStatus | null;
}

export const HeaderVerificationBadge: React.FC<HeaderVerificationBadgeProps> = ({
  verificationLoaded,
  profileLoaded,
  isVerified,
  currentStatus,
}) => {
  if (!verificationLoaded && !profileLoaded && !isVerified) {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/80 text-amber-300 font-bold border border-slate-700 flex items-center gap-1.5">
        <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
        <span>جاري التحقق...</span>
      </span>
    );
  }
  if (currentStatus === 'verified') {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        <span>موثق الهوية</span>
      </span>
    );
  }
  if (currentStatus === 'pending_review') {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
        <Clock className="w-3 h-3 text-amber-400" />
        <span>قيد المراجعة</span>
      </span>
    );
  }
  if (currentStatus === 'rejected') {
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 flex items-center gap-1">
        <ShieldAlert className="w-3 h-3 text-rose-400" />
        <span>مرفوض التوثيق</span>
      </span>
    );
  }
  return (
    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold border border-slate-700 flex items-center gap-1">
      <Shield className="w-3 h-3 text-slate-400" />
      <span>غير موثق</span>
    </span>
  );
};

export interface VerificationTabProps {
  currentStatus: VerificationStatus;
  verificationRequest: VerificationRequest | null;
  identityChoice: IdentityDocChoice;
  onIdentityChoiceChange: (choice: IdentityDocChoice) => void;
  capturedDocs: {
    driver_license?: { file: File; quality: DocQualityMetric; uploaded: boolean };
    identity?: { file: File; quality: DocQualityMetric; uploaded: boolean };
  };
  activeCameraSlot: 'driver_license' | 'identity' | null;
  onActiveCameraSlotChange: (slot: 'driver_license' | 'identity' | null) => void;
  isUploadingDoc: boolean;
  isSubmittingRequest: boolean;
  verificationError: string | null;
  verificationSuccessNotice: string | null;
  isRestartingVerification: boolean;
  onSlotCapture: (file: File, quality: DocQualityMetric) => Promise<void>;
  onFinalSubmit: () => Promise<void>;
  onRestartVerification: () => void;
  onOpenBooking: () => void;
}

export const VerificationTab: React.FC<VerificationTabProps> = ({
  currentStatus,
  verificationRequest,
  identityChoice,
  onIdentityChoiceChange,
  capturedDocs,
  activeCameraSlot,
  onActiveCameraSlotChange,
  isUploadingDoc,
  isSubmittingRequest,
  verificationError,
  verificationSuccessNotice,
  isRestartingVerification,
  onSlotCapture,
  onFinalSubmit,
  onRestartVerification,
  onOpenBooking,
}) => {
  const showIntakeForm =
    currentStatus === 'not_started' || (currentStatus === 'rejected' && isRestartingVerification);
  const useStoredDocs = !(currentStatus === 'rejected' && isRestartingVerification);
  const hasDriverLicense = Boolean(
    (useStoredDocs && verificationRequest?.docs?.driver_license) || capturedDocs.driver_license?.uploaded
  );
  const hasIdentityDoc = Boolean(
    (useStoredDocs && verificationRequest?.docs?.identity) || capturedDocs.identity?.uploaded
  );
  const canSubmitVerification =
    hasDriverLicense &&
    hasIdentityDoc &&
    currentStatus !== 'pending_review' &&
    currentStatus !== 'verified';

  return (
    <div className="space-y-4">
      {/* Feedback messages */}
      {verificationError && (
        <div className="p-3 rounded-card bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{verificationError}</span>
        </div>
      )}

      {verificationSuccessNotice && (
        <div className="p-3 rounded-card bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{verificationSuccessNotice}</span>
        </div>
      )}

      {/* Verification Benefits Card */}
      {currentStatus !== 'verified' && (
        <div className="p-4 rounded-card bg-amber-500/10 border border-amber-500/20 text-sm text-slate-300 space-y-2">
          <h3 className="font-extrabold text-amber-400 flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4" />
            مزايا توثيق الحساب
          </h3>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>تسليم السيارة لأي مكان أينما كان.</li>
            <li>أفضلية في الحجوزات: تظهر طلباتك أولاً لدى الإدارة.</li>
          </ul>
        </div>
      )}

      {/* STATE A: VERIFIED */}
      {currentStatus === 'verified' && (
        <div className="p-5 rounded-card bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">حسابك موثق رسمياً ومعتمد</h3>
              <p className="text-sm text-emerald-300/80">
                تم التحقق من وثائق الحساب والهوية بنجاح، يمكنك الآن حجز أي سيارة من الأسطول مباشرة.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20 text-slate-300">
              <span className="text-sm text-slate-400 block mb-0.5">تاريخ التوثيق:</span>
              <span className="tabular-nums text-emerald-300">
                {verificationRequest?.reviewedAt
                  ? new Date(verificationRequest.reviewedAt).toLocaleDateString('ar-SY-u-nu-latn')
                  : 'معتمد'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-emerald-500/20 text-slate-300">
              <span className="text-sm text-slate-400 block mb-0.5">وثيقة إثبات الشخصية:</span>
              <span className="text-emerald-300 font-bold">
                {verificationRequest?.identityDocType === 'passport' ? 'وثيقة السفر' : 'الهوية الشخصية'}
              </span>
            </div>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              onClick={() => {
                onOpenBooking();
              }}
              className="px-5 py-2.5 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
            >
              <Car className="w-4 h-4" />
              <span>تصفح الأسطول واحجز سيارتك</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE B: PENDING REVIEW */}
      {currentStatus === 'pending_review' && (
        <div className="p-5 rounded-card bg-slate-950/80 border border-amber-500/40 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 animate-pulse">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">طلب التوثيق قيد المراجعة الإدارية</h3>
              <p className="text-sm text-amber-300/80">
                تم استلام وثائقك بنجاح وجاري فحصها من قبل إدارة شاكر لتأجير السيارات في دمشق.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-300 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">تاريخ تقديم الطلب:</span>
              <span className="tabular-nums text-white">
                {verificationRequest?.submittedAt
                  ? new Date(verificationRequest.submittedAt).toLocaleString('ar-SY-u-nu-latn')
                  : 'اليوم'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">نوع وثيقة الإثبات:</span>
              <span className="font-bold text-amber-400">
                {verificationRequest?.identityDocType === 'passport' ? 'وثيقة السفر' : 'الهوية الشخصية'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">حالة المستندات:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>محفوظة ومقفلة للأمان</span>
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300/90 leading-relaxed">
            🔒 <strong className="font-bold">حماية وتأمين البيانات:</strong> تبقى الوثائق مشفرة في مساحة التدقيق ولا يمكن حذفها أو استبدالها أثناء سريان المراجعة حرصاً على مصداقية وسرعة التدقيق.
          </div>
        </div>
      )}

      {/* STATE C: REJECTED */}
      {currentStatus === 'rejected' && !isRestartingVerification && (
        <div className="p-5 rounded-card bg-rose-950/30 border border-rose-500/40 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-rose-200">تم رفض طلب التوثيق</h3>
              <p className="text-sm text-rose-300/80">
                يرجى مراجعة سبب الرفض وإعادة تصوير الوثائق المطلوبة بدقة ووضوح.
              </p>
            </div>
          </div>

          {verificationRequest?.rejectionReason && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-rose-500/30 text-sm">
              <span className="text-sm text-rose-400 font-bold block mb-1">سبب الرفض المسجل من الإدارة:</span>
              <p className="text-white font-medium">{verificationRequest.rejectionReason}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onRestartVerification}
              className="px-5 py-2.5 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>بدء محاولة توثيق جديدة</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE D: NOT STARTED / INTAKE FORM */}
      {showIntakeForm && (
        <div className="space-y-4">
          <div className="p-4 rounded-card bg-slate-950/80 border border-slate-800 text-sm text-slate-300 space-y-2">
            <div className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>خطوات توثيق الحساب:</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              وفقاً لشروط تأجير السيارات في سوريا، يلزم توثيق الحساب بصورتين حصراً تم التقاطهما مباشرة بالكاميرا:
              <strong className="text-white font-bold"> وثيقة القيادة</strong> + <strong className="text-white font-bold">الهوية الشخصية أو وثيقة السفر</strong>.
            </p>
          </div>

          {/* Document Choice Selector (National ID vs Passport) */}
          <div className="p-3.5 rounded-card bg-slate-950/60 border border-slate-800 space-y-2">
            <label className="text-sm font-bold text-white block">
              اختر وثيقة إثبات الشخصية الثانية:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onIdentityChoiceChange('national_id')}
                className={`p-2.5 min-h-11 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 ${
                  identityChoice === 'national_id'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>الهوية الشخصية (الوجه الأمامي)</span>
              </button>

              <button
                type="button"
                onClick={() => onIdentityChoiceChange('passport')}
                className={`p-2.5 min-h-11 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 ${
                  identityChoice === 'passport'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>وثيقة السفر (صفحة البيانات)</span>
              </button>
            </div>
          </div>

          {/* Document Slots Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* SLOT 1: DRIVER LICENSE */}
            <div className={`p-4 rounded-card border flex flex-col items-center text-center gap-3 transition-all ${
              hasDriverLicense
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}>
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
                hasDriverLicense
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-amber-400'
              }`}>
                {hasDriverLicense ? <CheckCircle2 className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-white">وثيقة القيادة</h3>
                <p className="text-sm text-slate-400 mt-1">صوّر الوجه الأمامي لوثيقة القيادة بوضوح تام</p>
              </div>

              {hasDriverLicense ? (
                <div className="w-full space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تم الالتقاط بنجاح</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onActiveCameraSlotChange('driver_license')}
                    className="w-full min-h-11 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>إعادة التصوير</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onActiveCameraSlotChange('driver_license')}
                  disabled={isUploadingDoc}
                  className="w-full min-h-11 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-extrabold transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Camera className="w-4 h-4" />
                  <span>التقاط بالكاميرا</span>
                </button>
              )}
            </div>

            {/* SLOT 2: IDENTITY DOC (NATIONAL ID OR PASSPORT) */}
            <div className={`p-4 rounded-card border flex flex-col items-center text-center gap-3 transition-all ${
              hasIdentityDoc
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}>
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
                hasIdentityDoc
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-amber-400'
              }`}>
                {hasIdentityDoc ? <CheckCircle2 className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-white">
                  {identityChoice === 'passport' ? 'وثيقة السفر' : 'الهوية الشخصية'}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {identityChoice === 'passport' ? 'صوّر صفحة البيانات الشخصية في وثيقة السفر' : 'صوّر الوجه الأمامي للبطاقة بوضوح'}
                </p>
              </div>

              {hasIdentityDoc ? (
                <div className="w-full space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تم الالتقاط بنجاح</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onActiveCameraSlotChange('identity')}
                    className="w-full min-h-11 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>إعادة التصوير</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onActiveCameraSlotChange('identity')}
                  disabled={isUploadingDoc}
                  className="w-full min-h-11 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-extrabold transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Camera className="w-4 h-4" />
                  <span>التقاط بالكاميرا</span>
                </button>
              )}
            </div>
          </div>

          {/* Submission CTA Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!canSubmitVerification || isSubmittingRequest}
              onClick={onFinalSubmit}
              className="w-full min-h-11 py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98"
            >
              {isSubmittingRequest ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري إرسال الطلب واعتماد الوثائق...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>إرسال طلب التوثيق للمراجعة الإدارية</span>
                </>
              )}
            </button>
            {!canSubmitVerification && (
              <p className="text-sm text-slate-400 text-center mt-2">
                يجب إكمال تصوير وثيقة القيادة ووثيقة إثبات الشخصية لتفعيل زر الإرسال.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Camera Modal component */}
      <CameraCapture
        isOpen={activeCameraSlot !== null}
        title={
          activeCameraSlot === 'driver_license'
            ? 'تصوير وثيقة القيادة (الوجه الأمامي)'
            : `تصوير ${identityChoice === 'passport' ? 'وثيقة السفر' : 'الهوية الشخصية'}`
        }
        docLabel={
          activeCameraSlot === 'driver_license'
            ? 'تأكد من وضوح بيانات الوثيقة وتاريخ الصلاحية'
            : 'تأكد من وضوح الاسم والرقم الوطني والصورة'
        }
        onClose={() => onActiveCameraSlotChange(null)}
        onCapture={onSlotCapture}
      />
    </div>
  );
};
