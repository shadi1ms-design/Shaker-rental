import React, { useState, useEffect } from 'react';
import {
  Vehicle,
  Booking,
  Customer,
  AppSettings,
  AppNotification,
} from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';

// Lazy-loaded Admin Views with Suspense for optimal performance
const AdminReports = React.lazy(() => import('./AdminReports').then((m) => ({ default: m.AdminReports })));
const AdminSettings = React.lazy(() => import('./AdminSettings').then((m) => ({ default: m.AdminSettings })));
const AdminUsersFilesView = React.lazy(() => import('./AdminUsersFilesView').then((m) => ({ default: m.AdminUsersFilesView })));
const AdminStaffRoles = React.lazy(() => import('./admin/AdminStaffRoles').then((m) => ({ default: m.AdminStaffRoles })));
const AdminActivityLog = React.lazy(() => import('./admin/AdminActivityLog').then((m) => ({ default: m.AdminActivityLog })));
import { SkeletonLoader } from './common/SkeletonLoader';

// Modular Sub-components for Admin
import { AdminOverview } from './admin/AdminOverview';
import { AdminBookings } from './admin/AdminBookings';
import { AdminVehicles } from './admin/AdminVehicles';
import { AdminNotifications } from './admin/AdminNotifications';

// Modals
import { VehicleFormModal } from './VehicleFormModal';
import { InspectionModal } from './InspectionModal';
import { UserProfileModal } from './UserProfileModal';

// Icons
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Car,
  Calendar,
  BarChart3,
  Settings,
  Plus,
  Wrench,
  FolderOpen,
  Shield,
  FileText,
  Bell,
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Lock,
  UserCheck,
  Activity,
  User,
  X,
  Copy,
  Mail,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Search,
  ChevronLeft,
  ChevronRight,
  Command
} from 'lucide-react';

export type AdminTabType =
  | 'firestore_users'
  | 'staff'
  | 'activity_log'
  | 'overview'
  | 'vehicles'
  | 'bookings'
  | 'reports'
  | 'settings'
  | 'notifications';

interface AdminDashboardProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  settings: AppSettings;
  onRefreshData: () => void;
  onBackToSite: () => void;
  initialTab?: AdminTabType;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  vehicles,
  bookings,
  settings,
  onRefreshData,
  onBackToSite,
  initialTab,
}) => {
  const { user, isSuperAdmin, isAdmin, isLoadingAuth } = useAuth();

  // Role-based Tab Access Policy
  const isTabAuthorized = (tabId: AdminTabType): boolean => {
    if (tabId === 'firestore_users' || tabId === 'staff' || tabId === 'activity_log') {
      return Boolean(isSuperAdmin);
    }
    if (tabId === 'settings' || tabId === 'reports' || tabId === 'overview' || tabId === 'vehicles' || tabId === 'notifications') {
      return Boolean(isAdmin);
    }
    if (tabId === 'bookings') {
      return true; // الموظف والمدير معًا
    }
    return false;
  };

  const pathToTabMap: Record<string, AdminTabType> = {
    '/admin/dashboard': 'overview',
    '/admin/bookings': 'bookings',
    '/admin/vehicles': 'vehicles',
    '/admin/reports': 'reports',
    '/admin/settings': 'settings',
    '/admin/notifications': 'notifications',
    '/admin/users': 'firestore_users',
    '/admin/staff': 'staff',
    '/admin/activity': 'activity_log',
  };

  const getTabFromCurrentPath = (): AdminTabType | null => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    for (const [routePath, tabKey] of Object.entries(pathToTabMap)) {
      if (path === routePath || path.startsWith(routePath)) {
        return tabKey;
      }
    }
    return null;
  };

  // Active Admin Tab - Respect direct path, initialTab if authorized, fallback to overview for admins and bookings for staff
  const [activeTab, setActiveTab] = useState<AdminTabType>(() => {
    const fromPath = getTabFromCurrentPath();
    if (fromPath && isTabAuthorized(fromPath)) {
      return fromPath;
    }
    if (initialTab && isTabAuthorized(initialTab)) {
      return initialTab;
    }
    return isAdmin ? 'overview' : 'bookings';
  });

  // Ensure activeTab conforms to user's permissions and sync initialTab
  useEffect(() => {
    const fromPath = getTabFromCurrentPath();
    if (fromPath && isTabAuthorized(fromPath)) {
      setActiveTab(fromPath);
    } else if (initialTab && isTabAuthorized(initialTab)) {
      setActiveTab(initialTab);
    } else if (!isTabAuthorized(activeTab)) {
      setActiveTab(isAdmin ? 'overview' : 'bookings');
    }
  }, [initialTab, isAdmin, isSuperAdmin]);

  // Support browser Back/Forward navigation
  useEffect(() => {
    const onPopState = () => {
      const fromPath = getTabFromCurrentPath();
      if (fromPath && isTabAuthorized(fromPath)) {
        setActiveTab(fromPath);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isAdmin, isSuperAdmin]);

  const handleTabChange = (tab: AdminTabType) => {
    setActiveTab(tab);
    const pathMap: Record<AdminTabType, string> = {
      firestore_users: '/admin/users',
      staff: '/admin/staff',
      activity_log: '/admin/activity',
      overview: '/admin/dashboard',
      vehicles: '/admin/vehicles',
      bookings: '/admin/bookings',
      reports: '/admin/reports',
      settings: '/admin/settings',
      notifications: '/admin/notifications',
    };
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      const targetPath = pathMap[tab];
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  // Modals state
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null | undefined>(undefined); // undefined = closed, null = new
  const [inspectionVehicle, setInspectionVehicle] = useState<Vehicle | null>(null);
  const [inspectionBookingId, setInspectionBookingId] = useState<string>('');
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Aux Data State - Instant cached bootstrap
  const [customers, setCustomers] = useState<Customer[]>(() => dataService.getCachedCustomers());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => dataService.getNotifications());

  // Vehicles needing oil change computed reactively in 0ms without network roundtrip
  const vehiclesNeedingOil = React.useMemo(() => {
    return dataService.calculateVehiclesNeedingOil(vehicles, settings.oilChangeIntervalKm || 5000);
  }, [vehicles, settings.oilChangeIntervalKm]);

  // Cloud Sync State & Timestamp
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; success: boolean } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(new Date());

  // Collapsible Sidebar & Command Palette (Ctrl+K)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Global Ctrl+K Keyboard Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    loadAuxData();

    // Subscribe to real-time administrative notifications (admin only)
    let unsubscribeNotifications: (() => void) | undefined;
    if (isAdmin) {
      unsubscribeNotifications = dataService.subscribeToNotifications((updatedNotifs) => {
        setNotifications(updatedNotifs);
      });
    }

    return () => {
      if (unsubscribeNotifications) {
        unsubscribeNotifications();
      }
    };
  }, [isAdmin]);

  const loadAuxData = async () => {
    try {
      const custs = await dataService.getCustomers(true);
      setCustomers(custs || []);

      if (isAdmin) {
        const notifs = await dataService.getNotifications();
        setNotifications(notifs || []);
      }
    } catch (err) {
      console.warn('Auxiliary admin data loading note:', err);
    }
  };

  const handleSyncAllWithFirestore = async () => {
    try {
      setIsSyncing(true);
      setSyncStatus(null);
      const res = await dataService.syncAllSystemData();
      await onRefreshData();
      await loadAuxData();
      setLastSyncedAt(new Date());
      const successMsg = `تمت المزامنة السحابية بنجاح: تم تأكيد ومزامنة أسطول السيارات (${res.vehicles.total} سيارة) وسجل الحجوزات (${res.bookings.total} حجز) مع قاعدة بيانات Cloud Firestore.`;
      setSyncStatus({
        message: successMsg,
        success: true,
      });
      setTimeout(() => {
        setSyncStatus(null);
      }, 7000);
    } catch (err: any) {
      console.error('Sync all error:', err);
      const errorMsg = `تعذر إتمام المزامنة مع قاعدة البيانات: ${err?.message || 'خطأ في الاتصال'}`;
      setSyncStatus({
        message: errorMsg,
        success: false,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    try {
      setIsDeletingVehicle(true);
      setDeleteError(null);
      await dataService.deleteVehicle(vehicleToDelete.id);
      setVehicleToDelete(null);
      await onRefreshData();
      await loadAuxData();
    } catch (err: any) {
      console.error('Failed to delete vehicle:', err);
      setDeleteError(err?.message || 'تعذر حذف السيارة من قاعدة البيانات.');
    } finally {
      setIsDeletingVehicle(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-cairo" dir="rtl">
        <div className="text-center space-y-4 max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-bold text-white">جاري التحقق من صلاحيات الدخول المعتمدة...</h3>
          <p className="text-xs text-slate-400">يرجى الانتظار ريثما يتم تدقيق مطالبات الأمان المشفرة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setShowAccountDetails(true)}
            className="w-8 h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-sm shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="عرض تفاصيل الحساب والمعرف (UID)"
            aria-label="عرض تفاصيل الحساب"
          >
            <LayoutDashboard className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-lg font-black text-white">
                لوحة إدارة شاكر لتأجير السيارات
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm uppercase tracking-wider">
                <Shield className="w-3 h-3" />
                {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Staff'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAccountDetails(true)}
              className="flex text-[11px] text-slate-400 hover:text-amber-300 items-center gap-1.5 mt-0.5 transition-colors cursor-pointer group text-right"
              title="عرض تفاصيل الحساب والمعرف (UID)"
            >
              <User className="w-3 h-3 text-slate-400 group-hover:text-amber-400 transition-colors" />
              <span>المشرف: <span className="text-slate-300 group-hover:text-amber-300 font-medium underline decoration-slate-700 underline-offset-2 transition-colors">{user?.displayName || user?.email || 'مسؤول النظام'}</span></span>
            </button>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Command / Search (Ctrl+K) */}
          <button
            type="button"
            onClick={() => setShowCommandPalette(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all shadow-sm cursor-pointer"
            title="بحث شامل في الأسطول والحجوزات والأقسام (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">بحث سريع</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-400">
              Ctrl K
            </kbd>
          </button>

          {/* Cloud Sync Button with Time */}
          <button
            type="button"
            onClick={handleSyncAllWithFirestore}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            title="مزامنة فورية مع قاعدة بيانات Cloud Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">{isSyncing ? 'جاري المزامنة...' : 'مزامنة السحابة'}</span>
            {lastSyncedAt && !isSyncing && (
              <span className="text-[10px] text-slate-400 hidden xl:inline font-mono">
                ({lastSyncedAt.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' })})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowMyProfile(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="حسابي الشخصي وحجوزاتي"
          >
            <User className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">حسابي الشخصي</span>
          </button>

          <button
            onClick={onBackToSite}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
            title="عرض الموقع"
            aria-label="عرض الموقع"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Admin Layout: Right Sidebar + Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6">
        {/* Right Sidebar (Navigation) */}
        <aside className={`w-full ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64 lg:w-72'} shrink-0 md:sticky md:top-16 self-start z-20 transition-all duration-300`}>
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl md:rounded-3xl p-2 md:p-3 shadow-xl backdrop-blur-sm">
            <div className="hidden md:flex items-center justify-between px-3 py-2 mb-2 border-b border-slate-800/80">
              {!isSidebarCollapsed && (
                <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                  <LayoutDashboard className="w-4 h-4 text-amber-400" />
                  <span>أقسام لوحة الإدارة</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className={`p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ${
                  isSidebarCollapsed ? 'mx-auto' : ''
                }`}
                title={isSidebarCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
                aria-label={isSidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
              >
                {isSidebarCollapsed ? (
                  <ChevronLeft className="w-4 h-4 text-amber-400" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>

            <nav className="flex md:flex-col overflow-x-auto md:overflow-visible gap-3 scrollbar-thin py-1 md:py-0">
              {[
                {
                  title: 'التشغيل والعمليات',
                  items: [
                    {
                      id: 'overview' as AdminTabType,
                      label: 'لوحة المؤشرات العامة',
                      icon: BarChart2,
                      badge: bookings.filter((b) => b.status === 'new').length > 0 ? bookings.filter((b) => b.status === 'new').length : undefined,
                    },
                    {
                      id: 'bookings' as AdminTabType,
                      label: `الحجوزات والتأجير (${bookings.length})`,
                      icon: Calendar,
                      badge: bookings.filter((b) => b.status === 'new').length > 0 ? bookings.filter((b) => b.status === 'new').length : undefined,
                    },
                    { id: 'vehicles' as AdminTabType, label: `أسطول السيارات (${vehicles.length})`, icon: Car },
                  ],
                },
                {
                  title: 'التحليل والمتابعة',
                  items: [
                    { id: 'reports' as AdminTabType, label: 'التقارير المالية والتشغيلية', icon: BarChart3 },
                    {
                      id: 'notifications' as AdminTabType,
                      label: 'مركز التنبيهات',
                      icon: Bell,
                      badge: notifications.filter((n) => !n.read).length > 0 ? notifications.filter((n) => !n.read).length : undefined,
                    },
                  ],
                },
                {
                  title: 'الإدارة والنظام',
                  items: [
                    { id: 'firestore_users' as AdminTabType, label: 'المستخدمون والملفات', icon: FolderOpen },
                    { id: 'staff' as AdminTabType, label: 'إدارة الموظفين والصلاحيات', icon: UserCheck },
                    { id: 'activity_log' as AdminTabType, label: 'سجل النشاطات', icon: Activity },
                    { id: 'settings' as AdminTabType, label: 'إعدادات النظام والأسعار', icon: Settings },
                  ],
                },
              ].map((section, sIdx) => {
                const authorizedItems = section.items.filter((tab) => isTabAuthorized(tab.id));
                if (authorizedItems.length === 0) return null;

                return (
                  <div key={sIdx} className="space-y-1">
                    {!isSidebarCollapsed && (
                      <div className="hidden md:block px-3 py-1 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        {section.title}
                      </div>
                    )}
                    <div className="flex md:flex-col gap-1.5">
                      {authorizedItems.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabChange(tab.id)}
                            title={tab.label}
                            className={`w-auto md:w-full ${
                              isSidebarCollapsed ? 'md:px-2 md:justify-center' : 'px-3.5 justify-between'
                            } py-2.5 rounded-xl font-bold flex items-center gap-2.5 transition-all shrink-0 md:shrink text-right cursor-pointer relative ${
                              isActive
                                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 text-xs sm:text-sm font-black'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/70 text-xs sm:text-sm'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0" />
                              {!isSidebarCollapsed && <span className="whitespace-nowrap">{tab.label}</span>}
                            </div>
                            {Boolean(tab.badge) && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-black shrink-0 ${
                                  isActive
                                    ? 'bg-slate-950 text-amber-400'
                                    : 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
                                } ${isSidebarCollapsed ? 'md:absolute md:-top-1 md:-right-1 md:text-[9px] md:px-1.5' : ''}`}
                              >
                                {tab.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Admin Content Container */}
        <main className="flex-1 min-w-0 space-y-6 lg:space-y-8">
          {/* UNAUTHORIZED ACCESS GUARD FALLBACK */}
          {!isTabAuthorized(activeTab) && (
            <div className="bg-slate-900/90 border border-rose-500/30 rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto my-6 space-y-5 shadow-2xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-white">غير مصرح لك بالوصول لهذا القسم</h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {activeTab === 'settings' || activeTab === 'reports' || activeTab === 'overview'
                    ? 'يتطلب الوصول إلى هذا القسم صلاحيات إدارة عليا (مدير نظام / Admin). دور حسابك الحالي لا يمتلك الإذن الكافي.'
                    : 'يتطلب الوصول إلى هذا القسم صلاحيات المدير العام للمنظومة (Super Admin).'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('bookings')}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 inline-flex items-center gap-2 cursor-pointer"
              >
                <span>العودة إلى إدارة الحجوزات</span>
              </button>
            </div>
          )}

          {/* ANIMATED ACTIVE TAB CONTENT */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="space-y-6 lg:space-y-8"
            >
              {/* TAB 0: OVERVIEW METRICS (Admin Only) */}
              {isAdmin && activeTab === 'overview' && (
                <AdminOverview
                  vehicles={vehicles}
                  bookings={bookings}
                  vehiclesNeedingOil={vehiclesNeedingOil}
                  onNavigateTab={handleTabChange}
                  onOpenAddVehicle={() => setEditingVehicle(null)}
                  onSyncAll={handleSyncAllWithFirestore}
                  isSyncing={isSyncing}
                />
              )}

              {/* TAB 1: BOOKINGS & RENTALS */}
              {activeTab === 'bookings' && (
                <AdminBookings
                  bookings={bookings}
                  vehicles={vehicles}
                  onRefreshData={() => {
                    onRefreshData();
                    loadAuxData();
                  }}
                  onOpenInspection={(v, bookingId) => {
                    setInspectionVehicle(v);
                    setInspectionBookingId(bookingId);
                  }}
                  onDeleteBooking={async (bookingId) => {
                    await dataService.deleteBooking(bookingId);
                    onRefreshData();
                    loadAuxData();
                  }}
                  isSyncing={isSyncing}
                  onSyncWithFirestore={handleSyncAllWithFirestore}
                  syncStatus={syncStatus}
                />
              )}

              {/* TAB 2: FLEET VEHICLES */}
              {activeTab === 'vehicles' && (
                <AdminVehicles
                  vehicles={vehicles}
                  bookings={bookings}
                  onRefreshData={() => {
                    onRefreshData();
                    loadAuxData();
                  }}
                  onOpenAddVehicle={() => setEditingVehicle(null)}
                  onOpenEditVehicle={(v) => setEditingVehicle(v)}
                  onDeleteVehicle={(v) => {
                    setDeleteError(null);
                    setVehicleToDelete(v);
                  }}
                  onOpenInspection={(v) => {
                    setInspectionVehicle(v);
                    setInspectionBookingId('');
                  }}
                  isSyncing={isSyncing}
                  onSyncWithFirestore={handleSyncAllWithFirestore}
                  syncStatus={syncStatus}
                />
              )}

              {/* TAB 3: REPORTS (Admin Only) */}
              {isAdmin && activeTab === 'reports' && (
                <React.Suspense fallback={<SkeletonLoader type="card" lines={3} />}>
                  <AdminReports
                    vehicles={vehicles}
                    bookings={bookings}
                  />
                </React.Suspense>
              )}

              {/* TAB 4: SETTINGS (Admin Only) */}
              {isAdmin && activeTab === 'settings' && (
                <React.Suspense fallback={<SkeletonLoader type="card" lines={3} />}>
                  <AdminSettings
                    settings={settings}
                    vehicles={vehicles}
                    onSettingsUpdated={onRefreshData}
                  />
                </React.Suspense>
              )}

              {/* TAB 5: NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <AdminNotifications
                  notifications={notifications}
                  onRefresh={loadAuxData}
                />
              )}

              {/* TAB 6: STAFF ROLES & PERMISSIONS (Super Admin Only) */}
              {isSuperAdmin && activeTab === 'staff' && (
                <React.Suspense fallback={<SkeletonLoader type="table" lines={5} />}>
                  <AdminStaffRoles onBackToOverview={() => handleTabChange('bookings')} />
                </React.Suspense>
              )}

              {/* TAB 7: FIRESTORE USERS & FILES (Super Admin Only) */}
              {isSuperAdmin && activeTab === 'firestore_users' && (
                <React.Suspense fallback={<SkeletonLoader type="table" lines={5} />}>
                  <AdminUsersFilesView onBackToOverview={() => handleTabChange('bookings')} />
                </React.Suspense>
              )}

              {/* TAB 8: ACTIVITY & AUDIT LOG (Super Admin Only) */}
              {isSuperAdmin && activeTab === 'activity_log' && (
                <React.Suspense fallback={<SkeletonLoader type="table" lines={5} />}>
                  <AdminActivityLog onBackToOverview={() => handleTabChange('bookings')} />
                </React.Suspense>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ALL MODALS */}
      {/* 1. Vehicle Add/Edit */}
      {editingVehicle !== undefined && (
        <VehicleFormModal
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(undefined)}
          onSaved={() => {
            onRefreshData();
            loadAuxData();
            setEditingVehicle(undefined);
          }}
        />
      )}

      {/* 2. Inspection Modal */}
      {inspectionVehicle && (
        <InspectionModal
          vehicle={inspectionVehicle}
          bookingId={inspectionBookingId}
          onClose={() => setInspectionVehicle(null)}
          onSaved={() => {
            onRefreshData();
            loadAuxData();
          }}
        />
      )}

      {/* 3. Vehicle Deletion Confirmation Modal with Feedback */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">حذف السيارة من الأسطول</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف السيارة &ldquo;{vehicleToDelete.brand} {vehicleToDelete.model} ({vehicleToDelete.year})&rdquo; من الأسطول النشط؟
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold text-right flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingVehicle}
                onClick={confirmDeleteVehicle}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                <span>{isDeletingVehicle ? 'جاري الحذف...' : 'تأكيد الحذف'}</span>
              </button>
              <button
                type="button"
                disabled={isDeletingVehicle}
                onClick={() => {
                  setVehicleToDelete(null);
                  setDeleteError(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Personal Profile & Bookings Management Modal (Admin Access) */}
      {showMyProfile && (
        <UserProfileModal
          isOpen={showMyProfile}
          bookings={bookings}
          onClose={() => setShowMyProfile(false)}
          onOpenBooking={() => {
            setShowMyProfile(false);
            onBackToSite();
          }}
          onOpenAdminView={() => setShowMyProfile(false)}
        />
      )}

      {/* 6. Account Details Modal (تفاصيل الحساب) */}
      {showAccountDetails && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => {
            setShowAccountDetails(false);
            setCopiedUid(false);
          }}
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close button */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-inner">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">تفاصيل الحساب</h3>
                  <p className="text-xs text-slate-400 mt-0.5">معلومات حساب المشرف ومعرّف الهوية الرقمية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAccountDetails(false);
                  setCopiedUid(false);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Info Fields */}
            <div className="space-y-3 text-xs">
              {/* Name */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>الاسم:</span>
                </span>
                <span className="text-white font-bold text-sm">
                  {user?.displayName || 'مسؤول النظام'}
                </span>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>البريد الإلكتروني:</span>
                </span>
                <span className="text-slate-200 font-mono text-xs dir-ltr">
                  {user?.email || '—'}
                </span>
              </div>

              {/* Role */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  <span>الدور الوظيفي:</span>
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm uppercase tracking-wider">
                  <Shield className="w-3 h-3" />
                  <span>{isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Staff'}</span>
                </span>
              </div>

              {/* UID */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">معرّف الحساب (UID):</span>
                  {user?.uid && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(user.uid);
                        setCopiedUid(true);
                        setTimeout(() => setCopiedUid(false), 2000);
                      }}
                      className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-sans transition-colors cursor-pointer"
                    >
                      {copiedUid ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ المعرّف</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="font-mono text-amber-300/95 text-xs select-all break-all bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 dir-ltr text-left">
                  {user?.uid || '—'}
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowAccountDetails(false);
                  setCopiedUid(false);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ctrl+K Quick Command / Search Modal */}
      {showCommandPalette && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowCommandPalette(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800 bg-slate-950">
              <Search className="w-5 h-5 text-amber-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="ابحث عن سيارة، رقم حجز، اسم عميل، أو قسم..."
                className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-slate-500 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowCommandPalette(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results Container */}
            <div className="p-4 max-h-96 overflow-y-auto space-y-4 text-xs">
              {(() => {
                const q = commandQuery.trim().toLowerCase();
                const matchedTabs = [
                  { id: 'overview' as const, label: 'لوحة المؤشرات العامة', icon: BarChart2 },
                  { id: 'bookings' as const, label: 'الحجوزات والتأجير', icon: Calendar },
                  { id: 'vehicles' as const, label: 'أسطول السيارات', icon: Car },
                  { id: 'reports' as const, label: 'التقارير المالية والتشغيلية', icon: BarChart3 },
                  { id: 'notifications' as const, label: 'مركز التنبيهات والإشعارات', icon: Bell },
                  { id: 'firestore_users' as const, label: 'المستخدمون والملفات (Firestore)', icon: FolderOpen },
                  { id: 'staff' as const, label: 'إدارة الموظفين والصلاحيات', icon: UserCheck },
                  { id: 'activity_log' as const, label: 'سجل النشاطات', icon: Activity },
                  { id: 'settings' as const, label: 'إعدادات النظام والأسعار', icon: Settings },
                ].filter((t) => isTabAuthorized(t.id) && (!q || t.label.toLowerCase().includes(q)));

                const matchedVehicles = (vehicles || []).filter(
                  (v) =>
                    q &&
                    ((v.brand || '').toLowerCase().includes(q) ||
                      (v.model || '').toLowerCase().includes(q) ||
                      (v.plateNumber || '').toLowerCase().includes(q))
                ).slice(0, 5);

                const matchedBookings = (bookings || []).filter(
                  (b) =>
                    q &&
                    ((b.bookingNumber || '').toLowerCase().includes(q) ||
                      (b.customerName || '').toLowerCase().includes(q) ||
                      (b.customerPhone || '').toLowerCase().includes(q))
                ).slice(0, 5);

                const hasAny = matchedTabs.length > 0 || matchedVehicles.length > 0 || matchedBookings.length > 0;

                if (!hasAny) {
                  return (
                    <div className="py-8 text-center text-slate-500">
                      لم يتم العثور على أي نتائج مطابقة لـ "{commandQuery}"
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {/* Tabs */}
                    {matchedTabs.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider px-2">أقسام لوحة التحكم</span>
                        <div className="space-y-1">
                          {matchedTabs.map((t) => {
                            const Icon = t.icon;
                            return (
                              <button
                                key={t.id}
                                onClick={() => {
                                  handleTabChange(t.id);
                                  setShowCommandPalette(false);
                                }}
                                className="w-full p-2.5 rounded-xl hover:bg-slate-800/80 flex items-center justify-between text-right text-slate-300 hover:text-white transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-2.5">
                                  <Icon className="w-4 h-4 text-amber-400" />
                                  <span className="font-bold">{t.label}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 group-hover:text-amber-400">انتقال سريع ←</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Vehicles */}
                    {matchedVehicles.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider px-2">السيارات المطابقة</span>
                        <div className="space-y-1">
                          {matchedVehicles.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => {
                                handleTabChange('vehicles');
                                setShowCommandPalette(false);
                              }}
                              className="w-full p-2.5 rounded-xl hover:bg-slate-800/80 flex items-center justify-between text-right text-slate-300 hover:text-white transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <Car className="w-4 h-4 text-blue-400" />
                                <div>
                                  <span className="font-bold text-white">{v.brand} {v.model} ({v.year})</span>
                                  <span className="text-[11px] text-slate-400 font-mono block">لوحة: {v.plateNumber} • ${v.dailyPrice}/يوم</span>
                                </div>
                              </div>
                              <span className="text-[10px] text-emerald-400 font-bold">{v.status === 'available' ? 'متوفرة' : v.status === 'rented' ? 'مؤجرة' : 'صيانة'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bookings */}
                    {matchedBookings.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider px-2">الحجوزات المطابقة</span>
                        <div className="space-y-1">
                          {matchedBookings.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => {
                                handleTabChange('bookings');
                                setShowCommandPalette(false);
                              }}
                              className="w-full p-2.5 rounded-xl hover:bg-slate-800/80 flex items-center justify-between text-right text-slate-300 hover:text-white transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <Calendar className="w-4 h-4 text-amber-400" />
                                <div>
                                  <span className="font-bold text-white">حجز #{b.bookingNumber} • {b.customerName}</span>
                                  <span className="text-[11px] text-slate-400 block">{b.vehicleName} ({b.pickupDate} إلى {b.returnDate})</span>
                                </div>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-amber-400">${b.totalPrice}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer Tip */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 text-[11px] text-slate-500 flex justify-between items-center">
              <span>اضغط <kbd className="font-mono bg-slate-900 border border-slate-800 px-1 rounded">Esc</kbd> للإغلاق</span>
              <span>نظام بحث شاكر المركزي</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
