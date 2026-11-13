import React, { useState, useMemo, useEffect } from 'react';
import { Vehicle, VehicleStatus, Booking } from '../../types';
import { dataService } from '../../services/dataService';
import { useLocation } from '../../router';
import { EmptyState } from '../common/EmptyState';
import { ADMIN_TAB_LABEL } from '../../constants/adminNav';
import { FleetStats } from './fleet/FleetStats';
import { FleetToolbar, FleetSortOption } from './fleet/FleetToolbar';
import { VehicleCard } from './fleet/VehicleCard';
import { VehicleTableRow } from './fleet/VehicleTableRow';
import { calculateOilChange } from '../../utils/oilChange';
import { Car, Plus, CheckCircle2 } from 'lucide-react';

interface AdminVehiclesProps {
  vehicles: Vehicle[];
  bookings?: Booking[];
  onRefreshData: () => void;
  onOpenAddVehicle: () => void;
  onOpenEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicle: Vehicle) => void;
}

export const AdminVehicles: React.FC<AdminVehiclesProps> = ({
  vehicles,
  onRefreshData,
  onOpenAddVehicle,
  onOpenEditVehicle,
  onDeleteVehicle,
}) => {
  const { pathname: currentPath, search: currentSearch } = useLocation();

  // Parse filters from URL Query Params
  const searchParams = useMemo(() => new URLSearchParams(currentSearch), [currentSearch]);
  const initialStatus = searchParams.get('status') || (searchParams.get('oil') === 'due' ? 'oil_due' : 'all');
  const initialCat = searchParams.get('cat') || 'all';
  const initialQ = searchParams.get('q') || '';
  const initialView = (searchParams.get('view') as 'grid' | 'table') || 'grid';
  const initialSort = (searchParams.get('sort') as FleetSortOption) || 'year-desc';

  const [filterCategory, setFilterCategory] = useState<string>(initialCat);
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);
  const [searchQuery, setSearchQuery] = useState<string>(initialQ);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(initialView);
  const [sortBy, setSortBy] = useState<FleetSortOption>(initialSort);
  const [visibleCount, setVisibleCount] = useState<number>(24);

  const [updatingVehicleId, setUpdatingVehicleId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Sync URL query params into state if navigated from AdminOverview
  useEffect(() => {
    const statusParam = searchParams.get('status') || (searchParams.get('oil') === 'due' ? 'oil_due' : null);
    if (statusParam && statusParam !== filterStatus) {
      setFilterStatus(statusParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSearch]);

  // Sync state to URL Query String
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (filterCategory !== 'all') params.set('cat', filterCategory);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (viewMode !== 'grid') params.set('view', viewMode);
    if (sortBy !== 'year-desc') params.set('sort', sortBy);

    const newQuery = params.toString();
    const newUrl = `${currentPath}${newQuery ? `?${newQuery}` : ''}`;
    if (newUrl !== `${currentPath}${currentSearch}`) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [filterStatus, filterCategory, searchQuery, viewMode, sortBy, currentPath, currentSearch]);

  const handleQuickStatusChange = async (vehicleId: string, newStatus: VehicleStatus) => {
    try {
      setUpdatingVehicleId(vehicleId);
      setStatusFeedback(null);
      await dataService.updateVehicle(vehicleId, { status: newStatus });
      onRefreshData();
      setStatusFeedback('تم تحديث حالة السيارة بنجاح.');
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err: unknown) {
      console.error('Quick vehicle status error:', err);
      setStatusFeedback(`فشل تعديل حالة السيارة: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`);
    } finally {
      setUpdatingVehicleId(null);
    }
  };

  const handleStatusChangeRequest = (vehicle: Vehicle, newStatus: VehicleStatus) => {
    handleQuickStatusChange(vehicle.id, newStatus);
  };

  const handleRecordOilChange = async (vehicle: Vehicle) => {
    try {
      setUpdatingVehicleId(vehicle.id);
      setStatusFeedback(null);
      const currentMileage = vehicle.currentMileage || 0;
      await dataService.recordVehicleOilChange(vehicle.id, currentMileage);
      onRefreshData();
      setStatusFeedback(`تم تسجيل تغيير زيت السيارة (${vehicle.brand} ${vehicle.model}) عند العداد ${currentMileage} كم.`);
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err: unknown) {
      console.error('Record oil change error:', err);
      setStatusFeedback(`تعذر تسجيل تغيير الزيت: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`);
    } finally {
      setUpdatingVehicleId(null);
    }
  };

  // Filter & Sort vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter((v) => {
        if (filterCategory !== 'all' && v.category !== filterCategory) return false;
        if (filterStatus === 'oil_due') {
          if (!calculateOilChange(v).needsAttention) return false;
        } else if (filterStatus !== 'all') {
          const vStatus = v.storedStatus || v.status;
          if (vStatus !== filterStatus) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchBrand = (v.brand || '').toLowerCase().includes(q);
          const matchModel = (v.model || '').toLowerCase().includes(q);
          const matchPlate = (v.plateNumber || '').toLowerCase().includes(q);
          return matchBrand || matchModel || matchPlate;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'price-asc':
            return a.dailyPrice - b.dailyPrice;
          case 'price-desc':
            return b.dailyPrice - a.dailyPrice;
          case 'brand-asc':
            return a.brand.localeCompare(b.brand, 'ar');
          case 'mileage-desc':
            return (b.currentMileage || 0) - (a.currentMileage || 0);
          case 'year-desc':
          default:
            return b.year - a.year;
        }
      });
  }, [vehicles, filterCategory, filterStatus, searchQuery, sortBy]);

  const visibleVehicles = useMemo(() => {
    return filteredVehicles.slice(0, visibleCount);
  }, [filteredVehicles, visibleCount]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
              <Car className="w-6 h-6 text-amber-400" />
              <span>{ADMIN_TAB_LABEL.vehicles}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              إدارة بيانات الأسطول ومتابعة تغيير الزيت وحالة السيارات
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenAddVehicle}
              className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سيارة جديدة</span>
            </button>
          </div>
        </div>

        {statusFeedback && (
          <div className="p-3.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusFeedback}</span>
          </div>
        )}

        {/* Quick Status Filter Buttons */}
        <FleetStats
          vehicles={vehicles}
          activeStatusFilter={filterStatus}
          onSelectStatus={setFilterStatus}
        />
      </div>

      {/* Filter & Toolbar */}
      <FleetToolbar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setVisibleCount(24);
        }}
        statusFilter={filterStatus}
        onStatusChange={(st) => {
          setFilterStatus(st);
          setVisibleCount(24);
        }}
        categoryFilter={filterCategory}
        onCategoryChange={(cat) => {
          setFilterCategory(cat);
          setVisibleCount(24);
        }}
        sortBy={sortBy}
        onSortChange={(sort) => {
          setSortBy(sort);
          setVisibleCount(24);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Fleet Grid / Table View */}
      {filteredVehicles.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-xl">
          <EmptyState
            icon={Car}
            title="لا توجد سيارات مطابقة لمعايير البحث أو الفلتر"
            description="جرب تعديل خيارات البحث أو مسح الفلاتر لاستعراض سيارات أسطول شركة شاكر."
            actionLabel="إضافة سيارة جديدة"
            onAction={onOpenAddVehicle}
          />
        </div>
      ) : (
        <>
          {/* Mobile forces cards (< 768px). Desktop respects viewMode */}
          <div className="block md:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {visibleVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  onOpenEdit={onOpenEditVehicle}
                  onDelete={onDeleteVehicle}
                  onRecordOilChange={handleRecordOilChange}
                  onStatusChangeRequest={handleStatusChangeRequest}
                  isUpdatingStatus={updatingVehicleId === v.id}
                />
              ))}
            </div>
          </div>

          <div className="hidden md:block">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleVehicles.map((v) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    onOpenEdit={onOpenEditVehicle}
                    onDelete={onDeleteVehicle}
                    onRecordOilChange={handleRecordOilChange}
                    onStatusChangeRequest={handleStatusChangeRequest}
                    isUpdatingStatus={updatingVehicleId === v.id}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-950/90 text-slate-400 text-xs font-bold border-b border-slate-800">
                        <th className="p-3.5 sticky right-0 bg-slate-950/90 z-20">السيارة</th>
                        <th className="p-3.5">الفئة</th>
                        <th className="p-3.5">الحالة</th>
                        <th className="p-3.5">حالة الزيت</th>
                        <th className="p-3.5">السعر/يوم</th>
                        <th className="p-3.5">العداد</th>
                        <th className="p-3.5 text-left">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {visibleVehicles.map((v) => (
                        <VehicleTableRow
                          key={v.id}
                          vehicle={v}
                          onOpenEdit={onOpenEditVehicle}
                          onDelete={onDeleteVehicle}
                          onRecordOilChange={handleRecordOilChange}
                          onStatusChangeRequest={handleStatusChangeRequest}
                          isUpdatingStatus={updatingVehicleId === v.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Pagination / Show More */}
          {visibleCount < filteredVehicles.length && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 24)}
                className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
              >
                عرض المزيد ({filteredVehicles.length - visibleCount} متبقية)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
