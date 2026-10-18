import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { isCallerStaff } from './authz';
import { resolveBookingDocument } from './bookingHelpers';

const db = getFirestore(admin.app(), DATABASE_ID);

/**
 * Cloud Function: recordPaymentSecure (region: asia-south1)
 * Atomic financial transaction with FieldValue.increment, remaining amount overrun prevention,
 * sequential receipt numbering, and audit trail (Requirement 3).
 */
export const recordPaymentSecure = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لتسجيل الدفعات المالية.');
    }

    const callerToken = request.auth.token;
    if (!isCallerStaff(callerToken)) {
      throw new HttpsError('permission-denied', 'تسجيل الدفعات المالية مقتصر حصراً على موظفي وإدارة الشركة.');
    }

    const callerUid = request.auth.uid;
    const callerEmail = callerToken.email || null;
    const { bookingId, amount, method = 'cash', notes, referenceNumber } = request.data || {};

    const cleanBookingId = String(bookingId || '').trim();
    const paymentAmount = Number(amount);

    if (!cleanBookingId) {
      throw new HttpsError('invalid-argument', 'معرف الحجز (bookingId) مطلوب.');
    }

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new HttpsError('invalid-argument', 'قيمة الدفعة يجب أن تكون رقماً أكبر من صفر.');
    }

    const validMethods = ['cash', 'card', 'bank_transfer', 'cheque', 'online'];
    const cleanMethod = validMethods.includes(String(method).toLowerCase())
      ? String(method).toLowerCase()
      : 'cash';

    const bookingRef = await resolveBookingDocument(db, cleanBookingId, request.data?.bookingNumber);
    if (!bookingRef) {
      throw new HttpsError('not-found', 'الحجز المطلوب غير موجود.');
    }

    try {
      return await db.runTransaction(async (transaction) => {
        // 1. ALL READS FIRST
        const bookingSnap = await transaction.get(bookingRef);
        if (!bookingSnap.exists) {
          throw new HttpsError('not-found', 'الحجز المطلوب غير موجود.');
        }

        const bData = bookingSnap.data()!;
        if (bData.isDeleted === true) {
          throw new HttpsError('failed-precondition', 'لا يمكن تسجيل دفعة على حجز محذوف أو ملغي.');
        }

        const currentPaid = Number(bData.paidAmount || 0);
        const totalPrice = Number(bData.totalPrice ?? bData.totalAmount ?? 0);
        const currentRemaining = Number(
          bData.remainingAmount !== undefined ? bData.remainingAmount : (totalPrice - currentPaid)
        );

        // Prevent payment exceeding remaining balance
        if (paymentAmount > currentRemaining + 0.001) {
          throw new HttpsError(
            'failed-precondition',
            `المبلغ المراد سداده ($${paymentAmount}) يتجاوز الرصيد المتبقي على هذا الحجز ($${currentRemaining}).`
          );
        }

        const counterRef = db.collection('settings').doc('receiptCounter');
        const counterSnap = await transaction.get(counterRef);

        let nextReceiptCount = 1;
        if (counterSnap.exists) {
          nextReceiptCount = Number(counterSnap.data()?.lastNumber || 0) + 1;
        }

        const currentYear = new Date().getFullYear();
        const receiptNumber = `REC-${currentYear}-${String(nextReceiptCount).padStart(6, '0')}`;

        const nextRemaining = Math.max(0, Math.round((currentRemaining - paymentAmount) * 100) / 100);
        const nextPaid = Math.round((currentPaid + paymentAmount) * 100) / 100;
        const newPaymentStatus = nextRemaining <= 0 ? 'paid' : (nextPaid > 0 ? 'partial' : 'unpaid');

        // 2. ALL WRITES AFTER READS
        transaction.set(
          counterRef,
          {
            lastNumber: nextReceiptCount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const paymentRef = db.collection('payments').doc();
        const paymentPayload = {
          id: paymentRef.id,
          receiptNumber,
          bookingId: bookingRef.id,
          bookingNumber: bData.bookingNumber || bookingRef.id,
          customerId: bData.customerId || '',
          customerName: bData.customerName || 'المستأجر',
          vehicleId: bData.vehicleId || '',
          amount: paymentAmount,
          method: cleanMethod,
          referenceNumber: referenceNumber ? String(referenceNumber).slice(0, 100) : null,
          notes: notes ? String(notes).slice(0, 300) : '',
          recordedBy: callerUid,
          recordedByEmail: callerEmail,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        transaction.set(paymentRef, paymentPayload);

        // Atomic update on booking with increment
        transaction.update(bookingRef, {
          paidAmount: admin.firestore.FieldValue.increment(paymentAmount),
          remainingAmount: admin.firestore.FieldValue.increment(-paymentAmount),
          paymentStatus: newPaymentStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Immutable audit log
        const auditRef = db.collection('auditLogs').doc();
        transaction.set(auditRef, {
          id: auditRef.id,
          user: callerEmail || callerUid,
          userId: callerUid,
          actorUid: callerUid,
          actorEmail: callerEmail,
          actorType: 'staff',
          action: 'PAYMENT_RECORDED_SECURE',
          entity: 'payments',
          entityId: paymentRef.id,
          details: `تسجيل دفعة بقيمة ${paymentAmount}$ للحجز ${bData.bookingNumber || bookingRef.id} بإيصال ${receiptNumber} (المتبقي: ${nextRemaining}$)`,
          timestamp: new Date().toISOString(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          paymentId: paymentRef.id,
          receiptNumber,
          amount: paymentAmount,
          paidAmount: nextPaid,
          remainingAmount: nextRemaining,
          paymentStatus: newPaymentStatus,
          message: `تم تسجيل الدفعة بقيمة ${paymentAmount}$ وإصدار الإيصال رقم ${receiptNumber} بنجاح.`,
        };
      });
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      console.error('[recordPaymentSecure] Payment transaction error:', err);
      throw new HttpsError('internal', 'حدث خطأ أثناء معالجة الدفعة المالية.');
    }
  }
);
