import React, { useState } from 'react';
import { Vehicle, MaintenanceRecord, MaintenanceType } from '../types';
import { dataService } from '../services/dataService';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Plus,
  X,
  Gauge,
  Calendar,
  DollarSign,
  Droplet
} from 'lucide-react';

interface MaintenanceModalProps {
  vehicles?: Vehicle[];
  onClose: () => void;
  onRecordAdded?: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  vehicles = [],
  onClose,
  onRecordAdded,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles?.[0]?.id || '');
  const [serviceType, setServiceType] = useState<MaintenanceType>('oil_change');
  const [mileage, setMileage] = useState<number>(vehicles?.[0]?.currentMileage || 100000);
  const [cost, setCost] = useState<number>(45);
  const [serviceDate, setServiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [performedBy, setPerformedBy] = useState('ورشة صيانة شاكر - دمشق');
  const [technicianNotes, setTechnicianNotes] = useState('تبديل زيت المحرك الأصلي 10W-40 وفلتر الزيت وفحص دوري شامل.');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync mileage when vehicle changes
  const handleVehicleChange = (id: string) => {
    setSelectedVehicleId(id);
    const v = vehicles.find((item) => item.id === id);
    if (v) setMileage(v.currentMileage);
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const kmSinceOil = selectedVehicle
    ? (selectedVehicle.currentMileage || 0) - (selectedVehicle.lastOilChangeMileage || 0)
    : 0;
  const kmRemaining = 5000 - kmSinceOil;
  const isOverdue = kmRemaining <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await dataService.addMaintenanceRecord({
        vehicleId: selectedVehicleId,
        serviceType,
        mileage,
        cost,
        serviceDate,
        technicianNotes,
        performedBy,
      });

      setSuccess(true);
      if (onRecordAdded) onRecordAdded();
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto text-slate-100">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-6 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                تسجيل صيانة دورية وتبديل زيت
              </h3>
              <span className="text-xs text-slate-400">قاعدة تغيير الزيت كل 5,000 كم</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-10 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-lg font-bold text-white">تم توثيق عملية الصيانة وتحديث العداد!</h4>
            <p className="text-xs text-slate-400">تم ضبط موعد الزيت القادم بعد 5000 كم بنجاح.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Vehicle Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                اختر السيارة المعنية بالصيانة
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => handleVehicleChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} ({v.year}) - لوحة: {v.plateNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* Oil Change Status Indicator for Selected Vehicle */}
            {selectedVehicle && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-center justify-between ${
                  isOverdue
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : kmRemaining < 500
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Droplet className="w-5 h-5 shrink-0" />
                  <div>
                    <span className="font-bold block">
                      {isOverdue
                        ? 'تنبيه عاجل: تجاوزت موعد تغيير الزيت!'
                        : kmRemaining < 500
                        ? 'تنبيه: اقترب موعد تغيير الزيت'
                        : 'حالة الزيت جيدة'}
                    </span>
                    <span className="text-[11px] opacity-80">
                      تم قطع {kmSinceOil.toLocaleString()} كم منذ آخر غيار (باقي {Math.max(0, kmRemaining).toLocaleString()} كم)
                    </span>
                  </div>
                </div>
                <div className="text-left font-mono font-black text-sm">
                  {isOverdue ? `-${Math.abs(kmRemaining)} كم` : `${kmRemaining} كم`}
                </div>
              </div>
            )}

            {/* Service Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                نوع الخدمة / الصيانة
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as MaintenanceType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="oil_change">تبديل زيت المحرك والفلتر (كل 5,000 كم)</option>
                <option value="brakes">فحص وتبديل الفرامل (فحمات / ديسكات)</option>
                <option value="tires">فحص الإطارات وتنسيم أو استبدال</option>
                <option value="battery">فحص أو استبدال البطارية</option>
                <option value="engine">صيانة المحرك وسوائل التبريد</option>
                <option value="transmission">زيت الفتيس والجيربكس</option>
                <option value="general">صيانة دورية عامة وفحص شامل</option>
              </select>
            </div>

            {/* Mileage & Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  عداد الكيلومتر عند الصيانة
                </label>
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  التكلفة الإجمالية ($)
                </label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            {/* Date & Performed By */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">تاريخ إجراء الصيانة</label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">الجهة المنفذة / الورشة</label>
                <input
                  type="text"
                  value={performedBy}
                  onChange={(e) => setPerformedBy(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                ملاحظات الفني وقطع الغيار المستبدلة
              </label>
              <textarea
                value={technicianNotes}
                onChange={(e) => setTechnicianNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
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
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ الصيانة وتحديث موعد الزيت'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
