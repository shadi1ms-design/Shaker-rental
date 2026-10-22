import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MenuProvider } from './contexts/MenuContext';
import { Vehicle, Booking, AppSettings, SearchFilters } from './types';
import { dataService } from './services/dataService';
import { useLocation, navigate, matchPath, goBack, routes } from './router';
import { openWhatsAppChat } from './services/whatsapp';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { CarCatalog } from './components/CarCatalog';
import { ContactPage } from './components/ContactPage';
import { AdminDashboard, AdminTabType } from './components/AdminDashboard';
import { EmailVerificationGate } from './components/EmailVerificationGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { VehicleImagePlaceholder } from './components/VehicleImagePlaceholder';
import { useDocumentTitle } from './hooks/useDocumentTitle';

// Heavy modals lazy loaded with React.lazy
const CarDetailsModal = React.lazy(() => import('./components/CarDetailsModal').then((m) => ({ default: m.CarDetailsModal })));
const BookingModal = React.lazy(() => import('./components/BookingModal').then((m) => ({ default: m.BookingModal })));
const AuthModal = React.lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const UserProfileModal = React.lazy(() => import('./components/UserProfileModal').then((m) => ({ default: m.UserProfileModal })));

import {
  MessageCircle,
  Shield,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  KeyRound,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { PageTopBar } from './components/common/PageTopBar';
import { PageHeaderBanner } from './components/common/PageHeaderBanner';
import { GlobalMenu } from './components/GlobalMenu';
import { motion } from 'motion/react';
import {
  getPageVariants,
  getStaggerVariants,
  getItemVariants,
} from './constants/motion';

function MainAppContent() {
  const {
    user,
    isSuperAdmin,
    isAdmin,
    isEmployee,
    isLoadingAuth,
    loginWithEmail,
    loginWithGoogle
  } = useAuth();

  const isStaffAuthorized = isAdmin || isEmployee;

  // App Navigation View
  const { pathname } = useLocation();
  const carDetailsMatch = matchPath('/cars/:id', pathname);
  const carBookingMatch = matchPath('/cars/:id/book', pathname);
  const isAdminRoute = pathname.startsWith('/admin');
  const currentView: 'home' | 'catalog' | 'about' | 'admin' | 'login' | 'register' | 'profile' | 'dashboard' | 'notfound' =
    isAdminRoute
      ? 'admin'
      : pathname === '/dashboard'
      ? 'dashboard'
      : pathname === '/'
      ? 'home'
      : pathname === '/cars' || pathname === '/catalog' || carDetailsMatch || carBookingMatch
      ? 'catalog'
      : pathname === '/about' || pathname === '/contact'
      ? 'about'
      : pathname === '/login'
      ? 'login'
      : pathname === '/register'
      ? 'register'
      : pathname === '/profile'
      ? 'profile'
      : 'notfound';

  // Core Data State - Immediate cache bootstrap for 0ms initial render
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => dataService.getCachedVehicles());
  const [bookings, setBookings] = useState<Booking[]>(() => dataService.getCachedBookings());
  const [settings, setSettings] = useState<AppSettings>(() => dataService.getCachedSettings());
  const [vehiclesReady, setVehiclesReady] = useState<boolean>(() => dataService.getCachedVehicles().length > 0);
  const routeVehicleId = carDetailsMatch?.id || carBookingMatch?.id;
  const routeVehicle = routeVehicleId ? vehicles.find((v) => v.id === routeVehicleId) || null : null;

  // Dynamic document title based on current path and state
  const currentTitle = React.useMemo(() => {
    if (isAdminRoute) return 'لوحة الإدارة';
    if (pathname === '/profile') return 'حسابي';
    if (pathname === '/login') return 'تسجيل الدخول';
    if (pathname === '/register') return 'إنشاء حساب جديد';
    if (pathname === '/about' || pathname === '/contact') return 'تواصل معنا';
    if (carBookingMatch) {
      return routeVehicle ? `حجز ${routeVehicle.brand} ${routeVehicle.model}` : 'حجز سيارة';
    }
    if (carDetailsMatch) {
      return routeVehicle ? `${routeVehicle.brand} ${routeVehicle.model}` : 'تفاصيل السيارة';
    }
    if (pathname === '/cars' || pathname === '/catalog') return 'أسطول السيارات';
    return 'الرئيسية';
  }, [isAdminRoute, pathname, carBookingMatch, carDetailsMatch, routeVehicle]);

  useDocumentTitle(currentTitle);

  // Admin login form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // Search filters carried from the hero search to the catalog / booking pages
  const [activeBookingFilters, setActiveBookingFilters] = useState<SearchFilters | undefined>(undefined);

  // Success Notification
  const [lastCreatedBooking, setLastCreatedBooking] = useState<Booking | null>(null);

  // Restore persisted recent booking on auth load
  useEffect(() => {
    if (!user?.uid) {
      setLastCreatedBooking(null);
      return;
    }
    try {
      const saved = localStorage.getItem(`shaker_recent_booking_${user.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) {
          setLastCreatedBooking(prev => prev || (parsed as Booking));
        }
      }
    } catch {}
  }, [user?.uid]);

  // Dismiss persisted recent booking if status changes from 'new' / 'reviewing' in live Firestore data
  useEffect(() => {
    if (!lastCreatedBooking || !user?.uid) return;
    const found = bookings.find((b) => b.id === lastCreatedBooking.id || b.bookingNumber === lastCreatedBooking.bookingNumber);
    if (found && found.status !== 'new' && found.status !== 'reviewing') {
      setLastCreatedBooking(null);
      try {
        localStorage.removeItem(`shaker_recent_booking_${user.uid}`);
      } catch {}
    }
  }, [bookings, lastCreatedBooking, user?.uid]);

  const handleBookingCreated = (b: Booking) => {
    setLastCreatedBooking(b);
    refreshData();
    if (user?.uid) {
      try {
        const minimalSummary = {
          id: b.id,
          bookingNumber: b.bookingNumber || b.id,
          vehicleName: b.vehicleName,
          status: b.status || 'new',
          createdAt: b.createdAt || new Date().toISOString(),
        };
        localStorage.setItem(`shaker_recent_booking_${user.uid}`, JSON.stringify(minimalSummary));
      } catch {}
    }
  };

  // Home Page Interaction State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [previewImageErrors, setPreviewImageErrors] = useState<Record<string, boolean>>({});

  // Admin auto-navigation ref to avoid trapping user in an infinite redirect loop
  const hasAutoNavigatedAdminRef = useRef(false);

  // When admin logs in, automatically show admin view once instead of normal dashboard
  useEffect(() => {
    if (isAdmin && !hasAutoNavigatedAdminRef.current) {
      hasAutoNavigatedAdminRef.current = true;
      if (!window.location.pathname.startsWith('/admin')) {
        navigate(routes.adminDashboard, { replace: true });
      }
    } else if (!isAdmin) {
      hasAutoNavigatedAdminRef.current = false;
    }
  }, [isAdmin]);

  // /dashboard: staff -> admin panel, customers -> their account page, visitors -> login
  useEffect(() => {
    if (currentView !== 'dashboard' || isLoadingAuth) return;
    if (!user) navigate(routes.login, { replace: true });
    else if (isStaffAuthorized) navigate(routes.adminDashboard, { replace: true });
    else navigate(routes.profile, { replace: true });
  }, [currentView, isLoadingAuth, user, isStaffAuthorized]);

  // Unknown URL -> home
  useEffect(() => {
    if (currentView === 'notfound') navigate(routes.home, { replace: true });
  }, [currentView]);

  // Unauthenticated visitors on admin routes belong on /admin/login; /profile requires a session
  useEffect(() => {
    if (isLoadingAuth) return;
    if (currentView === 'admin' && (!user || !isStaffAuthorized) && pathname !== routes.adminLogin) {
      navigate(routes.adminLogin, { replace: true });
    }
    if (currentView === 'profile' && !user) {
      navigate(routes.login, { replace: true });
    }
    if ((currentView === 'login' || currentView === 'register') && user) {
      navigate(isAdmin ? routes.adminDashboard : routes.profile, { replace: true });
    }
  }, [currentView, isLoadingAuth, user, isStaffAuthorized, isAdmin, pathname]);

  // Load initial data from dataService
  const refreshData = async () => {
    try {
      const [vList, sSettings] = await Promise.all([
        dataService.getVehicles(),
        dataService.getSettings(),
      ]);
      setVehicles(vList);
      setSettings(sSettings);

      if (isStaffAuthorized) {
        const bList = await dataService.getBookings(true);
        setBookings(bList);
      } else if (user?.uid) {
        const bList = await dataService.getBookingsForCustomer(user.uid);
        setBookings(bList);
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setVehiclesReady(true);
    }
  };

  useEffect(() => {
    // Initial fetch / fallback
    refreshData();

    // Real-time listener for vehicles fleet
    const unsubscribeVehicles = dataService.subscribeToVehicles((updatedVehicles) => {
      setVehicles(updatedVehicles);
    });

    // Real-time listener for bookings
    let unsubscribeBookings = () => {};
    if (isStaffAuthorized) {
      unsubscribeBookings = dataService.subscribeToBookings((updatedBookings) => {
        setBookings(updatedBookings);
      });
    } else if (user?.uid) {
      unsubscribeBookings = dataService.subscribeToCustomerBookings(user.uid, (customerBookings) => {
        setBookings(customerBookings);
      });
    }

    return () => {
      unsubscribeVehicles();
      unsubscribeBookings();
    };
  }, [user?.uid, isStaffAuthorized]);

  // Handle search submitted from Hero section
  const handleHeroSearch = (filters: SearchFilters) => {
    setActiveBookingFilters(filters);
    navigate(routes.cars);
  };

  const handleSelectCarForBooking = (vehicle: Vehicle) => navigate(routes.book(vehicle.id));
  const handleViewCarDetails = (vehicle: Vehicle) => navigate(routes.car(vehicle.id));
  const handleBookFirstVehicle = () => {
    if (vehicles[0]) navigate(routes.book(vehicles[0].id));
    else navigate(routes.cars);
  };

  const getAdminTabFromPath = (path: string): AdminTabType => {
    if (path.includes('/admin/vehicles')) return isAdmin ? 'vehicles' : 'bookings';
    if (path.includes('/admin/customers')) return isAdmin ? 'overview' : 'bookings';
    if (path.includes('/admin/bookings')) return 'bookings';
    if (path.includes('/admin/calendar')) return 'bookings';
    if (path.includes('/admin/rentals')) return 'bookings';
    if (path.includes('/admin/contracts')) return 'bookings';
    if (path.includes('/admin/maintenance')) return isAdmin ? 'vehicles' : 'bookings';
    if (path.includes('/admin/reports')) return isAdmin ? 'reports' : 'bookings';
    if (path.includes('/admin/settings')) return isAdmin ? 'settings' : 'bookings';
    if (path.includes('/admin/notifications')) return isAdmin ? 'notifications' : 'bookings';
    if (path.includes('/admin/firebase')) return isSuperAdmin ? 'firestore_users' : (isAdmin ? 'overview' : 'bookings');
    if (path.includes('/admin/users')) return isSuperAdmin ? 'firestore_users' : (isAdmin ? 'overview' : 'bookings');
    if (path.includes('/admin/staff')) return isSuperAdmin ? 'staff' : (isAdmin ? 'overview' : 'bookings');
    if (path.includes('/admin/activity') || path.includes('/admin/audit')) return isSuperAdmin ? 'activity_log' : (isAdmin ? 'overview' : 'bookings');
    if (path.includes('/admin/dashboard')) return isAdmin ? 'overview' : 'bookings';
    if (isSuperAdmin) return 'firestore_users';
    if (isAdmin) return 'overview';
    return 'bookings';
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminLoginError(null);
    setAdminLoginLoading(true);
    try {
      await loginWithEmail(adminEmail, adminPassword);
      navigate(routes.adminDashboard, { replace: true });
    } catch (err: unknown) {
      setAdminLoginError((err instanceof Error && err.message) || 'فشل تسجيل الدخول. يرجى التأكد من البريد وكلمة المرور.');
    } finally {
      setAdminLoginLoading(false);
    }
  };

  // If viewing admin
  if (currentView === 'admin') {
    // 1. Wait for auth resolution - do not render protected routes before auth state is ready
    if (isLoadingAuth) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-cairo" dir="rtl">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-300">جاري التحقق من صلاحيات الدخول المعتمدة...</p>
          </div>
        </div>
      );
    }

    // 2. Unauthenticated or non-staff user: Redirect to /admin/login
    if (!user || !isStaffAuthorized) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-cairo" dir="rtl">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-inner">
                <Shield className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-black text-white">تسجيل دخول إدارة شاكر</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                لوحة التحكم الإدارية المعتمدة لشركة شاكر لتأجير السيارات (دمشق - جرمانا)
              </p>
            </div>

            {adminLoginError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {adminLoginError}
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">البريد الإلكتروني الإداري</label>
                <input
                  type="email"
                  value={adminEmail || ''}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة المرور</label>
                <input
                  type="password"
                  value={adminPassword || ''}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={adminLoginLoading}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                {adminLoginLoading ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>دخول لوحة التحكم</span>
                  </>
                )}
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-2.5 text-[10px] text-slate-400 font-medium">أو</span>
                <div className="border-t border-slate-800 w-full" />
              </div>

              <button
                type="button"
                onClick={async () => {
                  setAdminLoginError(null);
                  setAdminLoginLoading(true);
                  try {
                    if (typeof loginWithGoogle === 'function') {
                      await loginWithGoogle();
                    }
                  } catch (err: unknown) {
                    setAdminLoginError((err instanceof Error && err.message) || 'تعذر تسجيل الدخول الإداري عبر Google.');
                  } finally {
                    setAdminLoginLoading(false);
                  }
                }}
                disabled={adminLoginLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 border border-slate-300 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>دخول إداري معتمد عبر Google</span>
              </button>
            </form>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => navigate(routes.home)}
                className="w-full py-2 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <span>العودة للموقع الرئيسي</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 3. Authenticated Staff/Admin
    const initialTab = getAdminTabFromPath(pathname);
    return (
      <AdminDashboard
        vehicles={vehicles}
        bookings={bookings}
        settings={settings}
        initialTab={initialTab}
        onRefreshData={refreshData}
        onBackToSite={() => navigate(routes.home)}
      />
    );
  }

  // Mandatory Email Verification Gate for new customer accounts created on/after 2026-09-19
  const EMAIL_VERIFICATION_CUTOFF_DATE = new Date('2026-09-19T00:00:00.000Z').getTime();
  const isAccountNewerThanCutoff = user?.createdAt
    ? new Date(user.createdAt).getTime() >= EMAIL_VERIFICATION_CUTOFF_DATE
    : true;

  const requiresEmailVerification = Boolean(
    user &&
    !isAdmin &&
    !isEmployee &&
    user.isPasswordProvider !== false &&
    !user.emailVerified &&
    isAccountNewerThanCutoff
  );

  if (!isLoadingAuth && requiresEmailVerification) {
    return <EmailVerificationGate />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-cairo overflow-x-hidden">
      {/* Global Slide-out Navigation Drawer (Controlled via MenuContext) */}
      <GlobalMenu
        currentView={currentView === 'about' ? 'contact' : currentView === 'catalog' ? 'cars' : currentView}
        onNavigate={(view) => {
          if (view === 'cars' || view === 'catalog') navigate(routes.cars);
          else if (view === 'contact' || view === 'about') navigate(routes.about);
          else if (view === 'admin') navigate(routes.dashboard);
          else navigate(routes.home);
        }}
        onOpenBooking={handleBookFirstVehicle}
        onOpenAuth={(mode) => navigate(mode === 'register' ? routes.register : routes.login)}
        onOpenProfile={() => navigate(isAdmin ? routes.adminDashboard : routes.profile)}
      />

      {/* Top Header: Full non-sticky Navbar ONLY on Home; minimal non-sticky PageTopBar on other sub-pages */}
      {currentView === 'home' ? (
        <Navbar
          currentView="home"
          onNavigate={(view) => {
            if (view === 'cars' || view === 'catalog') navigate(routes.cars);
            else if (view === 'contact' || view === 'about') navigate(routes.about);
            else if (view === 'admin') navigate(routes.dashboard);
            else navigate(routes.home);
          }}
          onOpenBooking={handleBookFirstVehicle}
          onOpenAuth={(mode) => navigate(mode === 'register' ? routes.register : routes.login)}
          onOpenProfile={() => navigate(isAdmin ? routes.adminDashboard : routes.profile)}
        />
      ) : (
        <PageTopBar
          title={
            carBookingMatch
              ? routeVehicle
                ? `حجز ${routeVehicle.brand} ${routeVehicle.model}`
                : 'حجز سيارة'
              : carDetailsMatch
              ? routeVehicle
                ? `${routeVehicle.brand} ${routeVehicle.model}`
                : 'تفاصيل السيارة'
              : currentView === 'catalog'
              ? 'أسطول السيارات'
              : currentView === 'about'
              ? 'تواصل معنا وموقعنا'
              : currentView === 'profile'
              ? 'حسابي وحجوزاتي'
              : currentView === 'login'
              ? 'تسجيل الدخول'
              : currentView === 'register'
              ? 'إنشاء حساب جديد'
              : 'شاكر لتأجير السيارات'
          }
          onBack={() => {
            if (carBookingMatch && carBookingMatch.id) {
              goBack(routes.car(carBookingMatch.id));
            } else if (carDetailsMatch) {
              goBack(routes.cars);
            } else if (currentView === 'login' || currentView === 'register') {
              goBack(routes.home);
            } else {
              navigate(routes.home);
            }
          }}
          badge={
            carBookingMatch
              ? 'حجز إلكتروني'
              : carDetailsMatch
              ? 'مواصفات المركبة'
              : currentView === 'catalog'
              ? 'الأسطول المتاح'
              : currentView === 'about'
              ? 'خدمة العملاء'
              : undefined
          }
        />
      )}

      {/* Booking Status Alert Toast */}
      {lastCreatedBooking && (
        <div className="bg-amber-600/90 text-white px-4 py-3 text-xs sm:text-sm text-center flex items-center justify-center gap-2 sticky top-0 z-30 shadow-lg backdrop-blur-md">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>
            تم استلام طلب حجزك رقم <strong className="font-mono">{lastCreatedBooking.bookingNumber}</strong> وهو الآن بانتظار موافقة الإدارة.
          </span>
          <button
            onClick={() => {
              setLastCreatedBooking(null);
              if (user?.uid) {
                try {
                  localStorage.removeItem(`shaker_recent_booking_${user.uid}`);
                } catch {}
              }
            }}
            className="mr-3 text-xs underline font-bold cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Main Content Router with bottom padding to avoid WhatsApp button overlap */}
      <main className="flex-1 pb-28 sm:pb-32">
        {/* VIEW 1: HOME PAGE */}
        {currentView === 'home' && (
          <motion.div
            key="home-view"
            variants={getPageVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-16"
          >
            {/* Hero Section */}
            <motion.div variants={getItemVariants()}>
              <HeroSection
                vehicles={vehicles}
                onSearch={handleHeroSearch}
                onSelectVehicle={(v) => handleSelectCarForBooking(v)}
              />
            </motion.div>

            {/* Featured Fleet Catalog Section */}
            <motion.section variants={getItemVariants()} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                <div>
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-2">
                    الأسطول المختار بعناية
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    أحدث سيارات شركة شاكر في دمشق
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveBookingFilters(undefined);
                    navigate(routes.cars);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.97] cursor-pointer"
                >
                  <span>تصفح كامل الأسطول</span>
                  <span className="text-xs opacity-90 font-mono font-medium">({vehicles.length})</span>
                  <ArrowLeft className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Cars Grid with Staggered Entrance */}
              <motion.div variants={getStaggerVariants()} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {vehicles.slice(0, 2).map((vehicle) => (
                  <motion.div
                    key={vehicle.id}
                    variants={getItemVariants()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden transition-colors duration-300 hover:shadow-2xl hover:shadow-amber-500/5 group flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Frame */}
                      <div className="relative h-56 bg-slate-950 overflow-hidden">
                        {!vehicle.imageUrl || previewImageErrors[vehicle.id] ? (
                          <VehicleImagePlaceholder brand={vehicle.brand} model={vehicle.model} />
                        ) : (
                          <img
                            src={vehicle.imageUrl}
                            alt={`${vehicle.brand} ${vehicle.model}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={() => setPreviewImageErrors((prev) => ({ ...prev, [vehicle.id]: true }))}
                          />
                        )}
                        <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-bold text-amber-400 border border-amber-500/30">
                          {vehicle.category === 'light'
                            ? 'اقتصادي (Light)'
                            : vehicle.category === 'medium'
                            ? 'سيدان متوسط (Medium)'
                            : 'جيب عائلي 7 ركاب'}
                        </div>
                        {vehicle.status === 'available' && (
                          <div className="absolute top-3 left-3">
                            <span className="px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md flex items-center gap-1.5 shadow-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              <span>متاحة الآن ●</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content Info */}
                      <div className="p-6 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs text-slate-400 font-semibold">{vehicle.brand}</span>
                            <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                              {vehicle.model} ({vehicle.year})
                            </h3>
                          </div>
                          <div className="text-left">
                            <span className="text-2xl font-black text-amber-400 font-mono">
                              ${vehicle.dailyPrice}
                            </span>
                            <span className="text-[11px] text-slate-400 block font-medium">/ اليوم</span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-800/80 text-center text-slate-400 text-xs">
                          <div>
                            <span className="block text-[10px] text-slate-500">ناقل الحركة</span>
                            <span className="font-semibold text-slate-200">
                              {vehicle.transmission === 'automatic' ? 'أوتوماتيك' : 'عادي'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500">المقاعد</span>
                            <span className="font-semibold text-slate-200">{vehicle.seats} ركاب</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500">الوقود</span>
                            <span className="font-semibold text-slate-200">
                              {vehicle.fuelType === 'petrol'
                                ? 'بنزين'
                                : vehicle.fuelType === 'hybrid'
                                ? 'هايبرد'
                                : vehicle.fuelType === 'diesel'
                                ? 'ديزل'
                                : 'كهرباء'}
                            </span>
                          </div>
                        </div>

                        {/* Features chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {vehicle.features.slice(0, 3).map((feat, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400"
                            >
                              {feat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewCarDetails(vehicle)}
                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-[0.97] cursor-pointer"
                      >
                        تفاصيل السيارة
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectCarForBooking(vehicle)}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 active:scale-[0.97] cursor-pointer"
                      >
                        احجز الآن
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.section>

            {/* FAQ Section (Accordion) */}
            <motion.section variants={getItemVariants()} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
              <div className="text-center mb-10">
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-3">
                  الأسئلة الشائعة
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  كل ما تود معرفته عن استئجار سيارة
                </h2>
              </div>

              <div className="space-y-3">
                {[
                  {
                    q: 'ما هي الأوراق المطلوبة لاستئجار سيارة في سوريا؟',
                    a: 'يلزم توفر الهوية الشخصية (أو جواز السفر الساري للمغتربين والزوار)، ورخصة قيادة سارية المفعول، بالإضافة إلى مبلغ التأمين النقدي المسترد.'
                  },
                  {
                    q: 'كيف يمكنني الاستفادة من خصومات التأجير؟',
                    a: 'بمجرد تسجيل الدخول بحسابك في موقعنا، يتم تطبيق خصم الأعضاء الحصري تلقائياً على قيمة الحجز لجميع السيارات المشمولة بالعرض بنسبة الخصم المعتمدة.'
                  },
                  {
                    q: 'هل يتوفر استلام وتسليم في مطار دمشق الدولي أو مواقع أخرى؟',
                    a: 'نعم، نوفر خدمة تسليم واستلام السيارات في مطار دمشق الدولي، بالإضافة إلى تسليم السيارة مباشرة في موقعك أو فندقك في دمشق وريفها بالتنسيق المسبق.'
                  },
                  {
                    q: 'ما هي شروط وسياسة الكيلومترات والوقود؟',
                    a: 'يتم تسليم السيارة بحالة وقود محددة ونظيفة، ويُطلب إعادتها بنفس المستوى، مع عداد كيلومترات يومي رحب ومناسب لجميع تنقلاتك داخل وخارج المدينة.'
                  }
                ].map((item, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl bg-slate-900 border border-slate-800/80 overflow-hidden transition-all duration-300"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full p-5 text-right flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors cursor-pointer"
                        aria-expanded={isOpen}
                      >
                        <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2.5">
                          <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>{item.q}</span>
                        </h3>
                        <ChevronDown
                          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${
                            isOpen ? 'rotate-180 text-amber-400' : ''
                          }`}
                        />
                      </button>

                      <div
                        className={`transition-all duration-300 ease-in-out px-5 overflow-hidden ${
                          isOpen ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 pb-0 opacity-0'
                        }`}
                      >
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pr-6 border-t border-slate-800/60 pt-3">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          </motion.div>
        )}

        {/* VIEW 2: CAR CATALOG  (/cars) */}
        {currentView === 'catalog' && !carDetailsMatch && !carBookingMatch && (
          <motion.div
            key="catalog-view"
            variants={getPageVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PageHeaderBanner themeKey="catalog" />
            <CarCatalog
              vehicles={vehicles}
              initialFilters={activeBookingFilters}
              onSelectVehicle={(v) => handleSelectCarForBooking(v)}
              onViewDetails={(v) => handleViewCarDetails(v)}
              onBookCar={(v) => handleSelectCarForBooking(v)}
              onSelectCar={(v) => handleViewCarDetails(v)}
            />
          </motion.div>
        )}

        {/* VIEW 3: CAR DETAILS PAGE  (/cars/:id) */}
        {(carDetailsMatch || carBookingMatch) && !routeVehicle && (
          <motion.div
            key="notfound-car-view"
            variants={getPageVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-[50vh] flex items-center justify-center text-center p-6"
          >
            {vehiclesReady ? (
              <div className="space-y-4">
                <p className="text-slate-300 font-bold">لم يتم العثور على هذه السيارة.</p>
                <button
                  type="button"
                  onClick={() => navigate(routes.cars)}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black active:scale-[0.97] transition-transform"
                >
                  العودة إلى الأسطول
                </button>
              </div>
            ) : (
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            )}
          </motion.div>
        )}

        {carDetailsMatch && routeVehicle && (
          <motion.div
            key={`details-${routeVehicle.id}`}
            variants={getPageVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PageHeaderBanner
              themeKey="car_details"
              customTitle={`${routeVehicle.brand} ${routeVehicle.model} (${routeVehicle.year})`}
              customSubtitle={`فئة ${routeVehicle.category === 'light' ? 'اقتصادي' : routeVehicle.category === 'medium' ? 'سيدان متوسط' : 'جيب 7 ركاب'} • السعر: $${routeVehicle.dailyPrice}/يوم • جاهزة للتسليم`}
            />
            <React.Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6"><div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <CarDetailsModal
                vehicle={routeVehicle}
                onClose={() => goBack(routes.cars)}
                onBook={(v) => handleSelectCarForBooking(v)}
                onBookNow={(v) => handleSelectCarForBooking(v)}
              />
            </React.Suspense>
          </motion.div>
        )}

        {/* VIEW 4: BOOKING PAGE  (/cars/:id/book) */}
        {carBookingMatch && routeVehicle && (
          <motion.div
            key={`booking-${routeVehicle.id}`}
            variants={getPageVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PageHeaderBanner
              themeKey="booking"
              customTitle={`حجز ${routeVehicle.brand} ${routeVehicle.model}`}
              customSubtitle="حدد تواريخ الاستلام والإرجاع وأكمل بيانات الحجز للاستفادة من خصومات الأعضاء"
            />
            <React.Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6"><div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <BookingModal
                key={carBookingMatch.id}
                vehicles={vehicles}
                selectedVehicle={routeVehicle}
                vehicle={routeVehicle}
                initialDates={
                  activeBookingFilters?.pickupDate && activeBookingFilters?.returnDate
                    ? {
                        pickupDate: activeBookingFilters.pickupDate,
                        returnDate: activeBookingFilters.returnDate,
                      }
                    : undefined
                }
                initialStartDate={activeBookingFilters?.pickupDate}
                initialEndDate={activeBookingFilters?.returnDate}
                onClose={() => goBack(routes.car(carBookingMatch.id))}
                onOpenAuth={() => navigate(routes.login)}
                onOpenProfile={() => navigate(routes.profile)}
                onBookingCreated={handleBookingCreated}
                onBookingComplete={handleBookingCreated}
              />
            </React.Suspense>
          </motion.div>
        )}

        {/* VIEW 5: ABOUT & CONTACT  (/about, /contact) */}
        {currentView === 'about' && (
          <motion.div
            key="about-view"
            variants={getPageVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PageHeaderBanner themeKey="contact" />
            <ContactPage />
          </motion.div>
        )}

        {/* VIEW 6: LOGIN / REGISTER  (/login, /register) */}
        {(currentView === 'login' || currentView === 'register') && !user && (
          <motion.div
            key="auth-view"
            variants={getPageVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PageHeaderBanner
              themeKey={currentView === 'register' ? 'register' : 'login'}
            />
            <React.Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6"><div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <AuthModal
                isOpen
                initialMode={currentView === 'register' ? 'register' : 'login'}
                loginWithGoogle={loginWithGoogle}
                onClose={() => goBack(routes.home)}
                onSuccess={() => navigate(isAdmin ? routes.adminDashboard : routes.profile, { replace: true })}
              />
            </React.Suspense>
          </motion.div>
        )}

        {/* VIEW 7: ACCOUNT PAGE  (/profile) */}
        {currentView === 'profile' && user && (
          <motion.div
            key="profile-view"
            variants={getPageVariants()}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <PageHeaderBanner themeKey="profile" />
            <React.Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center p-6"><div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>}>
              <UserProfileModal
                isOpen
                bookings={bookings}
                onClose={() => navigate(routes.home)}
                onOpenBooking={handleBookFirstVehicle}
                onOpenAdminView={() => navigate(routes.adminDashboard)}
              />
            </React.Suspense>
          </motion.div>
        )}

        {/* /dashboard is resolved by an effect above while auth loads */}
        {currentView === 'dashboard' && (
          <div className="min-h-[50vh] flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </main>

      {/* Floating WhatsApp Action Button positioned at physical RIGHT at screen bottom */}
      <button
        type="button"
        onClick={() => openWhatsAppChat()}
        style={{
          bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          right: 'max(16px, env(safe-area-inset-right, 16px))',
        }}
        className="fixed z-40 p-3.5 sm:px-5 sm:py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center gap-2.5 shadow-2xl shadow-emerald-500/40 transition-all hover:scale-105 active:scale-95 group cursor-pointer"
        title="تواصل معنا فوراً على الواتساب"
        aria-label="تواصل واتساب مباشر"
      >
        <MessageCircle className="w-6 h-6 fill-current text-slate-950" />
        <span className="hidden sm:inline font-bold">تواصل واتساب مباشر</span>
      </button>

      {/* Footer */}
      <Footer
        onNavigate={(v) =>
          navigate(v === 'catalog' ? routes.cars : v === 'about' ? routes.about : v === 'admin' ? routes.dashboard : routes.home)
        }
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MenuProvider>
          <MainAppContent />
        </MenuProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
