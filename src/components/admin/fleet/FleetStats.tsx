import React from 'react';
import { Vehicle } from '../../../types';
import { getFleetStatusCounts } from '../../../utils/vehicleStatus';
import { VEHICLE_STATUS_META } from '../../../constants/statusMeta';
import { calculateOilChange } from '../../../utils/oilChange';

interface FleetStatsProps {
  vehicles: Vehicle[];
  activeStatusFilter: string;
  onSelectStatus: (status: string) => void;
}

export const FleetStats: React.FC<FleetStatsProps> = ({
  vehicles,
  activeStatusFilter,
  onSelectStatus,
}) => {
  const counts = getFleetStatusCounts(vehicles);
  const oilDueCount = vehicles.filter((v) => calculateOilChange(v).needsAttention).length;

  const statsList = [
    {
      id: 'all',
      label: 'إجمالي الأسطول',
      count: vehicles.length,
      textColor: 'text-white',
      badgeColor: 'bg-slate-800 text-slate-200',
    },
    {
      id: 'available',
      label: VEHICLE_STATUS_META.available.label,
      count: counts.available,
      textColor: 'text-emerald-400',
      badgeColor: 'bg-emerald-500/20 text-emerald-300',
    },
    {
      id: 'reserved',
      label: VEHICLE_STATUS_META.reserved.label,
      count: counts.reserved,
      textColor: 'text-amber-400',
      badgeColor: 'bg-amber-500/20 text-amber-300',
    },
    {
      id: 'rented',
      label: VEHICLE_STATUS_META.rented.label,
      count: counts.rented,
      textColor: 'text-blue-400',
      badgeColor: 'bg-blue-500/20 text-blue-300',
    },
    {
      id: 'maintenance',
      label: VEHICLE_STATUS_META.maintenance.label,
      count: counts.maintenance,
      textColor: 'text-rose-400',
      badgeColor: 'bg-rose-500/20 text-rose-300',
    },
    {
      id: 'oil_due',
      label: 'تحتاج تغيير زيت',
      count: oilDueCount,
      textColor: oilDueCount > 0 ? 'text-amber-400' : 'text-slate-400',
      badgeColor: 'bg-amber-500/20 text-amber-300',
    },
    {
      id: 'inactive',
      label: VEHICLE_STATUS_META.inactive.label,
      count: counts.inactive,
      textColor: 'text-slate-400',
      badgeColor: 'bg-slate-800 text-slate-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
      {statsList.map((stat) => {
        const isActive = activeStatusFilter === stat.id;
        return (
          <button
            key={stat.id}
            type="button"
            onClick={() => onSelectStatus(stat.id)}
            className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer min-h-[52px] ${
              isActive
                ? 'bg-amber-500/15 border-amber-500/60 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className={`text-xs font-bold ${stat.textColor}`}>{stat.label}</span>
              {isActive && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <div className={`text-lg font-extrabold font-mono ${stat.textColor}`}>
              {stat.count}
            </div>
          </button>
        );
      })}
    </div>
  );
};
