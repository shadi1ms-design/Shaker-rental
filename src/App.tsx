import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Vehicle, Booking, AppSettings, SearchFilters } from './types';
import { dataService } from './services/dataService';
import { DEFAULT_SETTINGS } from './services/pricing';
import { openWhatsAppChat } from './services/whatsapp';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { CarCatalog } from './components/CarCatalog';
import { CarDetailsModal } from './components/CarDetailsModal';
import { BookingModal } from './components/BookingModal';
import { ContactPage } from './components/ContactPage';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { AdminDashboard, AdminTabType } from './components/AdminDashboard';
import { EmailVerificationGate } from './components/EmailVerificationGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { VehicleImagePlaceholder } from './components/VehicleImagePlaceholder';
import {
  MessageCircle,
  Shield,
  ShieldCheck,
  Phone,
  CheckCircle2,
  Sparkles,
  Award,
  Clock,
  Car as CarIcon,
  ChevronDown,
  HelpCircle,
  LogIn,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Bot,
  Plane
} from 'lucide-react';

function MainAppContent() {
  const {
    user,
    isSuperAdmin,
    isAdmin,
    isEmployee,
    isLoadingAuth,
    loginWithEmail,
    loginWithGoogle,
    logout
  } = useAuth();

  const isStaffAuthorized = isAdmin || isEmployee;

  // App Navigation View
  const [currentView, setCurrentView] = useState<'home' | 'catalog' | 'about' | 'admin'>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      return 'admin';
    }
    return 'home';
  });

  // Core Data State - Immediate cache bootstrap for 0ms initial render
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => dataService.getCachedVehicles());
  const [bookings, setBookings] = useState<Booking[]>(() => dataService.getCachedBookings());
  const [settings, setSettings] = useState<AppSettings>(() => dataService.getCachedSettings());
  const [isLoading, setIsLoading] = useState(false);

  // Admin login form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  // Modals
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState<Vehicle | null>(null);
  const [selectedVehicleForBooking, setSelectedVehicleForBooking] = useState<Vehicle | null>(null);
  const [activeBookingFilters, setActiveBookingFilters] = useState<SearchFilters | undefined>(undefined);

  // User Auth & Profile Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Success Notification
  const [lastCreatedBooking, setLastCreatedBooking] = useState<Booking | null>(null);

  // Home Page Interaction State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [previewImageErrors, setPreviewImageErrors] = useState<Record<string, boolean>>({});

  // Admin auto-navigation ref to avoid trapping user in an infinite redirect loop
  const hasAutoNavigatedAdminRef = useRef(false);

  // Listen to browser popstate (back/forward navigation)
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;

      if (path.startsWith('/admin')) {
        setCurrentView('admin');
      } else if (path.includes('/cars') || path.includes('/catalog')) {
        setCurrentView('catalog');
      } else if (path.includes('/about') || path.includes('/contact')) {
        setCurrentView('about');
      } else {
        setCurrentView('home');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // When admin logs in, automatically show admin view once instead of normal dashboard
  useEffect(() => {
    if (isAdmin && !hasAutoNavigatedAdminRef.current) {
      hasAutoNavigatedAdminRef.current = true;
      setIsProfileModalOpen(false);
      setCurrentView('admin');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin')) {
        window.history.replaceState(null, '', '/admin/dashboard');
      }
    } else if (!isAdmin) {
      hasAutoNavigatedAdminRef.current = false;
    }
  }, [isAdmin]);

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
      setIsLoading(false);
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
    setCurrentView('catalog');
  };

  const handleSelectCarForBooking = (vehicle: Vehicle) => {
    setSelectedVehicleForDetails(null);
    setSelectedVehicleForBooking(vehicle);
  };

  const getAdminTabFromPath = (path: string): AdminTabType => {
    if (path.includes('/admin/vehicles')) return isAdmin ? 'vehicles' : 'bookings';
    if (path.includes('/admin/customers')) return isAdmin ? 'overview' : 'bookings';
    if (path.includes('/admin/bookings')) return 'bookings';
    if (path.includes('/admin/calendar')) return 'bookings';
    if (path.includes('/admin/rentals')) return 'bookings';
    if (path.includes('/admin/contracts')) return 'bookings';
    if (path.includes('/admin/payments')) return 'bookings';
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
      window.history.replaceState(null, '', '/admin/dashboard');
    } catch (err: any) {
      setAdminLoginError(err.message || 'فشل تسجيل الدخول. يرجى التأكد من البريد وكلمة المرور.');
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
      if (typeof window !== 'undefined' && window.location.pathname !== '/admin/login') {
        window.history.replaceState(null, '', '/admin/login');
      }

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
                  } catch (err: any) {
                    setAdminLoginError(err?.message || 'تعذر تسجيل الدخول الإداري عبر Google.');
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
                onClick={() => {
                  setCurrentView('home');
                  window.history.pushState(null, '', '/');
                }}
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
    const initialTab = getAdminTabFromPath(typeof window !== 'undefined' ? window.location.pathname : '');
    return (
      <AdminDashboard
        vehicles={vehicles}
        bookings={bookings}
        settings={settings}
        initialTab={initialTab}
        onRefreshData={refreshData}
        onBackToSite={() => {
          setCurrentView('home');
          if (typeof window !== 'undefined') {
            window.history.pushState(null, '', '/');
          }
        }}
      />
    );
  }

  // Mandatory Email Verification Gate for new customer accounts created on/after 2026-09-19
  const EMAIL_VERIFICATION_CUTOFF_DATE = new Date('2026-09-19T00:00:00.000Z').getTime();
  const userCreatedAtTime = user?.createdAt ? new Date(user.createdAt).getTime() : Date.now();
  const isAccountNewerThanCutoff = userCreatedAtTime >= EMAIL_VERIFICATION_CUTOFF_DATE;

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-cairo">
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'cars' || view === 'catalog') {
            setCurrentView('catalog');
            if (typeof window !== 'undefined') window.history.pushState(null, '', '/cars');
          } else if (view === 'contact' || view === 'about') {
            setCurrentView('about');
            if (typeof window !== 'undefined') window.history.pushState(null, '', '/about');
          } else if (view === 'admin') {
            setCurrentView('admin');
            if (typeof window !== 'undefined') window.history.pushState(null, '', '/admin/dashboard');
          } else {
            setCurrentView('home');
            if (typeof window !== 'undefined') window.history.pushState(null, '', '/');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenBooking={() => setSelectedVehicleForBooking(vehicles[0] || null)}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode || 'login');
          setIsAuthModalOpen(true);
        }}
        onOpenProfile={() => {
          if (isAdmin) {
            setCurrentView('admin');
          } else {
            setIsProfileModalOpen(true);
          }
        }}
      />

      {/* Booking Confirmation Alert Toast */}
      {lastCreatedBooking && (
        <div className="bg-emerald-600/90 text-white px-4 py-3 text-xs sm:text-sm text-center flex items-center justify-center gap-2 sticky top-16 z-30 shadow-lg backdrop-blur-md">
          <CheckCircle2 className="w-5 h-5" />
          <span>
            تم استلام طلب حجزك بنجاح للسيارة <strong>{lastCreatedBooking.vehicleName}</strong> برقم حجز{' '}
            <strong className="font-mono">{lastCreatedBooking.bookingNumber}</strong>! سيتم التواصل معك عبر الواتساب فوراً.
          </span>
          <button
            onClick={() => setLastCreatedBooking(null)}
            className="mr-3 text-xs underline font-bold"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Main Content Router */}
      <main className="flex-1">
        {/* VIEW 1: HOME PAGE */}
        {currentView === 'home' && (
          <div className="space-y-16">
            {/* Hero Section */}
            <HeroSection
              vehicles={vehicles}
              onSearch={handleHeroSearch}
              onSelectVehicle={(v) => setSelectedVehicleForBooking(v)}
            />

            {/* Featured Fleet Catalog Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                    setCurrentView('catalog');
                    if (typeof window !== 'undefined') window.history.pushState(null, '', '/cars');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-orange-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <span>تصفح كامل الأسطول</span>
                  <span className="text-xs opacity-90 font-mono font-medium">({vehicles.length})</span>
                  <ArrowLeft className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Cars Grid (2 items preview) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {vehicles.slice(0, 2).map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/5 group flex flex-col justify-between"
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
                        onClick={() => setSelectedVehicleForDetails(vehicle)}
                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                      >
                        تفاصيل السيارة
                      </button>
                      <button
                        onClick={() => handleSelectCarForBooking(vehicle)}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20"
                      >
                        احجز الآن
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* FAQ Section (Accordion) */}
            <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
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
            </section>
          </div>
        )}

        {/* VIEW 2: CAR CATALOG */}
        {currentView === 'catalog' && (
          <CarCatalog
            vehicles={vehicles}
            initialFilters={activeBookingFilters}
            onSelectVehicle={(v) => handleSelectCarForBooking(v)}
            onViewDetails={(v) => setSelectedVehicleForDetails(v)}
            onBookCar={(v) => handleSelectCarForBooking(v)}
            onSelectCar={(v) => setSelectedVehicleForDetails(v)}
          />
        )}

        {/* VIEW 3: ABOUT & CONTACT */}
        {currentView === 'about' && <ContactPage />}
      </main>

      {/* Floating WhatsApp Action Button */}
      <button
        onClick={() => openWhatsAppChat()}
        className="fixed bottom-6 left-6 z-40 p-3.5 sm:px-5 sm:py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center gap-2.5 shadow-2xl shadow-emerald-500/40 transition-all hover:scale-105 active:scale-95 group"
        title="تواصل معنا فوراً على الواتساب"
      >
        <MessageCircle className="w-6 h-6 fill-current text-slate-950" />
        <span className="hidden sm:inline font-bold">تواصل واتساب مباشر</span>
      </button>

      {/* Footer */}
      <Footer onNavigate={(v) => setCurrentView(v)} />

      {/* MODAL 1: Car Details */}
      {selectedVehicleForDetails && (
        <CarDetailsModal
          vehicle={selectedVehicleForDetails}
          onClose={() => setSelectedVehicleForDetails(null)}
          onBook={(v) => handleSelectCarForBooking(v)}
          onBookNow={(v) => handleSelectCarForBooking(v)}
        />
      )}

      {/* MODAL 2: Secure Booking & Reservation Flow */}
      {selectedVehicleForBooking && (
        <BookingModal
          vehicles={vehicles}
          selectedVehicle={selectedVehicleForBooking}
          vehicle={selectedVehicleForBooking}
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
          onClose={() => setSelectedVehicleForBooking(null)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onBookingCreated={(b) => {
            setLastCreatedBooking(b);
            refreshData();
          }}
          onBookingComplete={(b) => {
            setLastCreatedBooking(b);
            refreshData();
          }}
        />
      )}

      {/* MODAL 3: Universal Email Login & Account Registration */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        loginWithGoogle={loginWithGoogle}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          // If customer, show their normal personal dashboard
          if (!isAdmin) {
            setIsProfileModalOpen(true);
          }
        }}
      />

      {/* MODAL 4: User Profile & Bookings Management */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        bookings={bookings}
        onClose={() => setIsProfileModalOpen(false)}
        onOpenBooking={() => {
          setIsProfileModalOpen(false);
          setSelectedVehicleForBooking(vehicles[0] || null);
        }}
        onOpenAdminView={() => {
          setIsProfileModalOpen(false);
          setCurrentView('admin');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
