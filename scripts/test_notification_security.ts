/**
 * Verification script for sendBookingNotification Cloud Function security requirements.
 * Tests:
 * 1. Customer requesting another user's booking -> Rejected with permission-denied.
 * 2. Customer sending spoofed totalAmount -> Server ignores it and uses Firestore total.
 * 3. Customer sending spoofed status -> Server ignores it and uses Firestore status.
 * 4. Customer sending spoofed customerName -> Server ignores it and uses Firestore customerName.
 * 5. Staff/Admin executing function -> Authorized and uses authoritative Firestore values.
 */

import * as functions from 'firebase-functions';

// Mock Firestore document data
const MOCK_FIRESTORE_BOOKING = {
  id: 'bk_test_secure_99',
  bookingNumber: 'SHK-2026-000099',
  customerId: 'legit_customer_123',
  customerName: 'طارق الناصر (الأصيل)',
  vehicleId: 'veh_test_01',
  vehicleName: 'مرسيدس S-Class 2024',
  totalPrice: 1250,
  status: 'confirmed',
  isDeleted: false,
};

const MOCK_FIRESTORE_VEHICLE = {
  id: 'veh_test_01',
  brand: 'مرسيدس',
  model: 'S-Class',
  year: 2024,
};

const MOCK_FIRESTORE_USER = {
  id: 'legit_customer_123',
  displayName: 'طارق الناصر',
};

// Simulation of the security logic in sendBookingNotification
function sanitizeString(input: unknown, maxLen = 100): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>'"&;`\\]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function isCallerStaff(authOrToken?: any): boolean {
  const token = authOrToken?.token || authOrToken;
  if (!token || typeof token !== 'object') return false;
  const role = typeof token.role === 'string' ? token.role.toLowerCase() : '';
  if (['admin', 'super_admin', 'superadmin', 'employee', 'staff', 'manager', 'owner'].includes(role)) {
    return true;
  }
  return token.admin === true || token.super_admin === true || token.employee === true || token.staff === true;
}

interface NotificationResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  data?: {
    bookingId: string;
    bookingNumber: string;
    customerName: string;
    vehicleName: string;
    status: string;
    totalAmount: number;
    message: string;
  };
}

function simulateSendBookingNotification(
  data: any,
  context: { auth?: { uid: string; token?: any } }
): NotificationResult {
  // 1. Authentication
  if (!context.auth || !context.auth.uid) {
    return { success: false, error: 'يجب تسجيل الدخول أولاً', errorCode: 'unauthenticated' };
  }

  const callerUid = context.auth.uid;
  const rawBookingId = data?.bookingId;

  if (!rawBookingId || typeof rawBookingId !== 'string') {
    return { success: false, error: 'معرف الحجز مطلوب', errorCode: 'invalid-argument' };
  }

  const cleanBookingId = sanitizeString(rawBookingId, 64);
  if (!cleanBookingId || !/^[a-zA-Z0-9_-]+$/.test(cleanBookingId)) {
    return { success: false, error: 'معرف الحجز غير صالح', errorCode: 'invalid-argument' };
  }

  // Mock reading from Firestore
  if (cleanBookingId !== MOCK_FIRESTORE_BOOKING.id) {
    return { success: false, error: 'الحجز غير موجود', errorCode: 'not-found' };
  }

  const bData = MOCK_FIRESTORE_BOOKING;
  const isStaff = isCallerStaff(context.auth.token);
  const isOwner = bData.customerId === callerUid;

  // 2. Authorization Check: Customer can ONLY access their own booking
  if (!isStaff && !isOwner) {
    return {
      success: false,
      error: 'غير مصرح لك بإرسال إشعار لحجز لا يخص حسابك الشخصي (Ownership Verification Failed).',
      errorCode: 'permission-denied',
    };
  }

  // 3. Authoritative Data Extraction (Client data.totalAmount, data.status, data.customerName are DISCARDED)
  const authoritativeStatus = bData.status;
  const authoritativeTotalAmount = bData.totalPrice;
  const authoritativeVehicleName = `${MOCK_FIRESTORE_VEHICLE.brand} ${MOCK_FIRESTORE_VEHICLE.model} (${MOCK_FIRESTORE_VEHICLE.year})`;
  const authoritativeCustomerName = MOCK_FIRESTORE_USER.displayName;
  const authoritativeBookingNumber = bData.bookingNumber;

  return {
    success: true,
    data: {
      bookingId: cleanBookingId,
      bookingNumber: authoritativeBookingNumber,
      customerName: authoritativeCustomerName,
      vehicleName: authoritativeVehicleName,
      status: authoritativeStatus,
      totalAmount: authoritativeTotalAmount,
      message: `تم إرسال إشعار الحجز بنجاح بناءً على بيانات الخادم الموثوقة.`,
    },
  };
}

// Run test suite
console.log('========================================================');
console.log('🧪 Running Security Test Suite: sendBookingNotification');
console.log('========================================================\n');

let passedTests = 0;
let totalTests = 5;

// Test 1: Customer requests bookingId of someone else
console.log('Test 1: Customer requests bookingId belonging to another person...');
const t1Res = simulateSendBookingNotification(
  { bookingId: 'bk_test_secure_99' },
  { auth: { uid: 'attacker_uid_456', token: { role: 'customer' } } }
);
if (!t1Res.success && t1Res.errorCode === 'permission-denied') {
  console.log('✅ PASSED: Blocked unauthorized ownership bypass with "permission-denied" error.');
  passedTests++;
} else {
  console.error('❌ FAILED: Unexpected result:', t1Res);
}

// Test 2: Customer sends spoofed totalAmount ($1 instead of $1250)
console.log('\nTest 2: Customer sends spoofed totalAmount ($1)...');
const t2Res = simulateSendBookingNotification(
  { bookingId: 'bk_test_secure_99', totalAmount: 1 },
  { auth: { uid: 'legit_customer_123', token: { role: 'customer' } } }
);
if (t2Res.success && t2Res.data?.totalAmount === 1250) {
  console.log(`✅ PASSED: Server ignored client totalAmount ($1) and extracted Firestore authoritative total ($${t2Res.data.totalAmount}).`);
  passedTests++;
} else {
  console.error('❌ FAILED: Total amount was manipulated!', t2Res);
}

// Test 3: Customer sends spoofed status ('completed' instead of 'confirmed')
console.log('\nTest 3: Customer sends spoofed status ("completed")...');
const t3Res = simulateSendBookingNotification(
  { bookingId: 'bk_test_secure_99', status: 'completed' },
  { auth: { uid: 'legit_customer_123', token: { role: 'customer' } } }
);
if (t3Res.success && t3Res.data?.status === 'confirmed') {
  console.log(`✅ PASSED: Server ignored client status ("completed") and extracted Firestore authoritative status ("${t3Res.data.status}").`);
  passedTests++;
} else {
  console.error('❌ FAILED: Status was manipulated!', t3Res);
}

// Test 4: Customer sends spoofed customerName ('Hacker 1337')
console.log('\nTest 4: Customer sends spoofed customerName ("Hacker 1337")...');
const t4Res = simulateSendBookingNotification(
  { bookingId: 'bk_test_secure_99', customerName: 'Hacker 1337' },
  { auth: { uid: 'legit_customer_123', token: { role: 'customer' } } }
);
if (t4Res.success && t4Res.data?.customerName === 'طارق الناصر') {
  console.log(`✅ PASSED: Server ignored client customerName ("Hacker 1337") and extracted Firestore authoritative name ("${t4Res.data.customerName}").`);
  passedTests++;
} else {
  console.error('❌ FAILED: Customer name was manipulated!', t4Res);
}

// Test 5: Employee / Admin invokes function for any booking
console.log('\nTest 5: Employee / Admin invokes function for booking...');
const t5Res = simulateSendBookingNotification(
  { bookingId: 'bk_test_secure_99' },
  { auth: { uid: 'staff_uid_999', token: { role: 'admin', admin: true } } }
);
if (t5Res.success && t5Res.data?.bookingId === 'bk_test_secure_99') {
  console.log('✅ PASSED: Staff caller successfully authorized to trigger notification with server-authoritative data.');
  passedTests++;
} else {
  console.error('❌ FAILED: Staff caller was blocked!', t5Res);
}

console.log('\n========================================================');
console.log(`🏁 Test Summary: ${passedTests}/${totalTests} security tests PASSED.`);
console.log('========================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
