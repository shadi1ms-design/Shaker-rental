/**
 * Scheduled Cloud Function: checkOverdueRentals
 * Runs every 30 minutes in Asia/Damascus timeZone.
 * Scans for active 'rented' bookings past return date/time + grace period,
 * and notifies admins if not notified in the last 7 days.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { parseDamascusDateTime } from './pricingServer';
import { writeAuditAsync } from './audit';

const db = getFirestore(getApp(), DATABASE_ID);

export interface OverdueCheckResult {
  checkedCount: number;
  overdueCount: number;
  notifiedCount: number;
  overdueBookingIds: string[];
}

/**
 * Pure evaluation helper callable by scheduled job and unit tests.
 */
export async function evaluateOverdueRentals(
  firestore: Firestore,
  nowMs: number = Date.now(),
  graceMinutesOverride?: number
): Promise<OverdueCheckResult> {
  const settingsSnap = await firestore.collection('settings').doc('global').get();
  const graceMinutes =
    graceMinutesOverride !== undefined
      ? graceMinutesOverride
      : Number(settingsSnap.data()?.returnGracePeriodMinutes ?? 60);
  const graceMs = graceMinutes * 60 * 1000;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const rentedSnap = await firestore
    .collection('bookings')
    .where('status', '==', 'rented')
    .get();

  const result: OverdueCheckResult = {
    checkedCount: rentedSnap.size,
    overdueCount: 0,
    notifiedCount: 0,
    overdueBookingIds: [],
  };

  for (const doc of rentedSnap.docs) {
    const b = doc.data();
    if (b.isDeleted === true) continue;

    const returnMs = parseDamascusDateTime(b.returnDate, b.returnTime || '10:00');
    if (Number.isNaN(returnMs)) continue;

    const overdueThreshold = returnMs + graceMs;
    if (nowMs > overdueThreshold) {
      result.overdueCount++;
      result.overdueBookingIds.push(doc.id);

      const lastNotifiedMs = b.overdueNotifiedAt ? Date.parse(b.overdueNotifiedAt) : 0;
      const shouldNotify = Number.isNaN(lastNotifiedMs) || nowMs - lastNotifiedMs > sevenDaysMs;

      if (shouldNotify) {
        const notifRef = firestore.collection('notifications').doc();
        const bNum = b.bookingNumber || doc.id;
        const vName = b.vehicleName || 'مركبة';
        const cName = b.customerName || 'عميل';

        await notifRef.set({
          id: notifRef.id,
          type: 'overdue_rental_alert',
          title: `تنبيه: تأخر إرجاع سيارة #${bNum}`,
          message: `السيارة ${vName} للعميل ${cName} متأخرة عن موعد الإرجاع (${b.returnDate} ${b.returnTime || '10:00'}).`,
          bookingId: doc.id,
          bookingNumber: bNum,
          vehicleId: b.vehicleId || '',
          customerId: b.customerId || '',
          recipientRole: 'admin',
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });

        await doc.ref.update({
          overdueNotifiedAt: new Date(nowMs).toISOString(),
          isOverdue: true,
          updatedAt: FieldValue.serverTimestamp(),
        });

        await writeAuditAsync(firestore, {
          actorUid: 'system',
          actorEmail: 'system@shaker.sy',
          actorType: 'system',
          action: 'BOOKING_OVERDUE_ALERT',
          entity: 'booking',
          entityId: doc.id,
          entityName: String(bNum),
          details: `إرسال تنبيه تأخر استلام السيارة ${vName} للحجز #${bNum} (موعد الإرجاع: ${b.returnDate})`,
          metadata: {
            bookingId: doc.id,
            returnDate: b.returnDate,
            returnTime: b.returnTime || '10:00',
            graceMinutes,
          },
        });

        result.notifiedCount++;
      }
    }
  }

  return result;
}

export const checkOverdueRentals = onSchedule(
  {
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Damascus',
    region: FUNCTION_REGION,
  },
  async () => {
    const outcome = await evaluateOverdueRentals(db, Date.now());
    console.info(
      `[checkOverdueRentals] Checked: ${outcome.checkedCount}, Overdue: ${outcome.overdueCount}, Notified: ${outcome.notifiedCount}`
    );
  }
);
