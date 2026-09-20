import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured, auth, db } from '../firebase/config';
import { dataService } from './dataService';
import { calculateRentalPrice, calculateRentalDays } from './pricing';
import { BookingStatus } from '../types';

export interface FunctionCallResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'live_cloud_function' | 'local_cloud_runtime' | 'local_demo_sandbox';
  executionTimeMs: number;
}

class FunctionsService {
  /**
   * Generic invoker that calls the live Cloud Function with httpsCallable
   * or falls back to simulated responses for auxiliary features (notifications, reports).
   */
  private async invoke<TInput, TOutput>(
    name: string,
    data: TInput,
    fallbackHandler: (input: TInput) => Promise<TOutput>
  ): Promise<FunctionCallResult<TOutput>> {
    const start = Date.now();

    if (isFirebaseConfigured && functions) {
      try {
        const callable = httpsCallable<TInput, TOutput>(functions, name);
        const res = await callable(data);
        return {
          success: true,
          data: res.data,
          source: 'live_cloud_function',
          executionTimeMs: Date.now() - start,
        };
      } catch (err: any) {
        console.error(`[Firebase Functions] Function "${name}" error:`, err?.message || err);
        return {
          success: false,
          error: err?.details || err?.message || `فشل تنفيذ العملية السحابية (${name}).`,
          source: 'live_cloud_function',
          executionTimeMs: Date.now() - start,
        };
      }
    }

    try {
      const simulatedData = await fallbackHandler(data);
      return {
        success: true,
        data: simulatedData,
        source: 'local_cloud_runtime',
        executionTimeMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Execution error in function',
        source: 'local_cloud_runtime',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  /**
   * 1. Function: sendBookingNotification
   * The client sends ONLY { bookingId } (or minimal identifiers).
   * Cloud Function ignores any client totalAmount, customerName, or status, and reads authoritative values from Firestore.
   */
  public async sendBookingNotification(params: {
    bookingId: string;
    // Optional fields for testing spoofing; the Cloud Function will ignore them
    customerName?: string;
    carName?: string;
    totalAmount?: number;
    status?: string;
  }): Promise<FunctionCallResult<{
    success: boolean;
    notificationId?: string;
    bookingId: string;
    bookingNumber?: string;
    customerName: string;
    vehicleName: string;
    status: string;
    statusLabel?: string;
    totalAmount: number;
    message: string;
  }>> {
    const start = Date.now();

    // 1. Live Server-Authoritative Cloud Function Execution
    if (isFirebaseConfigured && functions) {
      try {
        const callable = httpsCallable<{ bookingId: string; [key: string]: any }, any>(
          functions,
          'sendBookingNotification'
        );
        // We pass the payload (allowing spoofing test cases to send fake data to verify server-side rejection/cleansing)
        const payload = params.customerName !== undefined || params.totalAmount !== undefined || params.status !== undefined
          ? params
          : { bookingId: params.bookingId };

        const res = await callable(payload);

        if (res.data && res.data.success) {
          return {
            success: true,
            data: res.data,
            source: 'live_cloud_function',
            executionTimeMs: Date.now() - start,
          };
        }
        return {
          success: false,
          error: res.data?.error || 'فشل إرسال الإشعار عبر الخادم السحابي.',
          source: 'live_cloud_function',
          executionTimeMs: Date.now() - start,
        };
      } catch (err: any) {
        console.error('[Firebase Functions] Live sendBookingNotification error:', err);
        const errorMsg = err?.details || err?.message || 'عذراً، تعذر إرسال الإشعار.';
        return {
          success: false,
          error: errorMsg,
          source: 'live_cloud_function',
          executionTimeMs: Date.now() - start,
        };
      }
    }

    // 2. Local Demo Sandbox (Only when offline / Firebase unconfigured)
    try {
      const booking = await dataService.getBookingById(params.bookingId);
      if (!booking) {
        return {
          success: false,
          error: 'الحجز المطلوب غير موجود في النظام التجريبي.',
          source: 'local_demo_sandbox',
          executionTimeMs: Date.now() - start,
        };
      }

      const vehicle = await dataService.getVehicleById(booking.vehicleId);
      const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model}` : (booking.vehicleName || 'مركبة');
      const customerName = booking.customerName || 'عميل';
      const totalAmount = booking.totalPrice || 0;
      const status = booking.status || 'new';

      return {
        success: true,
        data: {
          success: true,
          notificationId: 'notif-demo-' + Date.now().toString().slice(-4),
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          customerName,
          vehicleName,
          status,
          totalAmount,
          message: `تم إرسال إشعار الحجز #${booking.bookingNumber} للعميل ${customerName} بمبلغ ${totalAmount}$ وحالة (${status}) بنجاح (بيانات موثوقة).`,
        },
        source: 'local_demo_sandbox',
        executionTimeMs: Date.now() - start,
      };
    } catch (fallbackErr: any) {
      return {
        success: false,
        error: fallbackErr?.message || 'خطأ في معالجة الإشعار.',
        source: 'local_demo_sandbox',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  /**
   * 2. Function: generateRentalContractPdf
   */
  public async generateRentalContractPdf(params: {
    contractNumber: string;
    customerName: string;
    carPlate: string;
    carModel: string;
    startDate: string;
    endDate: string;
    totalPrice: number;
  }): Promise<FunctionCallResult<{ pdfUrl: string; generatedAt: string; documentHash: string }>> {
    return this.invoke('generateRentalContractPdf', params, async (input) => {
      await new Promise((r) => setTimeout(r, 400));
      const fakeHash = 'SHA256:' + Math.random().toString(36).substring(2, 10).toUpperCase();
      return {
        pdfUrl: `https://shaker-rentalcars.firebaseapp.com/contracts/${input.contractNumber}.pdf`,
        generatedAt: new Date().toISOString(),
        documentHash: fakeHash,
        documentTitle: `عقد إيجار رقم ${input.contractNumber} - ${input.carModel}`,
      };
    });
  }

  /**
   * 3. Function: calculateDynamicPricing
   */
  public async calculateDynamicPricing(params: {
    baseDailyRate: number;
    days: number;
    insuranceTier: 'basic' | 'standard' | 'full';
    hasDriver?: boolean;
    seasonMultiplier?: number;
  }): Promise<FunctionCallResult<{ subtotal: number; discount: number; insuranceCost: number; finalTotal: number }>> {
    return this.invoke('calculateDynamicPricing', params, async (input) => {
      await new Promise((r) => setTimeout(r, 150));
      const rawSubtotal = input.baseDailyRate * input.days;
      let discountRate = 0;
      if (input.days >= 30) discountRate = 0.25;
      else if (input.days >= 7) discountRate = 0.15;
      else if (input.days >= 3) discountRate = 0.05;

      const discount = Math.round(rawSubtotal * discountRate);
      const insurancePerDay = input.insuranceTier === 'full' ? 25 : input.insuranceTier === 'standard' ? 15 : 0;
      const insuranceCost = insurancePerDay * input.days;
      const driverCost = input.hasDriver ? 40 * input.days : 0;
      const finalTotal = rawSubtotal - discount + insuranceCost + driverCost;

      return {
        subtotal: rawSubtotal,
        discount,
        insuranceCost,
        finalTotal,
      };
    });
  }

  /**
   * 4. Function: verifyCustomerIdentity
   * Validates customer document and Syrian identity format.
   * Enforces server-authoritative manual review & prevents automated 'verified' identity claims.
   */
  public async verifyCustomerIdentity(params: {
    userId?: string;
    targetUserId?: string;
    action?: 'set_status' | 'review_decision' | string;
    status?: 'pending' | 'manual_review' | 'verified' | 'rejected';
    documentType?: string;
    fileUrl?: string;
    nationalId?: string;
    phone?: string;
    notes?: string;
  }): Promise<FunctionCallResult<{
    verified: boolean;
    formatValid?: boolean;
    verificationStatus?: 'pending' | 'manual_review' | 'verified' | 'rejected';
    requiresManualReview?: boolean;
    confidenceScore?: number;
    verifiedAt?: string;
    verifiedBy?: string;
    targetUserId?: string;
    remarks?: string;
    message?: string;
    details?: any;
  }>> {
    return this.invoke('verifyCustomerIdentity', params, async (input) => {
      await new Promise((r) => setTimeout(r, 400));
      // Administrative decision
      if (input.action === 'set_status' || input.action === 'review_decision') {
        const isVerified = input.status === 'verified';
        const nowIso = new Date().toISOString();
        return {
          verified: isVerified,
          formatValid: true,
          verificationStatus: input.status || 'manual_review',
          requiresManualReview: false,
          verifiedAt: isVerified ? nowIso : undefined,
          targetUserId: input.targetUserId || input.userId,
          message: `تم تحديث حالة التحقق للعميل إلى [${input.status}] بنجاح واعتمادها في السجل السحابي.`,
          remarks: `تم تسجيل القرار الإداري بحالة (${input.status}).`,
        };
      }

      // Format validation / document intake fallback:
      // SECURITY MANDATE: Format validation or upload NEVER marks identity as verified!
      return {
        verified: false,
        formatValid: true,
        verificationStatus: 'manual_review',
        requiresManualReview: true,
        confidenceScore: 0.95,
        verifiedAt: undefined,
        documentType: input.documentType,
        message: 'تم فحص صيغة البيانات والمستندات بنجاح. الطلب الآن قيد التدقيق الإداري اليدوي (Manual Review) من قبل فريق العمل. لا يُعتبر الحساب موثقاً حتى اعتماده رسمياً.',
        remarks: 'تم التحقق من سلامة صيغة الوثيقة بنجاح، وتحويلها للمراجعة والتدقيق الإداري اليدوي (Manual Review). لا تعتبر الهوية موثقة آلياً.',
      };
    });
  }

  /**
   * 5. Function: syncFleetMaintenance
   */
  public async syncFleetMaintenance(params: {
    vehicleId: string;
    currentMileage: number;
  }): Promise<FunctionCallResult<{ status: 'ok' | 'due_soon' | 'overdue'; nextServiceKm: number }>> {
    return this.invoke('syncFleetMaintenance', params, async (input) => {
      await new Promise((r) => setTimeout(r, 200));
      const nextKm = Math.ceil(input.currentMileage / 5000) * 5000;
      const diff = nextKm - input.currentMileage;
      const status = diff < 500 ? 'overdue' : diff < 1500 ? 'due_soon' : 'ok';

      return {
        status,
        nextServiceKm: nextKm,
        kilometersRemaining: diff,
      };
    });
  }

  /**
   * 6. Function: createBookingSecure
   * Server-authoritative booking creation via Cloud Functions.
   * Enforces authentication, double-booking prevention, dynamic pricing, and sequential numbering.
   * If Cloud Function fails, errors are returned directly to prevent client-side bypass.
   */
  public async createBookingSecure(params: {
    vehicleId: string;
    customerName: string;
    customerPhone: string;
    customerWhatsApp?: string;
    customerNationalId?: string;
    customerAddress?: string;
    customerLicenseNumber?: string;
    pickupDate: string;
    pickupTime?: string;
    returnDate: string;
    returnTime?: string;
    notes?: string;
    withDriver?: boolean;
    deliveryLocation?: string;
  }): Promise<FunctionCallResult<{
    success: boolean;
    bookingId: string;
    bookingNumber: string;
    booking: any;
    message: string;
  }>> {
    const start = Date.now();

    // 1. Live Server-Authoritative Cloud Function Execution
    if (isFirebaseConfigured && functions) {
      try {
        const callable = httpsCallable<typeof params, any>(functions, 'createBookingSecure');
        const res = await callable(params);

        if (res.data && res.data.success) {
          return {
            success: true,
            data: res.data,
            source: 'live_cloud_function',
            executionTimeMs: Date.now() - start,
          };
        }
        if (res.data?.error) {
          return {
            success: false,
            error: res.data.error,
            source: 'live_cloud_function',
            executionTimeMs: Date.now() - start,
          };
        }
      } catch (err: any) {
        console.warn('[Firebase Functions] Live createBookingSecure dispatch note:', err);

        // Explicit business rules rejections must be shown to the user immediately
        const isExplicitBusinessRejection =
          err?.code === 'already-exists' ||
          err?.code === 'invalid-argument' ||
          err?.code === 'permission-denied' ||
          err?.code === 'unauthenticated' ||
          String(err?.message || '').includes('محجوزة مسبقاً') ||
          String(err?.message || '').includes('غير متاحة');

        if (isExplicitBusinessRejection) {
          const errorMsg = err?.details || err?.message || 'عذراً، تعذر إتمام الحجز.';
          return {
            success: false,
            error: errorMsg,
            source: 'live_cloud_function',
            executionTimeMs: Date.now() - start,
          };
        }

        return {
          success: false,
          error: err?.details || err?.message || 'عذراً، تعذر إتمام الحجز عبر الخادم الآمن.',
          source: 'live_cloud_function',
          executionTimeMs: Date.now() - start,
        };
      }
    }

    // 2. Offline Local Demo Sandbox (ONLY when Firebase is unconfigured or offline demo mode)
    try {
      const days = calculateRentalDays(params.pickupDate, params.returnDate);
      const vehicle = await dataService.getVehicleById(params.vehicleId);
      if (!vehicle) {
        throw new Error('السيارة المطلوبة غير موجودة في الأسطول.');
      }

      const settings = await dataService.getSettings();
      const pricing = calculateRentalPrice(
        vehicle.category,
        vehicle.dailyPrice,
        days,
        settings,
        {
          isUserLoggedIn: Boolean(auth?.currentUser?.uid),
          vehicleId: vehicle.id,
        }
      );

      const booking = await dataService.createBookingLocalDemo({
        vehicleId: params.vehicleId,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        customerWhatsApp: params.customerWhatsApp || params.customerPhone,
        customerNationalId: params.customerNationalId,
        customerAddress: params.customerAddress,
        customerLicenseNumber: params.customerLicenseNumber,
        customerId: auth?.currentUser?.uid || 'demo-user',
        customerEmail: auth?.currentUser?.email || undefined,
        pickupDate: params.pickupDate,
        pickupTime: params.pickupTime || '10:00',
        returnDate: params.returnDate,
        returnTime: params.returnTime || '10:00',
        rentalDays: pricing.rentalDays,
        dailyPrice: pricing.dailyPrice,
        basePrice: pricing.basePrice,
        discountAmount: pricing.discountAmount,
        insuranceAmount: pricing.insuranceAmount,
        totalPrice: pricing.totalPrice,
        notes: params.notes,
      });

      return {
        success: true,
        data: {
          success: true,
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          booking,
          message: 'تم تسجيل الحجز بنجاح (وضع العرض التجريبي المحلي).',
        },
        source: 'local_demo_sandbox',
        executionTimeMs: Date.now() - start,
      };
    } catch (fallbackErr: any) {
      console.error('[Booking Engine] Error creating booking in local demo:', fallbackErr);
      return {
        success: false,
        error: fallbackErr?.message || 'عذراً، تعذر إتمام الحجز.',
        source: 'local_demo_sandbox',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  /**
   * 7. Function: updateBookingStatusSecure
   * Enforces server-side authority for booking status changes (confirmed, rented, completed, cancelled).
   * Validates permissions and prevents status tampering.
   */
  public async updateBookingStatusSecure(params: {
    bookingId: string;
    bookingNumber?: string;
    status: BookingStatus;
  }): Promise<FunctionCallResult<{
    success: boolean;
    bookingId: string;
    oldStatus: string;
    newStatus: string;
    message: string;
  }>> {
    const start = Date.now();
    const primaryId = String(params.bookingId || '').trim();
    const secondaryNum = String(params.bookingNumber || '').trim();

    if (isFirebaseConfigured && functions) {
      // Step 1: Call live Cloud Function with primary identifier
      try {
        const callable = httpsCallable<typeof params, any>(functions, 'updateBookingStatusSecure');
        const res = await callable(params);

        if (res.data && res.data.success) {
          try {
            await dataService.updateBookingStatus(res.data.bookingId || primaryId, params.status);
          } catch (syncErr) {
            console.warn('Local cache sync after Cloud Function note:', syncErr);
          }

          return {
            success: true,
            data: res.data,
            source: 'live_cloud_function',
            executionTimeMs: Date.now() - start,
          };
        }
      } catch (firstErr: any) {
        const isNotFound =
          firstErr?.code === 'not-found' ||
          String(firstErr?.message || '').includes('not-found') ||
          String(firstErr?.message || '').includes('الحجز المطلوب غير موجود') ||
          String(firstErr?.details || '').includes('الحجز المطلوب غير موجود') ||
          String(firstErr?.message || '').includes('404');

        // Step 2: If document not found and secondary number exists, retry Cloud Function with inverted identifier
        if (isNotFound && secondaryNum && secondaryNum !== primaryId) {
          try {
            const callable = httpsCallable<typeof params, any>(functions, 'updateBookingStatusSecure');
            const res2 = await callable({
              bookingId: secondaryNum,
              bookingNumber: primaryId,
              status: params.status,
            });

            if (res2.data && res2.data.success) {
              try {
                await dataService.updateBookingStatus(res2.data.bookingId || secondaryNum, params.status);
              } catch (syncErr) {
                console.warn('Local cache sync after Cloud Function retry note:', syncErr);
              }

              return {
                success: true,
                data: res2.data,
                source: 'live_cloud_function',
                executionTimeMs: Date.now() - start,
              };
            }
          } catch (secondErr: any) {
            console.warn('[Firebase Functions] Secondary identifier lookup note:', secondErr?.message || secondErr);
          }
        }

        // Security check: If the error is an authorization or permission failure, DO NOT bypass.
        const isAuthOrPermission =
          firstErr?.code === 'permission-denied' ||
          firstErr?.code === 'unauthenticated' ||
          String(firstErr?.message || '').includes('permission-denied') ||
          String(firstErr?.message || '').includes('unauthenticated') ||
          String(firstErr?.message || '').includes('غير مصرح') ||
          String(firstErr?.message || '').includes('تسجيل الدخول مطلوب');

        if (isAuthOrPermission) {
          console.warn('[Firebase Functions] updateBookingStatusSecure authorization rejection:', firstErr);
          return {
            success: false,
            error: firstErr?.details || firstErr?.message || 'غير مصرح لك بتحديث حالة هذا الحجز.',
            source: 'live_cloud_function',
            executionTimeMs: Date.now() - start,
          };
        }

        return {
          success: false,
          error: firstErr?.details || firstErr?.message || 'تعذر العثور على الحجز على الخادم. يرجى تحديث الصفحة والمحاولة مرة أخرى، أو التواصل مع الدعم الفني إن استمرت المشكلة.',
          source: 'live_cloud_function',
          executionTimeMs: Date.now() - start,
        };
      }
    }

    // Local demo fallback (offline mode)
    const updated = await dataService.updateBookingStatus(primaryId || secondaryNum, params.status);
    return {
      success: true,
      data: {
        success: true,
        bookingId: updated?.id || primaryId,
        oldStatus: '',
        newStatus: updated?.status || params.status,
        message: 'تم تحديث حالة الحجز (عرض تجريبي محلي).',
      },
      source: 'local_demo_sandbox',
      executionTimeMs: Date.now() - start,
    };
  }

  /**
   * 8. Function: setUserRole
   * Calls the server-side Cloud Function to update Firebase Auth Custom Claims.
   * Modifying roles is strictly restricted to Admins server-side.
   */
  async setUserRole(
    targetUid: string,
    newRole: 'customer' | 'employee' | 'admin'
  ): Promise<FunctionCallResult<{ success: boolean; targetUid: string; newRole: string; message: string }>> {
    return this.invoke(
      'setUserRole',
      { targetUid, newRole },
      async () => {
        // Fallback only when Firebase Functions are unavailable (e.g. offline demo)
        return {
          success: true,
          targetUid,
          newRole,
          message: `تم تحديث الصلاحية بنجاح إلى "${newRole}".`,
        };
      }
    );
  }

  /**
   * 9. Function: syncMyRole
   * Contacts the server to refresh or bootstrap Firebase Auth Custom Claims.
   */
  async syncMyRole(): Promise<FunctionCallResult<{ success: boolean; role: string; alreadyMinted?: boolean }>> {
    return this.invoke(
      'syncMyRole',
      {},
      async () => {
        return {
          success: true,
          role: 'customer',
          alreadyMinted: true,
        };
      }
    );
  }

  /**
   * 10. Function: bootstrapInitialAdmin
   * Contacts the server to securely initialize the first system admin using an administrative secret.
   * Can only succeed ONCE in the lifetime of the system.
   */
  async bootstrapInitialAdmin(
    bootstrapSecret: string
  ): Promise<FunctionCallResult<{ success: boolean; adminUid?: string; message: string }>> {
    return this.invoke(
      'bootstrapInitialAdmin',
      { bootstrapSecret },
      async () => {
        return {
          success: false,
          message: 'يتطلب بيئة Firebase نشطة لتنفيذ عملية التهيئة الأولية.',
        };
      }
    );
  }

  /**
   * 11. Function: toggleUserAccountStatus
   * Calls the server-side Cloud Function to disable or enable a user account.
   */
  async toggleUserAccountStatus(
    targetUid: string,
    disabled: boolean
  ): Promise<FunctionCallResult<{ success: boolean; disabled: boolean; targetUid: string }>> {
    return this.invoke(
      'toggleUserAccountStatus',
      { targetUid, disabled },
      async () => {
        return {
          success: true,
          disabled,
          targetUid,
        };
      }
    );
  }

  /**
   * 12. Function: deleteUserAccount
   * Calls the server-side Cloud Function to permanently delete a user account from Auth and Firestore.
   * Super Admin only.
   */
  async deleteUserAccount(
    targetUid: string
  ): Promise<FunctionCallResult<{ success: boolean; targetUid?: string }>> {
    return this.invoke(
      'deleteUserAccount',
      { targetUid },
      async () => {
        return {
          success: true,
          targetUid,
        };
      }
    );
  }

  /**
   * 13. Function: checkLoginAllowed
   * Checks whether the user's email is temporarily locked due to repeated failed logins.
   */
  async checkLoginAllowed(email: string): Promise<FunctionCallResult<{ allowed: boolean }>> {
    return this.invoke(
      'checkLoginAllowed',
      { email },
      async () => ({ allowed: true })
    );
  }

  /**
   * 14. Function: recordFailedLogin
   * Increments failed attempt count server-side in rateLimits/{email_key}.
   */
  async recordFailedLogin(
    email: string
  ): Promise<FunctionCallResult<{ success: boolean; attempts?: number; locked?: boolean; waitSeconds?: number }>> {
    return this.invoke(
      'recordFailedLogin',
      { email },
      async () => ({ success: true, attempts: 1, locked: false, waitSeconds: 0 })
    );
  }

  /**
   * 15. Function: resetLoginAttempts
   * Clears failed attempt tracking upon successful authentication.
   */
  async resetLoginAttempts(email: string): Promise<FunctionCallResult<{ success: boolean }>> {
    return this.invoke(
      'resetLoginAttempts',
      { email },
      async () => ({ success: true })
    );
  }
}

export const functionsService = new FunctionsService();
