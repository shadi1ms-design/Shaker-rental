export type VehicleCategory = 'light' | 'medium' | 'jeep_7seats';
export type TransmissionType = 'automatic' | 'manual';
export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric';
export type VehicleStatus = 'available' | 'reserved' | 'rented' | 'maintenance' | 'inactive';

export interface Vehicle {
  id: string;
  docId?: string;
  dataId?: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  category: VehicleCategory;
  seats: number;
  transmission: TransmissionType;
  fuelType: FuelType;
  dailyPrice: number;
  plateNumber: string;
  currentMileage: number;
  lastOilChangeMileage?: number;
  oilChangeIntervalKm?: number;
  status: VehicleStatus;
  /** The true database status before derived 'rented' status overrides it */
  storedStatus?: VehicleStatus;
  imageUrl: string;
  images?: string[];
  features: string[];
  description: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  _internalDetailsLoaded?: boolean;
}

export type SortField = 'recommended' | 'price-asc' | 'price-desc' | 'year-desc' | 'year-asc' | 'name-asc' | string;

export interface SearchFilters {
  pickupDate?: string;
  returnDate?: string;
  pickupTime?: string;
  returnTime?: string;
  category?: VehicleCategory | 'all';
  transmission?: TransmissionType | 'all';
  fuelType?: FuelType | 'all';
  searchQuery?: string;
  sortBy?: SortField;
  onlyAvailable?: boolean;
}

export type BookingStatus =
  | 'new'
  | 'reviewing'
  | 'confirmed'
  | 'rented'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export interface Booking {
  id: string;
  bookingNumber: string;
  vehicleId: string;
  vehicleName?: string;
  vehicleCategory?: VehicleCategory;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerWhatsApp: string;
  customerEmail?: string;
  customerAddress?: string;
  customerVerified?: boolean;
  pickupDate: string; // ISO YYYY-MM-DD
  returnDate: string; // ISO YYYY-MM-DD
  pickupTime?: string; // HH:mm
  returnTime?: string; // HH:mm
  rentalDays: number;
  dailyPrice: number;
  basePrice: number;
  discountAmount: number;
  discountPercentage?: number;
  discountBase?: number;
  insuranceAmount: number;
  driverFee?: number;
  totalPrice: number;
  withDriver?: boolean;
  deliveryLocation?: string;
  notes?: string;
  status: BookingStatus;
  mileageAtPickup?: number;
  mileageAtReturn?: number;
  pickupCondition?: string;
  returnCondition?: string;
  extraCharges?: number;
  finalTotal?: number;
  handoverAt?: string;
  handoverByUid?: string;
  handoverByEmail?: string;
  returnedAt?: string;
  returnedByUid?: string;
  returnedByEmail?: string;
  cancellationReason?: string;
  rejectionReason?: string;
  statusReason?: string;
  hiddenFromCustomer?: boolean;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  createdByType?: 'customer' | 'staff' | 'system';
  createdByUid?: string;
  createdByEmail?: string;
  updatedByUid?: string;
  updatedByEmail?: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  whatsapp: string;
  email?: string;
  nationalId?: string;
  licenseNumber?: string;
  nationality?: string;
  address?: string;
  notes?: string;
  isBlacklisted?: boolean;
  totalRentals: number;
  totalSpending: number;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export type DiscountScope = 'all' | 'specific';

export interface DiscountConfig {
  enabled: boolean;
  percentage: number;
  scope: DiscountScope;
  vehicleIds: string[];
  title?: string;
}

export interface AppSettings {
  id: string;
  companyName: string;
  companyNameEn: string;
  companyPhone: string;
  whatsappNumber: string;
  address: string;
  currency: string;
  /** @deprecated استخدام insuranceShortTerm بدلاً منها، يُقرأ كاحتياطي فقط */
  insurance1to2Days?: number;
  /** @deprecated استخدام insuranceLongTerm بدلاً منها، يُقرأ كاحتياطي فقط */
  insuranceAbove2Days?: number;
  insuranceShortTerm: number;
  insuranceLongTerm: number;
  driverDailyRate?: number;
  cancellationLeadHours?: number;
  monthlyRateLight: number;
  monthlyRateMedium: number;
  monthlyRateJeep: number;
  discountConfig?: DiscountConfig;
  rentalTerms: string;
  updatedAt?: string;
}

export type SettingsPayload = Partial<AppSettings> & Record<string, unknown>;

export interface PricingCalculation {
  rentalDays: number;
  dailyPrice: number;
  basePrice: number;
  discountAmount: number;
  durationDiscountAmount: number;
  durationDiscountType: 'none' | 'weekly' | 'monthly' | 'proportional';
  durationDiscountDescription: string;
  memberDiscountAmount: number;
  memberDiscountPercentage: number;
  memberDiscountEligible: boolean;
  memberDiscountApplied: boolean;
  potentialMemberSavings: number;
  insuranceAmount: number;
  driverFee?: number;
  subtotal: number;
  totalPrice: number;
  pricingType: 'daily' | 'monthly';
  explanation: string;
}

export type PricingCalculationResult = PricingCalculation;

export type UserRole =
  | 'customer'
  | 'employee'
  | 'admin'
  | 'super_admin'
  | 'superAdmin'
  | 'staff'
  | 'manager'
  | 'owner';

export type VerificationStatus =
  | 'not_started'
  | 'unsubmitted'
  | 'pending'
  | 'pending_review'
  | 'manual_review'
  | 'verified'
  | 'rejected';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  address?: string;
  photoURL?: string;
  role: UserRole;
  createdAt?: string;
  emailVerified?: boolean;
  isPasswordProvider?: boolean;
  verified?: boolean;
  verificationStatus?: VerificationStatus;
}

export interface UserAccount {
  id?: string;
  uid: string;
  email: string;
  password?: string;
  displayName: string;
  phone?: string;
  address?: string;
  role: UserRole;
  createdAt: string;
  emailVerified?: boolean;
  isPasswordProvider?: boolean;
  verified?: boolean;
  verificationStatus?: VerificationStatus;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  address?: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string;
  verified?: boolean;
  verificationStatus?: VerificationStatus;
  verifiedAt?: string;
}

export type DocumentCategory = 'driver_license' | 'passport' | 'national_id' | 'contract' | 'other';

export interface UserFileRecord {
  id: string;
  userId: string;
  userEmail: string;
  fileName: string;
  storagePath: string;
  downloadUrl?: string;
  fileType: string;
  fileSize: number;
  category: DocumentCategory;
  uploadedAt: string;
  checksum?: string;
  verified?: boolean;
}

export interface FirestoreUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  address?: string;
  role: UserRole;
  disabled?: boolean;
  accountDisabled?: boolean;
  createdAt: string;
  lastLoginAt?: string;
  uploadedFilesCount?: number;
  files?: UserFileRecord[];
  verified?: boolean;
  verificationStatus?: VerificationStatus;
  verificationSubmittedAt?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  driverLicenseUrl?: string;
  foreignerEntrySealUrl?: string;
  passportUrl?: string;
  identityDocChoice?: IdentityDocChoice;
}

export type IdentityDocType = 'national_id' | 'passport';
export type IdentityDocChoice = IdentityDocType;

export interface DocQualityMetric {
  width: number;
  height: number;
  blurScore: number;
  brightness?: number;
  passed: boolean;
  message?: string;
}

export interface CapturedDocumentMeta {
  slot?: 'id_front' | 'id_back' | 'passport' | 'license_front' | 'license_back' | 'selfie' | 'driver_license' | 'identity';
  storagePath: string;
  downloadUrl?: string;
  capturedAt?: string;
  uploadedAt?: string;
  checksumSha256?: string;
  sha256?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  sizeBytes?: number;
  blurScore?: number;
  brightnessScore?: number;
  quality?: {
    width: number;
    height: number;
    blurScore: number;
    brightness?: number;
  };
  userAgent?: string;
  captureMethod?: 'live_camera';
}

export interface VerificationRequest {
  id?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  userPhone?: string;
  address?: string;
  identityDocType: IdentityDocType;
  status: VerificationStatus;
  attempt?: number;
  docs?: {
    driver_license?: CapturedDocumentMeta & { sizeBytes: number };
    identity?: CapturedDocumentMeta & { sizeBytes: number };
  };
  documents?: {
    idFront?: CapturedDocumentMeta;
    idBack?: CapturedDocumentMeta;
    passport?: CapturedDocumentMeta;
    licenseFront?: CapturedDocumentMeta;
    licenseBack?: CapturedDocumentMeta;
    selfie?: CapturedDocumentMeta;
  };
  autoChecks?: {
    allLiveCamera: boolean;
    blurPassed: boolean;
    lightingPassed: boolean;
    resolutionPassed: boolean;
    passedAll: boolean;
    failureReasons: string[];
  };
  submittedAt: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string;
  rejectionReason?: string;
  updatedAt?: string;
}

export interface IdentityVerificationParams {
  userId?: string;
  targetUid?: string;
  nationalId?: string;
  licenseNumber?: string;
  identityDocType?: IdentityDocType;
  [key: string]: unknown;
}

export interface IdentityVerificationResult {
  verified: boolean;
  status?: VerificationStatus;
  message?: string;
  [key: string]: unknown;
}

export interface StaffMember {
  id: string;
  uid?: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'super_admin' | 'admin' | 'manager' | 'staff';
  jobTitle: string;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface AppNotification {
  id: string;
  type:
    | 'new_booking'
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'upcoming_rental'
    | 'rental_return'
    | 'overdue_rental_alert'
    | 'booking'
    | 'return'
    | 'system'
    | 'verification'
    | string;
  title: string;
  message: string;
  bookingId?: string;
  vehicleId?: string;
  relatedId?: string;
  targetRole?: 'admin' | 'customer' | 'all';
  targetUserId?: string;
  read: boolean;
  isRead?: boolean;
  createdAt: string;
}

export type NotificationItem = AppNotification;

export interface AuditLog {
  id: string;
  action: string;
  entityType?: 'vehicle' | 'booking' | 'customer' | 'settings' | 'staff' | 'user' | 'verification' | string;
  entity?: string;
  entityId?: string;
  entityName?: string;
  actorId?: string;
  actorUid?: string | null;
  actorName?: string;
  actorEmail?: string | null;
  actorRole?: string;
  actorType?: 'customer' | 'staff' | 'system' | string;
  targetUid?: string;
  targetEmail?: string;
  previousRole?: string;
  newRole?: string;
  details?: unknown;
  createdAt: string;
  timestamp?: string;
}

export type AuditLogEntry = AuditLog;

// ==========================================
// Cloud Functions Request & Response Types
// ==========================================

export interface FunctionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface CreateBookingPayload {
  vehicleId: string;
  customerId?: string;
  customerEmail?: string;
  customerName: string;
  customerPhone: string;
  customerWhatsApp?: string;
  customerAddress: string;
  pickupDate: string;
  returnDate: string;
  pickupTime?: string;
  returnTime?: string;
  withDriver?: boolean;
  deliveryLocation?: string;
  notes?: string;
}

export interface CreateBookingResponse {
  bookingId: string;
  bookingNumber: string;
  status: BookingStatus;
  totalPrice: number;
  createdAt: string;
  booking?: Booking;
}

export interface UpdateBookingStatusPayload {
  bookingId: string;
  bookingNumber?: string;
  status: BookingStatus;
  reason?: string;
  extraCharges?: number;
  returnCondition?: string;
  mileageAtPickup?: number;
  mileageAtReturn?: number;
  currentMileage?: number;
}

export interface VerifyUserRequestPayload {
  userId: string;
  identityDocType: IdentityDocType;
  documents: VerificationRequest['documents'];
}

export interface ReviewVerificationPayload {
  userId: string;
  decision: 'verified' | 'rejected' | 'manual_review';
  rejectionReason?: string;
  notes?: string;
}

export interface SetStaffRolePayload {
  targetUid: string;
  targetEmail: string;
  role: UserRole;
  permissions?: string[];
  isActive?: boolean;
}

export interface GenerateContractPayload {
  bookingId: string;
  language?: 'ar' | 'en';
}

export interface ContractResponsePayload {
  contractId: string;
  contractNumber: string;
  bookingId: string;
  bookingNumber: string;
  verificationCode: string;
  status: 'issued' | 'active' | 'closed' | 'terminated';
  terminationReason?: 'cancelled' | 'rejected' | 'deleted';
  terminatedAt?: string;
  terminatedByUid?: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  vehicleId: string;
  vehicleName: string;
  vehicleYear?: number;
  vehicleColor?: string;
  plateNumber?: string;
  pickupDate: string;
  returnDate: string;
  pickupTime: string;
  returnTime: string;
  rentalDays: number;
  dailyPrice: number;
  basePrice: number;
  discountAmount: number;
  discountPercentage?: number;
  discountBase?: number;
  insuranceAmount: number;
  driverFee: number;
  totalPrice: number;
  extraCharges?: number;
  finalTotal?: number;
  withDriver: boolean;
  deliveryLocation: string;
  mileageAtPickup?: number;
  mileageAtReturn?: number;
  termsAndConditions: string[];
  issuedAt: string;
  closedAt?: string;
}

export interface GenerateContractResponse {
  contractId: string;
  bookingNumber: string;
  generatedAt: string;
  contractHtml?: string;
  downloadUrl?: string;
  contract?: ContractResponsePayload;
}

export interface VerifyContractPayload {
  contractNumber: string;
  verificationCode: string;
}

export interface VerifyContractResponse {
  isValid: boolean;
  contractNumber?: string;
  bookingNumber?: string;
  vehicleName?: string;
  pickupDate?: string;
  returnDate?: string;
  status?: string;
  issuedAt?: string;
  message?: string;
}
