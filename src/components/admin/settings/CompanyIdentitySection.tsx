import React from 'react';
import { AppSettings } from '../../../types';
import { Building2, Phone, Clock } from 'lucide-react';
import { PhoneInput } from '../../ui/PhoneInput';
import { NumberInput } from '../../ui/NumberInput';

export interface CompanyIdentitySectionProps {
  formData: AppSettings;
  setFormData: React.Dispatch<React.SetStateAction<AppSettings>>;
  fieldErrors: Record<string, string>;
}

export const CompanyIdentitySection: React.FC<CompanyIdentitySectionProps> = ({
  formData,
  setFormData,
  fieldErrors,
}) => {
  return (
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
          <PhoneInput
            id="settings-company-phone"
            value={formData.companyPhone ?? ''}
            onChange={(val) => setFormData({ ...formData, companyPhone: val })}
            placeholder="944331774"
            error={fieldErrors.companyPhone}
          />
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-semibold">رقم الواتساب المعتمد للحجوزات</label>
          <PhoneInput
            id="settings-whatsapp-number"
            value={formData.whatsappNumber ?? ''}
            onChange={(val) => setFormData({ ...formData, whatsappNumber: val })}
            placeholder="944331774"
            required
            error={fieldErrors.whatsappNumber}
          />
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
          <p className="text-xs text-slate-400 mb-1.5">المهلة المسموحة لإلغاء الحجز مجاناً (من 0 إلى 720 ساعة)</p>
          <NumberInput
            min={0}
            max={720}
            step={1}
            value={formData.cancellationLeadHours}
            onChange={(val) => {
              setFormData({
                ...formData,
                cancellationLeadHours: val ?? 0,
              });
            }}
            className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-bold focus:outline-none ${
              fieldErrors.cancellationLeadHours ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-amber-500'
            }`}
            required
          />
          {fieldErrors.cancellationLeadHours && (
            <p className="text-rose-400 text-xs mt-1 font-semibold">{fieldErrors.cancellationLeadHours}</p>
          )}
        </div>
      </div>
    </div>
  );
};
