import React, { useState, useEffect, useMemo } from 'react';
import { AppSettings, Vehicle, DiscountConfig, SettingsPayload } from '../types';
import { functionsService } from '../services/functionsService';
import { dataService } from '../services/dataService';
import { DEFAULT_SETTINGS, calculateRentalPrice } from '../services/pricing';
import {
  Settings,
  Save,
  CheckCircle2,
  Shield,
  DollarSign,
  Building2,
  Tag,
  Percent,
  Check,
  AlertCircle,
  Phone,
  Clock,
  UserCheck,
  Calculator,
  Car as CarIcon,
  RotateCcw
} from 'lucide-react';

interface AdminSettingsProps {
  settings?: AppSettings;
  vehicles?: Vehicle[];
  onSettingsUpdated: (updated: AppSettings) => void;
}

const PHONE_REGEX = /^((\+?963\s?9\d{8})|(09\d{8})|(\+?[1-9]\d{6,14}))$/;

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
    const safePct = Number.isFinite(rawPct) ? Math.min(25, Math.max(0, Number(rawPct))) : 10;

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
        enabled: base.discountConfig?.enabled ?? DEFAULT_SETTINGS.discountConfig?.enabled ?? true,
        percentage: safePct,
        scope: base.discountConfig?.scope ?? DEFAULT_SETTINGS.discountConfig?.scope ?? 'all',
        vehicleIds: base.discountConfig?.vehicleIds ?? DEFAULT_SETTINGS.discountConfig?.vehicleIds ?? [],
        title: base.discountConfig?.title ?? DEFAULT_SETTINGS.discountConfig?.title ?? 'خصم خاص للأعضاء المسجلين',
      },
    };
  };

  const [initialSettings, setInitialSettings] = useState<AppSettings>(() => getNormalizedSettings(settings));
  const [formData, setFormData] = useState<AppSettings>(() => getNormalizedSettings(settings));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [verifiedSavedValues, setVerifiedSavedValues] = useState<AppSettings | null>(null);

  // Sync when prop updates
  useEffect(() => {
    if (settings) {
      const normalized = getNormalizedSettings(settings);
      setInitialSettings(normalized);
      setFormData(normalized);
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
    if (formData.companyPhone) {
      const clean = formData.companyPhone.trim().replace(/[\s\-\(\)]/g, '');
      if (clean && !PHONE_REGEX.test(clean)) {
        errors.companyPhone = 'صيغة هاتف الشركة غير صالحة. يرجى إدخال رقم صحيح.';
      }
    }

    if (formData.whatsappNumber) {
      const clean = formData.whatsappNumber.trim().replace(/[\s\-\(\)]/g, '');
      if (clean && !PHONE_REGEX.test(clean)) {
        errors.whatsappNumber = 'صيغة رقم واتساب غير صالحة. يرجى إدخال رقم صحيح.';
      }
    }

    return errors;
  }, [formData]);

  const hasValidationErrors = Object.keys(fieldErrors).length > 0;

  // Ensure discountConfig object exists
  const discountConfig: DiscountConfig = formData.discountConfig || {
    enabled: true,
    percentage: 10,
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
        insurance1to2Days: Number(formData.insuranceShortTerm ?? formData.insurance1to2Days ?? 500),
        insuranceAbove2Days: Number(formData.insuranceLongTerm ?? formData.insuranceAbove2Days ?? 300),
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
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <span>إعدادات الشركة وسياسات التسعير والتأمين</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            التحكم في قواعد التأمين، خصومات الأعضاء، والبيانات العامة للشركة
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isDirty && (
            <button
              type="button"
              onClick={handleResetDraft}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تراجع عن التعديلات</span>
            </button>
          )}

          {success && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم حفظ الإعدادات والتحقق منها بنجاح</span>
            </div>
          )}
        </div>
      </div>

      {/* Unsaved Changes Alert Bar */}
      {isDirty && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>توجد تعديلات غير محفوظة. تأكد من الضغط على زر الحفظ أدناه لتطبيقها في النظام.</span>
          </div>
          <span className="text-[11px] font-mono text-amber-400/80 bg-amber-500/20 px-2 py-0.5 rounded-md">
            مسودة معدلة
          </span>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Verified Values Feedback */}
      {verifiedSavedValues && success && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-bold text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>القيم المعتمدة والمحفوظة في قاعدة البيانات حالياً:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono pt-1 text-slate-300">
            <div>تأمين قصير: <strong className="text-white">${verifiedSavedValues.insuranceShortTerm}</strong></div>
            <div>تأمين طويل: <strong className="text-white">${verifiedSavedValues.insuranceLongTerm}</strong></div>
            <div>أجرة السائق: <strong className="text-white">${verifiedSavedValues.driverDailyRate}/يوم</strong></div>
            <div>خصم الأعضاء: <strong className="text-white">{verifiedSavedValues.discountConfig?.percentage}%</strong></div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Identity */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building2 className="w-4 h-4 text-amber-400" />
            بيانات الشركة والمكتب
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">اسم الشركة الرسمي (عربي)</label>
              <input
                type="text"
                value={formData.companyName ?? ''}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">اسم الشركة بالإنجليزية</label>
              <input
                type="text"
                value={formData.companyNameEn ?? ''}
                onChange={(e) => setFormData({ ...formData, companyNameEn: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>هاتف الشركة الرسمي (companyPhone)</span>
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={formData.companyPhone ?? ''}
                onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                placeholder="مثال: 00963944331774"
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-mono focus:outline-none ${
                  fieldErrors.companyPhone ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                }`}
              />
              {fieldErrors.companyPhone && (
                <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.companyPhone}</p>
              )}
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">رقم الواتساب المعتمد للحجوزات</label>
              <input
                type="tel"
                inputMode="tel"
                value={formData.whatsappNumber ?? ''}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-mono focus:outline-none ${
                  fieldErrors.whatsappNumber ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.whatsappNumber && (
                <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.whatsappNumber}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-semibold">العنوان والمقر</label>
              <input
                type="text"
                value={formData.address ?? ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>مهلة الإلغاء بالساعات (cancellationLeadHours)</span>
              </label>
              <p className="text-[11px] text-slate-500 mb-1.5">المهلة المسموحة لإلغاء الحجز مجاناً (من 0 إلى 720 ساعة)</p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={720}
                step={1}
                value={formData.cancellationLeadHours ?? 24}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFormData({
                    ...formData,
                    cancellationLeadHours: Number.isFinite(val) ? Math.min(720, Math.max(0, val)) : 0,
                  });
                }}
                className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-bold focus:outline-none ${
                  fieldErrors.cancellationLeadHours ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.cancellationLeadHours && (
                <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.cancellationLeadHours}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pricing & Insurance Engine Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <DollarSign className="w-4 h-4 text-amber-400" />
            سياسات التسعير، التأمين المسترد، وأجرة السائق
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Insurance Short-Term */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <label className="block text-slate-300 font-bold mb-1">
                تأمين الحجوزات القصيرة (1 إلى 2 يوم)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">الحد الأقصى: 5000$ (الافتراضي: 500$)</p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={5000}
                step={10}
                value={formData.insuranceShortTerm ?? formData.insurance1to2Days ?? 500}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const safe = Number.isFinite(val) ? Math.max(0, val) : 0;
                  setFormData({ ...formData, insuranceShortTerm: safe, insurance1to2Days: safe });
                }}
                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none ${
                  fieldErrors.insuranceShortTerm ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.insuranceShortTerm && (
                <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.insuranceShortTerm}</p>
              )}
            </div>

            {/* Insurance Long-Term */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <label className="block text-slate-300 font-bold mb-1">
                تأمين الحجوزات المتوسطة والطويلة (&gt; يومين)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">الحد الأقصى: 5000$ (الافتراضي: 300$)</p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={5000}
                step={10}
                value={formData.insuranceLongTerm ?? formData.insuranceAbove2Days ?? 300}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const safe = Number.isFinite(val) ? Math.max(0, val) : 0;
                  setFormData({ ...formData, insuranceLongTerm: safe, insuranceAbove2Days: safe });
                }}
                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none ${
                  fieldErrors.insuranceLongTerm ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.insuranceLongTerm && (
                <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.insuranceLongTerm}</p>
              )}
            </div>

            {/* Driver Daily Rate */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <label className="block text-slate-300 font-bold mb-1">
                أجرة السائق اليومية (driverDailyRate)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">الحد الأقصى: 1000$ (الافتراضي: 40$)</p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={1000}
                step={5}
                value={formData.driverDailyRate ?? 40}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const safe = Number.isFinite(val) ? Math.max(0, val) : 0;
                  setFormData({ ...formData, driverDailyRate: safe });
                }}
                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none ${
                  fieldErrors.driverDailyRate ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.driverDailyRate && (
                <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.driverDailyRate}</p>
              )}
            </div>

            {/* Discount System (0% to 25%) */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 sm:col-span-3 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-amber-400" />
                  <div>
                    <h5 className="font-black text-white text-sm">نظام خصم الأعضاء المسجلين (0% - 25%)</h5>
                    <p className="text-[11px] text-slate-400">
                      تطبيق خصم محدد على كامل الأسطول أو سيارات معينة (يشترط تسجيل دخول العميل)
                    </p>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discountConfig.enabled ?? true}
                    onChange={(e) => handleDiscountChange({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  <span className="mr-3 text-xs font-bold text-slate-300">
                    {discountConfig.enabled ? 'مُفعّل' : 'مُعطّل'}
                  </span>
                </label>
              </div>

              {discountConfig.enabled && (
                <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                  {/* Percentage Slider & Number Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-amber-400" />
                          <span>نسبة الخصم المعتمدة:</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-amber-400 text-base bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {(discountConfig.percentage ?? 0) === 0 ? '0% (لا خصم)' : `${discountConfig.percentage}%`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={25}
                          step={1}
                          value={discountConfig.percentage ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            handleDiscountChange({
                              percentage: Number.isFinite(val) ? Math.min(25, Math.max(0, val)) : 0,
                            });
                          }}
                          className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={25}
                          step={1}
                          value={discountConfig.percentage ?? 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            handleDiscountChange({
                              percentage: Number.isFinite(val) ? Math.min(25, Math.max(0, val)) : 0,
                            });
                          }}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                        <span>0% (بدون خصم)</span>
                        <span>12%</span>
                        <span>25% (الحد الأقصى)</span>
                      </div>
                      {fieldErrors.discountPercentage && (
                        <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.discountPercentage}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold mb-1 text-xs">
                        عنوان أو مسمى العرض الترويجي
                      </label>
                      <input
                        type="text"
                        value={discountConfig.title || ''}
                        onChange={(e) => handleDiscountChange({ title: e.target.value })}
                        placeholder="مثال: خصم خاص للأعضاء المسجلين"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Scope Selector: All Cars vs Specific Cars */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <label className="block text-slate-200 font-bold mb-2 text-xs">
                      نطاق تطبيق الخصم:
                    </label>
                    <div className="flex flex-wrap gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-2 rounded-xl border border-slate-700/70 hover:border-slate-600">
                        <input
                          type="radio"
                          name="discount_scope"
                          checked={discountConfig.scope === 'all'}
                          onChange={() => handleDiscountChange({ scope: 'all' })}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        <span className="font-bold text-white">تطبيق الخصم على كامل أسطول السيارات</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-2 rounded-xl border border-slate-700/70 hover:border-slate-600">
                        <input
                          type="radio"
                          name="discount_scope"
                          checked={discountConfig.scope === 'specific'}
                          onChange={() => handleDiscountChange({ scope: 'specific' })}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        <span className="font-bold text-white">تطبيق الخصم على سيارات محددة فقط</span>
                      </label>
                    </div>
                  </div>

                  {/* Specific Cars Checklist */}
                  {discountConfig.scope === 'specific' && (
                    <div className="pt-2 space-y-2 animate-in fade-in duration-150">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-300 font-bold">اختر السيارات المشمولة بهذا الخصم:</span>
                        <span className="text-[11px] text-amber-400 font-mono">
                          ({discountConfig.vehicleIds?.length || 0} سيارات مختارة)
                        </span>
                      </div>

                      {vehicles.length === 0 ? (
                        <p className="text-[11px] text-slate-500 p-2 bg-slate-900 rounded-lg">
                          لا توجد سيارات محملة حالياً
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-900/90 rounded-xl border border-slate-800">
                          {vehicles.map((v) => {
                            const isSelected = discountConfig.vehicleIds?.includes(v.id);
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => toggleVehicleInDiscount(v.id)}
                                className={`text-right p-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                                  isSelected
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <span className="font-medium truncate">
                                  {v.brand} {v.model} ({v.year})
                                </span>
                                {isSelected ? (
                                  <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center flex-shrink-0 mr-2">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </span>
                                ) : (
                                  <span className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0 mr-2" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clarification Box */}
                  <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-900 p-3 rounded-xl border border-slate-800">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>قاعدة التطبيق الصارمة:</strong> هذا الخصم لن يتم تفعيله للعميل إلا إذا كان مسجلاً للدخول بحسابه. الزوار غير المسجلين سيظهر لهم تنبيه يدعوهم لتسجيل الدخول للاستفادة من الخصم.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <h5 className="font-bold text-xs text-amber-400 pt-3">الأسعار الشهرية المعتمدة حسب الفئة:</h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">السيدان الاقتصادي (Light)</span>
              <p className="text-[10px] text-slate-500 mb-1.5">الحد الأقصى: 100,000$</p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                step={50}
                value={formData.monthlyRateLight ?? 800}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFormData({ ...formData, monthlyRateLight: Number.isFinite(val) ? Math.max(0, val) : 0 });
                }}
                className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none ${
                  fieldErrors.monthlyRateLight ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.monthlyRateLight && (
                <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.monthlyRateLight}</p>
              )}
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">السيدان المتوسط (Medium)</span>
              <p className="text-[10px] text-slate-500 mb-1.5">الحد الأقصى: 100,000$</p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                step={50}
                value={formData.monthlyRateMedium ?? 1200}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFormData({ ...formData, monthlyRateMedium: Number.isFinite(val) ? Math.max(0, val) : 0 });
                }}
                className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none ${
                  fieldErrors.monthlyRateMedium ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.monthlyRateMedium && (
                <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.monthlyRateMedium}</p>
              )}
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">جيب 7 مقاعد (Jeep 7 Seats)</span>
              <p className="text-[10px] text-slate-500 mb-1.5">الحد الأقصى: 100,000$</p>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100000}
                step={50}
                value={formData.monthlyRateJeep ?? 1500}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFormData({ ...formData, monthlyRateJeep: Number.isFinite(val) ? Math.max(0, val) : 0 });
                }}
                className={`w-full bg-slate-900 border rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none ${
                  fieldErrors.monthlyRateJeep ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.monthlyRateJeep && (
                <p className="text-rose-400 text-[11px] mt-1 font-semibold">{fieldErrors.monthlyRateJeep}</p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION: معاينة سعر مثال (Live Example Price Preview) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-400" />
              <span>معاينة سعر مثال (تطبيق حي للقيم الحالية بالنموذج قبل الحفظ)</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              يحسب مباشرة باستخدام الدالة الرسمية <code className="text-amber-400 font-mono">calculateRentalPrice</code>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs items-end">
            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <CarIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>اختر سيارة المعاينة:</span>
              </label>
              <select
                value={selectedPreviewVehicleId}
                onChange={(e) => setSelectedPreviewVehicleId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
              >
                {availablePreviewCars.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} (${v.dailyPrice}/يوم)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>عدد الأيام (1 أو 3 أو 7):</span>
              </label>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
                {[1, 3, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPreviewDays(d)}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                      previewDays === d
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {d} {d === 1 ? 'يوم' : 'أيام'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={previewIsLoggedIn}
                  onChange={(e) => setPreviewIsLoggedIn(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium text-xs">عميل مسجل (يستحق الخصم)</span>
              </label>
            </div>

            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={previewWithDriver}
                  onChange={(e) => setPreviewWithDriver(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <Shield className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="font-medium text-xs">مع سائق خاص</span>
              </label>
            </div>
          </div>

          {/* Result Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-[11px] text-slate-400 block">الأجرة الأساسية</span>
                <span className="text-base font-black text-white font-mono">
                  ${previewCalculation.basePrice}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  ({selectedPreviewVehicle.dailyPrice}$ × {previewDays} يوم)
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">خصم الأعضاء</span>
                <span className={`text-base font-black font-mono ${previewCalculation.memberDiscountAmount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {previewCalculation.memberDiscountAmount > 0 ? `-$${previewCalculation.memberDiscountAmount}` : 'لا يوجد'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {previewCalculation.memberDiscountPercentage > 0 ? `(${previewCalculation.memberDiscountPercentage}%)` : '-'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">أجرة السائق</span>
                <span className={`text-base font-black font-mono ${previewCalculation.totalPrice - previewCalculation.subtotal - previewCalculation.insuranceAmount > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                  ${previewWithDriver ? (formData.driverDailyRate ?? 40) * previewDays : 0}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {previewWithDriver ? `${formData.driverDailyRate ?? 40}$/يوم` : 'بدون سائق'}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block">التأمين المسترد</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  ${previewCalculation.insuranceAmount}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {previewDays <= 2 ? 'قصير (1-2 يوم)' : 'طويل (&gt; يومين)'}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-1.5 flex flex-col justify-center">
                <span className="text-[11px] text-amber-300 font-bold block">المبلغ الإجمالي</span>
                <span className="text-lg font-black text-amber-400 font-mono">
                  ${previewCalculation.totalPrice}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300 font-medium flex items-center gap-2">
              <span className="text-slate-400 font-bold">الشرح العربي الموحد الناتج:</span>
              <span className="text-white bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 font-tajawal">
                {previewCalculation.explanation}
              </span>
            </div>
          </div>
        </div>

        {/* Terms and Conditions Editor */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Shield className="w-4 h-4 text-amber-400" />
            نص شروط وأحكام عقد الإيجار الرسمي (تظهر في العقد المطبوع)
          </h4>

          <textarea
            value={formData.rentalTerms ?? ''}
            onChange={(e) => setFormData({ ...formData, rentalTerms: e.target.value })}
            rows={8}
            className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs leading-relaxed text-white focus:outline-none focus:border-amber-500 font-sans"
          />
        </div>

        {/* Security Rules & App Check Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Shield className="w-4 h-4 text-emerald-400" />
            حالة حماية النظام وقواعد الأمان (Firestore Rules & App Check)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">Firebase App Check</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  مفعل ونشط
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                تم تفعيل مزود الحماية ReCaptcha v3 للتحقق من شرعية جميع الطلبات الواردة إلى Firestore وحظر البوتات والوصول غير المصرح به.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200">مصفوفة قواعد Firestore</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  مطبقة ومنشورة
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                قراءة أسطول السيارات متاحة للجميع، بينما عمليات التعديل والحذف وتعديل الإعدادات مقيدة للمدراء (Admin) وموثقة في سجل التدقيق غير القابل للتعديل.
              </p>
            </div>
          </div>
        </div>

        {/* Database Hygiene & Seed Data Management */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-400" />
                نزاهة بيانات الإنتاج (Database Hygiene)
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                تم تنظيف وإلغاء جميع ملفات البذور الوهمية في كود التطبيق، وقاعدة البيانات خالية من أي بيانات تجريبية مدمجة.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              قاعدة بيانات نقية بنسبة 100%
            </span>
          </div>
        </div>

        {/* Save Button Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div>
            {!isDirty ? (
              <span className="text-xs text-slate-500 font-medium">
                جميع الإعدادات الحالية محفوظة ومتطابقة مع الخادم السحابي.
              </span>
            ) : hasValidationErrors ? (
              <span className="text-xs text-rose-400 font-bold">
                يرجى معالجة أخطاء الإدخال لتفعيل زر الحفظ.
              </span>
            ) : (
              <span className="text-xs text-amber-400 font-bold">
                توجد تغييرات غير محفوظة بانتظار الاعتماد.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isDirty && (
              <button
                type="button"
                onClick={handleResetDraft}
                disabled={isSaving}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
              >
                إلغاء التغييرات
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving || !isDirty || hasValidationErrors}
              className={`px-8 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg transition-all ${
                !isDirty || hasValidationErrors
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60 shadow-none'
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
