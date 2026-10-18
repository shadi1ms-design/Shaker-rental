import * as admin from 'firebase-admin';

/**
 * Booking Lifecycle State Machine: Strict allowed transitions.
 * Terminal states (completed, cancelled, rejected) permit no further transitions.
 * Allows cancellation of 'new', 'reviewing', and 'confirmed' states according to rules.
 */
export const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  new: ['confirmed', 'rejected', 'cancelled'],
  reviewing: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['rented', 'cancelled'],
  rented: ['completed'],
  completed: [],
  cancelled: [],
  rejected: [],
};

/**
 * Resolves a vehicle document reference directly from Firestore collection 'vehicles'.
 */
export async function resolveVehicleDocument(
  db: admin.firestore.Firestore,
  rawVehicleId: string
): Promise<{ ref: admin.firestore.DocumentReference; data: any } | null> {
  const cleanId = String(rawVehicleId || '').trim();
  if (!cleanId) return null;

  try {
    const directRef = db.collection('vehicles').doc(cleanId);
    const directSnap = await directRef.get();
    if (directSnap.exists) {
      return { ref: directRef, data: directSnap.data() };
    }
  } catch (err) {
    console.warn('[resolveVehicleDocument] Error fetching vehicle doc:', err);
  }

  return null;
}

/**
 * Resolves a booking document reference directly from the canonical 'bookings' collection.
 */
export async function resolveBookingDocument(
  db: admin.firestore.Firestore,
  rawIdOrNumber: string,
  secondaryNumber?: string
): Promise<admin.firestore.DocumentReference | null> {
  const cleanId = String(rawIdOrNumber || '').trim();
  if (!cleanId) return null;

  try {
    // 1. Direct Document ID lookup
    const directRef = db.collection('bookings').doc(cleanId);
    const directSnap = await directRef.get();
    if (directSnap.exists) return directRef;

    // 2. Lookup by bookingNumber if needed
    const querySnap = await db.collection('bookings')
      .where('bookingNumber', '==', cleanId)
      .limit(1)
      .get();
    if (!querySnap.empty && querySnap.docs[0]) {
      return querySnap.docs[0].ref;
    }

    if (secondaryNumber && secondaryNumber !== cleanId) {
      const secSnap = await db.collection('bookings')
        .where('bookingNumber', '==', secondaryNumber)
        .limit(1)
        .get();
      if (!secSnap.empty && secSnap.docs[0]) {
        return secSnap.docs[0].ref;
      }
    }
  } catch (err) {
    console.warn('[resolveBookingDocument] Error reading booking doc:', err);
  }

  return null;
}

/**
 * Applies a booking status change with transaction integrity, double-booking check,
 * vehicle availability verification, and immutable audit logging.
 */
export async function applyBookingStatusChange(
  db: admin.firestore.Firestore,
  bookingId: string,
  newStatus: string,
  actorLabel: string,
  actorInfo?: {
    actorUid?: string | null;
    actorEmail?: string | null;
    actorType?: 'customer' | 'staff' | 'guest' | 'system';
    telegramUserId?: number | string | null;
    telegramName?: string | null;
  }
): Promise<{ success: boolean; message: string; bookingId?: string; oldStatus?: string; newStatus?: string }> {
  const validStatuses = ['new', 'reviewing', 'confirmed', 'rented', 'completed', 'cancelled', 'rejected'];
  if (!validStatuses.includes(newStatus)) {
    return { success: false, message: 'حالة الحجز المطلوبة غير صحيحة.' };
  }

  const targetBookingRef = await resolveBookingDocument(db, bookingId);
  if (!targetBookingRef) {
    return { success: false, message: 'الحجز المطلوب غير موجود.' };
  }

  const preBookingSnap = await targetBookingRef.get();
  if (!preBookingSnap.exists) {
    return { success: false, message: 'الحجز المطلوب غير موجود.' };
  }

  const preBookingData = preBookingSnap.data()!;
  const currentStatus = String(preBookingData.status || 'new').toLowerCase().trim();

  // Validate state machine transitions
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(newStatus)) {
    return {
      success: false,
      message: `تحويل حالة الحجز من "${currentStatus}" إلى "${newStatus}" غير مسموح به وفق مسار دورة حياة الحجوزات.`,
    };
  }

  let preResolvedVehicleRef: admin.firestore.DocumentReference | null = null;
  if (preBookingData.vehicleId) {
    const vRes = await resolveVehicleDocument(db, String(preBookingData.vehicleId).trim());
    if (vRes) {
      preResolvedVehicleRef = vRes.ref;
    }
  }

  try {
    return await db.runTransaction(async (transaction) => {
      // 1. ALL READS FIRST
      const bookingDoc = await transaction.get(targetBookingRef);
      if (!bookingDoc.exists) {
        return { success: false, message: 'الحجز المطلوب غير موجود.' };
      }

      const bData = bookingDoc.data()!;

      let vehicleDoc: admin.firestore.DocumentSnapshot | null = null;
      if (preResolvedVehicleRef) {
        vehicleDoc = await transaction.get(preResolvedVehicleRef);
      }

      const targetVehicleId = bData.vehicleId || (preResolvedVehicleRef ? preResolvedVehicleRef.id : null);

      // Conflict check when confirming or renting
      if ((newStatus === 'confirmed' || newStatus === 'rented') && targetVehicleId) {
        const activeBookingsQuery = db.collection('bookings')
          .where('vehicleId', '==', targetVehicleId)
          .where('status', 'in', ['confirmed', 'rented']);
        const activeSnap = await transaction.get(activeBookingsQuery);

        const currentPickup = bData.pickupDate;
        const currentReturn = bData.returnDate;
        const currentPickupTime = bData.pickupTime || '10:00';
        const currentReturnTime = bData.returnTime || '10:00';
        const curPickupMs = new Date(`${currentPickup}T${currentPickupTime}:00+03:00`).getTime();
        const curReturnMs = new Date(`${currentReturn}T${currentReturnTime}:00+03:00`).getTime();

        const conflictingDoc = activeSnap.docs.find((doc) => {
          if (doc.id === targetBookingRef.id) return false;
          const b = doc.data();
          if (b.isDeleted === true || b.status === 'cancelled' || b.status === 'rejected') {
            return false;
          }
          const bPickupTime = b.pickupTime || '10:00';
          const bReturnTime = b.returnTime || '10:00';
          const bPickupMs = new Date(`${b.pickupDate}T${bPickupTime}:00+03:00`).getTime();
          const bReturnMs = new Date(`${b.returnDate}T${bReturnTime}:00+03:00`).getTime();

          if (isNaN(curPickupMs) || isNaN(curReturnMs) || isNaN(bPickupMs) || isNaN(bReturnMs)) {
            return (currentPickup <= b.returnDate && currentReturn >= b.pickupDate);
          }

          return (curPickupMs < bReturnMs && curReturnMs > bPickupMs);
        });

        if (conflictingDoc) {
          return {
            success: false,
            message: 'تعذر تأكيد هذا الحجز لوجود حجز آخر مؤكد بالفعل على نفس السيارة في فترة متداخلة.',
          };
        }
      }

      // Check if other active bookings exist before releasing vehicle to 'available'
      let shouldFreeVehicle = false;
      if ((newStatus === 'completed' || newStatus === 'cancelled' || newStatus === 'rejected') && targetVehicleId) {
        const remainingActiveQuery = db.collection('bookings')
          .where('vehicleId', '==', targetVehicleId)
          .where('status', 'in', ['confirmed', 'rented']);
        const remainingSnap = await transaction.get(remainingActiveQuery);

        const otherActiveBookings = remainingSnap.docs.filter(
          (d) => d.id !== targetBookingRef.id && !d.data()?.isDeleted
        );

        // Only free vehicle if NO other active booking exists on it!
        shouldFreeVehicle = otherActiveBookings.length === 0;
      }

      // 2. ALL WRITES AFTER READS
      if (newStatus === 'rented' && preResolvedVehicleRef && vehicleDoc && vehicleDoc.exists) {
        transaction.update(preResolvedVehicleRef, {
          status: 'rented',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (shouldFreeVehicle && preResolvedVehicleRef && vehicleDoc && vehicleDoc.exists) {
        if (vehicleDoc.data()?.status === 'rented') {
          transaction.update(preResolvedVehicleRef, {
            status: 'available',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      // Update ONLY status and updatedAt - financial fields remain strictly immutable here
      transaction.update(targetBookingRef, {
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Audit log with unified actor schema
      const auditRef = db.collection('auditLogs').doc();
      const resolvedActorUid = actorInfo?.actorUid ?? null;
      const resolvedActorEmail = actorInfo?.actorEmail ?? (actorLabel.includes('@') ? actorLabel : null);
      const resolvedActorType = actorInfo?.actorType ?? 'staff';

      transaction.set(auditRef, {
        id: auditRef.id,
        user: actorLabel,
        userId: resolvedActorUid || (actorInfo?.telegramUserId ? `telegram:${actorInfo.telegramUserId}` : 'staff'),
        actorUid: resolvedActorUid,
        actorEmail: resolvedActorEmail,
        actorType: resolvedActorType,
        telegramUserId: actorInfo?.telegramUserId ?? null,
        ...(actorInfo?.telegramName ? { telegramName: actorInfo.telegramName } : {}),
        action: 'BOOKING_STATUS_UPDATED',
        entity: 'bookings',
        entityId: targetBookingRef.id,
        details: `تحديث حالة الحجز ${bData.bookingNumber || targetBookingRef.id} من ${bData.status} إلى ${newStatus} بواسطة ${actorLabel}`,
        timestamp: new Date().toISOString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        bookingId: targetBookingRef.id,
        oldStatus: bData.status,
        newStatus,
        message: `تم تحديث حالة الحجز إلى "${newStatus}" بنجاح.`,
      };
    });
  } catch (err: any) {
    console.error('[applyBookingStatusChange] Error during status change transaction:', err);
    return {
      success: false,
      message: err?.message || 'حدث خطأ داخلي أثناء تحديث حالة الحجز.',
    };
  }
}
