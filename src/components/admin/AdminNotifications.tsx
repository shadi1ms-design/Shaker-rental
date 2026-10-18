import React, { useState } from 'react';
import { AppNotification } from '../../types';
import { dataService } from '../../services/dataService';
import {
  Bell,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Info,
  Clock,
  Trash2,
  CheckCheck,
  Check,
  Filter
} from 'lucide-react';

interface AdminNotificationsProps {
  notifications: AppNotification[];
  onRefresh?: () => void;
}

export const AdminNotifications: React.FC<AdminNotificationsProps> = ({
  notifications,
  onRefresh,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'booking' | 'system' | 'maintenance'>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      dataService.markNotificationAsRead(id);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setIsProcessing(true);
      dataService.markAllNotificationsAsRead();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      dataService.deleteNotification(id);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'booking') {
      return (
        n.type === 'new_booking' ||
        n.type === 'booking_confirmed' ||
        n.type === 'booking_cancelled' ||
        n.type === 'upcoming_rental' ||
        n.type === 'rental_return'
      );
    }
    if (filter === 'maintenance') {
      return n.type === 'oil_change_reminder' || n.type === 'maintenance_reminder';
    }
    if (filter === 'system') {
      return n.type === 'payment_due' || (!n.type.includes('booking') && !n.type.includes('reminder'));
    }
    return true;
  });

  const getNotificationIcon = (type?: string) => {
    if (type?.includes('booking') || type === 'upcoming_rental' || type === 'rental_return') {
      return <Calendar className="w-4 h-4 text-amber-400" />;
    }
    if (type === 'oil_change_reminder' || type === 'maintenance_reminder') {
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
    return <Bell className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              <span>مركز التنبيهات والإشعارات</span>
            </h3>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950">
                {unreadCount} غير مقروء
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            سجل إشعارات الحجوزات الجديدة، تحديثات الحالات، وتنبيهات الصيانة الدورية
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={isProcessing}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4 text-emerald-400" />
              <span>تعليم الكل كمقروء</span>
            </button>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'unread', label: `غير المقروء (${unreadCount})` },
              { id: 'booking', label: 'الحجوزات' },
              { id: 'maintenance', label: 'الصيانة' },
              { id: 'system', label: 'النظام' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  filter === f.id
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto" />
            <p className="font-bold text-sm text-slate-300">لا توجد تنبيهات في هذا القسم</p>
            <p className="text-slate-500 text-[11px]">كافة العمليات والإشعارات تمت مراجعتها بنجاح</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filtered.map((n) => {
              const isUnread = !n.read;
              return (
                <div
                  key={n.id}
                  className={`p-5 flex items-start gap-4 transition-colors ${
                    isUnread ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                      {getNotificationIcon(n.type)}
                    </div>
                    {isUnread && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-900 absolute -top-0.5 -right-0.5" />
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-xs font-bold ${isUnread ? 'text-amber-300 font-black' : 'text-white'}`}>
                          {n.title}
                        </h4>
                        {isUnread && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            جديد
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(n.createdAt).toLocaleString('ar-SY')}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>

                    {/* Actions Row */}
                    <div className="flex items-center gap-3 pt-1">
                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(n.id)}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>تعليم كمقروء</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(n.id)}
                        className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer mr-auto"
                        title="حذف التنبيه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
