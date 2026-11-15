import React from 'react';
import { BookingStatus } from '../../../types';
import { DateField } from '../../ui/DateField';
import { Search, Download } from 'lucide-react';

export interface BookingsFilterBarProps {
  bookingStatusFilter: BookingStatus | 'all';
  onStatusFilterChange: (status: BookingStatus | 'all') => void;
  bookingSearch: string;
  onSearchChange: (val: string) => void;
  dateRangeFrom: string;
  onDateFromChange: (val: string) => void;
  dateRangeTo: string;
  onDateToChange: (val: string) => void;
  onClearDates: () => void;
  onExportCSV: () => void;
  statusCounts: {
    all: number;
    new: number;
    confirmed: number;
    rented: number;
    completed: number;
    rejected: number;
  };
}

export const BookingsFilterBar: React.FC<BookingsFilterBarProps> = ({
  bookingStatusFilter,
  onStatusFilterChange,
  bookingSearch,
  onSearchChange,
  dateRangeFrom,
  onDateFromChange,
  dateRangeTo,
  onDateToChange,
  onClearDates,
  onExportCSV,
  statusCounts,
}) => {
  const tabs: { key: BookingStatus | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'الكل', count: statusCounts.all },
    { key: 'new', label: 'جديدة', count: statusCounts.new },
    { key: 'confirmed', label: 'مؤكدة', count: statusCounts.confirmed },
    { key: 'rented', label: 'جاري التأجير', count: statusCounts.rented },
    { key: 'completed', label: 'مكتملة', count: statusCounts.completed },
    { key: 'rejected', label: 'مرفوضة/ملغاة', count: statusCounts.rejected },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-brand-surface border border-brand-border p-card rounded-card shadow-card">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onStatusFilterChange(tab.key)}
              className={`min-h-11 px-3.5 py-2 rounded-card text-sm font-bold transition-all cursor-pointer ${
                bookingStatusFilter === tab.key
                  ? 'bg-brand-gold text-brand-obsidian font-extrabold shadow-gold'
                  : 'bg-brand-elevated text-brand-text hover:bg-brand-border'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-brand-muted absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              aria-label="بحث بالاسم، الهاتف، أو السيارة"
              value={bookingSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="بحث بالاسم، الهاتف، السيارة..."
              className="w-full min-h-11 bg-brand-obsidian border border-brand-border rounded-card ps-9 pe-3 py-2 text-base sm:text-sm text-brand-text placeholder:text-slate-400 focus:outline-none focus:border-brand-gold"
            />
          </div>
          <button
            type="button"
            onClick={onExportCSV}
            className="min-h-11 px-3.5 py-2 rounded-card bg-brand-elevated hover:bg-brand-border text-brand-text text-sm font-bold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors border border-brand-border"
            title="تصدير الحجوزات CSV"
          >
            <Download className="w-4 h-4 text-brand-gold-light" />
            <span className="hidden sm:inline">تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-brand-surface border border-brand-border px-4 py-2.5 rounded-card text-sm">
        <span className="text-brand-text font-bold">تصفية حسب تاريخ الاستلام:</span>
        <div className="flex items-center gap-2">
          <label htmlFor="admin-bookings-date-from" className="text-brand-muted text-sm">
            من:
          </label>
          <DateField
            id="admin-bookings-date-from"
            size="sm"
            value={dateRangeFrom}
            onChange={(next) => {
              onDateFromChange(next);
              if (next && dateRangeTo && dateRangeTo < next) onDateToChange(next);
            }}
            ariaLabel="تاريخ الاستلام من"
            className="min-w-[145px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="admin-bookings-date-to" className="text-brand-muted text-sm">
            إلى:
          </label>
          <DateField
            id="admin-bookings-date-to"
            size="sm"
            value={dateRangeTo}
            onChange={onDateToChange}
            min={dateRangeFrom || undefined}
            ariaLabel="تاريخ الاستلام إلى"
            className="min-w-[145px]"
          />
        </div>
        {(dateRangeFrom || dateRangeTo) && (
          <button
            type="button"
            onClick={onClearDates}
            className="min-h-11 px-3 inline-flex items-center text-status-danger hover:underline font-semibold text-sm cursor-pointer"
          >
            مسح التواريخ
          </button>
        )}
      </div>
    </div>
  );
};
