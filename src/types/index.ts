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
export type UserRole = 'superAdmin' | 'super_admin' | 'admin' | 'employee' | 'customer';

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
  pickupDate: string; // YYYY-MM-DD
  pickupTime: string; // HH:mm
  returnDate: string; // YYYY-MM-DD
  returnTime: string; // HH:mm
  rentalDays: number;
  dailyPrice: number;
  basePrice: number;
  discountAmount: number;
  insuranceAmount: number;
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  status: BookingStatus;
  notes?: string;
  isDeleted?: boolean;
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

export interface Contract {
  id: string;
  contractNumber: string;
  bookingId: string;
  vehicleId: string;
  customerId: string;
  termsAndConditions: string;
  status: 'active' | 'closed' | 'terminated';
  mileageAtPickup: number;
  fuelAtPickup: string;
  mileageAtReturn?: number;
  fuelAtReturn?: string;
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
  weeklyDiscountPerDay: number;
  monthlyRateLight: number;
  monthlyRateMedium: number;
  monthlyRateJeep: number;
  oilChangeIntervalKm: number;
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
  fileType: string;
  fileSize: number; // in bytes
  category?: 'national_id' | 'driver_license' | 'passport' | 'contract' | 'other';
  uploadedAt: string; // ISO date-time string
}

export interface FirestoreUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  createdAt: string;
  uploadedFilesCount?: number;
  files?: UploadedFile[];
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  createdAt?: string;
}

export interface UserAccount extends AuthUser {
  passwordHash?: string; // used for local demo / fallback persistence
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
