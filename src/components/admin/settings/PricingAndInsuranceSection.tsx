import React from 'react';
import { AppSettings, DiscountConfig, Vehicle } from '../../../types';
import { DollarSign, Tag, Percent, Check, AlertCircle } from 'lucide-react';
import { NumberInput } from '../../ui/NumberInput';

export interface PricingAndInsuranceSectionProps {
  formData: AppSettings;
  setFormData: React.Dispatch<React.SetStateAction<AppSettings>>;
  discountConfig: DiscountConfig;
  onDiscountChange: (updates: Partial<DiscountConfig>) => void;
  onToggleVehicleInDiscount: (vehicleId: string) => void;
  vehicles: Vehicle[];
  fieldErrors: Record<string, string>;
}

export const PricingAndInsuranceSection: React.FC<PricingAndInsuranceSectionProps> = ({
  formData,
  setFormData,
  discountConfig,
  onDiscountChange,
  onToggleVehicleInDiscount,
  vehicles,
  fieldErrors,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
      <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
        <DollarSign className="w-4 h-4 text-amber-400" />
        سياسات التسعير، التأمين المسترد، وأجرة السائق
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        {/* Insurance Short-Term */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <label className="block text-slate-300 font-bold mb-1">
            تأمين الحجوزات القصيرة (1 إلى 2 يوم)
          </label>
          <p className="text-xs text-slate-400 mb-2">الحد الأقصى: 5000$ (الافتراضي: 500$)</p>
          <NumberInput
            min={0}
            max={5000}
            step={10}
            value={formData.insuranceShortTerm ?? formData.insurance1to2Days}
            onChange={(val) => {
              setFormData({ ...formData, insuranceShortTerm: val ?? 0, insurance1to2Days: val ?? 0 });
            }}
            className={`w-full min-h-11 bg-slate-900 border rounded-xl px-3 py-2 text-white font-bold text-base sm:text-sm focus:outline-none ${
              fieldErrors.insuranceShortTerm ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
            }`}
            required
          />
          {fieldErrors.insuranceShortTerm && (
            <p className="text-rose-400 text-xs mt-1 font-semibold">{fieldErrors.insuranceShortTerm}</p>
          )}
        </div>

        {/* Insurance Long-Term */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <label className="block text-slate-300 font-bold mb-1">
            تأمين الحجوزات المتوسطة والطويلة (&gt; يومين)
          </label>
          <p className="text-xs text-slate-400 mb-2">الحد الأقصى: 5000$ (الافتراضي: 300$)</p>
          <NumberInput
            min={0}
            max={5000}
            step={10}
            value={formData.insuranceLongTerm ?? formData.insuranceAbove2Days}
            onChange={(val) => {
              setFormData({ ...formData, insuranceLongTerm: val ?? 0, insuranceAbove2Days: val ?? 0 });
            }}
            className={`w-full min-h-11 bg-slate-900 border rounded-xl px-3 py-2 text-white font-bold text-base sm:text-sm focus:outline-none ${
              fieldErrors.insuranceLongTerm ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
            }`}
            required
          />
          {fieldErrors.insuranceLongTerm && (
            <p className="text-rose-400 text-xs mt-1 font-semibold">{fieldErrors.insuranceLongTerm}</p>
          )}
        </div>

        {/* Driver Daily Rate */}
        <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
          <label className="block text-slate-300 font-bold mb-1">
            أجرة السائق اليومية (driverDailyRate)
          </label>
          <p className="text-xs text-slate-400 mb-2">الحد الأقصى: 1000$ (الافتراضي: 40$)</p>
          <NumberInput
            min={0}
            max={1000}
            step={5}
            value={formData.driverDailyRate}
            onChange={(val) => {
              setFormData({ ...formData, driverDailyRate: val ?? 0 });
            }}
            className={`w-full min-h-11 bg-slate-900 border rounded-xl px-3 py-2 text-white font-bold text-base sm:text-sm focus:outline-none ${
              fieldErrors.driverDailyRate ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
            }`}
            required
          />
          {fieldErrors.driverDailyRate && (
            <p className="text-rose-400 text-xs mt-1 font-semibold">{fieldErrors.driverDailyRate}</p>
          )}
        </div>

        {/* Discount System (0% to 25%) */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 sm:col-span-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-400" />
              <div>
                <h5 className="font-extrabold text-white text-sm">نظام خصم الأعضاء المسجلين (0% - 25%)</h5>
                <p className="text-xs text-slate-400">
                  تطبيق خصم محدد على كامل الأسطول أو سيارات معينة (يشترط تسجيل دخول العميل)
                </p>
              </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div dir="ltr" className="inline-flex items-center">
              <label className="relative inline-flex items-center cursor-pointer min-h-11">
                <input
                  type="checkbox"
                  checked={discountConfig.enabled ?? false}
                  onChange={(e) => onDiscountChange({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 relative peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400" dir="ltr"></div>
              </label>
              <span className="ms-3 text-sm font-bold text-slate-300" dir="rtl">
                {discountConfig.enabled ? 'مُفعّل' : 'مُعطّل'}
              </span>
            </div>
          </div>

          {discountConfig.enabled && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-200">
              {/* Percentage Slider & Number Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-amber-400" />
                      <span>نسبة الخصم المعتمدة:</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-amber-400 text-base bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
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
                        onDiscountChange({
                          percentage: Number.isFinite(val) ? Math.min(25, Math.max(0, val)) : 0,
                        });
                      }}
                      className="w-full accent-amber-500 cursor-pointer h-3 bg-slate-800 rounded-lg"
                    />
                    <NumberInput
                      min={0}
                      max={25}
                      step={1}
                      value={discountConfig.percentage}
                      onChange={(val) => {
                        onDiscountChange({
                          percentage: val ?? 0,
                        });
                      }}
                      className="w-20 min-h-11 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-white font-mono font-bold text-base sm:text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex justify-between text-xs text-slate-400 mt-1 font-mono">
                    <span>0% (بدون خصم)</span>
                    <span>12%</span>
                    <span>25% (الحد الأقصى)</span>
                  </div>
                  {fieldErrors.discountPercentage && (
                    <p className="text-rose-400 text-xs mt-1 font-semibold">{fieldErrors.discountPercentage}</p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 text-sm">
                    عنوان أو مسمى العرض الترويجي
                  </label>
                  <input
                    type="text"
                    value={discountConfig.title || ''}
                    onChange={(e) => onDiscountChange({ title: e.target.value })}
                    placeholder="مثال: خصم خاص للأعضاء المسجلين"
                    className="w-full min-h-11 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-base sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Scope Selector: All Cars vs Specific Cars */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-slate-200 font-bold mb-2 text-sm">
                  نطاق تطبيق الخصم:
                </label>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="min-h-11 flex items-center gap-2 cursor-pointer bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-700/70 hover:border-slate-600">
                    <input
                      type="radio"
                      name="discount_scope"
                      checked={discountConfig.scope === 'all'}
                      onChange={() => onDiscountChange({ scope: 'all' })}
                      className="text-amber-500 focus:ring-amber-500"
                    />
                    <span className="font-bold text-white">تطبيق الخصم على كامل أسطول السيارات</span>
                  </label>

                  <label className="min-h-11 flex items-center gap-2 cursor-pointer bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-700/70 hover:border-slate-600">
                    <input
                      type="radio"
                      name="discount_scope"
                      checked={discountConfig.scope === 'specific'}
                      onChange={() => onDiscountChange({ scope: 'specific' })}
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
                    <span className="text-xs text-amber-400 font-mono">
                      ({discountConfig.vehicleIds?.length || 0} سيارات مختارة)
                    </span>
                  </div>

                  {vehicles.length === 0 ? (
                    <p className="text-xs text-slate-400 p-2 bg-slate-900 rounded-lg">
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
                            onClick={() => onToggleVehicleInDiscount(v.id)}
                            className={`text-right min-h-11 px-3 py-2 rounded-lg border text-sm flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                                : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span className="font-medium truncate">
                              {v.brand} {v.model} ({v.year})
                            </span>
                            {isSelected ? (
                              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center flex-shrink-0 ms-2">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0 ms-2" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Clarification Box */}
              <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-900 p-3 rounded-xl border border-slate-800">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>قاعدة التطبيق الصارمة:</strong> هذا الخصم لن يتم تفعيله للعميل إلا إذا كان مسجلاً للدخول بحسابه. الزوار غير المسجلين سيظهر لهم تنبيه يدعوهم لتسجيل الدخول للاستفادة من الخصم.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <h5 className="font-bold text-sm text-amber-400 pt-3">الأسعار الشهرية المعتمدة حسب الفئة:</h5>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-300 font-semibold block mb-1">سيدان (اقتصادي)</span>
          <p className="text-xs text-slate-400 mb-1.5">الحد الأقصى: 100,000$</p>
          <NumberInput
            min={0}
            max={100000}
            step={50}
            value={formData.monthlyRateLight}
            onChange={(val) => {
              setFormData({ ...formData, monthlyRateLight: val ?? 0 });
            }}
            className={`w-full min-h-11 bg-slate-900 border rounded-lg px-3 py-2 text-base sm:text-sm text-white font-bold focus:outline-none ${
              fieldErrors.monthlyRateLight ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
            }`}
            required
          />
          {fieldErrors.monthlyRateLight && (
            <p className="text-rose-400 text-xs mt-1 font-semibold">{fieldErrors.monthlyRateLight}</p>
          )}
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-300 font-semibold block mb-1">سيدان</span>
          <p className="text-xs text-slate-400 mb-1.5">الحد الأقصى: 100,000$</p>
          <NumberInput
            min={0}
            max={100000}
            step={50}
            value={formData.monthlyRateMedium}
            onChange={(val) => {
              setFormData({ ...formData, monthlyRateMedium: val ?? 0 });
            }}
            className={`w-full min-h-11 bg-slate-900 border rounded-lg px-3 py-2 text-base sm:text-sm text-white font-bold focus:outline-none ${
              fieldErrors.monthlyRateMedium ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
            }`}
            required
          />
          {fieldErrors.monthlyRateMedium && (
            <p className="text-rose-400 text-xs mt-1 font-semibold">{fieldErrors.monthlyRateMedium}</p>
          )}
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-300 font-semibold block mb-1">SUV</span>
          <p className="text-xs text-slate-400 mb-1.5">الحد الأقصى: 100,000$</p>
          <NumberInput
            min={0}
            max={100000}
            step={50}
            value={formData.monthlyRateJeep}
            onChange={(val) => {
              setFormData({ ...formData, monthlyRateJeep: val ?? 0 });
            }}
            className={`w-full min-h-11 bg-slate-900 border rounded-lg px-3 py-2 text-base sm:text-sm text-white font-bold focus:outline-none ${
              fieldErrors.monthlyRateJeep ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
            }`}
            required
          />
          {fieldErrors.monthlyRateJeep && (
            <p className="text-rose-400 text-xs mt-1 font-semibold">{fieldErrors.monthlyRateJeep}</p>
          )}
        </div>
      </div>
    </div>
  );
};
