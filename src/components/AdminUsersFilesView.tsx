import React, { useState, useEffect } from 'react';
import { FirestoreUser, UploadedFile } from '../types';
import { dataService } from '../services/dataService';
import { ADMIN_USER_ID, useAuth } from '../contexts/AuthContext';
import {
  Users,
  FileText,
  Calendar,
  Mail,
  Shield,
  Search,
  RefreshCw,
  FolderOpen,
  Eye,
  Download,
  Upload,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  User,
  Plus,
  X,
  ExternalLink,
  Filter
} from 'lucide-react';

interface AdminUsersFilesViewProps {
  onBackToOverview?: () => void;
}

export const AdminUsersFilesView: React.FC<AdminUsersFilesViewProps> = ({
  onBackToOverview
}) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'with_files' | 'no_files'>('all');

  // Selected User Drill-down state
  const [selectedUser, setSelectedUser] = useState<FirestoreUser | null>(null);
  const [userFiles, setUserFiles] = useState<UploadedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // File Preview Modal
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);

  // Upload Modal for User
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileCategory, setUploadFileCategory] = useState<UploadedFile['category']>('driver_license');
  const [uploadFileUrl, setUploadFileUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Fetch users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await dataService.getAllUsers();
      setUsers(fetchedUsers);
      
      // If a user is already selected, update their data
      if (selectedUser) {
        const updated = fetchedUsers.find(u => u.id === selectedUser.id || u.uid === selectedUser.uid);
        if (updated) {
          setSelectedUser(updated);
          loadUserFiles(updated.id || updated.uid);
        }
      }
    } catch (err) {
      console.error('Error fetching Firestore users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = async (u: FirestoreUser) => {
    setSelectedUser(u);
    loadUserFiles(u.id || u.uid);
  };

  const loadUserFiles = async (userId: string) => {
    setIsLoadingFiles(true);
    try {
      const files = await dataService.getFilesForUser(userId);
      setUserFiles(files);
    } catch (err) {
      console.error(`Error fetching files for user ${userId}:`, err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleUploadFileForUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !uploadFileName.trim()) return;

    setIsUploading(true);
    try {
      const fallbackSampleUrls = {
        driver_license: 'https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?auto=format&fit=crop&w=800&q=80',
        national_id: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
        passport: 'https://images.unsplash.com/photo-1544717302-de2939b7ef71?auto=format&fit=crop&w=800&q=80',
        contract: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80',
        other: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
      };

      const finalUrl = uploadFileUrl.trim() || fallbackSampleUrls[uploadFileCategory] || fallbackSampleUrls.other;

      await dataService.uploadUserFile({
        userId: selectedUser.id || selectedUser.uid,
        userEmail: selectedUser.email,
        fileName: uploadFileName.trim(),
        fileUrl: finalUrl,
        fileType: finalUrl.includes('.pdf') ? 'application/pdf' : 'image/jpeg',
        fileSize: Math.floor(Math.random() * 1500000) + 500000,
        category: uploadFileCategory,
      });

      // Reload files & users
      await loadUserFiles(selectedUser.id || selectedUser.uid);
      await loadUsers();

      // Reset form
      setUploadFileName('');
      setUploadFileUrl('');
      setShowUploadModal(false);
    } catch (err) {
      console.error('Error uploading file for user:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'غير محدد';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-SY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'غير متوفر';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCategoryLabel = (category: UploadedFile['category']) => {
    switch (category) {
      case 'driver_license':
        return 'شهادة القيادة';
      case 'national_id':
        return 'الهوية الشخصية';
      case 'passport':
        return 'جواز السفر';
      case 'contract':
        return 'عقد إيجار / وثيقة رسمية';
      default:
        return 'مستند إضافي';
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.includes(searchTerm)) ||
      u.id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchSearch) return false;

    if (filterMode === 'with_files') return (u.uploadedFilesCount || 0) > 0;
    if (filterMode === 'no_files') return (u.uploadedFilesCount || 0) === 0;
    return true;
  });

  const totalFilesCount = users.reduce((acc, u) => acc + (u.uploadedFilesCount || 0), 0);
  const usersWithFilesCount = users.filter((u) => (u.uploadedFilesCount || 0) > 0).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300" id="admin-firestore-users-view">
      {/* Prominent Admin View Badge / Indicator */}
      <div className="bg-gradient-to-r from-amber-500/20 via-amber-600/10 to-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/30 flex-shrink-0">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="px-3 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 uppercase tracking-wide flex items-center gap-1 shadow-sm">
                  <Shield className="w-3 h-3" />
                  Admin View
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Firestore Full Access Granted
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                لوحة تحكم المشرف المعتمد (Admin Dashboard)
              </h1>
              <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>معرف المشرف المعتمد (Admin UID):</span>
                <code className="bg-slate-950/80 px-2.5 py-1 rounded-lg text-amber-300 font-mono text-[11px] border border-amber-500/30">
                  {ADMIN_USER_ID}
                </code>
                {user?.uid === ADMIN_USER_ID && (
                  <span className="text-emerald-400 font-bold text-[11px]">
                    ✓ الحساب الحالي موثق كمدير نظام
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
              id="refresh-firestore-users-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>تحديث البيانات</span>
            </button>
          </div>
        </div>

        {/* Security Rule Notice */}
        <div className="mt-4 pt-4 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>قواعد الأمان (Firestore Rules): يمتلك هذا الحساب صلاحية القراءة الشاملة لكافة بيانات المستخدمين والملفات المرفوعة.</span>
          </div>
          <span className="text-amber-400/80 font-medium">قاعدة البيانات: Cloud Firestore • collection('users')</span>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">إجمالي المستخدمين المسجلين</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-white font-mono">{users.length}</span>
              <span className="text-xs text-slate-400">مستخدم في Firestore</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">إجمالي الملفات والوثائق المرفوعة</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-cyan-400 font-mono">{totalFilesCount}</span>
              <span className="text-xs text-slate-400">ملف ومستند</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">مستخدمون أرفقوا وثائق</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-emerald-400 font-mono">{usersWithFilesCount}</span>
              <span className="text-xs text-slate-400">من أصل {users.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout or Drill-down View */}
      {selectedUser ? (
        /* ================= USER DRILL DOWN (SHOW USER'S UPLOADED FILES) ================= */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl animate-in fade-in">
          {/* Drill-down Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedUser(null)}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors border border-slate-700"
                title="العودة لقائمة المستخدمين"
                id="back-to-users-list-btn"
              >
                <ChevronLeft className="w-5 h-5 rotate-180" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-xl">
                {selectedUser.displayName.charAt(0) || <User className="w-6 h-6" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    ملفات المستخدم: {selectedUser.displayName}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 font-semibold">
                    {selectedUser.role === 'super_admin' ? 'المدير العام' : selectedUser.role === 'admin' ? 'إدارة' : 'عميل'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-amber-400" />
                    {selectedUser.email}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    تاريخ التسجيل: {formatDate(selectedUser.createdAt)}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    UID: {selectedUser.id}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
                id="upload-user-file-btn"
              >
                <Upload className="w-4 h-4" />
                <span>رفع وثيقة لهذا المستخدم</span>
              </button>
            </div>
          </div>

          {/* User's Uploaded Files Content */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>الملفات والوثائق المرفوعة ({userFiles.length})</span>
              </h3>
              <span className="text-xs text-slate-400">
                مخزنة في مسار: <code className="text-slate-300 bg-slate-950 px-2 py-0.5 rounded font-mono">/users/{selectedUser.id}/files</code>
              </span>
            </div>

            {isLoadingFiles ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">جاري تحميل وثائق المستخدم من Firestore...</p>
              </div>
            ) : userFiles.length === 0 ? (
              <div className="py-16 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80 space-y-3 p-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-300">لا توجد وثائق مرفوعة لهذا المستخدم بعد</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  لم يقم هذا المستخدم برفع أي ملفات بعد، أو يمكنك كمشرف رفع وثيقة جديدة لحسابه مباشرة.
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-slate-700 transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إرفاق وثيقة الآن</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 space-y-3 transition-all group flex flex-col justify-between"
                  >
                    <div>
                      {/* Category & Date Header */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {getCategoryLabel(file.category)}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(file.uploadedAt)}
                        </span>
                      </div>

                      {/* File Info */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 flex-shrink-0 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate" title={file.fileName}>
                            {file.fileName}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>{file.fileType || 'مستند'}</span>
                            <span>•</span>
                            <span>{formatFileSize(file.fileSize)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Thumbnail Preview if Image */}
                      {file.fileUrl && !file.fileUrl.includes('.pdf') && (
                        <div className="mt-3 rounded-xl overflow-hidden h-28 bg-slate-900 border border-slate-800 relative group/thumb cursor-pointer" onClick={() => setPreviewFile(file)}>
                          <img
                            src={file.fileUrl}
                            alt={file.fileName}
                            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold">
                            <Eye className="w-4 h-4" />
                            <span>معاينة</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>معاينة</span>
                      </button>

                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors border border-slate-700"
                        title="فتح الرابط المباشر"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= ALL USERS LIST VIEW ================= */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          {/* Header & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>سجل مستخدمي قاعدة بيانات Firestore</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono font-bold border border-slate-700">
                  {filteredUsers.length} مستخدم
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                انقر على أي مستخدم للاطلاع على ملفاته ووثائقه المرفوعة من خلال صلاحيات المشرف.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث بالبريد، الاسم، أو الهاتف..."
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter mode */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                    filterMode === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  الكل ({users.length})
                </button>
                <button
                  onClick={() => setFilterMode('with_files')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                    filterMode === 'with_files'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  لديهم ملفات ({usersWithFilesCount})
                </button>
                <button
                  onClick={() => setFilterMode('no_files')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                    filterMode === 'no_files'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  بدون ملفات ({users.length - usersWithFilesCount})
                </button>
              </div>
            </div>
          </div>

          {/* Users Table / List */}
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">جاري قراءة المستخدمين من Cloud Firestore...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center bg-slate-950/40 rounded-2xl border border-slate-800 space-y-2 p-6">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-300">لم يتم العثور على أي مستخدمين</h4>
              <p className="text-xs text-slate-500">جرب تغيير عبارة البحث أو الفلتر أعلاه.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">المستخدم</th>
                    <th className="py-3.5 px-4">البريد الإلكتروني</th>
                    <th className="py-3.5 px-4">تاريخ إنشاء الحساب</th>
                    <th className="py-3.5 px-4 text-center">عدد الملفات المرفوعة</th>
                    <th className="py-3.5 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {filteredUsers.map((u) => {
                    const isSelfAdmin = u.id === ADMIN_USER_ID || u.uid === ADMIN_USER_ID;
                    const fileCount = u.uploadedFilesCount || 0;

                    return (
                      <tr
                        key={u.id}
                        onClick={() => handleSelectUser(u)}
                        className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                      >
                        {/* User Name & Role */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-amber-400 flex items-center justify-center font-bold text-sm group-hover:bg-amber-500/20 group-hover:border-amber-500/40 transition-colors">
                              {u.displayName.charAt(0) || <User className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white group-hover:text-amber-300 transition-colors">
                                  {u.displayName}
                                </span>
                                {isSelfAdmin && (
                                  <span className="px-2 py-0.2 rounded text-[10px] font-black bg-amber-500 text-slate-950">
                                    Admin UID
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">
                                UID: {u.id.substring(0, 12)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* User Email */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Mail className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
                            <span className="font-mono text-[11px]">{u.email}</span>
                          </div>
                          {u.phone && (
                            <span className="text-[10px] text-slate-500 block mt-0.5" dir="ltr">
                              {u.phone}
                            </span>
                          )}
                        </td>

                        {/* Account Creation Date */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <span>{formatDate(u.createdAt)}</span>
                          </div>
                        </td>

                        {/* Uploaded Files Count */}
                        <td className="py-3.5 px-4 text-center">
                          {fileCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              <FileText className="w-3 h-3" />
                              <span>{fileCount} ملفات</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] text-slate-500 bg-slate-950 border border-slate-800">
                              لا توجد ملفات
                            </span>
                          )}
                        </td>

                        {/* Action Button */}
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleSelectUser(u)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-300 text-xs font-bold transition-all border border-slate-700 group-hover:border-amber-500 inline-flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض الملفات</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= PREVIEW MODAL ================= */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white">{previewFile.fileName}</h3>
                  <span className="text-xs text-slate-400">
                    {getCategoryLabel(previewFile.category)} • {formatFileSize(previewFile.fileSize)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 flex items-center justify-center">
              {previewFile.fileUrl && !previewFile.fileUrl.includes('.pdf') ? (
                <img
                  src={previewFile.fileUrl}
                  alt={previewFile.fileName}
                  className="max-h-[60vh] rounded-xl object-contain border border-slate-800 shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center p-8 bg-slate-950 rounded-2xl border border-slate-800 w-full space-y-4">
                  <FileText className="w-16 h-16 text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-300">مستند PDF رقمي جاهز للعرض والتحميل</p>
                  <a
                    href={previewFile.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md hover:bg-amber-400 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>فتح المستند في نافذة كاملة</span>
                  </a>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                تاريخ الرفع: {formatDate(previewFile.uploadedAt)}
              </span>
              <a
                href={previewFile.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>تحميل الملف</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ================= UPLOAD NEW FILE MODAL FOR USER ================= */}
      {showUploadModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  إرفاق وثيقة للمستخدم ({selectedUser.displayName})
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadFileForUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">اسم الوثيقة أو الملف *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شهادة القيادة الدولية - الوجه الأمامي"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">تصنيف الوثيقة *</label>
                <select
                  value={uploadFileCategory}
                  onChange={(e) => setUploadFileCategory(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="driver_license">شهادة القيادة (Driver License)</option>
                  <option value="national_id">الهوية الشخصية (National ID)</option>
                  <option value="passport">جواز السفر (Passport)</option>
                  <option value="contract">عقد إيجار / مخالصة (Rental Contract)</option>
                  <option value="other">مستند إضافي / سند إقامة (Other)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">رابط الملف المباشر (اختياري)</label>
                <input
                  type="url"
                  placeholder="اتركه فارغاً لاعتماد نموذج تجريبي افتراضي عالي الدقة"
                  value={uploadFileUrl}
                  onChange={(e) => setUploadFileUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-slate-300 text-[11px] leading-relaxed">
                سيتم حفظ هذا الملف ضمن سجل المستخدم <span className="text-amber-400 font-bold">{selectedUser.email}</span> في Firestore وتحديث عداد الملفات فوراً.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadFileName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الرفع...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حفظ الوثيقة في Firestore</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
