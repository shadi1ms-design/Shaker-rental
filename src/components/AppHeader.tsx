import React, { useState, useRef, useEffect } from 'react';
import { Calendar, MessageCircle, User, LayoutDashboard, LogOut, ChevronDown, ArrowRight, Car } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { openWhatsAppChat } from '../services/whatsapp';
import { MenuButton } from './MenuButton';
import { useBackAction } from '../contexts/BackContext';
import { getPageMeta } from '../routes/pageMeta';
import { RoleBadge } from './common/RoleBadge';
import { Link } from './routing/Link';
import { navigate, routes, type ResolvedRoute } from '../router';
import type { Vehicle } from '../types';

interface AppHeaderProps {
  route: ResolvedRoute;
  vehicle: Vehicle | null;
  loginHref: string;
  registerHref: string;
  onOpenBooking: () => void;
  onOpenProfile: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  route,
  vehicle,
  loginHref,
  registerHref,
  onOpenBooking,
  onOpenProfile,
}) => {
  const { user, role, isAuthenticated, isLoadingAuth, logout, isEmployee } = useAuth();
  const displayRole = role ?? user?.role;
  const onBack = useBackAction();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isHome = route.name === 'home';
  const hasPageH1 = isHome || route.name === 'verifyContract';
  const title = isHome ? '' : getPageMeta(route.name, vehicle).topBarTitle;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100 h-16 flex items-center overflow-x-clip">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full flex items-center justify-between gap-2 sm:gap-3">
        {/* Start side: Logo link (first priority on desktop), Secondary Mobile Menu, Back + Subpage Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 lg:flex-initial">
          <MenuButton className="w-11 h-11 shrink-0 lg:hidden" />

          <Link
            to={routes.home}
            aria-label="شاكر لتأجير السيارات — الرئيسية"
            className="min-h-11 inline-flex items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0 group"
          >
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <Car className="w-5 h-5 stroke-[2.2]" />
            </span>
            <span className={`${isHome ? 'inline' : 'hidden md:inline'} text-sm sm:text-base font-extrabold text-white group-hover:text-amber-300 transition-colors truncate`}>
              شاكر لتأجير السيارات
            </span>
          </Link>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 flex items-center justify-center transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
              aria-label="رجوع"
              title="رجوع"
            >
              <ArrowRight className="w-5 h-5 text-amber-400" />
            </button>
          )}

          {!isHome && (
            hasPageH1 ? (
              <span className="text-sm sm:text-base font-bold text-slate-200 truncate">
                {title}
              </span>
            ) : (
              <h1 className="text-sm sm:text-lg font-extrabold text-white truncate">
                {title}
              </h1>
            )
          )}
        </div>

        {/* Center: Desktop Navigation Links (Visible on lg+) */}
        <nav className="hidden lg:flex items-center gap-1.5" aria-label="التنقل الرئيسي">
          <Link
            to={routes.home}
            aria-current={isHome ? 'page' : undefined}
            className={`min-h-11 px-3.5 rounded-xl text-sm font-semibold transition-colors inline-flex items-center cursor-pointer ${
              isHome
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            الرئيسية
          </Link>
          <Link
            to={routes.cars}
            prefetch
            aria-current={route.name === 'cars' || route.name === 'car' || route.name === 'book' ? 'page' : undefined}
            className={`min-h-11 px-3.5 rounded-xl text-sm font-semibold transition-colors inline-flex items-center cursor-pointer ${
              route.name === 'cars' || route.name === 'car' || route.name === 'book'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            أسطول السيارات
          </Link>
          <Link
            to={routes.contact}
            aria-current={route.name === 'contact' ? 'page' : undefined}
            className={`min-h-11 px-3.5 rounded-xl text-sm font-semibold transition-colors inline-flex items-center cursor-pointer ${
              route.name === 'contact'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
          >
            تواصل معنا
          </Link>

          {isAuthenticated && (
            <Link
              to={routes.profile}
              aria-current={route.name === 'profile' ? 'page' : undefined}
              className={`min-h-11 px-3.5 rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                route.name === 'profile'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>حجوزاتي</span>
            </Link>
          )}
        </nav>

        {/* End Actions: Desktop CTAs + Account Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop Only Buttons: WhatsApp & Book Now */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              type="button"
              onClick={() => openWhatsAppChat()}
              className="min-h-11 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950 transition-all text-sm font-bold shadow-sm cursor-pointer"
              title="تواصل مباشر عبر واتساب"
            >
              <MessageCircle className="w-4 h-4" />
              <span>واتساب</span>
            </button>

            <button
              type="button"
              onClick={onOpenBooking}
              className="min-h-11 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold transition-all text-sm shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
              <span>احجز الآن</span>
            </button>
          </div>

          {/* Auth State Component (Visible across ALL screen sizes) */}
          {isLoadingAuth ? (
            <div
              className="w-11 h-11 rounded-full bg-slate-800/80 border border-slate-700/60 animate-pulse shrink-0"
              aria-label="جاري التحميل..."
            />
          ) : isAuthenticated ? (
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={onOpenProfile}
                aria-label="حسابي وحجوزاتي"
                title="حسابي وحجوزاتي"
                className="w-11 h-11 sm:w-auto sm:min-h-11 sm:px-3 sm:py-1.5 min-w-0 max-w-full rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 flex items-center justify-center gap-2 transition-colors cursor-pointer select-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0"
              >
                <span className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                  {user?.displayName?.trim() ? user.displayName.trim().charAt(0) : <User className="w-3.5 h-3.5" />}
                </span>
                <span className="hidden sm:inline-block text-sm font-bold text-slate-100 max-w-[96px] truncate">
                  {user?.displayName?.trim() ? user.displayName.trim().split(' ')[0] : 'حسابي'}
                </span>
                <span className="hidden md:inline-flex min-w-0 max-w-[120px] shrink">
                  <RoleBadge role={displayRole} size="xs" />
                </span>
              </button>

              {/* Desktop-only dropdown toggle arrow for Admin & Logout (44x44px hit target) */}
              <div className="hidden lg:relative lg:block" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  aria-label="خيارات الحساب والإدارة"
                  title="خيارات الحساب والإدارة"
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all cursor-pointer select-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute end-0 mt-2 w-56 rounded-card bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-800/80">
                      <p className="text-sm font-bold text-white truncate">{user?.displayName}</p>
                      <p className="text-xs text-slate-400 truncate font-mono">{user?.email}</p>
                    </div>

                    <Link
                      to={routes.profile}
                      onClick={() => setDropdownOpen(false)}
                      className="w-full min-h-11 text-start px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <User className="w-4 h-4 text-amber-400" />
                      <span>حسابي وحجوزاتي</span>
                    </Link>

                    {isEmployee && (
                      <Link
                        to={routes.adminDashboard}
                        onClick={() => setDropdownOpen(false)}
                        className="w-full min-h-11 text-start px-4 py-2 text-sm text-amber-400 hover:bg-slate-800 flex items-center gap-2 font-bold cursor-pointer"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>لوحة الإدارة والتحكم</span>
                      </Link>
                    )}

                    <div className="border-t border-slate-800/80 my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate(routes.home, { replace: true });
                        logout();
                      }}
                      className="w-full min-h-11 text-start px-4 py-2 text-sm text-rose-400 hover:bg-slate-800 flex items-center gap-2 font-bold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to={loginHref}
                className="min-h-11 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-bold text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 flex items-center justify-center"
              >
                دخول
              </Link>
              <Link
                to={registerHref}
                className="hidden sm:inline-flex min-h-11 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm items-center justify-center transition-colors shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                إنشاء حساب
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
