import {
  Vehicle,
  Booking,
  Customer,
  VehicleInspection,
  AppSettings,
  BookingStatus,
  AuditLog,
  AppNotification,
  FirestoreUser,
  UserFileRecord
} from '../types';
import * as seedData from '../data/seedData';

const INITIAL_VEHICLES = import.meta.env.DEV ? seedData.INITIAL_VEHICLES : [];
const INITIAL_UPLOADED_FILES = import.meta.env.DEV ? seedData.INITIAL_UPLOADED_FILES : {};
import { DEFAULT_SETTINGS, calculateRentalDays, calculateRentalPrice } from './pricing';
import { auth, db, functions, isFirebaseConfigured, firestoreDatabaseId, getDb as getFirebaseDb } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  DocumentData,
  UpdateData
} from 'firebase/firestore';
import { storageService } from './storageService';
import { functionsService } from './functionsService';
import { handleFirestoreError } from '../utils/firebaseErrorHandler';
import { todayLocalISO } from '../utils/dateUtils';
import { Firestore } from 'firebase/firestore';

const getDb = (): Firestore => {
  return getFirebaseDb();
};
// Storage keys for local persistence (STRICTLY NON-SENSITIVE / PUBLIC DATA ONLY)
export const STORAGE_KEYS = {
  // Public Fleet Data (Safe for fast initial rendering & offline catalog browsing)
  VEHICLES: 'shaker_vehicles_v1',
  // Public Business Configuration (Company name, public phone, insurance rates)
  SETTINGS: 'shaker_settings_v1',
  // Vehicle condition checklists (fuel level, odometer, vehicle exterior/interior condition)
  INSPECTIONS: 'shaker_inspections_v1',
  // Non-sensitive Operational UI Notifications
  NOTIFICATIONS: 'shaker_notifications_v1',
  // Sequence counter
  BOOKING_COUNTER: 'shaker_booking_counter_v1',
};

// Whitelist of keys explicitly permitted in localStorage (Non-sensitive / Public only)
const PERMITTED_STORAGE_KEYS = new Set<string>([
  STORAGE_KEYS.VEHICLES,
  STORAGE_KEYS.SETTINGS,
  STORAGE_KEYS.INSPECTIONS,
  STORAGE_KEYS.NOTIFICATIONS,
  STORAGE_KEYS.BOOKING_COUNTER,
]);

// Sensitive field patterns strictly blocked from localStorage
const SENSITIVE_KEYWORD_PATTERNS = [
  /national_?id/i,
  /passport/i,
  /driving_?license/i,
  /license_?number/i,
  /private_?doc/i,
  /auth_token/i,
  /secret/i,
  /password/i,
  /id_?front/i,
  /id_?back/i,
];

// Safe localStorage loader
function getLocalItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch {
    return fallback;
  }
}

// Protected localStorage setter: Rejects unpermitted keys and blocks sensitive PII payloads
function setLocalItem<T>(key: string, data: T): void {
  if (!PERMITTED_STORAGE_KEYS.has(key)) {
    console.warn(`[Security Policy] Blocked unauthorized attempt to write key to localStorage: "${key}"`);
    return;
  }

  try {
    const serialized = JSON.stringify(data);
    for (const pattern of SENSITIVE_KEYWORD_PATTERNS) {
      if (pattern.test(serialized)) {
        console.warn(`[Security Policy] Blocked payload containing sensitive data (${pattern}) in key "${key}"`);
        return;
      }
    }
    localStorage.setItem(key, serialized);
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }
}

/**
 * Permanently purges all sensitive customer, booking, auth, user, and financial data from browser storage
 */
export function purgeSensitiveStorage(): void {
  try {
    // 1. Explicitly remove all known sensitive keys
    const knownSensitiveKeys = [
      'shaker_customers_v1',
      'shaker_uploaded_files_v1',
      'shaker_firestore_users_v1',
      'shaker_bookings_v1',
      'shaker_audit_v1',
      'shaker_auth_session_v1',
      'shaker_demo_users_v1',
    ];
    for (const k of knownSensitiveKeys) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }

    // 2. Comprehensive defensive scan: remove any key not explicitly in PERMITTED_STORAGE_KEYS
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !PERMITTED_STORAGE_KEYS.has(k)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });

    // 3. Clear sessionStorage
    try {
      sessionStorage.clear();
    } catch {}

    // 4. Reset sensitive volatile in-memory collections
    memoryCache.bookings = null;
    memoryCache.customers = null;
    memoryCache.users = null;
    memoryCache.auditLogs = null;
  } catch (e) {
    console.warn('Storage purge error:', e);
  }
}

// Safe async Firestore runner with timeout to prevent hangs when offline/slow
async function safeFirestore<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> {
  const effectiveTimeout = timeoutMs;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('Firestore connection timeout') as Error & { code?: string };
      err.code = 'unavailable';
      reject(err);
    }, effectiveTimeout);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

// High-performance in-memory cache to eliminate redundant network roundtrips
// Sensitive collections (bookings, customers, users, payments) live in volatile RAM only
interface MemoryCache {
  vehicles: { data: Vehicle[]; timestamp: number } | null;
  bookings: { data: Booking[]; timestamp: number } | null;
  settings: { data: AppSettings; timestamp: number } | null;
  users: { data: FirestoreUser[]; timestamp: number } | null;
  customers: { data: Customer[]; timestamp: number } | null;
  notifications?: { data: AppNotification[]; timestamp: number } | null;
  auditLogs?: { data: AuditLog[]; timestamp: number } | null;
}

const memoryCache: MemoryCache = {
  vehicles: null,
  bookings: null,
  settings: null,
  users: null,
  customers: null,
  notifications: null,
  auditLogs: null,
};

const CACHE_TTL_MS = 15000; // 15 seconds TTL for instant responsiveness

// Initial bootstrap check: Purges sensitive data and initializes public catalogs only
function initStorage() {
  purgeSensitiveStorage();

  if (!localStorage.getItem(STORAGE_KEYS.VEHICLES)) {
    setLocalItem(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    setLocalItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.BOOKING_COUNTER)) {
    setLocalItem(STORAGE_KEYS.BOOKING_COUNTER, 3);
  }
}

initStorage();

// Module-level cache for resolved custom claims to keep isStaffOrAdmin() 100% synchronous
let cachedUserClaims: Record<string, unknown> | null = null;

if (auth) {
  try {
    auth.onIdTokenChanged(async (user) => {
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult();
          cachedUserClaims = tokenResult.claims || null;
        } catch {
          cachedUserClaims = null;
        }
      } else {
        cachedUserClaims = null;
      }
    });
  } catch (err) {
    console.warn('Auth token listener init warning:', err);
  }
}

function isStaffOrAdmin(): boolean {
  if (!auth?.currentUser) return false;

  // 1. Check asynchronously refreshed module-level token claims cache
  if (cachedUserClaims) {
    const role = (cachedUserClaims.role || '').toString().toLowerCase().trim();
    if (
      cachedUserClaims.super_admin ||
      cachedUserClaims.superAdmin ||
      cachedUserClaims.admin ||
      cachedUserClaims.employee ||
      cachedUserClaims.staff ||
      role === 'admin' ||
      role === 'super_admin' ||
      role === 'employee' ||
      role === 'staff'
    ) {
      return true;
    }
  }

  // 2. Direct synchronous check on reloadUserInfo.customAttributes from currentUser instance
  const claims = (auth.currentUser as unknown as { reloadUserInfo?: { customAttributes?: unknown } })?.reloadUserInfo?.customAttributes;
  try {
    const parsedClaims = claims ? (typeof claims === 'string' ? JSON.parse(claims) : claims) : {};
    const role = (parsedClaims?.role || '').toString().toLowerCase().trim();
    return Boolean(
      parsedClaims?.super_admin ||
      parsedClaims?.superAdmin ||
      parsedClaims?.admin ||
      parsedClaims?.employee ||
      parsedClaims?.staff ||
      role === 'admin' ||
      role === 'super_admin' ||
      role === 'employee' ||
      role === 'staff'
    );
  } catch {
    return false;
  }
}

export const dataService = {
  // -------------------------------------------------------------
  // Synchronous Cache Accessors for Zero-Latency First Paint
  // -------------------------------------------------------------
  getCachedVehicles(): Vehicle[] {
    if (memoryCache.vehicles?.data) return memoryCache.vehicles.data;
    const local = getLocalItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    memoryCache.vehicles = { data: local, timestamp: Date.now() };
    return local;
  },

  // Sensitive collections return from volatile in-memory cache ONLY (never localStorage)
  getCachedBookings(): Booking[] {
    return memoryCache.bookings?.data || [];
  },

  getCachedSettings(): AppSettings {
    if (memoryCache.settings?.data) return memoryCache.settings.data;
    const local = getLocalItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    memoryCache.settings = { data: local, timestamp: Date.now() };
    return local;
  },

  getCachedCustomers(): Customer[] {
    return memoryCache.customers?.data || [];
  },


  getCachedUsers(): FirestoreUser[] {
    return memoryCache.users?.data || [];
  },

  clearSensitiveMemoryCache(): void {
    memoryCache.bookings = null;
    memoryCache.customers = null;
    memoryCache.users = null;
    memoryCache.notifications = null;
  },

  purgeSensitiveStorage(): void {
    purgeSensitiveStorage();
  },

  // -------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------
  async getSettings(forceRefresh = false): Promise<AppSettings> {
    if (!forceRefresh && memoryCache.settings && Date.now() - memoryCache.settings.timestamp < CACHE_TTL_MS) {
      return memoryCache.settings.data;
    }

    if (isFirebaseConfigured && db) {
      try {
        const globalRef = doc(getDb(), 'settings', 'global');
        const globalSnap = await safeFirestore(getDoc(globalRef), 2000);
        if (globalSnap.exists()) {
          const data = globalSnap.data() as AppSettings;
          setLocalItem(STORAGE_KEYS.SETTINGS, data);
          memoryCache.settings = { data, timestamp: Date.now() };
          return data;
        }
      } catch (err: unknown) {
        const errObj = typeof err === 'object' && err !== null ? (err as { code?: string }) : null;
        if (errObj?.code !== 'unavailable') {
          handleFirestoreError('settings', 'global', 'read', err, auth?.currentUser?.uid);
        }
      }
    }
    const local = getLocalItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    memoryCache.settings = { data: local, timestamp: Date.now() };
    return local;
  },

  async updateSettings(settingsUpdates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...settingsUpdates,
      updatedAt: new Date().toISOString(),
    };

    setLocalItem(STORAGE_KEYS.SETTINGS, updated);
    memoryCache.settings = { data: updated, timestamp: Date.now() };
    this.logAudit('تحديث إعدادات الشركة والنظام والأسعار', 'settings', 'global');
    return updated;
  },

  async ensureDefaultSettings(): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const globalRef = doc(getDb(), 'settings', 'global');
        const snap = await safeFirestore(getDoc(globalRef), 2000);
        if (!snap.exists()) {
          // Document settings/global is managed by functionsService or server
        }
      } catch {
        // Unauthenticated visitor or offline mode will safely skip
      }
    }
  },

  // -------------------------------------------------------------
  // Vehicles (Fleet Management & Cloud Database Sync)
  // -------------------------------------------------------------
  mergeVehicles(primary: Vehicle[], fallback: Vehicle[]): Vehicle[] {
    const map = new Map<string, Vehicle>();
    if (Array.isArray(fallback)) {
      fallback.forEach((v) => {
        if (v && v.id) map.set(v.id, v);
      });
    }
    if (Array.isArray(primary)) {
      primary.forEach((v) => {
        if (v && v.id) {
          const existing = map.get(v.id);
          map.set(v.id, existing ? { ...existing, ...v } : v);
        }
      });
    }
    return Array.from(map.values());
  },

  async ensureVehiclesInFirestore(): Promise<{ total: number; seeded: number; remoteCount: number }> {
    const localVehicles = getLocalItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    if (!isFirebaseConfigured || !db) {
      return { total: localVehicles.length, seeded: 0, remoteCount: 0 };
    }

    try {
      const col = collection(getDb(), 'vehicles');
      const snap = await safeFirestore(getDocs(col), 3500);
      const remoteDocs = snap.docs.map((d) => d.data() as Vehicle).filter((v) => !v.isDeleted);
      const remoteIds = new Set(remoteDocs.map((d) => d.id));

      const missingToSeed: Vehicle[] = [];

      // Check all initial seed vehicles
      for (const seedV of INITIAL_VEHICLES) {
        if (!remoteIds.has(seedV.id)) {
          const localV = localVehicles.find((lv) => lv.id === seedV.id);
          missingToSeed.push(localV || seedV);
        }
      }

      // Check any local custom vehicles
      for (const localV of localVehicles) {
        if (!remoteIds.has(localV.id) && !missingToSeed.some((m) => m.id === localV.id)) {
          missingToSeed.push(localV);
        }
      }

      if (missingToSeed.length > 0) {
        await Promise.allSettled(
          missingToSeed.map((v) =>
            safeFirestore(setDoc(doc(getDb(), 'vehicles', v.id), v, { merge: true }), 2500)
          )
        );
      }

      const merged = this.mergeVehicles(remoteDocs, [...localVehicles, ...missingToSeed]);
      setLocalItem(STORAGE_KEYS.VEHICLES, merged);

      return {
        total: merged.length,
        seeded: missingToSeed.length,
        remoteCount: remoteDocs.length + missingToSeed.length,
      };
    } catch (err) {
      console.warn('ensureVehiclesInFirestore note:', err);
      return { total: localVehicles.length, seeded: 0, remoteCount: 0 };
    }
  },

  async ensureBookingsInFirestore(): Promise<{ total: number; seeded: number; remoteCount: number }> {
    if (!isFirebaseConfigured || !db) {
      return { total: memoryCache.bookings?.data?.length || 0, seeded: 0, remoteCount: 0 };
    }

    try {
      const col = collection(getDb(), 'bookings');
      const snap = await safeFirestore(getDocs(col), 3500);
      const remoteDocs = snap.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt || new Date().toISOString(),
        } as Booking;
      }).filter((b) => !b.isDeleted);
      memoryCache.bookings = { data: remoteDocs, timestamp: Date.now() };

      return {
        total: remoteDocs.length,
        seeded: 0,
        remoteCount: remoteDocs.length,
      };
    } catch (err) {
      console.warn('ensureBookingsInFirestore note:', err);
      return { total: memoryCache.bookings?.data?.length || 0, seeded: 0, remoteCount: 0 };
    }
  },

  async syncAllSystemData(): Promise<{
    vehicles: { total: number; seeded: number; remoteCount: number };
    bookings: { total: number; seeded: number; remoteCount: number };
    isCloudConnected: boolean;
  }> {
    const isCloudConnected = Boolean(isFirebaseConfigured && db);
    const currentVehicles = await this.getVehicles(true).catch(() => []);
    const bookResult = await this.ensureBookingsInFirestore();
    return {
      vehicles: { total: currentVehicles.length, seeded: 0, remoteCount: currentVehicles.length },
      bookings: bookResult,
      isCloudConnected,
    };
  },

  /**
   * Fetches sensitive vehicle internal details (plateNumber, mileage)
   * stored in vehicles/{id}/internal/details subcollection. Restricted by security rules to staff/admin.
   */
  async fetchVehicleInternalDetails(vehicleId: string): Promise<{ plateNumber?: string; currentMileage?: number } | null> {
    if (!isFirebaseConfigured || !db || !isStaffOrAdmin()) return null;
    try {
      const cleanId = (vehicleId || '').trim();
      if (!cleanId) return null;
      const internalDocRef = doc(getDb(), 'vehicles', cleanId, 'internal', 'details');
      const snap = await safeFirestore(getDoc(internalDocRef), 2000);
      if (snap.exists()) {
        return snap.data() as { plateNumber?: string; currentMileage?: number };
      }
    } catch {
      // Gracefully silent if not authorized (customers/visitors)
    }
    return null;
  },

  /**
   * Enriches vehicles with sensitive internal details if caller is staff/admin.
   * Strips sensitive fields (plateNumber, mileage) for public visitors and regular customers.
   */
  async enrichVehiclesWithInternalDetails(vehicles: Vehicle[]): Promise<Vehicle[]> {
    if (!isStaffOrAdmin()) {
      return vehicles.map((v) => ({
        ...v,
        plateNumber: '',
        currentMileage: 0,
      }));
    }

    try {
      const enriched = await Promise.all(
        vehicles.map(async (v) => {
          const internal = await this.fetchVehicleInternalDetails(v.id);
          if (internal) {
            return {
              ...v,
              plateNumber: internal.plateNumber ?? v.plateNumber ?? '',
              currentMileage: internal.currentMileage ?? v.currentMileage ?? 0,
            };
          }
          return v;
        })
      );
      return enriched;
    } catch (err) {
      console.warn('Error enriching vehicles with internal details:', err);
      return vehicles;
    }
  },

  async getVehicles(forceRefresh = false): Promise<Vehicle[]> {
    if (!forceRefresh && memoryCache.vehicles && Date.now() - memoryCache.vehicles.timestamp < CACHE_TTL_MS) {
      return memoryCache.vehicles.data;
    }

    const localVehicles = getLocalItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);

    if (isFirebaseConfigured && db) {
      try {
        const col = collection(getDb(), 'vehicles');
        const snap = await safeFirestore(getDocs(col), 2500);
        const docs = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              ...data,
              id: d.id,
            } as Vehicle;
          })
          .filter((v) => !v.isDeleted);

        const today = todayLocalISO();
        const bookings = memoryCache.bookings?.data || [];
        const activeRentedIds = new Set(
          bookings
            .filter(
              (b) =>
                !b.isDeleted &&
                (b.status === 'rented' ||
                  (b.status === 'confirmed' && b.pickupDate <= today && b.returnDate >= today))
            )
            .map((b) => b.vehicleId)
        );

        const processed = docs.map((v) => {
          if (v.status !== 'maintenance' && v.status !== 'inactive' && activeRentedIds.has(v.id)) {
            return { ...v, status: 'rented' as const };
          }
          return v;
        });

        const finalVehicles = await this.enrichVehiclesWithInternalDetails(processed);
        setLocalItem(STORAGE_KEYS.VEHICLES, finalVehicles);
        memoryCache.vehicles = { data: finalVehicles, timestamp: Date.now() };
        return finalVehicles;
      } catch (err: unknown) {
        const errObj = typeof err === 'object' && err !== null ? (err as { code?: string }) : null;
        if (errObj?.code !== 'unavailable') {
          console.warn('Firestore vehicles query note, using local cache:', err);
        }
      }
    }

    const today = todayLocalISO();
    const bookings = memoryCache.bookings?.data || [];
    const activeRentedIds = new Set(
      bookings
        .filter(
          (b) =>
            !b.isDeleted &&
            (b.status === 'rented' ||
              (b.status === 'confirmed' && b.pickupDate <= today && b.returnDate >= today))
        )
        .map((b) => b.vehicleId)
    );

    const localProcessed = localVehicles
      .filter((v) => !v.isDeleted)
      .map((v) => {
        if (v.status !== 'maintenance' && v.status !== 'inactive' && activeRentedIds.has(v.id)) {
          return { ...v, status: 'rented' as const };
        }
        return v;
      });

    memoryCache.vehicles = { data: localProcessed, timestamp: Date.now() };
    return localProcessed;
  },

  /**
   * Real-time subscription to vehicles fleet collection.
   * Updates memoryCache and localStorage on snapshot, with graceful offline fallback.
   * Returns an unsubscribe callback.
   */
  subscribeToVehicles(callback: (vehicles: Vehicle[]) => void): () => void {
    if (!isFirebaseConfigured || !db) {
      this.getVehicles()
        .then(callback)
        .catch((err) => console.warn('Fallback getVehicles note:', err));
      return () => {};
    }

    try {
      const col = collection(getDb(), 'vehicles');
      const unsubscribe = onSnapshot(
        col,
        (snap) => {
          try {
            const docs = snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  ...data,
                  id: d.id,
                } as Vehicle;
              })
              .filter((v) => !v.isDeleted);

            const today = todayLocalISO();
            const bookings = memoryCache.bookings?.data || [];
            const activeRentedIds = new Set(
              bookings
                .filter(
                  (b) =>
                    !b.isDeleted &&
                    (b.status === 'rented' ||
                      (b.status === 'confirmed' && b.pickupDate <= today && b.returnDate >= today))
                )
                .map((b) => b.vehicleId)
            );

            const processed = docs.map((v) => {
              if (v.status !== 'maintenance' && v.status !== 'inactive' && activeRentedIds.has(v.id)) {
                return { ...v, status: 'rented' as const };
              }
              return v;
            });

            this.enrichVehiclesWithInternalDetails(processed).then((finalVehicles) => {
              setLocalItem(STORAGE_KEYS.VEHICLES, finalVehicles);
              memoryCache.vehicles = { data: finalVehicles, timestamp: Date.now() };
              callback(finalVehicles);
            });
          } catch (procErr) {
            console.warn('Error processing vehicles snapshot:', procErr);
          }
        },
        (err) => {
          console.warn('onSnapshot vehicles note, falling back to cached/getVehicles:', err);
          this.getVehicles()
            .then(callback)
            .catch((e) => console.warn('Fallback getVehicles failed:', e));
        }
      );

      return () => {
        try {
          unsubscribe();
        } catch (unsubErr) {
          console.warn('Error unsubscribing from vehicles:', unsubErr);
        }
      };
    } catch (err) {
      console.warn('Error establishing onSnapshot for vehicles:', err);
      this.getVehicles()
        .then(callback)
        .catch((e) => console.warn('Fallback getVehicles failed:', e));
      return () => {};
    }
  },

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const cleanId = (id || '').trim();
    if (!cleanId) return null;

    const vehicles = await this.getVehicles();
    const match = vehicles.find(
      (v) =>
        v.id === cleanId ||
        v.id.toLowerCase() === cleanId.toLowerCase() ||
        v.plateNumber === cleanId
    );
    if (match) return match;

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(getDb(), 'vehicles', cleanId);
        const snap = await safeFirestore(getDoc(docRef), 2000);
        if (snap.exists()) {
          const v = { ...snap.data(), id: snap.id } as Vehicle;
          if (isStaffOrAdmin()) {
            const internal = await this.fetchVehicleInternalDetails(v.id || cleanId);
            if (internal) {
              return {
                ...v,
                plateNumber: internal.plateNumber ?? v.plateNumber ?? '',
                currentMileage: internal.currentMileage ?? v.currentMileage ?? 0,
              };
            }
            return v;
          } else {
            return {
              ...v,
              plateNumber: '',
              currentMileage: 0,
            };
          }
        }
      } catch (err) {
        console.warn('getVehicleById note:', err);
      }
    }

    return (
      INITIAL_VEHICLES.find(
        (v) => v.id === cleanId || v.id.toLowerCase() === cleanId.toLowerCase()
      ) || null
    );
  },

  async addVehicle(vehicleData: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    const id = `veh-${Date.now()}`;
    const { plateNumber, currentMileage, ...publicVehicleFields } = vehicleData;
    const newVehicle: Vehicle = {
      ...publicVehicleFields,
      plateNumber: plateNumber || '',
      currentMileage: currentMileage || 0,
      id,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        // Save general public fields to parent doc (plateNumber & mileage excluded)
        const publicDoc = {
          ...publicVehicleFields,
          id,
          isDeleted: false,
          createdAt: newVehicle.createdAt,
          updatedAt: newVehicle.updatedAt,
        };
        await safeFirestore(setDoc(doc(getDb(), 'vehicles', id), publicDoc, { merge: true }), 2500);

        // Save sensitive plate and mileage fields to vehicles/{id}/internal/details subcollection
        await safeFirestore(
          setDoc(
            doc(getDb(), 'vehicles', id, 'internal', 'details'),
            {
              plateNumber: plateNumber || '',
              currentMileage: currentMileage || 0,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          ),
          2500
        );
      } catch (err) {
        console.warn('Firestore addVehicle error:', err);
      }
    }

    const current = getLocalItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    setLocalItem(STORAGE_KEYS.VEHICLES, [newVehicle, ...current]);
    this.logAudit(`إضافة سيارة جديدة: ${newVehicle.brand} ${newVehicle.model}`, 'vehicles', id);
    return newVehicle;
  },

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
    const cleanId = (id || '').trim();
    let current = getLocalItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    let index = current.findIndex(
      (v) =>
        v.id === cleanId ||
        v.id.toLowerCase() === cleanId.toLowerCase() ||
        v.plateNumber === cleanId
    );

    if (index === -1) {
      const seed = INITIAL_VEHICLES.find(
        (v) => v.id === cleanId || v.id.toLowerCase() === cleanId.toLowerCase()
      );
      if (seed) {
        current = [seed, ...current];
        index = 0;
      }
    }

    if (index === -1) {
      if (isFirebaseConfigured && db) {
        try {
          const snap = await safeFirestore(getDoc(doc(getDb(), 'vehicles', cleanId)), 2000);
          if (snap.exists()) {
            const v = snap.data() as Vehicle;
            current = [v, ...current];
            index = 0;
          }
        } catch {}
      }
    }

    if (index === -1) throw new Error(`السيارة (${cleanId}) غير موجودة`);

    const updated: Vehicle = {
      ...current[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    current[index] = updated;
    setLocalItem(STORAGE_KEYS.VEHICLES, current);

    if (isFirebaseConfigured && db) {
      try {
        const { plateNumber, currentMileage, ...publicUpdates } = updates;

        // Update public vehicle document
        if (Object.keys(publicUpdates).length > 0) {
          await safeFirestore(
            setDoc(doc(getDb(), 'vehicles', updated.id), { ...publicUpdates, updatedAt: updated.updatedAt }, { merge: true }),
            3000
          );
        }

        // Update sensitive fields in vehicles/{id}/internal/details subcollection
        const hasInternalUpdates =
          plateNumber !== undefined || currentMileage !== undefined;

        if (hasInternalUpdates) {
          const internalUpdates: Record<string, unknown> = { updatedAt: updated.updatedAt };
          if (plateNumber !== undefined) internalUpdates.plateNumber = plateNumber;
          if (currentMileage !== undefined) internalUpdates.currentMileage = currentMileage;

          await safeFirestore(
            setDoc(doc(getDb(), 'vehicles', updated.id, 'internal', 'details'), internalUpdates, { merge: true }),
            3000
          );
        }
      } catch (err) {
        console.warn('Firestore updateVehicle error:', err);
      }
    }

    const statusLabel =
      updated.status === 'rented'
        ? 'مؤجرة'
        : updated.status === 'available'
        ? 'متوفرة'
        : updated.status === 'maintenance'
        ? 'صيانة'
        : updated.status;
    this.logAudit(
      `تحديث بيانات سيارة: ${updated.brand} ${updated.model} (الحالة: ${statusLabel})`,
      'vehicles',
      updated.id
    );
    return updated;
  },

  async deleteVehicle(id: string): Promise<void> {
    await this.updateVehicle(id, { isDeleted: true });
    this.logAudit(`حذف سيارة من الأسطول: ${id}`, 'vehicles', id);
  },

  // -------------------------------------------------------------
  // Bookings & Double Booking Prevention (Critical)
  // -------------------------------------------------------------
  mergeBookings(primary: Booking[], fallback: Booking[]): Booking[] {
    const map = new Map<string, Booking>();
    const getBookingKey = (b: Booking) => (b.bookingNumber ? b.bookingNumber.trim().toUpperCase() : b.id);

    if (Array.isArray(fallback)) {
      fallback.forEach(b => {
        if (b && (b.id || b.bookingNumber)) {
          map.set(getBookingKey(b), b);
        }
      });
    }
    if (Array.isArray(primary)) {
      primary.forEach(b => {
        if (b && (b.id || b.bookingNumber)) {
          const key = getBookingKey(b);
          const existing = map.get(key);
          map.set(key, existing ? { ...existing, ...b } : b);
        }
      });
    }
    return Array.from(map.values());
  },

  async getBookings(forceRefresh = false): Promise<Booking[]> {
    if (!forceRefresh && memoryCache.bookings && Date.now() - memoryCache.bookings.timestamp < CACHE_TTL_MS) {
      return memoryCache.bookings.data;
    }

    if (isFirebaseConfigured && db && isStaffOrAdmin()) {
      try {
        const col = collection(getDb(), 'bookings');
        const snap = await safeFirestore(getDocs(col), 2500);
        const remoteDocs = snap.docs.map((d) => {
          const data = d.data();
          const documentId = d.id;
          return {
            ...data,
            id: documentId, // Firestore document ID is the authoritative single source of truth
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt || new Date().toISOString(),
          } as Booking;
        }).filter(b => !b.isDeleted);

        const sorted = remoteDocs
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        memoryCache.bookings = { data: sorted, timestamp: Date.now() };
        return sorted;
      } catch (err: unknown) {
        const errObj = typeof err === 'object' && err !== null ? (err as { code?: string }) : null;
        if (errObj?.code !== 'unavailable') {
          console.warn('Firestore bookings query note:', err);
        }
      }
    } else if (isFirebaseConfigured && db && auth?.currentUser?.uid) {
      try {
        return await this.getBookingsForCustomer(auth.currentUser.uid);
      } catch (e) {
        console.warn('Customer bookings fetch note:', e);
      }
    }

    return memoryCache.bookings?.data || [];
  },

  /**
   * Real-time subscription to bookings collection.
   * Updates memoryCache in RAM only (never persisted to localStorage).
   * Returns an unsubscribe callback.
   */
  subscribeToBookings(callback: (bookings: Booking[]) => void): () => void {
    if (!isFirebaseConfigured || !db || !isStaffOrAdmin()) {
      const cached = memoryCache.bookings?.data || [];
      callback(cached);
      return () => {};
    }

    try {
      const col = collection(getDb(), 'bookings');
      const unsubscribe = onSnapshot(
        col,
        (snap) => {
          try {
            const remoteDocs = snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  ...data,
                  id: d.id,
                  createdAt: data.createdAt?.toDate
                    ? data.createdAt.toDate().toISOString()
                    : data.createdAt || new Date().toISOString(),
                  updatedAt: data.updatedAt?.toDate
                    ? data.updatedAt.toDate().toISOString()
                    : data.updatedAt || new Date().toISOString(),
                } as Booking;
              })
              .filter((b) => !b.isDeleted)
              .sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
              });

            memoryCache.bookings = { data: remoteDocs, timestamp: Date.now() };
            callback(remoteDocs);
          } catch (procErr) {
            console.warn('Error processing bookings snapshot:', procErr);
          }
        },
        (err) => {
          console.warn('onSnapshot bookings note, falling back to cached/getBookings:', err);
          this.getBookings()
            .then(callback)
            .catch((e) => console.warn('Fallback getBookings failed:', e));
        }
      );

      return () => {
        try {
          unsubscribe();
        } catch (unsubErr) {
          console.warn('Error unsubscribing from bookings:', unsubErr);
        }
      };
    } catch (err) {
      console.warn('Error establishing onSnapshot for bookings:', err);
      this.getBookings()
        .then(callback)
        .catch((e) => console.warn('Fallback getBookings failed:', e));
      return () => {};
    }
  },

  /**
   * One-time fetch of bookings for a specific customer.
   * Constrained with where('customerId', '==', customerId) to satisfy Firestore security rules.
   */
  async getBookingsForCustomer(customerId: string): Promise<Booking[]> {
    const cleanId = (customerId || '').trim();
    if (!cleanId) return [];

    if (isFirebaseConfigured && db) {
      try {
        const q = query(
          collection(getDb(), 'bookings'),
          where('customerId', '==', cleanId)
        );
        const snap = await safeFirestore(getDocs(q), 2500);
        const remoteDocs = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              ...data,
              id: d.id,
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate().toISOString()
                : data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt?.toDate
                ? data.updatedAt.toDate().toISOString()
                : data.updatedAt || new Date().toISOString(),
            } as Booking;
          })
          .filter((b) => !b.isDeleted && !b.hiddenFromCustomer)
          .sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });

        return remoteDocs;
      } catch (err: unknown) {
        const errObj = typeof err === 'object' && err !== null ? (err as { code?: string }) : null;
        if (errObj?.code !== 'unavailable') {
          console.warn('Firestore customer bookings query note:', err);
        }
      }
    }

    const memoryBookings = memoryCache.bookings?.data || [];
    return memoryBookings
      .filter((b) => !b.isDeleted && !b.hiddenFromCustomer && b.customerId === cleanId)
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
  },

  /**
   * Real-time subscription to customer bookings collection.
   * Scoped with where('customerId', '==', customerId) to strictly comply with Firestore security rules.
   * Returns an unsubscribe callback.
   */
  subscribeToCustomerBookings(customerId: string, callback: (bookings: Booking[]) => void): () => void {
    const cleanId = (customerId || '').trim();
    if (!cleanId) {
      callback([]);
      return () => {};
    }

    if (!isFirebaseConfigured || !db) {
      this.getBookingsForCustomer(cleanId)
        .then(callback)
        .catch((err) => console.warn('Fallback getBookingsForCustomer note:', err));
      return () => {};
    }

    try {
      const q = query(
        collection(getDb(), 'bookings'),
        where('customerId', '==', cleanId)
      );
      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          try {
            const remoteDocs = snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  ...data,
                  id: d.id,
                  createdAt: data.createdAt?.toDate
                    ? data.createdAt.toDate().toISOString()
                    : data.createdAt || new Date().toISOString(),
                  updatedAt: data.updatedAt?.toDate
                    ? data.updatedAt.toDate().toISOString()
                    : data.updatedAt || new Date().toISOString(),
                } as Booking;
              })
              .filter((b) => !b.isDeleted && !b.hiddenFromCustomer)
              .sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
              });

            callback(remoteDocs);
          } catch (procErr) {
            console.warn('Error processing customer bookings snapshot:', procErr);
          }
        },
        (err) => {
          console.warn('onSnapshot customer bookings note, falling back to getBookingsForCustomer:', err);
          this.getBookingsForCustomer(cleanId)
            .then(callback)
            .catch((e) => console.warn('Fallback getBookingsForCustomer failed:', e));
        }
      );

      return () => {
        try {
          unsubscribe();
        } catch (unsubErr) {
          console.warn('Error unsubscribing from customer bookings:', unsubErr);
        }
      };
    } catch (err) {
      console.warn('Error establishing onSnapshot for customer bookings:', err);
      this.getBookingsForCustomer(cleanId)
        .then(callback)
        .catch((e) => console.warn('Fallback getBookingsForCustomer failed:', e));
      return () => {};
    }
  },

  async getBookingById(id: string): Promise<Booking | null> {
    const cleanId = (id || '').trim();
    if (!cleanId) return null;

    const memoryBookings = memoryCache.bookings?.data || [];
    const localMatch = memoryBookings.find(b =>
      b.id === cleanId ||
      b.bookingNumber === cleanId ||
      b.id?.toLowerCase() === cleanId.toLowerCase() ||
      b.bookingNumber?.toLowerCase() === cleanId.toLowerCase()
    );
    if (localMatch) return localMatch;

    if (isFirebaseConfigured && db) {
      try {
        const docRef = doc(getDb(), 'bookings', cleanId);
        const snap = await safeFirestore(getDoc(docRef), 2500);
        if (snap.exists()) {
          const b = { ...snap.data(), id: snap.id } as Booking;
          memoryCache.bookings = {
            data: [b, ...(memoryCache.bookings?.data?.filter(item => item.id !== b.id) || [])],
            timestamp: Date.now(),
          };
          return b;
        }

        const q = query(collection(getDb(), 'bookings'), where('bookingNumber', '==', cleanId));
        const qSnap = await safeFirestore(getDocs(q), 2500);
        if (!qSnap.empty) {
          const docItem = qSnap.docs[0];
          const b = { ...docItem.data(), id: docItem.id } as Booking;
          memoryCache.bookings = {
            data: [b, ...(memoryCache.bookings?.data?.filter(item => item.id !== b.id) || [])],
            timestamp: Date.now(),
          };
          return b;
        }
      } catch (err) {
        console.warn('Error fetching booking by ID from Firestore:', err);
      }
    }

    return null;
  },

  /**
   * Validates if a vehicle is available for the given date range.
   * Prevents double bookings.
   * Condition for overlap:
   * existing.pickupDate <= requested.returnDate && existing.returnDate >= requested.pickupDate
   */
  async checkAvailability(
    vehicleId: string,
    pickupDate: string,
    returnDate: string,
    excludeBookingId?: string
  ): Promise<{ available: boolean; conflictReason?: string }> {
    const vehicle = await this.getVehicleById(vehicleId);
    if (!vehicle) {
      return { available: false, conflictReason: 'السيارة المطلوبة غير موجودة في الأسطول' };
    }
    if (vehicle.status === 'maintenance') {
      return { available: false, conflictReason: 'السيارة قيد الصيانة الدورية حالياً' };
    }
    if (vehicle.status === 'inactive') {
      return { available: false, conflictReason: 'السيارة خارج الخدمة مؤقتاً' };
    }

    const bookings = await this.getBookings();
    const cleanExclude = excludeBookingId ? String(excludeBookingId).trim().toLowerCase() : '';

    const activeBookings = bookings.filter(b => {
      if (b.isDeleted) return false;
      if (b.vehicleId !== vehicleId) return false;
      // Cancelled, rejected, completed, new, and reviewing bookings do not occupy vehicle slots (only confirmed and rented block availability)
      if (['cancelled', 'rejected', 'completed', 'new', 'reviewing'].includes(b.status)) return false;
      // Exclude the booking currently being verified/transitioned
      if (cleanExclude) {
        if (b.id && b.id.toLowerCase() === cleanExclude) return false;
        if (b.bookingNumber && b.bookingNumber.toLowerCase() === cleanExclude) return false;
      }
      return true;
    });

    const hasOverlap = activeBookings.some(b => {
      return b.pickupDate <= returnDate && b.returnDate >= pickupDate;
    });

    if (hasOverlap) {
      return {
        available: false,
        conflictReason: 'عذراً، السيارة غير متاحة في الفترة المحددة. يرجى اختيار سيارة أو تاريخ آخر.'
      };
    }

    return { available: true };
  },

  /**
   * Generates a unique sequential booking number: SHK-2026-XXXXXX
   */
  async generateBookingNumber(): Promise<string> {
    const currentCounter = getLocalItem<number>(STORAGE_KEYS.BOOKING_COUNTER, 3);
    const nextNumber = currentCounter + 1;
    setLocalItem(STORAGE_KEYS.BOOKING_COUNTER, nextNumber);
    const formatted = `SHK-2026-${String(nextNumber).padStart(6, '0')}`;
    return formatted;
  },

  /**
   * Creates a booking.
   * In Production (when Firebase is configured), this route delegates STRICTLY and EXCLUSIVELY
   * to createBookingSecure (Server-Authoritative Cloud Function). Direct client-side creation
   * and frontend checkAvailability() are completely disabled in Production to prevent double bookings
   * and enforce server-side concurrency locks and dynamic pricing.
   */
  async createBooking(bookingData: {
    vehicleId: string;
    customerName: string;
    customerPhone: string;
    customerWhatsApp?: string;
    customerNationalId?: string;
    customerAddress?: string;
    customerLicenseNumber?: string;
    customerId?: string;
    customerEmail?: string;
    pickupDate: string;
    pickupTime: string;
    returnDate: string;
    returnTime: string;
    rentalDays?: number;
    dailyPrice?: number;
    basePrice?: number;
    discountAmount?: number;
    insuranceAmount?: number;
    totalPrice?: number;
    notes?: string;
    withDriver?: boolean;
    deliveryLocation?: string;
  }): Promise<Booking> {
    // 1. PRODUCTION PATH: Primary execution via createBookingSecure Cloud Function
    if (isFirebaseConfigured && functions) {
      try {
        const callable = httpsCallable<Record<string, unknown>, { success: boolean; booking: Booking; error?: string }>(
          functions,
          'createBookingSecure'
        );
        const res = await callable({
          vehicleId: bookingData.vehicleId,
          customerName: bookingData.customerName,
          customerPhone: bookingData.customerPhone,
          customerWhatsApp: bookingData.customerWhatsApp,
          customerNationalId: bookingData.customerNationalId,
          customerAddress: bookingData.customerAddress,
          customerLicenseNumber: bookingData.customerLicenseNumber,
          pickupDate: bookingData.pickupDate,
          pickupTime: bookingData.pickupTime,
          returnDate: bookingData.returnDate,
          returnTime: bookingData.returnTime,
          notes: bookingData.notes,
          withDriver: bookingData.withDriver,
          deliveryLocation: bookingData.deliveryLocation,
        });

        if (res.data?.success && res.data?.booking) {
          const serverBooking = res.data.booking;
          const currentBookings = memoryCache.bookings?.data || [];
          memoryCache.bookings = {
            data: [serverBooking, ...currentBookings.filter((b) => b.id !== serverBooking.id)],
            timestamp: Date.now(),
          };
          return serverBooking;
        }
        throw new Error(res.data?.error || 'تعذر إنشاء الحجز.');
      } catch (err: unknown) {
        const errObj = typeof err === 'object' && err !== null ? (err as { message?: string; details?: string }) : null;
        const errMsg = errObj?.details || errObj?.message || 'عذراً، تعذر إتمام الحجز عبر الخادم الآمن.';
        throw new Error(errMsg);
      }
    }

    // 2. DEMO / OFFLINE FALLBACK (when Firebase is completely unconfigured)
    return this.createBookingLocalDemo(bookingData);
  },

  /**
   * Demo/Development fallback ONLY (when Firebase is completely unconfigured).
   * Runs purely in local memory/state with synthetic data.
   */
  async createBookingLocalDemo(bookingData: {
    vehicleId: string;
    customerName: string;
    customerPhone: string;
    customerWhatsApp?: string;
    customerNationalId?: string;
    customerAddress?: string;
    customerLicenseNumber?: string;
    customerId?: string;
    customerEmail?: string;
    pickupDate: string;
    pickupTime: string;
    returnDate: string;
    returnTime: string;
    rentalDays?: number;
    dailyPrice?: number;
    basePrice?: number;
    discountAmount?: number;
    insuranceAmount?: number;
    totalPrice?: number;
    notes?: string;
    withDriver?: boolean;
    deliveryLocation?: string;
  }): Promise<Booking> {
    const availability = await this.checkAvailability(
      bookingData.vehicleId,
      bookingData.pickupDate,
      bookingData.returnDate
    );

    if (!availability.available) {
      throw new Error(availability.conflictReason || 'عذراً، السيارة غير متاحة في الفترة المحددة.');
    }

    const vehicle = await this.getVehicleById(bookingData.vehicleId);
    if (!vehicle) {
      throw new Error('السيارة المطلوبة غير موجودة في الأسطول');
    }
    const vehicleName = `${vehicle.brand} ${vehicle.model} (${vehicle.year})`;
    const vehicleCategory = vehicle.category || 'medium';

    const settings = await this.getSettings();
    const verifiedDays = calculateRentalDays(bookingData.pickupDate, bookingData.returnDate);
    const verifiedPricing = calculateRentalPrice(
      vehicle.category,
      vehicle.dailyPrice,
      verifiedDays,
      settings,
      {
        isUserLoggedIn: Boolean(bookingData.customerId),
        vehicleId: vehicle.id,
      }
    );

    const bookingNumber = await this.generateBookingNumber();
    const id = `book-demo-${Date.now()}`;

    const newBooking: Booking = {
      ...bookingData,
      id,
      bookingNumber,
      vehicleName,
      vehicleCategory,
      customerWhatsApp: bookingData.customerWhatsApp || bookingData.customerPhone,
      rentalDays: verifiedDays,
      dailyPrice: vehicle.dailyPrice,
      basePrice: verifiedPricing.basePrice,
      discountAmount: verifiedPricing.discountAmount,
      insuranceAmount: verifiedPricing.insuranceAmount,
      totalPrice: verifiedPricing.totalPrice,
      status: 'new',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to in-memory cache ONLY (never localStorage, never setDoc)
    const currentBookings = memoryCache.bookings?.data || [];
    memoryCache.bookings = {
      data: [newBooking, ...currentBookings.filter((b) => b.id !== id)],
      timestamp: Date.now(),
    };

    await this.syncCustomerFromBooking(newBooking);

    this.addNotification({
      type: 'new_booking',
      title: 'طلب حجز إلكتروني تجريبي',
      message: `حجز تجريبي برقم ${bookingNumber} للعميل ${newBooking.customerName} على ${vehicleName}`,
      bookingId: id,
      vehicleId: bookingData.vehicleId,
    });

    this.logAudit(`إنشاء حجز تجريبي: ${bookingNumber}`, 'bookings', id);
    return newBooking;
  },

  async updateBookingStatus(id: string, newStatus: BookingStatus): Promise<Booking | null> {
    const cleanId = (id || '').trim();
    const currentBookings = memoryCache.bookings?.data || [];

    const idx = currentBookings.findIndex(b =>
      b.id === cleanId ||
      b.bookingNumber === cleanId ||
      b.id?.toLowerCase() === cleanId.toLowerCase() ||
      b.bookingNumber?.toLowerCase() === cleanId.toLowerCase()
    );

    if (idx === -1) {
      // الحجز غير موجود بالكاش المحلي حالياً - لا تلفّق أي بيانات، فقط تجاهل صامت
      // (البيانات الحقيقية محدّثة أصلاً على الخادم عبر updateBookingStatusSecure،
      // وستُجلب صح عند إعادة تحميل القائمة القادمة)
      return null;
    }

    const updatedBooking: Booking = {
      ...currentBookings[idx],
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    const newList = [...currentBookings];
    newList[idx] = updatedBooking;
    memoryCache.bookings = { data: newList, timestamp: Date.now() };

    return updatedBooking;
  },

  async hideBookingForCustomer(bookingId: string): Promise<void> {
    const cleanId = (bookingId || '').trim();
    if (!cleanId || !auth?.currentUser) {
      throw new Error('يجب تسجيل الدخول لإتمام هذا الإجراء.');
    }
    if (isFirebaseConfigured && db) {
      await safeFirestore(
        updateDoc(doc(getDb(), 'bookings', cleanId), {
          hiddenFromCustomer: true,
          updatedAt: serverTimestamp(),
        }),
        5000
      );
    }
    // تحديث الكاش المحلي فوراً
    if (memoryCache.bookings?.data) {
      memoryCache.bookings.data = memoryCache.bookings.data.filter(b => b.id !== cleanId);
      memoryCache.bookings.timestamp = Date.now();
    }
  },

  /**
   * Hard Delete a booking permanently from Firestore and memory cache.
   * Requires staff/admin authorization with Firebase Auth Custom Claims.
   */
  async deleteBooking(bookingId: string): Promise<boolean> {
    if (!isStaffOrAdmin()) {
      throw new Error('عذراً، لا تمتلك الصلاحيات الإدارية الكافية لحذف الحجز.');
    }
    const cleanId = (bookingId || '').trim();
    if (!cleanId) {
      throw new Error('معرف الحجز غير صالح.');
    }

    if (isFirebaseConfigured && db) {
      // Firestore rules forbid client-side booking deletes; go through the secure Cloud Function.
      const res = await functionsService.deleteBookingSecure({ bookingId: cleanId });
      if (!res.success) {
        console.error('deleteBookingSecure error:', res.error);
        throw new Error(res.error || 'تعذر حذف الحجز من قاعدة البيانات السحابية.');
      }
    }

    // Immediately remove from local in-memory cache
    if (memoryCache.bookings?.data) {
      memoryCache.bookings.data = memoryCache.bookings.data.filter(
        (b) => b.id !== cleanId && b.bookingNumber !== cleanId
      );
      memoryCache.bookings.timestamp = Date.now();
    }

    this.logAudit(`حذف حجز نهائياً من النظام: ${cleanId}`, 'bookings', cleanId);
    return true;
  },



  // -------------------------------------------------------------
  // Customers CRM
  // -------------------------------------------------------------
  async getCustomers(forceRefresh = false): Promise<Customer[]> {
    if (!forceRefresh && memoryCache.customers && Date.now() - memoryCache.customers.timestamp < CACHE_TTL_MS) {
      return memoryCache.customers.data;
    }

    // Only query Firestore customers if user is signed in as staff or admin
    if (isFirebaseConfigured && db && isStaffOrAdmin()) {
      try {
        const col = collection(getDb(), 'customers');
        const snap = await safeFirestore(getDocs(col), 2500);
        const remoteDocs = snap.docs.map(d => d.data() as Customer);

        memoryCache.customers = { data: remoteDocs, timestamp: Date.now() };
        return remoteDocs;
      } catch (err: unknown) {
        const errObj = typeof err === 'object' && err !== null ? (err as { code?: string }) : null;
        if (errObj?.code !== 'unavailable') {
          console.warn('Firestore customers query note:', err);
        }
      }
    }

    return memoryCache.customers?.data || [];
  },

  async syncCustomerFromBooking(booking: Booking): Promise<Customer> {
    const customers = await this.getCustomers();
    let customer = customers.find(c => c.phone === booking.customerPhone);

    if (!customer) {
      const isAuthUid = booking.customerId && !booking.customerId.startsWith('cust-') && !booking.customerId.startsWith('guest-');
      const bookingSpending = ['confirmed', 'rented', 'completed'].includes(booking.status) ? (booking.totalPrice || 0) : 0;
      customer = {
        id: isAuthUid ? booking.customerId! : `cust-${Date.now()}`,
        fullName: booking.customerName,
        phone: booking.customerPhone,
        whatsapp: booking.customerWhatsApp,
        nationalId: booking.customerNationalId || '',
        drivingLicense: booking.customerLicenseNumber || '',
        address: booking.customerAddress || '',
        totalRentals: 1,
        totalSpending: bookingSpending,
        createdAt: new Date().toISOString(),
      };
      customers.push(customer);
    } else {
      const bookingSpending = ['confirmed', 'rented', 'completed'].includes(booking.status) ? (booking.totalPrice || 0) : 0;
      customer.totalRentals = (customer.totalRentals || 0) + 1;
      customer.totalSpending = (customer.totalSpending || 0) + bookingSpending;
      if (booking.customerNationalId && !customer.nationalId) customer.nationalId = booking.customerNationalId;
      if (booking.customerLicenseNumber && !customer.drivingLicense) customer.drivingLicense = booking.customerLicenseNumber;
      if (booking.customerAddress && !customer.address) customer.address = booking.customerAddress;
    }

    // Update in-memory cache ONLY (never localStorage)
    memoryCache.customers = { data: customers, timestamp: Date.now() };

    // Prevent direct write if unauthenticated or if generated ID is synthetic (cust-... / guest-...) not matching auth.currentUser.uid
    if (isFirebaseConfigured && db && auth?.currentUser?.uid) {
      const currentUid = auth.currentUser.uid;
      const isMatchingAuthUser = customer.id === currentUid || booking.customerId === currentUid;
      const isStaff = isStaffOrAdmin();

      if (isMatchingAuthUser || isStaff) {
        const targetDocId = isMatchingAuthUser ? currentUid : customer.id;
        try {
          await safeFirestore(setDoc(doc(getDb(), 'customers', targetDocId), { ...customer, id: targetDocId }, { merge: true }), 8000);
        } catch (err) {
          console.warn('Firestore syncCustomerFromBooking note:', err);
        }
      }
    }

    return customer;
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const customers = await this.getCustomers();
    const index = customers.findIndex(c => c.id === id);
    if (index === -1) throw new Error('العميل غير موجود');

    const updated: Customer = {
      ...customers[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    customers[index] = updated;

    // In production, update Firestore first and throw on failure
    if (isFirebaseConfigured && db) {
      try {
        await safeFirestore(setDoc(doc(getDb(), 'customers', id), updated, { merge: true }), 2500);
      } catch (err: unknown) {
        const errObj = typeof err === 'object' && err !== null ? (err as { code?: string }) : null;
        if (errObj?.code !== 'unavailable') {
          handleFirestoreError('customers', id, 'write', err, auth?.currentUser?.uid);
          throw new Error('فشل تحديث بيانات العميل في السحابة.');
        }
      }
    }

    // Update in-memory cache ONLY
    memoryCache.customers = { data: customers, timestamp: Date.now() };

    this.logAudit(`تعديل بيانات العميل: ${updated.fullName}`, 'customers', id);
    return updated;
  },

  /**
   * Helper to scan Firestore & memory cache for matching seed customer and booking records
   */
  async findMatchingSeedRecords(): Promise<{
    matchingSeedCustomers: Array<{ id: string; fullName: string; phone: string; source: 'firestore' | 'local' }>;
    matchingSeedBookings: Array<{ id: string; bookingNumber: string; customerName: string; source: 'firestore' | 'local' }>;
    realCustomers: Array<{ id: string; fullName: string; phone: string; source: 'firestore' | 'local' }>;
    realBookings: Array<{ id: string; bookingNumber: string; customerName: string; source: 'firestore' | 'local' }>;
  }> {
    const seedCustomerIdentifiers = new Set(['cust-101', 'cust-102', 'cust-103', 'أحمد محمود العلي', 'المهندس وسيم البيطار', 'رامي خالد النجار']);
    const seedBookingIdentifiers = new Set(['book-2026-001', 'book-2026-002', 'SHK-2026-000001', 'SHK-2026-000002']);

    const matchingSeedCustomers: Array<{ id: string; fullName: string; phone: string; source: 'firestore' | 'local' }> = [];
    const matchingSeedBookings: Array<{ id: string; bookingNumber: string; customerName: string; source: 'firestore' | 'local' }> = [];
    const realCustomers: Array<{ id: string; fullName: string; phone: string; source: 'firestore' | 'local' }> = [];
    const realBookings: Array<{ id: string; bookingNumber: string; customerName: string; source: 'firestore' | 'local' }> = [];

    // 1. Check Firestore
    if (isFirebaseConfigured && db) {
      try {
        const cSnap = await safeFirestore(getDocs(collection(getDb(), 'customers')), 3000);
        cSnap.docs.forEach(d => {
          const c = d.data() as Customer;
          const isSeed = seedCustomerIdentifiers.has(c.id) || seedCustomerIdentifiers.has(c.fullName) || c.id?.startsWith('cust-10');
          if (isSeed) {
            matchingSeedCustomers.push({ id: c.id || d.id, fullName: c.fullName, phone: c.phone, source: 'firestore' });
          } else {
            realCustomers.push({ id: c.id || d.id, fullName: c.fullName, phone: c.phone, source: 'firestore' });
          }
        });

        const bSnap = await safeFirestore(getDocs(collection(getDb(), 'bookings')), 3000);
        bSnap.docs.forEach(d => {
          const b = d.data() as Booking;
          const isSeed = seedBookingIdentifiers.has(b.id) || seedBookingIdentifiers.has(b.bookingNumber) || seedCustomerIdentifiers.has(b.customerName) || b.id === 'book-2026-001' || b.id === 'book-2026-002';
          if (isSeed) {
            matchingSeedBookings.push({ id: b.id || d.id, bookingNumber: b.bookingNumber, customerName: b.customerName, source: 'firestore' });
          } else {
            realBookings.push({ id: b.id || d.id, bookingNumber: b.bookingNumber, customerName: b.customerName, source: 'firestore' });
          }
        });
      } catch (err) {
        console.warn('Scan Firestore error:', err);
      }
    }

    // 2. Check memory cache
    const memC = memoryCache.customers?.data || [];
    memC.forEach(c => {
      const isSeed = seedCustomerIdentifiers.has(c.id) || seedCustomerIdentifiers.has(c.fullName) || c.id?.startsWith('cust-10');
      if (isSeed && !matchingSeedCustomers.some(m => m.id === c.id)) {
        matchingSeedCustomers.push({ id: c.id, fullName: c.fullName, phone: c.phone, source: 'local' });
      } else if (!isSeed && !realCustomers.some(r => r.id === c.id)) {
        realCustomers.push({ id: c.id, fullName: c.fullName, phone: c.phone, source: 'local' });
      }
    });

    const memB = memoryCache.bookings?.data || [];
    memB.forEach(b => {
      const isSeed = seedBookingIdentifiers.has(b.id) || seedBookingIdentifiers.has(b.bookingNumber) || seedCustomerIdentifiers.has(b.customerName);
      if (isSeed && !matchingSeedBookings.some(m => m.id === b.id)) {
        matchingSeedBookings.push({ id: b.id, bookingNumber: b.bookingNumber, customerName: b.customerName, source: 'local' });
      } else if (!isSeed && !realBookings.some(r => r.id === b.id)) {
        realBookings.push({ id: b.id, bookingNumber: b.bookingNumber, customerName: b.customerName, source: 'local' });
      }
    });

    return {
      matchingSeedCustomers,
      matchingSeedBookings,
      realCustomers,
      realBookings,
    };
  },

  /**
   * Deletes specific confirmed seed document IDs from Firestore and local caches
   */
  async deleteConfirmedSeedDocuments(targetIds: { customerIds: string[]; bookingIds: string[] }): Promise<{ deletedCustomers: number; deletedBookings: number }> {
    let deletedCustomers = 0;
    let deletedBookings = 0;

    // 1. Delete from Firestore
    if (isFirebaseConfigured && db) {
      for (const cId of targetIds.customerIds) {
        try {
          await safeFirestore(deleteDoc(doc(getDb(), 'customers', cId)), 2500);
          deletedCustomers++;
        } catch (err) {
          console.warn(`Could not delete customer doc ${cId}:`, err);
        }
      }

      for (const bId of targetIds.bookingIds) {
        try {
          await safeFirestore(deleteDoc(doc(getDb(), 'bookings', bId)), 2500);
          deletedBookings++;
        } catch (err) {
          console.warn(`Could not delete booking doc ${bId}:`, err);
        }
      }
    }

    // 2. Clean memory caches and purge any residual local storage items
    const remainingCustomers = (memoryCache.customers?.data || []).filter(
      c => !targetIds.customerIds.includes(c.id)
    );
    memoryCache.customers = { data: remainingCustomers, timestamp: Date.now() };

    const remainingBookings = (memoryCache.bookings?.data || []).filter(
      b => !targetIds.bookingIds.includes(b.id) && !targetIds.bookingIds.includes(b.bookingNumber)
    );
    memoryCache.bookings = { data: remainingBookings, timestamp: Date.now() };

    try {
      localStorage.removeItem('shaker_customers_v1');
      localStorage.removeItem('shaker_bookings_v1');
      localStorage.removeItem('shaker_payments_v1');
    } catch {}

    return { deletedCustomers, deletedBookings };
  },



  // -------------------------------------------------------------
  // Vehicle Inspection
  // -------------------------------------------------------------
  async getInspections(): Promise<VehicleInspection[]> {
    return getLocalItem<VehicleInspection[]>(STORAGE_KEYS.INSPECTIONS, []);
  },

  async recordInspection(inspection: Omit<VehicleInspection, 'id' | 'createdAt'>): Promise<VehicleInspection> {
    const id = `insp-${Date.now()}`;
    const newInspection: VehicleInspection = {
      ...inspection,
      id,
      createdAt: new Date().toISOString(),
    };

    const current = getLocalItem<VehicleInspection[]>(STORAGE_KEYS.INSPECTIONS, []);
    setLocalItem(STORAGE_KEYS.INSPECTIONS, [newInspection, ...current]);
    this.logAudit(`تسجيل فحص استلام/تسليم للسيارة ${inspection.vehicleId}`, 'inspections', id);
    return newInspection;
  },

  // -------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------
  getNotifications(): AppNotification[] {
    return getLocalItem<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, [
      {
        id: 'notif-1',
        type: 'new_booking',
        title: 'طلب حجز جديد',
        message: 'تم استلام طلب حجز رقم SHK-2026-000001 بنجاح.',
        read: false,
        createdAt: new Date().toISOString(),
      }
    ]);
  },

  addNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
    const current = this.getNotifications();
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setLocalItem(STORAGE_KEYS.NOTIFICATIONS, [newNotif, ...current]);
  },

  markNotificationAsRead(id: string) {
    const current = this.getNotifications();
    const updated = current.map(n => n.id === id ? { ...n, read: true } : n);
    setLocalItem(STORAGE_KEYS.NOTIFICATIONS, updated);
    if (isFirebaseConfigured && db) {
      try {
        updateDoc(doc(getDb(), 'notifications', id), { read: true }).catch(() => {});
      } catch {}
    }
  },

  markAllNotificationsAsRead() {
    const current = this.getNotifications();
    const updated = current.map(n => ({ ...n, read: true }));
    setLocalItem(STORAGE_KEYS.NOTIFICATIONS, updated);
    if (isFirebaseConfigured && db) {
      current.filter(n => !n.read).forEach(n => {
        try {
          updateDoc(doc(getDb(), 'notifications', n.id), { read: true }).catch(() => {});
        } catch {}
      });
    }
  },

  deleteNotification(id: string) {
    const current = this.getNotifications();
    const updated = current.filter(n => n.id !== id);
    setLocalItem(STORAGE_KEYS.NOTIFICATIONS, updated);
    if (isFirebaseConfigured && db) {
      try {
        deleteDoc(doc(getDb(), 'notifications', id)).catch(() => {});
      } catch {}
    }
  },

  /**
   * Real-time subscription to administrative notifications collection.
   * Updates memoryCache and localStorage on snapshot, with graceful offline fallback.
   * Returns an unsubscribe callback.
   */
  subscribeToNotifications(callback: (notifications: AppNotification[]) => void): () => void {
    if (!isFirebaseConfigured || !db) {
      callback(this.getNotifications());
      return () => {};
    }

    try {
      const col = collection(getDb(), 'notifications');
      const unsubscribe = onSnapshot(
        col,
        (snap) => {
          try {
            const remoteNotifs = snap.docs
              .map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  type: data.type || 'new_booking',
                  title: data.title || '',
                  message: data.message || '',
                  bookingId: data.bookingId,
                  vehicleId: data.vehicleId,
                  read: Boolean(data.read),
                  createdAt: data.createdAt?.toDate
                    ? data.createdAt.toDate().toISOString()
                    : (data.createdAt || new Date().toISOString()),
                } as AppNotification;
              })
              .sort((a, b) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
              });

            setLocalItem(STORAGE_KEYS.NOTIFICATIONS, remoteNotifs);
            if (memoryCache.notifications !== undefined) {
              memoryCache.notifications = { data: remoteNotifs, timestamp: Date.now() };
            }
            callback(remoteNotifs);
          } catch (procErr) {
            console.warn('Error processing notifications snapshot:', procErr);
          }
        },
        (err) => {
          console.warn('onSnapshot notifications note (falling back to local):', err?.message || err);
          callback(this.getNotifications());
        }
      );

      return () => {
        try {
          unsubscribe();
        } catch (unsubErr) {
          console.warn('Error unsubscribing from notifications:', unsubErr);
        }
      };
    } catch (err) {
      console.warn('Error establishing onSnapshot for notifications:', err);
      callback(this.getNotifications());
      return () => {};
    }
  },

  // -------------------------------------------------------------
  // Audit Logs
  // -------------------------------------------------------------
  logAudit(action: string, entity: string, entityId: string, details?: string) {
    const current = memoryCache.auditLogs?.data || [];
    const isStaff = isStaffOrAdmin();
    const currentUser = auth?.currentUser;
    const actorUid = currentUser?.uid || null;
    const actorEmail = currentUser?.email || null;
    const actorType: 'customer' | 'staff' | 'guest' | 'system' = isStaff
      ? 'staff'
      : actorUid
      ? 'customer'
      : 'guest';

    const newLog: AuditLog = {
      id: `audit-${Date.now()}`,
      user: actorEmail || (actorType === 'staff' ? 'مدير النظام (admin)' : 'زائر'),
      actorUid,
      actorEmail,
      actorType,
      action,
      entity,
      entityId,
      timestamp: new Date().toISOString(),
      details,
    };
    memoryCache.auditLogs = { data: [newLog, ...current].slice(0, 100), timestamp: Date.now() };
  },

  getAuditLogs(): AuditLog[] {
    return memoryCache.auditLogs?.data || [];
  },

  // Status helper
  getStatusLabel(status: BookingStatus): string {
    const labels: Record<BookingStatus, string> = {
      new: 'طلب جديد',
      reviewing: 'قيد المراجعة',
      confirmed: 'مؤكد',
      rented: 'جاري التأجير',
      completed: 'مكتمل',
      cancelled: 'ملغي',
      rejected: 'مرفوض',
    };
    return labels[status] || status;
  },

  // -------------------------------------------------------------
  // Firestore Users & Uploaded Files Management (Admin View)
  // -------------------------------------------------------------
  /**
   * فحص الاتصال بقاعدة بيانات Cloud Firestore السحابية وقياس زمن الاستجابة الفعلي
   */
  async testFirestoreConnection(): Promise<{
    success: boolean;
    latencyMs: number;
    message: string;
    databaseId: string;
    usersCount: number;
    filesCount: number;
  }> {
    const startTime = Date.now();
    const databaseId = firestoreDatabaseId || 'ai-studio-shakercarrental-8ca1f5c8-9251-4c7d-b28c-5a1ee6a1a1e1';

    if (!isFirebaseConfigured || !db) {
      return {
        success: false,
        latencyMs: 0,
        message: 'إعدادات Firebase غير مهيأة محلياً',
        databaseId,
        usersCount: 0,
        filesCount: 0,
      };
    }

    try {
      // Test read on users collection and files collection
      const usersSnap = await safeFirestore(getDocs(collection(getDb(), 'users')), 6000);
      const filesSnap = await safeFirestore(getDocs(collection(getDb(), 'files')), 6000).catch(() => null);
      const latencyMs = Date.now() - startTime;

      const usersCount = usersSnap.size;
      const filesCount = filesSnap ? filesSnap.size : 0;

      return {
        success: true,
        latencyMs,
        message: `تم الاتصال بقاعدة بيانات Firestore بنجاح وبزمن استجابة ${latencyMs} ميلي ثانية`,
        databaseId,
        usersCount,
        filesCount,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errObj = typeof err === 'object' && err !== null ? (err as { message?: string }) : null;
      return {
        success: false,
        latencyMs,
        message: `تعذر الوصول السحابي المباشر (${errObj?.message || 'غير متاح'}). النظام يعمل بذاكرة التخزين المحلية.`,
        databaseId,
        usersCount: 0,
        filesCount: 0,
      };
    }
  },

  /**
   * إنشاء مستخدم جديد وحفظه مباشرة في Cloud Firestore
   */
  async createUser(userData: {
    email: string;
    displayName: string;
    phone?: string;
    role?: FirestoreUser['role'];
  }): Promise<FirestoreUser> {
    const id = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newUser: FirestoreUser = {
      id,
      uid: id,
      email: userData.email.trim(),
      displayName: userData.displayName.trim(),
      phone: userData.phone?.trim() || '',
      role: userData.role || 'customer',
      createdAt: new Date().toISOString(),
      uploadedFilesCount: 0,
    };

    if (isFirebaseConfigured && db) {
      try {
        await safeFirestore(setDoc(doc(getDb(), 'users', id), newUser), 5000);
      } catch (err) {
        console.warn('Could not write new user to Firestore:', err);
      }
    }

    // Update volatile memory cache
    const allUsers = memoryCache.users?.data || [];
    memoryCache.users = { data: [newUser, ...allUsers.filter(u => u.id !== id)], timestamp: Date.now() };

    return newUser;
  },

  /**
   * جلب قائمة المستخدمين بالكامل من Firestore لعرضها في لوحة تحكم الإدارة
   */
  async getAllUsers(forceRefresh = false): Promise<FirestoreUser[]> {
    if (!forceRefresh && memoryCache.users && Date.now() - memoryCache.users.timestamp < CACHE_TTL_MS) {
      return memoryCache.users.data;
    }

    if (isFirebaseConfigured && db) {
      try {
        const usersCol = collection(getDb(), 'users');
        const [snap, filesSnap] = await Promise.all([
          safeFirestore(getDocs(usersCol), 2500),
          safeFirestore(getDocs(collection(getDb(), 'files')), 2000).catch(() => null),
        ]);

        // Fetch all files count from Firestore files collection to ensure 100% precision
        const filesCountByUser: Record<string, number> = {};
        if (filesSnap && filesSnap.docs) {
          filesSnap.docs.forEach((fDoc) => {
            const fData = fDoc.data() as UserFileRecord;
            if (fData.userId) {
              filesCountByUser[fData.userId] = (filesCountByUser[fData.userId] || 0) + 1;
            }
          });
        }

        if (!snap.empty) {
          const users: FirestoreUser[] = [];
          for (const docSnap of snap.docs) {
            const data = docSnap.data() as Partial<FirestoreUser>;
            const uid = docSnap.id;

            const presetFilesCount = INITIAL_UPLOADED_FILES[uid]?.length || 0;
            const firestoreLiveFilesCount = filesCountByUser[uid] || 0;

            const computedFilesCount = Math.max(
              firestoreLiveFilesCount,
              data.uploadedFilesCount || 0,
              presetFilesCount
            );

            users.push({
              id: uid,
              uid: uid,
              email: data.email || 'user@example.com',
              displayName: data.displayName || data.email?.split('@')[0] || 'مستخدم',
              phone: data.phone || '',
              role: data.role || 'customer',
              createdAt: data.createdAt || new Date().toISOString(),
              uploadedFilesCount: computedFilesCount,
              verificationStatus: data.verificationStatus || 'pending',
              verifiedAt: data.verifiedAt,
            });
          }

          // Sort by createdAt descending (newest accounts first)
          users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          memoryCache.users = { data: users, timestamp: Date.now() };
          return users;
        }
      } catch (err: unknown) {
        const errObj = typeof err === 'object' && err !== null ? (err as { code?: string }) : null;
        if (errObj?.code !== 'unavailable') {
          console.warn('Firestore getAllUsers error:', err);
        }
      }
    }

    return memoryCache.users?.data || [];
  },

  /**
   * Fetch single user profile directly from Firestore
   */
  async getUserProfile(userId: string): Promise<FirestoreUser | null> {
    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(getDb(), 'users', userId);
        const snap = await safeFirestore(getDoc(userDocRef), 2000);
        if (snap.exists()) {
          const data = snap.data() as Partial<FirestoreUser>;
          return {
            id: snap.id,
            uid: snap.id,
            email: data.email || '',
            displayName: data.displayName || '',
            phone: data.phone || '',
            role: data.role || 'customer',
            createdAt: data.createdAt || new Date().toISOString(),
            uploadedFilesCount: data.uploadedFilesCount || 0,
            verificationStatus: data.verificationStatus || 'pending',
            verifiedAt: data.verifiedAt,
          };
        }
      } catch (err) {
        console.warn('Error fetching user profile from Firestore:', err);
      }
    }

    const cached = memoryCache.users?.data?.find(u => u.id === userId || u.uid === userId);
    return cached || null;
  },

  /**
   * دالة موازية لجلب جميع المستخدمين من Firestore
   */
  async getAllUsersFromFirestore(): Promise<FirestoreUser[]> {
    return this.getAllUsers();
  },

  /**
   * تحديث دور المستخدم (عميل / موظف / مدير) في Firestore والذاكرة المحلية
   */
  async updateUserRole(
    uid: string,
    newRole: 'customer' | 'employee' | 'admin'
  ): Promise<void> {
    if (!uid || !uid.trim()) {
      throw new Error('معرف المستخدم غير صالح');
    }

    const cleanUid = uid.trim();

    // 1. Update Custom Claims server-side via Firebase Cloud Function (sole authority)
    if (isFirebaseConfigured && functions) {
      try {
        const setRoleFn = httpsCallable<{ targetUid: string; newRole: string }, { success: boolean }>(functions, 'setUserRole');
        await setRoleFn({ targetUid: cleanUid, newRole });
      } catch (err: unknown) {
        console.error('Failed to update user role via Cloud Function:', err);
        const errObj = typeof err === 'object' && err !== null ? (err as { message?: string }) : null;
        throw new Error(errObj?.message || 'تعذر تعديل الصلاحيات. تأكد من امتلاك صلاحية Admin.');
      }
    }

    // 2. If the current user updated their own role, force refresh token claims immediately
    if (auth?.currentUser && auth.currentUser.uid === cleanUid) {
      try {
        await auth.currentUser.getIdTokenResult(true);
      } catch {
        // Ignore token refresh error
      }
    }

    // 3. Update memory cache ONLY (never localStorage for user data or secrets)
    const currentUsers = memoryCache.users?.data || [];
    const updatedUsers = currentUsers.map((u) =>
      u.id === cleanUid || u.uid === cleanUid
        ? { ...u, role: newRole }
        : u
    );
    memoryCache.users = { data: updatedUsers, timestamp: Date.now() };

    // Clean any residual demo users in localStorage
    try {
      localStorage.removeItem('shaker_demo_users_v1');
    } catch {}

    this.logAudit(`تعديل دور المستخدم (${cleanUid}) إلى ${newRole}`, 'users', cleanUid);
  },

  /**
   * جلب الملفات والوثائق الخاصة بمستخدم معين باستخدام معرفه (userId)
   * تبحث في كل من المجلد الفرعي /users/{userId}/files وفي مجموعة /files الرئيسية
   * يتم الاحتفاظ بالملفات في الذاكرة الحية فقط حفاظاً على سرية وخصوصية الوثائق
   */
  async getFilesForUser(userId: string): Promise<UserFileRecord[]> {
    if (!userId || !userId.trim()) {
      return [];
    }

    const cleanUserId = userId.trim();
    const collectedFilesMap = new Map<string, UserFileRecord>();

    if (isFirebaseConfigured && db) {
      try {
        // 1. Fetch from subcollection: /users/{userId}/files
        try {
          const filesSubCol = collection(getDb(), 'users', cleanUserId, 'files');
          const subSnap = await safeFirestore(getDocs(filesSubCol), 3500);
          subSnap.docs.forEach((d) => {
            const fileData = d.data() as UserFileRecord;
            collectedFilesMap.set(d.id, {
              ...fileData,
              id: d.id,
              userId: fileData.userId || cleanUserId,
            });
          });
        } catch {
          // Subcollection query failed or offline
        }

        // 2. Fetch from root files collection: /files where userId == cleanUserId
        try {
          const rootFilesCol = collection(getDb(), 'files');
          const q = query(rootFilesCol, where('userId', '==', cleanUserId));
          const rootSnap = await safeFirestore(getDocs(q), 3500);
          rootSnap.docs.forEach((d) => {
            const fileData = d.data() as UserFileRecord;
            if (!collectedFilesMap.has(d.id)) {
              collectedFilesMap.set(d.id, {
                ...fileData,
                id: d.id,
                userId: fileData.userId || cleanUserId,
              });
            }
          });
        } catch {
          // Root query fallback: scan root files collection if filtered query has issue
          try {
            const allFilesSnap = await safeFirestore(getDocs(collection(getDb(), 'files')), 3500);
            allFilesSnap.docs.forEach((d) => {
              const fileData = d.data() as UserFileRecord;
              if (fileData.userId === cleanUserId || (fileData as UserFileRecord & { uid?: string }).uid === cleanUserId) {
                if (!collectedFilesMap.has(d.id)) {
                  collectedFilesMap.set(d.id, {
                    ...fileData,
                    id: d.id,
                    userId: cleanUserId,
                  });
                }
              }
            });
          } catch {}
        }

        if (collectedFilesMap.size > 0) {
          const filesArray = Array.from(collectedFilesMap.values());
          filesArray.sort(
            (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
          );
          return filesArray;
        }
      } catch {
        // Ignore offline error
      }
    }

    // Fallback to initial preset files in memory only
    const preset = INITIAL_UPLOADED_FILES[cleanUserId] || [];
    return [...preset].sort(
      (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
    );
  },

  /**
   * الاسم البديل المتوافق لدالة جلب ملفات المستخدم
   */
  async getUserFiles(userId: string): Promise<UserFileRecord[]> {
    return this.getFilesForUser(userId);
  },

  async uploadUserFile(fileData: Omit<UserFileRecord, 'id' | 'uploadedAt'>): Promise<UserFileRecord> {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newFile: UserFileRecord = {
      ...fileData,
      id: fileId,
      uploadedAt: new Date().toISOString(),
      verified: false,
      status: 'manual_review',
    };

    if (isFirebaseConfigured && db) {
      try {
        // Store in subcollection and root files collection
        await safeFirestore(setDoc(doc(getDb(), 'users', fileData.userId, 'files', fileId), newFile), 2500);
        await safeFirestore(setDoc(doc(getDb(), 'files', fileId), newFile), 2500);

        // Update uploadedFilesCount on user doc
        try {
          const userDocRef = doc(getDb(), 'users', fileData.userId);
          const userSnap = await safeFirestore(getDoc(userDocRef), 1500);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            const currentCount = (userData.uploadedFilesCount || 0) + 1;
            const updatePayload: UpdateData<DocumentData> = { uploadedFilesCount: currentCount };
            if (userData.verificationStatus !== 'verified') {
              updatePayload.verificationStatus = 'manual_review';
              updatePayload.verified = false;
            }
            await safeFirestore(updateDoc(userDocRef, updatePayload), 1500);
          }
        } catch (cntErr) {
          console.warn('Non-fatal error updating user uploadedFilesCount:', cntErr);
        }
      } catch (err: unknown) {
        console.error('Error in uploadUserFile:', err);
        const friendlyMsg = handleFirestoreError('users', `${fileData.userId}/files/${fileId}`, 'write', err, auth?.currentUser?.uid);
        throw new Error(friendlyMsg || 'فشل حفظ بيانات الوثيقة في قاعدة البيانات.');
      }
    }

    // Update user file count in memory cache ONLY
    if (memoryCache.users?.data) {
      memoryCache.users.data = memoryCache.users.data.map((u) => {
        if (u.id === fileData.userId || u.uid === fileData.userId) {
          return {
            ...u,
            uploadedFilesCount: (u.uploadedFilesCount || 0) + 1,
          };
        }
        return u;
      });
    }

    return newFile;
  },

  /**
   * Delete a user's uploaded file from Firestore and Firebase Storage
   */
  async deleteUserFile(userId: string, fileId: string, storagePath?: string): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        // Delete from subcollection
        safeFirestore(deleteDoc(doc(getDb(), 'users', userId, 'files', fileId)), 2500).catch(() => {});
        // Delete from root files collection
        safeFirestore(deleteDoc(doc(getDb(), 'files', fileId)), 2500).catch(() => {});

        // Decrement user uploadedFilesCount
        try {
          const userDocRef = doc(getDb(), 'users', userId);
          const userSnap = await safeFirestore(getDoc(userDocRef), 1500);
          if (userSnap.exists()) {
            const currentCount = Math.max(0, (userSnap.data().uploadedFilesCount || 1) - 1);
            safeFirestore(updateDoc(userDocRef, { uploadedFilesCount: currentCount }), 1500).catch(() => {});
          }
        } catch {
          // Ignore offline error
        }
      } catch {
        // Fallback
      }
    }

    // If storagePath provided, delete from Firebase Storage
    if (storagePath) {
      try {
        await storageService.deleteFile(storagePath);
      } catch (err) {
        console.warn('Error deleting file from storage:', err);
      }
    }

    // Update user file count in memory cache ONLY
    if (memoryCache.users?.data) {
      memoryCache.users.data = memoryCache.users.data.map((u) => {
        if (u.id === userId || u.uid === userId) {
          return {
            ...u,
            uploadedFilesCount: Math.max(0, (u.uploadedFilesCount || 1) - 1),
          };
        }
        return u;
      });
    }
  },

  async syncUserToFirestore(authUser: { uid: string; email: string; displayName: string; phone?: string; role: string; createdAt?: string }): Promise<void> {
    const firestoreUser: FirestoreUser = {
      id: authUser.uid,
      uid: authUser.uid,
      email: authUser.email,
      displayName: authUser.displayName,
      phone: authUser.phone || '',
      role: authUser.role as FirestoreUser['role'],
      createdAt: authUser.createdAt || new Date().toISOString(),
      uploadedFilesCount: 0,
    };

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(getDb(), 'users', authUser.uid);
        const snap = await safeFirestore(getDoc(userDocRef), 1500);
        if (!snap.exists()) {
          safeFirestore(setDoc(userDocRef, firestoreUser), 2000).catch(() => {});
        }
      } catch {
        // Offline mode fallback
      }
    }

    // Update memory users cache ONLY
    const currentUsers = memoryCache.users?.data || [];
    const exists = currentUsers.some((u) => u.uid === authUser.uid || u.email.toLowerCase() === authUser.email.toLowerCase());
    if (!exists) {
      memoryCache.users = {
        data: [firestoreUser, ...currentUsers],
        timestamp: Date.now(),
      };
    }
  },
};
