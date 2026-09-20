import React, { useState, useEffect } from 'react';
import { Vehicle } from '../types';
import { calculateRentalPrice, DEFAULT_SETTINGS } from '../services/pricing';
import { openWhatsAppChat } from '../services/whatsapp';
import { useAuth } from '../contexts/AuthContext';
import { VehicleImagePlaceholder } from './VehicleImagePlaceholder';
import {
  X,
  Users,
  Fuel,
  Settings,
  ShieldCheck,
  Calendar,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  Info,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Maximize2,
} from 'lucide-react';

interface CarDetailsModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onBook?: (vehicle: Vehicle) => void;
  onBookNow?: (vehicle: Vehicle) => void;
}

export const CarDetailsModal: React.FC<CarDetailsModalProps> = ({
  vehicle,
  onClose,
  onBook,
  onBookNow,
}) => {
  if (!vehicle) return null;

  const { isAdmin, isSuperAdmin } = useAuth();
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imagesList =
    vehicle.images && vehicle.images.length > 0
      ? vehicle.images
      : (vehicle.imageUrl ? [vehicle.imageUrl] : []);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const currentImage = imagesList[activeImageIndex] || imagesList[0];

  useEffect(() => {
    setImageError(false);
  }, [vehicle.id, activeImageIndex]);

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % imagesList.length);
  };

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + imagesList.length) % imagesList.length);
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      } else if (e.key === 'ArrowRight') {
        handlePrevImage();
      } else if (e.key === 'ArrowLeft') {
        handleNextImage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, imagesList.length]);

  const weekly = calculateRentalPrice(vehicle.category, vehicle.dailyPrice, 7, DEFAULT_SETTINGS);
  const monthly = calculateRentalPrice(vehicle.category, vehicle.dailyPrice, 30, DEFAULT_SETTINGS);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto pt-4 sm:pt-6 pb-6 sm:pb-6">
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl my-auto animate-in zoom-in-95 duration-200 max-h-[90vh] max-h-[90dvh] flex flex-col overflow-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Close Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 left-4 z-20 p-2 rounded-full bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-950 transition-colors shadow-md cursor-pointer"
          title="إغلاق النافذة"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Modal Body */}
        <div 
          className="overflow-y-auto flex-1 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Hero Image & Gallery Controls */}
          <div 
            className="relative h-60 sm:h-72 md:h-80 bg-slate-950 cursor-pointer group select-none"
            onClick={() => setIsLightboxOpen(true)}
            title="انقر لتكبير الصورة"
          >
            {imageError || !currentImage ? (
              <VehicleImagePlaceholder brand={vehicle.brand} model={vehicle.model} />
            ) : (
              <img
                src={currentImage}
                alt={`${vehicle.brand} ${vehicle.model} - صورة ${activeImageIndex + 1}`}
                className="w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.01]"
                onError={() => setImageError(true)}
              />
            )}

            {/* Subtle Zoom Badge in Corner */}
            <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-full bg-slate-950/75 hover:bg-slate-950/95 backdrop-blur-md text-[11px] font-semibold text-slate-200 border border-slate-700/60 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
              <Maximize2 className="w-3 h-3 text-amber-400" />
              <span>انقر للتكبير</span>
            </div>

            {/* Navigation Arrows if multiple photos exist */}
            {imagesList.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevImage();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/60 hover:bg-slate-950/90 text-white backdrop-blur-sm border border-slate-700/50 transition-all z-10 cursor-pointer shadow-md"
                  title="الصورة السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextImage();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-950/60 hover:bg-slate-950/90 text-white backdrop-blur-sm border border-slate-700/50 transition-all z-10 cursor-pointer shadow-md"
                  title="الصورة التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Photo Indicator Counter */}
                <div 
                  className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-mono text-slate-200 border border-slate-700/60 flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ImageIcon className="w-3 h-3 text-amber-400" />
                  <span>{activeImageIndex + 1} / {imagesList.length}</span>
                </div>
              </>
            )}
          </div>

          {/* Thumbnail gallery stripe if multiple images */}
          {imagesList.length > 1 && (
            <div className="px-6 pt-3 pb-2 flex items-center gap-2 overflow-x-auto bg-slate-950/60 border-b border-slate-800/80">
              {imagesList.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-16 h-12 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                    activeImageIndex === idx
                      ? 'border-amber-500 ring-2 ring-amber-500/30 scale-105'
                      : 'border-slate-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt={`مصغرة ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* New Vehicle Header Info Section (Outside of Image, Clean Background) */}
          <div className="px-6 pt-5 pb-4 bg-slate-900 border-b border-slate-800/80 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                {vehicle.category === 'light' ? 'سيدان اقتصادي' : vehicle.category === 'medium' ? 'سيدان متوسط فاخر' : 'جيب عائلي 7 مقاعد'}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                  vehicle.status === 'available'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : vehicle.status === 'rented'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    vehicle.status === 'available' ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                ></span>
                {vehicle.status === 'available'
                  ? 'متاحة للحجز'
                  : vehicle.status === 'rented'
                  ? 'مؤجرة حالياً'
                  : 'في الصيانة'}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white">
              {vehicle.brand} {vehicle.model}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              موديل {vehicle.year} • اللون: {vehicle.color}
              {(isAdmin || isSuperAdmin) && vehicle.plateNumber ? (
                <span> • لوحة رقم: <strong className="text-amber-400 font-mono font-bold">{vehicle.plateNumber}</strong></span>
              ) : null}
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
          {/* Price tiers box */}
          <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-800/80 rounded-2xl p-4 text-center">
            <div className="border-l border-slate-800">
              <span className="text-xs text-slate-400 block">السعر اليومي</span>
              <span className="text-xl font-black text-amber-400">${vehicle.dailyPrice}</span>
              <span className="text-[10px] text-slate-500 block">/ يوم</span>
            </div>
            <div className="border-l border-slate-800">
              <span className="text-xs text-slate-400 block">حساب 7 أيام</span>
              <span className="text-xl font-black text-slate-200">${weekly.subtotal}</span>
              <span className="text-[10px] text-slate-500 block">/ أسبوع</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">حساب 30 يوم</span>
              <span className="text-xl font-black text-slate-200">${monthly.subtotal}</span>
              <span className="text-[10px] text-slate-500 block">/ شهر</span>
            </div>
          </div>

          {/* Key specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800/60 p-3 rounded-xl flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-slate-400 block">المقاعد</span>
                <span className="text-white font-bold">{vehicle.seats} ركاب</span>
              </div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-slate-400 block">الناقل</span>
                <span className="text-white font-bold">{vehicle.transmission === 'automatic' ? 'أوتوماتيك' : 'عادي'}</span>
              </div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-slate-400 block">الوقود</span>
                <span className="text-white font-bold">{vehicle.fuelType}</span>
              </div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-slate-400 block">العداد الحالي</span>
                <span className="text-white font-bold">{vehicle.currentMileage != null ? vehicle.currentMileage.toLocaleString() : '0'} كم</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {vehicle.description && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400" />
                نبذة عن السيارة
              </h4>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                {vehicle.description}
              </p>
            </div>
          )}

          {/* Features */}
          {vehicle.features && vehicle.features.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                مواصفات وتجهيزات الراحة
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vehicle.features.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insurance note */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-white font-semibold block">قواعد التأمين المسترد:</span>
              <span>للحجوزات يوم أو يومين: التأمين 500$. لأكثر من يومين: التأمين 300$. يُسترد التأمين بالكامل فور تسليم السيارة بحالتها.</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => openWhatsAppChat(undefined, `مرحباً شركة شاكر، أود الاستفسار عن سيارة ${vehicle.brand} ${vehicle.model} موديل ${vehicle.year}`)}
              className="px-4 py-3 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>استفسار عبر واتساب</span>
            </button>

            {vehicle.status === 'available' ? (
              <button
                onClick={() => {
                  onClose();
                  const bookFn = onBookNow || onBook;
                  if (typeof bookFn === 'function') {
                    bookFn(vehicle);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>متابعة حجز هذه السيارة</span>
              </button>
            ) : (
              <button
                disabled
                className="flex-1 py-3 rounded-xl bg-slate-800 text-rose-300 border border-rose-500/30 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
              >
                <Info className="w-4 h-4 text-rose-400" />
                <span>{vehicle.status === 'rented' ? 'السيارة مؤجرة حالياً' : 'السيارة غير متاحة حالياً'}</span>
              </button>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Lightbox Modal for Fullscreen Uncropped Image */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-150"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 p-2.5 sm:p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer shadow-lg"
            title="إغلاق التكبير (ESC)"
            aria-label="إغلاق"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Photo Counter in Lightbox */}
          {imagesList.length > 1 && (
            <div 
              className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-xs font-mono text-slate-200 border border-slate-700/60 flex items-center gap-2 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>{activeImageIndex + 1} / {imagesList.length}</span>
            </div>
          )}

          {/* Navigation Arrows in Lightbox */}
          {imagesList.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage();
                }}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/60 transition-all z-20 shadow-xl cursor-pointer"
                title="الصورة السابقة"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/60 transition-all z-20 shadow-xl cursor-pointer"
                title="الصورة التالية"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Full uncropped image container */}
          <div
            className="relative max-w-5xl max-h-[85vh] w-full flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentImage}
              alt={`${vehicle.brand} ${vehicle.model} - عرض مكبّر`}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
};
