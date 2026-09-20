import React, { useState } from 'react';
import { Vehicle, MaintenanceRecord } from '../../types';
import {
  Wrench,
  Droplet,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  User
} from 'lucide-react';

interface AdminMaintenanceProps {
  vehicles: Vehicle[];
  maintenanceRecords: MaintenanceRecord[];
  vehiclesNeedingOil: Array<{ vehicle: Vehicle; kmSinceOil: number; isUrgent: boolean }>;
  onOpenMaintenanceModal: () => void;
}

export const AdminMaintenance: React.FC<AdminMaintenanceProps> = ({
  vehicles,
  maintenanceRecords,
  vehiclesNeedingOil,
  onOpenMaintenanceModal,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'oil_change' | 'periodic' | 'repair'>('all');

  const filteredRecords = maintenanceRecords.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    return true;
  });

  const totalMaintenanceCost = maintenanceRecords.reduce((acc, m) => acc + (m.cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            <span>إدارة الصيانة وغيار الزيت الدوري</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            متابعة دقيقة لغيار الزيت كل 5000 كم وسجلات الإصلاحات والصيانة الدورية لأسطول شاكر
          </p>
        </div>

        <button
          onClick={onOpenMaintenanceModal}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل صيانة أو غيار زيت جديد</span>
        </button>
      </div>

      {/* 5,000 KM Rule Oil Change Alerts Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
            <Droplet className="w-4 h-4" />
            <span>تنبيهات غيار الزيت النشطة (قاعدة 5,000 كم) - {vehiclesNeedingOil.length} مركبة</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            يتم فحص عداد الكيلومترات تلقائياً ومقارنته بآخر غيار زيت
          </span>
        </div>

        {vehiclesNeedingOil.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-2xl space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-slate-300 font-bold">حالة أسطول السيارات سليمة تماماً</p>
            <p className="text-slate-400 text-[11px]">
              كافة سيارات الأسطول ضمن المسافة المسموحة لتغيير الزيت (أقل من 5,000 كم منذ آخر غيار).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehiclesNeedingOil.map(({ vehicle, kmSinceOil, isUrgent }) => (
              <div
                key={vehicle.id}
                className={`p-4 rounded-2xl border ${
                  isUrgent
                    ? 'bg-rose-500/10 border-rose-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                } space-y-3`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white text-sm block">
                      {vehicle.brand} {vehicle.model}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {vehicle.plateNumber}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isUrgent ? 'bg-rose-500 text-white font-black' : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {isUrgent ? 'عاجل (تجاوز 5000 كم)' : 'مستحق قريباً'}
                  </span>
                </div>

                <div className="space-y-1 text-xs font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-slate-300">
                    <span>المقطوع منذ آخر زيت:</span>
                    <span className="font-bold text-amber-400">{kmSinceOil.toLocaleString()} كم</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>العداد الحالي:</span>
                    <span>{vehicle.currentMileage?.toLocaleString()} كم</span>
                  </div>
                </div>

                <button
                  onClick={onOpenMaintenanceModal}
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Droplet className="w-3.5 h-3.5" />
                  <span>تسجيل غيار الزيت الآن</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Maintenance History */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white">سجل عمليات الصيانة السابقة ({maintenanceRecords.length})</h4>
            <span className="text-xs text-slate-400 font-mono">
              إجمالي التكاليف: ${totalMaintenanceCost}
            </span>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'oil_change', label: 'غيار زيت وفلتر' },
              { id: 'periodic', label: 'صيانة دورية' },
              { id: 'repair', label: 'إصلاح أعطال' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id as any)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  filterType === t.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            لا توجد سجلات صيانة مسجلة ضمن هذا التصنيف
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredRecords.map((m) => (
              <div
                key={m.id}
                className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{m.vehicleName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        m.type === 'oil_change'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : m.type === 'periodic'
                          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {m.type === 'oil_change'
                        ? 'غيار زيت وفلتر'
                        : m.type === 'periodic'
                        ? 'صيانة دورية'
                        : 'إصلاح عطل'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                    <span>العداد عند الصيانة: <strong className="text-slate-300 font-mono">{m.mileageAtService?.toLocaleString()} كم</strong></span>
                    <span>•</span>
                    <span>التاريخ: {m.date}</span>
                    {m.technician && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>الفني: {m.technician}</span>
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span className="font-mono text-emerald-400 font-bold">التكلفة: ${m.cost}</span>
                  </div>

                  {m.description && (
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {m.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
