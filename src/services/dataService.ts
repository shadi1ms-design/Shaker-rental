import {
  Vehicle,
  Booking,
  Customer,
  Contract,
  Payment,
  MaintenanceRecord,
  VehicleInspection,
  AppSettings,
  BookingStatus,
  VehicleStatus,
  AuditLog,
  AppNotification,
  FirestoreUser,
  UploadedFile
} from '../types';
import {
  INITIAL_VEHICLES,
  INITIAL_CUSTOMERS,
  INITIAL_BOOKINGS,
  INITIAL_MAINTENANCE_RECORDS,
  INITIAL_FIRESTORE_USERS,
  INITIAL_UPLOADED_FILES
} from '../data/seedData';
import { DEFAULT_SETTINGS } from './pricing';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  runTransaction
} from 'firebase/firestore';
import { handleFirestoreError } from '../utils/firebaseErrorHandler';

// Storage keys for local persistence
const STORAGE_KEYS = {
  VEHICLES: 'shaker_vehicles_v1',
  BOOKINGS: 'shaker_bookings_v1',
  CUSTOMERS: 'shaker_customers_v1',
  CONTRACTS: 'shaker_contracts_v1',
  PAYMENTS: 'shaker_payments_v1',
  MAINTENANCE: 'shaker_maintenance_v1',
  INSPECTIONS: 'shaker_inspections_v1',
  SETTINGS: 'shaker_settings_v1',
  AUDIT: 'shaker_audit_v1',
  NOTIFICATIONS: 'shaker_notifications_v1',
  BOOKING_COUNTER: 'shaker_booking_counter_v1',
  USERS: 'shaker_firestore_users_v1',
  FILES: 'shaker_uploaded_files_v1',
};

// Safe localStorage loader
function getLocalItem<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch {
    return fallback;
  }
}

function setLocalItem<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('LocalStorage error:', err);
  }
}

// Initial bootstrap check
function initStorage() {
  if (!localStorage.getItem(STORAGE_KEYS.VEHICLES)) {
    setLocalItem(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    setLocalItem(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.BOOKINGS)) {
    setLocalItem(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.MAINTENANCE)) {
    setLocalItem(STORAGE_KEYS.MAINTENANCE, INITIAL_MAINTENANCE_RECORDS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    setLocalItem(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.BOOKING_COUNTER)) {
    setLocalItem(STORAGE_KEYS.BOOKING_COUNTER, 3);
  }
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    setLocalItem(STORAGE_KEYS.USERS, INITIAL_FIRESTORE_USERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.FILES)) {
    const allSeedFiles: UploadedFile[] = [];
    Object.values(INITIAL_UPLOADED_FILES).forEach(list => allSeedFiles.push(...list));
    setLocalItem(STORAGE_KEYS.FILES, allSeedFiles);
  }
}

initStorage();

export const dataService = {
  // -------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------
  async getSettings(): Promise<AppSettings> {
    if (isFirebaseConfigured && db) {
      try {
        // Standard path: settings/company
        const companyRef = doc(db, 'settings', 'company');
        const companySnap = await getDoc(companyRef);
        if (companySnap.exists()) {
          const data = companySnap.data() as AppSettings;
          setLocalItem(STORAGE_KEYS.SETTINGS, data);
          return data;
        }

        // Fallback check for legacy settings/global
        const globalRef = doc(db, 'settings', 'global');
        const globalSnap = await getDoc(globalRef);
        if (globalSnap.exists()) {
          const data = globalSnap.data() as AppSettings;
          setLocalItem(STORAGE_KEYS.SETTINGS, data);
          return data;
        }
      } catch (err: any) {
        handleFirestoreError('settings', 'company', 'read', err, auth?.currentUser?.uid);
      }
    }
    return getLocalItem<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  async updateSettings(settingsUpdates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...settingsUpdates,
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        // Write to primary path settings/company
        await setDoc(doc(db, 'settings', 'company'), updated, { merge: true });
        // Synchronize legacy path settings/global
        await setDoc(doc(db, 'settings', 'global'), updated, { merge: true }).catch(() => {});
      } catch (err: any) {
        handleFirestoreError('settings', 'company', 'write', err, auth?.currentUser?.uid);
      }
    }

    setLocalItem(STORAGE_KEYS.SETTINGS, updated);
    this.logAudit('تحديث إعدادات الشركة والنظام والأسعار', 'settings', 'company');
    return updated;
  },

  async ensureDefaultSettings(): Promise<void> {
    if (isFirebaseConfigured && db) {
      try {
        const companyRef = doc(db, 'settings', 'company');
        const snap = await getDoc(companyRef);
        if (!snap.exists()) {
          await setDoc(companyRef, DEFAULT_SETTINGS, { merge: true });
        }
      } catch {
        // Unauthenticated visitor will safely skip seeding
      }
    }
  },

  // -------------------------------------------------------------
  // Vehicles
  // -------------------------------------------------------------
  async getVehicles(): Promise<Vehicle[]> {
    if (isFirebaseConfigured && db) {
      try {
        const col = collection(db, 'vehicles');
        const q = query(col, where('isDeleted', '!=', true));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => d.data() as Vehicle);
        if (docs.length > 0) return docs;
      } catch (err) {
        console.warn('Firestore vehicles error, falling back:', err);
      }
    }
    const vehicles = getLocalItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    return vehicles.filter(v => !v.isDeleted);
  },

  async getVehicleById(id: string): Promise<Vehicle | null> {
    const vehicles = await this.getVehicles();
    return vehicles.find(v => v.id === id) || null;
  },

  async addVehicle(vehicleData: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    const id = `veh-${Date.now()}`;
    const newVehicle: Vehicle = {
      ...vehicleData,
      id,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'vehicles', id), newVehicle);
      } catch (err) {
        console.warn('Firestore addVehicle error:', err);
      }
    }

    const current = getLocalItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    setLocalItem(STORAGE_KEYS.VEHICLES, [newVehicle, ...current]);
    this.logAudit(`إضافة سيارة جديدة: ${newVehicle.brand} ${newVehicle.model}`, 'vehicles', id);
    return newVehicle;
  },

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
    const current = getLocalItem<Vehicle[]>(STORAGE_KEYS.VEHICLES, INITIAL_VEHICLES);
    const index = current.findIndex(v => v.id === id);
    if (index === -1) throw new Error('السيارة غير موجودة');

    const updated: Vehicle = {
      ...current[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    current[index] = updated;
    setLocalItem(STORAGE_KEYS.VEHICLES, current);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'vehicles', id), updates);
      } catch (err) {
        console.warn('Firestore updateVehicle error:', err);
      }
    }

    this.logAudit(`تعديل بيانات سيارة: ${updated.brand} ${updated.model}`, 'vehicles', id);
    return updated;
  },

  async deleteVehicle(id: string): Promise<void> {
    await this.updateVehicle(id, { isDeleted: true });
    this.logAudit(`حذف سيارة من الأسطول: ${id}`, 'vehicles', id);
  },

  // -------------------------------------------------------------
  // Bookings & Double Booking Prevention (Critical)
  // -------------------------------------------------------------
  async getBookings(): Promise<Booking[]> {
    if (isFirebaseConfigured && db) {
      try {
        const col = collection(db, 'bookings');
        const q = query(col, where('isDeleted', '!=', true));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => d.data() as Booking);
        if (docs.length > 0) {
          return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      } catch (err) {
        console.warn('Firestore bookings error:', err);
      }
    }
    const bookings = getLocalItem<Booking[]>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    return bookings
      .filter(b => !b.isDeleted)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Validates if a vehicle is available for the given date range.
   * Prevents double bookings.
   * Condition for overlap:
   * existing.pickupDate <= requested.returnDate && existing.returnDate >= requested.pickupDate
   */
  async checkAvailability(
    vehicleId: string,
    pickupDate: string,
    returnDate: string,
    excludeBookingId?: string
  ): Promise<{ available: boolean; conflictReason?: string }> {
    const vehicle = await this.getVehicleById(vehicleId);
    if (!vehicle) {
      return { available: false, conflictReason: 'السيارة المطلوبة غير موجودة في الأسطول' };
    }
    if (vehicle.status === 'maintenance') {
      return { available: false, conflictReason: 'السيارة قيد الصيانة الدورية حالياً' };
    }
    if (vehicle.status === 'inactive') {
      return { available: false, conflictReason: 'السيارة خارج الخدمة مؤقتاً' };
    }

    const bookings = await this.getBookings();
    const activeBookings = bookings.filter(b =>
      b.vehicleId === vehicleId &&
      b.id !== excludeBookingId &&
      !['cancelled', 'rejected'].includes(b.status)
    );

    const hasOverlap = activeBookings.some(b => {
      return b.pickupDate <= returnDate && b.returnDate >= pickupDate;
    });

    if (hasOverlap) {
      return {
        available: false,
        conflictReason: 'عذراً، السيارة غير متاحة في الفترة المحددة. يرجى اختيار سيارة أو تاريخ آخر.'
      };
    }

    return { available: true };
  },

  /**
   * Generates a unique sequential booking number: SHK-2026-XXXXXX
   */
  async generateBookingNumber(): Promise<string> {
    const currentCounter = getLocalItem<number>(STORAGE_KEYS.BOOKING_COUNTER, 3);
    const nextNumber = currentCounter + 1;
    setLocalItem(STORAGE_KEYS.BOOKING_COUNTER, nextNumber);
    const formatted = `SHK-2026-${String(nextNumber).padStart(6, '0')}`;
    return formatted;
  },

  /**
   * Creates a booking with strict double-booking check
   */
  async createBooking(bookingData: {
    vehicleId: string;
    customerName: string;
    customerPhone: string;
    customerWhatsApp?: string;
    customerNationalId?: string;
    customerAddress?: string;
    customerLicenseNumber?: string;
    pickupDate: string;
    pickupTime: string;
    returnDate: string;
    returnTime: string;
    rentalDays: number;
    dailyPrice: number;
    basePrice: number;
    discountAmount: number;
    insuranceAmount: number;
    totalPrice: number;
    notes?: string;
  }): Promise<Booking> {
    // 1. Strict Overlap Check (Pre-flight validation)
    const availability = await this.checkAvailability(
      bookingData.vehicleId,
      bookingData.pickupDate,
      bookingData.returnDate
    );

    if (!availability.available) {
      throw new Error(availability.conflictReason || 'عذراً، السيارة غير متاحة في الفترة المحددة.');
    }

    const vehicle = await this.getVehicleById(bookingData.vehicleId);
    const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model} (${vehicle.year})` : 'سيارة شاكر';
    const vehicleCategory = vehicle?.category || 'medium';

    // 2. Generate unique booking number
    const bookingNumber = await this.generateBookingNumber();
    const id = `book-${Date.now()}`;

    const newBooking: Booking = {
      ...bookingData,
      id,
      bookingNumber,
      vehicleName,
      vehicleCategory,
      customerWhatsApp: bookingData.customerWhatsApp || bookingData.customerPhone,
      paidAmount: 0,
      remainingAmount: bookingData.totalPrice,
      status: 'new',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Concurrency Protection: Atomic Firestore Transaction
    if (isFirebaseConfigured && db) {
      try {
        await runTransaction(db, async (transaction) => {
          const bookingsCol = collection(db, 'bookings');
          const q = query(bookingsCol, where('vehicleId', '==', bookingData.vehicleId));
          const snap = await getDocs(q);
          const hasConflict = snap.docs.some(docSnap => {
            const b = docSnap.data() as Booking;
            if (b.isDeleted || ['cancelled', 'rejected'].includes(b.status)) return false;
            return b.pickupDate <= bookingData.returnDate && b.returnDate >= bookingData.pickupDate;
          });

          if (hasConflict) {
            throw new Error('عذراً، السيارة غير متاحة في الفترة المحددة.');
          }

          const bookingRef = doc(db, 'bookings', id);
          transaction.set(bookingRef, newBooking);
        });
      } catch (err: any) {
        if (err.message && (err.message.includes('غير متاحة') || err.message.includes('الفترة المحددة'))) {
          throw new Error('عذراً، السيارة غير متاحة في الفترة المحددة.');
        }
        handleFirestoreError('bookings', id, 'transaction', err, auth?.currentUser?.uid);
      }
    }

    // 4. Save to local storage cache
    const currentBookings = getLocalItem<Booking[]>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    setLocalItem(STORAGE_KEYS.BOOKINGS, [newBooking, ...currentBookings]);

    // 5. Update or create Customer CRM profile
    await this.syncCustomerFromBooking(newBooking);

    // 6. Fire notification
    this.addNotification({
      type: 'new_booking',
      title: 'طلب حجز إلكتروني جديد',
      message: `حجز جديد برقم ${bookingNumber} للعميل ${newBooking.customerName} على ${vehicleName}`,
      bookingId: id,
      vehicleId: bookingData.vehicleId,
    });

    this.logAudit(`إنشاء حجز جديد: ${bookingNumber}`, 'bookings', id);
    return newBooking;
  },

  async updateBookingStatus(id: string, newStatus: BookingStatus): Promise<Booking> {
    const bookings = getLocalItem<Booking[]>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    const index = bookings.findIndex(b => b.id === id);
    if (index === -1) throw new Error('الحجز غير موجود');

    const targetBooking = bookings[index];

    // Concurrency guard: If confirming or renting, re-verify availability
    if (['confirmed', 'rented'].includes(newStatus)) {
      const avail = await this.checkAvailability(
        targetBooking.vehicleId,
        targetBooking.pickupDate,
        targetBooking.returnDate,
        targetBooking.id
      );
      if (!avail.available) {
        throw new Error('عذراً، السيارة غير متاحة في الفترة المحددة.');
      }
    }

    const prevStatus = targetBooking.status;
    const updated: Booking = {
      ...targetBooking,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    bookings[index] = updated;
    setLocalItem(STORAGE_KEYS.BOOKINGS, bookings);

    // If status became rented, update vehicle status to rented
    if (newStatus === 'rented') {
      await this.updateVehicle(updated.vehicleId, { status: 'rented' });
    } else if (newStatus === 'completed' || newStatus === 'cancelled' || newStatus === 'rejected') {
      await this.updateVehicle(updated.vehicleId, { status: 'available' });
    }

    // Add status notification
    let notifTitle = 'تحديث حالة الحجز';
    let notifMsg = `تم تغيير حالة الحجز ${updated.bookingNumber} إلى: ${this.getStatusLabel(newStatus)}`;
    if (newStatus === 'confirmed') {
      notifTitle = 'تم تأكيد حجزك بنجاح';
      notifMsg = `تم تأكيد حجز السيارة ${updated.vehicleName} برقم ${updated.bookingNumber}.`;
    } else if (newStatus === 'cancelled') {
      notifTitle = 'تم إلغاء الحجز';
    }

    this.addNotification({
      type: newStatus === 'confirmed' ? 'booking_confirmed' : (newStatus === 'cancelled' ? 'booking_cancelled' : 'new_booking'),
      title: notifTitle,
      message: notifMsg,
      bookingId: id,
      vehicleId: updated.vehicleId,
    });

    this.logAudit(`تعديل حالة الحجز ${updated.bookingNumber} من ${prevStatus} إلى ${newStatus}`, 'bookings', id);

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'bookings', id), { status: newStatus, updatedAt: new Date().toISOString() });
      } catch (err) {
        handleFirestoreError('bookings', id, 'update', err, auth?.currentUser?.uid);
      }
    }

    return updated;
  },

  // -------------------------------------------------------------
  // Payments
  // -------------------------------------------------------------
  async recordPayment(paymentData: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const id = `pay-${Date.now()}`;
    const newPayment: Payment = {
      ...paymentData,
      id,
      createdAt: new Date().toISOString(),
    };

    // Update booking paid/remaining amounts
    const bookings = getLocalItem<Booking[]>(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
    const booking = bookings.find(b => b.id === paymentData.bookingId);
    if (booking) {
      booking.paidAmount = (booking.paidAmount || 0) + paymentData.amount;
      booking.remainingAmount = Math.max(0, booking.totalPrice - booking.paidAmount);
      booking.updatedAt = new Date().toISOString();
      setLocalItem(STORAGE_KEYS.BOOKINGS, bookings);

      // Customer spending update
      const customers = getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
      const customer = customers.find(c => c.phone === booking.customerPhone);
      if (customer) {
        customer.totalSpending = (customer.totalSpending || 0) + paymentData.amount;
        setLocalItem(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    const currentPayments = getLocalItem<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
    setLocalItem(STORAGE_KEYS.PAYMENTS, [newPayment, ...currentPayments]);
    this.logAudit(`تسجيل دفعة مالية بقيمة ${newPayment.amount}$ للحجز ${paymentData.bookingId}`, 'payments', id);

    return newPayment;
  },

  async getPayments(): Promise<Payment[]> {
    return getLocalItem<Payment[]>(STORAGE_KEYS.PAYMENTS, []);
  },

  // -------------------------------------------------------------
  // Customers CRM
  // -------------------------------------------------------------
  async getCustomers(): Promise<Customer[]> {
    return getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  },

  async syncCustomerFromBooking(booking: Booking): Promise<Customer> {
    const customers = getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    let customer = customers.find(c => c.phone === booking.customerPhone);

    if (!customer) {
      customer = {
        id: `cust-${Date.now()}`,
        fullName: booking.customerName,
        phone: booking.customerPhone,
        whatsapp: booking.customerWhatsApp,
        nationalId: booking.customerNationalId || '',
        drivingLicense: booking.customerLicenseNumber || '',
        address: booking.customerAddress || '',
        totalRentals: 1,
        totalSpending: 0,
        createdAt: new Date().toISOString(),
      };
      customers.push(customer);
    } else {
      customer.totalRentals = (customer.totalRentals || 0) + 1;
      if (booking.customerNationalId && !customer.nationalId) customer.nationalId = booking.customerNationalId;
      if (booking.customerLicenseNumber && !customer.drivingLicense) customer.drivingLicense = booking.customerLicenseNumber;
      if (booking.customerAddress && !customer.address) customer.address = booking.customerAddress;
    }

    setLocalItem(STORAGE_KEYS.CUSTOMERS, customers);
    return customer;
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const customers = getLocalItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
    const index = customers.findIndex(c => c.id === id);
    if (index === -1) throw new Error('العميل غير موجود');

    const updated = {
      ...customers[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    customers[index] = updated;
    setLocalItem(STORAGE_KEYS.CUSTOMERS, customers);
    this.logAudit(`تعديل بيانات العميل: ${updated.fullName}`, 'customers', id);
    return updated;
  },

  // -------------------------------------------------------------
  // Rental Contracts
  // -------------------------------------------------------------
  async getContracts(): Promise<Contract[]> {
    return getLocalItem<Contract[]>(STORAGE_KEYS.CONTRACTS, []);
  },

  async generateContract(booking: Booking, vehicle: Vehicle): Promise<Contract> {
    const settings = await this.getSettings();
    const id = `cntr-${Date.now()}`;
    const contractNumber = `CNT-${booking.bookingNumber.replace('SHK-', '')}`;

    const newContract: Contract = {
      id,
      contractNumber,
      bookingId: booking.id,
      vehicleId: vehicle.id,
      customerId: booking.customerPhone,
      termsAndConditions: settings.rentalTerms,
      status: 'active',
      mileageAtPickup: vehicle.currentMileage,
      fuelAtPickup: 'full',
      createdAt: new Date().toISOString(),
    };

    const contracts = getLocalItem<Contract[]>(STORAGE_KEYS.CONTRACTS, []);
    setLocalItem(STORAGE_KEYS.CONTRACTS, [newContract, ...contracts]);
    this.logAudit(`توليد عقد إيجار برقم ${contractNumber}`, 'contracts', id);
    return newContract;
  },

  // -------------------------------------------------------------
  // Maintenance System (Oil change every 5,000 km rule)
  // -------------------------------------------------------------
  async getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
    return getLocalItem<MaintenanceRecord[]>(STORAGE_KEYS.MAINTENANCE, INITIAL_MAINTENANCE_RECORDS);
  },

  async addMaintenanceRecord(record: Omit<MaintenanceRecord, 'id' | 'createdAt'>): Promise<MaintenanceRecord> {
    const id = `maint-${Date.now()}`;
    const newRecord: MaintenanceRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };

    // If oil change, update vehicle mileage stats
    if (record.serviceType === 'oil_change') {
      const nextKm = record.mileage + 5000;
      newRecord.nextDueMileage = nextKm;
      await this.updateVehicle(record.vehicleId, {
        currentMileage: Math.max(record.mileage, record.mileage),
        lastOilChangeMileage: record.mileage,
      });
    }

    const records = getLocalItem<MaintenanceRecord[]>(STORAGE_KEYS.MAINTENANCE, INITIAL_MAINTENANCE_RECORDS);
    setLocalItem(STORAGE_KEYS.MAINTENANCE, [newRecord, ...records]);
    this.logAudit(`تسجيل عملية صيانة: ${record.serviceType} للسيارة ${record.vehicleId}`, 'maintenance', id);
    return newRecord;
  },

  async getVehiclesNeedingMaintenance(): Promise<Array<{ vehicle: Vehicle; kmSinceOil: number; isUrgent: boolean }>> {
    const vehicles = await this.getVehicles();
    const settings = await this.getSettings();
    const interval = settings.oilChangeIntervalKm || 5000;

    return vehicles
      .map(v => {
        const kmSinceOil = (v.currentMileage || 0) - (v.lastOilChangeMileage || 0);
        const isUrgent = kmSinceOil >= interval;
        const needsAttention = kmSinceOil >= interval - 500;
        return { vehicle: v, kmSinceOil, isUrgent, needsAttention };
      })
      .filter(item => item.needsAttention);
  },

  // -------------------------------------------------------------
  // Vehicle Inspection
  // -------------------------------------------------------------
  async getInspections(): Promise<VehicleInspection[]> {
    return getLocalItem<VehicleInspection[]>(STORAGE_KEYS.INSPECTIONS, []);
  },

  async recordInspection(inspection: Omit<VehicleInspection, 'id' | 'createdAt'>): Promise<VehicleInspection> {
    const id = `insp-${Date.now()}`;
    const newInspection: VehicleInspection = {
      ...inspection,
      id,
      createdAt: new Date().toISOString(),
    };

    const current = getLocalItem<VehicleInspection[]>(STORAGE_KEYS.INSPECTIONS, []);
    setLocalItem(STORAGE_KEYS.INSPECTIONS, [newInspection, ...current]);
    this.logAudit(`تسجيل فحص استلام/تسليم للسيارة ${inspection.vehicleId}`, 'inspections', id);
    return newInspection;
  },

  // -------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------
  getNotifications(): AppNotification[] {
    return getLocalItem<AppNotification[]>(STORAGE_KEYS.NOTIFICATIONS, [
      {
        id: 'notif-1',
        type: 'new_booking',
        title: 'طلب حجز جديد',
        message: 'تم استلام طلب حجز رقم SHK-2026-000001 بنجاح.',
        read: false,
        createdAt: new Date().toISOString(),
      }
    ]);
  },

  addNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) {
    const current = this.getNotifications();
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setLocalItem(STORAGE_KEYS.NOTIFICATIONS, [newNotif, ...current]);
  },

  markNotificationAsRead(id: string) {
    const current = this.getNotifications();
    const updated = current.map(n => n.id === id ? { ...n, read: true } : n);
    setLocalItem(STORAGE_KEYS.NOTIFICATIONS, updated);
  },

  // -------------------------------------------------------------
  // Audit Logs
  // -------------------------------------------------------------
  logAudit(action: string, entity: string, entityId: string, details?: string) {
    const current = getLocalItem<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
    const newLog: AuditLog = {
      id: `audit-${Date.now()}`,
      user: 'مدير النظام (admin)',
      action,
      entity,
      entityId,
      timestamp: new Date().toISOString(),
      details,
    };
    setLocalItem(STORAGE_KEYS.AUDIT, [newLog, ...current].slice(0, 100));
  },

  getAuditLogs(): AuditLog[] {
    return getLocalItem<AuditLog[]>(STORAGE_KEYS.AUDIT, []);
  },

  // Status helper
  getStatusLabel(status: BookingStatus): string {
    const labels: Record<BookingStatus, string> = {
      new: 'طلب جديد',
      reviewing: 'قيد المراجعة',
      confirmed: 'مؤكد',
      rented: 'جاري التأجير',
      completed: 'مكتمل',
      cancelled: 'ملغي',
      rejected: 'مرفوض',
    };
    return labels[status] || status;
  },

  // -------------------------------------------------------------
  // Firestore Users & Uploaded Files Management (Admin View)
  // -------------------------------------------------------------
  /**
   * جلب قائمة المستخدمين بالكامل من Firestore لعرضها في لوحة تحكم الإدارة
   */
  async getAllUsers(): Promise<FirestoreUser[]> {
    if (isFirebaseConfigured && db) {
      try {
        const usersCol = collection(db, 'users');
        const snap = await getDocs(usersCol);
        if (!snap.empty) {
          const users: FirestoreUser[] = [];
          for (const docSnap of snap.docs) {
            const data = docSnap.data() as Partial<FirestoreUser>;
            const uid = docSnap.id;

            // Fetch user's uploaded files count from subcollection
            let filesCount = data.uploadedFilesCount;
            if (filesCount === undefined) {
              try {
                const filesSubCol = collection(db, 'users', uid, 'files');
                const filesSnap = await getDocs(filesSubCol);
                filesCount = filesSnap.size;
              } catch {
                filesCount = 0;
              }
            }

            users.push({
              id: uid,
              uid: uid,
              email: data.email || 'user@example.com',
              displayName: data.displayName || data.email?.split('@')[0] || 'مستخدم',
              phone: data.phone || '',
              role: data.role || 'customer',
              createdAt: data.createdAt || new Date().toISOString(),
              uploadedFilesCount: filesCount,
            });
          }

          // Sort by createdAt descending (newest accounts first)
          users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return users;
        } else {
          // If Firestore users collection is currently empty, seed it with the initial users
          try {
            for (const user of INITIAL_FIRESTORE_USERS) {
              await setDoc(doc(db, 'users', user.id), {
                id: user.id,
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                phone: user.phone || '',
                role: user.role,
                createdAt: user.createdAt,
                uploadedFilesCount: user.uploadedFilesCount || 0,
              });

              // Seed files subcollection
              const userFiles = INITIAL_UPLOADED_FILES[user.id] || [];
              for (const file of userFiles) {
                await setDoc(doc(db, 'users', user.id, 'files', file.id), file);
                await setDoc(doc(db, 'files', file.id), file);
              }
            }
          } catch (seedErr) {
            console.warn('Could not auto-seed Firestore users:', seedErr);
          }
        }
      } catch (err) {
        console.warn('Firestore getAllUsers error, falling back to local store:', err);
      }
    }

    // Local storage fallback
    const localUsers = getLocalItem<FirestoreUser[]>(STORAGE_KEYS.USERS, INITIAL_FIRESTORE_USERS);
    const localFiles = getLocalItem<UploadedFile[]>(STORAGE_KEYS.FILES, []);

    // Update counts dynamically based on files in local store
    return localUsers.map((u) => {
      const userFiles = localFiles.filter((f) => f.userId === u.id || f.userId === u.uid);
      return {
        ...u,
        uploadedFilesCount: userFiles.length,
      };
    });
  },

  /**
   * دالة موازية لجلب جميع المستخدمين من Firestore
   */
  async getAllUsersFromFirestore(): Promise<FirestoreUser[]> {
    return this.getAllUsers();
  },

  /**
   * جلب الملفات والوثائق الخاصة بمستخدم معين باستخدام معرفه (userId)
   * تبحث في كل من المجلد الفرعي /users/{userId}/files وفي مجموعة /files الرئيسية
   */
  async getFilesForUser(userId: string): Promise<UploadedFile[]> {
    if (!userId || !userId.trim()) {
      return [];
    }

    const cleanUserId = userId.trim();
    const collectedFilesMap = new Map<string, UploadedFile>();

    if (isFirebaseConfigured && db) {
      try {
        // 1. Fetch from subcollection: /users/{userId}/files
        try {
          const filesSubCol = collection(db, 'users', cleanUserId, 'files');
          const subSnap = await getDocs(filesSubCol);
          subSnap.docs.forEach((d) => {
            const fileData = d.data() as UploadedFile;
            collectedFilesMap.set(d.id, {
              ...fileData,
              id: d.id,
              userId: fileData.userId || cleanUserId,
            });
          });
        } catch (subErr) {
          console.warn(`Could not fetch subcollection files for ${cleanUserId}:`, subErr);
        }

        // 2. Fetch from root files collection: /files where userId == cleanUserId
        try {
          const rootFilesCol = collection(db, 'files');
          const q = query(rootFilesCol, where('userId', '==', cleanUserId));
          const rootSnap = await getDocs(q);
          rootSnap.docs.forEach((d) => {
            const fileData = d.data() as UploadedFile;
            if (!collectedFilesMap.has(d.id)) {
              collectedFilesMap.set(d.id, {
                ...fileData,
                id: d.id,
                userId: fileData.userId || cleanUserId,
              });
            }
          });
        } catch (rootErr) {
          console.warn(`Could not query root files collection for ${cleanUserId}:`, rootErr);
        }

        if (collectedFilesMap.size > 0) {
          const filesArray = Array.from(collectedFilesMap.values());
          filesArray.sort(
            (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
          );
          return filesArray;
        }
      } catch (err) {
        console.warn(`Firestore getFilesForUser error for ${cleanUserId}:`, err);
      }
    }

    // 3. Fallback to local storage
    const allLocalFiles = getLocalItem<UploadedFile[]>(STORAGE_KEYS.FILES, []);
    const localMatching = allLocalFiles.filter(
      (f) => f.userId === cleanUserId || (f as any).uid === cleanUserId
    );

    if (localMatching.length > 0) {
      localMatching.sort(
        (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
      );
      return localMatching;
    }

    // 4. Fallback to initial preset files
    const preset = INITIAL_UPLOADED_FILES[cleanUserId] || [];
    return [...preset].sort(
      (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
    );
  },

  /**
   * الاسم البديل المتوافق لدالة جلب ملفات المستخدم
   */
  async getUserFiles(userId: string): Promise<UploadedFile[]> {
    return this.getFilesForUser(userId);
  },

  async uploadUserFile(fileData: Omit<UploadedFile, 'id' | 'uploadedAt'>): Promise<UploadedFile> {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newFile: UploadedFile = {
      ...fileData,
      id: fileId,
      uploadedAt: new Date().toISOString(),
    };

    if (isFirebaseConfigured && db) {
      try {
        // Store in subcollection
        await setDoc(doc(db, 'users', fileData.userId, 'files', fileId), newFile);
        // Store in root files collection for index access
        await setDoc(doc(db, 'files', fileId), newFile);

        // Update uploadedFilesCount on user doc
        try {
          const userDocRef = doc(db, 'users', fileData.userId);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const currentCount = (userSnap.data().uploadedFilesCount || 0) + 1;
            await updateDoc(userDocRef, { uploadedFilesCount: currentCount });
          }
        } catch (uErr) {
          console.warn('Error updating user file count in Firestore:', uErr);
        }
      } catch (err) {
        console.warn('Firestore uploadUserFile error, saving to local store:', err);
      }
    }

    // Update local storage
    const allFiles = getLocalItem<UploadedFile[]>(STORAGE_KEYS.FILES, []);
    const updatedFiles = [newFile, ...allFiles];
    setLocalItem(STORAGE_KEYS.FILES, updatedFiles);

    // Update user file count locally
    const allUsers = getLocalItem<FirestoreUser[]>(STORAGE_KEYS.USERS, INITIAL_FIRESTORE_USERS);
    const updatedUsers = allUsers.map((u) => {
      if (u.id === fileData.userId || u.uid === fileData.userId) {
        return {
          ...u,
          uploadedFilesCount: (u.uploadedFilesCount || 0) + 1,
        };
      }
      return u;
    });
    setLocalItem(STORAGE_KEYS.USERS, updatedUsers);

    return newFile;
  },

  async syncUserToFirestore(authUser: { uid: string; email: string; displayName: string; phone?: string; role: string; createdAt?: string }): Promise<void> {
    const firestoreUser: FirestoreUser = {
      id: authUser.uid,
      uid: authUser.uid,
      email: authUser.email,
      displayName: authUser.displayName,
      phone: authUser.phone || '',
      role: authUser.role as any,
      createdAt: authUser.createdAt || new Date().toISOString(),
      uploadedFilesCount: 0,
    };

    if (isFirebaseConfigured && db) {
      try {
        const userDocRef = doc(db, 'users', authUser.uid);
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          await setDoc(userDocRef, firestoreUser);
        }
      } catch (err) {
        console.warn('Firestore syncUserToFirestore error:', err);
      }
    }

    // Update local users
    const allUsers = getLocalItem<FirestoreUser[]>(STORAGE_KEYS.USERS, INITIAL_FIRESTORE_USERS);
    const exists = allUsers.some((u) => u.uid === authUser.uid || u.email.toLowerCase() === authUser.email.toLowerCase());
    if (!exists) {
      setLocalItem(STORAGE_KEYS.USERS, [firestoreUser, ...allUsers]);
    }
  },
};
