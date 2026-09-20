import React, { useState, useEffect } from 'react';
import { FirestoreUser, UserRole } from '../../types';
import { dataService } from '../../services/dataService';
import { functionsService } from '../../services/functionsService';
import { useAuth } from '../../contexts/AuthContext';
import {
  ShieldCheck,
  UserCheck,
  Users,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRightLeft,
  Mail,
  Phone,
  Calendar,
  Shield,
  User,
  Info,
  X,
  Sparkles,
  Ban,
  Trash2
} from 'lucide-react';

interface AdminStaffRolesProps {
  onBackToOverview?: () => void;
}

import { DESIGNATED_SUPER_ADMIN_UID } from '../../constants/auth';

type AssignableRole = 'customer' | 'employee' | 'admin';

interface PendingRoleChange {
  user: FirestoreUser;
  newRole: AssignableRole;
}

export const AdminStaffRoles: React.FC<AdminStaffRolesProps> = () => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<FirestoreUser[]>(() => dataService.getCachedUsers());
  const [isLoading, setIsLoading] = useState<boolean>(() => dataService.getCachedUsers().length === 0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'staff' | 'customer' | 'admin' | 'employee'>('all');

  // Selected role changes map: userId -> newRole
  const [selectedRoles, setSelectedRoles] = useState<Record<string, AssignableRole>>({});

  // Confirmation Modals
  const [pendingChange, setPendingChange] = useState<PendingRoleChange | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Account disable / enable modal
  const [pendingToggleStatusUser, setPendingToggleStatusUser] = useState<FirestoreUser | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Permanent Delete modal
  const [pendingDeleteUser, setPendingDeleteUser] = useState<FirestoreUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Fetch users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async (forceRefresh = false) => {
    if (forceRefresh) setIsRefreshing(true);
    try {
      const fetched = await dataService.getAllUsers(forceRefresh);
      setUsers(fetched);
    } catch (err) {
      console.error('Error fetching users for staff management:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Check if a user is the currently logged-in account
  const isCurrentSelfUser = (targetUser: FirestoreUser): boolean => {
    if (!currentUser) return false;
    const targetUid = targetUser.id || targetUser.uid;
    const currentUid = currentUser.uid;
    const targetEmail = targetUser.email?.toLowerCase().trim();
    const currentEmail = currentUser.email?.toLowerCase().trim();

    return (
      targetUid === currentUid ||
      (Boolean(targetEmail) && Boolean(currentEmail) && targetEmail === currentEmail)
    );
  };

  // Check if target is a superAdmin account
  const isSuperAdminAccount = (targetUser: FirestoreUser): boolean => {
    const targetUid = targetUser.id || targetUser.uid;
    if (targetUid === DESIGNATED_SUPER_ADMIN_UID) return true;
    const role = targetUser.role;
    return role === 'superAdmin' || role === 'super_admin' || (role as string) === 'owner';
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'superAdmin':
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>المدير العام (Super Admin)</span>
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>مدير نظام (Admin)</span>
          </span>
        );
      case 'employee':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>موظف عمليات (Employee)</span>
          </span>
        );
      case 'customer':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>عميل مسجل (Customer)</span>
          </span>
        );
    }
  };

  const getRoleLabel = (role: AssignableRole): string => {
    switch (role) {
      case 'admin':
        return 'مدير نظام (Admin)';
      case 'employee':
        return 'موظف عمليات (Employee)';
      case 'customer':
        return 'عميل مسجل (Customer)';
    }
  };

  const getRolePermissionsDescription = (role: AssignableRole): string => {
    switch (role) {
      case 'admin':
        return 'إمكانية إدارة الأسعار والإعدادات، تعديل بيانات السيارات والعقود، والاطلاع على التقارير المالية والإحصائيات.';
      case 'employee':
        return 'إمكانية إدارة وتأكيد الحجوزات، تسجيل المعاينات وتسليم واستلام السيارات، وإصدار سندات القبض والدفعات.';
      case 'customer':
        return 'حساب عميل عادي: إمكانية تصفح الأسطول، إرسال طلبات الحجز الإلكترونية، ومتابعة حجوزاته ووثائقه الشخصية فقط.';
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    // Search query
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.displayName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.id?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    // Role filter
    if (roleFilter === 'all') return true;
    if (roleFilter === 'staff') return u.role === 'admin' || u.role === 'employee' || u.role === 'superAdmin' || u.role === 'super_admin';
    if (roleFilter === 'admin') return u.role === 'admin' || u.role === 'superAdmin' || u.role === 'super_admin';
    if (roleFilter === 'employee') return u.role === 'employee';
    if (roleFilter === 'customer') return u.role === 'customer' || !u.role;

    return true;
  });

  // Calculate statistics
  const totalCount = users.length;
  const adminCount = users.filter((u) => u.role === 'admin' || u.role === 'superAdmin' || u.role === 'super_admin').length;
  const employeeCount = users.filter((u) => u.role === 'employee').length;
  const customerCount = users.filter((u) => u.role === 'customer' || !u.role).length;

  // Handle select dropdown change
  const handleRoleSelection = (userId: string, newRole: AssignableRole) => {
    setSelectedRoles((prev) => ({
      ...prev,
      [userId]: newRole,
    }));
  };

  // Open confirmation modal for role change
  const handleInitiateChange = (targetUser: FirestoreUser) => {
    const targetUid = targetUser.id || targetUser.uid;
    const selected = selectedRoles[targetUid];
    if (!selected || selected === targetUser.role) return;

    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);
    setPendingChange({
      user: targetUser,
      newRole: selected,
    });
  };

  // Execute Role Update
  const handleConfirmRoleUpdate = async () => {
    if (!pendingChange) return;
    const { user: targetUser, newRole } = pendingChange;
    const targetUid = targetUser.id || targetUser.uid;

    setIsSaving(true);
    setSaveErrorMsg(null);

    try {
      await dataService.updateUserRole(targetUid, newRole);

      // Update state locally
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUid || u.uid === targetUid ? { ...u, role: newRole } : u))
      );

      // Clear pending map
      setSelectedRoles((prev) => {
        const next = { ...prev };
        delete next[targetUid];
        return next;
      });

      setSaveSuccessMsg(`تم تحديث صلاحيات المستخدم (${targetUser.displayName || targetUser.email}) إلى "${getRoleLabel(newRole)}" بنجاح.`);
      setPendingChange(null);

      // Auto dismiss success message after 5 seconds
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 5000);
    } catch (err: any) {
      console.error('Error updating user role:', err);
      setSaveErrorMsg(err?.message || 'فشل تحديث الدور. تأكد من اتصال الإنترنت وصلاحيات الحساب.');
    } finally {
      setIsSaving(false);
    }
  };

  // Execute Toggle User Account Status (Disable / Enable)
  const handleConfirmToggleStatus = async () => {
    if (!pendingToggleStatusUser) return;
    const targetUid = pendingToggleStatusUser.id || pendingToggleStatusUser.uid;
    const isCurrentlyDisabled = Boolean(pendingToggleStatusUser.accountDisabled || pendingToggleStatusUser.disabled);
    const newDisabledState = !isCurrentlyDisabled;

    setIsTogglingStatus(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const res = await functionsService.toggleUserAccountStatus(targetUid, newDisabledState);
      if (!res.success) {
        throw new Error(res.error || 'فشل تحديث حالة الحساب.');
      }

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === targetUid || u.uid === targetUid
            ? { ...u, accountDisabled: newDisabledState, disabled: newDisabledState }
            : u
        )
      );

      setSaveSuccessMsg(
        newDisabledState
          ? `تم تعطيل حساب المستخدم (${pendingToggleStatusUser.displayName || pendingToggleStatusUser.email}) ومنعه من تسجيل الدخول.`
          : `تم إعادة تفعيل حساب المستخدم (${pendingToggleStatusUser.displayName || pendingToggleStatusUser.email}) بنجاح.`
      );
      setPendingToggleStatusUser(null);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Error toggling user account status:', err);
      setSaveErrorMsg(err?.message || 'فشل تغيير حالة الحساب. تأكد من الصلاحيات والاتصال.');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Execute Permanent Delete User
  const handleConfirmDeleteUser = async () => {
    if (!pendingDeleteUser) return;
    const targetUid = pendingDeleteUser.id || pendingDeleteUser.uid;

    setIsDeletingUser(true);
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);

    try {
      const res = await functionsService.deleteUserAccount(targetUid);
      if (!res.success) {
        throw new Error(res.error || 'فشل حذف الحساب.');
      }

      // Remove from local list
      setUsers((prev) => prev.filter((u) => u.id !== targetUid && u.uid !== targetUid));

      setSaveSuccessMsg(`تم حذف المستخدم (${pendingDeleteUser.displayName || pendingDeleteUser.email}) نهائياً من قاعدة البيانات ونظام التوثيق.`);
      setPendingDeleteUser(null);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Error deleting user account:', err);
      setSaveErrorMsg(err?.message || 'فشل حذف الحساب. تأكد من الصلاحيات والاتصال.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>إدارة الحسابات والصلاحيات السحابية</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              إدارة الموظفين، الصلاحيات وحسابات المستخدمين
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              ترقية حسابات العملاء المسجلين، تعيين الصلاحيات التشغيلية، تعطيل أو تفعيل الحسابات، والحذف النهائي وفق قواعد أمان Firebase المعتمدة.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadUsers(true)}
              disabled={isRefreshing}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-all border border-slate-700 shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>تحديث القائمة</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Success / Error Banners */}
      {saveSuccessMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 text-emerald-300 text-xs sm:text-sm font-bold shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg(null)}
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveErrorMsg && (
        <div className="bg-rose-500/15 border border-rose-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-300 text-xs sm:text-sm font-bold shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{saveErrorMsg}</span>
          </div>
          <button
            onClick={() => setSaveErrorMsg(null)}
            className="p-1 hover:bg-rose-500/20 rounded-lg text-rose-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. KPI Statistics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي الحسابات</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalCount}</div>
          <div className="text-[10px] text-slate-500">مسجلين في المنظومة</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>الإدارة والمدراء</span>
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-300">{adminCount}</div>
          <div className="text-[10px] text-slate-500">إشراف وإعدادات كاملة</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>طاقم الموظفين</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300">{employeeCount}</div>
          <div className="text-[10px] text-slate-500">تشغيل وحجوزات ومعاينات</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>العملاء المسجلون</span>
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-200">{customerCount}</div>
          <div className="text-[10px] text-slate-500">حسابات مستخدمين عادية</div>
        </div>
      </div>

      {/* 4. Filter & Search Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="البحث بالاسم، البريد، أو الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs w-full md:w-auto overflow-x-auto">
          {[
            { id: 'all', label: `الكل (${totalCount})` },
            { id: 'staff', label: `طاقم العمل (${adminCount + employeeCount})` },
            { id: 'admin', label: `المدراء (${adminCount})` },
            { id: 'employee', label: `الموظفون (${employeeCount})` },
            { id: 'customer', label: `العملاء (${customerCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setRoleFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                roleFilter === f.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Main Users List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-400">جاري جلب سجل المستخدمين من قاعدة البيانات السحابية...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">لم يتم العثور على مستخدمين</h3>
            <p className="text-xs text-slate-500">جرب تعديل كلمة البحث أو فلتر الأدوار المحدد أعلاه.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-bold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">المستخدم</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">معلومات الاتصال</th>
                  <th className="py-3.5 px-4">الدور الحالي</th>
                  <th className="py-3.5 px-4 text-center">تعديل الدور والصلاحية</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">الإجراءات وإدارة الحساب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((u) => {
                  const targetUid = u.id || u.uid;
                  const isSelf = isCurrentSelfUser(u);
                  const isSuper = isSuperAdminAccount(u);
                  const isAccountDisabled = Boolean(u.accountDisabled || u.disabled);

                  // Current active role or pending dropdown selection
                  const selectedRole = selectedRoles[targetUid] || (u.role === 'superAdmin' || u.role === 'super_admin' ? 'admin' : (u.role as AssignableRole) || 'customer');
                  const hasPendingChange = selectedRoles[targetUid] !== undefined && selectedRoles[targetUid] !== u.role;

                  return (
                    <tr
                      key={targetUid}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isSelf ? 'bg-amber-500/5' : ''
                      } ${isAccountDisabled ? 'bg-rose-950/20' : ''}`}
                    >
                      {/* 1. User details */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                            isAccountDisabled
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : isSuper
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : u.role === 'admin'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : u.role === 'employee'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {u.displayName?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                              <span>{u.displayName || 'مستخدم مسجل'}</span>
                              {isSelf && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  أنت (الحساب الحالي)
                                </span>
                              )}
                              {isAccountDisabled && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                                  <Ban className="w-2.5 h-2.5" />
                                  <span>حساب معطل</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5" dir="ltr">
                              <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{u.email}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 font-mono">
                              UID: {targetUid.slice(0, 12)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Contact & Join Date */}
                      <td className="py-4 px-4 hidden sm:table-cell text-slate-400">
                        {u.phone ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono" dir="ltr">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{u.phone}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600">لا يوجد رقم هاتف</span>
                        )}
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                          <Calendar className="w-3 h-3 text-slate-600" />
                          <span>
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-SY') : 'سجل مسبق'}
                          </span>
                        </div>
                      </td>

                      {/* 3. Current Role Badge */}
                      <td className="py-4 px-4">
                        {getRoleBadge(u.role)}
                      </td>

                      {/* 4. Role Selector Dropdown */}
                      <td className="py-4 px-4 text-center">
                        {isSelf || isSuper ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-500 font-semibold">
                            <Lock className="w-3 h-3 text-amber-500/80" />
                            <span>
                              {isSelf
                                ? 'حسابك الحالي (محمي)'
                                : 'حساب مدير عام (محمي)'}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-block relative">
                            <select
                              value={selectedRole}
                              onChange={(e) =>
                                handleRoleSelection(targetUid, e.target.value as AssignableRole)
                              }
                              className={`bg-slate-950 border rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:outline-none transition-all cursor-pointer ${
                                hasPendingChange
                                  ? 'border-amber-500 bg-amber-500/10 text-amber-200 ring-2 ring-amber-500/20'
                                  : 'border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              <option value="customer" className="bg-slate-900 text-slate-200">
                                عميل مسجل (Customer)
                              </option>
                              <option value="employee" className="bg-slate-900 text-slate-200">
                                موظف عمليات (Employee)
                              </option>
                              <option value="admin" className="bg-slate-900 text-slate-200">
                                مدير نظام (Admin)
                              </option>
                            </select>
                          </div>
                        )}
                      </td>

                      {/* 5. Save & Manage Action Buttons */}
                      <td className="py-4 px-4 sm:px-6 text-center">
                        {isSelf ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-500 font-semibold">
                            <Lock className="w-3 h-3 text-amber-500/80" />
                            <span>حسابك الحالي (محمي)</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Role Apply Button */}
                            <button
                              onClick={() => handleInitiateChange(u)}
                              disabled={!hasPendingChange}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                                hasPendingChange
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 active:scale-95'
                                  : 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50'
                              }`}
                              title="تطبيق الدور المحدد"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              <span>تطبيق</span>
                            </button>

                            {/* Toggle Disable / Enable Account Button */}
                            <button
                              onClick={() => setPendingToggleStatusUser(u)}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                                isAccountDisabled
                                  ? 'bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border-emerald-500/30'
                                  : 'bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border-amber-500/30'
                              }`}
                              title={isAccountDisabled ? 'إعادة تفعيل الحساب والسماح بتسجيل الدخول' : 'تعطيل الحساب ومنعه من تسجيل الدخول'}
                            >
                              {isAccountDisabled ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>تفعيل</span>
                                </>
                              ) : (
                                <>
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>تعطيل</span>
                                </>
                              )}
                            </button>

                            {/* Delete User Account Button (Super Admin only, hidden for super admin target and self) */}
                            {isSuperAdmin && !isSuper && (
                              <button
                                onClick={() => setPendingDeleteUser(u)}
                                className="p-1.5 rounded-xl text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 transition-all"
                                title="حذف الحساب نهائياً من Firebase Auth و Firestore"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Permissions Guide Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400" />
          <span>دليل الصلاحيات والأدوار في المنظومة</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <div className="font-bold text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span>عميل مسجل (Customer)</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              تصفح أسطول السيارات، حجز السيارات عبر الإنترنت، متابعة حالة الحجوزات الشخصية، ورفع صور رخصة القيادة والهوية.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 space-y-2">
            <div className="font-bold text-emerald-300 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>موظف عمليات (Employee)</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              إدارة طلبات التأجير وتأكيدها، فحص واستلام السيارات، تسجيل تقارير الصيانة وزيت المحرك، وإصدار سندات القبض.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-blue-500/20 space-y-2">
            <div className="font-bold text-blue-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span>مدير نظام (Admin)</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              كافة صلاحيات الموظف التشغيلي + تعديل أسعار التأجير، إعدادات الشركة، والاطلاع الكامل على التقارير المالية والإيرادات.
            </p>
          </div>
        </div>
      </div>

      {/* 7. Modal 1: Confirmation for Role Change */}
      {pendingChange && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-lg font-black text-white">تأكيد تعديل صلاحيات المستخدم</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  أنت على وشك تغيير المستوى الأمني لهذا الحساب في قاعدة البيانات السحابية.
                </p>
              </div>
            </div>

            {/* User Target Card */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">المستخدم المستهدف</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {pendingChange.user.displayName || 'مستخدم مسجل'}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                  {pendingChange.user.email}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">الدور الحالي</span>
                  <span className="font-bold text-slate-300">
                    {getRoleLabel(
                      pendingChange.user.role === 'admin'
                        ? 'admin'
                        : pendingChange.user.role === 'employee'
                        ? 'employee'
                        : 'customer'
                    )}
                  </span>
                </div>
                <ArrowRightLeft className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="text-left">
                  <span className="text-[10px] text-slate-500 block">الدور الجديد</span>
                  <span className="font-black text-amber-400">
                    {getRoleLabel(pendingChange.newRole)}
                  </span>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 space-y-1.5 text-xs">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>أثر التعديل الفوري:</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                {getRolePermissionsDescription(pendingChange.newRole)}
              </p>
              <p className="text-amber-200/90 text-[11px] font-semibold mt-1">
                سيحصل هذا المستخدم على صلاحيات [{getRoleLabel(pendingChange.newRole)}] فوراً عند تسجيل دخوله القادم. هل أنت متأكد؟
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmRoleUpdate}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ في Firestore...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد وحفظ الدور الجديد</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setPendingChange(null)}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal 2: Confirmation for Toggling Account Status */}
      {pendingToggleStatusUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Ban className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-white">
                {pendingToggleStatusUser.accountDisabled || pendingToggleStatusUser.disabled
                  ? 'تأكيد تفعيل حساب المستخدم'
                  : 'تأكيد تعطيل حساب المستخدم'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {pendingToggleStatusUser.accountDisabled || pendingToggleStatusUser.disabled
                  ? `هل ترغب في إعادة تفعيل حساب المستخدم "${pendingToggleStatusUser.displayName || pendingToggleStatusUser.email}" والسماح له بتسجيل الدخول؟`
                  : `هل أنت متأكد من تعطيل حساب المستخدم "${pendingToggleStatusUser.displayName || pendingToggleStatusUser.email}"؟ سيتم منعه فوراً من تسجيل الدخول إلى المنظومة.`}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isTogglingStatus}
                onClick={handleConfirmToggleStatus}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isTogglingStatus ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري المعالجة...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الإجراء</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isTogglingStatus}
                onClick={() => setPendingToggleStatusUser(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal 3: Confirmation for Permanent User Account Deletion */}
      {pendingDeleteUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-white">حذف حساب المستخدم نهائياً</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف المستخدم <strong className="text-white">&ldquo;{pendingDeleteUser.displayName || pendingDeleteUser.email}&rdquo;</strong> نهائياً؟
              </p>
              <div className="text-[11px] text-rose-300 font-bold bg-rose-500/10 p-3 rounded-xl border border-rose-500/30 leading-normal text-right space-y-1">
                <div className="flex items-center gap-1.5 text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>تنبيه أمني هام وغير قابل للتراجع:</span>
                </div>
                <p className="text-slate-300 font-normal">
                  هذا الإجراء سيقوم بحذف حساب الدخول بالكامل من Firebase Authentication ومستند المستخدم من Firestore بشكل دائم ونهائي.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeletingUser ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحذف النهائي...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد الحذف النهائي</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => setPendingDeleteUser(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
