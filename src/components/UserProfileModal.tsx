import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Booking } from '../types';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  Car,
  ShieldCheck,
  CheckCircle2,
  X,
  LogOut,
  MessageCircle,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { openWhatsAppChat } from '../services/whatsapp';

interface UserProfileModalProps {
  isOpen: boolean;
  bookings: Booking[];
  onClose: () => void;
  onOpenBooking: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  bookings,
  onClose,
  onOpenBooking,
}) => {
  const { user, logout, isSuperAdmin, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'bookings'>('bookings');

  if (!isOpen || !user) return null;

  // Filter bookings for this user based on phone or email/name
  const userBookings = bookings.filter((b) => {
    if (user.phone && b.customerPhone && b.customerPhone.includes(user.phone.replace(/[^0-9]/g, ''))) return true;
    if (b.customerName && user.displayName && b.customerName.trim().toLowerCase() === user.displayName.trim().toLowerCase()) return true;
    return false;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">مؤكد</span>;
      case 'rented':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">جاري التأجير</span>;
      case 'completed':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">مكتمل</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">ملغي</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">قيد المراجعة</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-slate-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        id="user-profile-modal"
      >
        {/* Glow */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-lg">
              {user.displayName.charAt(0) || <User className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">{user.displayName}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                  {isSuperAdmin ? 'المدير العام' : isAdmin ? 'مسؤول النظام' : 'عميل شاكر'}
                </span>
              </div>
              <span className="text-xs text-slate-400 block font-mono">{user.email}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-slate-800/60">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'bookings'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>حجوزاتي ({userBookings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>بيانات الحساب</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {activeTab === 'bookings' && (
            <div>
              {userBookings.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <Car className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white mb-1">لا توجد حجوزات مسجلة حتى الآن</h3>
                  <p className="text-xs text-slate-400 mb-5 max-w-sm mx-auto">
                    يمكنك تصفح أسطول سياراتنا المميز في دمشق وحجز سيارتك المفضلة فوراً
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenBooking();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20"
                  >
                    احجز سيارتك الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {userBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-amber-500/30 transition-all text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            #{booking.bookingNumber}
                          </span>
                          <span className="font-bold text-white text-sm">{booking.vehicleName}</span>
                        </div>
                        <div>{getStatusBadge(booking.status)}</div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-slate-300 mb-3">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>من: <strong className="text-white">{booking.pickupDate}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>إلى: <strong className="text-white">{booking.returnDate}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>المدة: <strong className="text-white">{booking.rentalDays} أيام</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/40">
                        <div>
                          <span className="text-slate-400">الإجمالي: </span>
                          <span className="font-bold text-white">${booking.totalPrice}</span>
                          {booking.remainingAmount > 0 && (
                            <span className="text-rose-400 mr-2">
                              (المتبقي: ${booking.remainingAmount})
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => openWhatsAppChat(booking)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all text-xs font-semibold"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>متابعة عبر واتساب</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">الاسم الكامل:</span>
                  <span className="font-bold text-white">{user.displayName}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">البريد الإلكتروني:</span>
                  <span className="font-mono text-white">{user.email}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <span className="text-slate-400">رقم الهاتف:</span>
                  <span className="font-mono text-white">{user.phone || 'غير محدد'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">نوع الحساب والصلاحية:</span>
                  <span className="text-amber-400 font-bold">
                    {isSuperAdmin ? 'المدير العام (Super Admin)' : isAdmin ? 'مدير التشغيل' : 'حساب عميل معتمد'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 leading-relaxed">
                ✨ يتم ربط جميع حجوزاتك المستقبلية تلقائياً بحسابك لتقديم أولوية في الحجز وسرعة في استلام وتسليم السيارات عند فروعنا في دمشق.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              logout();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold px-3 py-2 rounded-xl hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج من الحساب</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
