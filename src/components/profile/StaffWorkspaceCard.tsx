import React from 'react';
import { Shield } from 'lucide-react';
import { ProfileRole } from '../../utils/profileRole';

export interface StaffWorkspaceCardProps {
  role: Exclude<ProfileRole, 'customer'>;
  accountTypeLabel: string;
  isEmployee: boolean;
  onOpenAdminView?: () => void;
}

const ROLE_DESCRIPTIONS: Record<Exclude<ProfileRole, 'customer'>, string> = {
  employee: 'إدارة الحجوزات اليومية وتحديث حالتها وفق صلاحيات الموظفين.',
  admin: 'إدارة الحجوزات والأسطول والإعدادات وتوثيق الحسابات.',
  super_admin: 'كل صلاحيات الأدمن مع إدارة فريق العمل والصلاحيات وحذف الحسابات.',
};

export const StaffWorkspaceCard: React.FC<StaffWorkspaceCardProps> = ({
  role,
  accountTypeLabel,
  isEmployee,
  onOpenAdminView,
}) => {
  return (
    <div className="p-4 rounded-card bg-slate-950/80 border border-amber-500/25 space-y-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-extrabold text-white text-sm">{accountTypeLabel}</span>
          </div>
          <p className="text-slate-400 leading-relaxed">{ROLE_DESCRIPTIONS[role]}</p>
        </div>

        {isEmployee && onOpenAdminView && (
          <button
            type="button"
            onClick={onOpenAdminView}
            className="px-4 py-2 min-h-11 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 shrink-0"
          >
            <Shield className="w-4 h-4" />
            <span>فتح لوحة التحكم</span>
          </button>
        )}
      </div>
    </div>
  );
};
