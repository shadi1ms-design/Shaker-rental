import React, { useState, useRef } from 'react';
import { Vehicle, VehicleInspection } from '../types';
import { dataService } from '../services/dataService';
import { storageService } from '../services/storageService';
import { validateUploadedFile } from '../utils/security';
import {
  X,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Car,
  Fuel,
  Gauge,
  Sparkles,
  Save,
  Printer,
  Upload,
  RefreshCw,
  Camera,
  Trash2,
  AlertCircle
} from 'lucide-react';

interface InspectionModalProps {
  vehicle?: Vehicle | null;
  bookingId?: string;
  onClose: () => void;
  onSaved?: (inspection: VehicleInspection) => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  vehicle,
  bookingId = '',
  onClose,
  onSaved,
}) => {
  if (!vehicle) return null;

  const [inspectionType, setInspectionType] = useState<'handover' | 'return'>('handover');
  const [fuelLevel, setFuelLevel] = useState<'full' | 'three_quarters' | 'half' | 'quarter'>('full');
  const [mileage, setMileage] = useState<number>(vehicle?.currentMileage || 0);
  const [cleanliness, setCleanliness] = useState<'excellent' | 'good' | 'fair' | 'dirty'>('excellent');

  // Body Parts Condition: OK vs Damaged/Scratched
  const [bodyChecks, setBodyChecks] = useState<Record<string, 'ok' | 'scratched' | 'dented'>>({
    front: 'ok',
    back: 'ok',
    right: 'ok',
    left: 'ok',
    roof: 'ok',
    glass: 'ok',
    interior: 'ok',
  });

  const [existingDamages, setExistingDamages] = useState('');
  const [newDamages, setNewDamages] = useState('');
  const [inspectorName, setInspectorName] = useState('مسؤول التسليم - شركة شاكر');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Inspection Media Photos/Videos
  const [inspectionFiles, setInspectionFiles] = useState<{ url: string; name: string; type: string }[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const togglePartCondition = (part: string) => {
    setBodyChecks((prev) => {
      const current = prev[part];
      const next = current === 'ok' ? 'scratched' : current === 'scratched' ? 'dented' : 'ok';
      return { ...prev, [part]: next };
    });
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setMediaUploadError(null);
    setIsUploadingMedia(true);
    setMediaUploadProgress(0);

    try {
      const fileList: File[] = Array.from(files);
      const totalFiles = fileList.length;

      for (let i = 0; i < totalFiles; i++) {
        const file = fileList[i];
        const isVideo = file.type.startsWith('video/');

        // Security validation
        const validation = validateUploadedFile(file.name, file.size, file.type, isVideo ? 'video' : 'document');
        if (!validation.valid) {
          throw new Error(validation.error || `الملف ${file.name} غير صالح للرفع.`);
        }

        let uploadRes;
        if (isVideo) {
          uploadRes = await storageService.uploadContractVideo(
            file,
            bookingId || vehicle.id,
            (percent) => {
              const overall = Math.round(((i + percent / 100) / totalFiles) * 100);
              setMediaUploadProgress(overall);
            }
          );
        } else {
          uploadRes = await storageService.uploadVehicleImage(
            file,
            vehicle.id,
            (percent) => {
              const overall = Math.round(((i + percent / 100) / totalFiles) * 100);
              setMediaUploadProgress(overall);
            }
          );
        }

        if (uploadRes?.downloadUrl) {
          setInspectionFiles((prev) => [
            ...prev,
            { url: uploadRes.downloadUrl, name: file.name, type: file.type }
          ]);
        }
      }
    } catch (err: any) {
      console.error('Inspection media upload error:', err);
      setMediaUploadError(err.message || 'فشل رفع ملف المعاينة');
    } finally {
      setIsUploadingMedia(false);
      setMediaUploadProgress(0);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const handleRemoveMedia = (index: number) => {
    setInspectionFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const record = await dataService.recordInspection({
        vehicleId: vehicle.id,
        bookingId,
        type: inspectionType,
        fuelLevel,
        mileage,
        bodyCondition: bodyChecks,
        cleanliness,
        existingDamages,
        newDamages,
        inspectorName,
        photos: inspectionFiles.map((f) => f.url),
      });

      // Update vehicle mileage if higher
      if (mileage > vehicle.currentMileage) {
        await dataService.updateVehicle(vehicle.id, { currentMileage: mileage });
      }

      setSavedSuccess(true);
      if (onSaved) onSaved(record);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const partNames: Record<string, string> = {
    front: 'المقدمة والصدام الأمامي',
    back: 'الخلفية والصدام الخلفي',
    right: 'الجانب الأيمن والأبواب',
    left: 'الجانب الأيسر والأبواب',
    roof: 'السقف والزجاج العلوي',
    glass: 'الزجاج الأمامي والمرايا',
    interior: 'المقصورة والفرش الداخلي',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto pt-4 sm:pt-6 pb-6 sm:pb-6 text-slate-100">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl my-auto animate-in zoom-in-95 duration-200 max-h-[90vh] max-h-[90dvh] flex flex-col overflow-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">
                نموذج فحص وتسليم السيارة (Inspection Sheet)
              </h3>
              <span className="text-xs text-slate-400">
                {vehicle.brand} {vehicle.model} • لوحة رقم: {vehicle.plateNumber}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess ? (
          <div className="p-8 sm:p-12 text-center space-y-3 overflow-y-auto flex-1 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-xl font-bold text-white">تم حفظ تقرير الفحص بنجاح!</h4>
            <p className="text-xs text-slate-400">تم تسجيل العداد ومستوى الوقود وحالة الهيكل في سجل المركبة.</p>
          </div>
        ) : (
          <form 
            onSubmit={handleSaveInspection} 
            className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-5 sm:space-y-6 overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Type & Inspector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">نوع الفحص</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInspectionType('handover')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border ${
                      inspectionType === 'handover'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    تسليم للعميل (خروج)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionType('return')}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border ${
                      inspectionType === 'return'
                        ? 'bg-amber-500 text-slate-950 border-amber-500'
                        : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    استلام من العميل (عودة)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">اسم الفاحص المسؤول</label>
                <input
                  type="text"
                  value={inspectorName || ''}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            {/* Fuel & Mileage */}
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              {/* Fuel Level */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Fuel className="w-3.5 h-3.5 text-amber-400" />
                  مستوى خزان الوقود
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { val: 'full', label: 'ممتلئ 1/1' },
                    { val: 'three_quarters', label: '3/4' },
                    { val: 'half', label: '1/2' },
                    { val: 'quarter', label: '1/4' },
                  ].map((f) => (
                    <button
                      key={f.val}
                      type="button"
                      onClick={() => setFuelLevel(f.val as any)}
                      className={`py-1.5 text-[11px] font-bold rounded-lg border text-center transition-all ${
                        fuelLevel === f.val
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mileage */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  عداد الكيلومتر الحالي
                </label>
                <input
                  type="number"
                  value={mileage ?? 0}
                  onChange={(e) => setMileage(Number(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            {/* Body Condition Check Matrix */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5 text-amber-400" />
                  فحص أجزاء الهيكل والمقصورة (اضغط لتغيير الحالة)
                </label>
                <span className="text-[10px] text-slate-500">أخضر = سليم • أصفر = خدش • أحمر = صدمة</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.keys(partNames).map((part) => {
                  const state = bodyChecks[part] || 'ok';
                  return (
                    <button
                      key={part}
                      type="button"
                      onClick={() => togglePartCondition(part)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold text-right transition-all ${
                        state === 'ok'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : state === 'scratched'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      <span>{partNames[part]}</span>
                      <span className="text-[11px] font-bold">
                        {state === 'ok' ? '✓ سليم تماماً' : state === 'scratched' ? '⚠ به خدش' : '✕ به ضربة / صدمة'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cleanliness */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                حالة نظافة السيارة
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: 'excellent', label: 'ممتازة ومعقمة' },
                  { val: 'good', label: 'جيدة جداً' },
                  { val: 'fair', label: 'مقبولة' },
                  { val: 'dirty', label: 'تحتاج غسيل' },
                ].map((c) => (
                  <button
                    key={c.val}
                    type="button"
                    onClick={() => setCleanliness(c.val as any)}
                    className={`py-1.5 text-xs font-semibold rounded-xl border ${
                      cleanliness === c.val
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Damages Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ملاحظات الخدوش السابقة</label>
                <textarea
                  value={existingDamages || ''}
                  onChange={(e) => setExistingDamages(e.target.value)}
                  placeholder="مثال: خدش بسيط على الصدام الخلفي من جهة اليمين..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ملاحظات جديدة عند الإعادة</label>
                <textarea
                  value={newDamages || ''}
                  onChange={(e) => setNewDamages(e.target.value)}
                  placeholder="ملاحظات إن وُجدت عند إعادة السيارة..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Inspection Media Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                توثيق بالصور أو الفيديو (معاينة الأضرار وحالة التسليم)
              </label>
              
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={mediaInputRef}
                  onChange={handleMediaUpload}
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  multiple
                  className="hidden"
                  id="inspection-media-input"
                />
                <label
                  htmlFor="inspection-media-input"
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    isUploadingMedia
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {isUploadingMedia ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الرفع ({mediaUploadProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" />
                      <span>إضافة صور / فيديو فحص حقيقي</span>
                    </>
                  )}
                </label>
                <span className="text-[11px] text-slate-400">
                  (صور JPG/PNG/WEBP أو فيديو MP4/QuickTime بحد أقصى مسموح)
                </span>
              </div>

              {mediaUploadError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{mediaUploadError}</span>
                </div>
              )}

              {/* Uploaded Media Previews */}
              {inspectionFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {inspectionFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-900 w-20 h-16 flex items-center justify-center"
                    >
                      {file.type.startsWith('video/') ? (
                        <div className="text-[10px] text-amber-400 font-bold text-center px-1">
                          🎬 فيديو
                        </div>
                      ) : (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveMedia(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="حذف"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ تقرير الفحص والتسليم'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
