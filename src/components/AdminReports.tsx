import React, { useState, useMemo } from 'react';
import { Vehicle, Booking } from '../types';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  TrendingUp,
  DollarSign,
  PieChart,
  Car,
  Clock
} from 'lucide-react';

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
  }, [bookings, period]);

  // Aggregate stats
  const totalRevenue = useMemo(() => {
    return filteredBookings.reduce((acc, b) => acc + (b.totalPrice || 0), 0);
  }, [filteredBookings]);

  const totalCollected = useMemo(() => {
    return filteredBookings.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  }, [filteredBookings]);

  const totalOutstanding = useMemo(() => {
    return Math.max(0, totalRevenue - totalCollected);
  }, [totalRevenue, totalCollected]);

  // Fleet utilization
  const rentedVehiclesCount = safeVehicles.filter((v) => v.status === 'rented').length;
  const utilizationRate = safeVehicles.length > 0 ? Math.round((rentedVehiclesCount / safeVehicles.length) * 100) : 0;

  // Category breakdown
  const categoryRevenue = useMemo(() => {
    const map: Record<string, number> = { light: 0, medium: 0, jeep_7seats: 0 };
    filteredBookings.forEach((b) => {
      const cat = b.vehicleCategory || 'medium';
      map[cat] = (map[cat] || 0) + b.totalPrice;
    });
    return map;
  }, [filteredBookings]);

  /**
   * Sanitizes cell content for CSV export against CSV Formula Injection (CWE-1236)
   * Prepends a single quote if the value begins with =, +, -, @, \t, or \r
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
    const headers = ['رقم الحجز', 'العميل', 'السيارة', 'تاريخ الاستلام', 'تاريخ الإعادة', 'المدة', 'المبلغ', 'المسدد', 'المتبقي', 'الحالة'];
    const rows = filteredBookings.map((b) => [
      sanitizeCSVCell(b.bookingNumber),
      sanitizeCSVCell(b.customerName),
      sanitizeCSVCell(b.vehicleName),
      sanitizeCSVCell(b.pickupDate),
      sanitizeCSVCell(b.returnDate),
      sanitizeCSVCell(b.rentalDays),
      sanitizeCSVCell(b.totalPrice),
      sanitizeCSVCell(b.paidAmount || 0),
      sanitizeCSVCell(b.remainingAmount || 0),
      sanitizeCSVCell(b.status),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.map(sanitizeCSVCell).join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shaker_rentals_report_${period}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            التقارير المالية والتشغيلية للأسطول
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            متابعة الإيرادات، ديون العملاء، نسبة إشغال الأسطول، وتكاليف الصيانة
          </p>
        </div>

        <div className="flex items-center gap-3">
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
                onClick={() => setPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  period === p.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
            title="تصدير CSV"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">تصدير CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
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
          <div className="text-2xl font-black text-white font-mono">${totalRevenue}</div>
          <div className="text-[11px] text-emerald-400 font-semibold">المحصّل فعلياً: ${totalCollected}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>المبالغ المتبقية بذمة المستأجرين</span>
            <Clock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono">${totalOutstanding}</div>
          <div className="text-[11px] text-slate-400">تستحق عند تسليم السيارات</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>نسبة إشغال أسطول السيارات</span>
            <Car className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">{utilizationRate}%</div>
          <div className="text-[11px] text-slate-400">{rentedVehiclesCount} سيارة مؤجرة من أصل {vehicles.length}</div>
        </div>
      </div>

      {/* Revenue Breakdown by Category */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs text-slate-400 block mb-1">فئة السيدان الاقتصادي (Light)</span>
          <div className="text-xl font-bold text-white">${categoryRevenue.light}</div>
          <p className="text-[11px] text-slate-500 mt-2">كيا سبيكترا، كيا فورتي</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs text-slate-400 block mb-1">فئة السيدان المتوسط (Medium)</span>
          <div className="text-xl font-bold text-white">${categoryRevenue.medium}</div>
          <p className="text-[11px] text-slate-500 mt-2">أوبتيما، سوناتا، أزيرا، إلنترا، BYD</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <span className="text-xs text-slate-400 block mb-1">فئة جيب 7 ركاب (Jeep/SUV)</span>
          <div className="text-xl font-bold text-white">${categoryRevenue.jeep_7seats}</div>
          <p className="text-[11px] text-slate-500 mt-2">كيا سورينتو، هيونداي فيراكروز</p>
        </div>
      </div>

      {/* Detailed Bookings Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 font-bold text-sm text-white">
          سجل الحجوزات للفترة المحددة ({filteredBookings.length} عملية)
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
                <th className="p-3">الإجمالي</th>
                <th className="p-3">المسدد</th>
                <th className="p-3">المتبقي</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredBookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-amber-400">{b.bookingNumber}</td>
                  <td className="p-3 font-medium text-white">{b.customerName}</td>
                  <td className="p-3 text-slate-300">{b.vehicleName}</td>
                  <td className="p-3 text-slate-400">{b.pickupDate} إلى {b.returnDate}</td>
                  <td className="p-3 text-slate-300">{b.rentalDays} أيام</td>
                  <td className="p-3 font-bold text-white font-mono">${b.totalPrice}</td>
                  <td className="p-3 font-semibold text-emerald-400 font-mono">${b.paidAmount || 0}</td>
                  <td className="p-3 font-semibold text-rose-400 font-mono">${b.remainingAmount ?? (b.totalPrice - (b.paidAmount || 0))}</td>
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
