import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { isCallerStaff, assertNotRevoked } from './authz';
import { resolveBookingDocument } from './bookingHelpers';
import { consumeRateLimit, sanitizeRateLimitKey } from './rateLimit';

const db = getFirestore(getApp(), DATABASE_ID);

export interface ContractResponsePayload {
  contractId: string;
  contractNumber: string;
  bookingId: string;
  bookingNumber: string;
  verificationCode: string;
  status: 'active' | 'closed' | 'terminated';
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerNationalId: string;
  vehicleId: string;
  vehicleName: string;
  pickupDate: string;
  returnDate: string;
  pickupTime: string;
  returnTime: string;
  rentalDays: number;
  dailyPrice: number;
  basePrice: number;
  insuranceAmount: number;
  driverFee: number;
  totalPrice: number;
  withDriver: boolean;
  deliveryLocation: string;
  termsAndConditions: string[];
  issuedAt: string;
}

/**
 * Cloud Function: generateRentalContractPdf (region: asia-south1)
 * Enforces:
 * 1. Dual contract & booking ownership verification (or staff).
 * 2. Rejection if booking status is NOT confirmed, rented, or completed.
 * 3. Rejection if booking is marked as deleted (isDeleted === true).
 * 4. Cryptographic HMAC verification code combining:
 *    contractNumber:bookingId:customerId:vehicleId:pickupDate:returnDate:totalPrice
 * 5. Returns signed contract data (JSON) only, allowing client-side RTL rendering and printing without PDF injection vulnerabilities.
 */
export const generateRentalContractPdf = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    secrets: ['CONTRACT_HMAC_SECRET'],
  },
  async (request) => {
    await assertNotRevoked(request);

    const { bookingId } = request.data || {};
    if (!bookingId || typeof bookingId !== 'string') {
      throw new HttpsError('invalid-argument', 'معرف الحجز مطلوب لإصدار العقد.');
    }

    const callerUid = request.auth!.uid;
    const isStaff = isCallerStaff(request.auth!.token);

    const bookingRef = await resolveBookingDocument(db, bookingId.trim());
    if (!bookingRef) {
      throw new HttpsError('not-found', 'بيانات الحجز المرتبط بهذا العقد غير موجودة.');
    }

    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
      throw new HttpsError('not-found', 'بيانات الحجز المرتبط بهذا العقد غير موجودة.');
    }

    const bookingData = bookingDoc.data()!;
    const resolvedBookingId = bookingDoc.id;
    const finalContractId = `CTR_${resolvedBookingId}`;

    let contractData: any = null;
    const contractDoc = await db.collection('contracts').doc(finalContractId).get();
    if (contractDoc.exists) {
      contractData = contractDoc.data();
    }

    // 1. Rejection of deleted bookings
    if (bookingData.isDeleted === true) {
      throw new HttpsError('failed-precondition', 'لا يمكن إصدار أو عرض عقد لحجز محذوف من النظام.');
    }

    // 2. Rejection of unconfirmed/cancelled/rejected bookings
    const allowedStatuses = ['confirmed', 'rented', 'completed'];
    if (!allowedStatuses.includes(bookingData.status)) {
      throw new HttpsError(
        'failed-precondition',
        'لا يمكن إصدار وثيقة العقد إلا للحجوزات المؤكدة أو الجارية أو المكتملة.'
      );
    }

    // 3. Verify ownership: if non-staff, caller MUST be the customer of this booking
    if (!isStaff) {
      if (bookingData.customerId !== callerUid) {
        throw new HttpsError('permission-denied', 'غير مصرح لك بالوصول إلى بيانات عقد هذا الحجز.');
      }
      if (contractData && contractData.customerId && contractData.customerId !== callerUid) {
        throw new HttpsError('permission-denied', 'غير مصرح لك بالوصول إلى هذا العقد.');
      }
    }

    // 4. HMAC secret validation
    const hmacSecret = process.env.CONTRACT_HMAC_SECRET;
    if (!hmacSecret || !hmacSecret.trim()) {
      throw new HttpsError(
        'failed-precondition',
        'خادم النظام غير مهيأ بالمفتاح الأمني لتوقيع العقود الرقمية (CONTRACT_HMAC_SECRET غير معرف في بيئة التشغيل السحابية).'
      );
    }

    const contractNumber =
      contractData?.contractNumber || `SHK-CTR-${resolvedBookingId.slice(-6).toUpperCase()}`;
    const customerId = bookingData.customerId || callerUid;
    const customerName = String(bookingData.customerName || 'المستأجر').trim();
    const vehicleId = String(bookingData.vehicleId || '').trim();
    const vehicleName = String(bookingData.vehicleName || 'المركبة').trim();
    const pickupDate = String(bookingData.pickupDate || '').trim();
    const returnDate = String(bookingData.returnDate || '').trim();
    const totalPrice = Number(bookingData.totalPrice || 0);

    // 5. Cryptographic HMAC calculation incorporating all critical contract terms
    const hmacPayload = `${contractNumber}:${resolvedBookingId}:${customerId}:${vehicleId}:${pickupDate}:${returnDate}:${totalPrice}`;
    const hmac = crypto.createHmac('sha256', hmacSecret.trim());
    hmac.update(hmacPayload);
    const verificationCode = hmac.digest('hex').slice(0, 24).toUpperCase();

    // Fetch official terms from settings if available
    let officialTerms = [
      'يلتزم المستأجر بالمحافظة على السيارة واستخدامها وفق القوانين والأنظمة المرورية السورية.',
      'تعتبر السيارة أمانة لدى المستأجر ولا يحق له تأجيرها للغير أو قيادتها من غير المفوضين بالعقد.',
      'إرجاع السيارة في الموعد والمكان المحددين وبنفس الحالة الفنية التي تم استلامها عليها.',
      'المستأجر مسؤول عن أي مخالفات مرورية أو أضرار ناجمة عن سوء الاستخدام خلال فترة الإيجار.',
    ];

    try {
      const settingsSnap = await db.collection('settings').doc('global').get();
      if (settingsSnap.exists && settingsSnap.data()?.rentalTerms) {
        const termsStr = String(settingsSnap.data()?.rentalTerms).trim();
        const splitLines = termsStr
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (splitLines.length > 0) {
          officialTerms = splitLines;
        }
      }
    } catch {
      // Fallback to default terms
    }

    // Contract status follows the booking lifecycle and is never reset to 'active' on re-view.
    const contractStatus: 'active' | 'closed' | 'terminated' =
      bookingData.status === 'completed' ? 'closed' : 'active';

    const contractPayload: ContractResponsePayload = {
      contractId: finalContractId,
      contractNumber,
      bookingId: resolvedBookingId,
      bookingNumber: bookingData.bookingNumber || resolvedBookingId,
      verificationCode,
      status: contractStatus,
      customerId,
      customerName,
      customerPhone: bookingData.customerPhone || '',
      customerNationalId: bookingData.customerNationalId || '',
      vehicleId,
      vehicleName,
      pickupDate,
      returnDate,
      pickupTime: bookingData.pickupTime || '',
      returnTime: bookingData.returnTime || '',
      rentalDays: Number(bookingData.rentalDays || 1),
      dailyPrice: Number(bookingData.dailyPrice || 0),
      basePrice: Number(bookingData.basePrice || 0),
      insuranceAmount: Number(bookingData.insuranceAmount || 0),
      driverFee: Number(bookingData.driverFee || 0),
      totalPrice,
      withDriver: Boolean(bookingData.withDriver),
      deliveryLocation: bookingData.deliveryLocation || 'مقر شركة شاكر لتأجير السيارات - دمشق',
      termsAndConditions: officialTerms,
      issuedAt: contractData?.issuedAt || new Date().toISOString(),
    };

    // Persist contract record in Firestore /contracts/{contractId}
    try {
      await db.collection('contracts').doc(finalContractId).set(
        {
          id: finalContractId,
          contractNumber,
          bookingId: resolvedBookingId,
          bookingNumber: contractPayload.bookingNumber,
          customerId,
          customerName,
          vehicleId,
          vehicleName,
          pickupDate,
          returnDate,
          totalPrice,
          verificationCode,
          status: contractData?.status === 'terminated' ? 'terminated' : contractStatus,
          issuedAt: contractPayload.issuedAt,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (saveErr) {
      console.warn('[generateRentalContractPdf] Contract Firestore sync note:', saveErr);
    }

    return {
      success: true,
      contract: contractPayload,
      verificationCode,
      contractNumber,
      message: 'تم التحقق من الحجز وتوليد بيانات العقد الموقعة رقمياً بنجاح.',
    };
  }
);

/**
 * Cloud Function: verifyContractCode (region: asia-south1)
 * Enforces App Check and checks verification code authenticity.
 * Returns boolean isValid and public non-personal contract verification info only.
 */
export const verifyContractCode = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    secrets: ['CONTRACT_HMAC_SECRET'],
  },
  async (request) => {
    const { contractNumber, verificationCode } = request.data || {};

    if (!contractNumber || typeof contractNumber !== 'string' || !contractNumber.trim()) {
      throw new HttpsError('invalid-argument', 'رقم العقد مطلوب للتحقق.');
    }
    if (!verificationCode || typeof verificationCode !== 'string' || !verificationCode.trim()) {
      throw new HttpsError('invalid-argument', 'رمز التحقق الرقمي مطلوب.');
    }

    const cleanContractNumber = contractNumber.trim();
    const cleanCode = verificationCode.trim().toUpperCase();

    // Brute-force protection: 10 attempts / 10 min per caller IP (or uid when signed in)
    const callerKey = request.auth?.uid || String(request.rawRequest?.ip || 'unknown-ip');
    await consumeRateLimit(
      db,
      `verify_contract_${sanitizeRateLimitKey(callerKey)}`,
      10,
      10 * 60 * 1000,
      'عدد محاولات التحقق كبير جداً. يرجى المحاولة بعد عدة دقائق.'
    );

    // HMAC secret validation
    const hmacSecret = process.env.CONTRACT_HMAC_SECRET;
    if (!hmacSecret || !hmacSecret.trim()) {
      throw new HttpsError(
        'failed-precondition',
        'خادم التحقق غير مهيأ بالمفتاح الأمني للعقود.'
      );
    }

    // Query contract from Firestore
    const contractsQuery = await db
      .collection('contracts')
      .where('contractNumber', '==', cleanContractNumber)
      .limit(1)
      .get();

    if (contractsQuery.empty) {
      return {
        isValid: false,
        contractNumber: cleanContractNumber,
        message: 'رمز التحقق الرقمي غير مطابق لبيانات هذا العقد، أو العقد غير مسجل لدينا.',
      };
    }

    const contractDoc = contractsQuery.docs[0];
    const contractData = contractDoc.data();

    // Verify booking
    let bookingData: any = null;
    if (contractData.bookingId) {
      const bRef = await resolveBookingDocument(db, contractData.bookingId);
      if (bRef) {
        const bDoc = await bRef.get();
        if (bDoc.exists) {
          bookingData = bDoc.data();
        }
      }
    }

    const bookingId = contractData.bookingId || '';
    const customerId = contractData.customerId || bookingData?.customerId || '';
    const vehicleId = contractData.vehicleId || bookingData?.vehicleId || '';
    const pickupDate = contractData.pickupDate || bookingData?.pickupDate || '';
    const returnDate = contractData.returnDate || bookingData?.returnDate || '';
    const totalPrice = Number(contractData.totalPrice || bookingData?.totalPrice || 0);

    const hmacPayload = `${cleanContractNumber}:${bookingId}:${customerId}:${vehicleId}:${pickupDate}:${returnDate}:${totalPrice}`;
    const hmac = crypto.createHmac('sha256', hmacSecret.trim());
    hmac.update(hmacPayload);
    const expectedCode = hmac.digest('hex').slice(0, 24).toUpperCase();

    const expectedBuf = Buffer.from(expectedCode);
    const givenBuf = Buffer.from(cleanCode);
    const isMatch = expectedBuf.length === givenBuf.length && crypto.timingSafeEqual(expectedBuf, givenBuf);

    if (!isMatch) {
      return {
        isValid: false,
        contractNumber: cleanContractNumber,
        message: 'رمز التحقق الرقمي غير مطابق لبيانات هذا العقد، أو العقد غير مسجل لدينا.',
      };
    }

    return {
      isValid: true,
      contractNumber: cleanContractNumber,
      bookingNumber: contractData.bookingNumber || bookingId,
      vehicleName: contractData.vehicleName || bookingData?.vehicleName || 'مركبة مسجلة',
      pickupDate,
      returnDate,
      status: contractData.status || 'active',
      issuedAt: contractData.issuedAt || '',
      message: 'وثيقة العقد أصلية ومعتمدة ومطابقة لسجلات شركة شاكر لتأجير السيارات.',
    };
  }
);
