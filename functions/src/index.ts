import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * Double Booking Prevention & Booking Number Generator
 * Executes within a Firestore Transaction to guarantee serializability.
 */
export const createBookingSecure = functions.https.onCall(async (data, context) => {
  const {
    vehicleId,
    customerName,
    customerPhone,
    customerWhatsApp,
    pickupDate,
    pickupTime,
    returnDate,
    returnTime,
    notes,
    totalPrice,
    rentalDays,
    dailyPrice,
    discountAmount,
    insuranceAmount
  } = data;

  if (!vehicleId || !pickupDate || !returnDate || !customerName || !customerPhone) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'يرجى التأكد من صحة واكتمال جميع البيانات المطلوبة للحجز.'
    );
  }

  return await db.runTransaction(async (transaction) => {
    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const vehicleDoc = await transaction.get(vehicleRef);

    if (!vehicleDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'السيارة المطلوبة غير موجودة في الأسطول.');
    }

    const vehicleData = vehicleDoc.data()!;
    if (vehicleData.status === 'maintenance' || vehicleData.status === 'inactive') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'عذراً، السيارة غير متاحة حالياً بسبب أعمال الصيانة أو الإيقاف المؤقت.'
      );
    }

    // Query overlapping active/confirmed bookings
    // Overlap condition: existing.pickupDate <= new.returnDate && existing.returnDate >= new.pickupDate
    const bookingsQuery = db.collection('bookings')
      .where('vehicleId', '==', vehicleId)
      .where('status', 'in', ['confirmed', 'rented', 'reviewing', 'new']);

    const querySnapshot = await transaction.get(bookingsQuery);
    
    const hasOverlap = querySnapshot.docs.some((doc) => {
      const b = doc.data();
      return b.pickupDate <= returnDate && b.returnDate >= pickupDate;
    });

    if (hasOverlap) {
      throw new functions.https.HttpsError(
        'already-exists',
        'عذراً، السيارة غير متاحة في الفترة المحددة. يرجى اختيار سيارة أو تاريخ آخر.'
      );
    }

    // Generate unique sequential formatted booking number: SHK-2026-XXXXXX
    const counterRef = db.collection('settings').doc('bookingCounter');
    const counterDoc = await transaction.get(counterRef);
    let nextCount = 1;
    if (counterDoc.exists) {
      nextCount = (counterDoc.data()?.lastNumber || 0) + 1;
    }
    transaction.set(counterRef, { lastNumber: nextCount, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

    const formattedNumber = `SHK-2026-${String(nextCount).padStart(6, '0')}`;
    const newBookingRef = db.collection('bookings').doc();

    const bookingPayload = {
      id: newBookingRef.id,
      bookingNumber: formattedNumber,
      vehicleId,
      vehicleName: `${vehicleData.brand} ${vehicleData.model} (${vehicleData.year})`,
      customerName,
      customerPhone,
      customerWhatsApp: customerWhatsApp || customerPhone,
      pickupDate,
      pickupTime: pickupTime || '10:00',
      returnDate,
      returnTime: returnTime || '10:00',
      rentalDays: Number(rentalDays) || 1,
      dailyPrice: Number(dailyPrice) || vehicleData.dailyPrice,
      totalPrice: Number(totalPrice),
      discountAmount: Number(discountAmount) || 0,
      insuranceAmount: Number(insuranceAmount) || 300,
      paidAmount: 0,
      remainingAmount: Number(totalPrice),
      status: 'new',
      notes: notes || '',
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    transaction.set(newBookingRef, bookingPayload);

    // Record audit log
    const auditRef = db.collection('auditLogs').doc();
    transaction.set(auditRef, {
      id: auditRef.id,
      action: 'BOOKING_CREATED',
      entity: 'bookings',
      entityId: newBookingRef.id,
      data: { bookingNumber: formattedNumber, vehicleId, customerName },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      bookingId: newBookingRef.id,
      bookingNumber: formattedNumber,
      message: 'تم استلام طلب الحجز بنجاح.'
    };
  });
});

/**
 * Scheduled Function: Daily check for overdue rentals & upcoming oil changes
 */
export const checkMaintenanceAndRentals = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    // 1. Check vehicles needing oil change (currentMileage - lastOilChangeMileage >= 5000)
    const vehiclesSnapshot = await db.collection('vehicles').where('isDeleted', '==', false).get();
    for (const doc of vehiclesSnapshot.docs) {
      const v = doc.data();
      const kmSinceOil = (v.currentMileage || 0) - (v.lastOilChangeMileage || 0);
      if (kmSinceOil >= 4500) {
        await db.collection('notifications').add({
          type: 'oil_change_reminder',
          title: `تنبيه صيانة الزيت: ${v.brand} ${v.model}`,
          message: `السيارة قطعت ${kmSinceOil} كم منذ آخر تغيير زيت (الحد الأقصى 5,000 كم).`,
          vehicleId: doc.id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false
        });
      }
    }

    return null;
  });
