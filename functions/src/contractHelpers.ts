import * as crypto from 'crypto';

export interface FrozenContractDocument {
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
  insuranceAmount: number;
  driverFee: number;
  totalPrice: number;
  extraCharges?: number;
  finalTotal?: number;
  contentHash?: string;
  withDriver: boolean;
  deliveryLocation: string;
  mileageAtPickup?: number;
  mileageAtReturn?: number;
  termsAndConditions: string[];
  issuedAt: string;
  closedAt?: string;
}

export const DEFAULT_RENTAL_TERMS: string[] = [
  'يلتزم المستأجر بإعادة المركبة في التاريخ والوقت المحددين بحالتها المستلمة.',
  'المركبة مخصصة للاستخدام الشخصي داخل الأراضي السورية ولا يجوز تأجيرها للغير أو الرهن.',
  'المستأجر مسؤول قانونياً ومالياً عن المخالفات المرورية والأضرار الناتجة عن سوء الاستخدام طيلة فترة الإيجار.',
  'يُسترد مبلغ التأمين كاملاً عند إرجاع المركبة سليمة وبعد تسوية أية التزامات مالية.',
  'يمنع قيادة المركبة من قبل أي شخص غير مذكور في هذا العقد دون موافقة خطية مسبقة من الشركة.',
];

/**
 * Computes canonical SHA-256 hash of core contract legal fields.
 */
export function computeContractContentHash(data: {
  contractNumber: string;
  bookingId: string;
  customerId: string;
  vehicleId: string;
  pickupDate: string;
  returnDate: string;
  totalPrice: number | string;
}): string {
  const payload = [
    String(data.contractNumber || '').trim(),
    String(data.bookingId || '').trim(),
    String(data.customerId || '').trim(),
    String(data.vehicleId || '').trim(),
    String(data.pickupDate || '').trim(),
    String(data.returnDate || '').trim(),
    Number(data.totalPrice || 0).toFixed(2),
  ].join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Masks customer name for public contract verification screens (e.g., "أحمد محمد" -> "أ***د م***د")
 */
export function maskCustomerName(name?: string | null): string {
  if (!name || !name.trim()) return 'عميل معتمد';
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  return parts
    .map((part) => {
      if (part.length <= 2) return part;
      return part[0] + '*'.repeat(Math.max(1, part.length - 2)) + part[part.length - 1];
    })
    .join(' ');
}

/**
 * Generates a cryptographically random 24-character uppercase hexadecimal verification code
 * (12 random bytes = 96 bits of entropy). Stored directly in `contracts/{contractId}` and never recomputed.
 */
export function generateContractVerificationCode(): string {
  return crypto.randomBytes(12).toString('hex').toUpperCase();
}

export function parseRentalTerms(rawTerms: unknown): string[] {
  if (typeof rawTerms !== 'string' || !rawTerms.trim()) {
    return DEFAULT_RENTAL_TERMS;
  }
  const lines = rawTerms
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : DEFAULT_RENTAL_TERMS;
}

/**
 * Builds a complete, frozen contract snapshot document ready to be persisted in `contracts/{contractId}`.
 */
export function buildContractSnapshot(params: {
  bookingId: string;
  bookingData: Record<string, any>;
  vehicleData?: Record<string, any>;
  internalVehicleData?: Record<string, any>;
  customerData?: Record<string, any>;
  settingsData?: Record<string, any>;
  status?: 'issued' | 'active' | 'closed' | 'terminated';
  issuedAt?: string;
  mileageAtPickup?: number;
  mileageAtReturn?: number;
}): FrozenContractDocument {
  const {
    bookingId,
    bookingData,
    vehicleData = {},
    internalVehicleData = {},
    customerData = {},
    settingsData = {},
    status = 'issued',
    issuedAt: customIssuedAt,
    mileageAtPickup,
    mileageAtReturn,
  } = params;

  const contractId = `CTR_${bookingId}`;
  const bookingNumber = String(bookingData.bookingNumber || bookingId.slice(-6).toUpperCase());
  const contractNumber = `CTR-${bookingNumber}`;
  const issuedAt = customIssuedAt || new Date().toISOString();

  const totalPrice = Number(bookingData.totalPrice || 0);
  const verificationCode = generateContractVerificationCode();

  const resolvedPickupMileage =
    typeof mileageAtPickup === 'number' && Number.isFinite(mileageAtPickup)
      ? mileageAtPickup
      : typeof bookingData.mileageAtPickup === 'number' && Number.isFinite(bookingData.mileageAtPickup)
      ? bookingData.mileageAtPickup
      : undefined;

  const resolvedReturnMileage =
    typeof mileageAtReturn === 'number' && Number.isFinite(mileageAtReturn)
      ? mileageAtReturn
      : typeof bookingData.mileageAtReturn === 'number' && Number.isFinite(bookingData.mileageAtReturn)
      ? bookingData.mileageAtReturn
      : undefined;

  const snapshot: FrozenContractDocument = {
    contractId,
    contractNumber,
    bookingId,
    bookingNumber,
    verificationCode,
    status,
    customerId: String(bookingData.customerId || ''),
    customerName: String(bookingData.customerName || customerData.displayName || customerData.fullName || 'المستأجر'),
    customerPhone: String(bookingData.customerPhone || bookingData.customerWhatsApp || customerData.phone || ''),
    customerAddress: String(bookingData.customerAddress || customerData.address || ''),
    vehicleId: String(bookingData.vehicleId || ''),
    vehicleName: String(
      bookingData.vehicleName || `${vehicleData.brand || ''} ${vehicleData.model || ''}`.trim() || 'المركبة'
    ),
    vehicleYear: typeof vehicleData.year === 'number' ? vehicleData.year : undefined,
    vehicleColor: typeof vehicleData.color === 'string' ? vehicleData.color : undefined,
    plateNumber:
      typeof internalVehicleData.plateNumber === 'string' && internalVehicleData.plateNumber
        ? internalVehicleData.plateNumber
        : typeof vehicleData.plateNumber === 'string' && vehicleData.plateNumber
        ? vehicleData.plateNumber
        : undefined,
    pickupDate: String(bookingData.pickupDate || ''),
    returnDate: String(bookingData.returnDate || ''),
    pickupTime: String(bookingData.pickupTime || ''),
    returnTime: String(bookingData.returnTime || ''),
    rentalDays: Number(bookingData.rentalDays || 1),
    dailyPrice: Number(bookingData.dailyPrice || 0),
    basePrice: Number(bookingData.basePrice || 0),
    discountAmount: Number(bookingData.discountAmount || 0),
    insuranceAmount: Number(bookingData.insuranceAmount || 0),
    driverFee: Number(bookingData.driverFee || 0),
    totalPrice,
    extraCharges: typeof bookingData.extraCharges === 'number' ? bookingData.extraCharges : undefined,
    finalTotal:
      typeof bookingData.finalTotal === 'number'
        ? bookingData.finalTotal
        : typeof bookingData.extraCharges === 'number'
        ? totalPrice + bookingData.extraCharges
        : totalPrice,
    contentHash: computeContractContentHash({
      contractNumber,
      bookingId,
      customerId: String(bookingData.customerId || ''),
      vehicleId: String(bookingData.vehicleId || ''),
      pickupDate: String(bookingData.pickupDate || ''),
      returnDate: String(bookingData.returnDate || ''),
      totalPrice,
    }),
    withDriver: Boolean(bookingData.withDriver),
    deliveryLocation: String(bookingData.deliveryLocation || 'مقر شركة شاكر لتأجير السيارات - دمشق'),
    termsAndConditions: parseRentalTerms(settingsData.rentalTerms),
    issuedAt,
  };

  if (resolvedPickupMileage !== undefined) {
    snapshot.mileageAtPickup = resolvedPickupMileage;
  }
  if (resolvedReturnMileage !== undefined) {
    snapshot.mileageAtReturn = resolvedReturnMileage;
  }

  return snapshot;
}
