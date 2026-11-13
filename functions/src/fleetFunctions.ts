import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type {
  Firestore,
  Transaction,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { DATABASE_ID, FUNCTION_REGION } from './constants';
import { isCallerAdmin } from './authz';
import { secureCall } from './secureCall';
import { enforceRateLimit } from './rateLimit';
import { writeAudit } from './audit';

const getDb = (): Firestore => getFirestore(getApp(), DATABASE_ID);

const ALLOWED_CATEGORIES = ['light', 'medium', 'jeep_7seats'] as const;
const ALLOWED_TRANSMISSIONS = ['automatic', 'manual'] as const;
const ALLOWED_FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric'] as const;
const ALLOWED_STATUSES = ['available', 'reserved', 'rented', 'maintenance', 'inactive'] as const;

export const DEFAULT_OIL_CHANGE_INTERVAL_KM = 5000;

const ALLOWED_VEHICLE_CREATE_KEYS = new Set([
  'brand',
  'model',
  'year',
  'color',
  'category',
  'seats',
  'transmission',
  'fuelType',
  'dailyPrice',
  'plateNumber',
  'currentMileage',
  'lastOilChangeMileage',
  'oilChangeIntervalKm',
  'status',
  'imageUrl',
  'images',
  'features',
  'description',
]);

const ALLOWED_VEHICLE_UPDATE_KEYS = new Set([
  'brand',
  'model',
  'year',
  'color',
  'category',
  'seats',
  'transmission',
  'fuelType',
  'dailyPrice',
  'plateNumber',
  'currentMileage',
  'lastOilChangeMileage',
  'oilChangeIntervalKm',
  'status',
  'imageUrl',
  'images',
  'features',
  'description',
]);

export interface ValidatedVehiclePayload {
  brand: string;
  model: string;
  year: number;
  color: string;
  category: (typeof ALLOWED_CATEGORIES)[number];
  seats: number;
  transmission: (typeof ALLOWED_TRANSMISSIONS)[number];
  fuelType: (typeof ALLOWED_FUEL_TYPES)[number];
  dailyPrice: number;
  plateNumber: string;
  currentMileage: number;
  lastOilChangeMileage: number;
  oilChangeIntervalKm: number;
  status: (typeof ALLOWED_STATUSES)[number];
  imageUrl: string;
  images: string[];
  features: string[];
  description: string;
}

/**
 * Pure URL validator:
 * - Allows only http://, https://, or relative paths starting with / (excluding //)
 * - Strictly rejects data:, javascript:, vbscript:, or protocol-relative // URLs
 */
export function isSafeImageUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const clean = url.trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  if (
    lower.startsWith('data:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:')
  ) {
    return false;
  }
  if (lower.startsWith('//')) {
    return false;
  }
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    (lower.startsWith('/') && !lower.startsWith('//'))
  );
}

/**
 * Pure validation helper for creating a new vehicle payload.
 */
export function validateVehiclePayload(
  raw: unknown,
  options?: { partial?: boolean }
): ValidatedVehiclePayload {
  if (options?.partial) {
    return validateVehicleUpdatePayload(raw) as ValidatedVehiclePayload;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpsError('invalid-argument', 'بيانات السيارة غير صالحة.');
  }

  const obj = raw as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!ALLOWED_VEHICLE_CREATE_KEYS.has(key)) {
      throw new HttpsError('invalid-argument', `حقل غير مسموح به في بيانات السيارة: ${key}`);
    }
  }

  const brand = typeof obj.brand === 'string' ? obj.brand.trim() : '';
  if (brand.length < 2 || brand.length > 60) {
    throw new HttpsError('invalid-argument', 'يرجى إدخال الشركة المصنعة (بين 2 و 60 حرفاً).');
  }

  const model = typeof obj.model === 'string' ? obj.model.trim() : '';
  if (model.length < 1 || model.length > 60) {
    throw new HttpsError('invalid-argument', 'يرجى إدخال طراز السيارة (بين 1 و 60 حرفاً).');
  }

  const year = Number(obj.year);
  if (!Number.isInteger(year) || year < 1995 || year > 2030) {
    throw new HttpsError('invalid-argument', 'سنة الصنع يجب أن تكون بين 1995 و 2030.');
  }

  const color = typeof obj.color === 'string' ? obj.color.trim() : '';
  if (color.length < 2 || color.length > 40) {
    throw new HttpsError('invalid-argument', 'يرجى إدخال لون السيارة بشكل صحيح.');
  }

  const category = obj.category as (typeof ALLOWED_CATEGORIES)[number];
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new HttpsError('invalid-argument', 'فئة السيارة غير صالحة.');
  }

  const seats = Number(obj.seats ?? 5);
  if (!Number.isInteger(seats) || seats < 2 || seats > 15) {
    throw new HttpsError('invalid-argument', 'عدد المقاعد يجب أن يكون بين 2 و 15.');
  }

  if (category === 'jeep_7seats' && seats < 7) {
    throw new HttpsError('invalid-argument', 'فئة SUV تتطلب 7 مقاعد على الأقل.');
  }

  const transmission = (obj.transmission ?? 'automatic') as (typeof ALLOWED_TRANSMISSIONS)[number];
  if (!ALLOWED_TRANSMISSIONS.includes(transmission)) {
    throw new HttpsError('invalid-argument', 'نوع ناقل الحركة غير صالح.');
  }

  const fuelType = (obj.fuelType ?? 'petrol') as (typeof ALLOWED_FUEL_TYPES)[number];
  if (!ALLOWED_FUEL_TYPES.includes(fuelType)) {
    throw new HttpsError('invalid-argument', 'نوع الوقود غير صالح.');
  }

  const dailyPrice = Number(obj.dailyPrice);
  if (!Number.isFinite(dailyPrice) || dailyPrice < 10 || dailyPrice > 10000) {
    throw new HttpsError('invalid-argument', 'السعر اليومي يجب أن يكون بين 10 و 10000.');
  }

  const plateNumber = typeof obj.plateNumber === 'string' ? obj.plateNumber.trim() : '';
  if (plateNumber.length < 2 || plateNumber.length > 30) {
    throw new HttpsError('invalid-argument', 'يرجى إدخال رقم اللوحة بشكل صحيح.');
  }

  const currentMileage = Number(obj.currentMileage ?? 0);
  if (!Number.isFinite(currentMileage) || currentMileage < 0 || currentMileage > 2000000) {
    throw new HttpsError('invalid-argument', 'عداد الكيلومترات غير صالح.');
  }
  const roundedMileage = Math.round(currentMileage);

  const rawLastOil = obj.lastOilChangeMileage !== undefined ? Number(obj.lastOilChangeMileage) : roundedMileage;
  if (!Number.isFinite(rawLastOil) || rawLastOil < 0 || rawLastOil > 2000000) {
    throw new HttpsError('invalid-argument', 'عداد آخر تغيير زيت غير صالح.');
  }
  const lastOilChangeMileage = Math.round(rawLastOil);

  const rawInterval = obj.oilChangeIntervalKm !== undefined ? Number(obj.oilChangeIntervalKm) : DEFAULT_OIL_CHANGE_INTERVAL_KM;
  if (!Number.isFinite(rawInterval) || rawInterval < 500 || rawInterval > 50000) {
    throw new HttpsError('invalid-argument', 'دورة تغيير الزيت يجب أن تكون بين 500 و 50,000 كم.');
  }
  const oilChangeIntervalKm = Math.round(rawInterval);

  const status = (obj.status ?? 'available') as (typeof ALLOWED_STATUSES)[number];
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new HttpsError('invalid-argument', 'حالة السيارة غير صالحة.');
  }
  if (status === 'rented') {
    throw new HttpsError('invalid-argument', 'حالة السيارة المؤجرة تنتج حصراً عبر تسليم السيارة لحجز نشط.');
  }

  const imageUrl = typeof obj.imageUrl === 'string' ? obj.imageUrl.trim() : '';
  if (!imageUrl || imageUrl.length > 2048 || !isSafeImageUrl(imageUrl)) {
    throw new HttpsError('invalid-argument', 'رابط الصورة الرئيسية غير صالح أو غير آمن.');
  }

  let images: string[] = [];
  if (Array.isArray(obj.images)) {
    if (obj.images.length > 15) {
      throw new HttpsError('invalid-argument', 'الحد الأقصى للصور الإضافية هو 15 صورة.');
    }
    images = obj.images
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((s) => s.trim());
    for (const img of images) {
      if (img.length > 2048 || !isSafeImageUrl(img)) {
        throw new HttpsError('invalid-argument', 'يحتوي ألبوم الصور على رابط غير صالح أو غير آمن.');
      }
    }
  }

  let features: string[] = [];
  if (Array.isArray(obj.features)) {
    if (obj.features.length > 30) {
      throw new HttpsError('invalid-argument', 'الحد الأقصى للمواصفات هو 30 ميزة.');
    }
    features = obj.features
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((s) => s.trim().slice(0, 100));
  }

  const description = typeof obj.description === 'string' ? obj.description.trim() : '';
  if (description.length > 1000) {
    throw new HttpsError('invalid-argument', 'الوصف يجب ألا يتجاوز 1000 حرف.');
  }

  return {
    brand,
    model,
    year,
    color,
    category,
    seats,
    transmission,
    fuelType,
    dailyPrice,
    plateNumber,
    currentMileage: roundedMileage,
    lastOilChangeMileage,
    oilChangeIntervalKm,
    status,
    imageUrl,
    images,
    features,
    description,
  };
}

/**
 * Pure validation helper for updating an existing vehicle payload (partial updates).
 */
export function validateVehicleUpdatePayload(raw: unknown): Partial<ValidatedVehiclePayload> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpsError('invalid-argument', 'بيانات التحديث غير صالحة.');
  }

  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length === 0) {
    throw new HttpsError('invalid-argument', 'لا توجد حقول لتحديثها.');
  }

  for (const key of keys) {
    if (!ALLOWED_VEHICLE_UPDATE_KEYS.has(key)) {
      throw new HttpsError('invalid-argument', `حقل غير مسموح بتحديثه: ${key}`);
    }
  }

  const updates: Partial<ValidatedVehiclePayload> = {};

  if ('brand' in obj) {
    const brand = typeof obj.brand === 'string' ? obj.brand.trim() : '';
    if (brand.length < 2 || brand.length > 60) {
      throw new HttpsError('invalid-argument', 'يرجى إدخال الشركة المصنعة (بين 2 و 60 حرفاً).');
    }
    updates.brand = brand;
  }

  if ('model' in obj) {
    const model = typeof obj.model === 'string' ? obj.model.trim() : '';
    if (model.length < 1 || model.length > 60) {
      throw new HttpsError('invalid-argument', 'يرجى إدخال طراز السيارة (بين 1 و 60 حرفاً).');
    }
    updates.model = model;
  }

  if ('year' in obj) {
    const year = Number(obj.year);
    if (!Number.isInteger(year) || year < 1995 || year > 2030) {
      throw new HttpsError('invalid-argument', 'سنة الصنع يجب أن تكون بين 1995 و 2030.');
    }
    updates.year = year;
  }

  if ('color' in obj) {
    const color = typeof obj.color === 'string' ? obj.color.trim() : '';
    if (color.length < 2 || color.length > 40) {
      throw new HttpsError('invalid-argument', 'يرجى إدخال لون السيارة بشكل صحيح.');
    }
    updates.color = color;
  }

  if ('category' in obj) {
    const category = obj.category as (typeof ALLOWED_CATEGORIES)[number];
    if (!ALLOWED_CATEGORIES.includes(category)) {
      throw new HttpsError('invalid-argument', 'فئة السيارة غير صالحة.');
    }
    updates.category = category;
  }

  if ('seats' in obj) {
    const seats = Number(obj.seats);
    if (!Number.isInteger(seats) || seats < 2 || seats > 15) {
      throw new HttpsError('invalid-argument', 'عدد المقاعد يجب أن يكون بين 2 و 15.');
    }
    updates.seats = seats;
  }

  if (updates.category === 'jeep_7seats' && updates.seats !== undefined && updates.seats < 7) {
    throw new HttpsError('invalid-argument', 'فئة SUV تتطلب 7 مقاعد على الأقل.');
  }

  if ('transmission' in obj) {
    const transmission = obj.transmission as (typeof ALLOWED_TRANSMISSIONS)[number];
    if (!ALLOWED_TRANSMISSIONS.includes(transmission)) {
      throw new HttpsError('invalid-argument', 'نوع ناقل الحركة غير صالح.');
    }
    updates.transmission = transmission;
  }

  if ('fuelType' in obj) {
    const fuelType = obj.fuelType as (typeof ALLOWED_FUEL_TYPES)[number];
    if (!ALLOWED_FUEL_TYPES.includes(fuelType)) {
      throw new HttpsError('invalid-argument', 'نوع الوقود غير صالح.');
    }
    updates.fuelType = fuelType;
  }

  if ('dailyPrice' in obj) {
    const dailyPrice = Number(obj.dailyPrice);
    if (!Number.isFinite(dailyPrice) || dailyPrice < 10 || dailyPrice > 10000) {
      throw new HttpsError('invalid-argument', 'السعر اليومي يجب أن يكون بين 10 و 10000.');
    }
    updates.dailyPrice = dailyPrice;
  }

  if ('plateNumber' in obj) {
    const plateNumber = typeof obj.plateNumber === 'string' ? obj.plateNumber.trim() : '';
    if (plateNumber.length < 2 || plateNumber.length > 30) {
      throw new HttpsError('invalid-argument', 'يرجى إدخال رقم اللوحة بشكل صحيح.');
    }
    updates.plateNumber = plateNumber;
  }

  if ('currentMileage' in obj) {
    const currentMileage = Number(obj.currentMileage);
    if (!Number.isFinite(currentMileage) || currentMileage < 0 || currentMileage > 2000000) {
      throw new HttpsError('invalid-argument', 'عداد الكيلومترات غير صالح.');
    }
    updates.currentMileage = Math.round(currentMileage);
  }

  if ('lastOilChangeMileage' in obj) {
    const lastOilChangeMileage = Number(obj.lastOilChangeMileage);
    if (!Number.isFinite(lastOilChangeMileage) || lastOilChangeMileage < 0 || lastOilChangeMileage > 2000000) {
      throw new HttpsError('invalid-argument', 'عداد آخر تغيير زيت غير صالح.');
    }
    updates.lastOilChangeMileage = Math.round(lastOilChangeMileage);
  }

  if ('oilChangeIntervalKm' in obj) {
    const oilChangeIntervalKm = Number(obj.oilChangeIntervalKm);
    if (!Number.isFinite(oilChangeIntervalKm) || oilChangeIntervalKm < 500 || oilChangeIntervalKm > 50000) {
      throw new HttpsError('invalid-argument', 'دورة تغيير الزيت يجب أن تكون بين 500 و 50,000 كم.');
    }
    updates.oilChangeIntervalKm = Math.round(oilChangeIntervalKm);
  }

  if ('status' in obj) {
    const status = obj.status as (typeof ALLOWED_STATUSES)[number];
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new HttpsError('invalid-argument', 'حالة السيارة غير صالحة.');
    }
    if (status === 'rented') {
      throw new HttpsError('invalid-argument', 'حالة السيارة المؤجرة تنتج حصراً عبر تسليم السيارة لحجز نشط.');
    }
    updates.status = status;
  }

  if ('imageUrl' in obj) {
    const imageUrl = typeof obj.imageUrl === 'string' ? obj.imageUrl.trim() : '';
    if (!imageUrl || imageUrl.length > 2048 || !isSafeImageUrl(imageUrl)) {
      throw new HttpsError('invalid-argument', 'رابط الصورة الرئيسية غير صالح أو غير آمن.');
    }
    updates.imageUrl = imageUrl;
  }

  if ('images' in obj) {
    if (!Array.isArray(obj.images) || obj.images.length > 15) {
      throw new HttpsError('invalid-argument', 'الحد الأقصى للصور الإضافية هو 15 صورة.');
    }
    const imgs = obj.images
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((s) => s.trim());
    for (const img of imgs) {
      if (img.length > 2048 || !isSafeImageUrl(img)) {
        throw new HttpsError('invalid-argument', 'يحتوي ألبوم الصور على رابط غير صالح أو غير آمن.');
      }
    }
    updates.images = imgs;
  }

  if ('features' in obj) {
    if (!Array.isArray(obj.features) || obj.features.length > 30) {
      throw new HttpsError('invalid-argument', 'الحد الأقصى للمواصفات هو 30 ميزة.');
    }
    updates.features = obj.features
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((s) => s.trim().slice(0, 100));
  }

  if ('description' in obj) {
    const description = typeof obj.description === 'string' ? obj.description.trim() : '';
    if (description.length > 1000) {
      throw new HttpsError('invalid-argument', 'الوصف يجب ألا يتجاوز 1000 حرف.');
    }
    updates.description = description;
  }

  return updates;
}

/**
 * Pure helper to assert that the caller has Admin or Super Admin privileges.
 */
export function assertFleetAdmin(
  token?: {
    role?: string;
    super_admin?: boolean;
    owner?: boolean;
    admin?: boolean;
  } | null
): void {
  if (!isCallerAdmin(token)) {
    throw new HttpsError('permission-denied', 'هذه العملية مخصصة للمدير (Admin) فقط.');
  }
}

/**
 * Pure helper to check whether a vehicle has active or pending bookings before deletion.
 */
export function assertCanDeleteVehicle(
  vehicleId: string,
  bookings: Array<{ id?: string; vehicleId?: string; status?: string; bookingNumber?: string; isDeleted?: boolean }>
): void {
  const blockingStatuses = new Set(['new', 'reviewing', 'confirmed', 'rented']);
  const blocking = bookings.filter(
    (b) =>
      b.vehicleId === vehicleId &&
      !b.isDeleted &&
      typeof b.status === 'string' &&
      blockingStatuses.has(b.status)
  );

  if (blocking.length > 0) {
    const numbers = blocking
      .map((b) => b.bookingNumber || b.id || 'غير معروف')
      .slice(0, 10)
      .join('، ');
    throw new HttpsError(
      'failed-precondition',
      `لا يمكن حذف السيارة لوجود ${blocking.length} حجز نشط أو معلّق مرتبط بها (${numbers}). يرجى إكمال أو إلغاء تلك الحجوزات أولاً.`
    );
  }
}

/**
 * Normalizes a plate number for uniqueness check.
 */
function normalizePlateForKey(plate: string): string {
  return plate.trim().replace(/\s+/g, '-').toUpperCase();
}

/**
 * 1. addVehicle — Admin-only callable function to create a vehicle atomically
 */
export const addVehicle = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'admin',
    unauthenticatedMessage: 'يجب تسجيل الدخول.',
    permissionDeniedMessage: 'هذه العملية مخصصة للمدير (Admin) فقط.',
  },
  async (request) => {
    const db = getDb();

    const callerUid = request.auth!.uid;
    const callerEmail = request.auth!.token.email || 'admin@shaker.sy';
    await enforceRateLimit(db, `fleet_write_${callerUid}`, 30, 60);

    const reqData = (request.data || {}) as { id?: string; vehicle?: unknown; vehicleData?: unknown } & Record<string, unknown>;
    const rawPayload = (reqData.vehicleData && typeof reqData.vehicleData === 'object'
      ? reqData.vehicleData
      : reqData.vehicle && typeof reqData.vehicle === 'object'
      ? reqData.vehicle
      : reqData) as Record<string, unknown>;

    const requestedId = typeof reqData.id === 'string'
      ? reqData.id
      : typeof rawPayload.id === 'string'
      ? rawPayload.id
      : undefined;

    const payloadWithoutId = { ...rawPayload };
    delete payloadWithoutId.id;
    const validated = validateVehiclePayload(payloadWithoutId);

    const vehicleId =
      typeof requestedId === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(requestedId.trim())
        ? requestedId.trim()
        : `veh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const nowIso = new Date().toISOString();
    const {
      plateNumber,
      currentMileage,
      lastOilChangeMileage,
      oilChangeIntervalKm,
      ...publicFields
    } = validated;
    const plateKey = normalizePlateForKey(plateNumber);

    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const internalRef = vehicleRef.collection('internal').doc('details');
    const plateRef = db.collection('vehiclePlates').doc(plateKey);

    await db.runTransaction(async (transaction: Transaction) => {
      const [existingSnap, plateSnap] = await Promise.all([
        transaction.get(vehicleRef),
        transaction.get(plateRef),
      ]);

      if (existingSnap.exists) {
        throw new HttpsError('already-exists', 'معرف السيارة موجود مسبقاً.');
      }

      if (plateSnap.exists && plateSnap.data()?.vehicleId !== vehicleId) {
        throw new HttpsError('already-exists', `رقم اللوحة (${plateNumber}) مستخدم بالفعل لسيارة أخرى.`);
      }

      transaction.set(vehicleRef, {
        ...publicFields,
        id: vehicleId,
        lastOilChangeMileage,
        oilChangeIntervalKm,
        isDeleted: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(internalRef, {
        plateNumber,
        currentMileage,
        lastOilChangeMileage,
        oilChangeIntervalKm,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(plateRef, {
        vehicleId,
        plateNumber,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      writeAudit(db, transaction, {
        actorUid: callerUid,
        actorEmail: callerEmail,
        actorRole: String(request.auth?.token?.role || 'admin'),
        actorType: 'staff',
        action: 'create',
        entity: 'vehicle',
        entityId: vehicleId,
        entityName: `${validated.brand} ${validated.model}`,
        details: `إضافة سيارة جديدة للأسطول: ${validated.brand} ${validated.model} (${validated.year}) - السعر اليومي: $${validated.dailyPrice}`,
      });
    });

    return {
      success: true,
      id: vehicleId,
      vehicle: {
        id: vehicleId,
        ...validated,
        isDeleted: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    };
  }
);

/**
 * 2. updateVehicle — Admin-only callable function to update a vehicle atomically
 */
export const updateVehicle = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'admin',
    unauthenticatedMessage: 'يجب تسجيل الدخول.',
    permissionDeniedMessage: 'هذه العملية مخصصة للمدير (Admin) فقط.',
  },
  async (request) => {
    const db = getDb();

    const callerUid = request.auth!.uid;
    const callerEmail = request.auth!.token.email || 'admin@shaker.sy';
    await enforceRateLimit(db, `fleet_write_${callerUid}`, 40, 60);

    const { id, updates: rawUpdates, force: directForce } = (request.data || {}) as {
      id?: string;
      updates?: unknown;
      force?: boolean;
    };

    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new HttpsError('invalid-argument', 'معرف السيارة مطلوب.');
    }

    const vehicleId = id.trim();
    const validatedUpdates = validateVehicleUpdatePayload(rawUpdates);
    const nowIso = new Date().toISOString();

    const { plateNumber, currentMileage, ...publicUpdates } = validatedUpdates;

    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const internalRef = vehicleRef.collection('internal').doc('details');

    let mergedResult: Record<string, unknown> = {};

    await db.runTransaction(async (transaction: Transaction) => {
      const [existingSnap, internalSnap] = await Promise.all([
        transaction.get(vehicleRef),
        transaction.get(internalRef),
      ]);

      if (!existingSnap.exists || existingSnap.data()?.isDeleted) {
        throw new HttpsError('not-found', 'السيارة المطلوبة غير موجودة.');
      }

      const existingData = existingSnap.data() || {};
      const internalData = internalSnap.exists ? internalSnap.data() || {} : {};

      // Vehicle status change enforcement (Item 5)
      if (publicUpdates.status && publicUpdates.status !== existingData.status) {
        const rentedSnap = await transaction.get(
          db.collection('bookings')
            .where('vehicleId', '==', vehicleId)
            .where('status', '==', 'rented')
        );
        const activeRented = rentedSnap.docs.filter((d: QueryDocumentSnapshot) => !d.data()?.isDeleted);
        if (activeRented.length > 0) {
          throw new HttpsError('failed-precondition', 'لا يمكن تغيير حالة السيارة لوجود حجز مؤجر نشط حالياً.');
        }

        if (publicUpdates.status === 'maintenance') {
          const confirmedSnap = await transaction.get(
            db.collection('bookings')
              .where('vehicleId', '==', vehicleId)
              .where('status', '==', 'confirmed')
          );
          const activeConfirmed = confirmedSnap.docs.filter((d: QueryDocumentSnapshot) => !d.data()?.isDeleted);
          const isForce = directForce === true || (rawUpdates as any)?.force === true;
          if (activeConfirmed.length > 0 && !isForce) {
            const numbers = activeConfirmed
              .map((d: QueryDocumentSnapshot) => d.data()?.bookingNumber || d.id)
              .join('، ');
            throw new HttpsError(
              'failed-precondition',
              `توجد حجوزات مؤكدة قادمة مرتبطة بهذه السيارة (${numbers}). يتطلب إدخال السيارة للصيانة تأكيداً صريحاً (force: true).`
            );
          }
        }
      }

      const effectiveCategory = publicUpdates.category ?? existingData.category;
      const effectiveSeats = publicUpdates.seats ?? existingData.seats ?? 5;
      if (effectiveCategory === 'jeep_7seats' && effectiveSeats < 7) {
        throw new HttpsError('invalid-argument', 'فئة SUV تتطلب 7 مقاعد على الأقل.');
      }

      const oldMileage = Number(internalData.currentMileage ?? existingData.currentMileage ?? 0);
      if (currentMileage !== undefined && currentMileage < oldMileage) {
        throw new HttpsError(
          'invalid-argument',
          `لا يمكن خفض عداد المسافة (القراءة الحالية المسجلة: ${oldMileage} كم).`
        );
      }

      const oldPlate = typeof internalData.plateNumber === 'string' ? internalData.plateNumber : '';
      let oldPlateKey = oldPlate ? normalizePlateForKey(oldPlate) : '';
      let newPlateKey = '';

      if (plateNumber !== undefined) {
        newPlateKey = normalizePlateForKey(plateNumber);
        if (newPlateKey !== oldPlateKey) {
          const newPlateRef = db.collection('vehiclePlates').doc(newPlateKey);
          const newPlateSnap = await transaction.get(newPlateRef);
          if (newPlateSnap.exists && newPlateSnap.data()?.vehicleId !== vehicleId) {
            throw new HttpsError('already-exists', `رقم اللوحة (${plateNumber}) مستخدم بالفعل لسيارة أخرى.`);
          }
          transaction.set(newPlateRef, {
            vehicleId,
            plateNumber,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          if (oldPlateKey) {
            transaction.delete(db.collection('vehiclePlates').doc(oldPlateKey));
          }
        }
      }

      if (Object.keys(publicUpdates).length > 0) {
        transaction.set(
          vehicleRef,
          {
            ...publicUpdates,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } else {
        transaction.set(vehicleRef, { updatedAt: nowIso }, { merge: true });
      }

      const internalPayload: Record<string, unknown> = { updatedAt: nowIso };
      if (plateNumber !== undefined) internalPayload.plateNumber = plateNumber;
      if (currentMileage !== undefined) internalPayload.currentMileage = currentMileage;
      if (publicUpdates.lastOilChangeMileage !== undefined) {
        internalPayload.lastOilChangeMileage = publicUpdates.lastOilChangeMileage;
      }
      if (publicUpdates.oilChangeIntervalKm !== undefined) {
        internalPayload.oilChangeIntervalKm = publicUpdates.oilChangeIntervalKm;
      }

      if (
        plateNumber !== undefined ||
        currentMileage !== undefined ||
        publicUpdates.lastOilChangeMileage !== undefined ||
        publicUpdates.oilChangeIntervalKm !== undefined
      ) {
        transaction.set(internalRef, internalPayload, { merge: true });
      }

      const vehicleName = `${publicUpdates.brand ?? existingData.brand ?? ''} ${
        publicUpdates.model ?? existingData.model ?? ''
      }`.trim();

      writeAudit(db, transaction, {
        actorUid: callerUid,
        actorEmail: callerEmail,
        actorRole: String(request.auth?.token?.role || 'admin'),
        actorType: 'staff',
        action: 'update',
        entity: 'vehicle',
        entityId: vehicleId,
        entityName: vehicleName || vehicleId,
        details: `تعديل بيانات السيارة (${vehicleName}): ${Object.keys(validatedUpdates).join(', ')}`,
      });

      mergedResult = {
        ...existingData,
        ...publicUpdates,
        id: vehicleId,
        plateNumber: plateNumber ?? internalData.plateNumber ?? '',
        currentMileage: currentMileage ?? internalData.currentMileage ?? 0,
        lastOilChangeMileage:
          publicUpdates.lastOilChangeMileage ??
          internalData.lastOilChangeMileage ??
          existingData.lastOilChangeMileage ??
          0,
        oilChangeIntervalKm:
          publicUpdates.oilChangeIntervalKm ??
          internalData.oilChangeIntervalKm ??
          existingData.oilChangeIntervalKm ??
          DEFAULT_OIL_CHANGE_INTERVAL_KM,
        updatedAt: nowIso,
      };
    });

    return {
      success: true,
      vehicle: mergedResult,
    };
  }
);

/**
 * 3. deleteVehicle — Admin-only callable function to delete a vehicle atomically
 */
export const deleteVehicle = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'admin',
    unauthenticatedMessage: 'يجب تسجيل الدخول.',
    permissionDeniedMessage: 'هذه العملية مخصصة للمدير (Admin) فقط.',
  },
  async (request) => {
    const db = getDb();

    const callerUid = request.auth!.uid;
    const callerEmail = request.auth!.token.email || 'admin@shaker.sy';
    await enforceRateLimit(db, `fleet_write_${callerUid}`, 20, 60);

    const { id } = (request.data || {}) as { id?: string };
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw new HttpsError('invalid-argument', 'معرف السيارة مطلوب.');
    }

    const vehicleId = id.trim();
    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const internalRef = vehicleRef.collection('internal').doc('details');

    await db.runTransaction(async (transaction: Transaction) => {
      const bookingsQuery = db.collection('bookings').where('vehicleId', '==', vehicleId);
      const [existingSnap, internalSnap, bookingsSnap] = await Promise.all([
        transaction.get(vehicleRef),
        transaction.get(internalRef),
        transaction.get(bookingsQuery),
      ]);

      if (!existingSnap.exists) {
        throw new HttpsError('not-found', 'السيارة غير موجودة.');
      }

      const existingData = existingSnap.data() || {};
      const internalData = internalSnap.exists ? internalSnap.data() || {} : {};
      const vehicleName = `${existingData.brand || ''} ${existingData.model || ''}`.trim() || vehicleId;

      const bookingsList = bookingsSnap.docs.map((doc: QueryDocumentSnapshot) => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
      }));

      assertCanDeleteVehicle(vehicleId, bookingsList);

      const oldPlate = typeof internalData.plateNumber === 'string' ? internalData.plateNumber : '';
      if (oldPlate) {
        const plateKey = normalizePlateForKey(oldPlate);
        if (plateKey) {
          transaction.delete(db.collection('vehiclePlates').doc(plateKey));
        }
      }

      transaction.delete(internalRef);
      transaction.delete(vehicleRef);

      writeAudit(db, transaction, {
        actorUid: callerUid,
        actorEmail: callerEmail,
        actorRole: String(request.auth?.token?.role || 'admin'),
        actorType: 'staff',
        action: 'delete',
        entity: 'vehicle',
        entityId: vehicleId,
        entityName: vehicleName,
        details: `حذف السيارة نهائياً من الأسطول: ${vehicleName} (${vehicleId})`,
      });
    });

    return {
      success: true,
      deletedId: vehicleId,
    };
  }
);

/**
 * 4. getVehiclesInternalDetails — Admin-only batch fetch for internal details
 */
export const getVehiclesInternalDetails = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'admin',
    unauthenticatedMessage: 'يجب تسجيل الدخول.',
    permissionDeniedMessage: 'هذه العملية مخصصة للمدير (Admin) فقط.',
  },
  async () => {
    const db = getDb();

    const vehiclesSnap = await db.collection('vehicles').get();
    if (vehiclesSnap.empty) {
      return { success: true, details: {} };
    }

    const internalRefs = vehiclesSnap.docs.map((doc: QueryDocumentSnapshot) =>
      doc.ref.collection('internal').doc('details')
    );

    const internalSnaps = await db.getAll(...internalRefs);
    const detailsMap: Record<
      string,
      {
        plateNumber: string;
        currentMileage: number;
        lastOilChangeMileage?: number;
        oilChangeIntervalKm?: number;
      }
    > = {};

    internalSnaps.forEach((snap: DocumentSnapshot, idx: number) => {
      const vId = vehiclesSnap.docs[idx].id;
      const vData = vehiclesSnap.docs[idx].data() || {};
      if (snap.exists) {
        const d = snap.data() || {};
        detailsMap[vId] = {
          plateNumber: typeof d.plateNumber === 'string' ? d.plateNumber : '',
          currentMileage: Number(d.currentMileage ?? 0),
          lastOilChangeMileage:
            d.lastOilChangeMileage !== undefined
              ? Number(d.lastOilChangeMileage)
              : vData.lastOilChangeMileage !== undefined
              ? Number(vData.lastOilChangeMileage)
              : undefined,
          oilChangeIntervalKm:
            d.oilChangeIntervalKm !== undefined
              ? Number(d.oilChangeIntervalKm)
              : vData.oilChangeIntervalKm !== undefined
              ? Number(vData.oilChangeIntervalKm)
              : undefined,
        };
      } else {
        detailsMap[vId] = {
          plateNumber: '',
          currentMileage: 0,
          lastOilChangeMileage:
            vData.lastOilChangeMileage !== undefined ? Number(vData.lastOilChangeMileage) : undefined,
          oilChangeIntervalKm:
            vData.oilChangeIntervalKm !== undefined ? Number(vData.oilChangeIntervalKm) : undefined,
        };
      }
    });

    return {
      success: true,
      details: detailsMap,
    };
  }
);
