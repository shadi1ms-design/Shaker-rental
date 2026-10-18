import { describe, it, expect } from 'vitest';
import {
  isCallerSuperAdmin,
  isCallerAdmin,
  isCallerStaff,
  getRoleRank,
  canManageUserRole,
  canManageAccountLifecycle,
} from '../functions/src/authz';
import { DESIGNATED_SUPER_ADMIN_UID } from '../functions/src/constants';

describe('Authorization & Hierarchy Tests', () => {
  it('should correctly evaluate role ranks', () => {
    expect(getRoleRank('super_admin')).toBe(4);
    expect(getRoleRank('owner')).toBe(4);
    expect(getRoleRank('admin')).toBe(3);
    expect(getRoleRank('employee')).toBe(2);
    expect(getRoleRank('staff')).toBe(2);
    expect(getRoleRank('customer')).toBe(1);
    expect(getRoleRank(null)).toBe(1);
  });

  it('should verify claims helpers for super_admin, admin, employee', () => {
    const superToken = { role: 'super_admin' };
    const adminToken = { role: 'admin' };
    const staffToken = { role: 'employee' };
    const customerToken = { role: 'customer' };

    expect(isCallerSuperAdmin(superToken)).toBe(true);
    expect(isCallerSuperAdmin(adminToken)).toBe(false);

    expect(isCallerAdmin(superToken)).toBe(true);
    expect(isCallerAdmin(adminToken)).toBe(true);
    expect(isCallerAdmin(staffToken)).toBe(false);

    expect(isCallerStaff(superToken)).toBe(true);
    expect(isCallerStaff(adminToken)).toBe(true);
    expect(isCallerStaff(staffToken)).toBe(true);
    expect(isCallerStaff(customerToken)).toBe(false);
  });

  it('should enforce role management hierarchy rules', () => {
    const superAdminToken = { role: 'super_admin' };
    const adminToken = { role: 'admin' };
    const customerToken = { role: 'customer' };

    const superUid = 'super-uid-1';
    const adminUid = 'admin-uid-1';
    const targetCustomerUid = 'cust-uid-1';

    // 1. Caller cannot modify self
    const selfRes = canManageUserRole(superAdminToken, superUid, { role: 'super_admin' }, superUid, 'admin');
    expect(selfRes.allowed).toBe(false);

    // 2. Regular admin CANNOT grant or revoke admin
    const adminGrantAdmin = canManageUserRole(adminToken, adminUid, { role: 'customer' }, targetCustomerUid, 'admin');
    expect(adminGrantAdmin.allowed).toBe(false);

    // 3. Regular admin CAN manage customer <-> employee
    const adminGrantEmployee = canManageUserRole(adminToken, adminUid, { role: 'customer' }, targetCustomerUid, 'employee');
    expect(adminGrantEmployee.allowed).toBe(true);

    // 4. Regular admin CANNOT modify another admin or super admin
    const adminModifyAdmin = canManageUserRole(adminToken, adminUid, { role: 'admin' }, 'another-admin-uid', 'employee');
    expect(adminModifyAdmin.allowed).toBe(false);

    // 5. Designated Super Admin is protected
    const modifyDesignated = canManageUserRole(superAdminToken, superUid, { role: 'super_admin' }, DESIGNATED_SUPER_ADMIN_UID, 'employee');
    expect(modifyDesignated.allowed).toBe(false);
  });

  it('should enforce account lifecycle (toggle/delete) permissions', () => {
    const superAdminToken = { role: 'super_admin' };
    const adminToken = { role: 'admin' };

    // Regular admin CANNOT delete account (delete is super admin only)
    const adminDelete = canManageAccountLifecycle(adminToken, 'admin-uid', { role: 'customer' }, 'cust-uid', 'delete');
    expect(adminDelete.allowed).toBe(false);

    // Super admin CAN delete customer account
    const superDelete = canManageAccountLifecycle(superAdminToken, 'super-uid', { role: 'customer' }, 'cust-uid', 'delete');
    expect(superDelete.allowed).toBe(true);

    // Super admin CANNOT delete self
    const superDeleteSelf = canManageAccountLifecycle(superAdminToken, 'super-uid', { role: 'super_admin' }, 'super-uid', 'delete');
    expect(superDeleteSelf.allowed).toBe(false);
  });
});
