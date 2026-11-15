import React, { useState, useEffect, useMemo } from 'react';
import { AppSettings, Vehicle, DiscountConfig, SettingsPayload } from '../types';
import { ADMIN_TAB_LABEL } from '../constants/adminNav';
import { formatMoney } from '../utils/format';
import { functionsService } from '../services/functionsService';
import { dataService } from '../services/dataService';
import { DEFAULT_SETTINGS, calculateRentalPrice } from '../services/pricing';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { isValidPhone } from '../utils/phone';
import { CompanyIdentitySection } from './admin/settings/CompanyIdentitySection';
import { PricingAndInsuranceSection } from './admin/settings/PricingAndInsuranceSection';
import { PricingPreviewSection } from './admin/settings/PricingPreviewSection';
import { RentalTermsSection } from './admin/settings/RentalTermsSection';
import { SecuritySettingsSection } from './admin/settings/SecuritySettingsSection';

interface AdminSettingsProps {
  settings?: AppSettings;
  vehicles?: Vehicle[];
  onSettingsUpdated: (updated: AppSettings) => void;
}

const DEFAULT_SAMPLE_CAR: Vehicle = {
  id: 'sample_car_1',
  brand: 'كيا',
  model: 'سيراتو',
  year: 2024,
  category: 'light',
  color: 'أبيض لؤلؤي',
  dailyPrice: 30,
  seats: 5,
  transmission: 'automatic',
  fuelType: 'petrol',
  plateNumber: 'دمشق 123456',
  currentMileage: 15000,
  imageUrl: '',
  features: ['مكيف هواء', 'بلوتوث', 'حساسات ركن'],
  description: 'سيارة سيدان اقتصادية ومريحة',
  status: 'available',
  createdAt: new Date().toISOString(),
};

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings = DEFAULT_SETTINGS,
  vehicles = [],
  onSettingsUpdated,
}) => {
  const getNormalizedSettings = (s?: AppSettings): AppSettings => {
    const base = s || DEFAULT_SETTINGS;
    const shortTerm = base.insuranceShortTerm ?? base.insurance1to2Days ?? DEFAULT_SETTINGS.insurance1to2Days ?? 500;
    const longTerm = base.insuranceLongTerm ?? base.insuranceAbove2Days ?? DEFAULT_SETTINGS.insuranceAbove2Days ?? 300;

    const rawPct = base.discountConfig?.percentage;
    const safePct = Number.isFinite(rawPct) ? Math.min(25, Math.max(0, Number(rawPct))) : 0;

    return {
      ...DEFAULT_SETTINGS,
      ...base,
      companyName: base.companyName || DEFAULT_SETTINGS.companyName,
      companyNameEn: base.companyNameEn || DEFAULT_SETTINGS.companyNameEn,
      companyPhone: base.companyPhone || DEFAULT_SETTINGS.companyPhone,
      whatsappNumber: base.whatsappNumber || DEFAULT_SETTINGS.whatsappNumber,
      address: base.address || DEFAULT_SETTINGS.address,
      currency: base.currency || DEFAULT_SETTINGS.currency || '$',
      insurance1to2Days: shortTerm,
      insuranceAbove2Days: longTerm,
      insuranceShortTerm: shortTerm,
      insuranceLongTerm: longTerm,
      driverDailyRate: base.driverDailyRate ?? DEFAULT_SETTINGS.driverDailyRate ?? 40,
      cancellationLeadHours: base.cancellationLeadHours ?? 24,
      monthlyRateLight: base.monthlyRateLight ?? DEFAULT_SETTINGS.monthlyRateLight ?? 800,
      monthlyRateMedium: base.monthlyRateMedium ?? DEFAULT_SETTINGS.monthlyRateMedium ?? 1200,
      monthlyRateJeep: base.monthlyRateJeep ?? DEFAULT_SETTINGS.monthlyRateJeep ?? 1500,
      rentalTerms: base.rentalTerms ?? DEFAULT_SETTINGS.rentalTerms,
      discountConfig: {
        enabled: base.discountConfig?.enabled ?? DEFAULT_SETTINGS.discountConfig?.enabled ?? false,
        percentage: safePct,
        scope: base.discountConfig?.scope === 'specific' ? 'specific' : 'all',
        vehicleIds: base.discountConfig?.vehicleIds ?? DEFAULT_SETTINGS.discountConfig?.vehicleIds ?? [],
        title: base.discountConfig?.title ?? DEFAULT_SETTINGS.discountConfig?.title ?? 'خصم خاص للأعضاء المسجلين',
      },
    };
  };

  const { isSuperAdmin } = useAuth();
  const [initialSettings, setInitialSettings] = useState<AppSettings>(() => getNormalizedSettings(settings));
  const [formData, setFormData] = useState<AppSettings>(() => getNormalizedSettings(settings));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verifiedSavedValues, setVerifiedSavedValues] = useState<AppSettings | null>(null);

  // Admin MFA Enforcement Toggle state (Super Admin only - initial state is null until fetched via get)
  const [requireAdminMfa, setRequireAdminMfa] = useState<boolean | null>(null);
  const [isUpdatingMfaReq, setIsUpdatingMfaReq] = useState(false);
  const [mfaLoadError, setMfaLoadError] = useState(false);
  const [mfaReqFeedback, setMfaReqFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let active = true;
    functionsService
      .setAdminMfaRequirement({ action: 'get' })
      .then((res) => {
        if (!active) return;
        if (res.success && typeof res.data?.requireAdminMfa === 'boolean') {
          setRequireAdminMfa(res.data.requireAdminMfa);
          setMfaLoadError(false);
        } else {
          setMfaLoadError(true);
        }
      })
      .catch(() => {
        if (active) {
          setMfaLoadError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [isSuperAdmin]);

  const handleToggleAdminMfaRequirement = async (nextVal: boolean) => {
    setMfaReqFeedback(null);
    setIsUpdatingMfaReq(true);
    try {
      const res = await functionsService.setAdminMfaRequirement({ requireAdminMfa: nextVal });
      if (!res.success) {
        setMfaReqFeedback({
          type: 'error',
          message:
            res.error ||
            'تعذر تعديل إعداد فرض المصادقة الثنائية. تأكد من تفعيل المصادقة الثنائية على حسابك وتسجيل الدخول بالرمز الثنائي.',
        });
        return;
      }
      const updatedVal = typeof res.data?.requireAdminMfa === 'boolean' ? res.data.requireAdminMfa : nextVal;
      setRequireAdminMfa(updatedVal);
      setMfaReqFeedback({
        type: 'success',
        message:
          res.data?.message ||
          (updatedVal
            ? 'تم تفعيل فرض المصادقة الثنائية على المدراء بنجاح.'
            : 'تم إيقاف فرض المصادقة الثنائية على المدراء.'),
      });
    } catch (err: unknown) {
      setMfaReqFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'تم رفض العملية. تأكد من تفعيل المصادقة الثنائية وتسجيل الدخول بالرمز الثنائي.',
      });
    } finally {
      setIsUpdatingMfaReq(false);
    }
  };

  // Sync when prop updates
  useEffect(() => {
    if (settings) {
      queueMicrotask(() => {
        const normalized = getNormalizedSettings(settings);
        setInitialSettings(normalized);
        setFormData(normalized);
      });
    }
  }, [settings]);

  // Track dirty state
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(initialSettings);
  }, [formData, initialSettings]);

  // beforeunload warning when dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Real-time Field Validations (Bounds & Format)
  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    // 1. Insurance short-term (0 - 5000)
    const insShort = Number(formData.insuranceShortTerm ?? formData.insurance1to2Days);
    if (!Number.isFinite(insShort) || insShort < 0) {
      errors.insuranceShortTerm = 'يجب إدخال رقم موجب أو صفر.';
    } else if (insShort > 5000) {
      errors.insuranceShortTerm = 'الحد الأقصى لتأمين الحجوزات القصيرة هو 5000$.';
    }

    // 2. Insurance long-term (0 - 5000)
    const insLong = Number(formData.insuranceLongTerm ?? formData.insuranceAbove2Days);
    if (!Number.isFinite(insLong) || insLong < 0) {
      errors.insuranceLongTerm = 'يجب إدخال رقم موجب أو صفر.';
    } else if (insLong > 5000) {
      errors.insuranceLongTerm = 'الحد الأقصى لتأمين الحجوزات الطويلة هو 5000$.';
    }

    // 3. Driver daily rate (0 - 1000)
    const driverRate = Number(formData.driverDailyRate);
    if (!Number.isFinite(driverRate) || driverRate < 0) {
      errors.driverDailyRate = 'أجرة السائق اليومية يجب أن تكون رقماً موجباً أو صفراً.';
    } else if (driverRate > 1000) {
      errors.driverDailyRate = 'الحد الأقصى لأجرة السائق اليومية هو 1000$.';
    }

    // 4. Monthly rates (0 - 100000)
    const mLight = Number(formData.monthlyRateLight);
    if (!Number.isFinite(mLight) || mLight < 0) {
      errors.monthlyRateLight = 'السعر الشهري يجب أن يكون رقماً موجباً.';
    } else if (mLight > 100000) {
      errors.monthlyRateLight = 'الحد الأقصى للسعر الشهري هو 100,000$.';
    }

    const mMedium = Number(formData.monthlyRateMedium);
    if (!Number.isFinite(mMedium) || mMedium < 0) {
      errors.monthlyRateMedium = 'السعر الشهري يجب أن يكون رقماً موجباً.';
    } else if (mMedium > 100000) {
      errors.monthlyRateMedium = 'الحد الأقصى للسعر الشهري هو 100,000$.';
    }

    const mJeep = Number(formData.monthlyRateJeep);
    if (!Number.isFinite(mJeep) || mJeep < 0) {
      errors.monthlyRateJeep = 'السعر الشهري يجب أن يكون رقماً موجباً.';
    } else if (mJeep > 100000) {
      errors.monthlyRateJeep = 'الحد الأقصى للسعر الشهري هو 100,000$.';
    }

    // 5. Cancellation lead hours (0 - 720)
    const lead = Number(formData.cancellationLeadHours);
    if (!Number.isFinite(lead) || lead < 0) {
      errors.cancellationLeadHours = 'مهلة الإلغاء يجب أن تكون رقماً موجباً أو صفراً.';
    } else if (lead > 720) {
      errors.cancellationLeadHours = 'الحد الأقصى لمهلة الإلغاء هو 720 ساعة (30 يوماً).';
    }

    // 6. Discount percentage (0 - 25)
    const discountPct = Number(formData.discountConfig?.percentage);
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 25) {
      errors.discountPercentage = 'نسبة الخصم يجب أن تكون بين 0% و 25%.';
    }

    // 7. Phone numbers
    if (formData.companyPhone && !isValidPhone(formData.companyPhone)) {
      errors.companyPhone = 'رقم الهاتف يجب ألا يقل عن 9 أرقام.';
    }

    if (formData.whatsappNumber && !isValidPhone(formData.whatsappNumber)) {
      errors.whatsappNumber = 'رقم الهاتف يجب ألا يقل عن 9 أرقام.';
    }

    return errors;
  }, [formData]);

  const hasValidationErrors = Object.keys(fieldErrors).length > 0;

  // Ensure discountConfig object exists
  const discountConfig: DiscountConfig = formData.discountConfig || {
    enabled: false,
    percentage: 0,
    scope: 'all',
    vehicleIds: [],
    title: 'خصم خاص للأعضاء المسجلين',
  };

  const handleDiscountChange = (updates: Partial<DiscountConfig>) => {
    setFormData((prev) => ({
      ...prev,
      discountConfig: {
        ...discountConfig,
        ...updates,
      },
    }));
  };

  const toggleVehicleInDiscount = (vehicleId: string) => {
    const current = discountConfig.vehicleIds || [];
    const exists = current.includes(vehicleId);
    const updated = exists ? current.filter((id) => id !== vehicleId) : [...current, vehicleId];
    handleDiscountChange({ vehicleIds: updated });
  };

  // Preview State (معاينة سعر مثال)
  const availablePreviewCars = useMemo(() => {
    return vehicles.length > 0 ? vehicles : [DEFAULT_SAMPLE_CAR];
  }, [vehicles]);

  const [selectedPreviewVehicleId, setSelectedPreviewVehicleId] = useState<string>(
    availablePreviewCars[0]?.id || 'sample_car_1'
  );
  const [previewDays, setPreviewDays] = useState<number>(3);
  const [previewIsLoggedIn, setPreviewIsLoggedIn] = useState<boolean>(true);
  const [previewWithDriver, setPreviewWithDriver] = useState<boolean>(false);

  const selectedPreviewVehicle = useMemo(() => {
    return availablePreviewCars.find((v) => v.id === selectedPreviewVehicleId) || availablePreviewCars[0] || DEFAULT_SAMPLE_CAR;
  }, [availablePreviewCars, selectedPreviewVehicleId]);

  // Live calculation using draft values from form
  const previewCalculation = useMemo(() => {
    return calculateRentalPrice(
      selectedPreviewVehicle.category,
      selectedPreviewVehicle.dailyPrice,
      previewDays,
      formData,
      {
        isUserLoggedIn: previewIsLoggedIn,
        vehicleId: selectedPreviewVehicle.id,
        vehicleDocId: selectedPreviewVehicle.docId ?? selectedPreviewVehicle.id,
        vehicleDataId: selectedPreviewVehicle.dataId ?? selectedPreviewVehicle.id,
        withDriver: previewWithDriver,
      }
    );
  }, [selectedPreviewVehicle, previewDays, formData, previewIsLoggedIn, previewWithDriver]);

  const handleResetDraft = () => {
    setFormData(initialSettings);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasValidationErrors) {
      setErrorMsg('يرجى تصحيح الأخطاء الموضحة أسفل الحقول قبل الحفظ.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccess(false);

    try {
      const pct = Number(formData.discountConfig?.percentage);
      const safePct = Number.isFinite(pct) ? Math.min(25, Math.max(0, pct)) : 0;

      const payload: SettingsPayload = {
        ...formData,
        insuranceShortTerm: Number(formData.insuranceShortTerm ?? formData.insurance1to2Days ?? 500),
        insuranceLongTerm: Number(formData.insuranceLongTerm ?? formData.insuranceAbove2Days ?? 300),
        driverDailyRate: Number(formData.driverDailyRate ?? 40),
        monthlyRateLight: Number(formData.monthlyRateLight ?? 800),
        monthlyRateMedium: Number(formData.monthlyRateMedium ?? 1200),
        monthlyRateJeep: Number(formData.monthlyRateJeep ?? 1500),
        cancellationLeadHours: Number(formData.cancellationLeadHours ?? 24),
        companyPhone: String(formData.companyPhone || '').trim(),
        whatsappNumber: String(formData.whatsappNumber || '').trim(),
        discountConfig: {
          enabled: Boolean(formData.discountConfig?.enabled),
          percentage: safePct,
          scope: formData.discountConfig?.scope === 'specific' ? 'specific' : 'all',
          vehicleIds: formData.discountConfig?.vehicleIds || [],
          title: String(formData.discountConfig?.title || 'خصم خاص للأعضاء').trim(),
        },
      };

      delete (payload as { insurance1to2Days?: number }).insurance1to2Days;
      delete (payload as { insuranceAbove2Days?: number }).insuranceAbove2Days;

      const res = await functionsService.updateSettingsSecure(payload);
      if (!res.success) {
        throw new Error(res.error || 'تعذر تحديث إعدادات النظام عبر الخادم.');
      }

      // Re-fetch authoritative fresh settings from server
      const freshSettings = await dataService.getSettings(true);
      const normalizedFresh = getNormalizedSettings(freshSettings);

      setInitialSettings(normalizedFresh);
      setFormData(normalizedFresh);
      setVerifiedSavedValues(normalizedFresh);
      onSettingsUpdated(normalizedFresh);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: unknown) {
      console.error('Failed to update settings:', err);
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <span>{ADMIN_TAB_LABEL.settings}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            التحكم في قواعد التأمين، خصومات الأعضاء، والبيانات العامة للشركة
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <button
              type="button"
              onClick={handleResetDraft}
              className="min-h-11 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>تراجع عن التعديلات</span>
            </button>
          )}

          {success && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-sm font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم حفظ الإعدادات والتحقق منها بنجاح</span>
            </div>
          )}
        </div>
      </div>

      {/* Unsaved Changes Alert Bar */}
      {isDirty && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-bold flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>توجد تعديلات غير محفوظة. تأكد من الضغط على زر الحفظ أدناه لتطبيقها في النظام.</span>
          </div>
          <span className="text-xs font-mono text-amber-400/90 bg-amber-500/20 px-2 py-0.5 rounded-md">
            مسودة معدلة
          </span>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Verified Values Feedback */}
      {verifiedSavedValues && success && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>القيم المعتمدة والمحفوظة في قاعدة البيانات حالياً:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1 text-slate-300">
            <div>تأمين قصير: <strong className="text-white">{formatMoney(verifiedSavedValues.insuranceShortTerm)}</strong></div>
            <div>تأمين طويل: <strong className="text-white">{formatMoney(verifiedSavedValues.insuranceLongTerm)}</strong></div>
            <div>أجرة السائق: <strong className="text-white">{formatMoney(verifiedSavedValues.driverDailyRate)}/يوم</strong></div>
            <div>خصم الأعضاء: <strong className="text-white">{verifiedSavedValues.discountConfig?.percentage}%</strong></div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Identity */}
        <CompanyIdentitySection
          formData={formData}
          setFormData={setFormData}
          fieldErrors={fieldErrors}
        />

        {/* Pricing & Insurance Engine Rules */}
        <PricingAndInsuranceSection
          formData={formData}
          setFormData={setFormData}
          discountConfig={discountConfig}
          onDiscountChange={handleDiscountChange}
          onToggleVehicleInDiscount={toggleVehicleInDiscount}
          vehicles={vehicles}
          fieldErrors={fieldErrors}
        />

        {/* SECTION: معاينة سعر مثال (Live Example Price Preview) */}
        <PricingPreviewSection
          availablePreviewCars={availablePreviewCars}
          selectedPreviewVehicleId={selectedPreviewVehicleId}
          setSelectedPreviewVehicleId={setSelectedPreviewVehicleId}
          selectedPreviewVehicle={selectedPreviewVehicle}
          previewDays={previewDays}
          setPreviewDays={setPreviewDays}
          previewIsLoggedIn={previewIsLoggedIn}
          setPreviewIsLoggedIn={setPreviewIsLoggedIn}
          previewWithDriver={previewWithDriver}
          setPreviewWithDriver={setPreviewWithDriver}
          formData={formData}
          previewCalculation={previewCalculation}
        />

        {/* Terms and Conditions Editor */}
        <RentalTermsSection
          formData={formData}
          setFormData={setFormData}
        />

        {/* Security Settings Card (Super Admin only) */}
        {isSuperAdmin && (
          <SecuritySettingsSection
            requireAdminMfa={requireAdminMfa}
            isUpdatingMfaReq={isUpdatingMfaReq}
            mfaLoadError={mfaLoadError}
            mfaReqFeedback={mfaReqFeedback}
            onToggleAdminMfaRequirement={handleToggleAdminMfaRequirement}
          />
        )}

        {/* Save Button Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div>
            {!isDirty ? (
              <span className="text-sm text-slate-400 font-medium">
                جميع الإعدادات الحالية محفوظة ومتطابقة مع الخادم السحابي.
              </span>
            ) : hasValidationErrors ? (
              <span className="text-sm text-rose-400 font-bold">
                يرجى معالجة أخطاء الإدخال لتفعيل زر الحفظ.
              </span>
            ) : (
              <span className="text-sm text-amber-400 font-bold">
                توجد تغييرات غير محفوظة بانتظار الاعتماد.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isDirty && (
              <button
                type="button"
                onClick={handleResetDraft}
                disabled={isSaving}
                className="min-h-11 px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
              >
                إلغاء التغييرات
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving || !isDirty || hasValidationErrors}
              className={`min-h-11 px-8 py-3 rounded-2xl font-extrabold text-sm flex items-center gap-2 shadow-lg transition-all ${
                !isDirty || hasValidationErrors
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed opacity-60 shadow-none'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري حفظ الإعدادات...' : 'حفظ وتطبيق كافة الإعدادات'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
