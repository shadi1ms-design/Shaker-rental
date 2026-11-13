import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Vehicle, VehicleCategory, TransmissionType, FuelType, VehicleStatus } from '../types';
import { VEHICLE_CATEGORY_LABELS } from '../constants/vehicleCategories';
import { dataService } from '../services/dataService';
import { vehicleFormSchema, isSafeImageUrl } from '../services/validation';
import { storageService } from '../services/storageService';
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
  Loader2,
  Plus
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { NumberInput } from './ui/NumberInput';
import { Toast, ToastMessage } from './common/Toast';
import { ConfirmModal } from './common/ConfirmModal';
import {
  removeVehicleImage,
  undoRemoveVehicleImage,
  removeAllVehicleImages,
  removeUrlFromPendingStorageDeletions,
  isFirebaseStorageUrl,
  DeletedImageRecord,
} from '../utils/vehicleImageManagement';

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
  // Pre-generate stable vehicle ID for new vehicles using lazy state initialization
  const [vehicleId] = useState<string>(
    () => vehicle?.id || `veh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  );

  // Track images uploaded during this modal session for best-effort cleanup on cancel
  const uploadedThisSessionRef = useRef<string[]>([]);
  const [removedStorageImageUrls, setRemovedStorageImageUrls] = useState<string[]>([]);

  // Form State
  const [brand, setBrand] = useState(vehicle?.brand || '');
  const [model, setModel] = useState(vehicle?.model || '');
  const [year, setYear] = useState<number | null>(vehicle?.year ?? 2024);
  const [color, setColor] = useState(vehicle?.color || 'أبيض');
  const [category, setCategory] = useState<VehicleCategory>(vehicle?.category || 'medium');
  const [seats, setSeats] = useState<number | null>(vehicle?.seats ?? 5);
  const [transmission, setTransmission] = useState<TransmissionType>(vehicle?.transmission || 'automatic');
  const [fuelType, setFuelType] = useState<FuelType>(vehicle?.fuelType || 'petrol');
  const [dailyPrice, setDailyPrice] = useState<number | null>(vehicle?.dailyPrice ?? 50);
  const [plateNumber, setPlateNumber] = useState(vehicle?.plateNumber ?? '');
  const [currentMileage, setCurrentMileage] = useState<number | null>(vehicle?.currentMileage ?? 0);
  const [lastOilChangeMileage, setLastOilChangeMileage] = useState<number | null>(
    vehicle?.lastOilChangeMileage ?? vehicle?.currentMileage ?? 0
  );
  const [oilChangeIntervalKm, setOilChangeIntervalKm] = useState<number | null>(
    vehicle?.oilChangeIntervalKm ?? 5000
  );

  const initialStoredStatus: VehicleStatus = vehicle?.storedStatus || vehicle?.status || 'available';
  const [status, setStatus] = useState<VehicleStatus>(initialStoredStatus);

  // Initial Images (No Unsplash placeholders)
  const initialImages: string[] = useMemo(() => {
    if (vehicle?.images && vehicle.images.length > 0) {
      return vehicle.images.filter(isSafeImageUrl);
    }
    if (vehicle?.imageUrl && isSafeImageUrl(vehicle.imageUrl)) {
      return [vehicle.imageUrl];
    }
    return [];
  }, [vehicle]);

  const [images, setImages] = useState<string[]>(initialImages);
  const [selectedPrimaryUrl, setSelectedPrimaryUrl] = useState<string>(vehicle?.imageUrl || initialImages[0] || '');

  // Derived primary URL (No setState inside setImages updater)
  const primaryUrl = useMemo(() => {
    if (images.length === 0) return '';
    return images.includes(selectedPrimaryUrl) ? selectedPrimaryUrl : images[0] ?? '';
  }, [images, selectedPrimaryUrl]);

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedFilesSummary, setFailedFilesSummary] = useState<Array<{ name: string; reason: string }>>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null);

  // Gallery interaction, inline delete confirmation, and undo state
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastSeqRef = useRef(0);
  const getNextToastId = () => `veh-toast-${++toastSeqRef.current}`;
  const [confirmingDeleteIndex, setConfirmingDeleteIndex] = useState<number | null>(null);
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeletedRecordRef = useRef<DeletedImageRecord | null>(null);
  const lastDeletedRecordsBatchRef = useRef<DeletedImageRecord[] | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  // Clean up delete timeout on unmount
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  // Features chips state
  const [featuresList, setFeaturesList] = useState<string[]>(vehicle?.features || []);
  const [featureInputValue, setFeatureInputValue] = useState('');
  const [description, setDescription] = useState(vehicle?.description ?? '');

  // Validation & Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Refs for field focusing on validation failure
  const brandRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const seatsRef = useRef<HTMLInputElement>(null);
  const transmissionRef = useRef<HTMLSelectElement>(null);
  const fuelTypeRef = useRef<HTMLSelectElement>(null);
  const dailyPriceRef = useRef<HTMLInputElement>(null);
  const plateNumberRef = useRef<HTMLInputElement>(null);
  const currentMileageRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLDivElement>(null);

  const fieldRefs: Record<string, React.RefObject<HTMLElement | null>> = useMemo(
    () => ({
      brand: brandRef,
      model: modelRef,
      year: yearRef,
      color: colorRef,
      category: categoryRef,
      seats: seatsRef,
      transmission: transmissionRef,
      fuelType: fuelTypeRef,
      dailyPrice: dailyPriceRef,
      plateNumber: plateNumberRef,
      currentMileage: currentMileageRef,
      images: imagesRef,
    }),
    []
  );

  // Warn on unsaved changes via window.beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Handle Category Change & Suggest Default Seats
  const handleCategoryChange = (newCat: VehicleCategory) => {
    setCategory(newCat);
    setIsDirty(true);
    if (newCat === 'jeep_7seats' && (seats === null || seats < 7)) {
      setSeats(7);
    }
  };

  // Feature Input Chips Management (Splitting by comma, arabic comma, or newline)
  const addFeaturesFromText = (text: string) => {
    if (!text.trim()) return;
    const items = text
      .split(/[,،\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    setFeaturesList((prev) => {
      const combined = Array.from(new Set([...prev, ...items]));
      if (combined.length > 30) {
        setGeneralError('الحد الأقصى للمواصفات هو 30 ميزة.');
        return combined.slice(0, 30);
      }
      return combined;
    });
    setFeatureInputValue('');
    setIsDirty(true);
  };

  const removeFeatureChip = (indexToRemove: number) => {
    setFeaturesList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setIsDirty(true);
  };

  // File Upload Logic
  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    // 1. Check max 15 images limit
    const currentCount = images.length;
    const remainingSlots = 15 - currentCount;
    if (remainingSlots <= 0) {
      setUploadError('تم الوصول للحد الأقصى (15 صورة). يرجى حذف بعض الصور لرفع غيرها.');
      return;
    }

    // 2. Reject HEIC files with explicit message
    const heicFile = fileArray.find(
      (f) =>
        f.type === 'image/heic' ||
        f.type === 'image/heif' ||
        f.name.toLowerCase().endsWith('.heic') ||
        f.name.toLowerCase().endsWith('.heif')
    );
    if (heicFile) {
      setUploadError('صيغة HEIC غير مدعومة، يرجى رفع JPG/PNG/WebP.');
      return;
    }

    const filesToUpload = fileArray.slice(0, remainingSlots);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setFailedFilesSummary([]);

    const failedList: Array<{ name: string; reason: string }> = [];
    const totalFiles = filesToUpload.length;

    for (let i = 0; i < totalFiles; i++) {
      const file = filesToUpload[i];
      try {
        if (!file.type.startsWith('image/')) {
          throw new Error('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
        }

        const result = await storageService.uploadVehicleImage(
          file,
          vehicleId,
          (percent) => {
            const overall = Math.round(((i + percent / 100) / totalFiles) * 100);
            setUploadProgress(overall);
          }
        );

        if (result.downloadUrl) {
          uploadedThisSessionRef.current.push(result.downloadUrl);
          setImages((prev) => {
            if (prev.includes(result.downloadUrl)) return prev;
            return [...prev, result.downloadUrl];
          });
          setIsDirty(true);
        }
      } catch (err: unknown) {
        console.error(`Failed to upload ${file.name}:`, err);
        failedList.push({
          name: file.name,
          reason: err instanceof Error ? err.message : 'فشل الرفع إلى الخادم',
        });
      }
    }

    if (failedList.length > 0) {
      setFailedFilesSummary(failedList);
    }
    setIsUploading(false);
    setUploadProgress(0);
  };

  // Gallery Delete & Confirmation Handlers
  const startConfirmDelete = (index: number) => {
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }
    setConfirmingDeleteIndex(index);
    deleteTimeoutRef.current = setTimeout(() => {
      setConfirmingDeleteIndex(null);
    }, 4000);
  };

  const cancelConfirmDelete = () => {
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }
    setConfirmingDeleteIndex(null);
  };

  const executeDeleteImage = (indexToRemove: number) => {
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
    }
    setConfirmingDeleteIndex(null);

    const res = removeVehicleImage({
      images,
      primaryUrl,
      indexToRemove,
      uploadedThisSession: uploadedThisSessionRef.current,
      removedStorageUrls: removedStorageImageUrls,
    });

    setImages(res.updatedImages);
    setSelectedPrimaryUrl(res.newPrimaryUrl);
    uploadedThisSessionRef.current = res.newUploadedThisSession;
    setRemovedStorageImageUrls(res.newRemovedStorageUrls);
    setIsDirty(true);
    lastDeletedRecordRef.current = res.deletedRecord;
    lastDeletedRecordsBatchRef.current = null;

    // Session uploads are removed immediately (best-effort)
    if (res.immediateStorageDeleteUrls.length > 0) {
      res.immediateStorageDeleteUrls.forEach((url) => {
        storageService.deleteFile(url).catch((err) => {
          console.warn('Best-effort delete for session upload failed:', err);
        });
      });
    }

    // Move keyboard focus to next delete button or upload zone if empty
    setTimeout(() => {
      if (res.updatedImages.length > 0) {
        const nextIdx = Math.min(indexToRemove, res.updatedImages.length - 1);
        const nextBtn = document.getElementById(`delete-img-btn-${nextIdx}`);
        nextBtn?.focus();
      } else {
        uploadZoneRef.current?.focus();
      }
    }, 50);

    // Toast alert with Undo action
    const toastMsg =
      res.isPrimaryChanged && res.updatedImages.length > 0
        ? 'تم حذف الصورة وتم تعيين صورة رئيسية جديدة — تراجع'
        : 'تم حذف الصورة — تراجع';

    setToast({
      id: getNextToastId(),
      type: 'info',
      message: toastMsg,
      duration: 6000,
      action: {
        label: 'تراجع',
        onClick: handleUndoDelete,
      },
    });
  };

  const handleUndoDelete = () => {
    if (!lastDeletedRecordRef.current) return;
    const record = lastDeletedRecordRef.current;
    const res = undoRemoveVehicleImage({
      currentImages: images,
      currentPrimaryUrl: primaryUrl,
      deletedRecord: record,
      removedStorageUrls: removedStorageImageUrls,
      uploadedThisSession: uploadedThisSessionRef.current,
    });

    setImages(res.updatedImages);
    setSelectedPrimaryUrl(res.newPrimaryUrl);
    setRemovedStorageImageUrls(res.newRemovedStorageUrls);
    uploadedThisSessionRef.current = res.newUploadedThisSession;
    setIsDirty(true);
    lastDeletedRecordRef.current = null;

    setToast({
      id: getNextToastId(),
      type: 'success',
      message: 'تمت استعادة الصورة بنجاح.',
      duration: 4000,
    });
  };

  const handleDeleteAllImages = () => {
    setShowDeleteAllConfirm(false);
    if (images.length === 0) return;

    const res = removeAllVehicleImages({
      images,
      primaryUrl,
      uploadedThisSession: uploadedThisSessionRef.current,
      removedStorageUrls: removedStorageImageUrls,
    });

    setImages([]);
    setSelectedPrimaryUrl('');
    uploadedThisSessionRef.current = res.newUploadedThisSession;
    setRemovedStorageImageUrls(res.newRemovedStorageUrls);
    setIsDirty(true);
    lastDeletedRecordsBatchRef.current = res.deletedRecords;
    lastDeletedRecordRef.current = null;

    if (res.immediateStorageDeleteUrls.length > 0) {
      res.immediateStorageDeleteUrls.forEach((url) => {
        storageService.deleteFile(url).catch((err) => {
          console.warn('Best-effort delete for session upload failed:', err);
        });
      });
    }

    setTimeout(() => {
      uploadZoneRef.current?.focus();
    }, 50);

    setToast({
      id: getNextToastId(),
      type: 'info',
      message: 'تم حذف جميع الصور — تراجع',
      duration: 7000,
      action: {
        label: 'تراجع',
        onClick: handleUndoDeleteAll,
      },
    });
  };

  const handleUndoDeleteAll = () => {
    if (!lastDeletedRecordsBatchRef.current) return;
    const batch = lastDeletedRecordsBatchRef.current;
    const restoredUrls = batch.map((b) => b.url);
    const primaryRecord = batch.find((b) => b.wasPrimary);

    setImages(restoredUrls);
    setSelectedPrimaryUrl(primaryRecord ? primaryRecord.url : restoredUrls[0] || '');
    setRemovedStorageImageUrls((prev) => prev.filter((u) => !restoredUrls.includes(u)));

    const sessionRestored = batch.filter((b) => b.isSessionUpload).map((b) => b.url);
    uploadedThisSessionRef.current = Array.from(new Set([...uploadedThisSessionRef.current, ...sessionRestored]));
    setIsDirty(true);
    lastDeletedRecordsBatchRef.current = null;

    setToast({
      id: getNextToastId(),
      type: 'success',
      message: 'تمت استعادة كافة الصور.',
      duration: 4000,
    });
  };

  // Add Manual Image URL
  const handleAddManualUrl = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;

    if (!isSafeImageUrl(trimmed)) {
      setUploadError('رابط الصورة غير آمن أو غير صالح (يجب أن يبدأ بـ http:// أو https://).');
      return;
    }

    if (images.includes(trimmed)) {
      setUploadError('هذه الصورة مضافة مسبقاً في الألبوم.');
      return;
    }

    if (images.length >= 15) {
      setUploadError('الحد الأقصى للصور هو 15 صورة.');
      return;
    }

    setImages((prev) => [...prev, trimmed]);
    // If user re-added a previously removed URL, remove it from pending storage deletion
    setRemovedStorageImageUrls((prev) => removeUrlFromPendingStorageDeletions(trimmed, prev));
    setManualUrl('');
    setUploadError(null);
    setIsDirty(true);
  };

  // Safe Cancel / Close
  const handleCancelClose = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm('هل أنت متأكد من الإلغاء؟ جميع التغييرات غير محفوظة ستضيع.');
      if (!confirmDiscard) return;
    }

    // Best-effort cleanup of images uploaded in this session that were not saved
    // Original images stored previously in removedStorageImageUrls are NEVER deleted on cancel!
    if (uploadedThisSessionRef.current.length > 0) {
      const sessionUrls = uploadedThisSessionRef.current.filter(isFirebaseStorageUrl);
      Promise.allSettled(
        sessionUrls.map((url) =>
          storageService.deleteFile(url).catch((err) => {
            console.warn('Cancel cleanup error for session upload:', err);
          })
        )
      ).catch(() => {});
    }

    onClose();
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    // Block if no images exist
    if (images.length === 0 || !primaryUrl) {
      setFieldErrors({ images: 'أضف صورة واحدة على الأقل للسيارة.' });
      setGeneralError('يرجى إضافة صورة واحدة على الأقل للسيارة قبل الحفظ.');
      fieldRefs.images.current?.focus();
      return;
    }

    // 1. Zod Validation
    const payloadToValidate = {
      brand: brand.trim(),
      model: model.trim(),
      year: year ?? undefined,
      color: color.trim(),
      category,
      seats: seats ?? undefined,
      transmission,
      fuelType,
      dailyPrice: dailyPrice ?? undefined,
      plateNumber: plateNumber.trim(),
      currentMileage: currentMileage ?? undefined,
      lastOilChangeMileage: lastOilChangeMileage ?? currentMileage ?? 0,
      oilChangeIntervalKm: oilChangeIntervalKm ?? 5000,
      status,
      imageUrl: primaryUrl,
      images,
      description: description.trim(),
    };

    const parsed = vehicleFormSchema.safeParse(payloadToValidate);

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const path = String(issue.path[0] || 'general');
        if (!errors[path]) {
          errors[path] = issue.message;
        }
      });

      setFieldErrors(errors);
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField && fieldRefs[firstErrorField]?.current) {
        fieldRefs[firstErrorField].current?.focus();
      }
      setGeneralError(Object.values(errors)[0] || 'يرجى تصحيح الأخطاء الموضحة أدناه.');
      return;
    }

    setIsSaving(true);

    try {
      if (vehicle?.id) {
        // EDIT MODE: Build Diff Object to send ONLY changed fields
        const diffUpdates: Partial<Vehicle> = {};

        if (brand.trim() !== vehicle.brand) diffUpdates.brand = brand.trim();
        if (model.trim() !== vehicle.model) diffUpdates.model = model.trim();
        if (year !== null && year !== vehicle.year) diffUpdates.year = year;
        if (color.trim() !== vehicle.color) diffUpdates.color = color.trim();
        if (category !== vehicle.category) diffUpdates.category = category;
        if (seats !== null && seats !== vehicle.seats) diffUpdates.seats = seats;
        if (transmission !== vehicle.transmission) diffUpdates.transmission = transmission;
        if (fuelType !== vehicle.fuelType) diffUpdates.fuelType = fuelType;
        if (dailyPrice !== null && dailyPrice !== vehicle.dailyPrice) diffUpdates.dailyPrice = dailyPrice;
        if (description.trim() !== (vehicle.description || '')) diffUpdates.description = description.trim();

        // Include status ONLY if it actually changed
        if (status !== initialStoredStatus) {
          diffUpdates.status = status;
        }

        // Include currentMileage ONLY if changed
        if (currentMileage !== null && currentMileage !== (vehicle.currentMileage ?? 0)) {
          diffUpdates.currentMileage = currentMileage;
        }

        // Include oil change tracking fields ONLY if changed
        const normalizedLastOil = lastOilChangeMileage ?? currentMileage ?? 0;
        if (normalizedLastOil !== (vehicle.lastOilChangeMileage ?? vehicle.currentMileage ?? 0)) {
          diffUpdates.lastOilChangeMileage = normalizedLastOil;
        }
        const normalizedInterval = oilChangeIntervalKm ?? 5000;
        if (normalizedInterval !== (vehicle.oilChangeIntervalKm ?? 5000)) {
          diffUpdates.oilChangeIntervalKm = normalizedInterval;
        }

        // Include plateNumber ONLY if changed
        if (plateNumber.trim() !== (vehicle.plateNumber ?? '')) {
          diffUpdates.plateNumber = plateNumber.trim();
        }

        if (primaryUrl !== vehicle.imageUrl) diffUpdates.imageUrl = primaryUrl;
        if (JSON.stringify(images) !== JSON.stringify(vehicle.images || [])) {
          diffUpdates.images = images;
        }
        if (JSON.stringify(featuresList) !== JSON.stringify(vehicle.features || [])) {
          diffUpdates.features = featuresList;
        }

        if (Object.keys(diffUpdates).length === 0) {
          // No changes made
          onSaved(vehicle);
          return;
        }

        const updated = await dataService.updateVehicle(vehicle.id, diffUpdates);

        // Delete removed storage images after successful save (Firebase Storage only)
        if (removedStorageImageUrls.length > 0) {
          const urlsToDelete = removedStorageImageUrls.filter(isFirebaseStorageUrl);
          Promise.allSettled(
            urlsToDelete.map((url) =>
              storageService.deleteFile(url).catch((err) => {
                console.warn('Could not delete removed image from storage:', url, err);
              })
            )
          ).catch((err) => {
            console.warn('Storage cleanup encountered an error:', err);
          });
        }

        // Clear session tracking
        uploadedThisSessionRef.current = [];

        // Success path: Single call to onSaved, without calling onClose
        onSaved(updated);
      } else {
        // ADD NEW VEHICLE
        const created = await dataService.addVehicle({
          id: vehicleId,
          brand: brand.trim(),
          model: model.trim(),
          year: year!,
          color: color.trim(),
          category,
          seats: seats!,
          transmission,
          fuelType,
          dailyPrice: dailyPrice!,
          plateNumber: plateNumber.trim(),
          currentMileage: currentMileage || 0,
          lastOilChangeMileage: lastOilChangeMileage ?? currentMileage ?? 0,
          oilChangeIntervalKm: oilChangeIntervalKm ?? 5000,
          status,
          imageUrl: primaryUrl,
          images,
          features: featuresList,
          description: description.trim(),
        });

        // Clear session tracking so they won't be deleted on unmount
        uploadedThisSessionRef.current = [];

        // Success path: Single call to onSaved, without calling onClose
        onSaved(created);
      }
    } catch (err: unknown) {
      console.error('Vehicle submit error:', err);
      const msg = err instanceof Error ? err.message : 'فشل حفظ بيانات السيارة عبر الخادم.';

      if (msg.includes('plateNumber') || msg.includes('اللوحة') || msg.includes('already-exists')) {
        setFieldErrors((prev) => ({
          ...prev,
          plateNumber: 'رقم اللوحة مستخدم بالفعل لسيارة أخرى.',
        }));
        fieldRefs.plateNumber.current?.focus();
      } else if (msg.includes('tanzil') || msg.includes('تنزيل العداد') || msg.includes('mileage')) {
        setFieldErrors((prev) => ({
          ...prev,
          currentMileage: msg,
        }));
        fieldRefs.currentMileage.current?.focus();
      } else {
        setGeneralError(msg);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const modalRef = useFocusTrap({ isOpen: true, onClose: handleCancelClose });

  return (
    <div className="min-h-[70dvh] flex items-start justify-center py-4 text-slate-100">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-form-modal-title"
        tabIndex={-1}
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl animate-in fade-in duration-200 focus:outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 id="vehicle-form-modal-title" className="font-bold text-white text-base sm:text-lg">
                {vehicle ? `تعديل بيانات: ${vehicle.brand} ${vehicle.model}` : 'إضافة سيارة جديدة للأسطول'}
              </h3>
              <p className="text-xs text-slate-400">
                {vehicle ? `معرف السيارة: ${vehicle.id}` : `المعرف المُولد: ${vehicleId}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancelClose}
            aria-label="إغلاق النافذة"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* General Error Banner */}
        {generalError && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-bold flex items-start gap-2.5 shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-sm">
          {/* Row 1: Brand, Model, Year */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="veh-brand" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                الشركة المصنعة <span className="text-amber-400">*</span>
              </label>
              <input
                ref={brandRef}
                id="veh-brand"
                type="text"
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="كيا (Kia)، هيونداي..."
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none min-h-[44px] ${
                  fieldErrors.brand ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.brand && (
                <p className="text-xs text-rose-400 font-bold mt-1">{fieldErrors.brand}</p>
              )}
            </div>

            <div>
              <label htmlFor="veh-model" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                طراز السيارة (Model) <span className="text-amber-400">*</span>
              </label>
              <input
                ref={modelRef}
                id="veh-model"
                type="text"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="أوبتيما، سوناتا..."
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none min-h-[44px] ${
                  fieldErrors.model ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.model && (
                <p className="text-xs text-rose-400 font-bold mt-1">{fieldErrors.model}</p>
              )}
            </div>

            <div>
              <label htmlFor="veh-year" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                سنة الصنع (1995 - 2030) <span className="text-amber-400">*</span>
              </label>
              <NumberInput
                ref={yearRef}
                id="veh-year"
                value={year}
                onChange={(val) => {
                  setYear(val);
                  setIsDirty(true);
                }}
                min={1995}
                max={2030}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none min-h-[44px] ${
                  fieldErrors.year ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.year && (
                <p className="text-xs text-rose-400 font-bold mt-1">{fieldErrors.year}</p>
              )}
            </div>
          </div>

          {/* Row 2: Category, Daily Price, Plate Number */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="veh-category" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                فئة السيارة <span className="text-amber-400">*</span>
              </label>
              <select
                ref={categoryRef}
                id="veh-category"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as VehicleCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-amber-500 min-h-[44px] cursor-pointer"
              >
                <option value="light">{VEHICLE_CATEGORY_LABELS.light}</option>
                <option value="medium">{VEHICLE_CATEGORY_LABELS.medium}</option>
                <option value="jeep_7seats">{VEHICLE_CATEGORY_LABELS.jeep_7seats}</option>
              </select>
            </div>

            <div>
              <label htmlFor="veh-price" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                السعر اليومي ($) <span className="text-amber-400">*</span>
              </label>
              <NumberInput
                ref={dailyPriceRef}
                id="veh-price"
                value={dailyPrice}
                onChange={(val) => {
                  setDailyPrice(val);
                  setIsDirty(true);
                }}
                min={10}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-white font-bold text-base sm:text-sm focus:outline-none min-h-[44px] ${
                  fieldErrors.dailyPrice ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.dailyPrice && (
                <p className="text-xs text-rose-400 font-bold mt-1">{fieldErrors.dailyPrice}</p>
              )}
            </div>

            <div>
              <label htmlFor="veh-plate" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                رقم اللوحة <span className="text-amber-400">*</span>
              </label>
              <input
                ref={plateNumberRef}
                id="veh-plate"
                type="text"
                value={plateNumber}
                onChange={(e) => {
                  setPlateNumber(e.target.value);
                  setIsDirty(true);
                }}
                dir="ltr"
                placeholder="123456-دمشق"
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-white font-mono text-base sm:text-sm text-right focus:outline-none min-h-[44px] ${
                  fieldErrors.plateNumber ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.plateNumber && (
                <p className="text-xs text-rose-400 font-bold mt-1">{fieldErrors.plateNumber}</p>
              )}
            </div>
          </div>

          {/* Row 3: Color, Seats, Transmission, Fuel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label htmlFor="veh-color" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                اللون <span className="text-amber-400">*</span>
              </label>
              <input
                ref={colorRef}
                id="veh-color"
                type="text"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setIsDirty(true);
                }}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none min-h-[44px] ${
                  fieldErrors.color ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.color && (
                <p className="text-xs text-rose-400 font-bold mt-1">{fieldErrors.color}</p>
              )}
            </div>

            <div>
              <label htmlFor="veh-seats" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                المقاعد (2 - 15) <span className="text-amber-400">*</span>
              </label>
              <NumberInput
                ref={seatsRef}
                id="veh-seats"
                value={seats}
                onChange={(val) => {
                  setSeats(val);
                  setIsDirty(true);
                }}
                min={category === 'jeep_7seats' ? 7 : 2}
                max={15}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none min-h-[44px] ${
                  fieldErrors.seats ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.seats && (
                <p className="text-xs text-rose-400 font-bold mt-1">{fieldErrors.seats}</p>
              )}
            </div>

            <div>
              <label htmlFor="veh-transmission" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                ناقل الحركة
              </label>
              <select
                ref={transmissionRef}
                id="veh-transmission"
                value={transmission}
                onChange={(e) => {
                  setTransmission(e.target.value as TransmissionType);
                  setIsDirty(true);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-amber-500 min-h-[44px] cursor-pointer"
              >
                <option value="automatic">أوتوماتيك</option>
                <option value="manual">عادي</option>
              </select>
            </div>

            <div>
              <label htmlFor="veh-fuel" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                نوع الوقود
              </label>
              <select
                ref={fuelTypeRef}
                id="veh-fuel"
                value={fuelType}
                onChange={(e) => {
                  setFuelType(e.target.value as FuelType);
                  setIsDirty(true);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-amber-500 min-h-[44px] cursor-pointer"
              >
                <option value="petrol">بنزين</option>
                <option value="hybrid">هايبرد هجين</option>
                <option value="diesel">ديزل</option>
                <option value="electric">كهرباء</option>
              </select>
            </div>
          </div>

          {/* Row 4: Mileage, Oil Change & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="veh-mileage" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                العداد الحالي (كم) <span className="text-amber-400">*</span>
              </label>
              <NumberInput
                ref={currentMileageRef}
                id="veh-mileage"
                value={currentMileage}
                onChange={(val) => {
                  setCurrentMileage(val);
                  setIsDirty(true);
                }}
                min={vehicle?.currentMileage ?? 0}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-white font-mono text-base sm:text-sm focus:outline-none min-h-[44px] ${
                  fieldErrors.currentMileage ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-amber-500'
                }`}
                required
              />
              {fieldErrors.currentMileage ? (
                <p className="text-xs text-rose-400 font-bold mt-1">{fieldErrors.currentMileage}</p>
              ) : vehicle?.currentMileage ? (
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  القراءة السابقة: {vehicle.currentMileage} كم
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="veh-last-oil" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                عداد آخر تغيير زيت (كم)
              </label>
              <NumberInput
                id="veh-last-oil"
                value={lastOilChangeMileage}
                onChange={(val) => {
                  setLastOilChangeMileage(val);
                  setIsDirty(true);
                }}
                min={0}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white font-mono text-base sm:text-sm focus:outline-none min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="veh-oil-interval" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                دورة تغيير الزيت (كم)
              </label>
              <NumberInput
                id="veh-oil-interval"
                value={oilChangeIntervalKm}
                onChange={(val) => {
                  setOilChangeIntervalKm(val);
                  setIsDirty(true);
                }}
                min={500}
                max={50000}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-white font-mono text-base sm:text-sm focus:outline-none min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="veh-status" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
                حالة السيارة
              </label>
              <select
                id="veh-status"
                value={status}
                disabled={initialStoredStatus === 'rented'}
                onChange={(e) => {
                  setStatus(e.target.value as VehicleStatus);
                  setIsDirty(true);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-amber-500 min-h-[44px] cursor-pointer disabled:opacity-50"
              >
                <option value="available">متاحة (Available)</option>
                <option value="reserved">محجوزة (Reserved)</option>
                <option value="rented" disabled className="disabled:opacity-50">
                  مؤجرة (Rented)
                </option>
                <option value="maintenance">صيانة (Maintenance)</option>
                <option value="inactive">غير نشطة / معطلة (Inactive)</option>
              </select>
              {initialStoredStatus === 'rented' && (
                <p className="text-xs text-amber-400/90 font-bold mt-1">
                  تتغير تلقائياً عند تسليم واستلام السيارة من تفاصيل الحجز
                </p>
              )}
            </div>
          </div>

          {/* Photo Gallery & Upload Section */}
          <div
            ref={imagesRef}
            className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>صور السيارة (رفع مباشر للجهاز)</span>
              </label>
              <span className="text-xs font-bold text-slate-400">
                متبقي {15 - images.length} صور (مرفوع {images.length}/15)
              </span>
            </div>

            {/* Drop / Click Upload Zone */}
            <div
              ref={uploadZoneRef}
              tabIndex={0}
              role="button"
              aria-label="رفع صور السيارة"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
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
              className={`relative border-2 border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer min-h-[100px] flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isDragOver
                  ? 'border-amber-400 bg-amber-500/10'
                  : 'border-slate-800 hover:border-amber-500/50 bg-slate-900/50 hover:bg-slate-900'
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

              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                </div>
                <p className="text-xs font-bold text-slate-200">
                  {isUploading ? 'جاري الرفع والمعالجة...' : 'اضغط أو اسحب الصور إلى هنا للرفع المباشر'}
                </p>
                <p className="text-xs text-slate-400">يدعم JPG, PNG, WebP (يُحظر ملفات HEIC)</p>
              </div>

              {/* Progress Bar */}
              {isUploading && (
                <div className="w-full max-w-xs mt-3 space-y-1">
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
                      style={{ width: `${Math.max(uploadProgress, 10)}%` }}
                    />
                  </div>
                  <span className="text-xs text-amber-400 font-mono">{uploadProgress}% جاري الرفع...</span>
                </div>
              )}
            </div>

            {/* Upload Error Banner */}
            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Summary of Failed Files */}
            {failedFilesSummary.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs space-y-1">
                <p className="font-bold text-rose-400">تعذر رفع بعض الملفات:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  {failedFilesSummary.map((f, idx) => (
                    <li key={idx}>
                      <span className="font-bold text-white">{f.name}:</span> {f.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Uploaded Gallery Grid */}
            {images.length > 0 ? (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between gap-2 pb-1">
                  <span className="text-xs font-bold text-slate-400 block">
                    معرض الصور ({images.length} صورة) — اضغط النجمة لتحديد الصورة الرئيسية:
                  </span>
                  {images.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteAllConfirm(true)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold underline underline-offset-4 cursor-pointer min-h-[36px] inline-flex items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded-lg px-2"
                      aria-label="حذف جميع صور السيارة"
                    >
                      حذف كل الصور
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {images.map((imgUrl, idx) => {
                    const isPrimary = imgUrl === primaryUrl;
                    return (
                      <div
                        key={`${imgUrl}-${idx}`}
                        className={`relative rounded-2xl overflow-hidden border aspect-[16/10] bg-slate-950 transition-all ${
                          isPrimary
                            ? 'border-amber-500 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/20'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <img
                          src={imgUrl}
                          alt={`صورة ${idx + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform hover:scale-105 duration-200"
                        />

                        {/* Primary Badge */}
                        {isPrimary && (
                          <div className="absolute top-2 end-2 px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold flex items-center gap-1 shadow-md z-10">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span>رئيسية</span>
                          </div>
                        )}

                        {/* Always-visible Delete Button or Inline Confirmation */}
                        {confirmingDeleteIndex === idx ? (
                          <div
                            className="absolute top-2 start-2 z-20 flex items-center gap-1 bg-slate-950/95 p-1 rounded-xl border border-rose-500/60 shadow-xl animate-in fade-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => executeDeleteImage(idx)}
                              className="px-2.5 py-1.5 min-h-10 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                              aria-label={`تأكيد حذف الصورة ${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>تأكيد الحذف؟</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelConfirmDelete()}
                              className="px-2 py-1.5 min-h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                              aria-label="إلغاء الحذف"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`delete-img-btn-${idx}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startConfirmDelete(idx);
                            }}
                            className="absolute top-2 start-2 min-h-10 min-w-10 w-10 h-10 inline-flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/60 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 cursor-pointer z-10"
                            title={`حذف الصورة ${idx + 1}`}
                            aria-label={`حذف الصورة ${idx + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Always-visible Set as Primary Button on Non-Primary Images */}
                        {!isPrimary && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPrimaryUrl(imgUrl);
                              setIsDirty(true);
                            }}
                            className="absolute bottom-2 inset-x-2 py-1.5 px-2.5 rounded-xl bg-slate-950/90 hover:bg-amber-500 hover:text-slate-950 text-amber-400 font-bold text-xs border border-amber-500/40 flex items-center justify-center gap-1.5 shadow-md backdrop-blur-sm transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 cursor-pointer z-10 min-h-8"
                            aria-label={`تعيين الصورة ${idx + 1} كرئيسية`}
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span>تعيين كرئيسية</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 text-center rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                لم يتم إضافة أي صورة بعد. يجب إضافة صورة واحدة على الأقل قبل الحفظ.
              </div>
            )}

            {fieldErrors.images && (
              <p className="text-xs text-rose-400 font-bold mt-1">{fieldErrors.images}</p>
            )}

            {/* Manual URL input option */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-xs text-slate-400 hover:text-amber-400 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>{showUrlInput ? 'إخفاء خيار الرابط اليدوي' : 'إضافة رابط صورة يدوي...'}</span>
              </button>

              {showUrlInput && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://example.com/car-photo.jpg"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualUrl}
                    disabled={!manualUrl.trim()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-400 text-xs font-bold cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Features / Specifications Chips */}
          <div>
            <label className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
              المواصفات والتجهيزات (حد أقصى 30 ميزة)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={featureInputValue}
                onChange={(e) => setFeatureInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFeaturesFromText(featureInputValue);
                  }
                }}
                placeholder="أدخل ميزة واضغط إضافة (مثل: كاميرا 360، حساسات ركن، شاشة لمس)..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white text-base sm:text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => addFeaturesFromText(featureInputValue)}
                disabled={!featureInputValue.trim()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة</span>
              </button>
            </div>

            {/* Chips List */}
            {featuresList.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {featuresList.map((feature, idx) => (
                  <span
                    key={`${feature}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    <span>{feature}</span>
                    <button
                      type="button"
                      onClick={() => removeFeatureChip(idx)}
                      className="text-slate-400 hover:text-rose-400 cursor-pointer"
                      title="حذف الميزة"
                      aria-label="حذف الميزة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="veh-desc" className="block text-slate-300 mb-1.5 font-bold text-xs sm:text-sm">
              نبذة / وصف السيارة (حد أقصى 1000 حرف)
            </label>
            <textarea
              id="veh-desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setIsDirty(true);
              }}
              placeholder="وصف إضافي عن حالة السيارة ورغبة العميل..."
              rows={2}
              maxLength={1000}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Form Actions */}
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 sm:p-5 pb-safe z-10 flex items-center gap-3 rounded-b-3xl -mx-6 -mb-6 mt-4">
            <button
              type="button"
              onClick={handleCancelClose}
              disabled={isSaving}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm cursor-pointer transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer transition-all min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري حفظ البيانات...' : isUploading ? 'جاري رفع الصور...' : 'حفظ بيانات السيارة'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Delete All Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteAllConfirm}
        title="حذف كل الصور"
        message="هل أنت متأكد من حذف جميع صور السيارة؟ لن تتمكن من حفظ بيانات السيارة إلا بعد إضافة صورة واحدة على الأقل."
        confirmLabel="حذف كل الصور"
        cancelLabel="إلغاء"
        type="danger"
        onConfirm={handleDeleteAllImages}
        onCancel={() => setShowDeleteAllConfirm(false)}
      />

      {/* Interactive Toast Notification with Undo */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
};
