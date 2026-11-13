import { describe, it, expect } from 'vitest';
import {
  resolveProfileRole,
  getProfileRoleLabels,
  getProfileTabs,
  getCustomerDefaultTab,
} from '../src/utils/profileRole';

describe('Profile Role Resolution & Tabs (src/utils/profileRole.ts)', () => {
  it('resolveProfileRole handles all 4 roles and overlapping AuthContext flags with correct priority', () => {
    // Customer (all flags false)
    expect(
      resolveProfileRole({ isSuperAdmin: false, isAdmin: false, isEmployee: false })
    ).toBe('customer');

    // Employee only
    expect(
      resolveProfileRole({ isSuperAdmin: false, isAdmin: false, isEmployee: true })
    ).toBe('employee');

    // Admin (isEmployee is also true in AuthContext)
    expect(
      resolveProfileRole({ isSuperAdmin: false, isAdmin: true, isEmployee: true })
    ).toBe('admin');

    // Admin even if isEmployee flag is false
    expect(
      resolveProfileRole({ isSuperAdmin: false, isAdmin: true, isEmployee: false })
    ).toBe('admin');

    // Super Admin (both isAdmin and isEmployee are true in AuthContext)
    expect(
      resolveProfileRole({ isSuperAdmin: true, isAdmin: true, isEmployee: true })
    ).toBe('super_admin');

    // Super Admin takes precedence over admin/employee combinations
    expect(
      resolveProfileRole({ isSuperAdmin: true, isAdmin: true, isEmployee: false })
    ).toBe('super_admin');
    expect(
      resolveProfileRole({ isSuperAdmin: true, isAdmin: false, isEmployee: true })
    ).toBe('super_admin');
    expect(
      resolveProfileRole({ isSuperAdmin: true, isAdmin: false, isEmployee: false })
    ).toBe('super_admin');
  });

  it('getProfileRoleLabels returns exact Arabic badge and accountType labels for all 4 roles', () => {
    expect(getProfileRoleLabels('super_admin')).toEqual({
      badge: 'المدير العام',
      accountType: 'المدير العام',
    });
    expect(getProfileRoleLabels('admin')).toEqual({
      badge: 'مسؤول النظام',
      accountType: 'مدير التشغيل',
    });
    expect(getProfileRoleLabels('employee')).toEqual({
      badge: 'موظف',
      accountType: 'موظف تشغيل',
    });
    expect(getProfileRoleLabels('customer')).toEqual({
      badge: 'عميل شاكر',
      accountType: 'حساب عميل',
    });
  });

  it('getProfileTabs returns customer tabs for customer and strictly profile+security (never verification/bookings) for staff', () => {
    expect(getProfileTabs('customer')).toEqual({
      tabs: ['verification', 'bookings', 'profile'],
      defaultTab: 'verification',
    });

    for (const staffRole of ['employee', 'admin', 'super_admin'] as const) {
      const staffTabs = getProfileTabs(staffRole);
      expect(staffTabs).toEqual({
        tabs: ['profile', 'security'],
        defaultTab: 'profile',
      });
      expect(staffTabs.tabs).not.toContain('verification');
      expect(staffTabs.tabs).not.toContain('bookings');
    }
  });

  it('getCustomerDefaultTab returns "bookings" only when verified, and "verification" for all other statuses', () => {
    expect(getCustomerDefaultTab('verified')).toBe('bookings');
    expect(getCustomerDefaultTab('pending_review')).toBe('verification');
    expect(getCustomerDefaultTab('rejected')).toBe('verification');
    expect(getCustomerDefaultTab('not_started')).toBe('verification');
    expect(getCustomerDefaultTab(null)).toBe('verification');
    expect(getCustomerDefaultTab(undefined)).toBe('verification');
  });
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleBadge } from '../src/components/common/RoleBadge';

describe('Unified RoleBadge Component (src/components/common/RoleBadge.tsx)', () => {
  it('renders unified Arabic role labels and distinct colors for super_admin, admin, and employee aliases', () => {
    for (const alias of ['super_admin', 'superAdmin', 'owner']) {
      const html = renderToStaticMarkup(React.createElement(RoleBadge, { role: alias }));
      expect(html).toContain('المدير العام');
      expect(html).toContain('bg-rose-500/20');
    }

    const adminHtml = renderToStaticMarkup(React.createElement(RoleBadge, { role: 'admin' }));
    expect(adminHtml).toContain('مسؤول النظام');
    expect(adminHtml).toContain('bg-amber-500/20');

    for (const alias of ['employee', 'staff', 'manager']) {
      const html = renderToStaticMarkup(React.createElement(RoleBadge, { role: alias }));
      expect(html).toContain('موظف');
      expect(html).toContain('bg-cyan-500/20');
    }
  });

  it('renders nothing (null) for customer, user, null, undefined, or invalid role strings', () => {
    for (const nonStaff of ['customer', 'user', '', null, undefined, 'Admin', 'superadmin']) {
      const html = renderToStaticMarkup(React.createElement(RoleBadge, { role: nonStaff }));
      expect(html).toBe('');
    }
  });
});
