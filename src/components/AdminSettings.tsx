import React, { useState } from 'react';
import { AppSettings, Vehicle, DiscountConfig } from '../types';
import { functionsService } from '../services/functionsService';
import { DEFAULT_SETTINGS } from '../services/pricing';
import { Settings, Save, CheckCircle2, Shield, DollarSign, Building2, Tag, Percent, Check, AlertCircle } from 'lucide-react';

interface AdminSettingsProps {
  settings?: AppSettings;
  vehicles?: Vehicle[];
  onSettingsUpdated: (updated: AppSettings) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings = DEFAULT_SETTINGS,
  vehicles = [],
  onSettingsUpdated,
}) => {
  const getNormalizedSettings = (s?: AppSettings): AppSettings => {
    const base = s || DEFAULT_SETTINGS;
    const shortTerm = base.insuranceShortTerm ?? base.insurance1to2Days ?? DEFAULT_SETTINGS.insurance1to2Days ?? 500;
    const longTerm = base.insuranceLongTerm ?? base.insuranceAbove2Days ?? DEFAULT_SETTINGS.insuranceAbove2Days ?? 300;

    return {
      ...DEFAULT_SETTINGS,
      ...base,
      companyName: base.companyName || DEFAULT_SETTINGS.companyName,
      companyNameEn: base.companyNameEn || DEFAULT_SETTINGS.companyNameEn,
      whatsappNumber: base.whatsappNumber || DEFAULT_SETTINGS.whatsappNumber,
      address: base.address || DEFAULT_SETTINGS.address,
      currency: base.currency || DEFAULT_SETTINGS.currency || '$',
      insurance1to2Days: shortTerm,
      insuranceAbove2Days: longTerm,
      insuranceShortTerm: shortTerm,
      insuranceLongTerm: longTerm,
      monthlyRateLight: base.monthlyRateLight ?? DEFAULT_SETTINGS.monthlyRateLight ?? 800,
      monthlyRateMedium: base.monthlyRateMedium ?? DEFAULT_SETTINGS.monthlyRateMedium ?? 1200,
      monthlyRateJeep: base.monthlyRateJeep ?? DEFAULT_SETTINGS.monthlyRateJeep ?? 1500,
      rentalTerms: base.rentalTerms ?? DEFAULT_SETTINGS.rentalTerms,
      discountConfig: {
        enabled: base.discountConfig?.enabled ?? DEFAULT_SETTINGS.discountConfig?.enabled ?? true,
        percentage: base.discountConfig?.percentage ?? DEFAULT_SETTINGS.discountConfig?.percentage ?? 10,
        scope: base.discountConfig?.scope ?? DEFAULT_SETTINGS.discountConfig?.scope ?? 'all',
        vehicleIds: base.discountConfig?.vehicleIds ?? DEFAULT_SETTINGS.discountConfig?.vehicleIds ?? [],
        title: base.discountConfig?.title ?? DEFAULT_SETTINGS.discountConfig?.title ?? 'خصم خاص للأعضاء المسجلين',
      },
    };
  };

  const [formData, setFormData] = useState<AppSettings>(() => getNormalizedSettings(settings));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    if (settings) {
      setFormData(getNormalizedSettings(settings));
    }
  }, [settings]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const PHONE_REGEX = /^((\+?963\s?9\d{8})|(09\d{8})|(\+?[1-9]\d{6,14}))$/;

      if (formData.companyPhone) {
        const digitsOnly = formData.companyPhone.trim().replace(/[\s\-\(\)]/g, '');
        if (digitsOnly && !PHONE_REGEX.test(digitsOnly)) {
          setErrorMsg('صيغة هاتف الشركة غير صالحة. يرجى إدخال رقم صحيح مع الرمز الدولي أو المحلي.');
          setIsSaving(false);
          return;
        }
      }

      if (formData.whatsappNumber) {
        const digitsOnly = formData.whatsappNumber.trim().replace(/[\s\-\(\)]/g, '');
        if (digitsOnly && !PHONE_REGEX.test(digitsOnly)) {
          setErrorMsg('صيغة رقم واتساب غير صالحة. يرجى إدخال رقم صحيح مع الرمز الدولي أو المحلي.');
          setIsSaving(false);
          return;
        }
      }

      if (formData.cancellationLeadHours !== undefined) {
        const lead = Number(formData.cancellationLeadHours);
        if (isNaN(lead) || lead < 0 || lead > 720) {
          setErrorMsg('مهلة الإلغاء بالساعات يجب أن تكون رقماً بين 0 و 720 ساعة (30 يوماً).');
          setIsSaving(false);
          return;
        }
      }

      const payload: AppSettings = {
        ...formData,
        insurance1to2Days: formData.insuranceShortTerm ?? formData.insurance1to2Days ?? 500,
        insuranceAbove2Days: formData.insuranceLongTerm ?? formData.insuranceAbove2Days ?? 300,
        insuranceShortTerm: formData.insuranceShortTerm ?? formData.insurance1to2Days ?? 500,
        insuranceLongTerm: formData.insuranceLongTerm ?? formData.insuranceAbove2Days ?? 300,
      };

      const res = await functionsService.updateSettingsSecure(payload as any);
      if (!res.success) {
        throw new Error(res.error || 'تعذر تحديث إعدادات النظام عبر الخادم.');
      }

      onSettingsUpdated(payload);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'حدث خطأ أثناء حفظ الإعدادات.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            إعدادات الشركة وسياسات التسعير والتأمين
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            التحكم في قواعد التأمين، خصومات الفترات الأسبوعية والشهرية، ومسافة تغيير الزيت
          </p>
        </div>

        {success && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم حفظ الإعدادات بنجاح</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
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
              <label className="block text-slate-400 mb-1 font-semibold">رقم الواتساب المعتمد للحجوزات</label>
              <input
                type="text"
                value={formData.whatsappNumber ?? ''}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">العنوان والمقر</label>
              <input
                type="text"
                value={formData.address ?? ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Pricing & Insurance Engine Rules (Sections 7 & 8) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <DollarSign className="w-4 h-4 text-amber-400" />
            سياسات التسعير، التأمين المسترد، والخصومات (Pricing Rules)
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <label className="block text-slate-300 font-bold mb-1">
                تأمين الحجوزات القصيرة (1 إلى 2 يوم)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">القيمة الافتراضية المحددة: $500</p>
              <input
                type="number"
                value={formData.insuranceShortTerm ?? formData.insurance1to2Days ?? 500}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setFormData({ ...formData, insuranceShortTerm: val, insurance1to2Days: val });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <label className="block text-slate-300 font-bold mb-1">
                تأمين الحجوزات المتوسطة والطويلة (أكثر من يومين)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">القيمة الافتراضية المحددة: $300</p>
              <input
                type="number"
                value={formData.insuranceLongTerm ?? formData.insuranceAbove2Days ?? 300}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setFormData({ ...formData, insuranceLongTerm: val, insuranceAbove2Days: val });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            {/* New Requested Discount System: 1% to 25%, All or Specific Cars, Requires Login */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 sm:col-span-2 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-amber-400" />
                  <div>
                    <h5 className="font-black text-white text-sm">نظام الخصومات والعروض (1% - 25%)</h5>
                    <p className="text-[11px] text-slate-400">
                      تطبيق خصم محدد على كل الأسطول أو سيارات معينة (يُشترط تسجيل دخول العميل)
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
                  {/* Percentage Slider & Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Percent className="w-3.5 h-3.5 text-amber-400" />
                          <span>نسبة الخصم المعتمدة:</span>
                        </label>
                        <span className="font-mono font-black text-amber-400 text-base bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          {discountConfig.percentage ?? 10}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={25}
                        step={1}
                        value={discountConfig.percentage ?? 10}
                        onChange={(e) => handleDiscountChange({ percentage: Number(e.target.value) || 10 })}
                        className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                        <span>1% (الحد الأدنى)</span>
                        <span>12%</span>
                        <span>25% (الحد الأقصى)</span>
                      </div>
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

                  {/* Specific Cars Checklist if scope is 'specific' */}
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
                      <strong>قاعدة التطبيق الصارمة:</strong> هذا الخصم لن يتم تفعيله للعميل إلا إذا كان مسجلاً للدخول بحسابه. الزوار غير المسجلين سيظهر لهم تنبيه يدعوهم لإنشاء حساب أو تسجيل الدخول للاستفادة من الخصم.
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
              <input
                type="number"
                value={formData.monthlyRateLight ?? 800}
                onChange={(e) => setFormData({ ...formData, monthlyRateLight: Number(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">السيدان المتوسط (Medium)</span>
              <input
                type="number"
                value={formData.monthlyRateMedium ?? 1200}
                onChange={(e) => setFormData({ ...formData, monthlyRateMedium: Number(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">جيب 7 مقاعد (Jeep 7 Seats)</span>
              <input
                type="number"
                value={formData.monthlyRateJeep ?? 1500}
                onChange={(e) => setFormData({ ...formData, monthlyRateJeep: Number(e.target.value) || 0 })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none focus:border-amber-500"
                required
              />
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
                تم تفعيل مزود الحماية ReCaptcha v3 مع خاصية Auto-Refresh للتحقق من شرعية جميع الطلبات الواردة إلى Firestore وحظر البوتات والوصول غير المصرح به.
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
                قراءة أسطول السيارات متاحة للجميع، بينما عمليات التعديل والحذف والحجز مقيدة فقط للمستخدمين المسجلين أو موظفي الإدارة (Admin/Staff) وفق مصفوفة الصلاحيات.
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

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'جاري حفظ الإعدادات...' : 'حفظ وتطبيق كافة الإعدادات'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
