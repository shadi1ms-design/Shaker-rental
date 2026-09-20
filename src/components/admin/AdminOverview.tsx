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
  FileText
} from 'lucide-react';
import { AdminTabType } from '../AdminDashboard';

interface AdminOverviewProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  vehiclesNeedingOil?: Array<{ vehicle: Vehicle; kmSinceOil: number; isUrgent: boolean }>;
  onNavigateTab: (tab: AdminTabType) => void;
  onOpenAddVehicle: () => void;
  onOpenMaintenanceModal?: () => void;
  onSyncAll: () => Promise<void>;
  isSyncing: boolean;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  vehicles,
  bookings,
  onNavigateTab,
  onOpenAddVehicle,
  onSyncAll,
  isSyncing,
}) => {
  // KPIs calculation
  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter((v) => v.status === 'available').length;
  const rentedVehicles = vehicles.filter((v) => v.status === 'rented').length;
  const inMaintenance = vehicles.filter((v) => v.status === 'maintenance').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter((b) => b.createdAt && b.createdAt.startsWith(todayStr)).length;
  const activeRentals = bookings.filter((b) => b.status === 'rented').length;

  const monthlyRevenue = bookings.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  const outstandingBalance = bookings.reduce(
    (acc, b) => acc + (b.remainingAmount ?? (b.totalPrice - (b.paidAmount || 0))),
    0
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">طلب جديد</span>;
      case 'reviewing':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">قيد المراجعة</span>;
      case 'confirmed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">مؤكد</span>;
      case 'rented':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">جاري التأجير</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">مكتمل</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">ملغي</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  const availablePct = totalVehicles > 0 ? Math.round((availableVehicles / totalVehicles) * 100) : 0;
  const rentedPct = totalVehicles > 0 ? Math.round((rentedVehicles / totalVehicles) * 100) : 0;
  const maintPct = totalVehicles > 0 ? Math.round((inMaintenance / totalVehicles) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Top Welcome Banner with Quick Actions */}
      <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date().toLocaleDateString('ar-SY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              لوحة المؤشرات والعمليات المركزية
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              إدارة أسطول شاكر لتأجير السيارات في دمشق وجرمانا، متابعة الحجوزات الإلكترونية المباشرة، ومراقبة الصيانة الدورية كل 5000 كم.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenAddVehicle}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة سيارة</span>
            </button>

            <button
              onClick={onSyncAll}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50"
              title="مزامنة فورية مع Cloud Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة السحابة'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Total Fleet */}
        <div
          onClick={() => onNavigateTab('vehicles')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px]">إجمالي الأسطول</span>
            <Car className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
          </div>
          <span className="text-2xl font-black text-white font-mono">{totalVehicles}</span>
          <span className="text-[10px] text-emerald-400 block font-semibold">متاح: {availableVehicles} سيارة</span>
        </div>

        {/* Card 2: Today's Bookings */}
        <div
          onClick={() => onNavigateTab('bookings')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px]">حجوزات اليوم</span>
            <Calendar className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
          </div>
          <span className="text-2xl font-black text-amber-400 font-mono">{todayBookings}</span>
          <span className="text-[10px] text-slate-400 block">إجمالي المسجل: {bookings.length}</span>
        </div>

        {/* Card 3: Active Rentals */}
        <div
          onClick={() => onNavigateTab('bookings')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px]">تأجيرات نشطة</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </div>
          <span className="text-2xl font-black text-blue-400 font-mono">{activeRentals}</span>
          <span className="text-[10px] text-slate-400 block">في حوزة المستأجرين</span>
        </div>

        {/* Card 4: Collected Revenue */}
        <div
          onClick={() => onNavigateTab('bookings')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px]">المقبوضات المحصلة</span>
            <DollarSign className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
          <span className="text-2xl font-black text-emerald-400 font-mono">${monthlyRevenue}</span>
          <span className="text-[10px] text-slate-400 block">إجمالي المسدد بالحجوزات</span>
        </div>

        {/* Card 5: Outstanding Balance */}
        <div
          onClick={() => onNavigateTab('bookings')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px]">المتبقي بذمة العملاء</span>
            <FileText className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 transition-colors" />
          </div>
          <span className="text-2xl font-black text-rose-400 font-mono">${outstandingBalance}</span>
          <span className="text-[10px] text-rose-400 block">مستحقات عند التسليم</span>
        </div>

        {/* Card 6: Available Fleet Readiness */}
        <div
          onClick={() => onNavigateTab('vehicles')}
          className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-1 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px]">السيارات المتاحة فوراً</span>
            <Car className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
          <span className="text-2xl font-black text-emerald-400 font-mono">{availableVehicles}</span>
          <span className="text-[10px] text-slate-400 block">جاهزة للتأجير والتسليم</span>
        </div>
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
            className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
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

      {/* Two Main Widgets: Recent Bookings + Oil/Maintenance Overdue */}
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
              className="text-xs text-amber-400 hover:underline flex items-center gap-1"
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
                    {getStatusBadge(b.status)}
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
              className="text-xs text-amber-400 hover:underline flex items-center gap-1"
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
  );
};
