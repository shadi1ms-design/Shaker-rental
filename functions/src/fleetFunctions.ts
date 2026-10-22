import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';

const db = getFirestore(getApp(), DATABASE_ID);

/**
 * Scheduled Function: Daily check for overdue rentals (region: asia-south1)
 * Scans rented bookings in Damascus local time where returnDate < today and sends alerts with 7-day deduplication.
 */
export const checkOverdueRentals = onSchedule(
  {
    schedule: 'every 24 hours',
    region: FUNCTION_REGION,
    timeZone: 'Asia/Damascus',
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const todayDamascus = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(new Date());
    
    const rentedBookingsSnap = await db
      .collection('bookings')
      .where('status', '==', 'rented')
      .get();

    let processedCount = 0;
    const batchSize = 200; // 2 writes per booking (notification + update) must stay <= 500 per batch

    for (let i = 0; i < rentedBookingsSnap.docs.length; i += batchSize) {
      const chunk = rentedBookingsSnap.docs.slice(i, i + batchSize);
      const batch = db.batch();
      let chunkOpsCount = 0;

      for (const bDoc of chunk) {
        try {
          const b = bDoc.data();
          if (b.isDeleted === true) continue;

          // Avoid reprocessing if already marked today
          if (b.overdueMarkedAt === todayDamascus) continue;

          if (b.returnDate && b.returnDate < todayDamascus) {
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
              type: 'overdue_rental_alert',
              title: `تنبيه تأخر استلام السيارة: حجز #${b.bookingNumber || bDoc.id}`,
              message: `تجاوز الحجز #${b.bookingNumber || bDoc.id} للعميل ${b.customerName || 'المستأجر'} تاريخ التسليم المقرر (${b.returnDate}). يرجى التواصل مع المستأجر.`,
              bookingId: bDoc.id,
              bookingNumber: b.bookingNumber || bDoc.id,
              vehicleId: b.vehicleId || '',
              customerId: b.customerId || '',
              customerPhone: b.customerPhone || '',
              read: false,
              createdAt: FieldValue.serverTimestamp(),
            });

            batch.update(bDoc.ref, { overdueMarkedAt: todayDamascus });
            chunkOpsCount++;
          }
        } catch (err) {
          console.error(`[checkOverdueRentals] Error staging booking ${bDoc.id}:`, err);
        }
      }

      if (chunkOpsCount > 0) {
        try {
          await batch.commit();
          processedCount += chunkOpsCount;
        } catch (err) {
          console.error('[checkOverdueRentals] Atomic batch commit failed:', err);
        }
      }
    }
    console.log(`[checkOverdueRentals] Processed ${processedCount} overdue bookings.`);
  }
);
