import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import { DATABASE_ID, FUNCTION_REGION } from './constants';
import { enforceRateLimit } from './rateLimit';
import { isCallerStaff } from './authz';
import { secureCall } from './secureCall';
import {
  FrozenContractDocument,
  buildContractSnapshot,
  maskCustomerName,
} from './contractHelpers';

const getDb = (): Firestore => getFirestore(getApp(), DATABASE_ID);

const ALLOWED_CONTRACT_BOOKING_STATUSES = ['confirmed', 'rented', 'completed'];

export const generateRentalContractPdf = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'user',
    unauthenticatedMessage: 'يرجى تسجيل الدخول لإنشاء العقد.',
  },
  async (request) => {
    const db = getDb();

    const callerUid = request.auth!.uid;
    const isStaff = isCallerStaff(request.auth!.token as any);

    await enforceRateLimit(db, `contract_${callerUid}`, 15, 60);

    const { bookingId } = request.data as { bookingId: string; language?: 'ar' | 'en' };

    if (!bookingId || typeof bookingId !== 'string') {
      throw new HttpsError('invalid-argument', 'معرف الحجز مطلوب.');
    }

    const contractId = `CTR_${bookingId}`;
    const contractRef = db.collection('contracts').doc(contractId);
    const bookingRef = db.collection('bookings').doc(bookingId);

    // 1. Check booking authorization & lifecycle state first
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      throw new HttpsError('not-found', 'الحجز غير موجود.');
    }

    const bookingData = bookingSnap.data()!;

    // Security check: only booking owner or staff can generate/view contract
    if (!isStaff && bookingData.customerId !== callerUid) {
      throw new HttpsError('permission-denied', 'غير مصرح لك بالوصول إلى هذا العقد.');
    }

    // Reject unconfirmed/cancelled/rejected bookings from contract generation
    if (!ALLOWED_CONTRACT_BOOKING_STATUSES.includes(String(bookingData.status || ''))) {
      throw new HttpsError(
        'failed-precondition',
        'لا يمكن عرض أو إصدار العقد لحجز غير مؤكد أو ملغى.'
      );
    }

    // 2. If frozen contract already exists in Firestore, return it directly
    const existingContractSnap = await contractRef.get();
    if (existingContractSnap.exists) {
      const existingData = existingContractSnap.data() as FrozenContractDocument;

      if (existingData.status === 'terminated') {
        throw new HttpsError(
          'failed-precondition',
          'هذا العقد ملغى قانونياً ولا يمكن طباعته أو اعتماده.'
        );
      }

      // Sync latest mileageAtPickup / mileageAtReturn from booking if recorded after contract issuance
      const mergedContract: FrozenContractDocument = {
        ...existingData,
        mileageAtPickup: existingData.mileageAtPickup ?? bookingData.mileageAtPickup,
        mileageAtReturn: existingData.mileageAtReturn ?? bookingData.mileageAtReturn,
      };

      const safeSnapshot = JSON.parse(JSON.stringify(mergedContract));

      return {
        success: true,
        contractId: existingData.contractId || contractId,
        bookingNumber: existingData.bookingNumber || bookingData.bookingNumber || bookingId,
        generatedAt: existingData.issuedAt,
        contract: safeSnapshot,
      };
    }

    // 3. Lazy-create frozen contract for confirmed/rented/completed booking that predates contract freezing
    const [vehicleSnap, internalVehicleSnap, customerSnap, settingsSnap] = await Promise.all([
      bookingData.vehicleId
        ? db.collection('vehicles').doc(String(bookingData.vehicleId)).get()
        : Promise.resolve(null),
      bookingData.vehicleId
        ? db.collection('vehicles').doc(String(bookingData.vehicleId)).collection('internal').doc('details').get()
        : Promise.resolve(null),
      bookingData.customerId
        ? db.collection('users').doc(String(bookingData.customerId)).get()
        : Promise.resolve(null),
      db.collection('settings').doc('global').get(),
    ]);

    const vehicleData = vehicleSnap?.exists ? vehicleSnap.data() || {} : {};
    const internalVehicleData = internalVehicleSnap?.exists ? internalVehicleSnap.data() || {} : {};
    const customerData = customerSnap?.exists ? customerSnap.data() || {} : {};
    const settingsData = settingsSnap.exists ? settingsSnap.data() || {} : {};

    let initialStatus: 'issued' | 'active' | 'closed' = 'issued';
    if (bookingData.status === 'completed') {
      initialStatus = 'closed';
    } else if (bookingData.status === 'rented') {
      initialStatus = 'active';
    }

    const contractSnapshot = buildContractSnapshot({
      bookingId,
      bookingData,
      vehicleData,
      internalVehicleData,
      customerData,
      settingsData,
      status: initialStatus,
      mileageAtPickup: bookingData.mileageAtPickup,
      mileageAtReturn: bookingData.mileageAtReturn,
    });

    if (initialStatus === 'closed') {
      contractSnapshot.closedAt = bookingData.updatedAt || new Date().toISOString();
    }

    // Persist atomically using transaction so concurrent requests never overwrite an existing snapshot
    const finalSnapshot = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(contractRef);
      if (snap.exists) {
        return snap.data() as FrozenContractDocument;
      }
      const cleanDoc = JSON.parse(JSON.stringify(contractSnapshot));
      tx.set(contractRef, cleanDoc);
      return cleanDoc as FrozenContractDocument;
    });

    return {
      success: true,
      contractId: finalSnapshot.contractId,
      bookingNumber: finalSnapshot.bookingNumber,
      generatedAt: finalSnapshot.issuedAt,
      contract: finalSnapshot,
    };
  }
);

/**
 * Pure helper for contract code verification so it can be unit-tested against an in-memory/mocked DB.
 */
export async function executeVerifyContractCode(
  db: Firestore,
  rawContractNumber: string,
  rawVerificationCode: string
): Promise<{
  success: boolean;
  isValid: boolean;
  contractNumber?: string;
  bookingNumber?: string;
  vehicleName?: string;
  pickupDate?: string;
  returnDate?: string;
  status?: string;
  terminationReason?: string;
  issuedAt?: string;
  customerName?: string;
  totalAmount?: number;
  contentHashPrefix?: string;
  message: string;
}> {
  const cleanNumber = rawContractNumber.trim().toUpperCase();
  const cleanCode = rawVerificationCode.trim().toUpperCase();

  const genericMismatchMessage =
    'رمز التحقق غير مطابق أو لم يتم العثور على عقد مسجل، يرجى التأكد من صحة الوثيقة.';

  let contractData: Record<string, any> | null = null;

  // Query by contractNumber
  const querySnap = await db
    .collection('contracts')
    .where('contractNumber', '==', cleanNumber)
    .limit(1)
    .get();

  if (!querySnap.empty) {
    contractData = querySnap.docs[0].data();
  } else {
    // Fallback lookup by contractId if user entered CTR_<bookingId> or bookingNumber
    const stripped = cleanNumber.replace(/^CTR[-_]/i, '');
    const directSnap = await db.collection('contracts').doc(`CTR_${stripped}`).get();
    if (directSnap.exists) {
      contractData = directSnap.data() || null;
    }
  }

  if (!contractData) {
    return {
      success: true,
      isValid: false,
      message: genericMismatchMessage,
    };
  }

  // Constant-time comparison against stored random verificationCode ONLY (no HMAC fallback)
  const storedCode = String(contractData.verificationCode || '').trim().toUpperCase();

  if (!storedCode) {
    return {
      success: true,
      isValid: false,
      message: genericMismatchMessage,
    };
  }

  const storedBuf = Buffer.from(storedCode, 'utf8');
  const inputBuf = Buffer.from(cleanCode, 'utf8');

  let isMatch = false;
  if (storedBuf.length === inputBuf.length && storedBuf.length > 0) {
    isMatch = crypto.timingSafeEqual(storedBuf, inputBuf);
  }

  if (!isMatch) {
    return {
      success: true,
      isValid: false,
      message: genericMismatchMessage,
    };
  }

  const maskedName = maskCustomerName(contractData.customerName);
  const totalAmount =
    typeof contractData.finalTotal === 'number'
      ? contractData.finalTotal
      : Number(contractData.totalPrice || 0);
  const contentHashPrefix = contractData.contentHash
    ? String(contractData.contentHash).slice(0, 12)
    : undefined;

  // Only reveal termination status after proving knowledge of the valid verificationCode
  if (contractData.status === 'terminated') {
    const isDeletedContract = contractData.terminationReason === 'deleted';
    return {
      success: true,
      isValid: false,
      contractNumber: contractData.contractNumber,
      bookingNumber: contractData.bookingNumber,
      vehicleName: contractData.vehicleName,
      pickupDate: contractData.pickupDate,
      returnDate: contractData.returnDate,
      status: 'terminated',
      terminationReason: contractData.terminationReason || 'cancelled',
      issuedAt: contractData.issuedAt,
      customerName: isDeletedContract ? undefined : maskedName,
      totalAmount,
      contentHashPrefix,
      message: isDeletedContract ? 'العقد محذوف وملغى قانونياً' : 'العقد ملغى',
    };
  }

  // Return strictly non-PII public verification metadata
  return {
    success: true,
    isValid: true,
    contractNumber: contractData.contractNumber,
    bookingNumber: contractData.bookingNumber,
    vehicleName: contractData.vehicleName,
    pickupDate: contractData.pickupDate,
    returnDate: contractData.returnDate,
    status: contractData.status || 'issued',
    issuedAt: contractData.issuedAt,
    customerName: maskedName,
    totalAmount,
    contentHashPrefix,
    message: 'العقد صحيح ومطابق للسجلات الرسمية المعتمدة لشركة شاكر لتأجير السيارات.',
  };
}

/**
 * Public callable endpoint to verify the authenticity of a printed rental contract
 * using its contractNumber and cryptographic verificationCode.
 * Rate-limited strictly by client IP and returns only non-PII contract summary fields.
 */
export const verifyContractCode = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'public',
  },
  async (request) => {
    const db = getDb();

    const rawIp = request.rawRequest?.ip || 'unknown_ip';
    const rateKey = `verify_ctr_ip_${rawIp.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

    await enforceRateLimit(db, rateKey, 10, 300);

    const { contractNumber, verificationCode } = (request.data || {}) as {
      contractNumber?: string;
      verificationCode?: string;
    };

    if (
      !contractNumber ||
      typeof contractNumber !== 'string' ||
      !verificationCode ||
      typeof verificationCode !== 'string'
    ) {
      throw new HttpsError('invalid-argument', 'يرجى إدخال رقم العقد ورمز التحقق الرقمي.');
    }

    return executeVerifyContractCode(db, contractNumber, verificationCode);
  }
);
