import React, { useState, useEffect, useMemo } from 'react';
import { FirestoreUser, VerificationRequest } from '../types';
import { dataService } from '../services/dataService';
import { functionsService } from '../services/functionsService';
import { SearchInput } from './common/SearchInput';
import { ADMIN_TAB_LABEL } from '../constants/adminNav';
import { useAuth } from '../contexts/AuthContext';
import { isStaffRole } from '../utils/roles';
import { RoleBadge } from './common/RoleBadge';
import { getVerificationState, VerificationAccountState } from '../utils/verification';
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  X,
  Lock,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface AdminUsersFilesViewProps {
  onBackToOverview?: () => void;
}

export const AdminUsersFilesView: React.FC<AdminUsersFilesViewProps> = ({ onBackToOverview }) => {
  const { user, isSuperAdmin, isAdmin } = useAuth();

  // Active view: verification queue or all accounts
  const [subTab, setSubTab] = useState<'verification_queue' | 'all_users'>('verification_queue');

  // Verification Requests State
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestFilter, setRequestFilter] = useState<'pending_review' | 'verified' | 'rejected' | 'all'>('pending_review');
  const [searchQuery, setSearchQuery] = useState('');

  // Users State
  const [users, setUsers] = useState<FirestoreUser[]>(() => dataService.getCachedUsers());
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | VerificationAccountState>('all');

  // Secure Document Viewer State (60s signed URL + watermark)
  const [viewingDoc, setViewingDoc] = useState<{
    targetUid: string;
    docKey: 'driver_license' | 'identity';
    docLabel: string;
    url: string | null;
    expiresAt?: string;
    isLoading: boolean;
    error?: string | null;
  } | null>(null);

  // Review Actions State
  const [decisionAction, setDecisionAction] = useState<{
    targetUid: string;
    action: 'approve' | 'reject' | 'revoke';
    userName?: string;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Real-time subscription to verification requests
  useEffect(() => {
    if (!isAdmin && !isSuperAdmin) return;
    const unsubscribe = dataService.subscribeToAllVerificationRequests((reqs) => {
      setVerificationRequests(reqs);
      setIsLoadingRequests(false);
    });
    return () => unsubscribe();
  }, [isAdmin, isSuperAdmin]);

  const usersById = useMemo(() => {
    const map = new Map<string, FirestoreUser>();
    for (const u of users) {
      if (u.uid) map.set(u.uid, u);
      if (u.id) map.set(u.id, u);
    }
    return map;
  }, [users]);

  // Verification requests belong strictly to customers (exclude staff or archived docs)
  const customerVerificationRequests = useMemo(() => {
    return verificationRequests.filter((r) => {
      if ((r as VerificationRequest & { archived?: boolean }).archived === true) return false;
      const target = usersById.get(r.userId);
      if (target && isStaffRole(target.role)) return false;
      return true;
    });
  }, [verificationRequests, usersById]);

  const pendingCount = customerVerificationRequests.filter((r) => r.status === 'pending_review').length;
 
  // Load all users on component mount (used in both verification queue and verification status table)
  const loadUsers = React.useCallback(async (forceRefresh = false) => {
    setIsLoadingUsers(true);
    try {
      const fetched = await dataService.getAllUsers(forceRefresh);
      setUsers(fetched);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin && !isSuperAdmin) return;
    let active = true;
    queueMicrotask(() => {
      if (active) loadUsers();
    });
    return () => {
      active = false;
    };
  }, [isAdmin, isSuperAdmin, loadUsers]);

  // Open secure 60s signed document viewer
  const handleInspectDocument = React.useCallback(async (targetUid: string, docKey: 'driver_license' | 'identity', docLabel: string) => {
    setViewingDoc({
      targetUid,
      docKey,
      docLabel,
      url: null,
      isLoading: true,
      error: null,
    });

    try {
      const res = await functionsService.getVerificationDocumentUrl({ targetUid, docKey });
      if (!res.success || !res.data?.url) {
        throw new Error(res.error || 'تعذر استخراج رابط المعاينة الآمن.');
      }
      setViewingDoc({
        targetUid,
        docKey,
        docLabel,
        url: res.data.url,
        expiresAt: res.data.expiresAt,
        isLoading: false,
      });
    } catch (err: unknown) {
      console.error('Error fetching document url:', err);
      setViewingDoc({
        targetUid,
        docKey,
        docLabel,
        url: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'تعذر تحميل الوثيقة.',
      });
    }
  }, []);

  // Submit review decision (Approve, Reject, Revoke)
  const handleConfirmDecision = React.useCallback(async () => {
    if (!decisionAction) return;
    const { targetUid, action } = decisionAction;

    if ((action === 'reject' || action === 'revoke') && !actionReason.trim()) {
      setActionFeedback({ type: 'error', message: 'يرجى كتابة سبب الإجراء، فهو إلزامي لإعلام المستخدم وحفظه في سجل التدقيق.' });
      return;
    }

    setIsSubmittingDecision(true);
    setActionFeedback(null);

    try {
      if (action === 'approve') {
        const res = await functionsService.reviewVerification({
          targetUid,
          decision: 'approve',
        });
        if (!res.success) throw new Error(res.error || 'فشل اعتماد التوثيق.');
        setActionFeedback({ type: 'success', message: 'تم اعتماد وتوثيق الحساب بنجاح، ونُقلت الوثائق إلى الخزنة المشفرة.' });
      } else if (action === 'reject') {
        const res = await functionsService.reviewVerification({
          targetUid,
          decision: 'reject',
          reason: actionReason.trim(),
        });
        if (!res.success) throw new Error(res.error || 'فشل رفض التوثيق.');
        setActionFeedback({ type: 'success', message: 'تم رفض طلب التوثيق وحذف الوثائق المؤقتة وتسجيل السبب.' });
      } else if (action === 'revoke') {
        const res = await functionsService.revokeVerification({
          targetUid,
          reason: actionReason.trim(),
        });
        if (!res.success) throw new Error(res.error || 'فشل إلغاء التوثيق.');
        setActionFeedback({ type: 'success', message: 'تم إلغاء توثيق الحساب وتسجيل السبب في سجل التدقيق.' });
      }

      setDecisionAction(null);
      setActionReason('');
    } catch (err: unknown) {
      console.error('Review decision error:', err);
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء.',
      });
    } finally {
      setIsSubmittingDecision(false);
    }
  }, [decisionAction, actionReason]);

  // Filter verification requests (customers only)
  const filteredRequests = useMemo(() => {
    return customerVerificationRequests.filter((r) => {
      if (requestFilter !== 'all' && r.status !== requestFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchUid = r.userId.toLowerCase().includes(q);
        const matchUser = usersById.get(r.userId);
        const matchName = matchUser?.displayName?.toLowerCase().includes(q);
        const matchEmail = matchUser?.email?.toLowerCase().includes(q);
        const matchPhone = matchUser?.phone?.includes(q);
        return matchUid || matchName || matchEmail || matchPhone;
      }
      return true;
    });
  }, [customerVerificationRequests, requestFilter, searchQuery, usersById]);

  const verificationRequestsMap = useMemo(() => {
    const map = new Map<string, VerificationRequest>();
    for (const req of customerVerificationRequests) {
      if (req.userId) {
        map.set(req.userId, req);
      }
    }
    return map;
  }, [customerVerificationRequests]);

  const customerUsers = useMemo(
    () => users.filter((u) => !isStaffRole(u.role)),
    [users]
  );

  // Verification counts computed strictly across customer accounts
  const userStateCounts = useMemo(() => {
    const counts = {
      all: customerUsers.length,
      verified: 0,
      pending_review: 0,
      rejected: 0,
      unverified: 0,
    };
    for (const u of customerUsers) {
      const req = verificationRequestsMap.get(u.uid) ?? (u.id ? verificationRequestsMap.get(u.id) : undefined);
      const state = getVerificationState(u, req);
      counts[state] += 1;
    }
    return counts;
  }, [customerUsers, verificationRequestsMap]);

  // Filter and sort users: 'all' keeps staff visible (with RoleBadge); verification filters match customers only
  const filteredUsers = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    const toTimestamp = (value?: string) => {
      if (!value) return 0;
      const ms = new Date(value).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };

    return users
      .filter((u) => {
        if (userStatusFilter !== 'all') {
          if (isStaffRole(u.role)) return false;
          const req = verificationRequestsMap.get(u.uid) ?? (u.id ? verificationRequestsMap.get(u.id) : undefined);
          const state = getVerificationState(u, req);
          if (state !== userStatusFilter) {
            return false;
          }
        }
        if (trimmedQuery) {
          return (
            u.displayName?.toLowerCase().includes(trimmedQuery) ||
            u.email?.toLowerCase().includes(trimmedQuery) ||
            u.phone?.toLowerCase().includes(trimmedQuery) ||
            u.uid?.toLowerCase().includes(trimmedQuery)
          );
        }
        return true;
      })
      .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt));
  }, [users, verificationRequestsMap, userStatusFilter, searchQuery]);

  // Access guard: ordinary employees cannot access verification documents
  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-slate-900 border border-rose-500/30 rounded-3xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-extrabold text-white">صلاحية المشرف مطلوبة</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          يتطلب الوصول إلى وثائق الهوية وتوثيق الحسابات صلاحية مدير النظام أو المدير العام لضمان حماية وسرية البيانات الشخصية.
        </p>
        {onBackToOverview && (
          <button
            type="button"
            onClick={onBackToOverview}
            className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
          >
            العودة
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100" dir="rtl">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-white">{ADMIN_TAB_LABEL.firestore_users}</h1>
              {pendingCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500 text-slate-950 animate-pulse">
                  {pendingCount} بانتظار المراجعة
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة طلبات توثيق الهوية، فحص رخص القيادة، وضبط صلاحيات المستخدمين بأمان وخوادم موثوقة.
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('verification_queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              subTab === 'verification_queue'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>طلبات التوثيق</span>
            {pendingCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-xs font-extrabold ${
                subTab === 'verification_queue' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'
              }`}>
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubTab('all_users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              subTab === 'all_users'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>حالة توثيق الحسابات ({users.length})</span>
          </button>
        </div>
      </div>

      {/* Global feedback banner */}
      {actionFeedback && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="p-1 rounded-lg hover:bg-white/10 min-h-10 min-w-10 inline-flex items-center justify-center cursor-pointer text-slate-300 hover:text-white"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB-TAB 1: VERIFICATION REQUESTS QUEUE */}
      {subTab === 'verification_queue' && (
        <div className="space-y-4">
          {/* Controls: Filter buttons + Search bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
              {[
                { key: 'pending_review' as const, label: 'قيد المراجعة', count: pendingCount },
                { key: 'verified' as const, label: 'موثق', count: customerVerificationRequests.filter((r) => r.status === 'verified').length },
                { key: 'rejected' as const, label: 'مرفوض', count: customerVerificationRequests.filter((r) => r.status === 'rejected').length },
                { key: 'all' as const, label: 'الكل', count: customerVerificationRequests.length },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setRequestFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    requestFilter === f.key
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="text-xs opacity-75 font-mono">({f.count})</span>
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="min-w-[240px]">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="ابحث بالاسم، البريد أو المعرف..."
              />
            </div>
          </div>

          {/* Queue List */}
          {isLoadingRequests ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
              <span>جاري تحميل طلبات التوثيق...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-16 text-center bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
              <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-white mb-1">لا توجد طلبات توثيق مطابقة</h4>
              <p className="text-xs text-slate-400">
                {requestFilter === 'pending_review'
                  ? 'رائع! لا توجد طلبات معلقة بانتظار المراجعة حالياً.'
                  : 'لم يتم العثور على أي نتائج وفق معايير البحث المحددة.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredRequests.map((req) => {
                const targetUser = users.find((u) => u.uid === req.userId || u.id === req.userId);
                const isPending = req.status === 'pending_review';
                const isVerified = req.status === 'verified';
                const isRejected = req.status === 'rejected';

                return (
                  <div
                    key={req.userId}
                    className={`p-5 rounded-3xl border transition-all space-y-4 ${
                      isPending
                        ? 'bg-slate-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5'
                        : isVerified
                        ? 'bg-slate-900/70 border-emerald-500/30'
                        : 'bg-slate-900/50 border-rose-500/20'
                    }`}
                  >
                    {/* User Info Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                          {targetUser?.displayName?.charAt(0) || <User className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">
                              {targetUser?.displayName || 'مستخدم غير معروف'}
                            </span>
                            <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                              {req.userId.substring(0, 10)}...
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                            <span className="font-mono">{targetUser?.email || 'لا يوجد بريد'}</span>
                            {targetUser?.phone && <span className="font-mono">📱 {targetUser.phone}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {isPending && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>بانتظار المراجعة الإدارية</span>
                          </span>
                        )}
                        {isVerified && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>موثق ومعتمد</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            <span>مرفوض التوثيق</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Quality Check */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Slot 1: Driver License */}
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>وثيقة القيادة (الوجه الأمامي)</span>
                          </span>
                          {req.docs?.driver_license ? (
                            <button
                              type="button"
                              onClick={() => handleInspectDocument(req.userId, 'driver_license', 'وثيقة القيادة')}
                              className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold transition flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>معاينة آمنة</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">غير متوفرة</span>
                          )}
                        </div>

                        {req.docs?.driver_license && (
                          <div className="text-xs text-slate-400 flex flex-wrap gap-2 pt-1 border-t border-slate-800/80">
                            {req.docs.driver_license.quality ? (
                              <>
                                <span>الدقة: {req.docs.driver_license.quality.width}×{req.docs.driver_license.quality.height}</span>
                                <span>حدة المعالم: {req.docs.driver_license.quality.blurScore}</span>
                              </>
                            ) : (
                              <span>وثيقة معتمدة</span>
                            )}
                            <span>الحجم: {Math.round(req.docs.driver_license.sizeBytes / 1024)}KB</span>
                          </div>
                        )}
                      </div>

                      {/* Slot 2: Identity Doc */}
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              {req.identityDocType === 'passport' ? 'وثيقة السفر' : 'الهوية الشخصية'}
                            </span>
                          </span>
                          {req.docs?.identity ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleInspectDocument(
                                  req.userId,
                                  'identity',
                                  req.identityDocType === 'passport' ? 'وثيقة السفر' : 'الهوية الشخصية'
                                )
                              }
                              className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-xs font-bold transition flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>معاينة آمنة</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">غير متوفرة</span>
                          )}
                        </div>

                        {req.docs?.identity && (
                          <div className="text-xs text-slate-400 flex flex-wrap gap-2 pt-1 border-t border-slate-800/80">
                            {req.docs.identity.quality ? (
                              <>
                                <span>الدقة: {req.docs.identity.quality.width}×{req.docs.identity.quality.height}</span>
                                <span>حدة المعالم: {req.docs.identity.quality.blurScore}</span>
                              </>
                            ) : (
                              <span>وثيقة معتمدة</span>
                            )}
                            <span>الحجم: {Math.round(req.docs.identity.sizeBytes / 1024)}KB</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rejection reason notice if rejected */}
                    {isRejected && req.rejectionReason && (
                      <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300">
                        <span className="font-bold block mb-0.5">سبب الرفض:</span>
                        <span>{req.rejectionReason}</span>
                      </div>
                    )}

                    {/* Admin Action Decision Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                      <div className="text-xs text-slate-400 font-mono">
                        تاريخ التقديم: {req.submittedAt ? new Date(req.submittedAt).toLocaleString('ar-SY-u-nu-latn') : '—'}
                        {req.attempt ? ` • المحاولة رقم ${req.attempt}` : ''}
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setDecisionAction({
                                  targetUid: req.userId,
                                  action: 'approve',
                                  userName: targetUser?.displayName,
                                });
                                setActionReason('');
                              }}
                              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>اعتماد التوثيق</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setDecisionAction({
                                  targetUid: req.userId,
                                  action: 'reject',
                                  userName: targetUser?.displayName,
                                });
                                setActionReason('');
                              }}
                              className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <X className="w-4 h-4" />
                              <span>رفض مع تحديد السبب</span>
                            </button>
                          </>
                        )}

                        {isVerified && (
                          <button
                            type="button"
                            onClick={() => {
                              setDecisionAction({
                                targetUid: req.userId,
                                action: 'revoke',
                                userName: targetUser?.displayName,
                              });
                              setActionReason('');
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>إلغاء التوثيق</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: READ-ONLY ACCOUNT VERIFICATION STATUS */}
      {subTab === 'all_users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>حالة توثيق الحسابات ({filteredUsers.length})</span>
            </h3>

            <div className="min-w-[260px]">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="ابحث بالاسم، البريد، الهاتف أو المعرف..."
              />
            </div>
          </div>

          {/* Read-only Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl w-fit max-w-full">
            {[
              { key: 'all' as const, label: 'الكل', count: userStateCounts.all },
              { key: 'verified' as const, label: 'موثق', count: userStateCounts.verified },
              { key: 'pending_review' as const, label: 'قيد المراجعة', count: userStateCounts.pending_review },
              { key: 'rejected' as const, label: 'مرفوض', count: userStateCounts.rejected },
              { key: 'unverified' as const, label: 'غير موثق', count: userStateCounts.unverified },
            ].map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setUserStatusFilter(chip.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  userStatusFilter === chip.key
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{chip.label}</span>
                <span className="text-xs opacity-75 font-mono">({chip.count})</span>
              </button>
            ))}
          </div>

          {isLoadingUsers ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
              <span>جاري تحميل المستخدمين...</span>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-bold">
                    <tr>
                      <th className="p-3.5">المستخدم</th>
                      <th className="p-3.5">البريد والهاتف</th>
                      <th className="p-3.5">حالة التوثيق</th>
                      <th className="p-3.5">تاريخ التسجيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-xs text-slate-400">
                          لا توجد حسابات مطابقة لمعايير التصفية أو البحث.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isStaff = isStaffRole(u.role);
                        const req = !isStaff
                          ? (verificationRequestsMap.get(u.uid) ?? (u.id ? verificationRequestsMap.get(u.id) : undefined))
                          : undefined;
                        const verificationState = getVerificationState(u, req);

                        return (
                          <tr key={u.id || u.uid} className="hover:bg-slate-800/40 transition">
                            <td className="p-3.5">
                              <div className="font-bold text-white">{u.displayName || 'مستخدم'}</div>
                              <div className="mt-0.5 empty:hidden">
                                <RoleBadge role={u.role} size="xs" />
                              </div>
                              <div className="text-xs text-slate-400 font-mono mt-0.5">{u.uid}</div>
                            </td>
                            <td className="p-3.5">
                              <div className="font-mono text-slate-300">{u.email}</div>
                              <div className="font-mono text-xs text-slate-400">{u.phone || '—'}</div>
                            </td>
                            <td className="p-3.5">
                              {isStaff ? (
                                <RoleBadge role={u.role} />
                              ) : verificationState === 'verified' ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  موثق
                                </span>
                              ) : verificationState === 'pending_review' ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  قيد المراجعة
                                </span>
                              ) : verificationState === 'rejected' ? (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  مرفوض
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                  غير موثق
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 font-mono text-slate-400 text-xs">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-SY-u-nu-latn') : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: SECURE 60-SECOND DOCUMENT VIEWER WITH WATERMARK */}
      {viewingDoc && (
        <div
          className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92dvh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-extrabold text-white">معاينة آمنة: {viewingDoc.docLabel}</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-mono">
                  رابط مشفر لمدة 60 ثانية
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer min-h-10 min-w-10 inline-flex items-center justify-center"
                aria-label="إغلاق المعاينة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Image with Watermark */}
            <div className="relative flex-1 bg-black min-h-[350px] flex items-center justify-center overflow-hidden select-none">
              {viewingDoc.isLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
                  <span>جاري توليد الرابط الآمن...</span>
                </div>
              ) : viewingDoc.error ? (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{viewingDoc.error}</span>
                </div>
              ) : viewingDoc.url ? (
                <>
                  <img
                    src={viewingDoc.url}
                    alt={viewingDoc.docLabel}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain pointer-events-none"
                    onContextMenu={(e) => e.preventDefault()}
                  />

                  {/* DYNAMIC SECURITY WATERMARK OVERLAY */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-around items-center p-4 rotate-[-25deg] opacity-25 select-none overflow-hidden">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="text-center font-mono font-extrabold text-amber-200 text-xs sm:text-sm tracking-wider">
                        <div>🔒 سري - شاكر لتأجير السيارات</div>
                        <div>المدقق: {user?.email} • المستخدم: {viewingDoc.targetUid.substring(0, 8)}</div>
                        <div>{new Date().toLocaleString('ar-SY-u-nu-latn')}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span><AlertTriangle className="w-4 h-4 inline" /> يُمنع نسخ أو إعادة مشاركة وثائق الهوية خارج نطاق التدقيق.</span>
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMATION / REASON PROMPT (Approve / Reject / Revoke) */}
      {decisionAction && (
        <div
          className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                decisionAction.action === 'approve'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {decisionAction.action === 'approve' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white">
                  {decisionAction.action === 'approve'
                    ? 'اعتماد توثيق الحساب'
                    : decisionAction.action === 'reject'
                    ? 'رفض طلب التوثيق'
                    : 'إلغاء توثيق الحساب'}
                </h4>
                <p className="text-xs text-slate-400">{decisionAction.userName || decisionAction.targetUid}</p>
              </div>
            </div>

            {decisionAction.action === 'approve' ? (
              <p className="text-xs text-slate-300 leading-relaxed">
                سيتم نقل وثائق الهوية والقيادة إلى الخزنة المشفرة واعتماد الحساب رسمياً لتمكين العميل من حجز واستلام السيارات مباشرة.
              </p>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  سبب {decisionAction.action === 'reject' ? 'الرفض' : 'إلغاء التوثيق'} (إلزامي للعميل وسجل التدقيق) *
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="مثال: صورة وثيقة القيادة غير واضحة، انتهاء صلاحية الهوية، عدم تطابق الاسم..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
                  required
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDecisionAction(null)}
                disabled={isSubmittingDecision}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDecision}
                disabled={isSubmittingDecision}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-md ${
                  decisionAction.action === 'approve'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                }`}
              >
                {isSubmittingDecision ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التنفيذ...</span>
                  </>
                ) : (
                  <span>تأكيد الإجراء</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
