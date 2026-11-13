import React from 'react';
import { AppSettings } from '../../../types';
import { Shield } from 'lucide-react';

export interface RentalTermsSectionProps {
  formData: AppSettings;
  setFormData: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export const RentalTermsSection: React.FC<RentalTermsSectionProps> = ({
  formData,
  setFormData,
}) => {
  return (
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
  );
};
