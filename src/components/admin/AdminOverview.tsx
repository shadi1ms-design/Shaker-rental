import React from 'react';
import { Vehicle, Booking } from '../../types';
import {
  Calendar,
  Car,
  Droplet,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Wrench,
  Plus,
  RefreshCw,
  Clock,
  DollarSign,
  FileText,
  BarChart2
} from 'lucide-react';
import { AdminTabType } from '../AdminDashboard';
import { todayLocalISO, isTodayLocal, formatArabicDate } from '../../utils/dateUtils';
import { calculateBookingFinancials } from '../../utils/bookingCalculations';
import { BOOKING_STATUS_META } from '../../constants/statusMeta';
import { StatCard } from '../common/StatCard';
import { StatusBadge } from '../common/StatusBadge';

interface AdminOverviewProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  vehiclesNeedingOil?: Array<{ vehicle: Vehicle; kmSinceOil: number; isUrgent: boolean }>;
  onNavigateTab: (tab: AdminTabType) => void;
  onOpenAddVehicle: () => void;
  onSyncAll: () => Promise<void>;
  isSyncing: boolean;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  vehicles,
  bookings,
  vehiclesNeedingOil = [],
  onNavigateTab,
  onOpenAddVehicle,
  onSyncAll,
  isSyncing,
}) => {
  const [period, setPeriod] = React.useState<'today' | '7days' | 'month' | 'all'>('month');

  // Filter bookings according to period and Damascus local timezone
  const periodFilteredBookings = React.useMemo(() => {
    const today = todayLocalISO();
    return bookings.filter((b) => {
      if (!b.createdAt) return period === 'all';
      if (period === 'today') {
        return isTodayLocal(b.createdAt);
      }
      if (period === '7days') {
        const d = new Date(b.createdAt);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return d >= sevenDaysAgo;
      }
      if (period === 'month') {
        const d = new Date(b.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [bookings, period]);

  // Financial KPIs - strictly excluding cancelled and rejected bookings
  const financials = React.useMemo(() => {
    return calculateBookingFinancials(periodFilteredBookings);
  }, [periodFilteredBookings]);

  // Overall counts
  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter((v) => v.status === 'available').length;
  const rentedVehicles = vehicles.filter((v) => v.status === 'rented').length;
  const inMaintenance = vehicles.filter((v) => v.status === 'maintenance').length;

  const todayBookingsCount = bookings.filter((b) => isTodayLocal(b.createdAt)).length;
  const activeRentals = bookings.filter((b) => b.status === 'rented').length;


  const availablePct = totalVehicles > 0 ? Math.round((availableVehicles / totalVehicles) * 100) : 0;
  const rentedPct = totalVehicles > 0 ? Math.round((rentedVehicles / totalVehicles) * 100) : 0;
  const maintPct = totalVehicles > 0 ? Math.round((inMaintenance / totalVehicles) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Top Welcome Banner with Quick Actions & Period Selector */}
      <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatArabicDate()}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              لوحة المؤشرات والعمليات المركزية
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              إدارة أسطول شاكر لتأجير السيارات في دمشق وجرمانا، متابعة الحجوزات الإلكترونية المباشرة، ومراقبة الصيانة الدورية كل 5000 كم.
            </p>
          </div>

          {/* Quick Action Buttons & Period Pills */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Period Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {[
                { id: 'today', label: 'اليوم' },
                { id: '7days', label: '7 أيام' },
                { id: 'month', label: 'الشهر الحالي' },
                { id: 'all', label: 'كافة الفترات' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id as any)}
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

            <div className="flex items-center gap-2.5">
              <button
                onClick={onOpenAddVehicle}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة سيارة</span>
              </button>

              <button
                onClick={onSyncAll}
                disabled={isSyncing}
                className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                title="مزامنة فورية مع Cloud Firestore"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة السحابة'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI & Metrics Content */}
      <div className="space-y-8">
        {/* Vehicles Needing Oil Change Notice Card (If any exist) */}
        {vehiclesNeedingOil.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-black text-white">
                  سيارات تتطلب غيار زيت دوري ({vehiclesNeedingOil.length} مركبة)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('vehicles')}
                className="text-xs text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>متابعة جدول الصيانة بالأسطول</span>
                <span>←</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vehiclesNeedingOil.map(({ vehicle: v, kmSinceOil, isUrgent }) => (
                <div
                  key={v.id}
                  className="bg-slate-950/80 border border-amber-500/20 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-white block">
                      {v.brand} {v.model} ({v.year})
                    </span>
                    <span className="text-[11px] text-slate-400 block font-mono">
                      لوحة: {v.plateNumber} • قاطع: {kmSinceOil.toLocaleString()} كم
                    </span>
                  </div>
                  {isUrgent ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse shrink-0">
                      عاجل تجاوز الفاصل
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                      قارب 5000 كم
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
            {/* 6 Metric KPI Cards using shared StatCard component */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard
                label="إجمالي الأسطول"
                value={totalVehicles}
                subtext={`متاح: ${availableVehicles} سيارة`}
                icon={Car}
                iconColor="text-amber-400"
                onClick={() => onNavigateTab('vehicles')}
              />

              <StatCard
                label="حجوزات اليوم (دمشق)"
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
                icon={ArrowUpRight}
                iconColor="text-blue-400"
                onClick={() => onNavigateTab('bookings')}
              />

              <StatCard
                label={`المقبوضات المحصلة${period === 'today' ? ' (اليوم)' : period === '7days' ? ' (7 أيام)' : period === 'month' ? ' (الشهر)' : ''}`}
                value={`$${financials.collectedRevenue.toLocaleString()}`}
                valueColor="text-emerald-400"
                subtext={`من ${financials.totalValidBookings} حجز فعال`}
                icon={DollarSign}
                iconColor="text-emerald-400"
                onClick={() => onNavigateTab('bookings')}
              />

              <StatCard
                label={`المتبقي بذمة العملاء${period === 'today' ? ' (اليوم)' : period === '7days' ? ' (7 أيام)' : period === 'month' ? ' (الشهر)' : ''}`}
                value={`$${financials.outstandingBalance.toLocaleString()}`}
                valueColor="text-rose-400"
                subtext="مستحقات غير ملغاة"
                icon={FileText}
                iconColor="text-rose-400"
                onClick={() => onNavigateTab('bookings')}
              />

              <StatCard
                label="السيارات المتاحة فوراً"
                value={availableVehicles}
                valueColor="text-emerald-400"
                subtext="جاهزة للتأجير والتسليم"
                icon={Car}
                iconColor="text-emerald-400"
                onClick={() => onNavigateTab('vehicles')}
              />
            </div>

            {/* Fleet Utilization Visual Strip */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-2">
                  <Car className="w-4 h-4 text-amber-400" />
                  نسبة إشغال وجاهزية الأسطول ({totalVehicles} مركبة)
                </span>
                <button
                  onClick={() => onNavigateTab('vehicles')}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>إدارة الأسطول</span>
                  <span>←</span>
                </button>
              </div>

              {/* Multi-segment Progress bar */}
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${availablePct}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                  title={`متاحة: ${availableVehicles} (${availablePct}%)`}
                />
                <div
                  style={{ width: `${rentedPct}%` }}
                  className="bg-blue-500 transition-all duration-500"
                  title={`مؤجرة: ${rentedVehicles} (${rentedPct}%)`}
                />
                <div
                  style={{ width: `${maintPct}%` }}
                  className="bg-amber-500 transition-all duration-500"
                  title={`صيانة: ${inMaintenance} (${maintPct}%)`}
                />
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-slate-300">متاحة للتأجير: {availableVehicles} ({availablePct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  <span className="text-slate-300">مؤجرة حالياً: {rentedVehicles} ({rentedPct}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span className="text-slate-300">في الصيانة والفحص: {inMaintenance} ({maintPct}%)</span>
                </div>
              </div>
            </div>

            {/* Two Main Widgets: Recent Bookings + Fleet Quick Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Widget 1: Upcoming & Recent Bookings */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    أحدث طلبات الحجز المستلمة
                  </h3>
                  <button
                    onClick={() => onNavigateTab('bookings')}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>عرض كافة الحجوزات ({bookings.length})</span>
                    <span>←</span>
                  </button>
                </div>

                {bookings.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-2xl">
                    لا توجد طلبات حجز مسجلة حالياً
                  </div>
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
                          <p className="text-slate-400 text-[11px]">
                            {b.vehicleName} • من {b.pickupDate} إلى {b.returnDate} ({b.rentalDays} أيام)
                          </p>
                        </div>

                        <div className="text-left flex flex-col items-end gap-1.5 shrink-0">
                          <span className="font-mono font-bold text-white">${b.totalPrice}</span>
                          <StatusBadge status={b.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Widget 2: Fleet Availability & Quick Status */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Car className="w-4 h-4 text-amber-400" />
                    جاهزية أسطول السيارات للتأجير
                  </h3>
                  <button
                    onClick={() => onNavigateTab('vehicles')}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>إدارة الأسطول بالكامل</span>
                    <span>←</span>
                  </button>
                </div>

                {vehicles.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-2xl">
                    لا توجد سيارات مسجلة في الأسطول
                  </div>
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
                          <span className="text-[11px] text-slate-400 block font-mono">
                            لوحة: {v.plateNumber} • الأجرة اليومية: ${v.dailyPrice}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              v.status === 'available'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : v.status === 'rented'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {v.status === 'available' ? 'متاحة للتأجير' : v.status === 'rented' ? 'مؤجرة حالياً' : 'قيد التجهيز'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
      </div>
    </div>
  );
};
