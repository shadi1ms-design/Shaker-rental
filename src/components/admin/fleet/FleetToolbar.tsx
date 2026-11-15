import React from 'react';
import { SearchInput } from '../../common/SearchInput';
import { VEHICLE_CATEGORY_LABELS } from '../../../constants/vehicleCategories';
import { VEHICLE_STATUS_META } from '../../../constants/statusMeta';
import { LayoutGrid, List, ArrowUpDown } from 'lucide-react';

export type FleetSortOption = 'year-desc' | 'price-asc' | 'price-desc' | 'brand-asc' | 'mileage-desc';

interface FleetToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  categoryFilter: string;
  onCategoryChange: (cat: string) => void;
  sortBy: FleetSortOption;
  onSortChange: (sort: FleetSortOption) => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
}

export const FleetToolbar: React.FC<FleetToolbarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xl">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
        {/* Search Input */}
        <div className="w-full lg:w-80">
          <SearchInput
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="بحث بالشركة، الطراز، أو رقم اللوحة..."
            className="w-full"
          />
        </div>

        {/* Filters & Controls Group */}
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-base sm:text-sm font-bold text-slate-200 focus:outline-none focus:border-amber-500 min-h-11 cursor-pointer"
            aria-label="تصفية حسب الحالة"
          >
            <option value="all">كافة الحالات</option>
            <option value="available">{VEHICLE_STATUS_META.available.label}</option>
            <option value="reserved">{VEHICLE_STATUS_META.reserved.label}</option>
            <option value="rented">{VEHICLE_STATUS_META.rented.label}</option>
            <option value="maintenance">{VEHICLE_STATUS_META.maintenance.label}</option>
            <option value="oil_due">تحتاج تغيير زيت</option>
            <option value="inactive">{VEHICLE_STATUS_META.inactive.label}</option>
          </select>

          {/* Category Select */}
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-base sm:text-sm font-bold text-slate-200 focus:outline-none focus:border-amber-500 min-h-11 cursor-pointer"
            aria-label="تصفية حسب الفئة"
          >
            <option value="all">كافة الفئات</option>
            <option value="light">{VEHICLE_CATEGORY_LABELS.light}</option>
            <option value="medium">{VEHICLE_CATEGORY_LABELS.medium}</option>
            <option value="jeep_7seats">{VEHICLE_CATEGORY_LABELS.jeep_7seats}</option>
          </select>

          {/* Sort Select */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 min-h-11">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as FleetSortOption)}
              className="bg-transparent text-base sm:text-sm font-bold text-slate-200 focus:outline-none cursor-pointer"
              aria-label="الترتيب حسب"
            >
              <option value="year-desc" className="bg-slate-900">الأحدث (سنة الصنع)</option>
              <option value="price-asc" className="bg-slate-900">السعر: من الأقل للأعلى</option>
              <option value="price-desc" className="bg-slate-900">السعر: من الأعلى للأقل</option>
              <option value="brand-asc" className="bg-slate-900">اسم الشركة (أبجدي)</option>
              <option value="mileage-desc" className="bg-slate-900">العداد: الأعلى أولاً</option>
            </select>
          </div>

          {/* View Mode Toggle Button Group */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 min-h-11">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-2 rounded-lg transition-colors cursor-pointer min-h-11 min-w-11 flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض كبطاقات"
              aria-label="عرض كبطاقات"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`p-2 rounded-lg transition-colors cursor-pointer min-h-11 min-w-11 flex items-center justify-center ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض كجدول"
              aria-label="عرض كجدول"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
