import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const mockState = vi.hoisted(() => {
  let autoId = 0;
  const docs: Record<string, Record<string, any>> = {};
  const authUsers: Record<string, any> = {};

  function assertNoUndefined(val: unknown, pathSoFar = ''): void {
    if (val === undefined) {
      throw new Error(
        `Value for argument "data" is not a valid Firestore document. Cannot use "undefined" as a Firestore value (found in field "${pathSoFar}")`
      );
    }
    if (val === null || typeof val !== 'object') return;
    if (Array.isArray(val)) {
      val.forEach((item, idx) => assertNoUndefined(item, `${pathSoFar}[${idx}]`));
      return;
    }
    const proto = Object.getPrototypeOf(val);
    if (proto !== Object.prototype && proto !== null) return;
    for (const [k, v] of Object.entries(val)) {
      const nextPath = pathSoFar ? `${pathSoFar}.${k}` : k;
      assertNoUndefined(v, nextPath);
    }
  }

  const reset = () => {
    autoId = 0;
    for (const k of Object.keys(docs)) delete docs[k];
    for (const k of Object.keys(authUsers)) delete authUsers[k];
  };

  const makeCollection = (collPath: string): any => {
    const makeQuery = (filters: Array<{ field: string; op: string; val: any }>) => {
      const execute = () =>
        Object.entries(docs)
          .filter(([k, v]) => {
            if (!k.startsWith(`${collPath}/`)) return false;
            const remainder = k.slice(collPath.length + 1);
            if (remainder.includes('/')) return false;
            return filters.every((f) => {
              if (f.op === '==') return v[f.field] === f.val;
              if (f.op === 'in' && Array.isArray(f.val)) return f.val.includes(v[f.field]);
              return true;
            });
          })
          .map(([k, v]) => {
            const id = k.slice(collPath.length + 1);
            return {
              id,
              ref: makeCollection(collPath).doc(id),
              data: () => ({ ...v }),
            };
          });

      return {
        where: (field: string, op: string, val: any) =>
          makeQuery([...filters, { field, op, val }]),
        limit: (n: number) => ({
          get: async () => {
            const items = execute().slice(0, n);
            return { empty: items.length === 0, docs: items };
          },
        }),
        get: async () => {
          const items = execute();
          return { empty: items.length === 0, docs: items };
        },
      };
    };

    return {
      doc: (docId?: string) => {
        const id = docId || `auto_${++autoId}`;
        const key = `${collPath}/${id}`;
        return {
          id,
          path: key,
          get: async () => ({
            exists: Boolean(docs[key]),
            id,
            data: () => (docs[key] ? { ...docs[key] } : undefined),
          }),
          set: async (data: Record<string, any>, opts?: { merge?: boolean }) => {
            assertNoUndefined(data);
            docs[key] = opts?.merge && docs[key] ? { ...docs[key], ...data } : { ...data };
          },
          update: async (updates: Record<string, any>) => {
            assertNoUndefined(updates);
            if (docs[key]) {
              docs[key] = { ...docs[key], ...updates };
            }
          },
          delete: async () => {
            delete docs[key];
          },
          collection: (sub: string) => makeCollection(`${collPath}/${id}/${sub}`),
        };
      },
      where: (field: string, op: string, val: any) => makeQuery([{ field, op, val }]),
    };
  };

  const mockDb = {
    collection: (collPath: string) => makeCollection(collPath),
    runTransaction: async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        get: async (refOrQuery: any) => refOrQuery.get(),
        set: (ref: any, data: Record<string, any>, opts?: { merge?: boolean }) => {
          assertNoUndefined(data);
          return ref.set(data, opts);
        },
        update: (ref: any, updates: Record<string, any>) => {
          assertNoUndefined(updates);
          return ref.update(updates);
        },
        delete: (ref: any) => ref.delete(),
      };
      return fn(tx);
    },
  };

  return { docs, authUsers, reset, mockDb, assertNoUndefined };
});

class FakeFieldValue {
  constructor(public readonly methodName: string) {}
}

class FakeTimestamp {
  constructor(public readonly seconds: number) {}
}

vi.mock('firebase-admin/app', () => ({
  getApp: () => ({ name: '[DEFAULT]' }),
  getApps: () => [{ name: '[DEFAULT]' }],
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockState.mockDb,
  FieldValue: {
    serverTimestamp: () => new FakeFieldValue('FieldValue.serverTimestamp'),
    delete: () => new FakeFieldValue('FieldValue.delete'),
    increment: (n: number) => new FakeFieldValue(`FieldValue.increment(${n})`),
  },
  Timestamp: {
    fromMillis: (ms: number) => new FakeTimestamp(Math.floor(ms / 1000)),
  },
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    getUser: async (uid: string) => {
      const u = mockState.authUsers[uid];
      if (!u) {
        const err: any = new Error('User not found');
        err.code = 'auth/user-not-found';
        throw err;
      }
      return u;
    },
  }),
}));

import { buildAuditDocumentData, stripUndefined } from '../functions/src/audit';
import { applyBookingStatusChange } from '../functions/src/bookingHelpers';
import { createBookingSecure, updateBookingStatusSecure } from '../functions/src/bookingFunctions';
import { resolveMemberDiscount as resolveMemberDiscountClient, formatSavedBookingDiscountLabel } from '../src/shared/discount';
import { resolveMemberDiscount as resolveMemberDiscountServer } from '../functions/src/discount';
import { calculateRentalPrice, DEFAULT_SETTINGS } from '../src/services/pricing';
import { calculateRentalPriceServer } from '../functions/src/pricingServer';
import { AuthContext } from '../src/contexts/AuthContext';
import { DataContext } from '../src/contexts/DataContext';
import { CarDetailsView } from '../src/components/CarDetailsView';
import { AuthView } from '../src/components/AuthView';
import { BookingView } from '../src/components/BookingView';
import { BookingsTable } from '../src/components/admin/bookings/BookingsTable';
import { AdminBookingDetailsModal } from '../src/components/admin/AdminBookingDetailsModal';
import { BookingsTab } from '../src/components/profile/BookingsTab';
import { RentalContract } from '../src/components/RentalContract';
import { AppSettings, Booking, Vehicle } from '../src/types';

function hasUndefinedAtAnyDepth(val: unknown): boolean {
  if (val === undefined) return true;
  if (val === null || typeof val !== 'object') return false;
  if (Array.isArray(val)) return val.some(hasUndefinedAtAnyDepth);
  const proto = Object.getPrototypeOf(val);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(val).some(hasUndefinedAtAnyDepth);
}

function futureIsoDate(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

describe('Task 1: Firestore undefined prevention in auditLogs & booking transitions', () => {
  beforeEach(() => {
    mockState.reset();
  });

  it('stripUndefined removes nested undefined keys/elements while preserving null, primitives, Date, Timestamp, and FieldValue', () => {
    const sampleDate = new Date('2026-06-01T10:00:00Z');
    const serverTs = new FakeFieldValue('FieldValue.serverTimestamp');
    const fakeTs = new FakeTimestamp(1780000000);

    const cleaned = stripUndefined({
      keepZero: 0,
      keepFalse: false,
      keepEmpty: '',
      keepNull: null,
      dropTop: undefined,
      date: sampleDate,
      ts: fakeTs,
      fv: serverTs,
      nested: {
        a: 'ok',
        b: undefined,
        deeper: {
          x: undefined,
          y: 42,
        },
      },
      arr: [1, undefined, { inside: undefined, ok: true }],
    });

    expect(hasUndefinedAtAnyDepth(cleaned)).toBe(false);
    expect(cleaned.keepZero).toBe(0);
    expect(cleaned.keepFalse).toBe(false);
    expect(cleaned.keepEmpty).toBe('');
    expect(cleaned.keepNull).toBeNull();
    expect('dropTop' in cleaned).toBe(false);
    expect(cleaned.date).toBe(sampleDate);
    expect(cleaned.ts).toBe(fakeTs);
    expect(cleaned.fv).toBe(serverTs);
    expect(cleaned.nested).toEqual({ a: 'ok', deeper: { y: 42 } });
    expect(cleaned.arr).toEqual([1, { ok: true }]);
  });

  it('buildAuditDocumentData never outputs undefined at any depth and keeps FieldValue.serverTimestamp()', () => {
    const docData = buildAuditDocumentData('audit-1', {
      actorUid: 'super-1',
      actorEmail: 'super@shaker.sy',
      actorRole: 'super_admin',
      actorType: 'staff',
      action: 'STATUS_CHANGED',
      entity: 'booking',
      entityId: 'b-1',
      details: {
        note: 'رفض الحجز',
        missingField: undefined,
      },
      metadata: {
        previousStatus: 'new',
        newStatus: 'rejected',
        mileageAtPickup: undefined,
        mileageAtReturn: undefined,
        telegramUserId: undefined,
        nested: { deepUndefined: undefined, valid: 'yes' },
      },
    });

    expect(hasUndefinedAtAnyDepth(docData)).toBe(false);
    expect(docData.createdAt).toBeInstanceOf(FakeFieldValue);
    expect(docData.timestamp).toBeInstanceOf(FakeFieldValue);
    expect((docData.metadata as any).mileageAtPickup).toBeUndefined();
    expect('mileageAtPickup' in (docData.metadata as any)).toBe(false);
    expect('telegramUserId' in (docData.metadata as any)).toBe(false);
    expect((docData.metadata as any).nested).toEqual({ valid: 'yes' });
  });

  it('employee, admin, and super_admin can confirm, reject, and cancel bookings without Firestore undefined errors', async () => {
    const roles = ['employee', 'admin', 'super_admin'] as const;

    for (const role of roles) {
      mockState.reset();
      const uid = `staff-${role}`;
      const email = `${role}@shaker.sy`;
      mockState.authUsers[uid] = {
        uid,
        disabled: false,
        emailVerified: true,
        tokensValidAfterTime: null,
        providerData: [{ providerId: 'password' }],
      };
      mockState.docs[`users/${uid}`] = { uid, email, role };
      mockState.docs['vehicles/veh-1'] = {
        id: 'veh-1',
        brand: 'Kia',
        model: 'Cerato',
        year: 2024,
        status: 'available',
        isDeleted: false,
      };

      // Reject
      mockState.docs['bookings/b-reject'] = {
        id: 'b-reject',
        bookingNumber: '101',
        vehicleId: 'veh-1',
        customerId: 'cust-1',
        customerName: 'عميل تجريبي',
        status: 'new',
        totalPrice: 200,
      };
      const rejectRes = await (updateBookingStatusSecure as any).run({
        auth: { uid, token: { role, email, auth_time: Math.floor(Date.now() / 1000) } },
        data: { bookingId: 'b-reject', status: 'rejected', reason: 'عدم توفر السيارة' },
      });
      expect(rejectRes.success).toBe(true);
      expect(mockState.docs['bookings/b-reject'].status).toBe('rejected');

      // Confirm then Cancel
      mockState.docs['bookings/b-confirm'] = {
        id: 'b-confirm',
        bookingNumber: '102',
        vehicleId: 'veh-1',
        customerId: 'cust-1',
        customerName: 'عميل تجريبي',
        customerPhone: '+963944123456',
        customerAddress: 'دمشق - المزة فيلات غربية بناء 10',
        pickupDate: futureIsoDate(5),
        returnDate: futureIsoDate(8),
        dailyPrice: 100,
        basePrice: 300,
        discountAmount: 0,
        insuranceAmount: 300,
        totalPrice: 600,
        status: 'new',
      };
      const confirmRes = await (updateBookingStatusSecure as any).run({
        auth: { uid, token: { role, email, auth_time: Math.floor(Date.now() / 1000) } },
        data: { bookingId: 'b-confirm', status: 'confirmed' },
      });
      expect(confirmRes.success).toBe(true);
      expect(mockState.docs['bookings/b-confirm'].status).toBe('confirmed');

      const cancelRes = await applyBookingStatusChange(
        mockState.mockDb as any,
        'b-confirm',
        'cancelled',
        email,
        { actorUid: uid, actorEmail: email, actorRole: role, actorType: 'staff' }
      );
      expect(cancelRes.success).toBe(true);
      expect(mockState.docs['bookings/b-confirm'].status).toBe('cancelled');

      const auditEntries = Object.entries(mockState.docs).filter(([k]) => k.startsWith('auditLogs/'));
      expect(auditEntries.length).toBeGreaterThanOrEqual(3);
      for (const [, auditDoc] of auditEntries) {
        expect(hasUndefinedAtAnyDepth(auditDoc)).toBe(false);
        expect('mileageAtPickup' in (auditDoc.metadata || {})).toBe(false);
        expect('mileageAtReturn' in (auditDoc.metadata || {})).toBe(false);
        expect('telegramUserId' in (auditDoc.metadata || {})).toBe(false);
      }
    }
  });
});

describe('Task 2: Member discount resolver, client/server parity, live UI gating, and booking snapshot', () => {
  const sampleVehicle: Vehicle = {
    id: 'veh-doc-1',
    docId: 'veh-doc-1',
    dataId: 'veh-legacy-1',
    brand: 'كيا',
    model: 'سيراتو',
    year: 2024,
    color: 'أسود',
    category: 'medium',
    seats: 5,
    transmission: 'automatic',
    fuelType: 'petrol',
    dailyPrice: 100,
    plateNumber: '',
    currentMileage: 0,
    status: 'available',
    imageUrl: '',
    features: [],
    description: '',
  };

  const excludedVehicle: Vehicle = {
    ...sampleVehicle,
    id: 'veh-doc-2',
    docId: 'veh-doc-2',
    dataId: 'veh-legacy-2',
    model: 'سبورتاج',
  };

  beforeEach(() => {
    mockState.reset();
  });

  it('(a) resolveMemberDiscount handles all/specific, docId != data.id, 0%, disabled, rounding, guest vs logged-in, and unknown scopes (fail-closed)', () => {
    // Disabled
    expect(
      resolveMemberDiscountClient(
        { enabled: false, percentage: 15, scope: 'all', vehicleIds: [] },
        { vehicleId: 'veh-1', isUserLoggedIn: true }
      )
    ).toEqual({ eligible: false, applied: false, percentage: 0 });

    // 0%
    expect(
      resolveMemberDiscountClient(
        { enabled: true, percentage: 0, scope: 'all', vehicleIds: [] },
        { vehicleId: 'veh-1', isUserLoggedIn: true }
      )
    ).toEqual({ eligible: false, applied: false, percentage: 0 });

    // Fractional & clamped (>25)
    expect(
      resolveMemberDiscountClient(
        { enabled: true, percentage: 12.6, scope: 'all', vehicleIds: [] },
        { vehicleId: 'veh-1', isUserLoggedIn: false }
      )
    ).toEqual({ eligible: true, applied: false, percentage: 13 });
    expect(
      resolveMemberDiscountClient(
        { enabled: true, percentage: 40, scope: 'all', vehicleIds: [] },
        { vehicleId: 'veh-1', isUserLoggedIn: true }
      )
    ).toEqual({ eligible: true, applied: true, percentage: 25 });

    // Specific scope matching docId vs data.id
    const specificCfg = {
      enabled: true,
      percentage: 15,
      scope: 'specific',
      vehicleIds: ['veh-legacy-1'],
    };
    expect(
      resolveMemberDiscountClient(specificCfg, {
        vehicleId: 'veh-doc-1',
        vehicleDocId: 'veh-doc-1',
        vehicleDataId: 'veh-legacy-1',
        isUserLoggedIn: true,
      })
    ).toEqual({ eligible: true, applied: true, percentage: 15 });

    expect(
      resolveMemberDiscountClient(specificCfg, {
        vehicleId: 'veh-doc-2',
        vehicleDocId: 'veh-doc-2',
        vehicleDataId: 'veh-legacy-2',
        isUserLoggedIn: true,
      })
    ).toEqual({ eligible: false, applied: false, percentage: 0 });

    // Unknown / legacy scopes must fail closed
    for (const badScope of ['categories', 'vehicles', 'unknown', '', undefined, null]) {
      expect(
        resolveMemberDiscountClient(
          { enabled: true, percentage: 20, scope: badScope as any, vehicleIds: ['veh-doc-1'] },
          { vehicleId: 'veh-doc-1', isUserLoggedIn: true }
        )
      ).toEqual({ eligible: false, applied: false, percentage: 0 });
    }

    // Strict parity between client and server resolvers & pricing engines
    const configs = [
      { enabled: false, percentage: 10, scope: 'all', vehicleIds: [] },
      { enabled: true, percentage: 15, scope: 'all', vehicleIds: [] },
      { enabled: true, percentage: 18, scope: 'specific', vehicleIds: ['veh-legacy-1'] },
      { enabled: true, percentage: 20, scope: 'categories' as any, vehicleIds: ['veh-doc-1'] },
    ];
    for (const cfg of configs) {
      for (const isUserLoggedIn of [true, false]) {
        for (const v of [sampleVehicle, excludedVehicle]) {
          const clientRes = resolveMemberDiscountClient(cfg, {
            vehicleId: v.id,
            vehicleDocId: v.docId,
            vehicleDataId: v.dataId,
            isUserLoggedIn,
          });
          const serverRes = resolveMemberDiscountServer(cfg, {
            vehicleId: v.id,
            vehicleDocId: v.docId,
            vehicleDataId: v.dataId,
            isUserLoggedIn,
          });
          expect(clientRes).toEqual(serverRes);

          const settingsObj: AppSettings = { ...DEFAULT_SETTINGS, discountConfig: cfg as any };
          const clientPrice = calculateRentalPrice('medium', 100, 3, settingsObj, {
            isUserLoggedIn,
            vehicleId: v.id,
            vehicleDocId: v.docId,
            vehicleDataId: v.dataId,
          });
          const serverPrice = calculateRentalPriceServer(
            100,
            3,
            settingsObj,
            isUserLoggedIn,
            v.id,
            false,
            v.docId,
            v.dataId
          );
          expect(clientPrice.discountAmount).toBe(serverPrice.discountAmount);
          expect(clientPrice.memberDiscountApplied ? clientPrice.memberDiscountPercentage : 0).toBe(
            serverPrice.discountPercentage
          );
          expect(clientPrice.totalPrice).toBe(serverPrice.totalPrice);
        }
      }
    }
  });

  function renderWithContexts(
    element: React.ReactElement,
    options: { settings: AppSettings; settingsReady: boolean; user?: any }
  ): string {
    const authValue: any = {
      user: options.user ?? null,
      isLoadingAuth: false,
      isAdmin: false,
      isSuperAdmin: false,
      isEmployee: false,
      loginWithEmail: vi.fn(),
      registerWithEmail: vi.fn(),
      loginWithGoogle: vi.fn(),
      resetPassword: vi.fn(),
      logout: vi.fn(),
      mfaResolver: null,
      verifyMfaSignIn: vi.fn(),
      cancelMfaSignIn: vi.fn(),
    };
    const dataValue: any = {
      vehicles: [sampleVehicle, excludedVehicle],
      bookings: [],
      settings: options.settings,
      vehiclesReady: true,
      settingsReady: options.settingsReady,
      refreshData: vi.fn(),
      lastCreatedBooking: null,
      handleBookingCreated: vi.fn(),
      dismissLastBooking: vi.fn(),
    };

    return renderToStaticMarkup(
      React.createElement(
        AuthContext.Provider,
        { value: authValue },
        React.createElement(DataContext.Provider, { value: dataValue }, element)
      )
    );
  }

  it('(b) UI renders NO discount percentage or line while settings are loading (settingsReady = false)', () => {
    const activeSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      discountConfig: { enabled: true, percentage: 15, scope: 'all', vehicleIds: [] },
    };

    const carHtml = renderWithContexts(
      React.createElement(CarDetailsView, { vehicle: sampleVehicle }),
      { settings: activeSettings, settingsReady: false, user: { uid: 'u1', role: 'customer' } }
    );
    expect(carHtml).not.toContain('خصم الأعضاء');
    expect(carHtml).not.toContain('15%');

    const authHtml = renderWithContexts(
      React.createElement(AuthView, { initialMode: 'register' }),
      { settings: activeSettings, settingsReady: false }
    );
    expect(authHtml).not.toContain('15%');
    expect(authHtml).not.toContain('خصم حصري للأعضاء');
    expect(authHtml).toContain('إنشاء الحساب');
    expect(authHtml).not.toContain('تفعيل الخصم');

    const bookingHtml = renderWithContexts(
      React.createElement(BookingView, { vehicle: sampleVehicle, vehicles: [sampleVehicle] }),
      { settings: activeSettings, settingsReady: false, user: { uid: 'u1', role: 'customer' } }
    );
    expect(bookingHtml).not.toContain('15%');
    expect(bookingHtml).not.toContain('خصم حساب العضو');
  });

  it('(c) AuthView & CarDetailsView show percentage/generic message strictly by scope when settingsReady = true', () => {
    const allSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      discountConfig: { enabled: true, percentage: 15, scope: 'all', vehicleIds: [] },
    };
    const specificSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      discountConfig: { enabled: true, percentage: 15, scope: 'specific', vehicleIds: ['veh-legacy-1'] },
    };

    // AuthView: scope === 'all' shows percentage
    const authAll = renderWithContexts(React.createElement(AuthView, { initialMode: 'register' }), {
      settings: allSettings,
      settingsReady: true,
    });
    expect(authAll).toContain('15%');

    // AuthView: scope === 'specific' shows generic message WITHOUT number
    const authSpecific = renderWithContexts(React.createElement(AuthView, { initialMode: 'register' }), {
      settings: specificSettings,
      settingsReady: true,
    });
    expect(authSpecific).toContain('خصم خاص على سيارات مختارة');
    expect(authSpecific).not.toContain('15%');

    // CarDetailsView: included car shows 15%, excluded car does NOT
    const carIncluded = renderWithContexts(
      React.createElement(CarDetailsView, { vehicle: sampleVehicle }),
      { settings: specificSettings, settingsReady: true }
    );
    expect(carIncluded).toContain('خصم الأعضاء المسجلين');
    expect(carIncluded).toContain('15%');

    const carExcluded = renderWithContexts(
      React.createElement(CarDetailsView, { vehicle: excludedVehicle }),
      { settings: specificSettings, settingsReady: true }
    );
    expect(carExcluded).not.toContain('خصم الأعضاء المسجلين');
    expect(carExcluded).not.toContain('15%');

    // BookingView: guest on excluded car does NOT see 15% banner
    const bookingGuestExcluded = renderWithContexts(
      React.createElement(BookingView, { vehicle: excludedVehicle, vehicles: [excludedVehicle] }),
      { settings: specificSettings, settingsReady: true, user: null }
    );
    expect(bookingGuestExcluded).not.toContain('15%');
  });

  it('(d) createBookingSecure persists discountPercentage, discountBase, insuranceAmount, and driverFee on new bookings', async () => {
    mockState.authUsers['cust-1'] = {
      uid: 'cust-1',
      disabled: false,
      emailVerified: true,
      tokensValidAfterTime: null,
      providerData: [{ providerId: 'password' }],
    };
    mockState.docs['users/cust-1'] = {
      uid: 'cust-1',
      email: 'cust@example.com',
      role: 'customer',
    };
    mockState.docs['vehicles/veh-doc-1'] = {
      id: 'veh-legacy-1',
      brand: 'Kia',
      model: 'Cerato',
      year: 2024,
      category: 'medium',
      dailyPrice: 100,
      status: 'available',
      isDeleted: false,
    };
    mockState.docs['settings/global'] = {
      turnaroundBufferMinutes: 60,
      insuranceShortTerm: 500,
      insuranceLongTerm: 300,
      driverDailyRate: 40,
      discountConfig: {
        enabled: true,
        percentage: 15,
        scope: 'specific',
        vehicleIds: ['veh-legacy-1'],
      },
    };
    mockState.docs['settings/bookingCounterSimple'] = { count: 20 };

    const res = await (createBookingSecure as any).run({
      auth: {
        uid: 'cust-1',
        token: {
          role: 'customer',
          email: 'cust@example.com',
          auth_time: Math.floor(Date.now() / 1000),
        },
      },
      rawRequest: { ip: '127.0.0.1' },
      data: {
        vehicleId: 'veh-doc-1',
        customerName: 'عميل عضو',
        customerPhone: '0944123456',
        customerWhatsApp: '0944123456',
        customerAddress: 'دمشق - المزة فيلات غربية - جانب الحديقة بناء 12',
        pickupDate: futureIsoDate(5),
        pickupTime: '10:00',
        returnDate: futureIsoDate(9),
        returnTime: '10:00',
        withDriver: true,
      },
    });

    expect(res.success).toBe(true);
    const saved = mockState.docs[`bookings/${res.bookingId}`];
    expect(saved.basePrice).toBe(400);
    expect(saved.discountPercentage).toBe(15);
    expect(saved.discountBase).toBe(400);
    expect(saved.discountAmount).toBe(60);
    expect(saved.insuranceAmount).toBe(300);
    expect(saved.driverFee).toBe(160);
    expect(hasUndefinedAtAnyDepth(saved)).toBe(false);
  });

  it('(e) Saved bookings show "خصم عضو X% (-$Y من $Z إيجار)" and legacy bookings without discountPercentage never invent a percentage', () => {
    const newBooking: Booking = {
      id: 'b-new',
      bookingNumber: '501',
      vehicleId: 'veh-1',
      vehicleName: 'Kia Cerato (2024)',
      customerName: 'عميل جديد',
      customerPhone: '+963944111222',
      customerWhatsApp: '+963944111222',
      customerAddress: 'دمشق - المزة فيلات غربية بناء 1',
      pickupDate: '2026-12-01',
      pickupTime: '10:00',
      returnDate: '2026-12-03',
      returnTime: '10:00',
      rentalDays: 2,
      dailyPrice: 100,
      basePrice: 200,
      discountAmount: 20,
      discountPercentage: 10,
      discountBase: 200,
      insuranceAmount: 500,
      driverFee: 80,
      extraCharges: 25,
      totalPrice: 760,
      finalTotal: 785,
      status: 'completed',
      createdAt: '2026-11-01T10:00:00Z',
    };

    const legacyBooking: Booking = {
      ...newBooking,
      id: 'b-legacy',
      bookingNumber: '400',
      discountPercentage: undefined,
      discountBase: undefined,
      discountAmount: 20,
      driverFee: undefined,
      extraCharges: undefined,
      finalTotal: undefined,
      totalPrice: 680,
    };

    expect(
      formatSavedBookingDiscountLabel({
        discountAmount: newBooking.discountAmount,
        discountPercentage: newBooking.discountPercentage,
        discountBase: newBooking.discountBase,
        basePrice: newBooking.basePrice,
      })
    ).toBe('خصم عضو 10% (-$20 من $200 إيجار)');

    const legacyLabel = formatSavedBookingDiscountLabel({
      discountAmount: legacyBooking.discountAmount,
      discountPercentage: legacyBooking.discountPercentage,
      discountBase: legacyBooking.discountBase,
      basePrice: legacyBooking.basePrice,
    });
    expect(legacyLabel).toBe('خصم مطبق (-$20)');
    expect(legacyLabel).not.toContain('%');

    // BookingsTable (both mobile and desktop)
    const tableNewHtml = renderToStaticMarkup(
      React.createElement(BookingsTable, {
        paginatedBookings: [newBooking],
        totalFilteredCount: 1,
        selectedBookingIds: [],
        onToggleSelectAll: vi.fn(),
        onToggleSelectBooking: vi.fn(),
        userDocsMap: {},
        customerBookingStats: {},
        canDeleteBookings: true,
        onOpenDetails: vi.fn(),
        onUpdateStatus: vi.fn(),
        onOpenRejectModal: vi.fn(),
        onOpenHandover: vi.fn(),
        onOpenReturn: vi.fn(),
        onOpenContract: vi.fn(),
        onOpenDeleteConfirm: vi.fn(),
        currentPage: 1,
        totalPages: 1,
        onPageChange: vi.fn(),
      })
    );
    expect(tableNewHtml).toContain('خصم عضو 10% (-$20 من $200 إيجار)');

    const tableLegacyHtml = renderToStaticMarkup(
      React.createElement(BookingsTable, {
        paginatedBookings: [legacyBooking],
        totalFilteredCount: 1,
        selectedBookingIds: [],
        onToggleSelectAll: vi.fn(),
        onToggleSelectBooking: vi.fn(),
        userDocsMap: {},
        customerBookingStats: {},
        canDeleteBookings: true,
        onOpenDetails: vi.fn(),
        onUpdateStatus: vi.fn(),
        onOpenRejectModal: vi.fn(),
        onOpenHandover: vi.fn(),
        onOpenReturn: vi.fn(),
        onOpenContract: vi.fn(),
        onOpenDeleteConfirm: vi.fn(),
        currentPage: 1,
        totalPages: 1,
        onPageChange: vi.fn(),
      })
    );
    expect(tableLegacyHtml).toContain('خصم مطبق (-$20)');
    expect(tableLegacyHtml).not.toContain('10%');

    // AdminBookingDetailsModal full breakdown & legacy behavior
    const modalNewHtml = renderToStaticMarkup(
      React.createElement(AdminBookingDetailsModal, {
        booking: newBooking,
        vehicle: sampleVehicle,
        settings: DEFAULT_SETTINGS,
        onClose: vi.fn(),
        onUpdateStatus: vi.fn(),
      })
    );
    expect(modalNewHtml).toContain('خصم عضو 10% (-$20 من $200 إيجار)');
    expect(modalNewHtml).toContain('الإيجار');
    expect(modalNewHtml).toContain('الخصم');
    expect(modalNewHtml).toContain('التأمين المسترد');
    expect(modalNewHtml).toContain('السائق');
    expect(modalNewHtml).toContain('الإضافي');
    expect(modalNewHtml).toContain('الإجمالي');

    const modalLegacyHtml = renderToStaticMarkup(
      React.createElement(AdminBookingDetailsModal, {
        booking: legacyBooking,
        vehicle: sampleVehicle,
        settings: DEFAULT_SETTINGS,
        onClose: vi.fn(),
        onUpdateStatus: vi.fn(),
      })
    );
    expect(modalLegacyHtml).toContain('خصم مطبق (-$20)');
    expect(modalLegacyHtml).not.toContain('10%');

    // BookingsTab (حجوزاتي)
    const tabNewHtml = renderToStaticMarkup(
      React.createElement(BookingsTab, {
        sortedBookings: [newBooking],
        directCustomerBookings: [newBooking],
        bookingsTimedOut: false,
        bookingsError: null,
        isRetryingBookings: false,
        onRetryBookings: vi.fn(),
        cancelTarget: null,
        onCancelTargetChange: vi.fn(),
        isCancelling: false,
        cancelError: null,
        onClearCancelError: vi.fn(),
        onConfirmCancel: vi.fn(),
        onOpenBooking: vi.fn(),
      })
    );
    expect(tabNewHtml).toContain('خصم عضو 10% (-$20 من $200 إيجار)');

    const tabLegacyHtml = renderToStaticMarkup(
      React.createElement(BookingsTab, {
        sortedBookings: [legacyBooking],
        directCustomerBookings: [legacyBooking],
        bookingsTimedOut: false,
        bookingsError: null,
        isRetryingBookings: false,
        onRetryBookings: vi.fn(),
        cancelTarget: null,
        onCancelTargetChange: vi.fn(),
        isCancelling: false,
        cancelError: null,
        onClearCancelError: vi.fn(),
        onConfirmCancel: vi.fn(),
        onOpenBooking: vi.fn(),
      })
    );
    expect(tabLegacyHtml).toContain('خصم مطبق (-$20)');
    expect(tabLegacyHtml).not.toContain('10%');

    // RentalContract
    const contractNewHtml = renderToStaticMarkup(
      React.createElement(RentalContract, {
        booking: newBooking,
        vehicle: sampleVehicle,
        settings: DEFAULT_SETTINGS,
        onBack: vi.fn(),
      })
    );
    expect(contractNewHtml).toContain('خصم عضو 10% (-$20 من $200 إيجار)');

    const contractLegacyHtml = renderToStaticMarkup(
      React.createElement(RentalContract, {
        booking: legacyBooking,
        vehicle: sampleVehicle,
        settings: DEFAULT_SETTINGS,
        onBack: vi.fn(),
      })
    );
    expect(contractLegacyHtml).toContain('خصم مطبق (-$20)');
    expect(contractLegacyHtml).not.toContain('10%');
  });
});
