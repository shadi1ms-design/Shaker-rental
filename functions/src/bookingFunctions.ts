import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { isCallerStaff, isCallerAdmin, assertNotRevoked } from './authz';
import {
  calculateRentalDaysDamascus,
  calculateRentalPriceServer,
  parseDamascusDateTime,
} from './pricingServer';
import {
  resolveVehicleDocument,
  resolveBookingDocument,
  applyBookingStatusChange,
  ALLOWED_TRANSITIONS,
} from './bookingHelpers';

const db = getFirestore(getApp(), DATABASE_ID);

function getIpRateLimitKey(ip: string): string {
  const clean = (ip || 'unknown-ip').trim().replace(/[\.:]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean || 'unknown-ip';
}

function sanitizeString(input: unknown, maxLen = 100): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>'"&;`\\]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Cloud Function: createBookingSecure (region: asia-south1)
 * Enforces email verification for password users, IP rate limiting,
 * max 3 pending bookings cap, Damascus timezone calculations, and atomic transactions.
 */
export const createBookingSecure = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول قبل إنشاء الحجز.');
    }

    const callerUid = request.auth.uid;
    const isStaff = isCallerStaff(request.auth.token);
    const data = request.data || {};

    let customerId: string = callerUid;
    let customerEmail: string = (request.auth.token?.email || '').toLowerCase().trim();

    // 1. Password provider email verification requirement (Requirement 1 - fail-closed)
    if (!isStaff) {
      try {
        const userRecord = await getAuth().getUser(callerUid);
        const isPasswordAuth = userRecord.providerData.some((p) => p.providerId === 'password');
        if (isPasswordAuth && !userRecord.emailVerified) {
          throw new HttpsError(
            'failed-precondition',
            'يرجى تأكيد بريدك الإلكتروني أولاً قبل إنشاء الحجز. لقد تم إرسال رابط التأكيد إلى بريدك الإلكتروني المسجل.'
          );
        }
      } catch (authErr: any) {
        if (authErr instanceof HttpsError) throw authErr;
        console.error('[createBookingSecure] Error checking email verification:', authErr);
        throw new HttpsError('internal', 'تعذر التحقق من حالة تأكيد البريد الإلكتروني للحساب. يرجى إعادة المحاولة.');
      }
    }

    // Spoofing prevention
    if (data.customerId && data.customerId !== callerUid) {
      if (!isStaff) {
        throw new HttpsError(
          'permission-denied',
          'محاولة تزوير هوية المستخدم مرفوضة (User ID Spoofing Rejected).'
        );
      }
      customerId = String(data.customerId).trim();
      if (data.customerEmail) customerEmail = String(data.customerEmail).toLowerCase().trim();
    }

    // 2. Active Bookings Cap: Max 3 active ('new' or 'reviewing') bookings per customer (Requirement 1)
    if (!isStaff) {
      const activePendingSnap = await db.collection('bookings')
        .where('customerId', '==', customerId)
        .where('status', 'in', ['new', 'reviewing'])
        .get();

      const activeCount = activePendingSnap.docs.filter((d) => !d.data()?.isDeleted).length;
      if (activeCount >= 3) {
        throw new HttpsError(
          'resource-exhausted',
          'لديك بالفعل 3 طلبات حجز قيد المراجعة أو جديدة. لا يمكن إنشاء أكثر من 3 طلبات معلقة في نفس الوقت.'
        );
      }
    }

    // 3. Vehicle ID Validation
    const vehicleId = String(data.vehicleId || '').trim();
    if (!vehicleId) {
      throw new HttpsError('invalid-argument', 'يرجى تحديد السيارة المطلوبة للحجز.');
    }

    // 4. Damascus Timezone Date & Time Validation (Requirement 1: Asia/Damascus)
    const rawPickup = String(data.pickupDate || data.startDate || '').trim();
    const rawReturn = String(data.returnDate || data.endDate || '').trim();
    const pickupTime = String(data.pickupTime || '10:00').trim();
    const returnTime = String(data.returnTime || '10:00').trim();

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(rawPickup) || !dateRegex.test(rawReturn)) {
      throw new HttpsError('invalid-argument', 'صيغة التاريخ غير صالحة. يرجى استخدام تنسيق (YYYY-MM-DD).');
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(pickupTime) || !timeRegex.test(returnTime)) {
      throw new HttpsError('invalid-argument', 'صيغة الوقت غير صالحة. يرجى استخدام تنسيق (HH:MM).');
    }

    const pickupDateTime = parseDamascusDateTime(rawPickup, pickupTime);
    const returnDateTime = parseDamascusDateTime(rawReturn, returnTime);

    if (isNaN(pickupDateTime) || isNaN(returnDateTime)) {
      throw new HttpsError('invalid-argument', 'تاريخ أو توقيت الحجز غير صالح.');
    }

    if (returnDateTime <= pickupDateTime) {
      throw new HttpsError(
        'invalid-argument',
        'تاريخ وتوقيت إعادة السيارة يجب أن يكون لاحقاً لتاريخ وتوقيت الاستلام.'
      );
    }

    const nowMs = Date.now();
    const pastToleranceMs = 24 * 60 * 60 * 1000;
    if (pickupDateTime < nowMs - pastToleranceMs && !isStaff) {
      throw new HttpsError('invalid-argument', 'لا يمكن إنشاء حجز لتاريخ سابق أو منتهي.');
    }

    const maxAdvanceBookingMs = 365 * 24 * 60 * 60 * 1000;
    if (pickupDateTime > nowMs + maxAdvanceBookingMs) {
      throw new HttpsError('invalid-argument', 'لا يمكن الحجز لفترة تتجاوز سنة واحدة مقدماً.');
    }

    const calculatedDays = calculateRentalDaysDamascus(rawPickup, rawReturn, pickupTime, returnTime);
    if (calculatedDays <= 0) {
      throw new HttpsError('invalid-argument', 'مدة الحجز غير صالحة.');
    }
    if (calculatedDays > 90 && !isStaff) {
      throw new HttpsError(
        'invalid-argument',
        'أقصى مدة للحجز الإلكتروني التلقائي هي 90 يوماً. للحجوزات طويلة الأجل يرجى التواصل مباشرة مع الإدارة.'
      );
    }

    const customerName = String(data.customerName || request.auth.token?.name || 'مستأجر').trim().slice(0, 100);
    const customerPhone = String(data.customerPhone || '').trim().slice(0, 30);
    const customerWhatsApp = String(data.customerWhatsApp || customerPhone).trim().slice(0, 30);
    const customerNationalId = String(data.customerNationalId || '').trim().slice(0, 50);
    const customerLicenseNumber = String(data.customerLicenseNumber || '').trim().slice(0, 50);
    const customerAddress = String(data.customerAddress || '').trim().slice(0, 200);
    const notes = String(data.notes || '').trim().slice(0, 500);
    const withDriver = Boolean(data.withDriver);
    const deliveryLocation = String(data.deliveryLocation || '').trim().slice(0, 150);

    const resolvedVehicle = await resolveVehicleDocument(db, vehicleId);
    if (!resolvedVehicle) {
      throw new HttpsError('not-found', 'السيارة المطلوبة غير موجودة في أسطول الشركة.');
    }
    const resolvedDailyPrice = Number(resolvedVehicle.data.dailyPrice);
    if (isNaN(resolvedDailyPrice) || resolvedDailyPrice <= 0) {
      throw new HttpsError('failed-precondition', 'سعر تأجير السيارة اليومي غير محدد أو غير صالح (يجب أن يكون أكبر من صفر).');
    }
    const vehicleRef = resolvedVehicle.ref;
    const canonicalVehicleId = resolvedVehicle.data.id || vehicleRef.id;

    // 5. IP Rate Limiting - Only incremented after all input validations have successfully passed!
    if (!isStaff) {
      const callerIp = String(request.rawRequest?.ip || 'unknown-ip');
      const ipKey = getIpRateLimitKey(callerIp);
      const rateLimitTargetId = ipKey;
      const rateLimitDocRef = db.collection('rateLimits').doc(`booking_ip_${rateLimitTargetId}`);
      const BOOKING_RATE_WINDOW_MS = 10 * 60 * 1000;

      await db.runTransaction(async (transaction) => {
        const rlSnap = await transaction.get(rateLimitDocRef);
        let count = 1;
        let firstAttemptAt = nowMs;

        if (rlSnap.exists) {
          const rlData = rlSnap.data();
          const prevFirst = Number(rlData?.firstAttemptAt || nowMs);
          if (nowMs - prevFirst < BOOKING_RATE_WINDOW_MS) {
            count = Number(rlData?.count || rlData?.attempts || 0) + 1;
            firstAttemptAt = prevFirst;
          } else {
            count = 1;
            firstAttemptAt = nowMs;
          }
        }

        if (count > 5) {
          throw new HttpsError(
            'resource-exhausted',
            'تم تجاوز الحد المسموح به لإنشاء الحجوزات مؤقتاً (الحد الأقصى 5 حجوزات خلال 10 دقائق من نفس العنوان). يرجى الانتظار قليلاً.'
          );
        }

        transaction.set(
          rateLimitDocRef,
          {
            target: rateLimitTargetId,
            ip: callerIp,
            count,
            firstAttemptAt,
            lastAttemptAt: nowMs,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    }

    // 6. Atomic Transaction
    try {
      return await db.runTransaction(async (transaction) => {
        // Reads
        const vehicleDoc = await transaction.get(vehicleRef);
        const lockRef = vehicleRef.collection('_internal').doc('bookingLock');
        await transaction.get(lockRef);

        const activeBookingsQuery = db.collection('bookings')
          .where('vehicleId', '==', canonicalVehicleId)
          .where('status', 'in', ['confirmed', 'rented']);
        const activeBookingsSnap = await transaction.get(activeBookingsQuery);

        const settingsRef = db.collection('settings').doc('global');
        const settingsDoc = await transaction.get(settingsRef);

        const counterRef = db.collection('settings').doc('bookingCounter');
        const counterDoc = await transaction.get(counterRef);

        if (!vehicleDoc.exists) {
          throw new HttpsError('not-found', 'السيارة المطلوبة غير موجودة في أسطول الشركة.');
        }
        const vehicleData = vehicleDoc.data()!;

        if (vehicleData.isDeleted === true) {
          throw new HttpsError('not-found', 'هذه السيارة غير متاحة في الأسطول.');
        }

        if (vehicleData.status === 'maintenance' || vehicleData.status === 'inactive') {
          throw new HttpsError(
            'failed-precondition',
            'عذراً، السيارة غير متاحة حالياً بسبب أعمال الصيانة الدورية أو الإيقاف الفني.'
          );
        }

        // Conflict check using Damascus time
        const conflictingDoc = activeBookingsSnap.docs.find((docSnap) => {
          const b = docSnap.data();
          if (b.isDeleted === true || b.status === 'cancelled' || b.status === 'rejected') {
            return false;
          }
          const bPickupTime = b.pickupTime || '10:00';
          const bReturnTime = b.returnTime || '10:00';
          const bPickupMs = parseDamascusDateTime(b.pickupDate, bPickupTime);
          const bReturnMs = parseDamascusDateTime(b.returnDate, bReturnTime);

          if (isNaN(bPickupMs) || isNaN(bReturnMs)) {
            return (rawPickup <= b.returnDate && rawReturn >= b.pickupDate);
          }

          return (pickupDateTime < bReturnMs && returnDateTime > bPickupMs);
        });

        if (conflictingDoc) {
          const conflict = conflictingDoc.data();
          throw new HttpsError(
            'already-exists',
            `عذراً، هذه السيارة محجوزة مسبقاً في الفترة المطلوبة (من ${conflict.pickupDate} إلى ${conflict.returnDate}). يرجى اختيار سيارة أخرى أو تغيير التواريخ.`
          );
        }

        const settingsData = settingsDoc.exists ? settingsDoc.data() : null;
        const officialDailyPrice = Number(vehicleData.dailyPrice);
        if (isNaN(officialDailyPrice) || officialDailyPrice <= 0) {
          throw new HttpsError('failed-precondition', 'سعر تأجير السيارة اليومي غير محدد أو غير صالح (يجب أن يكون أكبر من صفر).');
        }
        const isUserLoggedIn = Boolean(request.auth && request.auth.uid);

        const calculatedPricing = calculateRentalPriceServer(
          officialDailyPrice,
          calculatedDays,
          settingsData,
          isUserLoggedIn,
          canonicalVehicleId,
          withDriver
        );

        let nextCount = 1;
        if (counterDoc.exists) {
          nextCount = (counterDoc.data()?.lastNumber || 0) + 1;
        }
        const currentYear = new Date().getFullYear();
        const formattedNumber = `SHK-${currentYear}-${String(nextCount).padStart(6, '0')}`;
        const newBookingRef = db.collection('bookings').doc();

        // Writes
        transaction.set(
          lockRef,
          {
            lockedAt: FieldValue.serverTimestamp(),
            lastBookingBy: customerId,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        transaction.set(
          counterRef,
          {
            lastNumber: nextCount,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const bookingPayload = {
          id: newBookingRef.id,
          bookingNumber: formattedNumber,
          vehicleId: canonicalVehicleId,
          vehicleName: `${vehicleData.brand} ${vehicleData.model} (${vehicleData.year})`,
          vehicleCategory: vehicleData.category || 'medium',
          customerId,
          customerEmail,
          customerName,
          customerPhone,
          customerWhatsApp: customerWhatsApp || customerPhone,
          customerNationalId,
          customerAddress,
          customerLicenseNumber,
          pickupDate: rawPickup,
          pickupTime,
          returnDate: rawReturn,
          returnTime,
          rentalDays: calculatedDays,
          dailyPrice: officialDailyPrice,
          basePrice: calculatedPricing.basePrice,
          discountAmount: calculatedPricing.discountAmount,
          insuranceAmount: calculatedPricing.insuranceAmount,
          driverFee: calculatedPricing.driverFee,
          withDriver,
          deliveryLocation,
          totalPrice: calculatedPricing.totalPrice,
          status: 'new',
          notes,
          isDeleted: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        transaction.set(newBookingRef, bookingPayload);

        const notificationRef = db.collection('notifications').doc();
        transaction.set(notificationRef, {
          id: notificationRef.id,
          type: 'new_booking',
          title: 'طلب حجز جديد عبر الموقع',
          message: `تم إنشاء حجز برقم ${formattedNumber} للعميل ${customerName} على ${vehicleData.brand} ${vehicleData.model} بمبلغ ${calculatedPricing.totalPrice}$`,
          bookingId: newBookingRef.id,
          vehicleId: canonicalVehicleId,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });

        const auditRef = db.collection('auditLogs').doc();
        const actorType: 'customer' | 'staff' | 'guest' = isStaff ? 'staff' : 'customer';
        transaction.set(auditRef, {
          id: auditRef.id,
          user: customerEmail || callerUid,
          userId: callerUid,
          actorUid: callerUid,
          actorEmail: customerEmail || null,
          actorType,
          customerProvidedName: customerName || null,
          action: 'BOOKING_CREATED_SECURE',
          entity: 'bookings',
          entityId: newBookingRef.id,
          details: `حجز مؤمن ${formattedNumber} لـ ${vehicleData.brand} ${vehicleData.model} (${rawPickup} إلى ${rawReturn}) بمبلغ ${calculatedPricing.totalPrice}$`,
          timestamp: new Date().toISOString(),
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          bookingId: newBookingRef.id,
          bookingNumber: formattedNumber,
          booking: {
            ...bookingPayload,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          message: 'تم استلام وتأكيد طلب الحجز بنجاح.',
        };
      });
    } catch (txErr: any) {
      if (txErr instanceof HttpsError) throw txErr;
      console.error('[createBookingSecure] Transaction error:', txErr);
      throw new HttpsError('internal', 'حدث خطأ أثناء معالجة الحجز.');
    }
  }
);

/**
 * Cloud Function: updateBookingStatusSecure (region: asia-south1)
 * Enforces allowed status transitions and cancellation permissions.
 */
export const updateBookingStatusSecure = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لتحديث حالة الحجز.');
    }

    const callerUid = request.auth.uid;
    const isStaff = isCallerStaff(request.auth.token);
    if (isStaff) {
      await assertNotRevoked(request);
    }
    const data = request.data || {};
    const bookingId = String(data.bookingId || '').trim();
    const newStatus = String(data.status || '').trim();

    if (!bookingId || !newStatus) {
      throw new HttpsError('invalid-argument', 'معرف الحجز والحالة الجديدة مطلوبان.');
    }

    const targetBookingRef = await resolveBookingDocument(db, bookingId, data.bookingNumber);
    if (!targetBookingRef) {
      throw new HttpsError('not-found', 'الحجز المطلوب غير موجود.');
    }

    const preSnap = await targetBookingRef.get();
    if (!preSnap.exists) {
      throw new HttpsError('not-found', 'الحجز المطلوب غير موجود.');
    }

    const bData = preSnap.data()!;
    const currentStatus = String(bData.status || 'new').toLowerCase().trim();

    const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      throw new HttpsError(
        'failed-precondition',
        `تحويل حالة الحجز من "${currentStatus}" إلى "${newStatus}" غير مسموح به وفق دورة حياة الحجوزات.`
      );
    }

    const isOwner = bData.customerId === callerUid || bData.userId === callerUid;

    if (!isStaff) {
      if (!isOwner) {
        throw new HttpsError('permission-denied', 'غير مصرح لك بتعديل حجز لا يخص حسابك.');
      }

      if (newStatus !== 'cancelled') {
        throw new HttpsError('permission-denied', 'لا يملك العميل صلاحية تغيير الحالة إلى غير "ملغي".');
      }

      // Check cancellation rules:
      // If confirmed, allow cancellation only before pickup date with threshold (e.g. 24h before pickup)
      if (currentStatus === 'confirmed') {
        const pickupMs = parseDamascusDateTime(bData.pickupDate, bData.pickupTime || '10:00');
        const nowMs = Date.now();
        const settingsSnap = await db.collection('settings').doc('global').get();
        const minCancellationHours = Number(settingsSnap.data()?.cancellationLeadHours ?? 24);
        const leadMs = minCancellationHours * 60 * 60 * 1000;

        if (pickupMs - nowMs < leadMs) {
          throw new HttpsError(
            'failed-precondition',
            `لا يمكن إلغاء الحجز المؤكد إلا قبل موعد الاستلام بـ ${minCancellationHours} ساعة على الأقل. يرجى التواصل مع الإدارة مباشرة.`
          );
        }
      }
    }

    const actorLabel = request.auth.token?.email || callerUid;
    const result = await applyBookingStatusChange(db, targetBookingRef.id, newStatus, actorLabel, {
      actorUid: callerUid,
      actorEmail: request.auth.token?.email || null,
      actorType: isStaff ? 'staff' : 'customer',
    });

    if (!result.success) {
      if (result.message.includes('حجز آخر مؤكد')) {
        throw new HttpsError('already-exists', result.message);
      }
      throw new HttpsError('failed-precondition', result.message);
    }

    return result;
  }
);

/**
 * Cloud Function: sendBookingNotification (region: asia-south1)
 * Enforces server-authoritative read of customerName, vehicleName, totalAmount, status.
 */
export const sendBookingNotification = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً لإرسال إشعار الحجز.');
    }

    const callerUid = request.auth.uid;
    const callerEmail = (request.auth.token?.email || '').toLowerCase().trim();
    const rawBookingId = request.data?.bookingId;

    if (!rawBookingId || typeof rawBookingId !== 'string') {
      throw new HttpsError('invalid-argument', 'معرف الحجز (bookingId) مطلوب.');
    }

    const cleanBookingId = sanitizeString(rawBookingId, 64);
    const bookingRef = await resolveBookingDocument(db, cleanBookingId, request.data?.bookingNumber);

    if (!bookingRef) {
      throw new HttpsError('not-found', 'الحجز المطلوب غير موجود في سجلات الشركة.');
    }

    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
      throw new HttpsError('not-found', 'الحجز المطلوب غير موجود في سجلات الشركة.');
    }

    const bData = bookingDoc.data()!;
    if (bData.isDeleted === true) {
      throw new HttpsError('not-found', 'هذا الحجز ملغي أو محذوف من النظام.');
    }

    const isStaff = isCallerStaff(request.auth.token);
    const isOwner = bData.customerId === callerUid;

    if (!isStaff && !isOwner) {
      throw new HttpsError('permission-denied', 'غير مصرح لك بإرسال إشعار لحجز لا يخص حسابك الشخصي.');
    }

    // Rate limiting: 15s debounce + 5 per 10min
    const isAdminUser = isCallerAdmin(request.auth.token);
    if (!isAdminUser) {
      const nowMs = Date.now();
      const rateLimitRef = db.collection('rateLimits').doc(`notif_bk_${bookingRef.id}`);

      await db.runTransaction(async (t) => {
        const rlDoc = await t.get(rateLimitRef);
        if (rlDoc.exists) {
          const rlData = rlDoc.data()!;
          const lastSentMs = Number(rlData.lastSentMs) || 0;
          const windowStartMs = Number(rlData.windowStartMs) || 0;
          const count = Number(rlData.count) || 0;

          if (nowMs - lastSentMs < 15000) {
            throw new HttpsError(
              'resource-exhausted',
              'تم إرسال إشعار لهذا الحجز مؤخراً. يرجى الانتظار 15 ثانية على الأقل قبل إعادة الإرسال.'
            );
          }

          const tenMinutesMs = 10 * 60 * 1000;
          if (nowMs - windowStartMs < tenMinutesMs) {
            if (count >= 5) {
              throw new HttpsError(
                'resource-exhausted',
                'تم بلوغ الحد الأقصى لإرسال الإشعارات لهذا الحجز (5 إشعارات خلال 10 دقائق).'
              );
            }
            t.update(rateLimitRef, {
              lastSentMs: nowMs,
              count: count + 1,
              lastCallerUid: callerUid,
              updatedAt: FieldValue.serverTimestamp(),
            });
          } else {
            t.set(rateLimitRef, {
              windowStartMs: nowMs,
              lastSentMs: nowMs,
              count: 1,
              lastCallerUid: callerUid,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        } else {
          t.set(rateLimitRef, {
            windowStartMs: nowMs,
            lastSentMs: nowMs,
            count: 1,
            lastCallerUid: callerUid,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
    }

    const authoritativeStatus = String(bData.status || 'new');
    const authoritativeTotalAmount = Number(bData.totalPrice ?? bData.totalAmount ?? 0);
    const authoritativeCustomerName = sanitizeString(bData.customerName || 'العميل', 80);
    const authoritativeVehicleName = sanitizeString(bData.vehicleName || 'مركبة', 80);
    const authoritativeBookingNumber = sanitizeString(bData.bookingNumber || bookingRef.id, 40);

    const notificationRef = db.collection('notifications').doc();
    await notificationRef.set({
      id: notificationRef.id,
      type: 'booking_status_change',
      title: `إشعار الحجز #${authoritativeBookingNumber}: ${authoritativeVehicleName}`,
      message: `تم تحديث الحجز #${authoritativeBookingNumber} (${authoritativeVehicleName}) للعميل ${authoritativeCustomerName}. الحالة: ${authoritativeStatus}، القيمة الإجمالية: ${authoritativeTotalAmount}$.`,
      bookingId: bookingRef.id,
      bookingNumber: authoritativeBookingNumber,
      vehicleId: bData.vehicleId || '',
      customerId: bData.customerId || '',
      customerName: authoritativeCustomerName,
      vehicleName: authoritativeVehicleName,
      status: authoritativeStatus,
      totalAmount: authoritativeTotalAmount,
      recipientRole: isStaff ? 'all' : 'admin',
      triggeredBy: callerUid,
      triggeredByRole: isStaff ? 'staff' : 'customer',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const auditRef = db.collection('auditLogs').doc();
    await auditRef.set({
      id: auditRef.id,
      userId: callerUid,
      user: callerEmail || callerUid,
      actorUid: callerUid,
      actorEmail: callerEmail || null,
      actorType: isStaff ? 'staff' : 'customer',
      action: 'BOOKING_NOTIFICATION_SENT_SECURE',
      entity: 'bookings',
      entityId: bookingRef.id,
      details: `إرسال إشعار موثق من السيرفر للحجز ${authoritativeBookingNumber}`,
      timestamp: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      notificationId: notificationRef.id,
      bookingId: bookingRef.id,
      bookingNumber: authoritativeBookingNumber,
      customerName: authoritativeCustomerName,
      vehicleName: authoritativeVehicleName,
      status: authoritativeStatus,
      totalAmount: authoritativeTotalAmount,
      message: 'تم إرسال إشعار الحجز بنجاح.',
    };
  }
);

/**
 * Cloud Function: getVehicleAvailability (region: asia-south1)
 * Public availability inquiry without exposing PII (Requirement 3)
 */
export const getVehicleAvailability = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    const { vehicleId, from, to, fromTime = '10:00', toTime = '10:00' } = request.data || {};
    const cleanVehicleId = String(vehicleId || '').trim();

    if (!cleanVehicleId) {
      throw new HttpsError('invalid-argument', 'معرف السيارة (vehicleId) مطلوب.');
    }

    const vRes = await resolveVehicleDocument(db, cleanVehicleId);
    if (!vRes || vRes.data?.isDeleted === true) {
      return {
        available: false,
        reason: 'السيارة غير موجودة أو محذوفة من الأسطول.',
      };
    }

    if (vRes.data?.status === 'maintenance' || vRes.data?.status === 'inactive') {
      return {
        available: false,
        reason: 'السيارة قيد الصيانة أو غير متاحة مؤقتاً.',
      };
    }

    const canonicalVehicleId = vRes.data.id || vRes.ref.id;

    // Active bookings query
    const activeQuery = db.collection('bookings')
      .where('vehicleId', '==', canonicalVehicleId)
      .where('status', 'in', ['confirmed', 'rented']);
    const activeSnap = await activeQuery.get();

    const bookedRanges: Array<{ from: string; to: string }> = [];
    let isAvailable = true;

    const queryPickupMs = from ? parseDamascusDateTime(from, fromTime) : NaN;
    const queryReturnMs = to ? parseDamascusDateTime(to, toTime) : NaN;

    for (const doc of activeSnap.docs) {
      const b = doc.data();
      if (b.isDeleted === true || b.status === 'cancelled' || b.status === 'rejected') continue;

      bookedRanges.push({
        from: b.pickupDate,
        to: b.returnDate,
      });

      if (!isNaN(queryPickupMs) && !isNaN(queryReturnMs)) {
        const bPickupMs = parseDamascusDateTime(b.pickupDate, b.pickupTime || '10:00');
        const bReturnMs = parseDamascusDateTime(b.returnDate, b.returnTime || '10:00');

        if (queryPickupMs < bReturnMs && queryReturnMs > bPickupMs) {
          isAvailable = false;
        }
      }
    }

    return {
      available: isAvailable,
      vehicleId: canonicalVehicleId,
      vehicleStatus: vRes.data.status || 'available',
      bookedRanges, // Safe booked intervals without customer names, IDs, phones, or prices
      message: isAvailable ? 'السيارة متاحة للحجز في التواريخ المحددة.' : 'السيارة محجوزة في هذه الفترة.',
    };
  }
);

/**
 * Cloud Function: deleteBookingSecure (region: asia-south1)
 * Hard delete of a booking. Restricted to Admin / Super Admin.
 * Firestore rules forbid client-side deletes (allow delete: if false),
 * so deletion is performed here with the Admin SDK and fully audited.
 */
export const deleteBookingSecure = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    await assertNotRevoked(request);

    if (!isCallerAdmin(request.auth!.token)) {
      throw new HttpsError('permission-denied', 'حذف الحجوزات نهائياً مقتصر على مدراء النظام (Admin/Super Admin).');
    }

    const bookingId = String(request.data?.bookingId || '').trim();
    if (!bookingId) {
      throw new HttpsError('invalid-argument', 'معرف الحجز مطلوب.');
    }

    const bookingRef = await resolveBookingDocument(db, bookingId, request.data?.bookingNumber);
    if (!bookingRef) {
      throw new HttpsError('not-found', 'الحجز المطلوب غير موجود.');
    }

    const callerUid = request.auth!.uid;
    const callerEmail = request.auth!.token?.email || null;

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(bookingRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', 'الحجز المطلوب غير موجود.');
      }
      const b = snap.data()!;

      // If the booking was holding the vehicle (rented), release it when nothing else is active.
      let vehicleRef: DocumentReference | null = null;
      let vehicleSnap: DocumentSnapshot | null = null;
      let othersActive = true;
      if (b.status === 'rented' && b.vehicleId) {
        vehicleRef = db.collection('vehicles').doc(String(b.vehicleId));
        vehicleSnap = await transaction.get(vehicleRef);
        const activeSnap = await transaction.get(
          db.collection('bookings')
            .where('vehicleId', '==', b.vehicleId)
            .where('status', '==', 'rented')
        );
        othersActive = activeSnap.docs.some((d) => d.id !== bookingRef.id);
      }

      if (vehicleRef && vehicleSnap?.exists && !othersActive && vehicleSnap.data()?.status === 'rented') {
        transaction.update(vehicleRef, { status: 'available', updatedAt: FieldValue.serverTimestamp() });
      }

      transaction.delete(bookingRef);

      const auditRef = db.collection('auditLogs').doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        user: callerEmail || callerUid,
        userId: callerUid,
        actorUid: callerUid,
        actorEmail: callerEmail,
        actorType: 'staff',
        action: 'BOOKING_DELETED',
        entity: 'bookings',
        entityId: bookingRef.id,
        details: `حذف الحجز ${b.bookingNumber || bookingRef.id} (الحالة: ${b.status}، العميل: ${b.customerName || '-'}، المبلغ: ${b.totalPrice ?? 0}$)`,
        timestamp: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, bookingId: bookingRef.id, message: 'تم حذف الحجز نهائياً.' };
  }
);
