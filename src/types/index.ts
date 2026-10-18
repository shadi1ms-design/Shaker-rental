export type VehicleCategory = 'light' | 'medium' | 'jeep_7seats';

export type VehicleStatus = 'available' | 'reserved' | 'rented' | 'maintenance' | 'inactive';

export type BookingStatus =
  | 'new'          // طلب جديد
  | 'reviewing'    // قيد المراجعة
  | 'confirmed'    // مؤكد
  | 'rented'       // جاري التأجير
  | 'completed'    // مكتمل
  | 'cancelled'    // ملغي
  | 'rejected';    // مرفوض

export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric';
export type TransmissionType = 'automatic' | 'manual';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'other';
export type UserRole = 'super_admin' | 'superAdmin' | 'admin' | 'employee' | 'customer';

export interface Vehicle {
  id: string;
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
  lastOilChangeMileage: number;
  status: VehicleStatus;
  imageUrl: string;
  images?: string[];
  features: string[];
  description: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  vehicleId: string;
  vehicleName: string;
  vehicleCategory?: VehicleCategory;
  customerName: string;
  customerPhone: string;
  customerWhatsApp: string;
  customerNationalId?: string;
  customerAddress?: string;
  customerLicenseNumber?: string;
  customerId?: string;
  customerEmail?: string;
  pickupDate: string; // YYYY-MM-DD
  pickupTime: string; // HH:mm
  returnDate: string; // YYYY-MM-DD
  returnTime: string; // HH:mm
  rentalDays: number;
  dailyPrice: number;
  basePrice: number;
  discountAmount: number;
  insuranceAmount: number;
  driverFee?: number;
  withDriver?: boolean;
  deliveryLocation?: string;
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  status: BookingStatus;
  paymentStatus?: string;
  notes?: string;
  isDeleted?: boolean;
  hiddenFromCustomer?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  whatsapp?: string;
  nationalId?: string;
  drivingLicense?: string;
  nationality?: string;
  address?: string;
  totalRentals: number;
  totalSpending: number;
  notes?: string;
  verificationStatus?: 'pending' | 'manual_review' | 'verified' | 'rejected';
  verified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;
  documents?: {
    idFront?: string;
    idBack?: string;
    drivingLicense?: string;
    passport?: string;
  };
  isDeleted?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ContractAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'document' | 'other';
  size?: number;
  uploadedAt: string;
}

export interface ContractVideo {
  id: string;
  name: string;
  url: string;
  size?: number;
  uploadedAt: string;
  notes?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  bookingId: string;
  vehicleId: string;
  vehicleName?: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  termsAndConditions: string;
  status: 'active' | 'closed' | 'terminated';
  mileageAtPickup: number;
  fuelAtPickup: string;
  mileageAtReturn?: number;
  fuelAtReturn?: string;
  attachments?: ContractAttachment[];
  video?: ContractVideo;
  createdAt: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  customerId?: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: string;
}

export type MaintenanceType =
  | 'oil_change'
  | 'tires'
  | 'brakes'
  | 'battery'
  | 'engine'
  | 'transmission'
  | 'general';

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  serviceType: MaintenanceType;
  mileage: number;
  cost: number;
  serviceDate: string;
  nextDueMileage?: number;
  technicianNotes?: string;
  performedBy?: string;
  createdAt: string;
}

export interface VehicleInspection {
  id: string;
  bookingId: string;
  vehicleId: string;
  type: 'pickup' | 'return';
  exteriorCondition?: string;
  interiorCondition?: string;
  tiresCondition?: string;
  bodyCondition?: Record<string, string>;
  cleanliness?: string;
  existingDamages?: string;
  newDamages?: string;
  inspectorName?: string;
  fuelLevel: 'empty' | 'quarter' | 'half' | 'three_quarters' | 'full';
  mileage: number;
  damages?: string[];
  photos?: string[];
  inspectorNotes?: string;
  createdAt: string;
}

export interface DiscountConfig {
  enabled: boolean;
  percentage: number; // 1 to 25 %
  scope: 'all' | 'specific'; // 'all' vehicles or 'specific' vehicles
  vehicleIds: string[]; // List of vehicle IDs if scope === 'specific'
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
  insurance1to2Days: number;
  insuranceAbove2Days: number;
  insuranceShortTerm?: number;
  insuranceLongTerm?: number;
  weeklyDiscountPerDay?: number;
  discountConfig?: DiscountConfig;
  monthlyRateLight: number;
  monthlyRateMedium: number;
  monthlyRateJeep: number;
  oilChangeIntervalKm: number;
  driverDailyRate?: number;
  rentalTerms: string;
  updatedAt?: string;
}

export interface SearchFilters {
  category?: VehicleCategory | 'all';
  pickupDate?: string;
  returnDate?: string;
  pickupTime?: string;
  returnTime?: string;
  transmission?: TransmissionType | 'all';
  searchQuery?: string;
}

export interface PricingCalculation {
  rentalDays: number;
  dailyPrice: number;
  basePrice: number;
  discountAmount: number;
  // System 1: Duration/Period Discount (Weekly & Monthly)
  durationDiscountAmount: number;
  durationDiscountType: 'none' | 'weekly' | 'monthly' | 'proportional';
  durationDiscountDescription: string;
  // System 2: Dynamic Member Account Discount (1% - 25%)
  memberDiscountAmount: number;
  memberDiscountPercentage: number;
  memberDiscountEligible: boolean;
  memberDiscountApplied: boolean;
  potentialMemberSavings: number;
  // Totals & Insurance
  insuranceAmount: number;
  subtotal: number;
  totalPrice: number;
  pricingType: 'daily' | 'weekly' | 'monthly' | 'proportional';
  explanation: string;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  details?: string;
  actorUid?: string | null;
  actorEmail?: string | null;
  actorType?: 'customer' | 'staff' | 'guest' | 'system';
  customerProvidedName?: string | null;
}

export interface AppNotification {
  id: string;
  type: 'new_booking' | 'booking_confirmed' | 'booking_cancelled' | 'upcoming_rental' | 'rental_return' | 'oil_change_reminder' | 'maintenance_reminder' | 'payment_due';
  title: string;
  message: string;
  bookingId?: string;
  vehicleId?: string;
  read: boolean;
  createdAt: string;
}

export interface UploadedFile {
  id: string;
  userId: string;
  userEmail?: string;
  fileName: string;
  fileUrl: string;
  storagePath?: string;
  fileType: string;
  fileSize: number; // in bytes
  category?: 'national_id' | 'driver_license' | 'passport' | 'contract' | 'other';
  verified?: boolean;
  status?: 'pending' | 'manual_review' | 'verified' | 'rejected' | 'uploaded';
  uploadedAt: string; // ISO date-time string
}

export interface FirestoreUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  accountDisabled?: boolean;
  disabled?: boolean;
  createdAt: string;
  uploadedFilesCount?: number;
  files?: UploadedFile[];
  verificationStatus?: 'pending' | 'manual_review' | 'verified' | 'rejected';
  verified?: boolean;
  identityVerified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  accountDisabled?: boolean;
  disabled?: boolean;
  createdAt?: string;
  emailVerified?: boolean;
  isPasswordProvider?: boolean;
}

export interface UserAccount extends AuthUser {
  // User profile information
}

export interface FilterOptions {
  category: VehicleCategory | 'all';
  priceRange: [number, number];
  brand: string;
  year: number | 'all';
  transmission: TransmissionType | 'all';
  fuelType: FuelType | 'all';
  seats: number | 'all';
  availability: 'all' | 'available' | 'rented';
  searchQuery: string;
}

export type SortField = 'price-asc' | 'price-desc' | 'year-desc' | 'popularity';
