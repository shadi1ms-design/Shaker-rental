import React from 'react';
import { Crown, ShieldCheck, UserCheck } from 'lucide-react';
import { NormalizedUserRole, normalizeRoleName } from '../../utils/roles';
import { getProfileRoleLabels } from '../../utils/profileRole';

export interface RoleBadgeProps {
  role?: unknown;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

type StaffRole = Exclude<NormalizedUserRole, 'customer'>;

const STAFF_ROLE_STYLE: Record<
  StaffRole,
  {
    icon: React.ComponentType<{ className?: string }>;
    badgeClass: string;
  }
> = {
  super_admin: {
    icon: Crown,
    badgeClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
  },
  admin: {
    icon: ShieldCheck,
    badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  },
  employee: {
    icon: UserCheck,
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
  },
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  size = 'sm',
  className = '',
}) => {
  const normalizedRole = normalizeRoleName(role);
  if (normalizedRole === 'customer') {
    return null;
  }

  const { badge: label } = getProfileRoleLabels(normalizedRole);
  const { icon: Icon, badgeClass } = STAFF_ROLE_STYLE[normalizedRole];

  const sizeClass =
    size === 'xs'
      ? 'px-2 py-0.5 text-xs gap-1'
      : size === 'md'
      ? 'px-3 py-1 text-xs gap-1.5'
      : 'px-2.5 py-0.5 text-xs gap-1';

  const iconClass =
    size === 'xs' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold select-none shrink-0 ${badgeClass} ${sizeClass} ${className}`.trim()}
    >
      <Icon className={`${iconClass} shrink-0`} />
      <span>{label}</span>
    </span>
  );
};
