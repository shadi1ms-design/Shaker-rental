import React, { useState } from 'react';
import {
  Car,
  Phone,
  MessageCircle,
  LayoutDashboard,
  Menu,
  X,
  Calendar,
  LogOut,
  User,
  LogIn,
  UserPlus,
  Sparkles,
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

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenBooking,
  onOpenAuth,
  onOpenProfile,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, isLoadingAuth, logout, isAdmin, isSuperAdmin, isEmployee } = useAuth();

  const handleNav = (view: string) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  const handleProfileClick = () => {
    if (isAdmin) {
      handleNav('admin');
    } else {
      onOpenProfile();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      {/* Top micro-bar with contact info and location */}
      <div className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-1.5 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <a
              href="tel:00963944331774"
              className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-amber-500" />
              <span dir="ltr">00963 944 331 774</span>
            </a>
          </div>

          <div className="flex items-center gap-3">
            {isLoadingAuth ? (
              <div className="flex items-center gap-2 py-0.5 px-2 animate-pulse text-slate-500">
                <div className="w-4 h-4 rounded-full bg-slate-800" />
                <div className="w-16 h-3 rounded bg-slate-800" />
              </div>
            ) : isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleProfileClick}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors py-0.5 px-2 rounded-lg hover:bg-amber-500/10"
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
                  onClick={logout}
                  className="text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors text-xs"
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
                  onClick={() => onOpenAuth('login')}
                  className="text-slate-300 hover:text-amber-400 flex items-center gap-1 transition-colors font-medium text-xs"
                  id="navbar-login-btn"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-500" />
                  <span>تسجيل الدخول</span>
                </button>
                <span className="text-slate-600">|</span>
                <button
                  onClick={() => onOpenAuth('register')}
                  className="text-amber-400 hover:text-amber-300 transition-colors font-bold text-xs flex items-center gap-1"
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div
          onClick={() => handleNav('home')}
          className="flex items-center gap-3 cursor-pointer group"
          id="navbar-brand"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black transition-transform group-hover:scale-105">
            <Car className="w-7 h-7 text-slate-950 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              شاكر <span className="text-amber-400">لتأجير السيارات</span>
            </span>
            <span className="text-xs text-slate-400 font-medium tracking-wide">
              Shaker Car Rental • دمشق – جرمانا
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          <button
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
              onClick={onOpenProfile}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>حجوزاتي</span>
            </button>
          )}

          {/* Admin Dashboard button strictly if user has admin privileges and not loading */}
          {!isLoadingAuth && isAuthenticated && (isAdmin || isSuperAdmin || isEmployee) && (
            <button
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
            onClick={() => openWhatsAppChat()}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600 hover:text-white transition-all text-sm font-semibold shadow-sm"
            title="تواصل مباشر عبر واتساب"
            id="navbar-whatsapp-btn"
          >
            <MessageCircle className="w-4 h-4" />
            <span>واتساب</span>
          </button>

          <button
            onClick={onOpenBooking}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold hover:from-amber-400 hover:to-amber-500 transition-all text-sm shadow-lg shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98]"
            id="navbar-book-now-btn"
          >
            <Calendar className="w-4 h-4" />
            <span>حجز سيارة</span>
          </button>
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2.5 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800"
          aria-label="القائمة"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2">
          {/* User Status header in mobile */}
          {isAuthenticated ? (
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                  {user?.displayName?.charAt(0) || <User className="w-4 h-4" />}
                </div>
                <div>
                  <span className="font-bold text-white text-xs block">{user?.displayName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{user?.email}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="text-xs text-rose-400 font-bold p-1.5 hover:bg-rose-500/10 rounded-lg"
              >
                خروج
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pb-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('login');
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold flex items-center justify-center gap-2 text-xs"
              >
                <LogIn className="w-4 h-4 text-amber-400" />
                <span>تسجيل الدخول</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('register');
                }}
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center gap-2 text-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>إنشاء حساب</span>
              </button>
            </div>
          )}

          <button
            onClick={() => handleNav('home')}
            className="w-full text-right px-4 py-3 rounded-xl bg-slate-900/60 text-slate-200 font-semibold"
          >
            الرئيسية
          </button>
          <button
            onClick={() => handleNav('cars')}
            className="w-full text-right px-4 py-3 rounded-xl bg-slate-900/60 text-slate-200 font-semibold"
          >
            أسطول السيارات
          </button>
          <button
            onClick={() => handleNav('contact')}
            className="w-full text-right px-4 py-3 rounded-xl bg-slate-900/60 text-slate-200 font-semibold"
          >
            تواصل معنا وموقعنا
          </button>

          {isAuthenticated && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenProfile();
              }}
              className="w-full text-right px-4 py-3 rounded-xl bg-slate-900/80 text-amber-400 font-semibold flex items-center justify-between border border-amber-500/20"
            >
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>حسابي وحجوزاتي</span>
              </span>
              <User className="w-4 h-4" />
            </button>
          )}

          {!isLoadingAuth && isAuthenticated && (isAdmin || isSuperAdmin || isEmployee) && (
            <button
              onClick={() => handleNav('admin')}
              className="w-full text-right px-4 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-between"
            >
              <span>لوحة الإدارة الشاملة</span>
              <LayoutDashboard className="w-5 h-5" />
            </button>
          )}

          <div className="pt-2 flex gap-2">
            <button
              onClick={() => {
                openWhatsAppChat();
                setMobileMenuOpen(false);
              }}
              className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 text-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>واتساب 00963944331774</span>
            </button>
            <button
              onClick={() => {
                onOpenBooking();
                setMobileMenuOpen(false);
              }}
              className="flex-1 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-center gap-2 text-xs"
            >
              <Calendar className="w-4 h-4" />
              <span>احجز الآن</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
