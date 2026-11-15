import React from 'react';
import { AppSettings, Vehicle } from '../../../types';
import { formatMoney } from '../../../utils/format';
import { Calculator, Car as CarIcon, Clock, UserCheck, Shield } from 'lucide-react';

export interface PricingPreviewCalculation {
  basePrice: number;
  memberDiscountAmount: number;
  memberDiscountPercentage: number;
  subtotal: number;
  insuranceAmount: number;
  totalPrice: number;
  explanation: string;
}

export interface PricingPreviewSectionProps {
  availablePreviewCars: Vehicle[];
  selectedPreviewVehicleId: string;
  setSelectedPreviewVehicleId: (id: string) => void;
  selectedPreviewVehicle: Vehicle;
  previewDays: number;
  setPreviewDays: (days: number) => void;
  previewIsLoggedIn: boolean;
  setPreviewIsLoggedIn: (val: boolean) => void;
  previewWithDriver: boolean;
  setPreviewWithDriver: (val: boolean) => void;
  formData: AppSettings;
  previewCalculation: PricingPreviewCalculation;
}

export const PricingPreviewSection: React.FC<PricingPreviewSectionProps> = ({
  availablePreviewCars,
  selectedPreviewVehicleId,
  setSelectedPreviewVehicleId,
  selectedPreviewVehicle,
  previewDays,
  setPreviewDays,
  previewIsLoggedIn,
  setPreviewIsLoggedIn,
  previewWithDriver,
  setPreviewWithDriver,
  formData,
  previewCalculation,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <h4 className="font-bold text-sm text-white flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-400" />
          <span>معاينة سعر مثال (تطبيق حي للقيم الحالية بالنموذج قبل الحفظ)</span>
        </h4>
        <span className="text-xs text-slate-400">
          يحسب مباشرة باستخدام الدالة الرسمية <code className="text-amber-400 font-mono">calculateRentalPrice</code>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm items-end">
        <div>
          <label className="text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
            <CarIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>اختر سيارة المعاينة:</span>
          </label>
          <select
            value={selectedPreviewVehicleId}
            onChange={(e) => setSelectedPreviewVehicleId(e.target.value)}
            className="w-full min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-sm text-white font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            {availablePreviewCars.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model} (${v.dailyPrice}/يوم)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>عدد الأيام (1 أو 3 أو 7):</span>
          </label>
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
            {[1, 3, 7].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPreviewDays(d)}
                className={`flex-1 min-h-11 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer ${
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

        <label className="min-h-11 flex items-center gap-2 bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800 cursor-pointer text-slate-200">
          <input
            type="checkbox"
            checked={previewIsLoggedIn}
            onChange={(e) => setPreviewIsLoggedIn(e.target.checked)}
            className="rounded text-amber-500 focus:ring-amber-500"
          />
          <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium text-sm">عميل مسجل (يستحق الخصم)</span>
        </label>

        <label className="min-h-11 flex items-center gap-2 bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800 cursor-pointer text-slate-200">
          <input
            type="checkbox"
            checked={previewWithDriver}
            onChange={(e) => setPreviewWithDriver(e.target.checked)}
            className="rounded text-amber-500 focus:ring-amber-500"
          />
          <Shield className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-medium text-sm">مع سائق خاص</span>
        </label>
      </div>

      {/* Result Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center border-b border-slate-800/80 pb-3">
          <div>
            <span className="text-xs text-slate-400 block">الأجرة الأساسية</span>
            <span className="text-base font-extrabold text-white font-mono">
              {formatMoney(previewCalculation.basePrice)}
            </span>
            <span className="text-xs text-slate-400 block">
              ({formatMoney(selectedPreviewVehicle.dailyPrice)} × {previewDays} يوم)
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">خصم الأعضاء</span>
            <span className={`text-base font-extrabold font-mono ${previewCalculation.memberDiscountAmount > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              {previewCalculation.memberDiscountAmount > 0 ? `-${formatMoney(previewCalculation.memberDiscountAmount)}` : 'لا يوجد'}
            </span>
            <span className="text-xs text-slate-400 block">
              {previewCalculation.memberDiscountPercentage > 0 ? `(${previewCalculation.memberDiscountPercentage}%)` : '-'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">أجرة السائق</span>
            <span className={`text-base font-extrabold font-mono ${previewCalculation.totalPrice - previewCalculation.subtotal - previewCalculation.insuranceAmount > 0 ? 'text-blue-400' : 'text-slate-400'}`}>
              {formatMoney(previewWithDriver ? (formData.driverDailyRate ?? 40) * previewDays : 0)}
            </span>
            <span className="text-xs text-slate-400 block">
              {previewWithDriver ? `${formatMoney(formData.driverDailyRate ?? 40)}/يوم` : 'بدون سائق'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">التأمين المسترد</span>
            <span className="text-base font-extrabold text-amber-400 font-mono">
              {formatMoney(previewCalculation.insuranceAmount)}
            </span>
            <span className="text-xs text-slate-400 block">
              {previewDays <= 2 ? 'قصير (1-2 يوم)' : 'طويل (> يومين)'}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-1.5 flex flex-col justify-center">
            <span className="text-xs text-amber-300 font-bold block">المبلغ الإجمالي</span>
            <span className="text-lg font-extrabold text-amber-400 font-mono">
              {formatMoney(previewCalculation.totalPrice)}
            </span>
          </div>
        </div>

        <div className="text-sm text-slate-300 font-medium flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-bold">الشرح العربي الموحد الناتج:</span>
          <span className="text-white bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 font-tajawal">
            {previewCalculation.explanation}
          </span>
        </div>
      </div>
    </div>
  );
};
