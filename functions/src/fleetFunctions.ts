import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { isCallerStaff } from './authz';

const db = getFirestore(admin.app(), DATABASE_ID);

/**
 * Cloud Function: syncFleetMaintenance (region: asia-south1)
 * Enforces App Check and staff authorization. Scans fleet for urgent maintenance requirements.
 */
export const syncFleetMaintenance = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لمزامنة صيانة الأسطول.');
    }

    if (!isCallerStaff(request.auth.token)) {
      throw new HttpsError('permission-denied', 'مزامنة الصيانة مقتصرة على الموظفين والإدارة.');
    }

    // Read settings for dynamic oil interval
    const settingsSnap = await db.collection('settings').doc('global').get();
    const oilInterval = Number(settingsSnap.data()?.oilChangeIntervalKm ?? 5000);
    const alertThreshold = Math.max(1000, oilInterval - 500);

    const vehiclesSnapshot = await db.collection('vehicles').get();
    let alertsCount = 0;
    let scannedCount = 0;

    for (const doc of vehiclesSnapshot.docs) {
      const v = doc.data();
      if (v.isDeleted === true) continue;
      scannedCount++;

      let currentMileage = Number(v.currentMileage || 0);
      let lastOilChangeMileage = Number(v.lastOilChangeMileage || 0);

      try {
        const internalSnap = await doc.ref.collection('internal').doc('details').get();
        if (internalSnap.exists) {
          const iData = internalSnap.data();
          if (iData?.currentMileage != null) currentMileage = Number(iData.currentMileage);
          if (iData?.lastOilChangeMileage != null) lastOilChangeMileage = Number(iData.lastOilChangeMileage);
        }
      } catch (err) {
        console.warn(`[syncFleetMaintenance] Error reading internal details for ${doc.id}:`, err);
      }

      const kmSinceOil = currentMileage - lastOilChangeMileage;
      if (kmSinceOil >= alertThreshold) {
        alertsCount++;
      }
    }

    return {
      success: true,
      totalVehiclesScanned: scannedCount,
      urgentMaintenanceCount: alertsCount,
      thresholdKm: alertThreshold,
      syncedAt: new Date().toISOString(),
      message: `تم فحص ${scannedCount} سيارة، ورصد ${alertsCount} سيارة تحتاج إلى صيانة أو تغيير زيت قريباً.`,
    };
  }
);

/**
 * Scheduled Function: Daily check for overdue rentals & upcoming oil changes (region: asia-south1)
 * Requirement 4: 7-day deduplication, batch query, dynamic threshold from settings, overdue rentals check,
 * and safe handling of missing isDeleted.
 */
export const checkMaintenanceAndRentals = onSchedule(
  {
    schedule: 'every 24 hours',
    region: FUNCTION_REGION,
    timeZone: 'Asia/Damascus',
  },
  async () => {
    // 1. Read dynamic oil change interval from settings
    const settingsSnap = await db.collection('settings').doc('global').get();
    const oilInterval = Number(settingsSnap.data()?.oilChangeIntervalKm ?? 5000);
    const alertThreshold = Math.max(1000, oilInterval - 500);

    // 2. Scan fleet for oil change alerts with 7-day deduplication
    const vehiclesSnapshot = await db.collection('vehicles').get();
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const vDoc of vehiclesSnapshot.docs) {
      const v = vDoc.data();
      if (v.isDeleted === true) continue;

      let currentMileage = Number(v.currentMileage || 0);
      let lastOilChangeMileage = Number(v.lastOilChangeMileage || 0);

      try {
        const internalSnap = await vDoc.ref.collection('internal').doc('details').get();
        if (internalSnap.exists) {
          const iData = internalSnap.data();
          if (iData?.currentMileage != null) currentMileage = Number(iData.currentMileage);
          if (iData?.lastOilChangeMileage != null) lastOilChangeMileage = Number(iData.lastOilChangeMileage);
        }
      } catch {}

      const kmSinceOil = currentMileage - lastOilChangeMileage;
      if (kmSinceOil >= alertThreshold) {
        // Deduplicate: check if an oil reminder notification was created for this vehicle in the last 7 days
        const recentNotifsSnap = await db.collection('notifications')
          .where('type', '==', 'oil_change_reminder')
          .where('vehicleId', '==', vDoc.id)
          .limit(3)
          .get();

        const alreadySentRecently = recentNotifsSnap.docs.some((nDoc) => {
          const nData = nDoc.data();
          const createdMs = nData.createdAt?.toMillis ? nData.createdAt.toMillis() : (nData.timestamp ? new Date(nData.timestamp).getTime() : 0);
          return createdMs > sevenDaysAgo;
        });

        if (!alreadySentRecently) {
          await db.collection('notifications').add({
            type: 'oil_change_reminder',
            title: `تنبيه صيانة الزيت: ${v.brand || ''} ${v.model || ''}`,
            message: `السيارة قطعت ${kmSinceOil} كم منذ آخر تغيير زيت (الفاصل المحدد: ${oilInterval} كم). يرجى مراجعة الصيانة الفنية.`,
            vehicleId: vDoc.id,
            vehicleName: `${v.brand || ''} ${v.model || ''} (${v.year || ''})`.trim(),
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // 3. Check for overdue rentals (rented bookings where returnDate < today)
    const todayDamascus = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(new Date());
    const rentedBookingsSnap = await db.collection('bookings')
      .where('status', '==', 'rented')
      .get();

    for (const bDoc of rentedBookingsSnap.docs) {
      const b = bDoc.data();
      if (b.isDeleted === true) continue;

      if (b.returnDate && b.returnDate < todayDamascus) {
        // Deduplicate overdue alert in last 7 days
        const recentOverdueSnap = await db.collection('notifications')
          .where('type', '==', 'overdue_rental_alert')
          .where('bookingId', '==', bDoc.id)
          .limit(3)
          .get();

        const alreadySentRecently = recentOverdueSnap.docs.some((nDoc) => {
          const nData = nDoc.data();
          const createdMs = nData.createdAt?.toMillis ? nData.createdAt.toMillis() : (nData.timestamp ? new Date(nData.timestamp).getTime() : 0);
          return createdMs > sevenDaysAgo;
        });

        if (!alreadySentRecently) {
          await db.collection('notifications').add({
            type: 'overdue_rental_alert',
            title: `تنبيه تأخر استلام السيارة: حجز #${b.bookingNumber || bDoc.id}`,
            message: `تجاوز الحجز #${b.bookingNumber || bDoc.id} للعميل ${b.customerName || 'المستأجر'} تاريخ التسليم المقرر (${b.returnDate}). يرجى التواصل مع المستأجر.`,
            bookingId: bDoc.id,
            bookingNumber: b.bookingNumber || bDoc.id,
            vehicleId: b.vehicleId || '',
            customerId: b.customerId || '',
            customerPhone: b.customerPhone || '',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }
  }
);
