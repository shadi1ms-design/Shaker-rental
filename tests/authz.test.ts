import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  process.env.DESIGNATED_SUPER_ADMIN_UID = 'test-designated-super-admin-uid';
});

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

  it('should fail-closed when DESIGNATED_SUPER_ADMIN_UID is empty', () => {
    const prevVal = process.env.DESIGNATED_SUPER_ADMIN_UID;
    process.env.DESIGNATED_SUPER_ADMIN_UID = '';
    try {
      const superAdminToken = { role: 'super_admin' };
      const roleRes = canManageUserRole(superAdminToken, 'super-uid', { role: 'customer' }, 'cust-uid', 'employee');
      expect(roleRes.allowed).toBe(false);
      expect(roleRes.reason).toContain('إعداد الخادم ناقص');

      const lifecycleRes = canManageAccountLifecycle(superAdminToken, 'super-uid', { role: 'customer' }, 'cust-uid', 'toggle');
      expect(lifecycleRes.allowed).toBe(false);
      expect(lifecycleRes.reason).toContain('إعداد الخادم ناقص');
    } finally {
      process.env.DESIGNATED_SUPER_ADMIN_UID = prevVal;
    }
  });

  it('should enforce that fleet operations (addVehicle, updateVehicle, deleteVehicle) are admin-only', () => {
    const employeeToken = { role: 'employee' };
    const staffToken = { role: 'staff' };
    const adminToken = { role: 'admin' };
    const superToken = { role: 'super_admin' };
    const customerToken = { role: 'customer' };

    // Employee & staff are rejected from fleet management
    expect(isCallerAdmin(employeeToken)).toBe(false);
    expect(isCallerAdmin(staffToken)).toBe(false);
    expect(isCallerAdmin(customerToken)).toBe(false);

    // Only admin and super_admin are allowed
    expect(isCallerAdmin(adminToken)).toBe(true);
    expect(isCallerAdmin(superToken)).toBe(true);
  });
});

import {
  validateVehiclePayload,
  assertFleetAdmin,
  assertCanDeleteVehicle,
  isSafeImageUrl,
} from '../functions/src/fleetFunctions';

describe('Server Vehicle Payload Validation (validateVehiclePayload)', () => {
  const validVehicle = {
    brand: 'Kia',
    model: 'Cerato',
    year: 2023,
    color: 'Silver',
    category: 'medium',
    seats: 5,
    transmission: 'automatic',
    fuelType: 'petrol',
    dailyPrice: 45,
    plateNumber: '123456-DAM',
    currentMileage: 32000,
    status: 'available',
    imageUrl: 'https://example.com/car.jpg',
    images: ['https://example.com/car1.jpg', 'https://example.com/car2.jpg'],
    features: ['A/C', 'Bluetooth'],
    description: 'Car in pristine condition',
  };

  it('should accept a completely valid vehicle payload', () => {
    const res = validateVehiclePayload(validVehicle);
    expect(res.brand).toBe('Kia');
    expect(res.model).toBe('Cerato');
    expect(res.year).toBe(2023);
    expect(res.dailyPrice).toBe(45);
    expect(res.currentMileage).toBe(32000);
  });

  it('should strictly reject forbidden control fields (isDeleted, createdAt, updatedAt, id)', () => {
    expect(() => validateVehiclePayload({ ...validVehicle, isDeleted: true })).toThrow();
    expect(() => validateVehiclePayload({ ...validVehicle, createdAt: '2026-01-01' })).toThrow();
    expect(() => validateVehiclePayload({ ...validVehicle, updatedAt: '2026-01-01' })).toThrow();
    expect(() => validateVehiclePayload({ ...validVehicle, id: 'custom-id' })).toThrow();
  });

  it('should reject invalid year or negative dailyPrice', () => {
    expect(() => validateVehiclePayload({ ...validVehicle, year: 1980 })).toThrow();
    expect(() => validateVehiclePayload({ ...validVehicle, dailyPrice: 5 })).toThrow();
    expect(() => validateVehiclePayload({ ...validVehicle, currentMileage: -100 })).toThrow();
  });

  it('should reject invalid category or status', () => {
    expect(() => validateVehiclePayload({ ...validVehicle, category: 'submarine' })).toThrow();
    expect(() => validateVehiclePayload({ ...validVehicle, status: 'flying' })).toThrow();
  });

  it('should strictly reject data:, javascript:, vbscript:, and // URLs, and allow http://, https://, or /', () => {
    // Rejections
    expect(isSafeImageUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeImageUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeImageUrl('data:image/png;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeImageUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeImageUrl('//malicious.com/car.png')).toBe(false);

    // Acceptances
    expect(isSafeImageUrl('https://example.com/car.jpg')).toBe(true);
    expect(isSafeImageUrl('http://example.com/car.jpg')).toBe(true);
    expect(isSafeImageUrl('/uploads/vehicles/car.png')).toBe(true);

    expect(() => validateVehiclePayload({ ...validVehicle, imageUrl: 'javascript:alert(1)' })).toThrow();
    expect(() => validateVehiclePayload({ ...validVehicle, imageUrl: 'data:image/jpeg;base64,123' })).toThrow();
    expect(() => validateVehiclePayload({ ...validVehicle, imageUrl: '//cdn.example.com/car.jpg' })).toThrow();
    expect(() => validateVehiclePayload({ ...validVehicle, images: ['data:text/html;base64,PHNjcmlwdD4='] })).toThrow();
  });
});

describe('Fleet Authorization (assertFleetAdmin)', () => {
  it('should reject employee, staff, manager roles and boolean claims', () => {
    const rejectedClaims = [
      { role: 'employee' },
      { role: 'staff' },
      { role: 'manager' },
      { role: 'customer' },
      { employee: true },
      { staff: true },
      { manager: true },
      undefined,
      null,
      {},
    ];

    for (const claims of rejectedClaims) {
      expect(() => assertFleetAdmin(claims)).toThrow();
    }
  });

  it('should accept admin and super_admin roles and boolean claims', () => {
    const acceptedClaims = [
      { role: 'admin' },
      { admin: true },
      { role: 'super_admin' },
      { role: 'owner' },
      { super_admin: true },
      { owner: true },
    ];

    for (const claims of acceptedClaims) {
      expect(() => assertFleetAdmin(claims)).not.toThrow();
    }
  });
});

describe('Delete Vehicle Active Bookings Guard (assertCanDeleteVehicle)', () => {
  const vehicleId = 'veh-test-123';

  it('should reject deletion when bookings are in new, reviewing, confirmed, or rented', () => {
    const activeBookings = [
      { id: 'book-1', vehicleId, status: 'new', bookingNumber: 'SHK-001' },
      { id: 'book-2', vehicleId, status: 'reviewing', bookingNumber: 'SHK-002' },
      { id: 'book-3', vehicleId, status: 'confirmed', bookingNumber: 'SHK-003' },
      { id: 'book-4', vehicleId, status: 'rented', bookingNumber: 'SHK-004' },
    ];

    try {
      assertCanDeleteVehicle(vehicleId, activeBookings);
      expect.fail('Should have thrown HttpsError');
    } catch (err: any) {
      expect(err.message).toContain('4');
      expect(err.message).toContain('SHK-001');
      expect(err.message).toContain('SHK-002');
      expect(err.message).toContain('SHK-003');
      expect(err.message).toContain('SHK-004');
    }
  });

  it('should allow deletion when bookings are only completed or cancelled or belongs to other vehicles', () => {
    const inactiveBookings = [
      { id: 'book-1', vehicleId, status: 'completed', bookingNumber: 'SHK-001' },
      { id: 'book-2', vehicleId, status: 'cancelled', bookingNumber: 'SHK-002' },
      { id: 'book-3', vehicleId: 'other-veh', status: 'rented', bookingNumber: 'SHK-003' },
      { id: 'book-4', vehicleId, status: 'rented', bookingNumber: 'SHK-004', isDeleted: true },
    ];

    expect(() => assertCanDeleteVehicle(vehicleId, inactiveBookings)).not.toThrow();
  });
});

import { assertValidBookingStatusTransition } from '../functions/src/bookingHelpers';

describe('Booking Status Transition Guards (assertValidBookingStatusTransition)', () => {
  it('should reject transitions to rented or completed for non-staff callers, and allow for staff/admin', () => {
    // Non-staff attempting to transition confirmed -> rented or rented -> completed directly
    expect(() => assertValidBookingStatusTransition('confirmed', 'rented', false)).toThrow(
      'تسليم واستلام السيارة متاح للموظفين والإدارة فقط.'
    );
    expect(() => assertValidBookingStatusTransition('rented', 'completed', false)).toThrow(
      'تسليم واستلام السيارة متاح للموظفين والإدارة فقط.'
    );

    // Staff/Admin are permitted to execute handover (confirmed -> rented) and return (rented -> completed)
    expect(() => assertValidBookingStatusTransition('confirmed', 'rented', true)).not.toThrow();
    expect(() => assertValidBookingStatusTransition('rented', 'completed', true)).not.toThrow();

    // Attempting to jump directly from new -> rented or new -> completed
    expect(() => assertValidBookingStatusTransition('new', 'rented', true)).toThrow();
    expect(() => assertValidBookingStatusTransition('new', 'completed', true)).toThrow();
  });

  it('should reject invalid lifecycle transitions', () => {
    // Terminal states cannot change
    expect(() => assertValidBookingStatusTransition('completed', 'confirmed', true)).toThrow('غير مسموح به');
    expect(() => assertValidBookingStatusTransition('cancelled', 'confirmed', true)).toThrow('غير مسموح به');
    expect(() => assertValidBookingStatusTransition('rejected', 'confirmed', true)).toThrow('غير مسموح به');

    // Regressive transitions
    expect(() => assertValidBookingStatusTransition('confirmed', 'reviewing', true)).toThrow('غير مسموح به');
    expect(() => assertValidBookingStatusTransition('confirmed', 'new', true)).toThrow('غير مسموح به');
  });

  it('should permit valid lifecycle transitions', () => {
    expect(() => assertValidBookingStatusTransition('new', 'reviewing')).not.toThrow();
    expect(() => assertValidBookingStatusTransition('new', 'confirmed')).not.toThrow();
    expect(() => assertValidBookingStatusTransition('new', 'rejected')).not.toThrow();
    expect(() => assertValidBookingStatusTransition('new', 'cancelled')).not.toThrow();

    expect(() => assertValidBookingStatusTransition('reviewing', 'confirmed')).not.toThrow();
    expect(() => assertValidBookingStatusTransition('reviewing', 'rejected')).not.toThrow();
    expect(() => assertValidBookingStatusTransition('reviewing', 'cancelled')).not.toThrow();

    expect(() => assertValidBookingStatusTransition('confirmed', 'cancelled')).not.toThrow();
  });
});

describe('Vehicle Payload Status Guard (reject rented direct status)', () => {
  const baseVehicle = {
    brand: 'Toyota',
    model: 'Camry',
    year: 2024,
    color: 'White',
    category: 'medium',
    seats: 5,
    transmission: 'automatic',
    fuelType: 'petrol',
    dailyPrice: 50,
    plateNumber: '999999-DAM',
    currentMileage: 10000,
    imageUrl: 'https://example.com/car.jpg',
  };

  it('should reject status=rented in vehicle payload (rented status is strictly derived)', () => {
    expect(() => validateVehiclePayload({ ...baseVehicle, status: 'rented' })).toThrow(
      'حالة السيارة المؤجرة تنتج حصراً عبر تسليم السيارة لحجز نشط.'
    );
  });

  it('should accept valid fleet statuses', () => {
    expect(() => validateVehiclePayload({ ...baseVehicle, status: 'available' })).not.toThrow();
    expect(() => validateVehiclePayload({ ...baseVehicle, status: 'maintenance' })).not.toThrow();
    expect(() => validateVehiclePayload({ ...baseVehicle, status: 'reserved' })).not.toThrow();
    expect(() => validateVehiclePayload({ ...baseVehicle, status: 'inactive' })).not.toThrow();
  });
});

import {
  assertAdminMfa,
  clearAdminMfaCache,
} from '../functions/src/authz';
import { executeSetAdminMfaRequirement } from '../functions/src/userManagement';

describe('Admin MFA Enforcement (assertAdminMfa & setAdminMfaRequirement)', () => {
  const createMockDb = (requireAdminMfaDocValue?: boolean, throwOnGet = false) => {
    const writes: Record<string, any> = {};
    return {
      writes,
      collection: (colName: string) => ({
        doc: (docId: string) => ({
          get: async () => {
            if (throwOnGet) {
              throw new Error('Firestore connection error');
            }
            if (colName === 'system_config' && docId === 'security' && typeof requireAdminMfaDocValue === 'boolean') {
              return {
                exists: true,
                data: () => ({ requireAdminMfa: requireAdminMfaDocValue }),
              };
            }
            return { exists: false, data: () => undefined };
          },
          set: async (payload: any) => {
            writes[`${colName}/${docId}`] = payload;
          },
        }),
      }),
    };
  };

  it('should allow admin without second factor when MFA enforcement is disabled, and reject when enabled', async () => {
    clearAdminMfaCache();
    const disabledDb = createMockDb(false);
    const adminReqWithoutMfa = {
      auth: {
        uid: 'admin-1',
        token: { role: 'admin', firebase: {} },
      },
    };

    // 1. Enforcement disabled -> allowed
    await expect(assertAdminMfa(adminReqWithoutMfa, disabledDb)).resolves.toBeUndefined();

    // 2. Enforcement enabled -> rejected without sign_in_second_factor
    clearAdminMfaCache();
    const enabledDb = createMockDb(true);
    await expect(assertAdminMfa(adminReqWithoutMfa, enabledDb)).rejects.toThrow(/المصادقة الثنائية/);

    // 3. Enforcement enabled -> allowed when sign_in_second_factor is present
    const adminReqWithMfa = {
      auth: {
        uid: 'admin-1',
        token: { role: 'admin', firebase: { sign_in_second_factor: 'totp' } },
      },
    };
    await expect(assertAdminMfa(adminReqWithMfa, enabledDb)).resolves.toBeUndefined();

    // 4. Fail-closed when Firestore read fails
    clearAdminMfaCache();
    const failingDb = createMockDb(undefined, true);
    await expect(assertAdminMfa(adminReqWithoutMfa, failingDb)).rejects.toThrow(/المصادقة الثنائية/);
  });

  it('setAdminMfaRequirement should reject non-Super Admin callers', async () => {
    const mockDb = createMockDb(false);
    const adminReq = {
      auth: {
        uid: 'admin-1',
        token: {
          role: 'admin',
          email: 'admin@shaker.sy',
          firebase: { sign_in_second_factor: 'totp' },
        },
      },
      data: { requireAdminMfa: true },
    };

    await expect(
      executeSetAdminMfaRequirement(adminReq, {
        db: mockDb,
        assertNotRevokedFn: async () => ({ uid: 'admin-1', disabled: false } as any),
        writeAuditFn: async () => {},
      })
    ).rejects.toThrow(/المدير العام/);
  });

  it('setAdminMfaRequirement should reject Super Admin if token lacks sign_in_second_factor', async () => {
    const mockDb = createMockDb(false);
    const superReqWithoutMfaToken = {
      auth: {
        uid: 'super-1',
        token: {
          role: 'super_admin',
          email: 'owner@shaker.sy',
          firebase: {},
        },
      },
      data: { requireAdminMfa: true },
    };

    await expect(
      executeSetAdminMfaRequirement(superReqWithoutMfaToken, {
        db: mockDb,
        assertNotRevokedFn: async () => ({ uid: 'super-1', disabled: false } as any),
        writeAuditFn: async () => {},
      })
    ).rejects.toThrow(/المصادقة الثنائية/);
  });

  it('setAdminMfaRequirement should reject enabling if Super Admin has no enrolled second factor in getUser(uid)', async () => {
    const mockDb = createMockDb(false);
    const superReqWithMfaToken = {
      auth: {
        uid: 'super-1',
        token: {
          role: 'super_admin',
          email: 'owner@shaker.sy',
          firebase: { sign_in_second_factor: 'totp' },
        },
      },
      data: { requireAdminMfa: true },
    };

    await expect(
      executeSetAdminMfaRequirement(superReqWithMfaToken, {
        db: mockDb,
        assertNotRevokedFn: async () => ({ uid: 'super-1', disabled: false } as any),
        getUser: async () =>
          ({
            uid: 'super-1',
            multiFactor: { enrolledFactors: [] },
          } as any),
        writeAuditFn: async () => {},
      })
    ).rejects.toThrow(/عامل مصادقة ثانٍ/);
  });

  it('setAdminMfaRequirement should succeed when Super Admin has second factor in token and enrolled factor', async () => {
    clearAdminMfaCache();
    const mockDb = createMockDb(false);
    const audits: any[] = [];
    const superReqValid = {
      auth: {
        uid: 'super-1',
        token: {
          role: 'super_admin',
          email: 'owner@shaker.sy',
          firebase: { sign_in_second_factor: 'totp' },
        },
      },
      data: { requireAdminMfa: true },
    };

    const res = await executeSetAdminMfaRequirement(superReqValid, {
      db: mockDb,
      assertNotRevokedFn: async () => ({ uid: 'super-1', disabled: false } as any),
      getUser: async () =>
        ({
          uid: 'super-1',
          multiFactor: { enrolledFactors: [{ uid: 'factor-1', factorId: 'totp' }] },
        } as any),
      writeAuditFn: async (_db, entry) => {
        audits.push(entry);
      },
    });

    expect(res.success).toBe(true);
    expect(res.requireAdminMfa).toBe(true);
    expect(mockDb.writes['system_config/security']?.requireAdminMfa).toBe(true);
    expect(mockDb.writes['system_config/security']?.updatedBy).toBe('super-1');
    expect(audits).toHaveLength(1);
    expect(audits[0].actorUid).toBe('super-1');
    expect(audits[0].action).toBe('ADMIN_MFA_REQUIREMENT_ENABLED');
  });
});

import { HttpsError } from 'firebase-functions/v2/https';
import { executeSecureCall, secureCall } from '../functions/src/secureCall';

describe('Unified Security Wrapper (secureCall / executeSecureCall)', () => {
  const validUserRecord = { uid: 'u-1', disabled: false } as any;

  it('1) should reject unauthenticated callers for non-public functions and allow for public functions', async () => {
    const unauthReq = { auth: undefined, data: {} } as any;

    await expect(
      executeSecureCall(
        { role: 'user', unauthenticatedMessage: 'يجب تسجيل الدخول أولاً.' },
        async () => 'ok',
        unauthReq
      )
    ).rejects.toThrow('يجب تسجيل الدخول أولاً.');

    await expect(
      executeSecureCall({ role: 'admin' }, async () => 'ok', unauthReq)
    ).rejects.toThrow(/تسجيل الدخول مطلوب/);

    const pubRes = await executeSecureCall(
      { role: 'public' },
      async () => 'public-ok',
      unauthReq
    );
    expect(pubRes).toBe('public-ok');
  });

  it('2) should reject revoked or disabled sessions via assertNotRevoked before checking roles or running handler', async () => {
    const handler = vi.fn(async () => 'should-not-run');
    const revokedReq = {
      auth: { uid: 'revoked-uid', token: { role: 'super_admin' } },
      data: {},
    } as any;

    await expect(
      executeSecureCall(
        { role: 'super_admin' },
        handler,
        revokedReq,
        {
          assertNotRevokedFn: async () => {
            throw new HttpsError(
              'permission-denied',
              'انتهت صلاحية الجلسة أو تم تعديل الصلاحيات. يرجى تسجيل الدخول مجدداً.'
            );
          },
        }
      )
    ).rejects.toThrow(/انتهت صلاحية الجلسة/);

    expect(handler).not.toHaveBeenCalled();

    await expect(
      executeSecureCall(
        { role: 'user' },
        handler,
        revokedReq,
        {
          assertNotRevokedFn: async () => {
            throw new HttpsError('permission-denied', 'تم إيقاف هذا الحساب من قِبل الإدارة.');
          },
        }
      )
    ).rejects.toThrow(/تم إيقاف هذا الحساب/);

    expect(handler).not.toHaveBeenCalled();
  });

  it('3) should reject callers with insufficient role (customer -> staff/admin/super_admin, staff -> admin, admin -> super_admin)', async () => {
    const deps = { assertNotRevokedFn: async () => validUserRecord };

    // Customer calling staff endpoint
    await expect(
      executeSecureCall(
        { role: 'staff' },
        async () => 'ok',
        { auth: { uid: 'c-1', token: { role: 'customer' } }, data: {} } as any,
        deps
      )
    ).rejects.toThrow(/للموظفين والإدارة فقط/);

    // Employee/Staff calling admin endpoint
    await expect(
      executeSecureCall(
        { role: 'admin', permissionDeniedMessage: 'مقتصر على مدراء النظام.' },
        async () => 'ok',
        { auth: { uid: 'e-1', token: { role: 'employee' } }, data: {} } as any,
        deps
      )
    ).rejects.toThrow('مقتصر على مدراء النظام.');

    // Admin calling super_admin endpoint
    await expect(
      executeSecureCall(
        { role: 'super_admin' },
        async () => 'ok',
        { auth: { uid: 'a-1', token: { role: 'admin', admin: true } }, data: {} } as any,
        deps
      )
    ).rejects.toThrow(/المدير العام/);
  });

  it('4) should accept valid roles (including legacy boolean claims) and attach callerRecord to request', async () => {
    const deps = { assertNotRevokedFn: async () => validUserRecord };

    // Customer on 'user'
    const userRes = await executeSecureCall(
      { role: 'user' },
      async (req) => ({ uid: req.auth?.uid, recordUid: req.callerRecord?.uid }),
      { auth: { uid: 'c-1', token: {} }, data: {} } as any,
      deps
    );
    expect(userRes).toEqual({ uid: 'c-1', recordUid: 'u-1' });

    // Legacy staff boolean claim on 'staff'
    const staffRes = await executeSecureCall(
      { role: 'staff' },
      async () => 'staff-ok',
      { auth: { uid: 's-1', token: { staff: true } }, data: {} } as any,
      deps
    );
    expect(staffRes).toBe('staff-ok');

    // Admin on 'admin'
    const adminRes = await executeSecureCall(
      { role: 'admin' },
      async () => 'admin-ok',
      { auth: { uid: 'a-1', token: { role: 'admin' } }, data: {} } as any,
      deps
    );
    expect(adminRes).toBe('admin-ok');

    // Legacy owner boolean claim on 'super_admin'
    const superRes = await executeSecureCall(
      { role: 'super_admin' },
      async () => 'super-ok',
      { auth: { uid: 'sa-1', token: { owner: true } }, data: {} } as any,
      deps
    );
    expect(superRes).toBe('super-ok');
  });

  it('5) should enforce MFA when requireMfa is enabled and MFA enforcement is active', async () => {
    clearAdminMfaCache();
    const enabledMfaDb = {
      collection: () => ({
        doc: () => ({
          get: async () => ({
            exists: true,
            data: () => ({ requireAdminMfa: true }),
          }),
        }),
      }),
    };

    const deps = { assertNotRevokedFn: async () => validUserRecord };

    // Admin without 2FA token rejected when requireMfa: true
    await expect(
      executeSecureCall(
        { role: 'admin', requireMfa: true, dbOverride: enabledMfaDb },
        async () => 'ok',
        { auth: { uid: 'a-1', token: { role: 'admin', firebase: {} } }, data: {} } as any,
        deps
      )
    ).rejects.toThrow(/المصادقة الثنائية/);

    // Admin with 2FA token accepted when requireMfa: true
    const mfaOk = await executeSecureCall(
      { role: 'admin', requireMfa: true, dbOverride: enabledMfaDb },
      async () => 'mfa-verified',
      {
        auth: {
          uid: 'a-1',
          token: { role: 'admin', firebase: { sign_in_second_factor: 'totp' } },
        },
        data: {},
      } as any,
      deps
    );
    expect(mfaOk).toBe('mfa-verified');

    // Predicate requireMfa (like toggleUserAccountStatus): skipped when disabled === false, enforced when disabled === true
    const enableAccountRes = await executeSecureCall(
      {
        role: 'admin',
        requireMfa: (req) => req.data?.disabled !== false,
        dbOverride: enabledMfaDb,
      },
      async () => 'account-enabled',
      {
        auth: { uid: 'a-1', token: { role: 'admin', firebase: {} } },
        data: { disabled: false },
      } as any,
      deps
    );
    expect(enableAccountRes).toBe('account-enabled');

    await expect(
      executeSecureCall(
        {
          role: 'admin',
          requireMfa: (req) => req.data?.disabled !== false,
          dbOverride: enabledMfaDb,
        },
        async () => 'account-disabled',
        {
          auth: { uid: 'a-1', token: { role: 'admin', firebase: {} } },
          data: { disabled: true },
        } as any,
        deps
      )
    ).rejects.toThrow(/المصادقة الثنائية/);

    // Verify secureCall wrapper returns a valid CallableFunction with .run
    const wrapped = secureCall({ role: 'public' }, async () => 'callable-ok');
    expect(typeof wrapped).toBe('function');
    expect(typeof (wrapped as any).run).toBe('function');
  });
});

import * as fs from 'fs';
import * as path from 'path';
import * as backendRoles from '../functions/src/roles';
import * as frontendRoles from '../src/utils/roles';

describe('Role Centralization & Cross-Layer Parity (functions/src/roles.ts ↔ src/utils/roles.ts ↔ firestore.rules ↔ storage.rules)', () => {
  it('1) should have identical role alias constants and boolean claim lists between backend and frontend', () => {
    expect(backendRoles.SUPER_ADMIN_ROLE_ALIASES).toEqual(frontendRoles.SUPER_ADMIN_ROLE_ALIASES);
    expect(backendRoles.SUPER_ADMIN_BOOLEAN_CLAIMS).toEqual(frontendRoles.SUPER_ADMIN_BOOLEAN_CLAIMS);
    expect(backendRoles.ADMIN_ROLE_ALIASES).toEqual(frontendRoles.ADMIN_ROLE_ALIASES);
    expect(backendRoles.ADMIN_BOOLEAN_CLAIMS).toEqual(frontendRoles.ADMIN_BOOLEAN_CLAIMS);
    expect(backendRoles.STAFF_ROLE_ALIASES).toEqual(frontendRoles.STAFF_ROLE_ALIASES);
    expect(backendRoles.STAFF_BOOLEAN_CLAIMS).toEqual(frontendRoles.STAFF_BOOLEAN_CLAIMS);
  });

  it('2) should produce 100% identical role resolution across all legacy and canonical claims on backend and frontend', () => {
    const testClaimsMatrix: Array<Record<string, any> | null | undefined> = [
      null,
      undefined,
      {},
      { role: 'customer' },
      { role: 'user' },
      { role: 'employee' },
      { role: 'staff' },
      { role: 'manager' },
      { role: 'admin' },
      { role: 'ADMIN' },
      { role: 'super_admin' },
      { role: 'superAdmin' },
      { role: 'SUPERADMIN' },
      { role: 'owner' },
      { super_admin: true },
      { superAdmin: true },
      { owner: true },
      { admin: true },
      { employee: true },
      { staff: true },
      { manager: true },
      { role: 'customer', super_admin: true },
      { role: 'customer', admin: true },
      { role: 'customer', employee: true },
    ];

    for (const claims of testClaimsMatrix) {
      expect(backendRoles.isCallerSuperAdmin(claims)).toBe(frontendRoles.isSuperAdminClaims(claims));
      expect(backendRoles.isCallerAdmin(claims)).toBe(frontendRoles.isAdminClaims(claims));
      expect(backendRoles.isCallerStaff(claims)).toBe(frontendRoles.isStaffClaims(claims));
      expect(backendRoles.getUserRoleFromClaims(claims as any)).toBe(
        frontendRoles.getUserRoleFromClaims(claims as any)
      );
    }

    const roleStrings = [
      'super_admin',
      'superAdmin',
      'owner',
      'admin',
      'employee',
      'staff',
      'manager',
      'customer',
      'user',
      '',
      null,
      undefined,
    ];

    for (const r of roleStrings) {
      expect(backendRoles.getRoleRank(r)).toBe(frontendRoles.getRoleRank(r));
      expect(backendRoles.normalizeRoleName(r)).toBe(frontendRoles.normalizeRoleName(r));
      expect(backendRoles.isSuperAdminRole(r)).toBe(frontendRoles.isSuperAdminRole(r));
      expect(backendRoles.isAdminRole(r)).toBe(frontendRoles.isAdminRole(r));
      expect(backendRoles.isStaffRole(r)).toBe(frontendRoles.isStaffRole(r));
    }

    // Verify exact accepted role strings work as expected in normalizeRoleName and getRoleRank
    expect(backendRoles.normalizeRoleName('super_admin')).toBe('super_admin');
    expect(backendRoles.normalizeRoleName('superAdmin')).toBe('super_admin');
    expect(backendRoles.normalizeRoleName('owner')).toBe('super_admin');
    expect(backendRoles.normalizeRoleName('admin')).toBe('admin');
    expect(backendRoles.normalizeRoleName('employee')).toBe('employee');
    expect(backendRoles.normalizeRoleName('staff')).toBe('employee');
    expect(backendRoles.normalizeRoleName('manager')).toBe('employee');

    expect(backendRoles.getRoleRank('super_admin')).toBe(4);
    expect(backendRoles.getRoleRank('superAdmin')).toBe(4);
    expect(backendRoles.getRoleRank('owner')).toBe(4);
    expect(backendRoles.getRoleRank('admin')).toBe(3);
    expect(backendRoles.getRoleRank('employee')).toBe(2);
    expect(backendRoles.getRoleRank('staff')).toBe(2);
    expect(backendRoles.getRoleRank('manager')).toBe(2);
  });

  it('3) should strictly reject non-exact role strings ("Admin", "SUPER_ADMIN", "superadmin", " admin ") to match hasTokenRole in rules', () => {
    const rejectedRoleStrings = ['Admin', 'SUPER_ADMIN', 'superadmin', ' admin '];

    for (const badRole of rejectedRoleStrings) {
      // Backend role helpers
      expect(backendRoles.isSuperAdminRole(badRole)).toBe(false);
      expect(backendRoles.isAdminRole(badRole)).toBe(false);
      expect(backendRoles.isEmployeeOnlyRole(badRole)).toBe(false);
      expect(backendRoles.isStaffRole(badRole)).toBe(false);
      expect(backendRoles.normalizeRoleName(badRole)).toBe('customer');
      expect(backendRoles.getRoleRank(badRole)).toBe(1);
      expect(backendRoles.isCallerSuperAdmin({ role: badRole })).toBe(false);
      expect(backendRoles.isCallerAdmin({ role: badRole })).toBe(false);
      expect(backendRoles.isCallerStaff({ role: badRole })).toBe(false);
      expect(backendRoles.getUserRoleFromClaims({ role: badRole })).toBe('customer');

      // Frontend role helpers
      expect(frontendRoles.isSuperAdminRole(badRole)).toBe(false);
      expect(frontendRoles.isAdminRole(badRole)).toBe(false);
      expect(frontendRoles.isEmployeeOnlyRole(badRole)).toBe(false);
      expect(frontendRoles.isStaffRole(badRole)).toBe(false);
      expect(frontendRoles.normalizeRoleName(badRole)).toBe('customer');
      expect(frontendRoles.getRoleRank(badRole)).toBe(1);
      expect(frontendRoles.isSuperAdminClaims({ role: badRole })).toBe(false);
      expect(frontendRoles.isAdminClaims({ role: badRole })).toBe(false);
      expect(frontendRoles.isStaffClaims({ role: badRole })).toBe(false);
      expect(frontendRoles.getUserRoleFromClaims({ role: badRole })).toBe('customer');
    }
  });

  it('4) should keep firestore.rules and storage.rules role helper functions synchronized with each other and with roles.ts', () => {
    const rootDir = path.resolve(__dirname, '..');
    const firestoreRules = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
    const storageRules = fs.readFileSync(path.join(rootDir, 'storage.rules'), 'utf8');

    const extractHelperBlock = (source: string, fnName: string): string => {
      const start = source.indexOf(`function ${fnName}(`);
      expect(start, `${fnName} missing`).toBeGreaterThan(-1);
      const openBrace = source.indexOf('{', start);
      let depth = 0;
      let i = openBrace;
      for (; i < source.length; i++) {
        if (source[i] === '{') depth++;
        if (source[i] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      return source
        .slice(start, i + 1)
        .replace(/\s+/g, ' ')
        .trim();
    };

    for (const fnName of ['hasTokenRole', 'isSuperAdmin', 'isAdmin', 'isEmployee']) {
      expect(extractHelperBlock(storageRules, fnName)).toBe(
        extractHelperBlock(firestoreRules, fnName)
      );
    }

    // Verify all legacy boolean claim keys from roles.ts are checked in both rules files
    for (const claimKey of [
      ...backendRoles.SUPER_ADMIN_BOOLEAN_CLAIMS,
      ...backendRoles.ADMIN_BOOLEAN_CLAIMS,
      ...backendRoles.STAFF_BOOLEAN_CLAIMS,
    ]) {
      expect(firestoreRules).toContain(`'${claimKey}'`);
      expect(storageRules).toContain(`'${claimKey}'`);
    }
  });
});

import {
  buildAuditDocumentData,
  writeAudit,
  writeAuditAsync,
  computeSettingsDiff,
} from '../functions/src/audit';

describe('Phase 3: Unified Audit Logging & Settings Diff Tracking', () => {
  it('1) buildAuditDocumentData and writeAuditAsync produce standardized audit documents with targetUserId and metadata', async () => {
    let writtenData: Record<string, unknown> | null = null;
    const mockDocRef = {
      id: 'audit-doc-123',
      set: vi.fn(async (data: Record<string, unknown>) => {
        writtenData = data;
      }),
    };
    const mockDb = {
      collection: vi.fn((colName: string) => {
        expect(colName).toBe('auditLogs');
        return {
          doc: vi.fn(() => mockDocRef),
        };
      }),
    } as any;

    await writeAuditAsync(mockDb, {
      actorUid: 'admin-uid-1',
      actorEmail: 'admin@shaker.sy',
      actorRole: 'admin',
      actorType: 'staff',
      action: 'VERIFICATION_APPROVED',
      entity: 'verification',
      entityId: 'user-target-99',
      entityName: 'أحمد محمد',
      targetUserId: 'user-target-99',
      details: 'تمت الموافقة على توثيق الهوية.',
      metadata: { reason: null },
    });

    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
    expect(writtenData).toBeTruthy();
    expect(writtenData!.id).toBe('audit-doc-123');
    expect(writtenData!.actorUid).toBe('admin-uid-1');
    expect(writtenData!.actorEmail).toBe('admin@shaker.sy');
    expect(writtenData!.actorRole).toBe('admin');
    expect(writtenData!.actorType).toBe('staff');
    expect(writtenData!.action).toBe('VERIFICATION_APPROVED');
    expect(writtenData!.entity).toBe('verification');
    expect(writtenData!.entityType).toBe('verification');
    expect(writtenData!.entityId).toBe('user-target-99');
    expect(writtenData!.entityName).toBe('أحمد محمد');
    expect(writtenData!.targetUserId).toBe('user-target-99');
    expect(writtenData!.user).toBe('admin@shaker.sy');
    expect(writtenData!.userId).toBe('admin-uid-1');
    expect(writtenData!.metadata).toEqual({ reason: null });
    expect(writtenData!.createdAt).toBeDefined();
    expect(writtenData!.timestamp).toBeDefined();

    // Without targetUserId, targetUserId key should not be set
    const withoutTarget = buildAuditDocumentData('audit-doc-456', {
      action: 'USER_REGISTERED',
      entity: 'auth',
      details: 'تسجيل مستخدم جديد',
    });
    expect('targetUserId' in withoutTarget).toBe(false);
    expect(withoutTarget.actorUid).toBe('system');
    expect(withoutTarget.actorType).toBe('system');

    // Transactional writeAudit should pass docData to tx.set
    const txSet = vi.fn();
    writeAudit(mockDb, { set: txSet } as any, {
      action: 'BOOKING_CREATED',
      entity: 'booking',
      entityId: 'b-1',
      details: 'إنشاء حجز',
    });
    expect(txSet).toHaveBeenCalledTimes(1);
  });

  it('2) computeSettingsDiff captures { from, to } only for modified fields and ignores updatedAt', () => {
    const previous = {
      companyName: 'شركة شاكر لتأجير السيارات',
      insuranceShortTerm: 200,
      insuranceLongTerm: 350,
      driverDailyRate: 50,
      discountConfig: {
        enabled: false,
        percentage: 10,
        scope: 'all',
        vehicleIds: [],
        title: 'خصم خاص للأعضاء',
      },
    };

    const incomingUpdates = {
      companyName: 'شركة شاكر لتأجير السيارات', // unchanged
      insuranceShortTerm: 250, // changed: 200 -> 250
      driverDailyRate: 60, // changed: 50 -> 60
      cancellationLeadHours: 24, // new field: null -> 24
      discountConfig: {
        enabled: true, // changed nested object
        percentage: 15,
        scope: 'all',
        vehicleIds: [],
        title: 'خصم خاص للأعضاء',
      },
      updatedAt: 'SERVER_TIMESTAMP_SENTINEL', // must be ignored
    };

    const diff = computeSettingsDiff(previous, incomingUpdates);

    expect(diff).toEqual({
      insuranceShortTerm: { from: 200, to: 250 },
      driverDailyRate: { from: 50, to: 60 },
      cancellationLeadHours: { from: null, to: 24 },
      discountConfig: {
        from: {
          enabled: false,
          percentage: 10,
          scope: 'all',
          vehicleIds: [],
          title: 'خصم خاص للأعضاء',
        },
        to: {
          enabled: true,
          percentage: 15,
          scope: 'all',
          vehicleIds: [],
          title: 'خصم خاص للأعضاء',
        },
      },
    });
    expect('companyName' in diff).toBe(false);
    expect('updatedAt' in diff).toBe(false);
  });

  it('3) computeSettingsDiff records { changed: true, fromLength, toLength } for rentalTerms and strings > 200 chars, and returns empty object when nothing changed', () => {
    const longDescBefore = 'أ'.repeat(210);
    const longDescAfter = 'ب'.repeat(255);
    const prevSettings = {
      companyName: 'شاكر',
      rentalTerms: 'شروط أولية قصيرة',
      customLongNote: longDescBefore,
    };
    const nextSettings = {
      companyName: 'شاكر',
      rentalTerms: 'شروط تأجير محدثة ومعتمدة لعام 2026',
      customLongNote: longDescAfter,
      updatedAt: 'SERVER_TIMESTAMP',
    };

    const diff = computeSettingsDiff(prevSettings, nextSettings);
    expect(diff).toEqual({
      rentalTerms: {
        changed: true,
        fromLength: 'شروط أولية قصيرة'.length,
        toLength: 'شروط تأجير محدثة ومعتمدة لعام 2026'.length,
      },
      customLongNote: {
        changed: true,
        fromLength: 210,
        toLength: 255,
      },
    });

    // No-change case: returns empty object {} so updateSettingsSecure skips writing audit log
    const noChangeDiff = computeSettingsDiff(prevSettings, {
      ...prevSettings,
      updatedAt: 'SERVER_TIMESTAMP',
    });
    expect(noChangeDiff).toEqual({});
    expect(Object.keys(noChangeDiff)).toHaveLength(0);
  });

  it('4) enforces that no file in functions/src/ other than audit.ts writes directly to collection("auditLogs")', () => {
    const functionsSrcDir = path.resolve(__dirname, '../functions/src');
    const files = fs.readdirSync(functionsSrcDir).filter((f) => f.endsWith('.ts'));

    for (const file of files) {
      if (file === 'audit.ts') continue;
      const content = fs.readFileSync(path.join(functionsSrcDir, file), 'utf8');
      // Ensure no direct .collection('auditLogs').add or .collection('auditLogs').doc
      expect(
        content.includes("collection('auditLogs').add") ||
          content.includes('collection("auditLogs").add') ||
          content.includes("collection('auditLogs').doc") ||
          content.includes('collection("auditLogs").doc'),
        `Direct auditLogs write found in functions/src/${file}`
      ).toBe(false);
    }
  });
});

import {
  getArabicAuthErrorMessage,
  evaluateMfaUnenrollGuard,
  SUPER_ADMIN_MFA_REQUIRED_BLOCK_TEXT,
  SUPER_ADMIN_MFA_CHECK_FAILED_TEXT,
  ADMIN_UNENROLL_WARNING_TEXT,
} from '../src/hooks/useMfaEnrollment';

describe('MFA Enrollment Hook Helpers & Self-Lockout Guard (useMfaEnrollment.ts)', () => {
  it('1) getArabicAuthErrorMessage maps Firebase auth error codes to Arabic messages and never leaks raw auth/ codes', () => {
    expect(getArabicAuthErrorMessage({ code: 'auth/invalid-verification-code' }, 'احتياطي')).toContain(
      'رمز التحقق غير صحيح'
    );
    expect(getArabicAuthErrorMessage({ code: 'auth/code-expired' }, 'احتياطي')).toContain(
      'انتهت صلاحية رمز التحقق'
    );
    expect(getArabicAuthErrorMessage({ code: 'auth/too-many-requests' }, 'احتياطي')).toContain(
      'تم تجاوز عدد المحاولات'
    );
    expect(getArabicAuthErrorMessage({ code: 'auth/requires-recent-login' }, 'احتياطي')).toContain(
      'يلزم إعادة تسجيل الدخول'
    );
    expect(getArabicAuthErrorMessage({ code: 'auth/wrong-password' }, 'احتياطي')).toBe(
      'كلمة المرور الحالية غير صحيحة.'
    );
    expect(
      getArabicAuthErrorMessage(
        { code: 'auth/unknown-raw-error', message: 'Firebase: Error (auth/unknown-raw-error).' },
        'رسالة عربية آمنة'
      )
    ).toBe('رسالة عربية آمنة');
  });

  it('2) evaluateMfaUnenrollGuard Path A: blocks Super Admin when MFA enforcement is enabled', async () => {
    const res = await evaluateMfaUnenrollGuard({
      isSuperAdmin: true,
      isAdmin: true,
      adminWarningConfirmed: false,
      getMfaRequirementFn: async () => ({
        success: true,
        data: { requireAdminMfa: true },
      }),
    });

    expect(res.allowed).toBe(false);
    expect(res.errorMessage).toBe('عطّل فرض المصادقة الثنائية من الإعدادات أولًا');
    expect(res.errorMessage).toBe(SUPER_ADMIN_MFA_REQUIRED_BLOCK_TEXT);
  });

  it('3) evaluateMfaUnenrollGuard Path B: fails closed for Super Admin when status check fails or throws', async () => {
    const resError = await evaluateMfaUnenrollGuard({
      isSuperAdmin: true,
      isAdmin: true,
      adminWarningConfirmed: false,
      getMfaRequirementFn: async () => ({
        success: false,
        error: 'Network failure',
      }),
    });
    expect(resError.allowed).toBe(false);
    expect(resError.errorMessage).toBe('تعذّر التحقق من حالة الفرض، حاول لاحقًا');
    expect(resError.errorMessage).toBe(SUPER_ADMIN_MFA_CHECK_FAILED_TEXT);

    const resThrown = await evaluateMfaUnenrollGuard({
      isSuperAdmin: true,
      isAdmin: true,
      adminWarningConfirmed: false,
      getMfaRequirementFn: async () => {
        throw new Error('RPC timeout');
      },
    });
    expect(resThrown.allowed).toBe(false);
    expect(resThrown.errorMessage).toBe('تعذّر التحقق من حالة الفرض، حاول لاحقًا');
  });

  it('4) evaluateMfaUnenrollGuard Path C: requires warning confirmation for non-super Admin before proceeding, and allows after confirmation', async () => {
    const beforeConfirm = await evaluateMfaUnenrollGuard({
      isSuperAdmin: false,
      isAdmin: true,
      adminWarningConfirmed: false,
    });
    expect(beforeConfirm.allowed).toBe(false);
    expect(beforeConfirm.requiresWarningConfirmation).toBe(true);
    expect(beforeConfirm.warningMessage).toBe(
      'قد لا تتمكن من تنفيذ العمليات الحساسة بعد إلغاء المصادقة الثنائية'
    );
    expect(beforeConfirm.warningMessage).toBe(ADMIN_UNENROLL_WARNING_TEXT);

    const afterConfirm = await evaluateMfaUnenrollGuard({
      isSuperAdmin: false,
      isAdmin: true,
      adminWarningConfirmed: true,
    });
    expect(afterConfirm.allowed).toBe(true);
  });
});






