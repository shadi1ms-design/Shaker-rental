import React, { useState, useEffect } from 'react';
import {
  Vehicle,
  Booking,
  Customer,
  MaintenanceRecord,
  AppSettings,
  BookingStatus,
  VehicleStatus,
  Payment,
  AppNotification
} from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { openWhatsAppChat } from '../services/whatsapp';
import { AdminCalendar } from './AdminCalendar';
import { AdminCustomers } from './AdminCustomers';
import { AdminReports } from './AdminReports';
import { AdminSettings } from './AdminSettings';
import { VehicleFormModal } from './VehicleFormModal';
import { ContractModal } from './ContractModal';
import { InspectionModal } from './InspectionModal';
import { MaintenanceModal } from './MaintenanceModal';
import { PaymentModal } from './PaymentModal';
import { AdminUsersFilesView } from './AdminUsersFilesView';
import { ADMIN_USER_ID } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Car,
  Calendar,
  Users,
  BarChart3,
  Settings,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ClipboardCheck,
  Wrench,
  ChevronRight,
  Filter,
  Eye,
  CreditCard,
  Droplet,
  Trash2,
  Edit3,
  FolderOpen,
  Shield,
  FileText,
  DollarSign,
  Bell
} from 'lucide-react';

export type AdminTabType =
  | 'firestore_users'
  | 'overview'
  | 'vehicles'
  | 'bookings'
  | 'calendar'
  | 'customers'
  | 'contracts'
  | 'payments'
  | 'maintenance'
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
  const { user, isSuperAdmin, isAdmin } = useAuth();

  const isDesignatedAdmin = user?.uid === ADMIN_USER_ID || user?.email === 'shadi1ms@gmail.com';

  // Active Admin Sub-tab (default to firestore_users for the designated admin user)
  const [activeTab, setActiveTab] = useState<AdminTabType>(
    initialTab || (isDesignatedAdmin ? 'firestore_users' : 'overview')
  );

  const handleTabChange = (tab: AdminTabType) => {
    setActiveTab(tab);
    const pathMap: Record<AdminTabType, string> = {
      overview: '/admin/dashboard',
      vehicles: '/admin/vehicles',
      bookings: '/admin/bookings',
      calendar: '/admin/bookings',
      customers: '/admin/customers',
      contracts: '/admin/contracts',
      payments: '/admin/payments',
      maintenance: '/admin/maintenance',
      reports: '/admin/reports',
      settings: '/admin/settings',
      notifications: '/admin/notifications',
      firestore_users: '/admin/users',
    };
    if (window.location.pathname.startsWith('/admin')) {
      window.history.replaceState(null, '', pathMap[tab]);
    }
  };

  // Modals state
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null | undefined>(undefined); // undefined = closed, null = new
  const [contractBooking, setContractBooking] = useState<Booking | null>(null);
  const [inspectionVehicle, setInspectionVehicle] = useState<Vehicle | null>(null);
  const [inspectionBookingId, setInspectionBookingId] = useState<string>('');
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);

  // Filter states for Bookings tab
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>('all');
  const [bookingSearch, setBookingSearch] = useState<string>('');

  // Maintenance records & customers loaded
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [vehiclesNeedingOil, setVehiclesNeedingOil] = useState<Array<{ vehicle: Vehicle; kmSinceOil: number; isUrgent: boolean }>>([]);

  useEffect(() => {
    loadAuxData();
  }, []);

  const loadAuxData = async () => {
    const [custs, maints, oilNeeds, pmts, notifs] = await Promise.all([
      dataService.getCustomers(),
      dataService.getMaintenanceRecords(),
      dataService.getVehiclesNeedingMaintenance(),
      dataService.getPayments(),
      dataService.getNotifications(),
    ]);
    setCustomers(custs);
    setMaintenanceRecords(maints);
    setVehiclesNeedingOil(oilNeeds);
    setPayments(pmts);
    setNotifications(notifs);
  };

  // KPIs
  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter((v) => v.status === 'available').length;
  const rentedVehicles = vehicles.filter((v) => v.status === 'rented').length;
  const inMaintenance = vehicles.filter((v) => v.status === 'maintenance').length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter((b) => b.createdAt.startsWith(todayStr)).length;
  const activeRentals = bookings.filter((b) => b.status === 'rented').length;

  const monthlyRevenue = bookings.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  const outstandingBalance = bookings.reduce((acc, b) => acc + (b.remainingAmount ?? (b.totalPrice - (b.paidAmount || 0))), 0);

  // Status badge helper
  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'new':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">طلب جديد</span>;
      case 'reviewing':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">قيد المراجعة</span>;
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">مؤكد</span>;
      case 'rented':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">جاري التأجير</span>;
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300">مكتمل ومستلم</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300">ملغي</span>;
      case 'rejected':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-900/40 text-rose-400">مرفوض</span>;
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    try {
      await dataService.updateBookingStatus(bookingId, status);
      onRefreshData();
      loadAuxData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه السيارة من الأسطول النشط؟')) return;
    try {
      await dataService.deleteVehicle(id);
      onRefreshData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Admin Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">
                لوحة إدارة شاكر لتأجير السيارات
              </h2>
              {/* Mandatory Admin Badge Indicator */}
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm uppercase tracking-wide">
                <Shield className="w-3 h-3" />
                Admin
              </span>
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>المشرف: {user?.displayName}</span>
              <span>•</span>
              <span className="font-mono text-amber-300/90 text-[10px]">
                UID: {user?.uid || ADMIN_USER_ID}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMaintenanceModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>تسجيل صيانة/زيت</span>
          </button>

          <button
            onClick={() => setEditingVehicle(null)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة سيارة</span>
          </button>

          <button
            onClick={onBackToSite}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold"
          >
            عرض الموقع
          </button>
        </div>
      </div>

      {/* Admin Tabs Navigation */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-4 sm:px-8 overflow-x-auto">
        <div className="flex items-center gap-2 py-2 min-w-max">
          {[
            { id: 'firestore_users', label: 'المستخدمون والملفات (Firestore)', icon: FolderOpen, highlight: true },
            { id: 'overview', label: 'المؤشرات العامة', icon: LayoutDashboard },
            { id: 'bookings', label: `الحجوزات والتأجير (${bookings.length})`, icon: Calendar },
            { id: 'vehicles', label: `أسطول السيارات (${vehicles.length})`, icon: Car },
            { id: 'calendar', label: 'التقويم التفاعلي', icon: Clock },
            { id: 'customers', label: `سجل العملاء CRM (${customers.length})`, icon: Users },
            { id: 'contracts', label: `العقود الرسمية`, icon: FileText },
            { id: 'payments', label: `سندات القبض (${payments.length})`, icon: DollarSign },
            { id: 'maintenance', label: `الصيانة وغيار الزيت (${maintenanceRecords.length})`, icon: Wrench },
            { id: 'reports', label: 'التقارير المالية والتشغيلية', icon: BarChart3 },
            { id: 'settings', label: 'إعدادات النظام والأسعار', icon: Settings },
            { id: 'notifications', label: `التنبيهات (${notifications.length})`, icon: Bell },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : (tab as any).highlight
                    ? 'text-amber-300 hover:text-white hover:bg-slate-800/80 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Admin Content Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-8">
        {/* TAB 0: FIRESTORE USERS & FILES (Mandated Admin View) */}
        {activeTab === 'firestore_users' && (
          <AdminUsersFilesView onBackToOverview={() => setActiveTab('overview')} />
        )}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Top Greeting mandated by Prompt Section 16 */}
            <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
                مرحباً بك في نظام شاكر لتأجير السيارات
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                نظام الإدارة الشامل والذكي لمتابعة الحجوزات الإلكترونية، حركة الأسطول، العقود الرسمية المطبوعة، وتنبيهات غيار الزيت الدورية كل 5000 كم في دمشق وجرمانا.
              </p>
            </div>

            {/* 6 Metric Cards mandated by Section 16 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[11px] text-slate-400 block">إجمالي الأسطول</span>
                <span className="text-2xl font-black text-white font-mono">{totalVehicles}</span>
                <span className="text-[10px] text-emerald-400 block">متاح: {availableVehicles}</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[11px] text-slate-400 block">حجوزات اليوم</span>
                <span className="text-2xl font-black text-amber-400 font-mono">{todayBookings}</span>
                <span className="text-[10px] text-slate-400 block">إجمالي: {bookings.length}</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[11px] text-slate-400 block">تأجيرات نشطة</span>
                <span className="text-2xl font-black text-blue-400 font-mono">{activeRentals}</span>
                <span className="text-[10px] text-slate-400 block">في حوزة العملاء</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[11px] text-slate-400 block">المقبوضات المحصلة</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">${monthlyRevenue}</span>
                <span className="text-[10px] text-slate-400 block">مدفوعات نقدية</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[11px] text-slate-400 block">المتبقي بذمة العملاء</span>
                <span className="text-2xl font-black text-rose-400 font-mono">${outstandingBalance}</span>
                <span className="text-[10px] text-rose-400 block">تحصيل عند التسليم</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
                <span className="text-[11px] text-slate-400 block">تنبيهات الزيت والصيانة</span>
                <span className="text-2xl font-black text-amber-400 font-mono">{vehiclesNeedingOil.length}</span>
                <span className="text-[10px] text-amber-300 block">تحتاج غيار زيت</span>
              </div>
            </div>

            {/* Widgets Section: Upcoming Bookings & Maintenance Overdue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upcoming & Recent Bookings Widget */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-400" />
                    أحدث طلبات الحجز المستلمة
                  </h3>
                  <button
                    onClick={() => setActiveTab('bookings')}
                    className="text-xs text-amber-400 hover:underline"
                  >
                    عرض الكل ←
                  </button>
                </div>

                <div className="space-y-3">
                  {bookings.slice(0, 4).map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">{b.bookingNumber}</span>
                          <span className="font-bold text-white">{b.customerName}</span>
                        </div>
                        <p className="text-slate-400 mt-1">
                          {b.vehicleName} • من {b.pickupDate} إلى {b.returnDate} ({b.rentalDays} أيام)
                        </p>
                      </div>

                      <div className="text-left flex flex-col items-end gap-1">
                        <span className="font-mono font-bold text-white">${b.totalPrice}</span>
                        {getStatusBadge(b.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Oil Change & Maintenance Reminders Widget (Section 15) */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-amber-400" />
                    تنبيهات صيانة وتبديل الزيت (قاعدة 5,000 كم)
                  </h3>
                  <button
                    onClick={() => setShowMaintenanceModal(true)}
                    className="text-xs text-amber-400 hover:underline"
                  >
                    تسجيل غيار جديد +
                  </button>
                </div>

                {vehiclesNeedingOil.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-950 rounded-2xl">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    كافة سيارات الأسطول ضمن المسافة المسموحة لتغيير الزيت (أقل من 5000 كم).
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vehiclesNeedingOil.map((item) => (
                      <div
                        key={item.vehicle.id}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                          item.isUrgent
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        <div>
                          <span className="font-bold block text-white">
                            {item.vehicle.brand} {item.vehicle.model} ({item.vehicle.plateNumber})
                          </span>
                          <span className="text-[11px] opacity-80">
                            المقطوع منذ آخر غيار: {item.kmSinceOil.toLocaleString()} كم (
                            {item.isUrgent ? 'تجاوزت الحد المسموح!' : 'اقتربت من 5000 كم'})
                          </span>
                        </div>

                        <button
                          onClick={() => setShowMaintenanceModal(true)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400"
                        >
                          تسجيل غيار
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BOOKINGS & RENTALS MANAGEMENT */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            {/* Filter & Search Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'new', label: 'طلبات جديدة' },
                  { id: 'confirmed', label: 'مؤكدة' },
                  { id: 'rented', label: 'جاري التأجير' },
                  { id: 'completed', label: 'مكتملة' },
                  { id: 'cancelled', label: 'ملغاة' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setBookingFilterStatus(st.id)}
                    className={`px-3 py-2 rounded-xl font-bold transition-all ${
                      bookingFilterStatus === st.id
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="بحث برقم الحجز أو العميل أو الهاتف..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 pl-9 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Bookings List Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                      <th className="p-3.5">رقم الحجز</th>
                      <th className="p-3.5">المستأجر</th>
                      <th className="p-3.5">السيارة</th>
                      <th className="p-3.5">فترة الإيجار</th>
                      <th className="p-3.5">الإجمالي</th>
                      <th className="p-3.5">المتبقي</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5 text-center">الإجراءات والعمليات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {bookings
                      .filter((b) => {
                        if (bookingFilterStatus !== 'all' && b.status !== bookingFilterStatus) return false;
                        if (bookingSearch.trim()) {
                          const q = bookingSearch.toLowerCase();
                          return (
                            b.bookingNumber.toLowerCase().includes(q) ||
                            b.customerName.toLowerCase().includes(q) ||
                            b.customerPhone.includes(q) ||
                            b.vehicleName.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      })
                      .map((b) => {
                        const targetVehicle = vehicles.find((v) => v.id === b.vehicleId) || vehicles?.[0] || null;
                        return (
                          <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-mono font-black text-amber-400">
                              {b.bookingNumber}
                            </td>

                            <td className="p-3.5">
                              <div className="font-bold text-white">{b.customerName}</div>
                              <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{b.customerPhone}</div>
                            </td>

                            <td className="p-3.5 text-slate-300 font-medium">
                              {b.vehicleName}
                            </td>

                            <td className="p-3.5 text-slate-400">
                              <div>من: {b.pickupDate}</div>
                              <div>إلى: {b.returnDate} ({b.rentalDays} أيام)</div>
                            </td>

                            <td className="p-3.5 font-bold font-mono text-white text-sm">
                              ${b.totalPrice}
                            </td>

                            <td className="p-3.5 font-mono">
                              <span className={b.remainingAmount ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                                ${b.remainingAmount ?? (b.totalPrice - (b.paidAmount || 0))}
                              </span>
                            </td>

                            <td className="p-3.5">
                              {getStatusBadge(b.status)}
                            </td>

                            <td className="p-3.5">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {/* Contract Print */}
                                <button
                                  onClick={() => setContractBooking(b)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400"
                                  title="طباعة عقد الإيجار الرسمي A4"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>

                                {/* Inspection Sheet */}
                                <button
                                  onClick={() => {
                                    setInspectionVehicle(targetVehicle);
                                    setInspectionBookingId(b.id);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400"
                                  title="نموذج فحص وتسليم السيارة"
                                >
                                  <ClipboardCheck className="w-4 h-4" />
                                </button>

                                {/* Payment */}
                                <button
                                  onClick={() => setPaymentBooking(b)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400"
                                  title="تسجيل دفعة مالية"
                                >
                                  <DollarSign className="w-4 h-4" />
                                </button>

                                {/* Status Workflow Actions */}
                                {b.status === 'new' && (
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                                  >
                                    تأكيد
                                  </button>
                                )}

                                {b.status === 'confirmed' && (
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b.id, 'rented')}
                                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]"
                                  >
                                    تسليم السيارة
                                  </button>
                                )}

                                {b.status === 'rented' && (
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b.id, 'completed')}
                                    className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-emerald-400 font-bold text-[11px]"
                                  >
                                    استلام وإتمام
                                  </button>
                                )}

                                <button
                                  onClick={() => openWhatsAppChat(b)}
                                  className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white"
                                  title="مراسلة العميل واتساب"
                                >
                                  💬
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VEHICLES FLEET MANAGEMENT */}
        {activeTab === 'vehicles' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Car className="w-5 h-5 text-amber-400" />
                  أسطول سيارات شاكر
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  إدارة سيارات الأسطول، تعديل الأسعار، ومتابعة العدادات وحالات الصيانة
                </p>
              </div>

              <button
                onClick={() => setEditingVehicle(null)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة سيارة جديدة</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map((v) => {
                const kmSinceOil = (v.currentMileage || 0) - (v.lastOilChangeMileage || 0);
                const isOverdue = kmSinceOil >= 5000;

                return (
                  <div
                    key={v.id}
                    className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col justify-between shadow-lg"
                  >
                    <div>
                      <div className="relative h-44 bg-slate-950">
                        <img
                          src={v.imageUrl}
                          alt={v.model}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[11px] font-bold text-amber-400 border border-amber-500/30">
                          {v.category === 'light' ? 'اقتصادي' : v.category === 'medium' ? 'متوسط' : 'جيب 7 مقاعد'}
                        </div>
                        <div className="absolute top-3 left-3">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            v.status === 'available' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-blue-500/30 text-blue-300'
                          }`}>
                            {v.status === 'available' ? 'متاحة' : v.status === 'rented' ? 'مؤجرة' : 'صيانة'}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs text-slate-400">{v.brand}</span>
                            <h4 className="font-bold text-white text-base">{v.model} ({v.year})</h4>
                            <span className="text-xs text-slate-400 block font-mono">{v.plateNumber}</span>
                          </div>
                          <div className="text-left">
                            <span className="text-xl font-black text-amber-400">${v.dailyPrice}</span>
                            <span className="text-[10px] text-slate-400 block">/ يوم</span>
                          </div>
                        </div>

                        {/* Mileage and Oil Stats */}
                        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1">
                          <div className="flex justify-between text-slate-400">
                            <span>العداد الحالي:</span>
                            <span className="text-white font-mono">{v.currentMileage.toLocaleString()} كم</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>المقطوع من آخر زيت:</span>
                            <span className={`font-mono font-bold ${isOverdue ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {kmSinceOil.toLocaleString()} كم {isOverdue && '(تحتاج زيت!)'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setInspectionVehicle(v);
                          setInspectionBookingId('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-bold"
                        title="فحص الهيكل والتسليم"
                      >
                        فحص
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingVehicle(v)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
                          title="تعديل السيارة"
                        >
                          <Edit3 className="w-4 h-4 text-amber-400" />
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteVehicle(v.id)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                            title="حذف السيارة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: CALENDAR */}
        {activeTab === 'calendar' && (
          <AdminCalendar
            vehicles={vehicles}
            bookings={bookings}
            maintenanceRecords={maintenanceRecords}
            onSelectBooking={(b) => setContractBooking(b)}
          />
        )}

        {/* TAB 5: CUSTOMER CRM */}
        {activeTab === 'customers' && (
          <AdminCustomers customers={customers} bookings={bookings} />
        )}

        {/* TAB: CONTRACTS */}
        {activeTab === 'contracts' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-white">العقود الرسمية لتأجير السيارات</h3>
                <p className="text-xs text-slate-400 mt-1">
                  إدارة وطباعة العقود المعتمدة قانونياً لشركة شاكر لتأجير السيارات المتضمنة كافة الشروط والبيانات
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="divide-y divide-slate-800/60">
                {bookings.map((b) => {
                  const veh = vehicles.find((v) => v.id === b.vehicleId);
                  return (
                    <div key={b.id} className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400">{b.bookingNumber}</span>
                          <span className="text-sm font-black text-white">{b.customerName}</span>
                          {getStatusBadge(b.status)}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3">
                          <span>المركبة: {b.vehicleName}</span>
                          <span>•</span>
                          <span>الفترة: من {b.pickupDate} إلى {b.returnDate} ({b.rentalDays} يوم)</span>
                          <span>•</span>
                          <span className="font-mono font-bold text-slate-300">القيمة: ${b.totalPrice}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setContractBooking(b)}
                          className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950 font-bold text-xs flex items-center gap-2 border border-amber-500/30 transition-all shadow-sm"
                        >
                          <FileText className="w-4 h-4" />
                          <span>عرض وطباعة العقد</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: PAYMENTS */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">سندات القبض والدفعات المالية</h3>
                <p className="text-xs text-slate-400 mt-1">
                  سجل الدفعات والمقبوضات النقدية والتحويلات الخاصة بعقود التأجير
                </p>
              </div>
              <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-2xl">
                <div>
                  <span className="text-[10px] text-slate-400 block">إجمالي المقبوضات</span>
                  <span className="text-base font-black text-emerald-400 font-mono">${monthlyRevenue}</span>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <span className="text-[10px] text-slate-400 block">المتبقي للتحصيل</span>
                  <span className="text-base font-black text-rose-400 font-mono">${outstandingBalance}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              {payments.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  لا توجد سندات قبض مسجلة حالياً
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {payments.map((p) => (
                    <div key={p.id} className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-400">${p.amount}</span>
                          <span className="text-xs font-bold text-slate-300">سند رقم: {p.receiptNumber}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                            {p.method === 'cash' ? 'نقدي' : p.method === 'transfer' ? 'حوالة' : 'بطاقة'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          <span>العميل: {p.customerName}</span>
                          <span className="mx-2">•</span>
                          <span>التاريخ: {new Date(p.date).toLocaleDateString('ar-SY')}</span>
                          {p.notes && <span className="mx-2">• {p.notes}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: MAINTENANCE */}
        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">إدارة الصيانة وغيار الزيت الدوري</h3>
                <p className="text-xs text-slate-400 mt-1">
                  متابعة فترات غيار الزيت كل 5000 كم والصيانة الوقائية لأسطول سيارات شاكر
                </p>
              </div>
              <button
                onClick={() => setShowMaintenanceModal(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-all"
              >
                <Wrench className="w-4 h-4" />
                <span>تسجيل صيانة أو غيار زيت جديد</span>
              </button>
            </div>

            {/* Oil change alert warning */}
            {vehiclesNeedingOil.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2">
                  <Droplet className="w-4 h-4" />
                  <span>تنبيهات غيار الزيت النشطة ({vehiclesNeedingOil.length})</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vehiclesNeedingOil.map(({ vehicle, kmSinceOil, isUrgent }) => (
                    <div
                      key={vehicle.id}
                      className={`p-4 rounded-2xl border ${
                        isUrgent
                          ? 'bg-rose-500/10 border-rose-500/30'
                          : 'bg-amber-500/10 border-amber-500/30'
                      } space-y-2`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">
                          {vehicle.brand} {vehicle.model}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isUrgent ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {isUrgent ? 'عاجل جداً' : 'مستحق'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 flex justify-between font-mono">
                        <span>قاطع منذ آخر غيار:</span>
                        <span className="font-bold">{kmSinceOil} كم</span>
                      </div>
                      <div className="text-xs text-slate-400 flex justify-between font-mono">
                        <span>العداد الحالي:</span>
                        <span>{vehicle.currentMileage} كم</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Maintenance records table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-slate-800">
                <h4 className="text-xs font-bold text-white">سجل العمليات السابقة</h4>
              </div>
              <div className="divide-y divide-slate-800/60">
                {maintenanceRecords.map((m) => (
                  <div key={m.id} className="p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{m.vehicleName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-400">
                          {m.type === 'oil_change' ? 'غيار زيت وفلتر' : m.type === 'periodic' ? 'صيانة دورية' : 'إصلاح عطل'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-3">
                        <span>العداد: {m.mileageAtService} كم</span>
                        <span>•</span>
                        <span>التاريخ: {m.date}</span>
                        {m.technician && <span>• الفني: {m.technician}</span>}
                        <span>• التكلفة: ${m.cost}</span>
                      </div>
                      {m.description && <p className="text-xs text-slate-300 mt-1">{m.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: REPORTS */}
        {activeTab === 'reports' && (
          <AdminReports
            vehicles={vehicles}
            bookings={bookings}
            payments={payments}
            maintenanceRecords={maintenanceRecords}
          />
        )}

        {/* TAB 7: SETTINGS */}
        {activeTab === 'settings' && (
          <AdminSettings settings={settings} onSettingsUpdated={onRefreshData} />
        )}

        {/* TAB: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
              <h3 className="text-xl font-black text-white">مركز التنبيهات والإشعارات</h3>
              <p className="text-xs text-slate-400 mt-1">
                سجل إشعارات الحجوزات الجديدة، تحديثات الحالات، وتنبيهات الصيانة
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              {notifications.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  لا توجد تنبيهات حالياً
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-5 flex items-start gap-4 hover:bg-slate-800/30 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white">{n.title}</h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(n.createdAt).toLocaleTimeString('ar-SY')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {/* 1. Vehicle Add/Edit */}
      {editingVehicle !== undefined && (
        <VehicleFormModal
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(undefined)}
          onSaved={() => {
            onRefreshData();
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
          onSaved={() => onRefreshData()}
        />
      )}

      {/* 4. Maintenance / Oil Modal */}
      {showMaintenanceModal && (
        <MaintenanceModal
          vehicles={vehicles}
          onClose={() => setShowMaintenanceModal(false)}
          onRecordAdded={() => {
            onRefreshData();
            loadAuxData();
          }}
        />
      )}

      {/* 5. Payment Modal */}
      {paymentBooking && (
        <PaymentModal
          booking={paymentBooking}
          onClose={() => setPaymentBooking(null)}
          onPaymentRecorded={() => onRefreshData()}
        />
      )}
    </div>
  );
};
