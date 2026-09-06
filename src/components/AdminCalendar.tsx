import React, { useState, useMemo } from 'react';
import { Vehicle, Booking, MaintenanceRecord } from '../types';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Info,
  Car,
  CheckCircle2,
  Wrench
} from 'lucide-react';

interface AdminCalendarProps {
  vehicles?: Vehicle[];
  bookings?: Booking[];
  maintenanceRecords?: MaintenanceRecord[];
  onSelectBooking: (booking: Booking) => void;
}

export const AdminCalendar: React.FC<AdminCalendarProps> = ({
  vehicles = [],
  bookings = [],
  maintenanceRecords = [],
  onSelectBooking,
}) => {
  const safeVehicles = vehicles || [];
  const safeBookings = bookings || [];
  const safeMaintenance = maintenanceRecords || [];
  // Current month state
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 8, 1)); // September 2026

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Days in month
  const daysInMonth = useMemo(() => {
    const days = [];
    const total = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= total; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dayNumber: i, dateStr });
    }
    return days;
  }, [year, month]);

  const monthName = currentDate.toLocaleDateString('ar-SY', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getStatusForVehicleOnDate = (vehicle: Vehicle, dateStr: string) => {
    // 1. Maintenance Check
    if (vehicle.status === 'maintenance') {
      return { status: 'maintenance', label: 'صيانة' };
    }

    // 2. Active Bookings Check
    const activeBooking = safeBookings.find((b) => {
      if (b.vehicleId !== vehicle.id) return false;
      if (['cancelled', 'rejected'].includes(b.status)) return false;
      return dateStr >= b.pickupDate && dateStr <= b.returnDate;
    });

    if (activeBooking) {
      if (activeBooking.status === 'rented') {
        return { status: 'rented', label: 'مؤجرة', booking: activeBooking };
      }
      return { status: 'confirmed', label: 'مؤكد', booking: activeBooking };
    }

    return { status: 'free', label: 'متاحة' };
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Calendar Header & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">التقويم التفاعلي لحجوزات الأسطول</h3>
            <span className="text-xs text-slate-400">
              متابعة تواريخ الإشغال، الصيانة، والسيارات المتاحة لكل يوم
            </span>
          </div>
        </div>

        {/* Month Selector & Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <button
              onClick={prevMonth}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white px-2">{monthName}</span>
            <button
              onClick={nextMonth}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Color Code Legend (Section 20) */}
          <div className="hidden lg:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span className="text-slate-300">مؤكد (Green)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-slate-300">مؤجرة حالياً (Blue)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-slate-300">صيانة (Orange)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-slate-800 border border-slate-700"></span>
              <span className="text-slate-400">متاحة (Free)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Matrix Table with Horizontal Scroll */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 pb-2">
        <table className="w-full text-xs text-right border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <th className="p-3 sticky right-0 bg-slate-950 z-20 w-44 font-bold border-l border-slate-800">
                السيارة / اليوم
              </th>
              {daysInMonth.map((d) => (
                <th key={d.dateStr} className="p-1.5 text-center font-mono w-9 border-l border-slate-800/60">
                  <span className="block text-[10px] text-slate-500 font-sans">
                    {new Date(d.dateStr).toLocaleDateString('ar-SY', { weekday: 'narrow' })}
                  </span>
                  <span className="font-bold text-slate-300">{d.dayNumber}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {safeVehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-2.5 sticky right-0 bg-slate-900 border-l border-slate-800 z-10">
                  <div className="font-bold text-white truncate text-xs">
                    {vehicle.brand} {vehicle.model}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {vehicle.plateNumber} • ${vehicle.dailyPrice}/يوم
                  </div>
                </td>

                {daysInMonth.map((d) => {
                  const info = getStatusForVehicleOnDate(vehicle, d.dateStr);
                  let cellClasses = 'bg-slate-950/40 text-slate-600';
                  let title = 'متاحة للحجز';

                  if (info.status === 'confirmed') {
                    cellClasses = 'bg-emerald-600 text-white font-bold cursor-pointer hover:bg-emerald-500 shadow-sm';
                    title = `حجز مؤكد: ${info.booking?.customerName} (${info.booking?.bookingNumber})`;
                  } else if (info.status === 'rented') {
                    cellClasses = 'bg-blue-600 text-white font-bold cursor-pointer hover:bg-blue-500 shadow-sm';
                    title = `مؤجرة حالياً للعميل: ${info.booking?.customerName}`;
                  } else if (info.status === 'maintenance') {
                    cellClasses = 'bg-amber-600 text-slate-950 font-black';
                    title = 'السيارة في الصيانة الدورية';
                  }

                  return (
                    <td
                      key={d.dateStr}
                      title={title}
                      onClick={() => {
                        if (info.booking) onSelectBooking(info.booking);
                      }}
                      className={`p-1 text-center border-l border-slate-800/50 transition-all ${cellClasses}`}
                    >
                      <div className="h-7 w-full flex items-center justify-center rounded text-[9px]">
                        {info.status === 'confirmed' ? '✓' : info.status === 'rented' ? '●' : info.status === 'maintenance' ? '🔧' : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
