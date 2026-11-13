import React, { useRef, useEffect } from 'react';
import {
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
  Home,
  Info,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMenu } from '../contexts/MenuContext';
import { openWhatsAppChat } from '../services/whatsapp';
import { COMPANY_INFO } from '../constants/company';
import { RoleBadge } from './common/RoleBadge';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface GlobalMenuProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenBooking: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenProfile: () => void;
}

/**
 * Slide-out navigation drawer controlled via MenuContext.
 */
export const GlobalMenu: React.FC<GlobalMenuProps> = ({
  currentView,
  onNavigate,
  onOpenBooking,
  onOpenAuth,
  onOpenProfile,
}) => {
  const { isOpen, closeMenu } = useMenu();
  const { user, role, isAuthenticated, isLoadingAuth, logout, isEmployee } = useAuth();
  const displayRole = role ?? user?.role;
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useFocusTrap(drawerRef, {
    isOpen,
    onClose: closeMenu,
    trapTab: true,
    autoFocus: true,
    closeOnEsc: true,
    lockScroll: true,
  });

  // Restore focus explicitly to the menu trigger when drawer closes
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const trigger = document.getElementById('unified-menu-button');
      if (trigger instanceof HTMLElement && trigger.offsetParent !== null) {
        trigger.focus();
      }
    }
  }, [isOpen]);

  const handleNav = (view: string) => {
    onNavigate(view);
    closeMenu();
  };

  return (
    <>
      {/* Drawer Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          onClick={closeMenu}
          aria-hidden="true"
        />
      )}

      {/* Slide-out Menu Drawer (Modal Dialog with Focus Trap) */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="القائمة الرئيسية"
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
        className={`fixed top-0 start-0 z-50 h-full w-full max-w-sm sm:max-w-md bg-slate-950 border-e border-slate-800/90 shadow-2xl transition-[transform,visibility,opacity] duration-300 ease-out flex flex-col justify-between overflow-y-auto ${
          isOpen
            ? 'translate-x-0 opacity-100 visible'
            : 'translate-x-full opacity-0 invisible pointer-events-none'
        }`}
        style={{
          paddingTop: 'max(20px, calc(env(safe-area-inset-top, 0px) + 20px))',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
        }}
        dir="rtl"
      >
        <div className="px-5 space-y-5 flex-1">
          {/* Header Brand + Explicit Close Button */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20 shrink-0">
                <Car className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-white truncate">{COMPANY_INFO.name}</h2>
                <p className="text-sm text-slate-400 truncate">
                  {COMPANY_INFO.city} – {COMPANY_INFO.neighborhood}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeMenu}
              aria-label="إغلاق القائمة"
              title="إغلاق القائمة"
              className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Auth Card */}
          {isLoadingAuth ? (
            <div className="p-3.5 rounded-card bg-slate-900 border border-slate-800 animate-pulse flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-800" />
              <div className="space-y-1.5 flex-1">
                <div className="w-24 h-3 rounded bg-slate-800" />
                <div className="w-36 h-2.5 rounded bg-slate-800" />
              </div>
            </div>
          ) : isAuthenticated ? (
            <div className="p-4 rounded-card bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm flex items-center justify-center border border-amber-500/30 shrink-0">
                    {user?.displayName?.charAt(0) || <User className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-white text-sm block truncate max-w-[160px]">
                      {user?.displayName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono truncate block max-w-[160px]">
                      {user?.email}
                    </span>
                  </div>
                </div>

                <RoleBadge role={displayRole} />
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    onOpenProfile();
                  }}
                  className="w-full min-h-11 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>الذهاب إلى حسابي وحجوزاتي</span>
                </button>
                <div className="flex items-center gap-2">
                  {isEmployee && (
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        handleNav('admin');
                      }}
                      className="flex-1 min-h-11 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors border border-amber-500/20 cursor-pointer"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>لوحة التحكم</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      closeMenu();
                    }}
                    className={`${isEmployee ? 'min-h-11 py-2 px-3' : 'w-full min-h-11 py-2 px-3'} rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer`}
                    title="تسجيل الخروج"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>خروج</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  onOpenAuth('login');
                }}
                className="min-h-11 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white font-bold flex items-center justify-center gap-2 text-sm transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-amber-400" />
                <span>تسجيل الدخول</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  onOpenAuth('register');
                }}
                className="min-h-11 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold flex items-center justify-center gap-2 text-sm transition-colors shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>إنشاء حساب</span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1.5 pt-2" aria-label="روابط القائمة">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                handleNav('home');
              }}
              className={`w-full min-h-11 text-start px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
                currentView === 'home'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-900/60 text-slate-200 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Home className="w-4 h-4 text-amber-400" />
              <span>الرئيسية</span>
            </a>

            <a
              href="/cars"
              onClick={(e) => {
                e.preventDefault();
                handleNav('cars');
              }}
              className={`w-full min-h-11 text-start px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
                currentView === 'cars' || currentView === 'catalog'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-900/60 text-slate-200 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Car className="w-4 h-4 text-amber-400" />
              <span>أسطول السيارات المتاح</span>
            </a>

            <a
              href="/#about-us"
              onClick={(e) => {
                e.preventDefault();
                handleNav('aboutus');
              }}
              className="w-full min-h-11 text-start px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors bg-slate-900/60 text-slate-200 hover:bg-slate-900 hover:text-white"
            >
              <Info className="w-4 h-4 text-amber-400" />
              <span>من نحن</span>
            </a>

            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                handleNav('contact');
              }}
              className={`w-full min-h-11 text-start px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
                currentView === 'contact' || currentView === 'about'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-900/60 text-slate-200 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <Phone className="w-4 h-4 text-amber-400" />
              <span>تواصل معنا وموقعنا</span>
            </a>

            {isAuthenticated && (
              <a
                href="/profile"
                onClick={(e) => {
                  e.preventDefault();
                  closeMenu();
                  onOpenProfile();
                }}
                className={`w-full min-h-11 text-start px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-colors ${
                  currentView === 'profile'
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-900/60 text-slate-200 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>حسابي وحجوزاتي</span>
              </a>
            )}

            {!isLoadingAuth && isAuthenticated && isEmployee && (
              <a
                href="/admin"
                onClick={(e) => {
                  e.preventDefault();
                  handleNav('admin');
                }}
                className={`w-full min-h-11 text-start px-4 py-3 rounded-xl font-extrabold text-sm flex items-center justify-between transition-colors ${
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
              </a>
            )}
          </nav>
        </div>

        {/* Bottom Actions inside drawer */}
        <div className="p-5 border-t border-slate-800 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onOpenBooking();
            }}
            className="w-full min-h-11 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold flex items-center justify-center gap-2 text-sm shadow-lg shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>احجز سيارة الآن</span>
          </button>

          <button
            type="button"
            onClick={() => {
              closeMenu();
              openWhatsAppChat();
            }}
            className="w-full min-h-11 py-2.5 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 font-bold flex items-center justify-center gap-2 text-sm transition-colors cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>واتساب <span dir="ltr" className="font-mono tabular-nums">{COMPANY_INFO.phone}</span></span>
          </button>
        </div>
      </div>
    </>
  );
};
