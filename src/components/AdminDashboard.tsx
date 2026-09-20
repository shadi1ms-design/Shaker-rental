import React, { useState, useEffect } from 'react';
import {
  Vehicle,
  Booking,
  Customer,
  MaintenanceRecord,
  AppSettings,
  Payment,
  AppNotification,
} from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';

// Existing Admin Views
import { AdminReports } from './AdminReports';
import { AdminSettings } from './AdminSettings';
import { AdminUsersFilesView } from './AdminUsersFilesView';
import { AdminStaffRoles } from './admin/AdminStaffRoles';
import { AdminActivityLog } from './admin/AdminActivityLog';

// Modular Sub-components for Admin
import { AdminOverview } from './admin/AdminOverview';
import { AdminBookings } from './admin/AdminBookings';
import { AdminVehicles } from './admin/AdminVehicles';
import { AdminNotifications } from './admin/AdminNotifications';

// Modals
import { VehicleFormModal } from './VehicleFormModal';
import { ContractModal } from './ContractModal';
import { InspectionModal } from './InspectionModal';
import { PaymentModal } from './PaymentModal';
import { UserProfileModal } from './UserProfileModal';

// Icons
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
  Mail
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

  // Active Admin Tab - Respect initialTab if authorized, fallback to overview or bookings
  const [activeTab, setActiveTab] = useState<AdminTabType>(() => {
    if (initialTab && isTabAuthorized(initialTab)) {
      return initialTab;
    }
    return isAdmin ? 'overview' : 'bookings';
  });

  // Ensure activeTab conforms to user's permissions
  useEffect(() => {
    if (initialTab && isTabAuthorized(initialTab)) {
      setActiveTab(initialTab);
    } else if (!isTabAuthorized(activeTab)) {
      setActiveTab(isAdmin ? 'overview' : 'bookings');
    }
  }, [initialTab, isAdmin, isSuperAdmin]);

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
      window.history.replaceState(null, '', pathMap[tab]);
    }
  };

  // Modals state
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null | undefined>(undefined); // undefined = closed, null = new
  const [contractBooking, setContractBooking] = useState<Booking | null>(null);
  const [inspectionVehicle, setInspectionVehicle] = useState<Vehicle | null>(null);
  const [inspectionBookingId, setInspectionBookingId] = useState<string>('');
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<Booking | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [isDeletingVehicle, setIsDeletingVehicle] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Aux Data State - Instant cached bootstrap
  const [customers, setCustomers] = useState<Customer[]>(() => dataService.getCachedCustomers());
  const [payments, setPayments] = useState<Payment[]>(() => dataService.getCachedPayments());
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>(() => dataService.getCachedMaintenanceRecords());
  const [notifications, setNotifications] = useState<AppNotification[]>(() => dataService.getNotifications());

  // Vehicles needing oil change computed reactively in 0ms without network roundtrip
  const vehiclesNeedingOil = React.useMemo(() => {
    return dataService.calculateVehiclesNeedingOil(vehicles, settings.oilChangeIntervalKm || 5000);
  }, [vehicles, settings.oilChangeIntervalKm]);

  // Cloud Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ message: string; success: boolean } | null>(null);

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
      const [custs, pmts] = await Promise.all([
        dataService.getCustomers(true),
        dataService.getPayments(),
      ]);
      setCustomers(custs || []);
      setPayments(pmts || []);

      if (isAdmin) {
        const [maints, notifs] = await Promise.all([
          dataService.getMaintenanceRecords(),
          dataService.getNotifications(),
        ]);
        setMaintenanceRecords(maints || []);
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
      {/* Sticky Top Header & Tabs Bar Container */}
      <div className="sticky top-0 z-30 shadow-md">
        {/* Top Admin Header Bar */}
        <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
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
            <button
              type="button"
              onClick={() => setShowMyProfile(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 transition-all text-xs font-bold flex items-center gap-1.5 shadow-sm"
              title="حسابي الشخصي وحجوزاتي"
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>حسابي الشخصي</span>
            </button>

            <button
              onClick={onBackToSite}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
              title="عرض الموقع"
              aria-label="عرض الموقع"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Admin Tabs Navigation Bar */}
        <nav className="bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 sm:px-8 py-1 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-2 py-3 min-w-max">
            {[
              { id: 'bookings', label: `الحجوزات والتأجير (${bookings.length})`, icon: Calendar },
              { id: 'vehicles', label: `أسطول السيارات (${vehicles.length})`, icon: Car },
              { id: 'firestore_users', label: 'المستخدمون والملفات (Firestore)', icon: FolderOpen },
              { id: 'staff', label: 'إدارة الموظفين والصلاحيات', icon: UserCheck },
              { id: 'activity_log', label: 'سجل النشاطات', icon: Activity },
              { id: 'overview', label: 'المؤشرات العامة', icon: LayoutDashboard },
              { id: 'reports', label: 'التقارير المالية والتشغيلية', icon: BarChart3 },
              { id: 'settings', label: 'إعدادات النظام والأسعار', icon: Settings },
              { id: 'notifications', label: `التنبيهات (${notifications.length})`, icon: Bell },
            ]
              .filter((tab) => isTabAuthorized(tab.id as AdminTabType))
              .map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as AdminTabType)}
                    className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shrink-0 ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 text-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60 text-xs'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            {/* Safety end spacing for smooth horizontal scrolling on mobile */}
            <div className="w-2 shrink-0" />
          </div>
        </nav>
      </div>

      {/* Main Admin Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-8">
        {/* UNAUTHORIZED ACCESS GUARD FALLBACK */}
        {!isTabAuthorized(activeTab) && (
          <div className="bg-slate-900/90 border border-rose-500/30 rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto my-12 space-y-5 shadow-2xl backdrop-blur-sm">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">غير مصرح لك بالوصول لهذا القسم</h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {activeTab === 'settings' || activeTab === 'reports'
                  ? 'يتطلب الوصول إلى هذا القسم صلاحيات إدارة عليا (مدير نظام / Admin). دور حسابك الحالي لا يمتلك الإذن الكافي.'
                  : 'يتطلب الوصول إلى هذا القسم صلاحيات المدير العام للمنظومة (Super Admin).'}
              </p>
            </div>
            <button
              onClick={() => handleTabChange(isAdmin ? 'overview' : 'bookings')}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 inline-flex items-center gap-2"
            >
              <span>{isAdmin ? 'العودة إلى لوحة المؤشرات العامة' : 'العودة إلى إدارة الحجوزات'}</span>
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <AdminOverview
            vehicles={vehicles}
            bookings={bookings}
            onNavigateTab={handleTabChange}
            onOpenAddVehicle={() => setEditingVehicle(null)}
            onSyncAll={handleSyncAllWithFirestore}
            isSyncing={isSyncing}
          />
        )}

        {/* TAB 2: BOOKINGS & RENTALS */}
        {activeTab === 'bookings' && (
          <AdminBookings
            bookings={bookings}
            vehicles={vehicles}
            onRefreshData={() => {
              onRefreshData();
              loadAuxData();
            }}
            onOpenContract={(b) => setContractBooking(b)}
            onOpenInspection={(v, bookingId) => {
              setInspectionVehicle(v);
              setInspectionBookingId(bookingId);
            }}
            onOpenPayment={(b) => setSelectedBookingForPayment(b)}
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

        {/* TAB 3: FLEET VEHICLES */}
        {activeTab === 'vehicles' && (
          <AdminVehicles
            vehicles={vehicles}
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

        {/* TAB 4: REPORTS (Admin Only) */}
        {isAdmin && activeTab === 'reports' && (
          <AdminReports
            vehicles={vehicles}
            bookings={bookings}
            payments={payments}
            maintenanceRecords={maintenanceRecords}
          />
        )}

        {/* TAB 5: SETTINGS (Admin Only) */}
        {isAdmin && activeTab === 'settings' && (
          <AdminSettings
            settings={settings}
            vehicles={vehicles}
            onSettingsUpdated={onRefreshData}
          />
        )}

        {/* TAB 6: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <AdminNotifications
            notifications={notifications}
          />
        )}

        {/* TAB 7: STAFF ROLES & PERMISSIONS (Super Admin Only) */}
        {isSuperAdmin && activeTab === 'staff' && (
          <AdminStaffRoles onBackToOverview={() => handleTabChange('overview')} />
        )}

        {/* TAB 8: FIRESTORE USERS & FILES (Super Admin Only) */}
        {isSuperAdmin && activeTab === 'firestore_users' && (
          <AdminUsersFilesView onBackToOverview={() => handleTabChange('overview')} />
        )}

        {/* TAB 9: ACTIVITY & AUDIT LOG (Super Admin Only) */}
        {isSuperAdmin && activeTab === 'activity_log' && (
          <AdminActivityLog onBackToOverview={() => handleTabChange('overview')} />
        )}
      </main>

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

      {/* 2. Official Printable Contract */}
      {contractBooking && (
        <ContractModal
          booking={contractBooking}
          vehicle={
            vehicles.find((v) => v.id === contractBooking.vehicleId) ||
            vehicles?.[0] || {
              id: contractBooking.vehicleId,
              brand: 'شاكر',
              model: contractBooking.vehicleName || 'سيارة سياحية',
              year: 2024,
              color: 'أبيض',
              category: contractBooking.vehicleCategory || 'medium',
              seats: 5,
              transmission: 'automatic',
              fuelType: 'petrol',
              dailyPrice: contractBooking.dailyPrice,
              plateNumber: 'دمشق',
              currentMileage: 50000,
              lastOilChangeMileage: 50000,
              status: 'rented',
              imageUrl: '',
              features: [],
              description: '',
            }
          }
          settings={settings}
          onClose={() => setContractBooking(null)}
        />
      )}

      {/* 3. Inspection Modal */}
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

      {/* 3.5. Payment Modal for Booking */}
      {selectedBookingForPayment && (
        <PaymentModal
          booking={selectedBookingForPayment}
          onClose={() => setSelectedBookingForPayment(null)}
          onPaymentRecorded={() => {
            onRefreshData();
            loadAuxData();
            setSelectedBookingForPayment(null);
          }}
        />
      )}

      {/* 4. Vehicle Deletion Confirmation Modal with Feedback */}
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
    </div>
  );
};
