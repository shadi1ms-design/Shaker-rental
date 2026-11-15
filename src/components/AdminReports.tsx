import React, { useState, useMemo } from 'react';
import { Vehicle, Booking } from '../types';
import { getFleetStatusCounts } from '../utils/vehicleStatus';
import { isFinanciallyActiveBooking } from '../utils/bookingCalculations';
import { isTodayLocal, isWithinLastDaysLocal, isThisMonthLocal, todayLocalISO } from '../utils/dateUtils';
import { VEHICLE_CATEGORY_LABELS } from '../constants/vehicleCategories';
import { ADMIN_TAB_LABEL } from '../constants/adminNav';
import { formatMoney, formatDateDisplay } from '../utils/format';
import { StatusBadge } from './common/StatusBadge';
import {
  BarChart3,
  Download,
  Printer,
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  Car,
  Clock,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface AdminReportsProps {
  vehicles?: Vehicle[];
  bookings?: Booking[];
}

export const AdminReports: React.FC<AdminReportsProps> = ({
  vehicles = [],
  bookings = [],
}) => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const safeVehicles = useMemo(() => vehicles || [], [vehicles]);
  const safeBookings = useMemo(() => bookings || [], [bookings]);

  // Filter bookings based on selected period in Damascus local timezone
  const filteredBookings = useMemo(() => {
    return safeBookings.filter((b) => {
      if (b.isDeleted === true) return false;
      if (!b.createdAt) return period === 'all';
      if (period === 'today') {
        return isTodayLocal(b.createdAt);
      }
      if (period === 'week') {
        return isWithinLastDaysLocal(b.createdAt, 7);
      }
      if (period === 'month') {
        return isThisMonthLocal(b.createdAt);
      }
      return true;
    });
  }, [safeBookings, period]);

  const { totalRevenue, totalInsurance, totalGross, pendingReviewCount, pendingReviewGross } = useMemo(() => {
    return filteredBookings.reduce(
      (acc, b) => {
        if (b.status === 'new' || b.status === 'reviewing') {
          acc.pendingReviewCount += 1;
          acc.pendingReviewGross += Number(b.totalPrice || 0);
          return acc;
        }
        if (!isFinanciallyActiveBooking(b)) return acc;
        const effectiveTotal =
          typeof b.finalTotal === 'number'
            ? b.finalTotal
            : Number(b.totalPrice || 0) + Number(b.extraCharges || 0);
        const ins = Number(b.insuranceAmount || 0);
        const netRev = Math.max(0, effectiveTotal - ins);
        acc.totalRevenue += netRev;
        acc.totalInsurance += ins;
        acc.totalGross += effectiveTotal;
        return acc;
      },
      {
        totalRevenue: 0,
        totalInsurance: 0,
        totalGross: 0,
        pendingReviewCount: 0,
        pendingReviewGross: 0,
      }
    );
  }, [filteredBookings]);

  // Fleet utilization via unified getFleetStatusCounts
  const fleetCounts = useMemo(() => getFleetStatusCounts(safeVehicles), [safeVehicles]);
  const rentedVehiclesCount = fleetCounts.rented;
  const availableVehiclesCount = fleetCounts.available;
  const maintenanceVehiclesCount = fleetCounts.maintenance;
  const reservedOrInactiveCount = fleetCounts.reservedOrInactive;
  const utilizationRate = fleetCounts.total > 0 ? Math.round((rentedVehiclesCount / fleetCounts.total) * 100) : 0;

  // Category breakdown: net revenue
  const categoryRevenue = useMemo(() => {
    const map: Record<string, number> = { light: 0, medium: 0, jeep_7seats: 0 };
    filteredBookings.forEach((b) => {
      if (!isFinanciallyActiveBooking(b)) return;
      const cat = b.vehicleCategory || 'medium';
      const effectiveTotal =
        typeof b.finalTotal === 'number'
          ? b.finalTotal
          : Number(b.totalPrice || 0) + Number(b.extraCharges || 0);
      const netRev = Math.max(0, effectiveTotal - (b.insuranceAmount || 0));
      map[cat] = (map[cat] || 0) + netRev;
    });
    return map;
  }, [filteredBookings]);

  // Timeline Chart Data
  const timelineData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; bookingsCount: number }>();
    filteredBookings.forEach((b) => {
      if (!isFinanciallyActiveBooking(b)) return;
      const rawDate = b.pickupDate || (b.createdAt ? b.createdAt.split('T')[0] : 'غير محدد');
      const curr = map.get(rawDate) || { date: rawDate, revenue: 0, bookingsCount: 0 };
      const effectiveTotal =
        typeof b.finalTotal === 'number'
          ? b.finalTotal
          : Number(b.totalPrice || 0) + Number(b.extraCharges || 0);
      const netRev = Math.max(0, effectiveTotal - (b.insuranceAmount || 0));
      curr.revenue += netRev;
      curr.bookingsCount += 1;
      map.set(rawDate, curr);
    });
    const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sorted.length > 0 ? sorted : [{ date: todayLocalISO(), revenue: 0, bookingsCount: 0 }];
  }, [filteredBookings]);

  // Category Chart Data
  const categoryChartData = useMemo(() => {
    return [
      { name: VEHICLE_CATEGORY_LABELS.light, revenue: categoryRevenue.light, fill: '#10b981' },
      { name: VEHICLE_CATEGORY_LABELS.medium, revenue: categoryRevenue.medium, fill: '#f59e0b' },
      { name: VEHICLE_CATEGORY_LABELS.jeep_7seats, revenue: categoryRevenue.jeep_7seats, fill: '#3b82f6' },
    ];
  }, [categoryRevenue]);

  // Fleet Utilization Chart Data
  const fleetPieData = useMemo(() => {
    return [
      { name: 'متاحة للتأجير', value: availableVehiclesCount, color: '#10b981' },
      { name: 'مؤجرة حالياً', value: rentedVehiclesCount, color: '#3b82f6' },
      { name: 'في الصيانة', value: maintenanceVehiclesCount, color: '#f43f5e' },
      { name: 'محجوزة / غير نشطة', value: reservedOrInactiveCount, color: '#64748b' },
    ].filter(item => item.value > 0);
  }, [availableVehiclesCount, rentedVehiclesCount, maintenanceVehiclesCount, reservedOrInactiveCount]);

  const sanitizeCSVCell = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    let str = String(val).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const handleExportCSV = () => {
    const headers = ['رقم الحجز', 'اسم المستأجر', 'السيارة', 'تاريخ الاستلام', 'تاريخ الإرجاع', 'عدد الأيام', 'الإجمالي'];
    const rows = filteredBookings.map((b) => [
      sanitizeCSVCell(b.bookingNumber),
      sanitizeCSVCell(b.customerName),
      sanitizeCSVCell(b.vehicleName),
      sanitizeCSVCell(b.pickupDate),
      sanitizeCSVCell(b.returnDate),
      sanitizeCSVCell(b.rentalDays),
      sanitizeCSVCell(b.totalPrice),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `shaker-reports-${todayLocalISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span>{ADMIN_TAB_LABEL.reports}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            متابعة الإيرادات، التأمينات المستردة، مخططات بيانية تفاعلية، ونسبة إشغال الأسطول
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex flex-wrap bg-slate-950 p-1 rounded-xl border border-slate-800 text-sm">
            {(
              [
                { id: 'today', label: 'اليوم' },
                { id: 'week', label: 'الأسبوع' },
                { id: 'month', label: 'الشهر الحالي' },
                { id: 'all', label: 'كافة الفترات' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`min-h-11 px-3.5 py-2 rounded-lg font-bold transition-all cursor-pointer text-sm ${
                  period === p.id ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="min-h-11 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
            title="تصدير تقرير CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">تصدير CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-11 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
            title="طباعة التقرير"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">طباعة</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>إجمالي الإيراد التشغيلي</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white tabular-nums">{formatMoney(totalRevenue)}</div>
          <div className="text-xs text-emerald-400 font-semibold">صافي الأجرة (إجمالي العقود: {formatMoney(totalGross)})</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>التأمينات المستردة</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 tabular-nums">{formatMoney(totalInsurance)}</div>
          <div className="text-xs text-slate-400">أمانات محتجزة للمستأجرين تُعاد عند الإرجاع</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>نسبة إشغال أسطول السيارات</span>
            <Car className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400 tabular-nums">{utilizationRate}%</div>
          <div className="text-xs text-slate-400">{rentedVehiclesCount} سيارة مؤجرة من أصل {safeVehicles.length}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>العمليات المعتمدة / قيد المراجعة</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-blue-400 tabular-nums">
            {filteredBookings.filter(isFinanciallyActiveBooking).length}
            {pendingReviewCount > 0 && (
              <span className="text-xs font-bold text-amber-400 mr-2">
                (+{pendingReviewCount} قيد المراجعة)
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            {pendingReviewCount > 0
              ? `${pendingReviewCount} حجز قيد المراجعة بقيمة ${formatMoney(pendingReviewGross)}`
              : 'كافة الحجوزات معتمدة أو مكتملة'}
          </div>
        </div>
      </div>

      {/* RECHARTS INTERACTIVE VISUALIZATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Revenue Over Time */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>المسار الزمني للإيرادات والمقبوضات</span>
            </h4>
            <span className="text-xs text-slate-400">مخطط بياني تفاعلي</span>
          </div>

          <div className="h-64 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#fff',
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    formatMoney(Number(value)),
                    String(name) === 'revenue' ? 'الإيراد الإجمالي' : 'المحصل فعلياً',
                  ]}
                />
                <Legend
                  formatter={(value: unknown) => (String(value) === 'revenue' ? 'الإيراد الإجمالي' : 'المحصل فعلياً')}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" name="revenue" />
                <Area type="monotone" dataKey="collected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" name="collected" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Fleet Occupancy Donut */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-400" />
              <span>جاهزية الأسطول</span>
            </h4>
            <span className="text-xs text-slate-400">{safeVehicles.length} مركبة</span>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            {safeVehicles.length === 0 ? (
              <span className="text-xs text-slate-400">لا توجد بيانات للأسطول</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fleetPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {fleetPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-2 border-t border-slate-800 text-xs">
            <div>
              <span className="text-xs text-emerald-400 block font-semibold">● متاحة</span>
              <span className="text-sm font-bold tabular-nums text-white">{availableVehiclesCount}</span>
            </div>
            <div>
              <span className="text-xs text-blue-400 block font-semibold">● مؤجرة</span>
              <span className="text-sm font-bold tabular-nums text-white">{rentedVehiclesCount}</span>
            </div>
            <div>
              <span className="text-xs text-rose-400 block font-semibold">● صيانة</span>
              <span className="text-sm font-bold tabular-nums text-white">{maintenanceVehiclesCount}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-semibold">● محجوزة/غير نشطة</span>
              <span className="text-sm font-bold tabular-nums text-white">{reservedOrInactiveCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart 3: Revenue by Vehicle Category */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Car className="w-4 h-4 text-blue-400" />
            <span>توزيع الإيرادات حسب فئة المركبة</span>
          </h4>
          <span className="text-xs text-slate-400">مقارنة فئات الأسطول</span>
        </div>

        <div className="h-48 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#fff',
                }}
                formatter={(val: unknown) => [formatMoney(Number(val)), 'الإيرادات']}
              />
              <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                {categoryChartData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Bookings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950 border-b border-slate-800 font-bold text-sm text-white flex flex-wrap items-center justify-between gap-2">
          <span>سجل الحجوزات للفترة المحددة ({filteredBookings.length} عملية)</span>
          <span className="text-xs text-slate-400 font-normal">مرتبة حسب تاريخ الإنشاء</span>
        </div>

        {/* Mobile Cards View (< 768px) */}
        <div className="md:hidden divide-y divide-slate-800/70">
          {filteredBookings.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              لا توجد حجوزات في الفترة المحددة
            </div>
          ) : (
            filteredBookings.map((b) => (
              <div key={b.id} className="p-4 space-y-2.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="tabular-nums font-bold text-amber-400 text-xs block">{b.bookingNumber}</span>
                    <span className="font-bold text-white text-base block truncate">{b.customerName}</span>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={b.status} type="booking" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-slate-300">
                  <span>{b.vehicleName}</span>
                  <span className="font-extrabold text-white tabular-nums shrink-0">{formatMoney(b.totalPrice)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span className="tabular-nums">
                    <span dir="ltr" className="inline-block font-mono">{formatDateDisplay(b.pickupDate)}</span> إلى{' '}
                    <span dir="ltr" className="inline-block font-mono">{formatDateDisplay(b.returnDate)}</span>
                  </span>
                  <span>{b.rentalDays} أيام</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm text-right border-collapse">
            <thead>
              <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <th className="p-3">رقم الحجز</th>
                <th className="p-3">اسم المستأجر</th>
                <th className="p-3">السيارة</th>
                <th className="p-3">فترة الإيجار</th>
                <th className="p-3">المدة</th>
                <th className="p-3">المبلغ الإجمالي</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredBookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 tabular-nums font-bold text-amber-400">{b.bookingNumber}</td>
                  <td className="p-3 font-medium text-white">{b.customerName}</td>
                  <td className="p-3 text-slate-300">{b.vehicleName}</td>
                  <td className="p-3 text-slate-400 tabular-nums"><span dir="ltr" className="inline-block font-mono">{formatDateDisplay(b.pickupDate)}</span> إلى <span dir="ltr" className="inline-block font-mono">{formatDateDisplay(b.returnDate)}</span></td>
                  <td className="p-3 text-slate-300">{b.rentalDays} أيام</td>
                  <td className="p-3 font-bold text-white tabular-nums">{formatMoney(b.totalPrice)}</td>
                  <td className="p-3">
                    <StatusBadge status={b.status} type="booking" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
