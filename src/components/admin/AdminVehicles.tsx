import React, { useState } from 'react';
import { Vehicle, VehicleStatus } from '../../types';
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
  Droplet,
  Image as ImageIcon,
} from 'lucide-react';

interface AdminVehiclesProps {
  vehicles: Vehicle[];
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
  const [updatingVehicleId, setUpdatingVehicleId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  const handleQuickStatusChange = async (vehicleId: string, newStatus: VehicleStatus) => {
    try {
      setUpdatingVehicleId(vehicleId);
      setStatusFeedback(null);
      await dataService.updateVehicle(vehicleId, { status: newStatus });
      onRefreshData();
      const label = newStatus === 'rented' ? 'مؤجرة' : newStatus === 'available' ? 'متوفرة' : 'قيد الصيانة';
      setStatusFeedback(`تم تغيير حالة السيارة بنجاح إلى (${label}) وتحديث السحابة.`);
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err: any) {
      console.error('Quick vehicle status error:', err);
      setStatusFeedback(`فشل تعديل حالة السيارة: ${err?.message || 'خطأ غير متوقع'}`);
    } finally {
      setUpdatingVehicleId(null);
    }
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
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              title="التحقق من تخزين كافة السيارات في قاعدة بيانات Firestore ومزامنة الحالات"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة الأسطول'}</span>
            </button>

            <button
              onClick={onOpenAddVehicle}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all"
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

      {/* Filter and Search Bar */}
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
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
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
              { id: 'light', label: 'اقتصادي' },
              { id: 'medium', label: 'متوسط' },
              { id: 'suv', label: 'جيب 7 مقاعد' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
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

        {/* Search */}
        <div className="relative w-full md:w-72">
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
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Fleet Grid */}
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
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold"
          >
            إعادة ضبط الفلاتر
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((v) => {
            const kmSinceOil = (v.currentMileage || 0) - (v.lastOilChangeMileage || 0);
            const isOilOverdue = kmSinceOil >= 5000;
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
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-bold text-amber-400 border border-amber-500/30">
                      {v.category === 'light' ? 'اقتصادي' : v.category === 'medium' ? 'متوسط' : 'جيب 7 مقاعد'}
                    </div>

                    {v.images && v.images.length > 1 && (
                      <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-md text-[10px] text-slate-300 border border-slate-700/60 flex items-center gap-1 shadow-md">
                        <ImageIcon className="w-3 h-3 text-amber-400" />
                        <span>{v.images.length} صور</span>
                      </div>
                    )}

                    {/* Interactive Live Status Selector */}
                    <div className="absolute top-3 left-3 z-10">
                      <select
                        value={v.status}
                        disabled={isUpdating || isSyncing}
                        onChange={(e) => handleQuickStatusChange(v.id, e.target.value as VehicleStatus)}
                        className={`px-3 py-1 rounded-full text-[11px] font-black cursor-pointer appearance-none outline-none border transition-all shadow-md ${
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
                        <span className="text-[10px] text-slate-400 block">/ يوم</span>
                      </div>
                    </div>

                    {/* Mileage and Oil Stats */}
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5 text-slate-500" />
                          <span>العداد الحالي:</span>
                        </span>
                        <span className="text-white font-mono font-bold">{v.currentMileage.toLocaleString()} كم</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span className="flex items-center gap-1">
                          <Droplet className={`w-3.5 h-3.5 ${isOilOverdue ? 'text-rose-400' : 'text-slate-500'}`} />
                          <span>المقطوع من آخر زيت:</span>
                        </span>
                        <span className={`font-mono font-bold ${isOilOverdue ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {kmSinceOil.toLocaleString()} كم {isOilOverdue && '(تجاوز 5,000 كم!)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenInspection(v)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold transition-colors"
                      title="فحص الهيكل والتسليم"
                    >
                      فحص الهيكل
                    </button>

                    {v.status === 'available' ? (
                      <button
                        onClick={() => handleQuickStatusChange(v.id, 'rented')}
                        disabled={isUpdating || isSyncing}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-bold transition-all"
                        title="تغيير الحالة إلى مؤجرة وحفظها في قاعدة البيانات"
                      >
                        تأجير
                      </button>
                    ) : v.status === 'rented' ? (
                      <button
                        onClick={() => handleQuickStatusChange(v.id, 'available')}
                        disabled={isUpdating || isSyncing}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition-all"
                        title="استلام السيارة وإعادتها إلى متوفرة"
                      >
                        استلام (متاحة)
                      </button>
                    ) : (
                      <button
                        onClick={() => handleQuickStatusChange(v.id, 'available')}
                        disabled={isUpdating || isSyncing}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition-all"
                        title="إنهاء الصيانة وإعادتها إلى متوفرة"
                      >
                        إنهاء الصيانة
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenEditVehicle(v)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                      title="تعديل بيانات السيارة"
                    >
                      <Edit3 className="w-4 h-4 text-amber-400" />
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => onDeleteVehicle(v)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
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
      )}
    </div>
  );
};
