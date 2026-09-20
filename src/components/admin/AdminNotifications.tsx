import React, { useState } from 'react';
import { AppNotification } from '../../types';
import {
  Bell,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Info,
  Clock,
  Trash2
} from 'lucide-react';

interface AdminNotificationsProps {
  notifications: AppNotification[];
}

export const AdminNotifications: React.FC<AdminNotificationsProps> = ({
  notifications,
}) => {
  const [filter, setFilter] = useState<'all' | 'booking' | 'system' | 'maintenance'>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'booking') return n.type?.includes('booking') || n.title?.includes('حجز');
    if (filter === 'maintenance') return n.type?.includes('maintenance') || n.title?.includes('صيانة') || n.title?.includes('زيت');
    if (filter === 'system') return !n.title?.includes('حجز') && !n.title?.includes('صيانة');
    return true;
  });

  const getNotificationIcon = (type?: string, title?: string) => {
    if (title?.includes('حجز') || type?.includes('booking')) {
      return <Calendar className="w-4 h-4 text-amber-400" />;
    }
    if (title?.includes('صيانة') || title?.includes('زيت') || type?.includes('maintenance')) {
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
    return <Bell className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-400" />
            <span>مركز التنبيهات والإشعارات</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            سجل إشعارات الحجوزات الجديدة، تحديثات الحالات، وتنبيهات الصيانة الدورية
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'all', label: 'كافة التنبيهات' },
            { id: 'booking', label: 'الحجوزات' },
            { id: 'maintenance', label: 'الصيانة' },
            { id: 'system', label: 'النظام' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
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

      {/* Notifications List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto" />
            <p className="font-bold text-sm text-slate-300">لا توجد تنبيهات حالياً</p>
            <p className="text-slate-500 text-[11px]">كافة العمليات والإشعارات تمت مراجعتها</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filtered.map((n) => (
              <div
                key={n.id}
                className="p-5 flex items-start gap-4 hover:bg-slate-800/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  {getNotificationIcon(n.type, n.title)}
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">{n.title}</h4>
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(n.createdAt).toLocaleString('ar-SY')}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
