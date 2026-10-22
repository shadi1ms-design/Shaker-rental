import React from 'react';
import {
  Car,
  Phone,
  MessageCircle,
  LayoutDashboard,
  Calendar,
  LogOut,
  User,
  LogIn,
  UserPlus,
  Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { openWhatsAppChat } from '../services/whatsapp';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenBooking: () => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onOpenProfile: () => void;
}

/**
 * Full Header for the Home Page only.
 * - Non-sticky (scrolls naturally with content).
 * - Leaves lateral right margin (pr-16 sm:pr-20) to prevent any overlap
 *   with the globally fixed ☰ menu button at top-right.
 * - Resolved previous collision between menu button and auth links.
 */
export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenBooking,
  onOpenAuth,
  onOpenProfile,
}) => {
  const { user, isAuthenticated, isLoadingAuth, logout, isAdmin, isSuperAdmin, isEmployee } = useAuth();

  const handleNav = (view: string) => {
    onNavigate(view);
  };

  const handleProfileClick = () => {
    if (isAdmin) {
      handleNav('admin');
    } else {
      onOpenProfile();
    }
  };

  return (
    <header className="relative z-20 bg-slate-950 border-b border-slate-800 text-slate-100">
      {/* Top micro-bar with contact info and auth */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 pr-16 sm:pr-20">
          {/* Phone Contact */}
          <div className="flex items-center gap-3">
            <a
              href="tel:00963944331774"
              className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 transition-colors"
              title="اتصال مباشر بالفرع"
            >
              <Phone className="w-3.5 h-3.5 text-amber-500" />
              <span dir="ltr">00963 944 331 774</span>
            </a>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="hidden sm:inline text-slate-400">دمشق – جرمana</span>
          </div>

          {/* User Auth Info */}
          <div className="flex items-center gap-3">
            {isLoadingAuth ? (
              <div className="flex items-center gap-2 py-0.5 px-2 animate-pulse text-slate-500">
                <div className="w-4 h-4 rounded-full bg-slate-800" />
                <div className="w-16 h-3 rounded bg-slate-800" />
              </div>
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleProfileClick}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors py-0.5 px-2 rounded-lg hover:bg-amber-500/10 cursor-pointer"
                  title={isAdmin ? 'لوحة تحكم الإدارة (Admin View)' : 'عرض بيانات الحساب والحجوزات'}
                  id="navbar-profile-btn"
                >
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] flex items-center justify-center border border-amber-500/30">
                    {user?.displayName?.charAt(0) || <User className="w-3 h-3" />}
                  </div>
                  <span className="font-semibold max-w-[130px] truncate">{user?.displayName}</span>
                  {isSuperAdmin ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-black flex items-center gap-1 shadow-sm">
                      <Shield className="w-2.5 h-2.5" />
                      Super Admin
                    </span>
                  ) : isAdmin ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black flex items-center gap-1 shadow-sm">
                      <Shield className="w-2.5 h-2.5" />
                      Admin
                    </span>
                  ) : isEmployee ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center gap-1">
                      موظف
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      حسابي
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors text-xs cursor-pointer"
                  title="تسجيل الخروج"
                  id="navbar-logout-btn"
                >
                  <LogOut className="w-3 h-3" />
                  <span>خروج</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="text-slate-300 hover:text-amber-400 flex items-center gap-1 transition-colors font-medium text-xs cursor-pointer"
                  id="navbar-login-btn"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-500" />
                  <span>تسجيل الدخول</span>
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="text-amber-400 hover:text-amber-300 transition-colors font-bold text-xs flex items-center gap-1 cursor-pointer"
                  id="navbar-register-btn"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>إنشاء حساب</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between pr-16 sm:pr-20">
        {/* Brand Logo & Name */}
        <div
          onClick={() => handleNav('home')}
          className="flex items-center gap-3 cursor-pointer group"
          id="navbar-brand"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black transition-transform group-hover:scale-105 shrink-0">
            <Car className="w-7 h-7 text-slate-950 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              شاكر <span className="text-amber-400">لتأجير السيارات</span>
            </span>
            <span className="text-[11px] sm:text-xs text-slate-400 font-medium tracking-wide">
              Shaker Car Rental • دمشق – جرمانا
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 lg:gap-2">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              currentView === 'home'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            الرئيسية
          </button>
          <button
            type="button"
            onClick={() => handleNav('cars')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              currentView === 'cars' || currentView === 'catalog'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            أسطول السيارات
          </button>
          <button
            type="button"
            onClick={() => handleNav('contact')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              currentView === 'contact'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            تواصل معنا
          </button>

          {/* Customer reservations link if logged in */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>حجوزاتي</span>
            </button>
          )}

          {/* Admin Dashboard button strictly if user has admin privileges */}
          {!isLoadingAuth && isAuthenticated && (isAdmin || isSuperAdmin || isEmployee) && (
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                currentView === 'admin'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-amber-400 hover:bg-amber-500/10 border border-amber-500/30'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>لوحة الإدارة</span>
            </button>
          )}
        </nav>

        {/* Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            type="button"
            onClick={() => openWhatsAppChat()}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all text-sm font-semibold shadow-sm cursor-pointer"
            title="تواصل مباشر عبر واتساب"
            id="navbar-whatsapp-btn"
          >
            <MessageCircle className="w-4 h-4" />
            <span>واتساب</span>
          </button>

          <button
            type="button"
            onClick={onOpenBooking}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold hover:from-amber-400 hover:to-amber-500 transition-all text-sm shadow-lg shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            id="navbar-book-now-btn"
          >
            <Calendar className="w-4 h-4" />
            <span>حجز سيارة</span>
          </button>
        </div>
      </div>
    </header>
  );
};
