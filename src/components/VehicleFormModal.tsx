import React, { useState, useRef } from 'react';
import { Vehicle, VehicleCategory, TransmissionType, FuelType, VehicleStatus } from '../types';
import { VEHICLE_CATEGORY_LABELS } from '../constants/vehicleCategories';
import { dataService } from '../services/dataService';
import { vehicleFormSchema } from '../services/validation';
import { storageService } from '../services/storageService';
import { validateUploadedFile } from '../utils/security';
import {
  X,
  Car,
  Save,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  Trash2,
  Star,
  Link as LinkIcon,
  Loader2
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

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
  const [status, setStatus] = useState<VehicleStatus>(vehicle?.status || 'available');

  // Images state: multiple uploaded images and chosen primary image
  const initialImages: string[] =
    vehicle?.images && vehicle.images.length > 0
      ? vehicle.images
      : vehicle?.imageUrl
      ? [vehicle.imageUrl]
      : [];

  const [images, setImages] = useState<string[]>(initialImages);
  const [imageUrl, setImageUrl] = useState(
    vehicle?.imageUrl ||
      initialImages[0] ||
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80'
  );

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [featuresString, setFeaturesString] = useState(vehicle?.features?.join(', ') || 'مكيف هواء, كاميرا خلفية, بلوتوث, ABS');
  const [description, setDescription] = useState(vehicle?.description || 'سيارة بحالة ممتازة وصيانة دورية شاملة.');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const fileArray = Array.from(files);
      const validImageFiles = fileArray.filter((f) => f.type.startsWith('image/'));

      if (validImageFiles.length === 0) {
        throw new Error('يرجى اختيار ملفات صور صالحة (JPG, PNG, WEBP).');
      }

      const uploadedUrls: string[] = [];
      const totalFiles = validImageFiles.length;

      for (let i = 0; i < totalFiles; i++) {
        const file = validImageFiles[i];

        const validation = validateUploadedFile(file.name, file.size, file.type, 'document');
        if (!validation.valid) {
          throw new Error(validation.error || `الملف ${file.name} غير صالح للرفع.`);
        }

        const result = await storageService.uploadVehicleImage(
          file,
          vehicle?.id,
          (percent) => {
            const overall = Math.round(((i + percent / 100) / totalFiles) * 100);
            setUploadProgress(overall);
          }
        );
        if (result.downloadUrl) {
          uploadedUrls.push(result.downloadUrl);
        }
      }

      setImages((prev) => {
        const combined = [...prev, ...uploadedUrls];
        if (!imageUrl || imageUrl.includes('unsplash.com/photo-1549399542')) {
          setImageUrl(uploadedUrls[0] || combined[0]);
        }
        return combined;
      });

      if (!imageUrl || imageUrl.includes('unsplash.com/photo-1549399542')) {
        setImageUrl(uploadedUrls[0]);
      }
    } catch (err: unknown) {
      console.error('Image upload failed:', err);
      setUploadError(err instanceof Error ? err.message : 'فشل رفع الصورة');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    setImages(updated);
    if (images[indexToRemove] === imageUrl) {
      setImageUrl(updated[0] || '');
    }
  };

  const handleSetPrimaryImage = (url: string) => {
    setImageUrl(url);
  };

  const handleAddManualUrl = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    setImages((prev) => [...prev, trimmed]);
    if (!imageUrl || imageUrl.includes('unsplash.com/photo-1549399542')) {
      setImageUrl(trimmed);
    }
    setManualUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const features = featuresString.split(',').map(s => s.trim()).filter(Boolean);
    const finalImageUrl =
      imageUrl ||
      images[0] ||
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1000&q=80';
    const finalImages =
      images.length > 0
        ? images.includes(finalImageUrl)
          ? images
          : [finalImageUrl, ...images]
        : [finalImageUrl];

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
      status,
      imageUrl: finalImageUrl,
      images: finalImages,
      description,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues?.[0]?.message || 'يرجى التحقق من صحة البيانات');
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
          status,
          imageUrl: finalImageUrl,
          images: finalImages,
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
          status,
          imageUrl: finalImageUrl,
          images: finalImages,
          features,
          description,
        });
        onSaved(created);
      }
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'فشل حفظ بيانات السيارة');
    } finally {
      setIsSaving(false);
    }
  };

  const modalRef = useFocusTrap({ isOpen: true, onClose });

  return (
    <div className="min-h-[60vh] flex items-start justify-center py-2 text-slate-100">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-form-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl animate-in fade-in duration-200 overflow-clip focus:outline-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-amber-400" />
            <h3 id="vehicle-form-modal-title" className="font-bold text-white text-base">
              {vehicle ? 'تعديل بيانات سيارة في الأسطول' : 'إضافة سيارة جديدة للأسطول'}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            aria-label="إغلاق النافذة"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form 
          onSubmit={handleSubmit} 
          className="p-4 sm:p-6 space-y-4 text-xs"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">الشركة المصنعة</label>
              <input
                type="text"
                value={brand || ''}
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
                value={model || ''}
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
                value={year ?? 2022}
                onChange={(e) => setYear(Number(e.target.value) || 2022)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">الفئة</label>
              <select
                value={category || 'medium'}
                onChange={(e) => setCategory(e.target.value as VehicleCategory)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="light">{VEHICLE_CATEGORY_LABELS.light}</option>
                <option value="medium">{VEHICLE_CATEGORY_LABELS.medium}</option>
                <option value="jeep_7seats">{VEHICLE_CATEGORY_LABELS.jeep_7seats}</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">السعر اليومي ($)</label>
              <input
                type="number"
                value={dailyPrice ?? 50}
                onChange={(e) => setDailyPrice(Number(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">رقم اللوحة</label>
              <input
                type="text"
                value={plateNumber || ''}
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
                value={color || ''}
                onChange={(e) => setColor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">عدد المقاعد</label>
              <input
                type="number"
                value={seats ?? 5}
                onChange={(e) => setSeats(Number(e.target.value) || 5)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">ناقل الحركة</label>
              <select
                value={transmission || 'automatic'}
                onChange={(e) => setTransmission(e.target.value as TransmissionType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="automatic">أوتوماتيك</option>
                <option value="manual">عادي</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">نوع الوقود</label>
              <select
                value={fuelType || 'petrol'}
                onChange={(e) => setFuelType(e.target.value as FuelType)}
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
                value={currentMileage ?? 0}
                onChange={(e) => setCurrentMileage(Number(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">الحالة الحالية</label>
              <select
                value={status || 'available'}
                onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="available">متاحة (Available)</option>
                <option value="rented">مؤجرة (Rented)</option>
                <option value="maintenance">صيانة (Maintenance)</option>
                <option value="inactive">غير نشطة (Inactive)</option>
              </select>
            </div>
          </div>

          {/* Photo Upload & Gallery Management Section */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>صور السيارة (رفع مباشر من الجهاز أو المعرض)</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {images.length} {images.length === 1 ? 'صورة مرفوعة' : images.length > 1 && images.length <= 10 ? 'صور مرفوعة' : 'صورة'}
              </span>
            </div>

            {/* Drag & Drop / File Input Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files) {
                  handleFilesUpload(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer ${
                isDragOver
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-slate-700/80 hover:border-amber-500/50 bg-slate-900/50 hover:bg-slate-900'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/jpg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    handleFilesUpload(e.target.files);
                    e.target.value = '';
                  }
                }}
              />

              <div className="flex flex-col items-center justify-center gap-2 py-1">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">
                    {isUploading ? 'جاري رفع وتحسين الصور...' : 'اضغط لاختيار صورة أو صور متعددة من جهازك، أو اسحبها إلى هنا'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    يدعم صور JPG, PNG, WEBP — يتم تحسين الحجم والوضوح تلقائياً
                  </p>
                </div>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="mt-3 space-y-1">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                      style={{ width: `${Math.max(uploadProgress, 8)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono">
                    {uploadProgress}% جاري المعالجة والرفع...
                  </span>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Uploaded Images Gallery Grid */}
            {images.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>الصور المرفوعة (حدد الصورة الرئيسية بالضغط على النجمة):</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {images.map((img, idx) => {
                    const isPrimary = img === imageUrl;
                    return (
                      <div
                        key={`${img}-${idx}`}
                        className={`group relative rounded-xl overflow-hidden border transition-all ${
                          isPrimary
                            ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20'
                            : 'border-slate-800 hover:border-slate-700 bg-slate-900'
                        }`}
                      >
                        <div className="aspect-video w-full bg-slate-950 overflow-hidden">
                          <img
                            src={img}
                            alt={`صورة السيارة ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>

                        {/* Primary Badge */}
                        {isPrimary && (
                          <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-md">
                            <Star className="w-3 h-3 fill-current" />
                            <span>الرئيسية</span>
                          </div>
                        )}

                        {/* Hover Overlay Controls */}
                        <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveImage(idx);
                              }}
                              className="p-1.5 rounded-md bg-rose-500/90 hover:bg-rose-600 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              title="حذف هذه الصورة"
                              aria-label={`حذف الصورة ${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {!isPrimary && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetPrimaryImage(img);
                              }}
                              className="w-full py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                              <Star className="w-3 h-3" />
                              <span>تعيين كرئيسية</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual URL entry (Secondary/Optional) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors"
              >
                <LinkIcon className="w-3 h-3" />
                <span>{showUrlInput ? 'إخفاء خيار الرابط المباشر' : 'أو إدخال رابط صورة يدوي (URL)...'}</span>
              </button>

              {showUrlInput && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://example.com/car-photo.jpg"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualUrl}
                    disabled={!manualUrl.trim()}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-400 text-xs font-bold"
                  >
                    إضافة
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">المواصفات والتجهيزات (مفصولة بفواصل)</label>
            <input
              type="text"
              value={featuresString || ''}
              onChange={(e) => setFeaturesString(e.target.value)}
              placeholder="مكيف ممتاز, كاميرا خلفية, حساسات ركن..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">نبذة / وصف السيارة</label>
            <textarea
              value={description || ''}
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
              disabled={isSaving || isUploading}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : isUploading ? 'جاري رفع الصور...' : 'حفظ بيانات السيارة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
