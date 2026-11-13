import React, { useMemo, useState } from 'react';
import { Vehicle, Booking } from '../../types';
import { getFleetStatusCounts } from '../../utils/vehicleStatus';
import { calculateOilChange } from '../../utils/oilChange';
import { navigate } from '../../router';
import {
  Calendar,
  Car,
  Clock,
  DollarSign,
  FileText,
  Key,
  AlertCircle,
  Droplets,
} from 'lucide-react';
import { AdminTabType } from '../../constants/adminNav';
import { isTodayLocal, isThisMonthLocal, isWithinLastDaysLocal, formatArabicDate } from '../../utils/dateUtils';
import { calculateBookingFinancials } from '../../utils/bookingCalculations';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';
import { VEHICLE_STATUS_META } from '../../constants/statusMeta';
import { formatMoney, formatDateDisplay } from '../../utils/format';

interface AdminOverviewProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  onNavigateTab: (tab: AdminTabType) => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  vehicles,
  bookings,
  onNavigateTab,
}) => {
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'all'>('month');

  const periodFilteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.isDeleted === true) return false;
      if (!b.createdAt) return period === 'all';
      if (period === 'today') {
        return isTodayLocal(b.createdAt);
      }
      if (period === '7days') {
        return isWithinLastDaysLocal(b.createdAt, 7);
      }
      if (period === 'month') {
        return isThisMonthLocal(b.createdAt);
      }
      return true;
    });
  }, [bookings, period]);

  const financials = useMemo(() => {
    return calculateBookingFinancials(periodFilteredBookings);
  }, [periodFilteredBookings]);

  const fleetCounts = useMemo(() => getFleetStatusCounts(vehicles), [vehicles]);
  const totalVehicles = fleetCounts.total;
  const availableVehicles = fleetCounts.available;
  const reservedVehicles = fleetCounts.reserved;
  const rentedVehicles = fleetCounts.rented;
  const inMaintenance = fleetCounts.maintenance;
  const inactiveVehicles = fleetCounts.inactive;

  const todayBookingsCount = bookings.filter((b) => !b.isDeleted && isTodayLocal(b.createdAt)).length;
  const activeRentals = bookings.filter((b) => !b.isDeleted && b.status === 'rented').length;
  const pendingReviewCount = bookings.filter((b) => !b.isDeleted && (b.status === 'new' || b.status === 'reviewing')).length;
  const oilDueVehiclesCount = useMemo(
    () => vehicles.filter((v) => calculateOilChange(v).needsAttention).length,
    [vehicles]
  );

  const calcPct = (count: number) => (totalVehicles > 0 ? Math.round((count / totalVehicles) * 100) : 0);

  const availablePct = calcPct(availableVehicles);
  const reservedPct = calcPct(reservedVehicles);
  const rentedPct = calcPct(rentedVehicles);
  const maintPct = calcPct(inMaintenance);
  const inactivePct = calcPct(inactiveVehicles);

  return (
    <div className="space-y-8">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatArabicDate()}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              لوحة المؤشرات والعمليات المركزية
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              إدارة أسطول شاكر لتأجير السيارات في دمشق وجرمانا، متابعة الحجوزات الإلكترونية المباشرة، ومواعيد تغيير الزيت.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(
                [
                  { id: 'today', label: 'اليوم' },
                  { id: '7days', label: '7 أيام' },
                  { id: 'month', label: 'الشهر الحالي' },
                  { id: 'all', label: 'كافة الفترات' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    period === p.id
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 7 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-4">
        <StatCard
          label="إجمالي الأسطول"
          value={totalVehicles}
          subtext={`متاح: ${availableVehicles} سيارة`}
          icon={Car}
          iconColor="text-amber-400"
          onClick={() => onNavigateTab('vehicles')}
        />

        <StatCard
          label="حجوزات اليوم"
          value={todayBookingsCount}
          valueColor="text-amber-400"
          subtext={`إجمالي المسجل: ${bookings.length}`}
          icon={Calendar}
          iconColor="text-amber-400"
          onClick={() => onNavigateTab('bookings')}
        />

        <StatCard
          label="تأجيرات نشطة"
          value={activeRentals}
          valueColor="text-blue-400"
          subtext="في حوزة المستأجرين"
          icon={Key}
          iconColor="text-blue-400"
          onClick={() => onNavigateTab('bookings')}
        />

        <StatCard
          label="طلبات قيد المراجعة"
          value={pendingReviewCount}
          valueColor="text-purple-400"
          subtext={
            financials.pendingReviewGrossTotal > 0
              ? `بقيمة ${formatMoney(financials.pendingReviewGrossTotal)} (قيد المراجعة)`
              : 'تتطلب تدقيق الموظف'
          }
          icon={AlertCircle}
          iconColor="text-purple-400"
          onClick={() => onNavigateTab('bookings')}
        />

        <StatCard
          label="تحتاج تغيير زيت"
          value={oilDueVehiclesCount}
          valueColor={oilDueVehiclesCount > 0 ? 'text-rose-400' : 'text-emerald-400'}
          subtext={oilDueVehiclesCount > 0 ? 'قريباً أو متجاوزة للعداد' : 'جميع السيارات ضمن الحد'}
          icon={Droplets}
          iconColor={oilDueVehiclesCount > 0 ? 'text-rose-400' : 'text-emerald-400'}
          onClick={() => navigate('/admin/vehicles?status=oil_due')}
        />

        <StatCard
          label={`الإيراد التشغيلي${period === 'today' ? ' (اليوم)' : period === '7days' ? ' (7 أيام)' : period === 'month' ? ' (الشهر)' : ''}`}
          value={formatMoney(financials.totalRevenue)}
          valueColor="text-emerald-400"
          subtext={`من ${financials.totalValidBookings} حجز فعال`}
          icon={DollarSign}
          iconColor="text-emerald-400"
          onClick={() => onNavigateTab('bookings')}
        />

        <StatCard
          label={`التأمينات المستردة${period === 'today' ? ' (اليوم)' : period === '7days' ? ' (7 أيام)' : period === 'month' ? ' (الشهر)' : ''}`}
          value={formatMoney(financials.totalInsurance)}
          valueColor="text-amber-400"
          subtext="أمانات مستردة عند الإرجاع"
          icon={FileText}
          iconColor="text-amber-400"
          onClick={() => onNavigateTab('bookings')}
        />
      </div>

      {/* 5-Status Fleet Occupancy Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white flex items-center gap-2">
            <Car className="w-4 h-4 text-amber-400" />
            نسبة إشغال وجاهزية الأسطول ({totalVehicles} مركبة)
          </span>
          <button
            type="button"
            onClick={() => onNavigateTab('vehicles')}
            className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>إدارة الأسطول</span>
            <span>←</span>
          </button>
        </div>

        <div
          className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex"
          role="img"
          aria-label={`توزيع حالات الأسطول: ${availableVehicles} متاحة، ${reservedVehicles} محجوزة، ${rentedVehicles} مؤجرة، ${inMaintenance} صيانة، ${inactiveVehicles} غير نشطة`}
        >
          <div
            style={{ width: `${availablePct}%` }}
            className="bg-emerald-500 transition-all duration-500"
            title={`${VEHICLE_STATUS_META.available.label}: ${availableVehicles} (${availablePct}%)`}
          />
          <div
            style={{ width: `${reservedPct}%` }}
            className="bg-amber-500 transition-all duration-500"
            title={`${VEHICLE_STATUS_META.reserved.label}: ${reservedVehicles} (${reservedPct}%)`}
          />
          <div
            style={{ width: `${rentedPct}%` }}
            className="bg-blue-500 transition-all duration-500"
            title={`${VEHICLE_STATUS_META.rented.label}: ${rentedVehicles} (${rentedPct}%)`}
          />
          <div
            style={{ width: `${maintPct}%` }}
            className="bg-rose-500 transition-all duration-500"
            title={`${VEHICLE_STATUS_META.maintenance.label}: ${inMaintenance} (${maintPct}%)`}
          />
          <div
            style={{ width: `${inactivePct}%` }}
            className="bg-slate-600 transition-all duration-500"
            title={`${VEHICLE_STATUS_META.inactive.label}: ${inactiveVehicles} (${inactivePct}%)`}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="text-slate-300">{VEHICLE_STATUS_META.available.label}: {availableVehicles}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="text-slate-300">{VEHICLE_STATUS_META.reserved.label}: {reservedVehicles}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span className="text-slate-300">{VEHICLE_STATUS_META.rented.label}: {rentedVehicles}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
            <span className="text-slate-300">{VEHICLE_STATUS_META.maintenance.label}: {inMaintenance}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block" />
            <span className="text-slate-300">{VEHICLE_STATUS_META.inactive.label}: {inactiveVehicles}</span>
          </div>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Widget 1: Recent Bookings */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              أحدث طلبات الحجز المستلمة
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('bookings')}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>عرض كافة الحجوزات ({bookings.length})</span>
              <span>←</span>
            </button>
          </div>

          {bookings.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="لا توجد طلبات حجز مسجلة حالياً"
              description="ستظهر طلبات الحجز الواردة من العملاء هنا فور إتمامها."
              actionLabel="عرض كافة الحجوزات"
              onAction={() => onNavigateTab('bookings')}
            />
          ) : (
            <div className="space-y-3">
              {bookings.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">{b.bookingNumber}</span>
                      <span className="font-bold text-white">{b.customerName}</span>
                    </div>
                    <p className="text-slate-400 text-xs">
                      {b.vehicleName} • من <span dir="ltr" className="inline-block font-mono text-slate-300">{formatDateDisplay(b.pickupDate)}</span> إلى <span dir="ltr" className="inline-block font-mono text-slate-300">{formatDateDisplay(b.returnDate)}</span> ({b.rentalDays} أيام)
                    </p>
                  </div>

                  <div className="text-left flex flex-col items-end gap-1.5 shrink-0">
                    <span className="font-mono font-bold text-white">{formatMoney(b.totalPrice)}</span>
                    <StatusBadge status={b.status} type="booking" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Widget 2: Fleet Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Car className="w-4 h-4 text-amber-400" />
              جاهزية أسطول السيارات للتأجير
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('vehicles')}
              className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>إدارة الأسطول بالكامل</span>
              <span>←</span>
            </button>
          </div>

          {vehicles.length === 0 ? (
            <EmptyState
              icon={Car}
              title="لا توجد سيارات مسجلة في الأسطول"
              description="ابدأ بإضافة سيارات جديدة لأسطول شاكر لتأجير السيارات."
              actionLabel="إدارة الأسطول"
              onAction={() => onNavigateTab('vehicles')}
            />
          ) : (
            <div className="space-y-3">
              {vehicles.slice(0, 5).map((v) => (
                <div
                  key={v.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold block text-white">
                      {v.brand} {v.model} ({v.year})
                    </span>
                    <span className="text-xs text-slate-400 block font-mono">
                      لوحة: {v.plateNumber ? v.plateNumber : v._internalDetailsLoaded ? 'بدون لوحة' : 'جاري التحميل...'} • الأجرة: {formatMoney(v.dailyPrice)}/يوم
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={v.status} type="vehicle" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
