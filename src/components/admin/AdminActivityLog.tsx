import React, { useState, useEffect } from 'react';
import { getDb, isFirebaseConfigured } from '../../firebase/config';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import { ADMIN_TAB_LABEL } from '../../constants/adminNav';
import { SearchInput } from '../common/SearchInput';
import { RoleBadge } from '../common/RoleBadge';
import {
  ShieldAlert,
  RefreshCw,
  Clock,
  User,
  Activity,
  FileText,
  Filter,
  AlertTriangle
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
  actorRole?: string | null;
  actorType?: string;
  customerProvidedName?: string | null;
  entity?: string;
  entityId?: string;
  details?: unknown;
  timestamp?: string | number | Date | { toDate: () => Date } | { seconds: number; nanoseconds?: number } | null | undefined;
  createdAt?: string | number | Date | { toDate: () => Date } | { seconds: number; nanoseconds?: number } | null | undefined;
  ip?: string;
}

interface AdminActivityLogProps {
  onBackToOverview?: () => void;
}

const ACTION_LABELS_AR: Record<string, { label: string; color: 'blue' | 'amber' | 'emerald' | 'rose' | 'slate' | 'indigo' }> = {
  // Bookings
  BOOKING_STATUS_UPDATED: { label: 'تحديث حالة حجز', color: 'amber' },
  BOOKING_CREATED: { label: 'إنشاء حجز جديد', color: 'emerald' },
  BOOKING_CREATED_SECURE: { label: 'إنشاء حجز آمن', color: 'emerald' },
  BOOKING_DELETED: { label: 'حذف حجز من النظام', color: 'rose' },
  BOOKING_CANCELLED: { label: 'إلغاء حجز', color: 'rose' },
  BOOKING_REVIEWED: { label: 'مراجعة طلب حجز', color: 'blue' },
  BOOKING_NOTIFICATION_SENT_SECURE: { label: 'إرسال إشعار حجز آمن', color: 'indigo' },

  // User & Roles
  ROLE_MODIFIED: { label: 'تعديل صلاحية مستخدم', color: 'amber' },
  USER_ACCOUNT_DISABLED: { label: 'تعطيل حساب مستخدم', color: 'rose' },
  USER_ACCOUNT_ENABLED: { label: 'تفعيل حساب مستخدم', color: 'emerald' },
  USER_ACCOUNT_DELETED: { label: 'حذف حساب مستخدم نهائياً', color: 'rose' },
  USER_REGISTERED: { label: 'تسجيل مستخدم جديد', color: 'blue' },
  USER_VERIFIED: { label: 'توثيق هوية مستخدم', color: 'emerald' },
  USER_REJECTED: { label: 'رفض توثيق مستخدم', color: 'rose' },

  // Verification & Security
  VERIFICATION_SUBMITTED: { label: 'تقديم طلب توثيق', color: 'blue' },
  VERIFICATION_APPROVED: { label: 'قبول توثيق الحساب', color: 'emerald' },
  VERIFICATION_REJECTED: { label: 'رفض طلب التوثيق', color: 'rose' },
  VERIFICATION_REVOKED: { label: 'إلغاء توثيق معتمد', color: 'rose' },
  VERIFICATION_QUOTA_EXCEEDED: { label: 'تجاوز حصة طلبات التوثيق', color: 'amber' },
  UPLOAD_QUOTA_EXCEEDED: { label: 'تجاوز حصة رفع الملفات', color: 'amber' },
  DOCUMENT_VIEWED: { label: 'معاينة وثيقة رسمية', color: 'indigo' },

  // Vehicles
  VEHICLE_ADDED: { label: 'إضافة سيارة للأسطول', color: 'emerald' },
  VEHICLE_UPDATED: { label: 'تعديل بيانات سيارة', color: 'amber' },
  VEHICLE_DELETED: { label: 'حذف سيارة من الأسطول', color: 'rose' },

  // Documents
  DOCUMENT_UPLOADED: { label: 'رفع وثيقة رسمية', color: 'blue' },
  DOCUMENT_VERIFIED: { label: 'اعتماد وتوثيق مستند', color: 'emerald' },
  DOCUMENT_DELETED: { label: 'حذف وثيقة', color: 'rose' },
  CONTRACT_GENERATED: { label: 'إصدار بيانات عقد', color: 'indigo' },

  // Settings & System
  SETTINGS_UPDATED: { label: 'تحديث إعدادات النظام', color: 'amber' },
  SETTINGS_UPDATED_SECURE: { label: 'تحديث إعدادات آمن', color: 'amber' },
  PASSWORD_RESET: { label: 'طلب إعادة تعيين كلمة السر', color: 'slate' },
  LOGIN_SUCCESS: { label: 'تسجيل دخول ناجح', color: 'blue' },
  LOGIN_FAILED: { label: 'فشل تسجيل الدخول', color: 'rose' },

  // Suspicious Activity & Fraud Prevention
  SUSPICIOUS_IMAGE_EDITOR_REJECTED: { label: 'رفض تعديل صورة', color: 'rose' },
  SUSPICIOUS_FILE_SIGNATURE_MISMATCH: { label: 'عدم تطابق بصمة الملف', color: 'rose' },
  SUSPICIOUS_VERIFICATION_DOC_SIGNATURE: { label: 'توقيع وثيقة توثيق مشبوه', color: 'rose' },
  SUSPICIOUS_VIDEO_SIGNATURE_MISMATCH: { label: 'عدم تطابق بصمة الفيديو', color: 'rose' },
  SUSPICIOUS_VIDEO_SIZE_VIOLATION: { label: 'مخالفة حجم الفيديو', color: 'rose' },
};

function formatTimestamp(rawVal: string | number | Date | { toDate: () => Date } | { seconds: number; nanoseconds?: number } | null | undefined): { display: string; rawIso: string; timeAgo: string } {
  let date: Date;

  if (!rawVal) {
    return { display: 'غير محدد', rawIso: '', timeAgo: '' };
  }

  if (rawVal instanceof Date) {
    date = rawVal;
  } else if (rawVal && typeof rawVal === 'object' && 'toDate' in rawVal && typeof rawVal.toDate === 'function') {
    date = (rawVal as { toDate: () => Date }).toDate();
  } else if (rawVal && typeof rawVal === 'object' && 'seconds' in rawVal) {
    date = new Date((rawVal as { seconds: number }).seconds * 1000);
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
  const display = date.toLocaleString('ar-SY-u-nu-latn', {
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

  const fetchLogs = React.useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      if (!isFirebaseConfigured) {
        throw new Error('الاتصال بقاعدة بيانات Firebase غير متوفر.');
      }

      const db = getDb();
      if (!db) {
        throw new Error('تعذر تهيئة قاعدة بيانات Firestore.');
      }

      const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const items: AuditLogItem[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          action: data.action || 'UNKNOWN_ACTION',
          user: data.user || data.performedBy || data.actorEmail || data.userId || 'مستخدم غير معروف',
          performedBy: data.performedBy,
          userId: data.userId,
          targetUser: data.targetUser,
          targetUserEmail: data.targetUserEmail,
          actorUid: data.actorUid,
          actorEmail: data.actorEmail,
          actorRole: data.actorRole,
          actorType: data.actorType,
          customerProvidedName: data.customerProvidedName,
          entity: data.entity,
          entityId: data.entityId,
          details: data.details,
          timestamp: data.timestamp,
          createdAt: data.createdAt,
          ip: data.ip,
        };
      });

      items.sort((a, b) => {
        const tA = formatTimestamp(a.createdAt || a.timestamp).rawIso;
        const tB = formatTimestamp(b.createdAt || b.timestamp).rawIso;
        return tB.localeCompare(tA);
      });

      setLogs(items);
    } catch (err: unknown) {
      console.error('Error fetching activity log:', err);
      const firebaseError = err as { code?: string };
      if (firebaseError?.code === 'permission-denied') {
        setError('هذا السجل متاح للمالك فقط');
      } else {
        setError(err instanceof Error ? err.message : 'فشل تحميل سجل النشاطات.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 0);
    return () => clearTimeout(timer);
  }, [fetchLogs]);

  const getPerformerDisplay = React.useCallback((item: AuditLogItem): string => {
    if (item.customerProvidedName) return item.customerProvidedName;
    if (item.actorEmail) return item.actorEmail;
    if (item.user && !item.user.includes('مستخدم غير معروف')) return item.user;
    if (item.performedBy) return item.performedBy;
    if (item.userId) return `مستخدم (${item.userId.slice(0, 8)}...)`;
    return 'مشرف نظام سحابي';
  }, []);

  const getDetailsDisplay = React.useCallback((item: AuditLogItem): string => {
    if (!item.details) return 'لا توجد تفاصيل إضافية مسجلة.';
    if (typeof item.details === 'string') return item.details;
    try {
      return JSON.stringify(item.details, null, 2);
    } catch {
      return String(item.details);
    }
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const act = l.action.toLowerCase();
      const perf = getPerformerDisplay(l).toLowerCase();
      const ent = (l.entity || '').toLowerCase();
      const entId = (l.entityId || '').toLowerCase();
      const det = getDetailsDisplay(l).toLowerCase();
      const targetUsr = (l.targetUserEmail || l.targetUser || '').toLowerCase();
      return act.includes(q) || perf.includes(q) || ent.includes(q) || entId.includes(q) || det.includes(q) || targetUsr.includes(q);
    }
    return true;
  });

  const uniqueActions: string[] = logs
    .map((l) => l.action)
    .filter((act, idx, arr): act is string => Boolean(act) && arr.indexOf(act) === idx);

  return (
    <div className="space-y-6 text-sm">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">{ADMIN_TAB_LABEL.activity_log}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  للمدير العام فقط
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                سجل إلكتروني غير قابل للتعديل يوثق جميع العمليات الإدارية الحساسة وتغييرات الصلاحيات وحالات الحجوزات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={isRefreshing || isLoading}
              className="min-h-11 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isRefreshing ? 'جاري التحديث...' : 'تحديث السجل'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filter */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between shadow-lg">
        <div className="w-full sm:w-80">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="بحث بالإجراء، المنفذ، التفاصيل، المعرف..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 min-w-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="min-h-11 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-base sm:text-sm focus:border-amber-500 outline-none transition-all cursor-pointer max-w-full"
              aria-label="تصفية حسب نوع الإجراء"
            >
              <option value="all">جميع أنواع الإجراءات ({logs.length})</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {ACTION_LABELS_AR[act]?.label || act}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-400 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono">
            المعروض: <strong className="text-white">{filteredLogs.length}</strong> / {logs.length}
          </span>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex flex-wrap items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-bold block mb-0.5">تعذر استعراض سجل النشاطات</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchLogs(true)}
            className="min-h-11 px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold text-sm cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Logs Table / List */}
      {isLoading ? (
        <div className="py-20 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-300">جاري تحميل آخر 100 سجل نشاط من قاعدة البيانات السحابية...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-2">
          <Activity className="w-12 h-12 text-slate-400 mx-auto mb-2" />
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
            let actionConfig = ACTION_LABELS_AR[item.action];
            
            if (!actionConfig) {
              if (item.action.startsWith('SUSPICIOUS_')) {
                actionConfig = {
                  label: `نشاط مشبوه: ${item.action.replace('SUSPICIOUS_', '').replace(/_/g, ' ')}`,
                  color: 'rose'
                };
              } else {
                actionConfig = {
                  label: item.action.replace(/_/g, ' '),
                  color: 'slate',
                };
              }
            }
            const performer = getPerformerDisplay(item);
            const detailsText = getDetailsDisplay(item);
            const isExpanded = expandedLogId === item.id;

            const badgeStyles = {
              emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
              amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
              rose: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
              blue: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
              indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
              slate: 'bg-slate-800 text-slate-300 border-slate-700',
            }[actionConfig.color];

            return (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all text-sm space-y-3 shadow-sm"
              >
                {/* Header row: Action & Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${badgeStyles}`}>
                      <Activity className="w-3.5 h-3.5" />
                      <span>{actionConfig.label}</span>
                    </span>

                    <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {item.action}
                    </span>

                    {item.entity && (
                      <span className="text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                        {item.entity}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-mono text-slate-300">{timeInfo.display}</span>
                    {timeInfo.timeAgo && (
                      <span className="text-slate-400 text-xs">({timeInfo.timeAgo})</span>
                    )}
                  </div>
                </div>

                {/* Performer & Core metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs text-slate-400 block">المنفذ:</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-white truncate" title={performer}>
                          {performer}
                        </span>
                        <RoleBadge role={item.actorRole} size="xs" />
                      </div>
                    </div>
                  </div>

                  {(item.targetUser || item.targetUserEmail) && (
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs text-slate-400 block">المستخدم المستهدف:</span>
                        <span className="font-semibold text-amber-300 truncate block">
                          {item.targetUserEmail || item.targetUser}
                        </span>
                      </div>
                    </div>
                  )}

                  {item.entityId && (
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs text-slate-400 block">المعرف (Entity ID):</span>
                        <span className="font-mono text-amber-300 text-xs truncate block" title={item.entityId}>
                          {item.entityId}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Details snippet / toggle */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-3 pt-1">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-400 block mb-0.5 font-bold">التفاصيل والبيانات:</span>
                    <p className={`text-slate-300 text-xs font-mono bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 break-words whitespace-pre-wrap ${!isExpanded ? 'line-clamp-2' : ''}`}>
                      {detailsText}
                    </p>
                  </div>

                  {detailsText.length > 80 && (
                    <button
                      type="button"
                      onClick={() => setExpandedLogId(isExpanded ? null : item.id)}
                      className="min-h-11 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-sm font-bold shrink-0 transition-colors sm:mt-4 cursor-pointer self-start"
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
