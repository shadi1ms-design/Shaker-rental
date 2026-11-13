import React, { useState } from 'react';
import { Vehicle, VehicleStatus } from '../../../types';
import { VEHICLE_STATUS_META } from '../../../constants/statusMeta';
import { getVehicleCategoryLabel } from '../../../constants/vehicleCategories';
import { VehicleImagePlaceholder } from '../../common/VehicleImagePlaceholder';
import { calculateOilChange } from '../../../utils/oilChange';
import {
  Edit3,
  Trash2,
  Droplets,
  Wrench,
  CheckCircle2,
  MoreVertical,
} from 'lucide-react';

interface VehicleTableRowProps {
  vehicle: Vehicle;
  onOpenEdit: (v: Vehicle) => void;
  onDelete: (v: Vehicle) => void;
  onRecordOilChange: (v: Vehicle) => void;
  onStatusChangeRequest: (v: Vehicle, newStatus: VehicleStatus) => void;
  isUpdatingStatus?: boolean;
}

export const VehicleTableRow: React.FC<VehicleTableRowProps> = ({
  vehicle,
  onOpenEdit,
  onDelete,
  onRecordOilChange,
  onStatusChangeRequest,
  isUpdatingStatus = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const currentStatus: VehicleStatus = vehicle.storedStatus || vehicle.status || 'available';
  const meta = VEHICLE_STATUS_META[currentStatus] || VEHICLE_STATUS_META.available;
  const oilInfo = calculateOilChange(vehicle);

  const oilBadgeClasses =
    oilInfo.status === 'overdue'
      ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
      : oilInfo.status === 'soon'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';

  return (
    <tr className="hover:bg-slate-900/60 transition-colors border-b border-slate-800/80 text-xs font-semibold">
      {/* 1st Column: Sticky Vehicle Info */}
      <td className="p-3.5 sticky start-0 bg-slate-950/95 backdrop-blur-md z-10 min-w-[220px]">
        <div className="flex items-center gap-3">
          <div className="w-14 h-10 rounded-xl bg-slate-900 overflow-hidden border border-slate-800 shrink-0">
            {!imageError && vehicle.imageUrl ? (
              <img
                src={vehicle.imageUrl}
                alt={`${vehicle.brand} ${vehicle.model}`}
                loading="lazy"
                decoding="async"
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <VehicleImagePlaceholder className="w-full h-full" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-extrabold text-white text-sm truncate">
              {vehicle.brand} {vehicle.model}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span>{vehicle.year}</span>
              <span>•</span>
              <span dir="ltr" className="font-mono text-slate-300">
                {vehicle.plateNumber
                  ? vehicle.plateNumber
                  : vehicle._internalDetailsLoaded
                  ? 'بدون لوحة'
                  : 'جاري التحميل...'}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="p-3.5 text-slate-300 whitespace-nowrap">
        {getVehicleCategoryLabel(vehicle.category)}
      </td>

      {/* Status Badge */}
      <td className="p-3.5 whitespace-nowrap">
        <span
          className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border inline-flex items-center gap-1.5 ${meta.badgeClass}`}
        >
          <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
          <span>{meta.label}</span>
        </span>
      </td>

      {/* Oil Status + Remaining Km */}
      <td className="p-3.5 whitespace-nowrap">
        <div className="flex flex-col gap-0.5">
          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1 w-fit ${oilBadgeClasses}`}>
            <Droplets className="w-3 h-3" />
            <span>{oilInfo.label}</span>
          </span>
          <span className="font-mono text-xs text-slate-400" dir="ltr">
            {oilInfo.remainingKm >= 0
              ? `${oilInfo.remainingKm.toLocaleString('en-US')} km متبقي`
              : `تجاوز بـ ${Math.abs(oilInfo.remainingKm).toLocaleString('en-US')} km`}
          </span>
        </div>
      </td>

      {/* Daily Price */}
      <td className="p-3.5 font-mono font-extrabold text-amber-400 text-sm whitespace-nowrap">
        ${vehicle.dailyPrice}
      </td>

      {/* Current Mileage */}
      <td className="p-3.5 font-mono text-slate-300 whitespace-nowrap">
        {vehicle.currentMileage
          ? `${vehicle.currentMileage} كم`
          : vehicle._internalDetailsLoaded
          ? '0 كم'
          : 'جاري التحميل...'}
      </td>

      {/* Actions */}
      <td className="p-3.5 whitespace-nowrap text-left">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onRecordOilChange(vehicle)}
            disabled={isUpdatingStatus}
            className={`py-1.5 px-3 rounded-xl font-extrabold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 min-h-[36px] cursor-pointer ${
              oilInfo.needsAttention
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/25'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>تم تغيير الزيت</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenEdit(vehicle)}
            className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center gap-1 transition-colors min-h-[36px] cursor-pointer"
            title="تعديل"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>تعديل</span>
          </button>

          {/* More menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu((prev) => !prev)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              aria-haspopup="menu"
              aria-expanded={showMoreMenu}
              aria-label="المزيد من الخيارات"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 bg-transparent cursor-default w-full h-full border-none"
                  onClick={() => setShowMoreMenu(false)}
                  tabIndex={-1}
                />
                <div
                  role="menu"
                  className="absolute end-0 top-full mt-1 w-48 bg-slate-950 border border-slate-800 rounded-2xl p-1.5 shadow-2xl z-50 space-y-1 text-xs font-semibold"
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onRecordOilChange(vehicle);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-amber-300 hover:bg-amber-500/10 flex items-center gap-2 text-right cursor-pointer"
                  >
                    <Droplets className="w-3.5 h-3.5 text-amber-400" />
                    <span>تم تغيير الزيت</span>
                  </button>

                  {currentStatus !== 'maintenance' ? (
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onStatusChangeRequest(vehicle, 'maintenance');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 text-right cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5 text-rose-400" />
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
                      className="w-full px-3 py-2 rounded-xl text-emerald-300 hover:bg-emerald-500/10 flex items-center gap-2 text-right cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
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
                    className="w-full px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/20 flex items-center gap-2 text-right font-bold cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>حذف السيارة</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
};
