import React, { useState, useEffect } from 'react';
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
import { Footer } from './components/Footer';
import {
  MessageCircle,
  Shield,
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
  ArrowRight
} from 'lucide-react';

function MainAppContent() {
  const { user, isAdmin, isSuperAdmin, isEmployee, isSpecificAdminUser, isLoadingAuth, loginWithEmail, logout } = useAuth();

  const isStaffAuthorized = isAdmin || isSuperAdmin || isEmployee || isSpecificAdminUser;

  // App Navigation View
  const [currentView, setCurrentView] = useState<'home' | 'catalog' | 'about' | 'admin'>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      return 'admin';
    }
    return 'home';
  });

  // Core Data State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

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

  // Listen to browser popstate (back/forward navigation)
  useEffect(() => {
    const handleLocationChange = () => {
      if (window.location.pathname.startsWith('/admin')) {
        setCurrentView('admin');
      } else if (currentView === 'admin') {
        setCurrentView('home');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, [currentView]);

  // When designated admin logs in, automatically show admin view
  useEffect(() => {
    if (isSpecificAdminUser && currentView !== 'admin') {
      setCurrentView('admin');
    }
  }, [isSpecificAdminUser]);

  // Load initial data from dataService
  const refreshData = async () => {
    try {
      const [vList, bList, sSettings] = await Promise.all([
        dataService.getVehicles(),
        dataService.getBookings(),
        dataService.getSettings(),
      ]);
      setVehicles(vList);
      setBookings(bList);
      setSettings(sSettings);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

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
    if (path.includes('/admin/vehicles')) return 'vehicles';
    if (path.includes('/admin/customers')) return 'customers';
    if (path.includes('/admin/bookings')) return 'bookings';
    if (path.includes('/admin/rentals')) return 'bookings';
    if (path.includes('/admin/contracts')) return 'contracts';
    if (path.includes('/admin/payments')) return 'payments';
    if (path.includes('/admin/maintenance')) return 'maintenance';
    if (path.includes('/admin/reports')) return 'reports';
    if (path.includes('/admin/settings')) return 'settings';
    if (path.includes('/admin/notifications')) return 'notifications';
    if (path.includes('/admin/users')) return 'firestore_users';
    return 'overview';
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

  // If viewing admin or URL is on an /admin route
  if (currentView === 'admin' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'))) {
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
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@shaker-rent.com أو shadi1ms@gmail.com"
                  required
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة المرور</label>
                <input
                  type="password"
                  value={adminPassword}
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
            </form>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setAdminEmail('shadi1ms@gmail.com');
                  setAdminPassword('123456');
                }}
                className="w-full py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-amber-300 text-xs font-bold transition-colors border border-amber-500/20"
              >
                تعبئة بيانات الحساب الرئيسي المعتمد (shadi1ms@gmail.com)
              </button>

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-cairo">
      {/* Top Navigation */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'cars') {
            setCurrentView('catalog');
          } else if (view === 'contact') {
            setCurrentView('about');
          } else if (view === 'admin') {
            setCurrentView('admin');
          } else {
            setCurrentView('home');
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenBooking={() => setSelectedVehicleForBooking(vehicles[0] || null)}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode || 'login');
          setIsAuthModalOpen(true);
        }}
        onOpenProfile={() => {
          if (isSpecificAdminUser) {
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
                  onClick={() => {
                    setActiveBookingFilters(undefined);
                    setCurrentView('catalog');
                  }}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
                >
                  <span>عرض جميع سيارات الأسطول ({vehicles.length})</span>
                  <span>←</span>
                </button>
              </div>

              {/* Cars Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vehicles.slice(0, 6).map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/5 group flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Frame */}
                      <div className="relative h-52 bg-slate-950 overflow-hidden">
                        <img
                          src={vehicle.imageUrl}
                          alt={`${vehicle.brand} ${vehicle.model}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-bold text-amber-400 border border-amber-500/30">
                          {vehicle.category === 'light'
                            ? 'اقتصادي (Light)'
                            : vehicle.category === 'medium'
                            ? 'سيدان متوسط (Medium)'
                            : 'جيب عائلي 7 ركاب'}
                        </div>
                        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-mono font-bold text-slate-300">
                          لوحة: {vehicle.plateNumber}
                        </div>
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

            {/* Why Choose Shaker Section */}
            <section className="bg-slate-900/60 border-y border-slate-800 py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-2xl mx-auto mb-12">
                  <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-3">
                    لماذا تختار شاكر؟
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    خدمات تأجير استثنائية ترتقي لتطلعاتكم
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-white text-base">تسليم سريع وفوري</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      إجراءات تسليم بسيطة وسريعة خلال 5 دقائق في مقرنا بجرمانا أو مع التوصيل لموقعك.
                    </p>
                  </div>

                  <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                      <Shield className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-white text-base">تأمين مسترد مضمون</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      استرداد فوري لمبلغ التأمين ($300 - $500) عند إعادة السيارة وفحصها بنزاهة تامة.
                    </p>
                  </div>

                  <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                      <Award className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-white text-base">صيانة دورية كل 5000 كم</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      رقابة صارمة على غيار الزيوت وفحص الفرامل والإطارات لضمان راحة بالك وسلامة عائلتك.
                    </p>
                  </div>

                  <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-white text-base">خصومات للفترات الطويلة</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      خصم $5 يومياً للحجوزات الأسبوعية وأسعار حصرية شهرية تبدأ من $500 فقط.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ Section */}
            <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
              <div className="text-center mb-10">
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full inline-block mb-3">
                  الأسئلة الشائعة
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  كل ما تود معرفته عن استئجار سيارة
                </h2>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    ما هي الأوراق المطلوبة لاستئجار سيارة في سوريا؟
                  </h3>
                  <p className="text-slate-400 leading-relaxed pr-6">
                    يلزم توفر الهوية الشخصية (أو جواز السفر الساري للمغتربين والزوار)، ورخصة قيادة سارية المفعول، بالإضافة إلى مبلغ التأمين النقدي المسترد.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    كيف يتم حساب مبلغ التأمين المسترد؟
                  </h3>
                  <p className="text-slate-400 leading-relaxed pr-6">
                    وفقاً لسياسة شركة شاكر: الحجوزات القصيرة (1 إلى 2 يوم) يكون مبلغ التأمين $500، بينما الحجوزات لأكثر من يومين يكون التأمين $300 فقط. يُعاد المبلغ كاملاً للمستأجر فور تسليم السيارة بحالتها.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    هل يوجد خصم للحجوزات الأسبوعية أو الشهرية؟
                  </h3>
                  <p className="text-slate-400 leading-relaxed pr-6">
                    نعم بالتأكيد! للحجوزات الأسبوعية (7 أيام فأكثر) يتم خصم $5 عن كل يوم تلقائياً، والاشتراكات الشهرية تبدأ من $500 لفئة السيدان الاقتصادي و$600 للفئة المتوسطة و$700 لفئة الجيب 7 ركاب.
                  </p>
                </div>
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
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
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
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
