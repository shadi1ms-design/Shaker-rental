/**
 * Cloud Functions for Shaker Car Rental Platform
 * Server-Side Business Logic, Atomic Transactions, Identity Verification & RBAC
 */

import { getApps, initializeApp } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp();
}

// ==========================================
// 1. Booking & Availability Functions
// ==========================================
export {
  createBookingSecure,
  updateBookingStatusSecure,
  sendBookingNotification,
  getVehicleAvailability,
  deleteBookingSecure,
} from './bookingFunctions';

// ==========================================
// 2. Identity & Document Verification Functions
// ==========================================
export {
  initiateVerificationSession,
  submitVerificationDocument,
  submitVerificationRequest,
  reviewVerification,
  revokeVerification,
  getVerificationDocumentUrl,
  verifyCustomerIdentity,
  cleanupVerificationStaging,
} from './verifyCustomerIdentity';

// ==========================================
// 3. User Management & Lifecycle Functions (RBAC)
// ==========================================
export {
  setUserRole,
  toggleUserAccountStatus,
  deleteUserAccount,
  syncMyRole,
  setAdminMfaRequirement,
} from './userManagement';

export {
  beforeUserCreatedHandler,
} from './userLifecycle';

// ==========================================
// 4. Fleet Management Functions (Admin Only)
// ==========================================
export {
  addVehicle,
  updateVehicle,
  deleteVehicle,
  getVehiclesInternalDetails,
} from './fleetFunctions';

// ==========================================
// 5. Rental Contract Generation Functions
// ==========================================
export {
  generateRentalContractPdf,
  verifyContractCode,
} from './contractFunctions';

// ==========================================
// 6. Settings & Pricing Functions
// ==========================================
export {
  calculateDynamicPricing,
  updateSettingsSecure,
} from './settingsFunctions';

// ==========================================
// 7. Storage & Telegram Integrations
// ==========================================
export {
  validateUploadedFileSignature,
} from './validateUploadedFileSignature';

export {
  sendTelegramBookingAlert,
} from './sendTelegramBookingAlert';

export {
  telegramWebhook,
} from './telegramWebhook';

// ==========================================
// 8. Scheduled Automated Tasks & SEO Meta
// ==========================================
export {
  checkOverdueRentals,
} from './overdueRentals';

export {
  vehicleMeta,
} from './vehicleMeta';

