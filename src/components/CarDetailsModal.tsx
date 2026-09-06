import React from 'react';
import { Vehicle } from '../types';
import { calculateRentalPrice, DEFAULT_SETTINGS } from '../services/pricing';
import { openWhatsAppChat } from '../services/whatsapp';
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
  Info
} from 'lucide-react';

interface CarDetailsModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onBook: (vehicle: Vehicle) => void;
}

export const CarDetailsModal: React.FC<CarDetailsModalProps> = ({
  vehicle,
  onClose,
  onBook,
}) => {
  if (!vehicle) return null;

  const weekly = calculateRentalPrice(vehicle.category, vehicle.dailyPrice, 7, DEFAULT_SETTINGS);
  const monthly = calculateRentalPrice(vehicle.category, vehicle.dailyPrice, 30, DEFAULT_SETTINGS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl my-8 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 p-2 rounded-full bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-950 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Image */}
        <div className="relative h-64 sm:h-72 bg-slate-950">
          <img
            src={vehicle.imageUrl}
            alt={vehicle.model}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/40" />

          <div className="absolute bottom-4 right-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-slate-950">
              {vehicle.category === 'light' ? 'سيدان اقتصادي' : vehicle.category === 'medium' ? 'سيدان متوسط فاخر' : 'جيب عائلي 7 مقاعد'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
              {vehicle.brand} {vehicle.model}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              موديل {vehicle.year} • اللون: {vehicle.color} • لوحة رقم: {vehicle.plateNumber}
            </p>
          </div>
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
              <span className="text-xs text-slate-400 block">الأسبوعي (خصم 5$/يوم)</span>
              <span className="text-xl font-black text-emerald-400">${weekly.subtotal}</span>
              <span className="text-[10px] text-slate-500 block">/ 7 أيام</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">الشهري المعتمد</span>
              <span className="text-xl font-black text-amber-400">${monthly.subtotal}</span>
              <span className="text-[10px] text-slate-500 block">/ 30 يوم</span>
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

            <button
              onClick={() => {
                onClose();
                onBook(vehicle);
              }}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/25"
            >
              <Calendar className="w-4 h-4" />
              <span>متابعة حجز هذه السيارة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
