import React, { useState } from 'react';
import { Vehicle, VehicleStatus } from '../../../types';
import { getVehicleCategoryLabel } from '../../../constants/vehicleCategories';
import {
  VehicleStatusPill,
  VehicleDailyPriceTag,
  VehicleSingleImageFrame,
} from '../../common/VehicleCardShared';
import { calculateOilChange } from '../../../utils/oilChange';
import {
  Edit3,
  Trash2,
  Droplets,
  Wrench,
  CheckCircle2,
  MoreVertical,
  ShieldCheck,
} from 'lucide-react';

interface VehicleCardProps {
  vehicle: Vehicle;
  onOpenEdit: (v: Vehicle) => void;
  onDelete: (v: Vehicle) => void;
  onRecordOilChange: (v: Vehicle) => void;
  onStatusChangeRequest: (v: Vehicle, newStatus: VehicleStatus) => void;
  isUpdatingStatus?: boolean;
}

export const getPrimaryAction = (
  status: VehicleStatus
): { label: string; actionType: 'record_oil' | 'set_available' | 'activate'; icon: React.ComponentType<{ className?: string }> } => {
  switch (status) {
    case 'maintenance':
      return { label: 'إنهاء الصيانة', actionType: 'set_available', icon: CheckCircle2 };
    case 'inactive':
      return { label: 'تفعيل السيارة', actionType: 'activate', icon: ShieldCheck };
    case 'available':
    case 'reserved':
    case 'rented':
    default:
      return { label: 'تم تغيير الزيت', actionType: 'record_oil', icon: Droplets };
  }
};

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  onOpenEdit,
  onDelete,
  onRecordOilChange,
  onStatusChangeRequest,
  isUpdatingStatus = false,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const currentStatus: VehicleStatus = vehicle.storedStatus || vehicle.status || 'available';
  const oilInfo = calculateOilChange(vehicle);

  const oilBadgeClasses =
    oilInfo.status === 'overdue'
      ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
      : oilInfo.status === 'soon'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';

  return (
    <div className="group bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-card overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-black/50 transition-all duration-200 flex flex-col justify-between">
      <div>
        {/* Aspect 16/10 Image Container */}
        <VehicleSingleImageFrame
          imageUrl={vehicle.imageUrl}
          brand={vehicle.brand}
          model={vehicle.model}
        >
          {/* Status Overlay Badge */}
          <div className="absolute top-3 end-3 z-10">
            <VehicleStatusPill status={currentStatus} className="backdrop-blur-md" />
          </div>

          {/* Daily Price Badge */}
          <div className="absolute bottom-3 start-3 z-10">
            <span className="px-3 py-1.5 rounded-xl bg-slate-950/85 text-sm shadow-md border border-slate-800 inline-flex items-center">
              <VehicleDailyPriceTag dailyPrice={vehicle.dailyPrice} size="sm" />
            </span>
          </div>
        </VehicleSingleImageFrame>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Brand & Model */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-white group-hover:text-amber-400 transition-colors">
                {vehicle.brand} {vehicle.model} ({vehicle.year})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{getVehicleCategoryLabel(vehicle.category)}</span>
                <span>•</span>
                <span dir="ltr" className="font-mono text-slate-300 font-bold">
                  {vehicle.plateNumber
                    ? vehicle.plateNumber
                    : vehicle._internalDetailsLoaded
                    ? 'بدون لوحة'
                    : 'جاري التحميل...'}
                </span>
              </p>
            </div>
          </div>

          {/* Oil Change Status Strip */}
          <div className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${oilBadgeClasses}`}>
            <div className="flex items-center gap-1.5 font-bold">
              <Droplets className="w-3.5 h-3.5 shrink-0" />
              <span>{oilInfo.label}</span>
            </div>
            <span className="font-mono font-bold tabular-nums" dir="ltr">
              {oilInfo.remainingKm >= 0
                ? `${oilInfo.remainingKm.toLocaleString('en-US')} km متبقي`
                : `تجاوز بـ ${Math.abs(oilInfo.remainingKm).toLocaleString('en-US')} km`}
            </span>
          </div>

          {/* Compact Specs Row */}
          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/80 text-center text-xs">
            <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/60">
              <span className="text-xs text-slate-400 block">مقاعد</span>
              <span className="font-bold text-slate-200">{vehicle.seats}</span>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/60">
              <span className="text-xs text-slate-400 block">ناقل</span>
              <span className="font-bold text-slate-200">
                {vehicle.transmission === 'automatic' ? 'أوتوماتيك' : 'عادي'}
              </span>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/60">
              <span className="text-xs text-slate-400 block">وقود</span>
              <span className="font-bold text-slate-200">
                {vehicle.fuelType === 'petrol'
                  ? 'بنزين'
                  : vehicle.fuelType === 'hybrid'
                  ? 'هايبرد'
                  : vehicle.fuelType === 'diesel'
                  ? 'ديزل'
                  : 'كهرباء'}
              </span>
            </div>
            <div className="bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/60">
              <span className="text-xs text-slate-400 block">العداد</span>
              <span className="font-bold text-slate-200 font-mono">
                {vehicle.currentMileage
                  ? vehicle.currentMileage
                  : vehicle._internalDetailsLoaded
                  ? 0
                  : '...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 sm:p-5 pt-0 flex items-center gap-2">
        {/* Oil Change Button */}
        <button
          type="button"
          onClick={() => onRecordOilChange(vehicle)}
          disabled={isUpdatingStatus}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 min-h-[44px] cursor-pointer ${
            oilInfo.needsAttention
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
              : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/25'
          }`}
          title="تسجيل تغيير زيت عند العداد الحالي"
        >
          <Droplets className="w-4 h-4 shrink-0" />
          <span>تم تغيير الزيت</span>
        </button>

        {/* Edit Button */}
        <button
          type="button"
          onClick={() => onOpenEdit(vehicle)}
          className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1 transition-colors min-h-[44px] min-w-[44px] cursor-pointer"
          title="تعديل بيانات السيارة"
          aria-label="تعديل بيانات السيارة"
        >
          <Edit3 className="w-4 h-4" />
          <span className="hidden sm:inline">تعديل</span>
        </button>

        {/* More Actions Dropdown Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            title="المزيد من الخيارات"
            aria-label="المزيد من الخيارات"
            aria-haspopup="menu"
            aria-expanded={showMoreMenu}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMoreMenu && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 bg-transparent cursor-default w-full h-full border-none"
                onClick={() => setShowMoreMenu(false)}
                aria-label="إغلاق القائمة"
                tabIndex={-1}
              />
              <div
                role="menu"
                className="absolute end-0 bottom-full mb-2 w-52 bg-slate-950 border border-slate-800 rounded-card p-1.5 shadow-2xl z-50 space-y-1 text-xs font-semibold"
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onRecordOilChange(vehicle);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-amber-300 hover:bg-amber-500/10 flex items-center gap-2 text-right transition-colors cursor-pointer"
                >
                  <Droplets className="w-4 h-4 text-amber-400" />
                  <span>تسجيل تغيير الزيت ({vehicle.currentMileage || 0} كم)</span>
                </button>

                {currentStatus !== 'maintenance' ? (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onStatusChangeRequest(vehicle, 'maintenance');
                    }}
                    className="w-full px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 text-right transition-colors cursor-pointer"
                  >
                    <Wrench className="w-4 h-4 text-rose-400" />
                    <span>تحويل إلى الصيانة</span>
                  </button>
                ) : (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onStatusChangeRequest(vehicle, 'available');
                    }}
                    className="w-full px-3 py-2 rounded-xl text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-2 text-right transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>تحويل إلى متاحة</span>
                  </button>
                )}

                <div className="border-t border-slate-800/80 my-1" />

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false);
                    onDelete(vehicle);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/20 flex items-center gap-2 text-right font-bold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-500" />
                  <span>حذف السيارة</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
