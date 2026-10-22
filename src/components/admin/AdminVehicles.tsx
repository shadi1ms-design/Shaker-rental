import React, { useState } from 'react';
import { Vehicle, VehicleStatus, Booking } from '../../types';
import { VEHICLE_CATEGORY_LABELS, getVehicleCategoryLabel } from '../../constants/vehicleCategories';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../contexts/AuthContext';
import {
  Car,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Trash2,
  ClipboardCheck,
  X,
  Gauge,
  Image as ImageIcon,
  LayoutGrid,
  List
} from 'lucide-react';

interface AdminVehiclesProps {
  vehicles: Vehicle[];
  bookings?: Booking[];
  onRefreshData: () => void;
  onOpenAddVehicle: () => void;
  onOpenEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicle: Vehicle) => void;
  onOpenInspection: (vehicle: Vehicle) => void;
  isSyncing: boolean;
  onSyncWithFirestore: () => Promise<void>;
  syncStatus: { message: string; success: boolean } | null;
}

export const AdminVehicles: React.FC<AdminVehiclesProps> = ({
  vehicles,
  bookings = [],
  onRefreshData,
  onOpenAddVehicle,
  onOpenEditVehicle,
  onDeleteVehicle,
  onOpenInspection,
  isSyncing,
  onSyncWithFirestore,
  syncStatus,
}) => {
  const { isAdmin } = useAuth();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [updatingVehicleId, setUpdatingVehicleId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Maintenance Warning Modal state
  const [maintenanceWarning, setMaintenanceWarning] = useState<{
    vehicle: Vehicle;
    upcomingBookings: Booking[];
  } | null>(null);

  const handleQuickStatusChange = async (vehicleId: string, newStatus: VehicleStatus) => {
    try {
      setUpdatingVehicleId(vehicleId);
      setStatusFeedback(null);
      await dataService.updateVehicle(vehicleId, { status: newStatus });
      onRefreshData();
      const label = newStatus === 'rented' ? 'مؤجرة' : newStatus === 'available' ? 'متوفرة' : 'قيد الصيانة';
      setStatusFeedback(`تم تغيير حالة السيارة بنجاح إلى (${label}) وتحديث السحابة.`);
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err: unknown) {
      console.error('Quick vehicle status error:', err);
      setStatusFeedback(`فشل تعديل حالة السيارة: ${err instanceof Error ? err.message : 'خطأ غير متوقع'}`);
    } finally {
      setUpdatingVehicleId(null);
    }
  };

  const handleStatusChangeRequest = (vehicle: Vehicle, newStatus: VehicleStatus) => {
    if (newStatus === 'maintenance') {
      const activeBookings = bookings.filter(
        (b) =>
          b.vehicleId === vehicle.id &&
          !b.isDeleted &&
          (b.status === 'confirmed' || b.status === 'new' || b.status === 'reviewing' || b.status === 'rented')
      );
      if (activeBookings.length > 0) {
        setMaintenanceWarning({
          vehicle,
          upcomingBookings: activeBookings,
        });
        return;
      }
    }
    handleQuickStatusChange(vehicle.id, newStatus);
  };

  const confirmMaintenanceSwitch = async () => {
    if (!maintenanceWarning) return;
    const vId = maintenanceWarning.vehicle.id;
    setMaintenanceWarning(null);
    await handleQuickStatusChange(vId, 'maintenance');
  };


  const getOilBadge = (v: Vehicle) => {
    return (
      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[11px] font-bold">
        منتظم ({v.currentMileage?.toLocaleString()} كم)
      </span>
    );
  };

  const filteredVehicles = vehicles.filter((v) => {
    if (filterCategory !== 'all' && v.category !== filterCategory) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBrand = (v.brand || '').toLowerCase().includes(q);
      const matchModel = (v.model || '').toLowerCase().includes(q);
      const matchPlate = (v.plateNumber || '').toLowerCase().includes(q);
      return matchBrand || matchModel || matchPlate;
    }
    return true;
  });

  const availableCount = vehicles.filter((v) => v.status === 'available').length;
  const rentedCount = vehicles.filter((v) => v.status === 'rented').length;
  const maintCount = vehicles.filter((v) => v.status === 'maintenance').length;

  return (
    <div className="space-y-6">
      {/* Header & Fleet Sync */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-amber-400" />
              <span>أسطول سيارات شاكر</span>
              <span className="text-xs font-mono font-bold bg-amber-500/15 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                قاعدة بيانات سحابية متصلة
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              إدارة بيانات الأسطول، متابعة جاهزية السيارات وتغيير الحالات فورياً في Firestore
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={onSyncWithFirestore}
              disabled={isSyncing}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              title="التحقق من تخزين كافة السيارات في قاعدة بيانات Firestore ومزامنة الحالات"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة الأسطول'}</span>
            </button>

            <button
              onClick={onOpenAddVehicle}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سيارة جديدة</span>
            </button>
          </div>
        </div>

        {/* Sync Alert Banner */}
        {syncStatus && (
          <div
            className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border animate-in fade-in ${
              syncStatus.success
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{syncStatus.message}</span>
          </div>
        )}

        {statusFeedback && (
          <div className="p-3 rounded-2xl text-xs font-bold flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-300 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{statusFeedback}</span>
          </div>
        )}

        {/* Quick Fleet Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[11px] text-slate-400">إجمالي الأسطول</div>
            <div className="text-lg font-black text-white font-mono">{vehicles.length} سيارة</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[11px] text-emerald-400">متاحة للتأجير</div>
            <div className="text-lg font-black text-emerald-400 font-mono">{availableCount} سيارة</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[11px] text-blue-400">مؤجرة حالياً</div>
            <div className="text-lg font-black text-blue-400 font-mono">{rentedCount} سيارة</div>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl">
            <div className="text-[11px] text-amber-400">قيد الصيانة والفحص</div>
            <div className="text-lg font-black text-amber-400 font-mono">{maintCount} سيارة</div>
          </div>
        </div>
      </div>

      {/* Filter, Search & View Mode Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'كافة الحالات' },
              { id: 'available', label: 'متوفرة' },
              { id: 'rented', label: 'مؤجرة' },
              { id: 'maintenance', label: 'صيانة' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setFilterStatus(st.id)}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterStatus === st.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'all', label: 'كافة الفئات' },
              { id: 'light', label: VEHICLE_CATEGORY_LABELS.light },
              { id: 'medium', label: VEHICLE_CATEGORY_LABELS.medium },
              { id: 'jeep_7seats', label: VEHICLE_CATEGORY_LABELS.jeep_7seats },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filterCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search & View Mode Switch */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالماركة، الموديل، أو اللوحة..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 pl-9 pr-9 text-xs text-white focus:outline-none focus:border-amber-500 placeholder-slate-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="مسح نص البحث"
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grid vs Table View Mode Switch */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="عرض كروت شبكية"
              className={`p-2 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                viewMode === 'grid'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض كروت شبكية"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="عرض جدول تفصيلي"
              className={`p-2 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="عرض جدول تفصيلي"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Fleet Display */}
      {filteredVehicles.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-xs text-slate-400 space-y-3">
          <Car className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="font-bold text-sm text-slate-300">لا توجد سيارات مطابقة لمعايير البحث أو الفلتر</p>
          <button
            onClick={() => {
              setFilterCategory('all');
              setFilterStatus('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold cursor-pointer"
          >
            إعادة ضبط الفلاتر
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((v) => {
            const isUpdating = updatingVehicleId === v.id;

            return (
              <div
                key={v.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden flex flex-col justify-between shadow-lg transition-all"
              >
                <div>
                  <div className="relative h-44 bg-slate-950">
                    <img
                      src={v.imageUrl || (v.images && v.images[0]) || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80'}
                      alt={v.model}
                      width={400}
                      height={176}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-xs font-bold text-amber-400 border border-amber-500/30">
                      {getVehicleCategoryLabel(v.category)}
                    </div>

                    {v.images && v.images.length > 1 && (
                      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-md text-xs text-slate-300 border border-slate-700/60 flex items-center gap-1 shadow-md">
                        <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                        <span>{v.images.length} صور</span>
                      </div>
                    )}

                    {/* Interactive Live Status Selector */}
                    <div className="absolute top-3 left-3 z-10">
                      <select
                        value={v.status}
                        disabled={isUpdating || isSyncing}
                        onChange={(e) => handleStatusChangeRequest(v, e.target.value as VehicleStatus)}
                        className={`px-3 py-1 rounded-full text-xs font-black cursor-pointer appearance-none outline-none border transition-all shadow-md focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          v.status === 'available'
                            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900'
                            : v.status === 'rented'
                            ? 'bg-blue-950/90 text-blue-300 border-blue-500/50 hover:bg-blue-900'
                            : 'bg-amber-950/90 text-amber-300 border-amber-500/50 hover:bg-amber-900'
                        }`}
                        title="تغيير حالة السيارة وحفظها مباشرة في قاعدة البيانات"
                      >
                        <option value="available" className="bg-slate-900 text-emerald-300">● متوفرة للتأجير</option>
                        <option value="rented" className="bg-slate-900 text-blue-300">● مؤجرة حالياً</option>
                        <option value="maintenance" className="bg-slate-900 text-amber-300">● قيد الصيانة</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs text-slate-400">{v.brand}</span>
                        <h4 className="font-bold text-white text-base">{v.model} ({v.year})</h4>
                        <span className="text-xs text-slate-400 block font-mono">{v.plateNumber}</span>
                      </div>
                      <div className="text-left">
                        <span className="text-xl font-black text-amber-400 font-mono">${v.dailyPrice}</span>
                        <span className="text-xs text-slate-400 block">/ يوم</span>
                      </div>
                    </div>

                    {/* Mileage Stats */}
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs flex justify-between items-center text-slate-400">
                      <span className="flex items-center gap-1">
                        <Gauge className="w-3.5 h-3.5 text-slate-400" />
                        <span>العداد الحالي:</span>
                      </span>
                      <span className="text-white font-mono font-bold">{v.currentMileage.toLocaleString()} كم</span>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenInspection(v)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      title="فحص الهيكل والتسليم"
                    >
                      فحص الهيكل
                    </button>

                    {v.status === 'available' ? (
                      <button
                        type="button"
                        onClick={() => handleStatusChangeRequest(v, 'rented')}
                        disabled={isUpdating || isSyncing}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        title="تغيير الحالة إلى مؤجرة وحفظها في قاعدة البيانات"
                      >
                        تأجير
                      </button>
                    ) : v.status === 'rented' ? (
                      <button
                        type="button"
                        onClick={() => handleStatusChangeRequest(v, 'available')}
                        disabled={isUpdating || isSyncing}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        title="استلام السيارة وإعادتها إلى متوفرة"
                      >
                        استلام (متاحة)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStatusChangeRequest(v, 'available')}
                        disabled={isUpdating || isSyncing}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        title="إنهاء الصيانة وإعادتها إلى متوفرة"
                      >
                        إنهاء الصيانة
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenEditVehicle(v)}
                      aria-label={`تعديل بيانات ${v.brand} ${v.model}`}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      title="تعديل بيانات السيارة"
                    >
                      <Edit3 className="w-4 h-4 text-amber-400" />
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onDeleteVehicle(v)}
                        aria-label={`حذف سيارة ${v.brand} ${v.model}`}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        title="حذف السيارة من الأسطول"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <th className="p-3.5">السيارة</th>
                  <th className="p-3.5">الفئة</th>
                  <th className="p-3.5">رقم اللوحة</th>
                  <th className="p-3.5">السعر اليومي</th>
                  <th className="p-3.5">العداد الحالي</th>
                  <th className="p-3.5">حالة غيار الزيت</th>
                  <th className="p-3.5">الحالة الحالية</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredVehicles.map((v) => {
                  const isUpdating = updatingVehicleId === v.id;
                  return (
                    <tr key={v.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3.5 font-bold text-white">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={v.imageUrl || (v.images && v.images[0]) || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=200&q=80'}
                            alt={v.model}
                            width={40}
                            height={40}
                            loading="lazy"
                            decoding="async"
                            className="w-10 h-10 rounded-xl object-cover border border-slate-800 shrink-0"
                          />
                          <div>
                            <div>{v.brand} {v.model}</div>
                            <span className="text-xs text-slate-400 font-mono">موديل {v.year}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-300 font-medium">
                        {getVehicleCategoryLabel(v.category)}
                      </td>
                      <td className="p-3.5 font-mono text-amber-300 font-bold">
                        {v.plateNumber}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-white">
                        ${v.dailyPrice} <span className="text-xs text-slate-400 font-normal">/يوم</span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {v.currentMileage.toLocaleString()} كم
                      </td>
                      <td className="p-3.5">
                        {getOilBadge(v)}
                      </td>
                      <td className="p-3.5">
                        <select
                          value={v.status}
                          disabled={isUpdating || isSyncing}
                          onChange={(e) => handleStatusChangeRequest(v, e.target.value as VehicleStatus)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-black cursor-pointer appearance-none outline-none border transition-all focus-visible:ring-2 focus-visible:ring-amber-400 ${
                            v.status === 'available'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                              : v.status === 'rented'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                              : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                          }`}
                        >
                          <option value="available" className="bg-slate-900 text-emerald-300">متوفرة</option>
                          <option value="rented" className="bg-slate-900 text-blue-300">مؤجرة</option>
                          <option value="maintenance" className="bg-slate-900 text-amber-300">صيانة</option>
                        </select>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenInspection(v)}
                            aria-label={`فحص هيكل ${v.brand} ${v.model}`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            title="فحص الهيكل"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEditVehicle(v)}
                            aria-label={`تعديل بيانات ${v.brand} ${v.model}`}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            title="تعديل بيانات السيارة"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => onDeleteVehicle(v)}
                              aria-label={`حذف سيارة ${v.brand} ${v.model}`}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              title="حذف السيارة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance Warning Modal (If upcoming booking exists) */}
      {maintenanceWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">تنبيه: توجد حجوزات جارية أو قادمة لهذه السيارة</h3>
                <span className="text-xs text-slate-400">{maintenanceWarning.vehicle.brand} {maintenanceWarning.vehicle.model} (لوحة {maintenanceWarning.vehicle.plateNumber})</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs space-y-2 text-slate-300">
              <p className="font-bold text-amber-300">الحجوزات المرتبطة التي قد تتأثر:</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {maintenanceWarning.upcomingBookings.map((b) => (
                  <div key={b.id} className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-[11px]">
                    <div>
                      <span className="font-mono font-bold text-white block">حجز #{b.bookingNumber}</span>
                      <span className="text-slate-400">العميل: {b.customerName}</span>
                    </div>
                    <div className="text-left font-mono text-slate-400">
                      <span>{b.pickupDate} إلى {b.returnDate}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                هل أنت متأكد من رغبتك في تحويل السيارة لحالة "قيد الصيانة" رغم وجود هذه الحجوزات؟
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMaintenanceWarning(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء التغيير
              </button>
              <button
                type="button"
                onClick={confirmMaintenanceSwitch}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                تأكيد التحويل للصيانة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
