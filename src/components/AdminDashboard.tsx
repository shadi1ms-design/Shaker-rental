import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { navigate, useLocation, matchPath, goBack } from '../router';
import { Vehicle, Booking, AppSettings, AppNotification } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { useAppData } from '../contexts/DataContext';
import { AdminTabType, ADMIN_NAV_ITEMS, ADMIN_NAV_SECTIONS, ROLE_LABEL } from '../constants/adminNav';
import { getAdminTabFromPath } from '../utils/adminTabs';
import { ConfirmModal } from './common/ConfirmModal';
import { SkeletonLoader } from './common/SkeletonLoader';
import { MenuButton } from './MenuButton';
import { GlobalMenu } from './GlobalMenu';
import { AdminCommandPalette } from './admin/AdminCommandPalette';
import { CheckCircle2, X, Shield, Search, ChevronLeft, ChevronRight, ArrowRight, User, LogOut, MoreHorizontal, Lock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { lazyWithRetry } from '../utils/lazyWithRetry';

// Lazy-loaded Admin Views
const AdminReports = lazyWithRetry(() => import('./AdminReports').then((m) => ({ default: m.AdminReports })));
const AdminSettings = lazyWithRetry(() => import('./AdminSettings').then((m) => ({ default: m.AdminSettings })));
const AdminUsersFilesView = lazyWithRetry(() => import('./AdminUsersFilesView').then((m) => ({ default: m.AdminUsersFilesView })));
const AdminStaffRoles = lazyWithRetry(() => import('./admin/AdminStaffRoles').then((m) => ({ default: m.AdminStaffRoles })));
const AdminActivityLog = lazyWithRetry(() => import('./admin/AdminActivityLog').then((m) => ({ default: m.AdminActivityLog })));

// Modular Sub-components
import { AdminOverview } from './admin/AdminOverview';
import { AdminBookings } from './admin/AdminBookings';
import { AdminVehicles } from './admin/AdminVehicles';
import { AdminNotifications } from './admin/AdminNotifications';

// Modals
import { VehicleFormModal } from './VehicleFormModal';
import { RentalContract } from './RentalContract';

export type { AdminTabType } from '../constants/adminNav';

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
}) => {
  const { user, isSuperAdmin, isAdmin, isLoadingAuth, logout } = useAuth();
  const { vehiclesReady } = useAppData();
  const { pathname: currentPath } = useLocation();

  const [syncStatus, setSyncStatus] = useState<{ message: string; success: boolean } | null>(null);

  const isTabAuthorized = useCallback(
    (tabId: AdminTabType): boolean => {
      if (tabId === 'staff' || tabId === 'activity_log') {
        return Boolean(isSuperAdmin);
      }
      if (
        tabId === 'firestore_users' ||
        tabId === 'settings' ||
        tabId === 'reports' ||
        tabId === 'overview' ||
        tabId === 'vehicles' ||
        tabId === 'notifications'
      ) {
        return Boolean(isAdmin || isSuperAdmin);
      }
      if (tabId === 'bookings') {
        return true;
      }
      return false;
    },
    [isAdmin, isSuperAdmin]
  );

  const activeTab = useMemo(() => {
    const tabFromPath = getAdminTabFromPath(currentPath, { isAdmin: Boolean(isAdmin), isSuperAdmin: Boolean(isSuperAdmin) });
    if (isTabAuthorized(tabFromPath)) {
      return tabFromPath;
    }
    return isSuperAdmin ? 'firestore_users' : isAdmin ? 'overview' : 'bookings';
  }, [currentPath, isAdmin, isSuperAdmin, isTabAuthorized]);

  const handleTabChange = (tab: AdminTabType, searchFilter?: string) => {
    const pathMap: Record<AdminTabType, string> = {
      overview: '/admin/dashboard',
      bookings: '/admin/bookings',
      vehicles: '/admin/vehicles',
      reports: '/admin/reports',
      notifications: '/admin/notifications',
      firestore_users: '/admin/users',
      staff: '/admin/staff',
      activity_log: '/admin/activity-log',
      settings: '/admin/settings',
    };
    const targetPath = pathMap[tab];
    if (targetPath) {
      if (searchFilter) {
        navigate(`${targetPath}?q=${encodeURIComponent(searchFilter)}`);
      } else {
        navigate(targetPath);
      }
    }
  };

  const [showMobileMore, setShowMobileMore] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandPaletteSearch, setCommandPaletteSearch] = useState('');

  const accountBtnRef = useRef<HTMLButtonElement | null>(null);
  const mobileMoreBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!showAccountMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAccountMenu(false);
        accountBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAccountMenu]);

  useEffect(() => {
    if (!showMobileMore) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMobileMore(false);
        mobileMoreBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMobileMore]);

  const isNewVehicleRoute = currentPath === '/admin/vehicles/new';
  const editVehicleMatch = matchPath('/admin/vehicles/:id/edit', currentPath);
  const contractMatch = matchPath('/admin/contracts/:id', currentPath);

  const editingVehicle = isNewVehicleRoute
    ? null
    : editVehicleMatch
    ? vehicles.find((v) => v.id === editVehicleMatch.id)
    : undefined;

  const openVehicleForm = (v: Vehicle | null) =>
    navigate(v ? `/admin/vehicles/${encodeURIComponent(v.id)}/edit` : '/admin/vehicles/new');

  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => dataService.getNotifications());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowAccountMenu(false);
        setShowMobileMore(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadAuxData = useCallback(async () => {
    try {
      if (isAdmin || isSuperAdmin) {
        const notifs = await dataService.getNotifications();
        setNotifications(notifs || []);
      }
    } catch (err) {
      console.warn('Auxiliary admin data loading note:', err);
    }
  }, [isAdmin, isSuperAdmin]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) loadAuxData();
    });

    let unsubscribeNotifications: (() => void) | undefined;
    if (isAdmin || isSuperAdmin) {
      unsubscribeNotifications = dataService.subscribeToNotifications((updatedNotifs) => {
        setNotifications(updatedNotifs);
      });
    }

    return () => {
      active = false;
      if (unsubscribeNotifications) unsubscribeNotifications();
    };
  }, [isAdmin, isSuperAdmin, loadAuxData]);

  const vehicleDeleteActiveBookings = useMemo(() => {
    if (!vehicleToDelete) return [];
    return bookings.filter(
      (b) =>
        b.vehicleId === vehicleToDelete.id &&
        !b.isDeleted &&
        ['new', 'reviewing', 'confirmed', 'rented'].includes(b.status)
    );
  }, [vehicleToDelete, bookings]);

  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    try {
      setIsDeletingVehicle(true);
      setDeleteError(null);
      await dataService.deleteVehicle(vehicleToDelete.id);
      setVehicleToDelete(null);
      await onRefreshData();
      await loadAuxData();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'تعذر حذف السيارة من قاعدة البيانات.');
    } finally {
      setIsDeletingVehicle(false);
    }
  };

  const roleText = isSuperAdmin
    ? ROLE_LABEL.superAdmin
    : isAdmin
    ? ROLE_LABEL.admin
    : ROLE_LABEL.staff;

  if (isLoadingAuth) {
    return (
      <div className="min-h-dvh bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-cairo" dir="rtl">
        <div className="text-center space-y-4 max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-bold text-white">جاري التحقق من الصلاحيات...</h3>
        </div>
      </div>
    );
  }

  const vehicleNotFound = (
    <div className="min-h-[40dvh] flex flex-col items-center justify-center gap-4 text-center">
      <p className="text-slate-300 font-bold">لم يتم العثور على هذه السيارة.</p>
      <button
        type="button"
        onClick={() => handleTabChange('vehicles')}
        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer"
      >
        العودة لأسطول السيارات
      </button>
    </div>
  );

  const unauthorizedView = (
    <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4 shadow-2xl">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
        <Lock className="w-8 h-8" />
      </div>
      <div className="text-xl font-extrabold text-white">غير مصرح لك بالوصول</div>
      <button type="button" onClick={() => handleTabChange('bookings')} className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-extrabold cursor-pointer">العودة للحجوزات</button>
    </div>
  );

  const isFleetRestrictedRoute = isNewVehicleRoute || Boolean(editVehicleMatch);

  const vehiclePage =
    isFleetRestrictedRoute && !(isAdmin || isSuperAdmin) ? (
      unauthorizedView
    ) : isNewVehicleRoute || editVehicleMatch ? (
      editingVehicle === undefined ? (
        !vehiclesReady ? (
          <SkeletonLoader type="card" lines={4} />
        ) : (
          vehicleNotFound
        )
      ) : (
        <VehicleFormModal
          key={editingVehicle?.id || 'new'}
          vehicle={editingVehicle}
          onClose={() => goBack('/admin/vehicles')}
          onSaved={() => {
            onRefreshData();
            loadAuxData();
            navigate('/admin/vehicles', { replace: true });
          }}
        />
      )
    ) : contractMatch ? (
      (() => {
        const contractBooking = bookings.find((b) => b.id === contractMatch.id || b.bookingNumber === contractMatch.id);
        return contractBooking ? (
          <RentalContract
            booking={contractBooking}
            settings={settings}
            vehicle={vehicles.find((v) => v.id === contractBooking.vehicleId) || null}
            onBack={() => goBack('/admin/bookings')}
          />
        ) : (
          <div className="min-h-[40dvh] flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-slate-300 font-bold">لم يتم العثور على هذا الحجز.</p>
            <button
              type="button"
              onClick={() => handleTabChange('bookings')}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer"
            >
              العودة إلى الحجوزات
            </button>
          </div>
        );
      })()
    ) : null;

  const primaryMobileTabs = ADMIN_NAV_ITEMS.filter((item) =>
    ['overview', 'bookings', 'vehicles', 'reports'].includes(item.id) && isTabAuthorized(item.id)
  );

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col font-cairo" dir="rtl">
      <GlobalMenu
        currentView="admin"
        onNavigate={(v) => {
          if (v === 'home') onBackToSite();
          else navigate(v === 'cars' ? '/cars' : v === 'contact' ? '/contact' : '/');
        }}
        onOpenBooking={() => navigate('/cars')}
        onOpenAuth={() => navigate('/login')}
        onOpenProfile={() => navigate('/profile')}
      />

      <header className="relative z-30 bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-3 shadow-md">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MenuButton />
            <button
              type="button"
              onClick={onBackToSite}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">الموقع الرئيسي</span>
            </button>
            <div>
              <p className="text-xs font-extrabold text-white">لوحة إدارة شاكر</p>
              <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm w-fit">
                <Shield className="w-2.5 h-2.5" />
                {roleText}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="flex items-center gap-2 px-3 py-1.5 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">بحث سريع</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-400">
                Ctrl K
              </kbd>
            </button>
            <div className="relative">
              <button
                ref={accountBtnRef}
                type="button"
                onClick={() => setShowAccountMenu((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={showAccountMenu}
                aria-label="قائمة الحساب"
                className="flex items-center gap-2 px-3 py-1.5 min-h-[38px] rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  {user?.displayName?.charAt(0) || <User className="w-3.5 h-3.5" />}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showAccountMenu ? 'rotate-180' : ''}`} />
              </button>

              {showAccountMenu && (
                <>
                  <button
                    type="button"
                    aria-label="إغلاق قائمة الحساب"
                    tabIndex={-1}
                    className="fixed inset-0 z-40 bg-transparent cursor-default w-full h-full border-none"
                    onClick={() => {
                      setShowAccountMenu(false);
                      accountBtnRef.current?.focus();
                    }}
                  />
                  <div
                    role="menu"
                    aria-label="خيارات الحساب"
                    className="absolute end-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl z-50 space-y-1"
                  >
                    <div className="p-3 border-b border-slate-800 space-y-1">
                      <p className="font-bold text-white text-xs truncate">{user?.displayName || 'مسؤول النظام'}</p>
                      <p className="text-xs text-slate-400 font-mono truncate" dir="ltr">{user?.email}</p>
                    </div>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setShowAccountMenu(false);
                        navigate('/profile');
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <User className="w-4 h-4 text-amber-400" />
                      <span>الملف الشخصي</span>
                    </button>
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setShowAccountMenu(false);
                        logout();
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors pt-2 border-t border-slate-800"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <AdminCommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigateTab={(tab, searchFilter) => {
          handleTabChange(tab, searchFilter);
          if (searchFilter && tab === 'bookings') {
            setCommandPaletteSearch(searchFilter);
          }
        }}
        vehicles={vehicles}
        bookings={bookings}
      />

      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-6 pb-24 md:pb-8">
        <aside className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-64 lg:w-72'} shrink-0 sticky top-6 max-h-[calc(100dvh-5rem)] overflow-y-auto z-20 transition-all duration-300`}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 shadow-xl space-y-4">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              {!isSidebarCollapsed && <span className="text-xs font-extrabold text-slate-400">أقسام لوحة الإدارة</span>}
              <button type="button" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer min-h-10 min-w-10 inline-flex items-center justify-center" aria-label={isSidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}>
                {isSidebarCollapsed ? <ChevronLeft className="w-4 h-4 text-amber-400" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
            <nav className="space-y-4">
              {ADMIN_NAV_SECTIONS.map((sec) => {
                const secItems = ADMIN_NAV_ITEMS.filter((item) => item.section === sec.id && isTabAuthorized(item.id));
                if (secItems.length === 0) return null;
                return (
                  <div key={sec.id} className="space-y-1">
                    {!isSidebarCollapsed && <div className="px-3 py-1 text-xs font-extrabold uppercase text-slate-400 tracking-wider">{sec.title}</div>}
                    {secItems.map((nav) => {
                      const Icon = nav.icon;
                      const isActive = activeTab === nav.id;
                      const unreadCount = nav.id === 'notifications' ? notifications.filter((n) => !n.read).length : 0;
                      return (
                        <button key={nav.id} type="button" onClick={() => handleTabChange(nav.id)} className={`w-full ${isSidebarCollapsed ? 'px-2 justify-center' : 'px-3.5 justify-between'} py-2.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all text-xs cursor-pointer ${isActive ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 shrink-0" />
                            {!isSidebarCollapsed && <span className="truncate">{nav.label}</span>}
                          </div>
                          {unreadCount > 0 && <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${isActive ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'}`}>{unreadCount}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-6">
          {syncStatus && (
            <div role="status" className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 border ${syncStatus.success ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{syncStatus.message}</span>
              </div>
              <button type="button" onClick={() => setSyncStatus(null)} className="p-1 rounded-lg hover:bg-white/10 min-h-10 min-w-10 inline-flex items-center justify-center cursor-pointer text-slate-300 hover:text-white" aria-label="إغلاق الإشعار"><X className="w-4 h-4" /></button>
            </div>
          )}

          {!isTabAuthorized(activeTab) ? (
            unauthorizedView
          ) : vehiclePage ?? (
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="space-y-6">
                {isAdmin && activeTab === 'overview' && <AdminOverview vehicles={vehicles} bookings={bookings} onNavigateTab={handleTabChange} />}
                {activeTab === 'bookings' && <AdminBookings bookings={bookings} vehicles={vehicles} onRefreshData={() => { onRefreshData(); loadAuxData(); }} externalSearch={commandPaletteSearch} />}
                {activeTab === 'vehicles' && <AdminVehicles vehicles={vehicles} bookings={bookings} onRefreshData={() => { onRefreshData(); loadAuxData(); }} onOpenAddVehicle={() => openVehicleForm(null)} onOpenEditVehicle={(v) => openVehicleForm(v)} onDeleteVehicle={(v) => { setDeleteError(null); setVehicleToDelete(v); }} />}
                {isAdmin && activeTab === 'reports' && <React.Suspense fallback={<SkeletonLoader type="card" lines={3} />}><AdminReports vehicles={vehicles} bookings={bookings} /></React.Suspense>}
                {isAdmin && activeTab === 'settings' && <React.Suspense fallback={<SkeletonLoader type="card" lines={3} />}><AdminSettings settings={settings} vehicles={vehicles} onSettingsUpdated={onRefreshData} /></React.Suspense>}
                {activeTab === 'notifications' && <AdminNotifications notifications={notifications} onRefresh={loadAuxData} />}
                {isSuperAdmin && activeTab === 'staff' && <React.Suspense fallback={<SkeletonLoader type="table" lines={5} />}><AdminStaffRoles /></React.Suspense>}
                {(isAdmin || isSuperAdmin) && activeTab === 'firestore_users' && <React.Suspense fallback={<SkeletonLoader type="table" lines={5} />}><AdminUsersFilesView /></React.Suspense>}
                {isSuperAdmin && activeTab === 'activity_log' && <React.Suspense fallback={<SkeletonLoader type="table" lines={5} />}><AdminActivityLog /></React.Suspense>}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-slate-900 border-t border-slate-800 p-2 shadow-2xl backdrop-blur-md" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around">
          {primaryMobileTabs.map((nav) => {
            const Icon = nav.icon;
            const isActive = activeTab === nav.id;
            return (
              <button key={nav.id} type="button" onClick={() => handleTabChange(nav.id)} className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${isActive ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-white'}`}>
                <Icon className="w-5 h-5" />
                <span>{nav.label}</span>
              </button>
            );
          })}
          <button
            ref={mobileMoreBtnRef}
            type="button"
            onClick={() => setShowMobileMore(true)}
            aria-haspopup="dialog"
            aria-expanded={showMobileMore}
            aria-label="عرض المزيد من الأقسام"
            className="flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>المزيد</span>
          </button>
        </div>
      </div>

      {showMobileMore && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          {/* Backdrop button */}
          <button
            type="button"
            aria-label="إغلاق قائمة المزيد"
            tabIndex={-1}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-default w-full h-full border-none"
            onClick={() => {
              setShowMobileMore(false);
              mobileMoreBtnRef.current?.focus();
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="كافة الأقسام والخدمات"
            className="relative z-10 bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-contain pb-safe"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white">كافة الأقسام والخدمات</h3>
              <button
                type="button"
                onClick={() => {
                  setShowMobileMore(false);
                  mobileMoreBtnRef.current?.focus();
                }}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                aria-label="إغلاق القائمة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2" role="menu">
              {ADMIN_NAV_ITEMS.filter((item) => isTabAuthorized(item.id)).map((nav) => {
                const Icon = nav.icon;
                const isActive = activeTab === nav.id;
                return (
                  <button
                    key={nav.id}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      handleTabChange(nav.id);
                      setShowMobileMore(false);
                      mobileMoreBtnRef.current?.focus();
                    }}
                    className={`p-3 rounded-2xl border text-right text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-extrabold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{nav.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={Boolean(vehicleToDelete)} 
        title="حذف السيارة" 
        message={
          vehicleToDelete
            ? `هل أنت متأكد من حذف السيارة "${vehicleToDelete.brand} ${vehicleToDelete.model} (${vehicleToDelete.year})"${
                vehicleDeleteActiveBookings.length > 0
                  ? `؟\n\n⚠️ تحذير: هذه السيارة مرتبطة بـ (${vehicleDeleteActiveBookings.length}) حجوزات نشطة أو قادمة: [${vehicleDeleteActiveBookings.map((b) => b.bookingNumber || b.id).join('، ')}]. لن يسمح النظام بحذفها قبل إلغاء أو إنهاء هذه الحجوزات.`
                  : '؟'
              }${deleteError ? `\n\n❌ تعذر الحذف: ${deleteError}` : ''}`
            : ''
        } 
        confirmLabel="تأكيد الحذف" 
        cancelLabel="إلغاء" 
        type="danger" 
        isLoading={isDeletingVehicle} 
        onConfirm={confirmDeleteVehicle} 
        onCancel={() => { setVehicleToDelete(null); setDeleteError(null); }} 
      />
    </div>
  );
};
