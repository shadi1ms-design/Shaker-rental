import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = vi.hoisted(() => {
  let autoId = 0;
  const docs: Record<string, Record<string, any>> = {};
  const authUsers: Record<string, any> = {};

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
            docs[key] = opts?.merge && docs[key] ? { ...docs[key], ...data } : { ...data };
          },
          update: async (updates: Record<string, any>) => {
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
        set: (ref: any, data: Record<string, any>, opts?: { merge?: boolean }) =>
          ref.set(data, opts),
        update: (ref: any, updates: Record<string, any>) => ref.update(updates),
        delete: (ref: any) => ref.delete(),
      };
      return fn(tx);
    },
  };

  return { docs, authUsers, reset, mockDb };
});

vi.mock('firebase-admin/app', () => ({
  getApp: () => ({ name: '[DEFAULT]' }),
  getApps: () => [{ name: '[DEFAULT]' }],
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockState.mockDb,
  FieldValue: {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    delete: () => 'FIELD_DELETE',
  },
  Timestamp: {
    fromMillis: (ms: number) => ({ toMillis: () => ms }),
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

import { createBookingSecure } from '../functions/src/bookingFunctions';

function futureIsoDate(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

describe('Booking creation with deliveryLocation for unverified customers', () => {
  beforeEach(() => {
    mockState.reset();
    mockState.authUsers['cust-unverified'] = {
      uid: 'cust-unverified',
      disabled: false,
      emailVerified: true,
      tokensValidAfterTime: null,
      providerData: [{ providerId: 'password' }],
    };
    mockState.docs['users/cust-unverified'] = {
      uid: 'cust-unverified',
      email: 'unverified@example.com',
      role: 'customer',
      verified: false,
      verificationStatus: 'not_started',
    };
    mockState.docs['vehicles/veh-1'] = {
      id: 'veh-1',
      brand: 'Kia',
      model: 'Cerato',
      year: 2024,
      category: 'medium',
      dailyPrice: 50,
      status: 'available',
      isDeleted: false,
    };
    mockState.docs['settings/global'] = {
      turnaroundBufferMinutes: 60,
    };
    mockState.docs['settings/bookingCounterSimple'] = {
      count: 10,
    };
  });

  it('allows an unverified customer to create a booking with deliveryLocation and sanitizes/caps it at 150 chars', async () => {
    const res = await (createBookingSecure as any).run({
      auth: {
        uid: 'cust-unverified',
        token: {
          role: 'customer',
          email: 'unverified@example.com',
          auth_time: Math.floor(Date.now() / 1000),
        },
      },
      rawRequest: { ip: '127.0.0.1' },
      data: {
        vehicleId: 'veh-1',
        customerName: 'عميل غير موثق',
        customerPhone: '0944123456',
        customerWhatsApp: '0944123456',
        customerAddress: 'دمشق - المزة فيلات غربية - جانب حديقة الجلاء',
        pickupDate: futureIsoDate(5),
        pickupTime: '10:00',
        returnDate: futureIsoDate(8),
        returnTime: '10:00',
        deliveryLocation: '   دمشق - المزة فيلات غربية - جانب السفارة   ',
      },
    });

    expect(res.success).toBe(true);
    expect(res.bookingNumber).toBe('11');
    expect(res.booking.deliveryLocation).toBe('دمشق - المزة فيلات غربية - جانب السفارة');
    expect(res.booking.customerVerified).toBeUndefined();

    const storedBooking = mockState.docs[`bookings/${res.bookingId}`];
    expect(storedBooking).toBeDefined();
    expect(storedBooking.deliveryLocation).toBe('دمشق - المزة فيلات غربية - جانب السفارة');
    expect(storedBooking.customerVerified).toBeUndefined();
  });

  it('truncates oversized deliveryLocation to 150 characters for unverified customer', async () => {
    const longLocation = 'أ'.repeat(220);

    const res = await (createBookingSecure as any).run({
      auth: {
        uid: 'cust-unverified',
        token: {
          role: 'customer',
          email: 'unverified@example.com',
          auth_time: Math.floor(Date.now() / 1000),
        },
      },
      rawRequest: { ip: '127.0.0.2' },
      data: {
        vehicleId: 'veh-1',
        customerName: 'عميل غير موثق',
        customerPhone: '0944123456',
        customerWhatsApp: '0944123456',
        customerAddress: 'دمشق - المزة فيلات غربية - جانب حديقة الجلاء',
        pickupDate: futureIsoDate(10),
        pickupTime: '10:00',
        returnDate: futureIsoDate(12),
        returnTime: '10:00',
        deliveryLocation: `   ${longLocation}   `,
      },
    });

    expect(res.success).toBe(true);
    expect(res.booking.deliveryLocation).toHaveLength(150);
  });
});
