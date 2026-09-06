import React, { useState } from 'react';
import { Vehicle, VehicleCategory, TransmissionType, FuelType, VehicleStatus } from '../types';
import { dataService } from '../services/dataService';
import { vehicleFormSchema } from '../services/validation';
import { X, Car, Save, AlertCircle, Sparkles } from 'lucide-react';

interface VehicleFormModalProps {
  vehicle?: Vehicle | null; // null if adding new
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
  vehicle,
  onClose,
  onSaved,
}) => {
  const [brand, setBrand] = useState(vehicle?.brand || 'كيا (Kia)');
  const [model, setModel] = useState(vehicle?.model || '');
  const [year, setYear] = useState<number>(vehicle?.year || 2022);
  const [color, setColor] = useState(vehicle?.color || 'أبيض');
  const [category, setCategory] = useState<VehicleCategory>(vehicle?.category || 'medium');
  const [seats, setSeats] = useState<number>(vehicle?.seats || 5);
  const [transmission, setTransmission] = useState<TransmissionType>(vehicle?.transmission || 'automatic');
  const [fuelType, setFuelType] = useState<FuelType>(vehicle?.fuelType || 'petrol');
  const [dailyPrice, setDailyPrice] = useState<number>(vehicle?.dailyPrice || 50);
  const [plateNumber, setPlateNumber] = useState(vehicle?.plateNumber || 'دمشق ');
  const [currentMileage, setCurrentMileage] = useState<number>(vehicle?.currentMileage || 50000);
  const [lastOilChangeMileage, setLastOilChangeMileage] = useState<number>(vehicle?.lastOilChangeMileage || 50000);
  const [status, setStatus] = useState<VehicleStatus>(vehicle?.status || 'available');
  const [imageUrl, setImageUrl] = useState(
    vehicle?.imageUrl || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80'
  );
  const [featuresString, setFeaturesString] = useState(vehicle?.features?.join(', ') || 'مكيف هواء, كاميرا خلفية, بلوتوث, ABS');
  const [description, setDescription] = useState(vehicle?.description || 'سيارة بحالة ممتازة وصيانة دورية شاملة.');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const features = featuresString.split(',').map(s => s.trim()).filter(Boolean);

    const parsed = vehicleFormSchema.safeParse({
      brand,
      model,
      year,
      color,
      category,
      seats,
      transmission,
      fuelType,
      dailyPrice,
      plateNumber,
      currentMileage,
      lastOilChangeMileage,
      status,
      imageUrl,
      description,
    });

    if (!parsed.success) {
      setErrorMessage((parsed.error as any).issues?.[0]?.message || 'يرجى التحقق من صحة البيانات');
      return;
    }

    setIsSaving(true);
    try {
      if (vehicle?.id) {
        const updated = await dataService.updateVehicle(vehicle.id, {
          brand,
          model,
          year,
          color,
          category,
          seats,
          transmission,
          fuelType,
          dailyPrice,
          plateNumber,
          currentMileage,
          lastOilChangeMileage,
          status,
          imageUrl,
          features,
          description,
        });
        onSaved(updated);
      } else {
        const created = await dataService.addVehicle({
          brand,
          model,
          year,
          color,
          category,
          seats,
          transmission,
          fuelType,
          dailyPrice,
          plateNumber,
          currentMileage,
          lastOilChangeMileage,
          status,
          imageUrl,
          features,
          description,
        });
        onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل حفظ بيانات السيارة');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto text-slate-100">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">
              {vehicle ? 'تعديل بيانات سيارة في الأسطول' : 'إضافة سيارة جديدة للأسطول'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">الشركة المصنعة</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="كيا (Kia) أو هيونداي..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">طراز السيارة (Model)</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="أوبتيما / سوناتا / تشين بلس..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">سنة الصنع</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">الفئة</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="light">سيدان اقتصادي (Light)</option>
                <option value="medium">سيدان متوسط (Medium)</option>
                <option value="jeep_7seats">جيب عائلي 7 مقاعد (Jeep)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">السعر اليومي ($)</label>
              <input
                type="number"
                value={dailyPrice}
                onChange={(e) => setDailyPrice(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">رقم اللوحة</label>
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="دمشق 123456"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">اللون</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">عدد المقاعد</label>
              <input
                type="number"
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">ناقل الحركة</label>
              <select
                value={transmission}
                onChange={(e) => setTransmission(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="automatic">أوتوماتيك</option>
                <option value="manual">عادي</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">نوع الوقود</label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="petrol">بنزين</option>
                <option value="hybrid">هايبرد هجين</option>
                <option value="diesel">ديزل</option>
                <option value="electric">كهرباء</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">العداد الحالي (كم)</label>
              <input
                type="number"
                value={currentMileage}
                onChange={(e) => setCurrentMileage(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">عداد آخر تغيير زيت (كم)</label>
              <input
                type="number"
                value={lastOilChangeMileage}
                onChange={(e) => setLastOilChangeMileage(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">الحالة الحالية</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="available">متاحة (Available)</option>
                <option value="rented">مؤجرة (Rented)</option>
                <option value="maintenance">صيانة (Maintenance)</option>
                <option value="inactive">غير نشطة (Inactive)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">رابط صورة السيارة (Image URL)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">المواصفات والتجهيزات (مفصولة بفواصل)</label>
            <input
              type="text"
              value={featuresString}
              onChange={(e) => setFeaturesString(e.target.value)}
              placeholder="مكيف ممتاز, كاميرا خلفية, حساسات ركن..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">نبذة / وصف السيارة</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ بيانات السيارة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
