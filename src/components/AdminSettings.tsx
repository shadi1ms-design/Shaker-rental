import React, { useState } from 'react';
import { AppSettings } from '../types';
import { dataService } from '../services/dataService';
import { DEFAULT_SETTINGS } from '../services/pricing';
import { Settings, Save, CheckCircle2, Shield, DollarSign, Wrench, Building2 } from 'lucide-react';

interface AdminSettingsProps {
  settings?: AppSettings;
  onSettingsUpdated: (updated: AppSettings) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({
  settings = DEFAULT_SETTINGS,
  onSettingsUpdated,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings || DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await dataService.updateSettings(formData);
      onSettingsUpdated(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
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
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">اسم الشركة بالإنجليزية</label>
              <input
                type="text"
                value={formData.companyNameEn}
                onChange={(e) => setFormData({ ...formData, companyNameEn: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">رقم الواتساب المعتمد للحجوزات</label>
              <input
                type="text"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">العنوان والمقر</label>
              <input
                type="text"
                value={formData.address}
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
                value={formData.insuranceShortTerm}
                onChange={(e) => setFormData({ ...formData, insuranceShortTerm: Number(e.target.value) })}
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
                value={formData.insuranceLongTerm}
                onChange={(e) => setFormData({ ...formData, insuranceLongTerm: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 sm:col-span-2">
              <label className="block text-slate-300 font-bold mb-1">
                خصم التأجير الأسبوعي (لكل يوم)
              </label>
              <p className="text-[11px] text-slate-500 mb-2">
                يتم خصم هذا المبلغ عن كل يوم لحجوزات الأسبوع (7 أيام فأكثر)
              </p>
              <input
                type="number"
                value={formData.weeklyDiscountPerDay}
                onChange={(e) => setFormData({ ...formData, weeklyDiscountPerDay: Number(e.target.value) })}
                className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <h5 className="font-bold text-xs text-amber-400 pt-3">الأسعار الشهرية المعتمدة حسب الفئة:</h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">السيدان الاقتصادي (Light)</span>
              <input
                type="number"
                value={formData.monthlyRateLight}
                onChange={(e) => setFormData({ ...formData, monthlyRateLight: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">السيدان المتوسط (Medium)</span>
              <input
                type="number"
                value={formData.monthlyRateMedium}
                onChange={(e) => setFormData({ ...formData, monthlyRateMedium: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 block mb-1">جيب 7 مقاعد (Jeep 7 Seats)</span>
              <input
                type="number"
                value={formData.monthlyRateJeep}
                onChange={(e) => setFormData({ ...formData, monthlyRateJeep: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Maintenance Rules */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Wrench className="w-4 h-4 text-amber-400" />
            سياسة صيانة وتغيير الزيت
          </h4>

          <div className="text-xs">
            <label className="block text-slate-300 font-bold mb-1">
              المسافة الدورية لتغيير الزيت (كم)
            </label>
            <p className="text-[11px] text-slate-500 mb-2">القاعدة الإلزامية: كل 5,000 كم</p>
            <input
              type="number"
              value={formData.oilChangeIntervalKm}
              onChange={(e) => setFormData({ ...formData, oilChangeIntervalKm: Number(e.target.value) })}
              className="w-full sm:w-1/3 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-amber-500"
              required
            />
          </div>
        </div>

        {/* Terms and Conditions Editor */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h4 className="font-bold text-sm text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Shield className="w-4 h-4 text-amber-400" />
            نص شروط وأحكام عقد الإيجار الرسمي (تظهر في العقد المطبوع)
          </h4>

          <textarea
            value={formData.rentalTerms}
            onChange={(e) => setFormData({ ...formData, rentalTerms: e.target.value })}
            rows={8}
            className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs leading-relaxed text-white focus:outline-none focus:border-amber-500 font-sans"
          />
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
