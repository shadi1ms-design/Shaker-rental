import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  Car,
  Phone,
  Calendar,
  LayoutDashboard,
  User,
  LogIn,
  UserPlus,
  LogOut,
  MessageCircle,
  Shield,
  Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { openWhatsAppChat } from '../services/whatsapp';

interface GlobalMenuProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenBooking: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenProfile: () => void;
}

/**
 * Fixed ☰ Menu button and drawer present across all pages.
 * - Positioned at physical screen RIGHT (top 12-16px, right 12-16px).
 * - Exact same dimensions and rounded corners as the yellow car logo square (w-12 h-12 rounded-xl).
 * - Uses env(safe-area-inset-top) and high z-index (z-50).
 */
export const GlobalMenu: React.FC<GlobalMenuProps> = ({
  currentView,
  onNavigate,
  onOpenBooking,
  onOpenAuth,
  onOpenProfile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, isAuthenticated, isLoadingAuth, logout, isAdmin, isSuperAdmin, isEmployee } = useAuth();

  // Close menu on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleNav = (view: string) => {
    onNavigate(view);
    setIsOpen(false);
  };

  return (
    <>
      {/* Fixed ☰ Menu Button on Physical Right */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          top: 'max(12px, env(safe-area-inset-top, 12px))',
          right: 'max(12px, env(safe-area-inset-right, 12px))',
        }}
        className="fixed z-50 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/25 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة الرئيسية'}
        aria-expanded={isOpen}
        id="global-fixed-menu-button"
        title="القائمة الرئيسية"
      >
        {isOpen ? (
          <X className="w-6 h-6 stroke-[2.6]" />
        ) : (
          <Menu className="w-6 h-6 stroke-[2.6]" />
        )}
      </button>

      {/* Drawer Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-out Menu Drawer */}
      <div
        className={`fixed top-0 right-0 z-40 h-full w-full max-w-sm sm:max-w-md bg-slate-950 border-l border-slate-800/90 shadow-2xl transition-transform duration-300 ease-out flex flex-col justify-between overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          paddingTop: 'max(68px, calc(env(safe-area-inset-top, 0px) + 68px))',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
        }}
        dir="rtl"
      >
        <div className="px-5 space-y-5 flex-1">
          {/* Header Brand within drawer */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Car className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">شاكر لتأجير السيارات</h3>
              <p className="text-[11px] text-slate-400">دمشق – جرمانا • 00963944331774</p>
            </div>
          </div>

          {/* User Auth Card */}
          {isLoadingAuth ? (
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 animate-pulse flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-800" />
              <div className="space-y-1.5 flex-1">
                <div className="w-24 h-3 rounded bg-slate-800" />
                <div className="w-36 h-2.5 rounded bg-slate-800" />
              </div>
            </div>
          ) : isAuthenticated ? (
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm flex items-center justify-center border border-amber-500/30">
                    {user?.displayName?.charAt(0) || <User className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-white text-sm block truncate max-w-[160px]">
                      {user?.displayName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono truncate block max-w-[160px]">
                      {user?.email}
                    </span>
                  </div>
                </div>

                {isSuperAdmin ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-black flex items-center gap-1 shadow-sm shrink-0">
                    <Shield className="w-2.5 h-2.5" />
                    Super Admin
                  </span>
                ) : isAdmin ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center gap-1 shadow-sm shrink-0">
                    <Shield className="w-2.5 h-2.5" />
                    Admin
                  </span>
                ) : isEmployee ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold shrink-0">
                    موظف
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-bold border border-slate-700 shrink-0">
                    عضو
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (isAdmin) handleNav('admin');
                    else onOpenProfile();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{isAdmin ? 'لوحة التحكم' : 'حسابي وحجوزاتي'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAuth('login');
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white font-bold flex items-center justify-center gap-2 text-xs transition-colors"
              >
                <LogIn className="w-4 h-4 text-amber-400" />
                <span>تسجيل الدخول</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAuth('register');
                }}
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center gap-2 text-xs transition-colors shadow-md shadow-amber-500/20"
              >
                <UserPlus className="w-4 h-4" />
                <span>إنشاء حساب</span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <div className="space-y-1.5 pt-2">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className={`w-full text-right px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
                currentView === 'home'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-900/60 text-slate-200 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Home className="w-4 h-4 text-amber-400" />
              <span>الرئيسية</span>
            </button>

            <button
              type="button"
              onClick={() => handleNav('cars')}
              className={`w-full text-right px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
                currentView === 'cars' || currentView === 'catalog'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-900/60 text-slate-200 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Car className="w-4 h-4 text-amber-400" />
              <span>أسطول السيارات المتاح</span>
            </button>

            <button
              type="button"
              onClick={() => handleNav('contact')}
              className={`w-full text-right px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
                currentView === 'contact' || currentView === 'about'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-900/60 text-slate-200 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Phone className="w-4 h-4 text-amber-400" />
              <span>تواصل معنا وموقعنا</span>
            </button>

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenProfile();
                }}
                className={`w-full text-right px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
                  currentView === 'profile'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-900/60 text-slate-200 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>حسابي وحجوزاتي</span>
              </button>
            )}

            {!isLoadingAuth && isAuthenticated && (isAdmin || isSuperAdmin || isEmployee) && (
              <button
                type="button"
                onClick={() => handleNav('admin')}
                className={`w-full text-right px-4 py-3 rounded-xl font-black text-sm flex items-center justify-between transition-colors ${
                  currentView === 'admin'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                    : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>لوحة الإدارة والتحكم</span>
                </span>
                <Shield className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Actions inside drawer */}
        <div className="p-5 border-t border-slate-800 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onOpenBooking();
            }}
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
          >
            <Calendar className="w-4 h-4" />
            <span>احجز سيارة الآن</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              openWhatsAppChat();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 font-bold flex items-center justify-center gap-2 text-xs transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>واتساب 00963944331774</span>
          </button>
        </div>
      </div>
    </>
  );
};
