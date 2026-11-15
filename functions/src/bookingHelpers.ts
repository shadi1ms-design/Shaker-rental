import { FieldValue } from 'firebase-admin/firestore';
import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Transaction,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { buildContractSnapshot } from './contractHelpers';
import { parseDamascusDateTime } from './pricingServer';
import { writeAudit } from './audit';

export type BookingStatus =
  | 'new'
  | 'reviewing'
  | 'confirmed'
  | 'rented'
  | 'completed'
  | 'cancelled'
  | 'rejected';

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  new: ['reviewing', 'confirmed', 'rejected', 'cancelled'],
  reviewing: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['rented', 'cancelled'],
  rented: ['completed'],
  completed: [],
  cancelled: [],
  rejected: [],
};

/**
 * Pure helper to validate booking status transitions.
 * - Transitions to 'rented' ("تسليم السيارة") and 'completed' ("استلام السيارة") are allowed
 *   along the valid lifecycle path (confirmed -> rented -> completed) for staff/admin.
 * - Customers can only transition to 'cancelled' (when allowed).
 */
export function assertValidBookingStatusTransition(
  currentStatus: string | undefined,
  newStatus: string,
  isStaff: boolean = true
): void {
  const curr = (currentStatus || 'new') as BookingStatus;
  const next = newStatus as BookingStatus;

  if ((next === 'rented' || next === 'completed') && !isStaff) {
    throw new Error('تسليم واستلام السيارة متاح للموظفين والإدارة فقط.');
  }

  const allowed = ALLOWED_TRANSITIONS[curr];
  if (!allowed || !allowed.includes(next)) {
    throw new Error(`انتقال حالة الحجز من "${curr}" إلى "${next}" غير مسموح به.`);
  }
}

export async function resolveVehicleDocument(
  db: Firestore,
  vehicleId: string
): Promise<{ ref: DocumentReference; snap: DocumentSnapshot; data: any } | null> {
  if (!vehicleId || typeof vehicleId !== 'string') return null;
  const cleanId = vehicleId.trim();
  if (!cleanId) return null;

  const directRef = db.collection('vehicles').doc(cleanId);
  const directSnap = await directRef.get();
  if (directSnap.exists) {
    return { ref: directRef, snap: directSnap, data: directSnap.data() };
  }

  const querySnap = await db.collection('vehicles').where('id', '==', cleanId).limit(1).get();
  if (!querySnap.empty) {
    const doc = querySnap.docs[0];
    return { ref: doc.ref, snap: doc, data: doc.data() };
  }

  return null;
}

export async function resolveBookingDocument(
  db: Firestore,
  bookingId: string,
  bookingNumber?: string
): Promise<DocumentReference | null> {
  if (bookingId && typeof bookingId === 'string' && bookingId.trim()) {
    const cleanId = bookingId.trim();
    const directRef = db.collection('bookings').doc(cleanId);
    const directSnap = await directRef.get();
    if (directSnap.exists) {
      return directRef;
    }

    const byIdQuery = await db.collection('bookings').where('id', '==', cleanId).limit(1).get();
    if (!byIdQuery.empty) {
      return byIdQuery.docs[0].ref;
    }

    const byNumQuery = await db.collection('bookings').where('bookingNumber', '==', cleanId).limit(1).get();
    if (!byNumQuery.empty) {
      return byNumQuery.docs[0].ref;
    }
  }

  if (bookingNumber && typeof bookingNumber === 'string' && bookingNumber.trim()) {
    const cleanNum = bookingNumber.trim();
    const numQuery = await db.collection('bookings').where('bookingNumber', '==', cleanNum).limit(1).get();
    if (!numQuery.empty) {
      return numQuery.docs[0].ref;
    }
  }

  return null;
}

export interface BookingTimeInterval {
  bookingId?: string;
  pickupDate: string;
  returnDate: string;
  pickupTime?: string;
  returnTime?: string;
  status?: BookingStatus;
  createdAt?: string;
  isDeleted?: boolean;
}

export interface OverlapCheckResult {
  hasConflict: boolean;
  conflictingBookingId?: string;
  reason?: string;
}

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'rented'];
const PENDING_HOLD_STATUSES: BookingStatus[] = ['new', 'reviewing'];
const PENDING_HOLD_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes TTL for unconfirmed holds

export function parseBookingDateTimeMs(dateStr: string, timeStr: string = '10:00'): number {
  const parsed = parseDamascusDateTime(dateStr, timeStr);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  const cleanDate = (dateStr || '').trim();
  const parsedFallback = Date.parse(cleanDate);
  return Number.isNaN(parsedFallback) ? NaN : parsedFallback;
}

export function isBookingBlockingSlot(
  booking: BookingTimeInterval,
  nowMs: number = Date.now()
): boolean {
  if (booking.isDeleted) return false;
  const status = booking.status || 'new';

  if (ACTIVE_BOOKING_STATUSES.includes(status)) {
    return true;
  }

  if (PENDING_HOLD_STATUSES.includes(status)) {
    if (!booking.createdAt) return true;
    const createdMs = Date.parse(booking.createdAt);
    if (Number.isNaN(createdMs)) return true;
    return nowMs - createdMs <= PENDING_HOLD_EXPIRY_MS;
  }

  return false;
}

export function checkBookingOverlap(
  requested: BookingTimeInterval,
  existingBookings: BookingTimeInterval[],
  nowMs: number = Date.now(),
  bufferMinutes: number = 60
): OverlapCheckResult {
  const reqStart = parseBookingDateTimeMs(requested.pickupDate, requested.pickupTime || '10:00');
  const reqEnd = parseBookingDateTimeMs(requested.returnDate, requested.returnTime || '10:00');

  if (Number.isNaN(reqStart) || Number.isNaN(reqEnd)) {
    return {
      hasConflict: true,
      reason: 'تواريخ الحجز غير صالحة.',
    };
  }

  if (reqEnd <= reqStart) {
    return {
      hasConflict: true,
      reason: 'تاريخ ووقت الإرجاع يجب أن يكون بعد تاريخ ووقت الاستلام.',
    };
  }

  const bufferMs = bufferMinutes * 60 * 1000;

  for (const existing of existingBookings) {
    if (requested.bookingId && existing.bookingId === requested.bookingId) {
      continue;
    }

    if (!isBookingBlockingSlot(existing, nowMs)) {
      continue;
    }

    const exStart = parseBookingDateTimeMs(existing.pickupDate, existing.pickupTime || '10:00');
    const exEnd = parseBookingDateTimeMs(existing.returnDate, existing.returnTime || '10:00');

    if (Number.isNaN(exStart) || Number.isNaN(exEnd)) continue;

    if (reqStart < exEnd + bufferMs && reqEnd + bufferMs > exStart) {
      return {
        hasConflict: true,
        conflictingBookingId: existing.bookingId,
        reason: `السيارة محجوزة أو قيد الحجز في الفترة من ${existing.pickupDate} إلى ${existing.returnDate}.`,
      };
    }
  }

  return { hasConflict: false };
}

export interface ApplyBookingStatusOptions {
  reason?: string;
  extraCharges?: number;
  returnCondition?: string;
  mileageAtPickup?: number;
  mileageAtReturn?: number;
  currentMileage?: number;
  confirmOilOverdue?: boolean;
  actorUid?: string | null;
  actorEmail?: string | null;
  actorRole?: string;
  actorType?: 'customer' | 'staff' | 'system';
  telegramUserId?: string | number | null;
  telegramName?: string | null;
}

/**
 * Applies a booking status change atomically within a Firestore transaction:
 * - Enforces state machine transitions
 * - On `confirmed`: verifies no overlap and creates frozen contract `contracts/CTR_{bookingId}` (`status: 'issued'`)
 * - On `rented` ("تسليم السيارة"): validates optional pickup mileage, marks vehicle `rented`, updates contract (`status: 'active'`), logs audit entry
 * - On `completed` ("استلام السيارة"): validates return mileage >= currentMileage, updates `vehicles/{id}/internal/details.currentMileage`, closes contract (`status: 'closed'`), frees vehicle if no other rented bookings, logs audit entry
 * - On `cancelled` or `rejected`: terminates existing contract and releases vehicle if needed
 */
export async function applyBookingStatusChange(
  db: Firestore,
  bookingId: string,
  newStatus: BookingStatus | string,
  actorEmail: string,
  options?: ApplyBookingStatusOptions
): Promise<{
  success: boolean;
  message: string;
  previousStatus?: BookingStatus;
  newStatus?: BookingStatus;
  mileageAtPickup?: number;
  mileageAtReturn?: number;
}> {
  const targetStatus = newStatus as BookingStatus;
  const bookingRef = db.collection('bookings').doc(bookingId);
  const contractRef = db.collection('contracts').doc(`CTR_${bookingId}`);
  const nowIso = new Date().toISOString();
  const isStaff = (options?.actorType || 'staff') !== 'customer';

  return db.runTransaction(async (transaction: Transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) {
      throw new Error('الحجز المطلوب غير موجود.');
    }

    const bookingData = bookingSnap.data()!;
    const previousStatus = bookingData.status as BookingStatus;
    const vehicleId = bookingData.vehicleId as string;

    // Validate status transition
    assertValidBookingStatusTransition(previousStatus, targetStatus, isStaff);

    let vehicleSnap: DocumentSnapshot | null = null;
    let internalVehicleSnap: DocumentSnapshot | null = null;
    let customerSnap: DocumentSnapshot | null = null;
    let settingsSnap: DocumentSnapshot | null = null;
    let existingContractSnap: DocumentSnapshot | null = null;

    if (targetStatus === 'confirmed') {
      const bookingsQuery = db.collection('bookings')
        .where('vehicleId', '==', vehicleId)
        .where('status', 'in', ['confirmed', 'rented']);
      const [bookingsSnap, vSnap, intVSnap, cSnap, sSnap, ctrSnap] = await Promise.all([
        transaction.get(bookingsQuery),
        vehicleId ? transaction.get(db.collection('vehicles').doc(vehicleId)) : Promise.resolve(null),
        vehicleId
          ? transaction.get(db.collection('vehicles').doc(vehicleId).collection('internal').doc('details'))
          : Promise.resolve(null),
        bookingData.customerId
          ? transaction.get(db.collection('users').doc(String(bookingData.customerId)))
          : Promise.resolve(null),
        transaction.get(db.collection('settings').doc('global')),
        transaction.get(contractRef),
      ]);

      vehicleSnap = vSnap;
      internalVehicleSnap = intVSnap;
      customerSnap = cSnap;
      settingsSnap = sSnap;
      existingContractSnap = ctrSnap;

      const vData = vehicleSnap?.exists ? (vehicleSnap.data() || {}) : {};
      if (!vehicleSnap?.exists || vData.isDeleted === true) {
        return {
          success: false,
          message: 'السيارة غير موجودة أو محذوفة من الأسطول.',
          previousStatus,
          newStatus: targetStatus,
        };
      }

      if (vData.status === 'maintenance' || vData.status === 'inactive') {
        return {
          success: false,
          message: 'السيارة غير متاحة للحجز حالياً (في الصيانة أو معطلة).',
          previousStatus,
          newStatus: targetStatus,
        };
      }

      const pickupMs = parseDamascusDateTime(bookingData.pickupDate, bookingData.pickupTime || '10:00');
      if (!Number.isNaN(pickupMs) && Date.now() - pickupMs > 2 * 60 * 60 * 1000) {
        return {
          success: false,
          message: 'لا يمكن تأكيد حجز مضى على موعد استلامه أكثر من ساعتين.',
          previousStatus,
          newStatus: targetStatus,
        };
      }

      const existingIntervals: BookingTimeInterval[] = bookingsSnap.docs
        .map((doc: QueryDocumentSnapshot) => ({
          bookingId: doc.id,
          ...(doc.data() as BookingTimeInterval),
        }))
        .filter((b: BookingTimeInterval) => !b.isDeleted && b.bookingId !== bookingId);

      const bufferMinutes = Number(settingsSnap?.data()?.turnaroundBufferMinutes ?? 60);

      const overlap = checkBookingOverlap(
        {
          bookingId,
          pickupDate: bookingData.pickupDate,
          returnDate: bookingData.returnDate,
          pickupTime: bookingData.pickupTime,
          returnTime: bookingData.returnTime,
          status: 'confirmed',
        },
        existingIntervals,
        Date.now(),
        bufferMinutes
      );

      if (overlap.hasConflict) {
        return {
          success: false,
          message: overlap.reason || 'يوجد تعارض مع حجز آخر مؤكد لنفس السيارة.',
          previousStatus,
          newStatus: targetStatus,
        };
      }
    } else if (targetStatus === 'rented' || targetStatus === 'completed') {
      const [vSnap, intVSnap, cSnap, sSnap, ctrSnap] = await Promise.all([
        vehicleId ? transaction.get(db.collection('vehicles').doc(vehicleId)) : Promise.resolve(null),
        vehicleId
          ? transaction.get(db.collection('vehicles').doc(vehicleId).collection('internal').doc('details'))
          : Promise.resolve(null),
        bookingData.customerId
          ? transaction.get(db.collection('users').doc(String(bookingData.customerId)))
          : Promise.resolve(null),
        transaction.get(db.collection('settings').doc('global')),
        transaction.get(contractRef),
      ]);
      vehicleSnap = vSnap;
      internalVehicleSnap = intVSnap;
      customerSnap = cSnap;
      settingsSnap = sSnap;
      existingContractSnap = ctrSnap;

      const vData = vehicleSnap?.exists ? (vehicleSnap.data() || {}) : {};
      if (targetStatus === 'rented') {
        if (!vehicleSnap?.exists || vData.isDeleted === true) {
          throw new Error('السيارة غير موجودة أو محذوفة من الأسطول.');
        }
        if (vData.status === 'maintenance' || vData.status === 'inactive') {
          throw new Error('السيارة غير متاحة للتسليم حالياً (في الصيانة أو معطلة).');
        }
      }
    } else if (targetStatus === 'cancelled' || targetStatus === 'rejected') {
      existingContractSnap = await transaction.get(contractRef);
    }

    let otherActiveBookingsCount = 0;
    if (vehicleId && (targetStatus === 'completed' || targetStatus === 'cancelled' || targetStatus === 'rejected')) {
      const activeSnap = await transaction.get(
        db
          .collection('bookings')
          .where('vehicleId', '==', vehicleId)
          .where('status', '==', 'rented')
      );
      otherActiveBookingsCount = activeSnap.docs.filter(
        (d: QueryDocumentSnapshot) => d.id !== bookingId && !d.data().isDeleted
      ).length;
    }

    const basePriceTotal = Number(bookingData.totalPrice || 0);
    const extraChargesVal =
      typeof options?.extraCharges === 'number'
        ? Math.max(0, options.extraCharges)
        : typeof bookingData.extraCharges === 'number'
        ? bookingData.extraCharges
        : 0;
    const calculatedFinalTotal = Math.max(0, basePriceTotal + extraChargesVal);

    const updatePayload: Record<string, any> = {
      status: targetStatus,
      updatedAt: nowIso,
      updatedByEmail: actorEmail,
    };

    if (options?.actorUid) updatePayload.updatedByUid = options.actorUid;
    if (options?.reason) updatePayload.statusReason = options.reason;
    if (typeof options?.extraCharges === 'number') {
      updatePayload.extraCharges = extraChargesVal;
      updatePayload.finalTotal = calculatedFinalTotal;
    }
    if (options?.returnCondition) updatePayload.returnCondition = options.returnCondition;

    let resolvedPickupMileage: number | undefined;
    let resolvedReturnMileage: number | undefined;

    const vehicleData = vehicleSnap?.exists ? vehicleSnap.data() || {} : {};
    const internalData = internalVehicleSnap?.exists ? internalVehicleSnap.data() || {} : {};
    const currentVehicleMileage = Math.max(
      0,
      Number(internalData.currentMileage ?? vehicleData.currentMileage ?? 0)
    );

    if (newStatus === 'rented') {
      const rawPickupMileage = options?.mileageAtPickup ?? options?.currentMileage;
      if (rawPickupMileage !== undefined && rawPickupMileage !== null) {
        const parsedPickup = Number(rawPickupMileage);
        if (!Number.isFinite(parsedPickup) || parsedPickup < 0) {
          throw new Error('قراءة عداد التسليم غير صالحة.');
        }
        if (parsedPickup < currentVehicleMileage) {
          throw new Error(
            `قراءة عداد التسليم (${parsedPickup} كم) لا يمكن أن تكون أقل من العداد الحالي للسيارة (${currentVehicleMileage} كم).`
          );
        }
        resolvedPickupMileage = Math.round(parsedPickup);
      } else {
        resolvedPickupMileage = currentVehicleMileage;
      }
      updatePayload.mileageAtPickup = resolvedPickupMileage;

      // Oil overdue check
      const lastOil = Number(internalData.lastOilChangeMileage ?? vehicleData.lastOilChangeMileage ?? 0);
      const interval = Number(internalData.oilChangeIntervalKm ?? vehicleData.oilChangeIntervalKm ?? 5000);
      const currentOdo = Math.max(currentVehicleMileage, resolvedPickupMileage);
      if (lastOil > 0 && interval > 0 && currentOdo - lastOil >= interval) {
        if (!options?.confirmOilOverdue) {
          throw new Error(
            'السيارة تجاوزت موعد تغيير الزيت الدوري. يرجى تأكيد إجراء تغيير الزيت أو المتابعة قبل تسليم السيارة.'
          );
        }
      }
    }

    if (newStatus === 'completed') {
      const minAllowedMileage = Math.max(
        currentVehicleMileage,
        Number(bookingData.mileageAtPickup ?? 0)
      );
      const rawReturnMileage = options?.mileageAtReturn ?? options?.currentMileage;
      if (rawReturnMileage !== undefined && rawReturnMileage !== null) {
        const parsedReturn = Number(rawReturnMileage);
        if (!Number.isFinite(parsedReturn) || parsedReturn < 0) {
          throw new Error('يرجى إدخال قراءة عداد صحيحة عند استلام السيارة.');
        }
        if (parsedReturn < minAllowedMileage) {
          throw new Error(
            `قراءة عداد الاستلام (${parsedReturn} كم) يجب ألا تقل عن العداد السابق (${minAllowedMileage} كم).`
          );
        }
        resolvedReturnMileage = Math.round(parsedReturn);
      } else {
        resolvedReturnMileage = minAllowedMileage;
      }
      updatePayload.mileageAtReturn = resolvedReturnMileage;
      updatePayload.finalTotal = calculatedFinalTotal;

      // Atomically update CRM customer stats
      if (!bookingData.crmCounted && bookingData.customerId) {
        const custRef = db.collection('customers').doc(String(bookingData.customerId));
        transaction.set(
          custRef,
          {
            totalRentals: FieldValue.increment(1),
            totalSpending: FieldValue.increment(calculatedFinalTotal),
            lastRentalDate: bookingData.returnDate || nowIso.slice(0, 10),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        updatePayload.crmCounted = true;
      }
    }

    transaction.update(bookingRef, updatePayload);

    // Sync contract document
    if (newStatus === 'confirmed' && !existingContractSnap?.exists) {
      const customerData = customerSnap?.exists ? customerSnap.data() || {} : {};
      const settingsData = settingsSnap?.exists ? settingsSnap.data() || {} : {};

      const contractSnapshot = buildContractSnapshot({
        bookingId,
        bookingData: { ...bookingData, status: 'confirmed' },
        vehicleData,
        internalVehicleData: internalData,
        customerData,
        settingsData,
        status: 'issued',
        issuedAt: nowIso,
      });

      const cleanContractDoc = JSON.parse(JSON.stringify(contractSnapshot));
      transaction.set(contractRef, cleanContractDoc);
    } else if (newStatus === 'rented') {
      if (existingContractSnap?.exists) {
        transaction.set(
          contractRef,
          {
            status: 'active',
            mileageAtPickup: resolvedPickupMileage,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } else {
        const customerData = customerSnap?.exists ? customerSnap.data() || {} : {};
        const settingsData = settingsSnap?.exists ? settingsSnap.data() || {} : {};
        const contractSnapshot = buildContractSnapshot({
          bookingId,
          bookingData: { ...bookingData, status: 'rented', mileageAtPickup: resolvedPickupMileage },
          vehicleData,
          internalVehicleData: internalData,
          customerData,
          settingsData,
          status: 'active',
          issuedAt: nowIso,
          mileageAtPickup: resolvedPickupMileage,
        });
        const cleanContractDoc = JSON.parse(JSON.stringify(contractSnapshot));
        transaction.set(contractRef, cleanContractDoc);
      }
    } else if (newStatus === 'completed') {
      if (existingContractSnap?.exists) {
        transaction.set(
          contractRef,
          {
            status: 'closed',
            mileageAtReturn: resolvedReturnMileage,
            extraCharges: extraChargesVal,
            finalTotal: calculatedFinalTotal,
            closedAt: nowIso,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } else {
        const customerData = customerSnap?.exists ? customerSnap.data() || {} : {};
        const settingsData = settingsSnap?.exists ? settingsSnap.data() || {} : {};
        const contractSnapshot = buildContractSnapshot({
          bookingId,
          bookingData: {
            ...bookingData,
            status: 'completed',
            mileageAtReturn: resolvedReturnMileage,
            extraCharges: extraChargesVal,
            finalTotal: calculatedFinalTotal,
          },
          vehicleData,
          internalVehicleData: internalData,
          customerData,
          settingsData,
          status: 'closed',
          issuedAt: nowIso,
          mileageAtPickup: bookingData.mileageAtPickup,
          mileageAtReturn: resolvedReturnMileage,
        });
        contractSnapshot.closedAt = nowIso;
        contractSnapshot.extraCharges = extraChargesVal;
        contractSnapshot.finalTotal = calculatedFinalTotal;
        const cleanContractDoc = JSON.parse(JSON.stringify(contractSnapshot));
        transaction.set(contractRef, cleanContractDoc);
      }
    } else if (
      (newStatus === 'cancelled' || newStatus === 'rejected') &&
      existingContractSnap?.exists
    ) {
      transaction.set(
        contractRef,
        {
          status: 'terminated',
          terminationReason: newStatus,
          terminatedAt: nowIso,
          terminatedByUid: options?.actorUid || 'system',
        },
        { merge: true }
      );
    }

    // Sync vehicle status & internal mileage (NEVER write mileage to public vehicleRef!)
    if (vehicleId) {
      const vehicleRef = db.collection('vehicles').doc(vehicleId);
      const internalRef = vehicleRef.collection('internal').doc('details');

      if (newStatus === 'rented') {
        if (vehicleSnap?.exists) {
          const vStatus = vehicleData.status;
          const vUpdate: Record<string, unknown> = { updatedAt: nowIso };
          if (vStatus !== 'maintenance' && vStatus !== 'inactive') {
            vUpdate.status = 'rented';
          }
          // Intentionally NO vUpdate.currentMileage to avoid leaking odometer to public clients
          transaction.set(vehicleRef, vUpdate, { merge: true });
        }
        if (resolvedPickupMileage !== undefined && resolvedPickupMileage >= currentVehicleMileage) {
          transaction.set(
            internalRef,
            {
              currentMileage: resolvedPickupMileage,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
      } else if (newStatus === 'completed') {
        const vUpdate: Record<string, unknown> = { updatedAt: nowIso };
        if (otherActiveBookingsCount === 0 && vehicleSnap?.exists) {
          const vStatus = vehicleData.status;
          if (vStatus !== 'maintenance' && vStatus !== 'inactive') {
            vUpdate.status = 'available';
          }
        }
        // Intentionally NO vUpdate.currentMileage to avoid leaking odometer to public clients
        if (resolvedReturnMileage !== undefined) {
          transaction.set(
            internalRef,
            {
              currentMileage: resolvedReturnMileage,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
        if (vehicleSnap?.exists) {
          transaction.set(vehicleRef, vUpdate, { merge: true });
        }
      } else if (newStatus === 'cancelled' || newStatus === 'rejected') {
        if (otherActiveBookingsCount === 0 && vehicleSnap?.exists) {
          transaction.set(
            vehicleRef,
            {
              status: 'available',
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }
      }
    }

    // Write auditLog entry using unified writeAudit helper
    if (isStaff) {
      const actionLabel =
        newStatus === 'rented'
          ? `تسليم السيارة للعميل (${bookingData.customerName || ''}) - عداد التسليم: ${resolvedPickupMileage ?? 0} كم`
          : newStatus === 'completed'
          ? `استلام السيارة وإتمام الحجز (${bookingData.customerName || ''}) - عداد الاستلام: ${resolvedReturnMileage ?? 0} كم - الإجمالي النهائي: ${calculatedFinalTotal}$`
          : `تحديث حالة الحجز من "${previousStatus}" إلى "${newStatus}"`;

      const auditMetadata: Record<string, unknown> = {
        previousStatus,
        newStatus,
      };
      if (resolvedPickupMileage !== undefined) {
        auditMetadata.mileageAtPickup = resolvedPickupMileage;
      }
      if (resolvedReturnMileage !== undefined) {
        auditMetadata.mileageAtReturn = resolvedReturnMileage;
      }
      if (extraChargesVal !== undefined && (newStatus === 'completed' || typeof options?.extraCharges === 'number' || typeof bookingData.extraCharges === 'number')) {
        auditMetadata.extraCharges = extraChargesVal;
      }
      if (calculatedFinalTotal !== undefined && (newStatus === 'completed' || typeof options?.extraCharges === 'number' || typeof bookingData.finalTotal === 'number')) {
        auditMetadata.finalTotal = calculatedFinalTotal;
      }
      if (options?.telegramUserId !== undefined) {
        auditMetadata.telegramUserId = options.telegramUserId;
      }

      writeAudit(db, transaction, {
        actorUid: options?.actorUid || 'staff',
        actorEmail: options?.actorEmail || actorEmail,
        actorRole: options?.actorRole || 'staff',
        actorType: options?.actorType || 'staff',
        action:
          newStatus === 'rented'
            ? 'HANDOVER_COMPLETED'
            : newStatus === 'completed'
            ? 'RETURN_COMPLETED'
            : 'STATUS_CHANGED',
        entity: 'booking',
        entityId: bookingId,
        entityName: String(bookingData.bookingNumber || bookingId),
        details: actionLabel,
        metadata: auditMetadata,
      });
    }

    return {
      success: true,
      message: 'تم تحديث حالة الحجز بنجاح.',
      previousStatus,
      newStatus: targetStatus,
      mileageAtPickup: resolvedPickupMileage,
      mileageAtReturn: resolvedReturnMileage,
    };
  });
}
