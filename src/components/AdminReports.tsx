import React, { useState, useMemo } from 'react';
import { Vehicle, Booking } from '../types';
import { isFinanciallyActiveBooking } from '../utils/bookingCalculations';
import { todayLocalISO } from '../utils/dateUtils';
import { VEHICLE_CATEGORY_LABELS } from '../constants/vehicleCategories';
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

  const safeVehicles = vehicles || [];
  const safeBookings = bookings || [];

  // Filter bookings based on selected period
  const filteredBookings = useMemo(() => {
    const now = new Date();
    return safeBookings.filter((b) => {
      const bDate = new Date(b.createdAt);
      if (period === 'today') {
        return bDate.toDateString() === now.toDateString();
      }
      if (period === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return bDate >= oneWeekAgo;
      }
      if (period === 'month') {
        return bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [safeBookings, period]);

  // Aggregate financial stats (strictly active, excluding cancelled and rejected)
  const totalRevenue = useMemo(() => {
    return filteredBookings.reduce((acc, b) => {
      if (!isFinanciallyActiveBooking(b)) return acc;
      return acc + (b.totalPrice || 0);
    }, 0);
  }, [filteredBookings]);

  const totalCollected = totalRevenue;
  const totalOutstanding = 0;

  // Fleet utilization
  const rentedVehiclesCount = safeVehicles.filter((v) => v.status === 'rented').length;
  const availableVehiclesCount = safeVehicles.filter((v) => v.status === 'available').length;
  const maintenanceVehiclesCount = safeVehicles.filter((v) => v.status === 'maintenance').length;
  const utilizationRate = safeVehicles.length > 0 ? Math.round((rentedVehiclesCount / safeVehicles.length) * 100) : 0;

  // Category breakdown
  const categoryRevenue = useMemo(() => {
    const map: Record<string, number> = { light: 0, medium: 0, jeep_7seats: 0 };
    filteredBookings.forEach((b) => {
      if (!isFinanciallyActiveBooking(b)) return;
      const cat = b.vehicleCategory || 'medium';
      map[cat] = (map[cat] || 0) + (b.totalPrice || 0);
    });
    return map;
  }, [filteredBookings]);

  // 1. Timeline Chart Data (Revenue over time)
  const timelineData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; bookingsCount: number }>();
    filteredBookings.forEach((b) => {
      if (!isFinanciallyActiveBooking(b)) return;
      const rawDate = b.pickupDate || (b.createdAt ? b.createdAt.split('T')[0] : 'غير محدد');
      const curr = map.get(rawDate) || { date: rawDate, revenue: 0, bookingsCount: 0 };
      curr.revenue += b.totalPrice || 0;
      curr.bookingsCount += 1;
      map.set(rawDate, curr);
    });
    const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sorted.length > 0 ? sorted : [{ date: todayLocalISO(), revenue: 0, bookingsCount: 0 }];
  }, [filteredBookings]);

  // 2. Category Chart Data
  const categoryChartData = useMemo(() => {
    return [
      { name: VEHICLE_CATEGORY_LABELS.light, revenue: categoryRevenue.light, fill: '#10b981' },
      { name: VEHICLE_CATEGORY_LABELS.medium, revenue: categoryRevenue.medium, fill: '#f59e0b' },
      { name: VEHICLE_CATEGORY_LABELS.jeep_7seats, revenue: categoryRevenue.jeep_7seats, fill: '#3b82f6' },
    ];
  }, [categoryRevenue]);

  // 3. Fleet Utilization Chart Data (Donut)
  const fleetPieData = useMemo(() => {
    return [
      { name: 'متاحة للتأجير', value: availableVehiclesCount, color: '#10b981' },
      { name: 'مؤجرة حالياً', value: rentedVehiclesCount, color: '#3b82f6' },
      { name: 'في الصيانة', value: maintenanceVehiclesCount, color: '#f43f5e' },
    ].filter(item => item.value > 0);
  }, [availableVehiclesCount, rentedVehiclesCount, maintenanceVehiclesCount]);

  /**
   * Sanitizes cell content for CSV export against CSV Formula Injection (CWE-1236)
   */
  const sanitizeCSVCell = (val: any): string => {
    if (val === null || val === undefined) return '""';
    let str = String(val).trim();
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const handleExportCSV = () => {
    const headers = ['رقم الحجز', 'العميل', 'السيارة', 'تاريخ الاستلام', 'تاريخ الإعادة', 'المدة', 'المبلغ الإجمالي', 'الحالة'];
    const rows = filteredBookings.map((b) => [
      sanitizeCSVCell(b.bookingNumber),
      sanitizeCSVCell(b.customerName),
      sanitizeCSVCell(b.vehicleName),
      sanitizeCSVCell(b.pickupDate),
      sanitizeCSVCell(b.returnDate),
      sanitizeCSVCell(b.rentalDays),
      sanitizeCSVCell(b.totalPrice),
      sanitizeCSVCell(b.status),
    ]);

    const csvContent = '\uFEFF' + [headers.map(sanitizeCSVCell).join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileDate = todayLocalISO();
    link.download = `shaker_rentals_report_${period}_${fileDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span>التقارير المالية والتشغيلية للأسطول</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            متابعة الإيرادات، ديون العملاء، مخططات بيانية تفاعلية، ونسبة إشغال الأسطول
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Period selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'الأسبوع' },
              { id: 'month', label: 'الشهر الحالي' },
              { id: 'all', label: 'كافة الفترات' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
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
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
            title="تصدير تقرير CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">تصدير CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer"
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
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي الإيرادات التعاقدية</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">${totalRevenue.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-400 font-semibold">المحصّل فعلياً: ${totalCollected.toLocaleString()}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>المبالغ المتبقية بذمة المستأجرين</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">${totalOutstanding.toLocaleString()}</div>
          <div className="text-[11px] text-slate-400">تستحق عند تسليم السيارات</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>نسبة إشغال أسطول السيارات</span>
            <Car className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">{utilizationRate}%</div>
          <div className="text-[11px] text-slate-400">{rentedVehiclesCount} سيارة مؤجرة من أصل {safeVehicles.length}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>عدد العمليات النشطة</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono">{filteredBookings.length}</div>
          <div className="text-[11px] text-slate-400">حجوزات خلال الفترة المحددة</div>
        </div>
      </div>

      {/* RECHARTS INTERACTIVE VISUALIZATIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Revenue Over Time (Area Chart) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>المسار الزمني للإيرادات والمقبوضات ($)</span>
            </h4>
            <span className="text-[11px] text-slate-400">مخطط بياني تفاعلي</span>
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
                  formatter={(value: any, name: any) => [
                    `$${Number(value).toLocaleString()}`,
                    name === 'revenue' ? 'الإيراد الإجمالي' : 'المحصل فعلياً',
                  ]}
                />
                <Legend
                  formatter={(value) => (value === 'revenue' ? 'الإيراد الإجمالي' : 'المحصل فعلياً')}
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
              <span>حالة وجاهزية الأسطول</span>
            </h4>
            <span className="text-[11px] text-slate-400">{safeVehicles.length} مركبة</span>
          </div>

          <div className="h-52 w-full flex items-center justify-center" dir="ltr">
            {fleetPieData.length > 0 ? (
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
                    }}
                    formatter={(val: any) => [`${val} سيارة`, 'العدد']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">لا توجد سيارات مسجلة</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
            <div>
              <span className="text-[10px] text-emerald-400 block font-semibold">● متاحة</span>
              <span className="text-sm font-bold font-mono text-white">{availableVehiclesCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-blue-400 block font-semibold">● مؤجرة</span>
              <span className="text-sm font-bold font-mono text-white">{rentedVehiclesCount}</span>
            </div>
            <div>
              <span className="text-[10px] text-rose-400 block font-semibold">● صيانة</span>
              <span className="text-sm font-bold font-mono text-white">{maintenanceVehiclesCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart 3: Revenue by Vehicle Category (Bar Chart) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Car className="w-4 h-4 text-blue-400" />
            <span>توزيع الإيرادات حسب فئة المركبة ($)</span>
          </h4>
          <span className="text-[11px] text-slate-400">مقارنة فئات الأسطول</span>
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
                formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'الإيرادات']}
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
        <div className="p-4 bg-slate-950 border-b border-slate-800 font-bold text-sm text-white flex items-center justify-between">
          <span>سجل الحجوزات للفترة المحددة ({filteredBookings.length} عملية)</span>
          <span className="text-xs text-slate-400 font-normal">مرتبة حسب تاريخ الإنشاء</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
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
                  <td className="p-3 font-mono font-bold text-amber-400">{b.bookingNumber}</td>
                  <td className="p-3 font-medium text-white">{b.customerName}</td>
                  <td className="p-3 text-slate-300">{b.vehicleName}</td>
                  <td className="p-3 text-slate-400 font-mono">{b.pickupDate} إلى {b.returnDate}</td>
                  <td className="p-3 text-slate-300">{b.rentalDays} أيام</td>
                  <td className="p-3 font-bold text-white font-mono">${b.totalPrice}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                      {b.status}
                    </span>
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
