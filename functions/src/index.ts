/**
 * Shaker Car Rental — Serverless Cloud Functions (asia-south1)
 * 
 * Modular, hardened server-side authority endpoints:
 * - RBAC & Claims Authority (Auth Token Custom Claims)
 * - Booking Engine & Damascus Timezone Pricing
 * - Atomic Payment & Concurrency Transactions
 * - Dual-ownership Contract HMAC Verification
 * - Identity Verification & Privacy Guard
 * - Telegram Webhook & Alerts with Idempotency
 * - Asynchronous Storage Media Signature Validation
 */

import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin globally once
if (!getApps().length) {
  initializeApp();
}

// 1. Booking Functions
export {
  createBookingSecure,
  updateBookingStatusSecure,
  deleteBookingSecure,
  sendBookingNotification,
  getVehicleAvailability,
} from './bookingFunctions';

// 2. Contract Functions
export {
  generateRentalContractPdf,
  verifyContractCode,
} from './contractFunctions';

// 3. Settings & Pricing Functions
export {
  calculateDynamicPricing,
  updateSettingsSecure,
} from './settingsFunctions';

// 4. Overdue Rental Alerts Function
export {
  checkOverdueRentals,
} from './fleetFunctions';

// 6. User Management & Authorization Functions
export {
  setUserRole,
  toggleUserAccountStatus,
  deleteUserAccount,
  syncMyRole,
} from './userManagement';

// 7. Identity Verification Function
export {
  verifyCustomerIdentity,
} from './verifyCustomerIdentity';

// 8. Auth Lifecycle Trigger
export {
  beforeUserCreatedHandler,
} from './userLifecycle';

// 9. Telegram Bot Integration
export {
  sendTelegramBookingAlert,
} from './sendTelegramBookingAlert';
export {
  telegramWebhook,
} from './telegramWebhook';

// 10. Cloud Storage Signature Inspector
export {
  validateUploadedFileSignature,
} from './validateUploadedFileSignature';

// Helper re-exports for testing and script utilities
export {
  applyBookingStatusChange,
  ALLOWED_TRANSITIONS,
  resolveBookingDocument,
  resolveVehicleDocument,
} from './bookingHelpers';

export {
  isCallerStaff,
  isCallerAdmin,
  isCallerSuperAdmin,
  canManageUserRole,
  canManageAccountLifecycle,
  getUserRoleFromClaims,
} from './authz';

export {
  calculateRentalDaysDamascus,
  calculateRentalPriceServer,
  parseDamascusDateTime,
} from './pricingServer';
