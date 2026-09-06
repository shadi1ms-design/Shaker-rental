import React, { useState } from 'react';
import { Vehicle, VehicleInspection } from '../types';
import { dataService } from '../services/dataService';
import {
  X,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Car,
  Fuel,
  Gauge,
  Sparkles,
  Save,
  Printer
} from 'lucide-react';

interface InspectionModalProps {
  vehicle?: Vehicle | null;
  bookingId?: string;
  onClose: () => void;
  onSaved?: (inspection: VehicleInspection) => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  vehicle,
  bookingId = '',
  onClose,
  onSaved,
}) => {
  if (!vehicle) return null;

  const [inspectionType, setInspectionType] = useState<'handover' | 'return'>('handover');
  const [fuelLevel, setFuelLevel] = useState<'full' | 'three_quarters' | 'half' | 'quarter'>('full');
  const [mileage, setMileage] = useState<number>(vehicle?.currentMileage || 0);
  const [cleanliness, setCleanliness] = useState<'excellent' | 'good' | 'fair' | 'dirty'>('excellent');

  // Body Parts Condition: OK vs Damaged/Scratched
  const [bodyChecks, setBodyChecks] = useState<Record<string, 'ok' | 'scratched' | 'dented'>>({
    front: 'ok',
    back: 'ok',
    right: 'ok',
    left: 'ok',
    roof: 'ok',
    glass: 'ok',
    interior: 'ok',
  });

  const [existingDamages, setExistingDamages] = useState('');
  const [newDamages, setNewDamages] = useState('');
  const [inspectorName, setInspectorName] = useState('مسؤول التسليم - شركة شاكر');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const togglePartCondition = (part: string) => {
    setBodyChecks((prev) => {
      const current = prev[part];
      const next = current === 'ok' ? 'scratched' : current === 'scratched' ? 'dented' : 'ok';
      return { ...prev, [part]: next };
    });
  };

  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const record = await dataService.recordInspection({
        vehicleId: vehicle.id,
        bookingId,
        type: inspectionType,
        fuelLevel,
        mileage,
        bodyCondition: bodyChecks,
        cleanliness,
        existingDamages,
        newDamages,
        inspectorName,
        photos: [],
      });

      // Update vehicle mileage if higher
      if (mileage > vehicle.currentMileage) {
        await dataService.updateVehicle(vehicle.id, { currentMileage: mileage });
      }

      setSavedSuccess(true);
      if (onSaved) onSaved(record);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const partNames: Record<string, string> = {
    front: 'المقدمة والصدام الأمامي',
    back: 'الخلفية والصدام الخلفي',
    right: 'الجانب الأيمن والأبواب',
    left: 'الجانب الأيسر والأبواب',
    roof: 'السقف والزجاج العلوي',
    glass: 'الزجاج الأمامي والمرايا',
    interior: 'المقصورة والفرش الداخلي',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto text-slate-100">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                نموذج فحص وتسليم السيارة (Inspection Sheet)
              </h3>
              <span className="text-xs text-slate-400">
                {vehicle.brand} {vehicle.model} • لوحة رقم: {vehicle.plateNumber}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess ? (
          <div className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-xl font-bold text-white">تم حفظ تقرير الفحص بنجاح!</h4>
            <p className="text-xs text-slate-400">تم تسجيل العداد ومستوى الوقود وحالة الهيكل في سجل المركبة.</p>
          </div>
        ) : (
          <form onSubmit={handleSaveInspection} className="p-6 space-y-6">
            {/* Type & Inspector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">نوع الفحص</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectionType('handover')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border ${
                      inspectionType === 'handover'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    تسليم للعميل (خروج)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionType('return')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border ${
                      inspectionType === 'return'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    استلام من العميل (عودة)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">اسم الفاحص المسؤول</label>
                <input
                  type="text"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            {/* Fuel & Mileage */}
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              {/* Fuel Level */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-400" />
                  مستوى خزان الوقود
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { val: 'full', label: 'ممتلئ 1/1' },
                    { val: 'three_quarters', label: '3/4' },
                    { val: 'half', label: '1/2' },
                    { val: 'quarter', label: '1/4' },
                  ].map((f) => (
                    <button
                      key={f.val}
                      type="button"
                      onClick={() => setFuelLevel(f.val as any)}
                      className={`py-1.5 text-[11px] font-bold rounded-lg border text-center transition-all ${
                        fuelLevel === f.val
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mileage */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  عداد الكيلومتر الحالي
                </label>
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            {/* Body Condition Check Matrix */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-amber-400" />
                  فحص أجزاء الهيكل والمقصورة (اضغط لتغيير الحالة)
                </label>
                <span className="text-[10px] text-slate-500">أخضر = سليم • أصفر = خدش • أحمر = صدمة</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.keys(partNames).map((part) => {
                  const state = bodyChecks[part] || 'ok';
                  return (
                    <button
                      key={part}
                      type="button"
                      onClick={() => togglePartCondition(part)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold text-right transition-all ${
                        state === 'ok'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : state === 'scratched'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <span>{partNames[part]}</span>
                      <span className="text-[11px] font-bold">
                        {state === 'ok' ? '✓ سليم تماماً' : state === 'scratched' ? '⚠ به خدش' : '✕ به ضربة / صدمة'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cleanliness */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                حالة نظافة السيارة
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: 'excellent', label: 'ممتازة ومعقمة' },
                  { val: 'good', label: 'جيدة جداً' },
                  { val: 'fair', label: 'مقبولة' },
                  { val: 'dirty', label: 'تحتاج غسيل' },
                ].map((c) => (
                  <button
                    key={c.val}
                    type="button"
                    onClick={() => setCleanliness(c.val as any)}
                    className={`py-1.5 text-xs font-semibold rounded-xl border ${
                      cleanliness === c.val
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Damages Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ملاحظات الخدوش السابقة</label>
                <textarea
                  value={existingDamages}
                  onChange={(e) => setExistingDamages(e.target.value)}
                  placeholder="مثال: خدش بسيط على الصدام الخلفي من جهة اليمين..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ملاحظات جديدة عند الإعادة</label>
                <textarea
                  value={newDamages}
                  onChange={(e) => setNewDamages(e.target.value)}
                  placeholder="ملاحظات إن وُجدت عند إعادة السيارة..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ تقرير الفحص والتسليم'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
