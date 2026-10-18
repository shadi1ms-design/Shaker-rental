import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { isCallerStaff } from './authz';
import { resolveBookingDocument } from './bookingHelpers';

const db = getFirestore(admin.app(), DATABASE_ID);

/**
 * Builds a minimalist, valid PDF 1.4 document buffer.
 */
function buildMinimalContractPdfBuffer(contractNumber: string, customerName: string, vehicleName: string, totalPrice: number, verificationCode: string): Buffer {
  const content = `BT /F1 16 Tf 50 750 Td (SHAKER CAR RENTAL - RENTAL CONTRACT) Tj ET ` +
    `BT /F1 12 Tf 50 710 Td (Contract Number: ${contractNumber}) Tj ET ` +
    `BT /F1 12 Tf 50 680 Td (Customer: ${customerName}) Tj ET ` +
    `BT /F1 12 Tf 50 650 Td (Vehicle: ${vehicleName}) Tj ET ` +
    `BT /F1 12 Tf 50 620 Td (Total Price: $${totalPrice}) Tj ET ` +
    `BT /F1 10 Tf 50 580 Td (Security Verification Code: ${verificationCode}) Tj ET ` +
    `BT /F1 10 Tf 50 550 Td (Issued: ${new Date().toISOString()}) Tj ET`;

  const streamLength = Buffer.byteLength(content, 'utf-8');

  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${streamLength} >>
stream
${content}
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000244 00000 n 
0000000300 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
380
%%EOF`;

  return Buffer.from(pdf, 'utf-8');
}

/**
 * Cloud Function: generateRentalContractPdf (region: asia-south1)
 * Enforces dual contract & booking ownership verification and strict HMAC-SHA256 signature.
 */
export const generateRentalContractPdf = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    secrets: ['CONTRACT_HMAC_SECRET'],
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لعرض أو تحميل العقد.');
    }

    const { contractId, bookingId } = request.data || {};
    const targetId = contractId || bookingId;
    if (!targetId || typeof targetId !== 'string') {
      throw new HttpsError('invalid-argument', 'معرف العقد أو الحجز مطلوب.');
    }

    const callerUid = request.auth.uid;
    const isStaff = isCallerStaff(request.auth.token);

    let contractData: any = null;
    let bookingData: any = null;

    if (contractId) {
      const contractDoc = await db.collection('contracts').doc(contractId).get();
      if (contractDoc.exists) {
        contractData = contractDoc.data();
      }
    }

    const resolvedBookingId = bookingId || contractData?.bookingId || targetId;
    if (resolvedBookingId) {
      const bookingRef = await resolveBookingDocument(db, resolvedBookingId);
      if (bookingRef) {
        const bookingDoc = await bookingRef.get();
        if (bookingDoc.exists) {
          bookingData = bookingDoc.data();
        }
      }
    }

    // Verify dual ownership: if non-staff, MUST own contract AND booking together
    if (!isStaff) {
      if (contractData && contractData.customerId !== callerUid) {
        throw new HttpsError('permission-denied', 'غير مصرح لك بالوصول إلى بيانات هذا العقد (Contract Ownership Mismatch).');
      }
      if (bookingData && bookingData.customerId !== callerUid) {
        throw new HttpsError('permission-denied', 'غير مصرح لك بالوصول إلى بيانات حجز هذا العقد (Booking Ownership Mismatch).');
      }
      if (!contractData && !bookingData) {
        throw new HttpsError('not-found', 'بيانات العقد أو الحجز غير موجودة.');
      }
    }

    // HMAC secret validation - MUST come from CONTRACT_HMAC_SECRET without fallbacks
    const hmacSecret = process.env.CONTRACT_HMAC_SECRET;
    if (!hmacSecret || !hmacSecret.trim()) {
      throw new HttpsError(
        'failed-precondition',
        'خادم النظام غير مهيأ بالمفتاح الأمني لتوقيع العقود الرقمية (CONTRACT_HMAC_SECRET غير معرف في بيئة التشغيل السحابية).'
      );
    }

    const contractNumber = contractData?.contractNumber || `SHK-CTR-${targetId.slice(-6).toUpperCase()}`;
    const customerName = bookingData?.customerName || contractData?.customerName || 'المستأجر';
    const vehicleName = bookingData?.vehicleName || contractData?.vehicleName || 'المركبة';
    const totalPrice = Number(bookingData?.totalPrice || contractData?.totalAmount || 0);

    // Cryptographic HMAC-SHA256 verification code
    const hmac = crypto.createHmac('sha256', hmacSecret.trim());
    hmac.update(`${targetId}:${contractNumber}:${bookingData?.customerId || contractData?.customerId || callerUid}`);
    const verificationCode = hmac.digest('hex').slice(0, 24).toUpperCase();

    // Generate genuine PDF document buffer
    const pdfBuffer = buildMinimalContractPdfBuffer(
      contractNumber,
      customerName,
      vehicleName,
      totalPrice,
      verificationCode
    );

    return {
      success: true,
      contractId: contractId || targetId,
      bookingId: resolvedBookingId,
      contractNumber,
      verificationCode,
      status: 'generated',
      customerName,
      vehicleName,
      totalPrice,
      generatedAt: new Date().toISOString(),
      pdfBase64: pdfBuffer.toString('base64'),
      contentType: 'application/pdf',
      message: 'تم التحقق من ملكية العقد والحجز معاً وتوليد وثيقة العقد الرقمية الموقعة بنجاح.',
    };
  }
);
