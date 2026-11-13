import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Vehicle, AppSettings } from '../types';
import { calculateRentalPrice, DEFAULT_SETTINGS } from '../services/pricing';
import { openWhatsAppChat } from '../services/whatsapp';
import { useAuth } from '../contexts/AuthContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { dataService } from '../services/dataService';
import { formatMoney } from '../utils/format';
import { getFuelLabel, getTransmissionLabel } from '../constants/vehicleLabels';
import { getVehicleCategoryLabel } from '../constants/vehicleCategories';
import { VEHICLE_STATUS_META } from '../constants/statusMeta';
import { useVehicleAvailability } from '../utils/vehicleAvailability';
import { VehicleImagePlaceholder } from './common/VehicleImagePlaceholder';
import {
  X,
  Users,
  Fuel,
  Settings,
  ShieldCheck,
  Calendar,
  MessageCircle,
  CheckCircle2,
  Info,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Maximize2,
  Clock,
} from 'lucide-react';

export interface CarDetailsViewProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onBook?: (vehicle: Vehicle) => void;
  onBookNow?: (vehicle: Vehicle) => void;
}

export type CarDetailsModalProps = CarDetailsViewProps;

export const CarDetailsView: React.FC<CarDetailsViewProps> = ({
  vehicle,
  onClose,
  onBook,
  onBookNow,
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const modalRef = useFocusTrap({
    isOpen: Boolean(vehicle),
    onClose: () => (isLightboxOpen ? setIsLightboxOpen(false) : onClose()),
    trapTab: false,
  });
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const isUserLoggedIn = Boolean(user);
  const [liveSettings, setLiveSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [imageError, setImageError] = useState(false);

  const mobileBottomBarRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const barEl = mobileBottomBarRef.current;
    let observer: ResizeObserver | null = null;

    if (barEl) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
          document.documentElement.style.setProperty('--bottom-bar-h', `${Math.round(h)}px`);
        }
      });
      observer.observe(barEl);
    } else {
      document.documentElement.style.setProperty('--bottom-bar-h', '72px');
    }

    dataService
      .getSettings()
      .then((settings) => {
        if (isMounted && settings) {
          setLiveSettings(settings);
        }
      })
      .catch((err) => {
        console.error('Failed to load settings in CarDetailsModal:', err);
      });

    return () => {
      isMounted = false;
      if (observer) observer.disconnect();
      document.documentElement.style.setProperty('--bottom-bar-h', '0px');
    };
  }, []);

  const imagesList =
    vehicle?.images && vehicle.images.length > 0
      ? vehicle.images
      : (vehicle?.imageUrl ? [vehicle.imageUrl] : []);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const currentImage = imagesList[activeImageIndex] || imagesList[0];

  useEffect(() => {
    queueMicrotask(() => setImageError(false));
  }, [vehicle?.id, activeImageIndex]);

  const handleNextImage = useCallback(() => {
    setActiveImageIndex((prev) => (prev + 1) % (imagesList.length || 1));
  }, [imagesList.length]);

  const handlePrevImage = useCallback(() => {
    setActiveImageIndex((prev) => (prev - 1 + (imagesList.length || 1)) % (imagesList.length || 1));
  }, [imagesList.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || imagesList.length <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const diff = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    // In RTL strip, swiping right pushes current slide right to reveal next slide on left
    if (diff > 40) {
      handleNextImage();
    } else if (diff < -40) {
      handlePrevImage();
    }
  };

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
  }, [isLightboxOpen, handleNextImage, handlePrevImage]);

  const { nextAvailableDate } = useVehicleAvailability(vehicle);

  if (!vehicle) return null;

  const weekly = calculateRentalPrice(vehicle.category, vehicle.dailyPrice, 7, liveSettings, {
    isUserLoggedIn,
    vehicleId: vehicle.id,
  });
  const monthly = calculateRentalPrice(vehicle.category, vehicle.dailyPrice, 30, liveSettings, {
    isUserLoggedIn,
    vehicleId: vehicle.id,
  });

  const isAvailable = vehicle.status === 'available';
  const isReservedOrRented = vehicle.status === 'reserved' || vehicle.status === 'rented';

  return (
    <div className="flex items-start justify-center p-3 sm:p-6 bg-slate-950" style={{ paddingBottom: 'var(--bottom-bar-h, 0px)' }}>
      <div
        ref={modalRef}
        className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-card sm:rounded-modal shadow-2xl animate-in fade-in duration-200 overflow-hidden"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="min-w-11 min-h-11 absolute top-4 start-4 z-25 p-2.5 rounded-full bg-slate-950/85 text-slate-200 hover:text-white hover:bg-slate-950 inline-flex items-center justify-center transition-colors shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          title="العودة للأسطول"
          aria-label="إغلاق تفاصيل السيارة"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Main 2-Column Desktop Layout / Stacked Mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Images & Details (7 cols on lg) */}
          <div className="lg:col-span-7 p-4 sm:p-6 space-y-6">
            {/* Hero Image & Gallery Controls */}
            <div
              className="relative aspect-[16/10] sm:h-80 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.12)_0%,_rgba(15,23,42,0.98)_72%)] rounded-card overflow-hidden cursor-pointer group select-none flex items-center justify-center"
              onClick={() => setIsLightboxOpen(true)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              title="انقر لتكبير الصورة"
            >
              {imageError || !currentImage ? (
                <VehicleImagePlaceholder brand={vehicle.brand} model={vehicle.model} />
              ) : (
                <img
                  src={currentImage}
                  alt={`${vehicle.brand} ${vehicle.model} - صورة ${activeImageIndex + 1}`}
                  loading="eager"
                  decoding="async"
                  className="relative z-10 w-full h-full object-contain p-2 select-none transition-all duration-300 group-hover:scale-[1.01]"
                  onError={() => setImageError(true)}
                />
              )}

              {/* Zoom Badge */}
              <div className="absolute bottom-3 start-3 z-10 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-xs font-semibold text-slate-200 border border-slate-700/60 flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                <span>انقر للتكبير</span>
              </div>

              {/* Navigation Arrows (RTL: Prev right/start, Next left/end; >= 44x44px hit area) */}
              {imagesList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrevImage();
                    }}
                    className="min-w-11 min-h-11 absolute start-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-slate-950/75 hover:bg-slate-950 text-white backdrop-blur-sm border border-slate-700/60 transition-all z-10 cursor-pointer shadow-md"
                    aria-label="الصورة السابقة"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNextImage();
                    }}
                    className="min-w-11 min-h-11 absolute end-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center rounded-full bg-slate-950/75 hover:bg-slate-950 text-white backdrop-blur-sm border border-slate-700/60 transition-all z-10 cursor-pointer shadow-md"
                    aria-label="الصورة التالية"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* Counter like "2 / 6" */}
                  <div className="absolute top-4 end-4 z-10 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md text-xs font-mono font-bold text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shadow-md tabular-nums">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{activeImageIndex + 1} / {imagesList.length}</span>
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail gallery stripe */}
            {imagesList.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2" dir="rtl">
                {imagesList.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    aria-label={`عرض الصورة رقم ${idx + 1}`}
                    className={`relative w-16 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      activeImageIndex === idx
                        ? 'border-amber-500 ring-2 ring-amber-500/30 scale-105'
                        : 'border-slate-800 opacity-65 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`مصغرة ${idx + 1}`} loading="lazy" decoding="async" width={64} height={48} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Title & Status */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
                  {getVehicleCategoryLabel(vehicle.category)}
                </span>
                {isReservedOrRented ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md bg-amber-500/20 text-amber-300 border border-amber-500/40 tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>
                      {nextAvailableDate ? `متاحة بدءاً من ${nextAvailableDate}` : 'محجوزة حالياً'}
                    </span>
                  </span>
                ) : (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${VEHICLE_STATUS_META[vehicle.status].badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${VEHICLE_STATUS_META[vehicle.status].dotClass} ${isAvailable ? 'animate-pulse' : ''}`} />
                    <span>{VEHICLE_STATUS_META[vehicle.status].label}</span>
                  </span>
                )}
              </div>

              <h2 id="car-details-title" className="text-2xl font-extrabold text-white">
                {vehicle.brand} {vehicle.model} ({vehicle.year})
              </h2>

              <p className="text-sm text-slate-300">
                اللون: {vehicle.color}
                {(isAdmin || isSuperAdmin) && vehicle.plateNumber ? (
                  <span> • لوحة رقم: <strong className="text-amber-400 font-mono">{vehicle.plateNumber}</strong></span>
                ) : null}
              </p>
            </div>

            {/* Formatted Specs Table (14px font) */}
            <div className="bg-slate-950 border border-slate-800 rounded-card p-4 space-y-3 text-sm">
              <h3 className="font-bold text-amber-400 text-sm">المواصفات الأساسية والتشغيلية</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300 flex items-center gap-1.5"><Users className="w-4 h-4 text-amber-400" /> مقاعد الركاب</span>
                  <span className="font-bold text-white tabular-nums">{vehicle.seats} مقاعد</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300 flex items-center gap-1.5"><Settings className="w-4 h-4 text-amber-400" /> ناقل الحركة</span>
                  <span className="font-bold text-white">{getTransmissionLabel(vehicle.transmission)}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300 flex items-center gap-1.5"><Fuel className="w-4 h-4 text-amber-400" /> نوع الوقود</span>
                  <span className="font-bold text-white">{getFuelLabel(vehicle.fuelType)}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800/80">
                  <span className="text-slate-300 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-amber-400" /> سنة الصنع</span>
                  <span className="font-bold text-white tabular-nums">{vehicle.year}</span>
                </div>
              </div>
            </div>

            {/* Description & Features */}
            {vehicle.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-200">نبذة عن السيارة</h3>
                <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-card border border-slate-800/80">
                  {vehicle.description}
                </p>
              </div>
            )}

            {vehicle.features && vehicle.features.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-200">مواصفات وتجهيزات الراحة</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {vehicle.features.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Summary Column on lg (5 cols on lg) */}
          <div className="lg:col-span-5 bg-slate-950 p-4 sm:p-6 border-t lg:border-t-0 lg:border-s border-slate-800 flex flex-col justify-between space-y-6">
            <div className="space-y-5 lg:sticky lg:top-6">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-sm text-slate-400 block mb-1">سعر الإيجار اليومي</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-amber-400 tabular-nums">{formatMoney(vehicle.dailyPrice)}</span>
                  <span className="text-sm text-slate-400">/ يوم</span>
                </div>
              </div>

              {/* Tiers box */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-card">
                  <span className="text-sm text-slate-300 block mb-1">حساب 7 أيام</span>
                  <span className="text-lg font-extrabold text-white tabular-nums">{formatMoney(weekly.subtotal)}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-card">
                  <span className="text-sm text-slate-300 block mb-1">حساب 30 يوم</span>
                  <span className="text-lg font-extrabold text-white tabular-nums">{formatMoney(monthly.subtotal)}</span>
                </div>
              </div>

              {/* Cost summary breakdown */}
              <div className="space-y-3 bg-slate-900/80 border border-slate-800 rounded-card p-4 text-sm">
                <div className="flex justify-between items-center text-slate-300">
                  <span>التأمين النقدي المسترد:</span>
                  <span className="font-bold text-amber-300 tabular-nums">
                    {formatMoney(liveSettings.insuranceShortTerm ?? liveSettings.insurance1to2Days ?? 500)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>رسوم السائق (اختياري):</span>
                  <span className="font-bold text-slate-200 tabular-nums">
                    {formatMoney(liveSettings.driverDailyRate ?? 40)} / يوم
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300 border-t border-slate-800 pt-2">
                  <span>خصم الأعضاء المسجلين:</span>
                  <span className="font-bold text-emerald-400 tabular-nums">
                    حتى {liveSettings.discountConfig?.percentage || 10}%
                  </span>
                </div>
              </div>

              {/* Desktop Actions */}
              <div className="hidden lg:flex flex-col gap-3 pt-2">
                {isAvailable ? (
                  <button
                    type="button"
                    onClick={() => {
                      const bookFn = onBookNow || onBook;
                      if (typeof bookFn === 'function') bookFn(vehicle);
                    }}
                    className="w-full min-h-11 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>متابعة حجز هذه السيارة</span>
                  </button>
                ) : isReservedOrRented ? (
                  <button
                    type="button"
                    onClick={() => {
                      const bookFn = onBookNow || onBook;
                      if (typeof bookFn === 'function') bookFn(vehicle);
                    }}
                    className="w-full min-h-11 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 cursor-pointer transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>
                      {nextAvailableDate ? `حجز مسبق (متاحة بدءاً من ${nextAvailableDate})` : 'متابعة الحجز المسبق'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full min-h-11 py-3.5 rounded-xl bg-slate-800/80 text-rose-300 border border-rose-500/20 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
                  >
                    <Clock className="w-4 h-4 text-rose-400" />
                    <span>السيارة في الصيانة الدورية</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openWhatsAppChat(undefined, `مرحباً شركة شاكر، أود الاستفسار عن توفر سيارة ${vehicle.brand} ${vehicle.model}`)}
                  className="w-full min-h-11 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Info className="w-4 h-4 text-amber-400" />
                  <span>اسأل عن التوفر عبر واتساب</span>
                </button>

                <button
                  type="button"
                  onClick={() => openWhatsAppChat(undefined, `مرحباً شركة شاكر، أود الاستفسار عن سيارة ${vehicle.brand} ${vehicle.model} موديل ${vehicle.year}`)}
                  className="w-full min-h-11 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>تواصل مباشر واتساب</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Fixed Bottom Bar (Price + Book Button + Safe Area) */}
        <div ref={mobileBottomBarRef} className="lg:hidden fixed bottom-0 start-0 end-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex items-center justify-between gap-3 shadow-2xl">
          <div>
            <span className="text-xs text-slate-400 block">السعر اليومي</span>
            <span className="text-lg font-extrabold text-amber-400 tabular-nums">{formatMoney(vehicle.dailyPrice)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openWhatsAppChat(undefined, `مرحباً شركة شاكر، أود الاستفسار عن سيارة ${vehicle.brand} ${vehicle.model}`)}
              className="min-w-11 min-h-11 p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 inline-flex items-center justify-center transition-colors cursor-pointer"
              aria-label="تواصل واتساب"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            {isAvailable ? (
              <button
                type="button"
                onClick={() => {
                  const bookFn = onBookNow || onBook;
                  if (typeof bookFn === 'function') bookFn(vehicle);
                }}
                className="min-h-11 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <span>احجز الآن</span>
              </button>
            ) : isReservedOrRented ? (
              <button
                type="button"
                onClick={() => {
                  const bookFn = onBookNow || onBook;
                  if (typeof bookFn === 'function') bookFn(vehicle);
                }}
                className="min-h-11 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <span>حجز مسبق</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="min-h-11 px-4 py-3 rounded-xl bg-slate-800 text-rose-300 border border-rose-500/20 font-bold text-sm cursor-not-allowed opacity-90"
              >
                <span>في الصيانة</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none animate-in fade-in duration-150"
          onClick={() => setIsLightboxOpen(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="min-w-11 min-h-11 absolute top-4 start-4 sm:top-6 sm:start-6 z-20 p-2.5 sm:p-3 rounded-full bg-slate-900/85 text-white border border-slate-700/60 inline-flex items-center justify-center transition-all cursor-pointer shadow-lg"
            aria-label="إغلاق العرض المكبر"
          >
            <X className="w-6 h-6" />
          </button>

          {imagesList.length > 1 && (
            <div className="absolute top-4 end-4 sm:top-6 sm:end-6 z-20 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md text-xs font-mono font-bold text-amber-400 border border-slate-700/60 flex items-center gap-2 shadow-lg tabular-nums">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{activeImageIndex + 1} / {imagesList.length}</span>
            </div>
          )}

          <div
            className="relative max-w-5xl max-h-[85dvh] w-full flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentImage}
              alt={`${vehicle.brand} ${vehicle.model} - عرض مكبّر`}
              loading="lazy"
              width="1200"
              height="800"
              className="max-w-full max-h-[85dvh] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CarDetailsView;
