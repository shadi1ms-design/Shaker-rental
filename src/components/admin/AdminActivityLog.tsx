import React, { useState, useEffect } from 'react';
import { db, isFirebaseConfigured } from '../../firebase/config';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Clock,
  User,
  Activity,
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Layers,
  ArrowUpDown
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  user?: string;
  performedBy?: string;
  userId?: string;
  targetUser?: string;
  targetUserEmail?: string;
  actorUid?: string | null;
  actorEmail?: string | null;
  actorType?: string;
  customerProvidedName?: string | null;
  entity?: string;
  entityId?: string;
  details?: string | any;
  timestamp?: any;
  createdAt?: any;
  ip?: string;
}

interface AdminActivityLogProps {
  onBackToOverview?: () => void;
}

const ACTION_LABELS_AR: Record<string, { label: string; color: 'blue' | 'amber' | 'emerald' | 'rose' | 'purple' | 'slate' }> = {
  // Bookings
  BOOKING_STATUS_UPDATED: { label: 'تحديث حالة حجز', color: 'amber' },
  BOOKING_CREATED: { label: 'إنشاء حجز جديد', color: 'emerald' },
  BOOKING_DELETED: { label: 'حذف حجز من النظام', color: 'rose' },
  BOOKING_CANCELLED: { label: 'إلغاء حجز', color: 'rose' },
  BOOKING_REVIEWED: { label: 'مراجعة طلب حجز', color: 'blue' },

  // User & Roles
  ROLE_MODIFIED: { label: 'تعديل صلاحية مستخدم', color: 'purple' },
  USER_ACCOUNT_DISABLED: { label: 'تعطيل حساب مستخدم', color: 'rose' },
  USER_ACCOUNT_ENABLED: { label: 'تفعيل حساب مستخدم', color: 'emerald' },
  USER_ACCOUNT_DELETED: { label: 'حذف حساب مستخدم نهائياً', color: 'rose' },
  USER_REGISTERED: { label: 'تسجيل مستخدم جديد', color: 'blue' },
  USER_VERIFIED: { label: 'توثيق هوية مستخدم', color: 'emerald' },
  USER_REJECTED: { label: 'رفض توثيق مستخدم', color: 'rose' },

  // Payments
  PAYMENT_RECORDED: { label: 'تسجيل دفعة مالية', color: 'emerald' },
  PAYMENT_CREATED: { label: 'إنشاء سند قبض', color: 'emerald' },
  PAYMENT_DELETED: { label: 'حذف سند قبض', color: 'rose' },

  // Vehicles
  VEHICLE_ADDED: { label: 'إضافة سيارة للأسطول', color: 'emerald' },
  VEHICLE_UPDATED: { label: 'تعديل بيانات سيارة', color: 'amber' },
  VEHICLE_DELETED: { label: 'حذف سيارة من الأسطول', color: 'rose' },

  // Documents
  DOCUMENT_UPLOADED: { label: 'رفع وثيقة رسمية', color: 'blue' },
  DOCUMENT_VERIFIED: { label: 'اعتماد وتوثيق مستند', color: 'emerald' },
  DOCUMENT_DELETED: { label: 'حذف وثيقة', color: 'rose' },

  // Settings & System
  SETTINGS_UPDATED: { label: 'تحديث إعدادات النظام', color: 'purple' },
  PASSWORD_RESET: { label: 'طلب إعادة تعيين كلمة السر', color: 'slate' },
  LOGIN_SUCCESS: { label: 'تسجيل دخول ناجح', color: 'blue' },
  LOGIN_FAILED: { label: 'فشل تسجيل الدخول', color: 'rose' },
};

function formatTimestamp(rawVal: any): { display: string; rawIso: string; timeAgo: string } {
  let date: Date;

  if (!rawVal) {
    return { display: 'غير محدد', rawIso: '', timeAgo: '' };
  }

  if (typeof rawVal === 'object' && typeof rawVal.toDate === 'function') {
    date = rawVal.toDate();
  } else if (typeof rawVal === 'object' && rawVal.seconds) {
    date = new Date(rawVal.seconds * 1000);
  } else if (typeof rawVal === 'number') {
    date = new Date(rawVal);
  } else if (typeof rawVal === 'string') {
    date = new Date(rawVal);
  } else {
    return { display: 'غير محدد', rawIso: '', timeAgo: '' };
  }

  if (isNaN(date.getTime())) {
    return { display: 'غير محدد', rawIso: '', timeAgo: '' };
  }

  const rawIso = date.toISOString();
  const display = date.toLocaleString('ar-SY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  let timeAgo = '';
  if (diffMinutes < 1) {
    timeAgo = 'الآن';
  } else if (diffMinutes < 60) {
    timeAgo = `منذ ${diffMinutes} دقيقة`;
  } else if (diffHours < 24) {
    timeAgo = `منذ ${diffHours} ساعة`;
  } else if (diffDays === 1) {
    timeAgo = 'منذ يوم';
  } else {
    timeAgo = `منذ ${diffDays} يوم`;
  }

  return { display, rawIso, timeAgo };
}

export const AdminActivityLog: React.FC<AdminActivityLogProps> = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      if (!isFirebaseConfigured || !db) {
        throw new Error('الاتصال بقاعدة بيانات Firebase غير متوفر.');
      }

      const logsRef = collection(db, 'auditLogs');
      const q = query(logsRef, limit(100));
      const querySnapshot = await getDocs(q);

      const items: AuditLogItem[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          action: data.action || 'UNKNOWN_ACTION',
          user: data.user,
          performedBy: data.performedBy,
          userId: data.userId,
          targetUser: data.targetUser,
          targetUserEmail: data.targetUserEmail,
          actorUid: data.actorUid,
          actorEmail: data.actorEmail,
          actorType: data.actorType,
          customerProvidedName: data.customerProvidedName,
          entity: data.entity,
          entityId: data.entityId,
          details: data.details,
          timestamp: data.timestamp,
          createdAt: data.createdAt,
          ip: data.ip,
        });
      });

      // Sort client-side descending by timestamp/createdAt for maximum robustness
      items.sort((a, b) => {
        const getTime = (item: AuditLogItem): number => {
          const val = item.createdAt || item.timestamp;
          if (!val) return 0;
          if (typeof val === 'object' && typeof val.toDate === 'function') return val.toDate().getTime();
          if (typeof val === 'object' && val.seconds) return val.seconds * 1000;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') {
            const parsed = new Date(val).getTime();
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        };
        return getTime(b) - getTime(a);
      });

      setLogs(items);
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
      setError(err?.message || 'عذراً، حدث خطأ أثناء تحميل سجل النشاطات من السحابة.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getPerformerDisplay = (item: AuditLogItem): string => {
    return (
      item.user ||
      item.performedBy ||
      item.userId ||
      'النظام / غير محدد'
    );
  };

  const getDetailsDisplay = (item: AuditLogItem): string => {
    if (typeof item.details === 'string') {
      return item.details;
    }
    if (item.details && typeof item.details === 'object') {
      try {
        return JSON.stringify(item.details, null, 2);
      } catch {
        return String(item.details);
      }
    }
    if (item.targetUser || item.targetUserEmail) {
      return `المستخدم المستهدف: ${item.targetUserEmail || item.targetUser}`;
    }
    if (item.entity && item.entityId) {
      return `العنصر: ${item.entity} (معرف: ${item.entityId})`;
    }
    if (item.entityId) {
      return `المعرف: ${item.entityId}`;
    }
    return '—';
  };

  // Filter & Search Logic
  const filteredLogs = logs.filter((item) => {
    const actionMatch = actionFilter === 'all' || item.action === actionFilter;
    if (!actionMatch) return false;

    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    const performer = getPerformerDisplay(item).toLowerCase();
    const actionLabel = (ACTION_LABELS_AR[item.action]?.label || item.action).toLowerCase();
    const details = getDetailsDisplay(item).toLowerCase();
    const entity = (item.entity || '').toLowerCase();
    const entityId = (item.entityId || '').toLowerCase();

    return (
      performer.includes(q) ||
      actionLabel.includes(q) ||
      item.action.toLowerCase().includes(q) ||
      details.includes(q) ||
      entity.includes(q) ||
      entityId.includes(q) ||
      item.id.toLowerCase().includes(q)
    );
  });

  // Unique actions list for filter dropdown
  const uniqueActions: string[] = logs
    .map((l) => l.action)
    .filter((act, idx, arr): act is string => Boolean(act) && arr.indexOf(act) === idx);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white">سجل نشاطات النظام والتدقيق الأمني</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
                  Super Admin Only
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                سجل إلكتروني غير قابل للتعديل يوثق جميع العمليات الإدارية الحساسة وتغييرات الصلاحيات وحالات الحجوزات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(true)}
              disabled={isRefreshing || isLoading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
              <span>{isRefreshing ? 'جاري التحديث...' : 'تحديث السجل'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filter */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-lg">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالإجراء، المنفذ، التفاصيل، المعرف..."
            className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              مسح
            </button>
          )}
        </div>

        {/* Action Filter & Stats */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:border-purple-500 outline-none transition-all cursor-pointer"
            >
              <option value="all">جميع أنواع الإجراءات ({logs.length})</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {ACTION_LABELS_AR[act]?.label || act}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-400 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono">
            المعروض: <strong className="text-white">{filteredLogs.length}</strong> / {logs.length}
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="flex-1">
            <span className="font-bold block mb-0.5">تعذر استعراض سجل النشاطات</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchLogs(true)}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold text-xs"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Logs Table / List */}
      {isLoading ? (
        <div className="py-20 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-300">جاري تحميل آخر 100 سجل نشاط من قاعدة البيانات السحابية...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-2">
          <Activity className="w-12 h-12 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">لا توجد سجلات نشاط مطابقة</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery || actionFilter !== 'all'
              ? 'لم يتم العثور على أية سجلات تطابق معايير البحث والفلترة المحددة.'
              : 'لم يتم تسجيل أية عمليات أو نشاطات بعد في سجل التدقيق الأمني.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((item) => {
            const timeInfo = formatTimestamp(item.createdAt || item.timestamp);
            const actionConfig = ACTION_LABELS_AR[item.action] || {
              label: item.action.replace(/_/g, ' '),
              color: 'slate',
            };
            const performer = getPerformerDisplay(item);
            const detailsText = getDetailsDisplay(item);
            const isExpanded = expandedLogId === item.id;

            const badgeStyles = {
              emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
              amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
              rose: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
              purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
              blue: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
              slate: 'bg-slate-800 text-slate-300 border-slate-700',
            }[actionConfig.color];

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all text-xs space-y-3 shadow-sm"
              >
                {/* Header row: Action & Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${badgeStyles}`}>
                      <Activity className="w-3.5 h-3.5" />
                      <span>{actionConfig.label}</span>
                    </span>

                    <span className="font-mono text-[11px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {item.action}
                    </span>

                    {item.entity && (
                      <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                        {item.entity}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-mono text-slate-300">{timeInfo.display}</span>
                    {timeInfo.timeAgo && (
                      <span className="text-slate-500 text-[10px]">({timeInfo.timeAgo})</span>
                    )}
                  </div>
                </div>

                {/* Performer & Core metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 block">المنفذ:</span>
                      <span className="font-bold text-white truncate block" title={performer}>
                        {performer}
                      </span>
                    </div>
                  </div>

                  {(item.targetUser || item.targetUserEmail) && (
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-4 h-4 text-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-500 block">المستخدم المستهدف:</span>
                        <span className="font-semibold text-purple-300 truncate block">
                          {item.targetUserEmail || item.targetUser}
                        </span>
                      </div>
                    </div>
                  )}

                  {item.entityId && (
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-500 block">المعرف (Entity ID):</span>
                        <span className="font-mono text-amber-300 text-[11px] truncate block" title={item.entityId}>
                          {item.entityId}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Details snippet / toggle */}
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-slate-500 block mb-0.5 font-bold">التفاصيل والبيانات:</span>
                    <p className={`text-slate-300 text-xs font-mono bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 break-words whitespace-pre-wrap ${!isExpanded ? 'line-clamp-2' : ''}`}>
                      {detailsText}
                    </p>
                  </div>

                  {detailsText.length > 80 && (
                    <button
                      type="button"
                      onClick={() => setExpandedLogId(isExpanded ? null : item.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold shrink-0 transition-colors mt-4"
                    >
                      {isExpanded ? 'طي التفاصيل' : 'عرض الكل'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
