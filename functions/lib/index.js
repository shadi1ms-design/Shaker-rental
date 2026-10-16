"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramWebhook = exports.sendTelegramBookingAlert = exports.validateUploadedFileSignature = exports.enforceLoginLockout = exports.resetLoginAttempts = exports.recordFailedLogin = exports.checkLoginAllowed = exports.deleteUserAccount = exports.toggleUserAccountStatus = exports.syncMyRole = exports.bootstrapInitialAdmin = exports.setUserRole = exports.cleanupSeedData = exports.checkMaintenanceAndRentals = exports.syncFleetMaintenance = exports.verifyCustomerIdentity = exports.calculateDynamicPricing = exports.generateRentalContractPdf = exports.sendBookingNotification = exports.updateBookingStatusSecure = exports.createBookingSecure = exports.ALLOWED_TRANSITIONS = void 0;
exports.applyBookingStatusChange = applyBookingStatusChange;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const identity_1 = require("firebase-functions/v2/identity");
const constants_1 = require("./constants");
admin.initializeApp();
const db = (0, firestore_1.getFirestore)(admin.app(), 'ai-studio-shakercarrental-8ca1f5c8-9251-4c7d-b28c-5a1ee6a1a1e1');
// Pinned region: asia-south1 (matches frontend getFunctions config and Firestore DB region)
const FUNCTION_REGION = 'asia-south1';
/**
 * Server-Side Pricing Engine
 * Computes base price, dynamic member discount, insurance, and final total securely.
 */
function calculateRentalPriceServer(dailyPrice, days, settings, isUserLoggedIn, vehicleId) {
    const rentalDays = Math.max(1, Math.round(days));
    const rawBase = rentalDays * dailyPrice;
    let memberDiscountAmount = 0;
    const discountCfg = settings?.discountConfig;
    if (discountCfg && discountCfg.enabled) {
        const rawPct = Number(discountCfg.percentage) || 0;
        const safePercentage = Math.min(25, Math.max(1, Math.round(rawPct)));
        const isVehicleMatched = discountCfg.scope === 'all' ||
            !discountCfg.vehicleIds ||
            discountCfg.vehicleIds.length === 0 ||
            (vehicleId ? discountCfg.vehicleIds.includes(vehicleId) : true);
        if (isVehicleMatched && safePercentage > 0 && isUserLoggedIn) {
            memberDiscountAmount = Math.round(rawBase * (safePercentage / 100));
        }
    }
    const finalSubtotal = Math.max(0, rawBase - memberDiscountAmount);
    const insuranceAmount = rentalDays <= 2
        ? Number(settings?.insuranceShortTerm ?? settings?.insurance1to2Days ?? 500)
        : Number(settings?.insuranceLongTerm ?? settings?.insuranceAbove2Days ?? 300);
    const totalPrice = finalSubtotal + insuranceAmount;
    return {
        rentalDays,
        dailyPrice,
        basePrice: rawBase,
        discountAmount: memberDiscountAmount,
        insuranceAmount,
        totalPrice,
    };
}
/**
 * Helper to check if caller is staff (employee, admin, or superAdmin) via Firebase Auth Custom Claims.
 * Firebase Authentication Custom Claims is the primary server-side source of truth.
 */
function isCallerStaff(authOrToken) {
    const token = authOrToken?.token || authOrToken;
    if (!token || typeof token !== 'object')
        return false;
    const role = typeof token.role === 'string' ? token.role.toLowerCase() : '';
    if (['super_admin', 'superadmin', 'admin', 'employee', 'staff', 'manager', 'owner'].includes(role)) {
        return true;
    }
    return token.super_admin === true || token.superAdmin === true || token.admin === true || token.employee === true || token.staff === true;
}
/**
 * Async helper for staff verification relying exclusively on Firebase Auth Custom Claims.
 */
async function isCallerStaffAsync(callerUid, token) {
    return isCallerStaff(token);
}
/**
 * Helper to check if caller is an admin or superAdmin via Firebase Auth Custom Claims.
 */
function isCallerAdmin(authOrToken) {
    const token = authOrToken?.token || authOrToken;
    if (!token || typeof token !== 'object')
        return false;
    const role = typeof token.role === 'string' ? token.role.toLowerCase() : '';
    if (['super_admin', 'superadmin', 'admin', 'owner'].includes(role)) {
        return true;
    }
    return token.super_admin === true || token.superAdmin === true || token.admin === true;
}
/**
 * Helper to check if caller is specifically a Super Admin via Firebase Auth Custom Claims.
 */
function isCallerSuperAdmin(authOrToken) {
    const token = authOrToken?.token || authOrToken;
    if (!token || typeof token !== 'object')
        return false;
    const role = typeof token.role === 'string' ? token.role.toLowerCase() : '';
    if (['super_admin', 'superadmin', 'owner'].includes(role)) {
        return true;
    }
    return token.super_admin === true || token.superAdmin === true || token.owner === true;
}
/**
 * Resolves a vehicle document reference directly from Firestore collection 'vehicles'.
 * Returns null if the vehicle does not exist in Firestore (no auto-seeding or fuzzy match).
 */
async function resolveVehicleDocument(rawVehicleId) {
    const cleanId = String(rawVehicleId || '').trim();
    if (!cleanId)
        return null;
    try {
        const directRef = db.collection('vehicles').doc(cleanId);
        const directSnap = await directRef.get();
        if (directSnap.exists) {
            return { ref: directRef, data: directSnap.data() };
        }
    }
    catch (err) {
        console.warn('Error fetching vehicle doc:', err);
    }
    return null;
}
/**
 * Resolves a booking document reference directly from the canonical 'bookings' collection.
 * Looks up directly by Document ID. Returns null if not found (no legacy table lookups or auto-backfill).
 */
async function resolveBookingDocument(rawIdOrNumber, _secondaryNumber) {
    const cleanId = String(rawIdOrNumber || '').trim();
    if (!cleanId)
        return null;
    try {
        const directRef = db.collection('bookings').doc(cleanId);
        const directSnap = await directRef.get();
        if (directSnap.exists)
            return directRef;
    }
    catch (err) {
        console.warn('Error reading booking doc:', err);
    }
    return null;
}
/**
 * Robust string sanitization to eliminate script tags, control chars, and HTML injection
 */
function sanitizeString(input, maxLen = 100) {
    if (typeof input !== 'string')
        return '';
    return input
        .replace(/[<>'"&;`\\]/g, '') // strip potential injection characters
        .replace(/[\r\n\t]+/g, ' ') // normalize whitespaces
        .trim()
        .slice(0, maxLen);
}
/**
 * Booking Lifecycle State Machine: Strict allowed transitions.
 * Terminal states (completed, cancelled, rejected) permit no further transitions.
 */
exports.ALLOWED_TRANSITIONS = {
    new: ['confirmed', 'rejected'],
    reviewing: ['confirmed', 'rejected'],
    confirmed: ['rented', 'cancelled'],
    rented: ['completed'],
    completed: [],
    cancelled: [],
    rejected: [],
};
/**
 * 1. Cloud Function: createBookingSecure (region: asia-south1)
 * Enforces:
 * - Strict authentication & context.auth.uid ownership
 * - Prevention of User ID spoofing & ownership bypass
 * - Date boundary & logical validation (startDate < endDate, valid YYYY-MM-DD, reasonable duration)
 * - Server-authoritative pricing (ignoring all client prices)
 * - Double booking prevention via Firestore Transaction & Vehicle Atomic Lock
 * - Sequential number generation
 * - Minimal client data requirement
 */
exports.createBookingSecure = functions
    .region(FUNCTION_REGION)
    .https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول قبل إنشاء الحجز.');
    }
    const callerUid = context.auth.uid;
    const isStaff = isCallerStaff(context.auth?.token);
    let customerId = callerUid;
    let customerEmail = (context.auth.token?.email || '').toLowerCase().trim();
    if (data?.customerId && data.customerId !== callerUid) {
        if (!isStaff) {
            throw new functions.https.HttpsError('permission-denied', 'محاولة تزوير هوية المستخدم مرفوضة (User ID Spoofing Rejected). لا يمكنك الحجز باسم حساب آخر.');
        }
        customerId = String(data.customerId).trim();
        if (data.customerEmail)
            customerEmail = String(data.customerEmail).toLowerCase().trim();
    }
    if (data?.userId && data.userId !== callerUid && !isStaff) {
        throw new functions.https.HttpsError('permission-denied', 'محاولة تزوير معرف المستخدم مرفوضة (User ID Spoofing Rejected).');
    }
    // 2. Server-Side Rate Limiting Check (5 bookings per 10 minutes per customerId or IP)
    if (!isStaff) {
        const callerIp = String(context.rawRequest?.ip || 'unknown-ip');
        const ipKey = getIpRateLimitKey(callerIp);
        const rateLimitTargetId = customerId || ipKey;
        const rateLimitDocRef = db.collection('rateLimits').doc(`booking_${rateLimitTargetId}`);
        const BOOKING_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes sliding window
        const nowMs = Date.now();
        await db.runTransaction(async (transaction) => {
            const rlSnap = await transaction.get(rateLimitDocRef);
            let count = 1;
            let firstAttemptAt = nowMs;
            if (rlSnap.exists) {
                const rlData = rlSnap.data();
                const prevFirst = Number(rlData?.firstAttemptAt || nowMs);
                if (nowMs - prevFirst < BOOKING_RATE_WINDOW_MS) {
                    count = Number(rlData?.count || rlData?.attempts || 0) + 1;
                    firstAttemptAt = prevFirst;
                }
                else {
                    count = 1;
                    firstAttemptAt = nowMs;
                }
            }
            else {
                count = 1;
                firstAttemptAt = nowMs;
            }
            if (count > 5) {
                throw new functions.https.HttpsError('resource-exhausted', 'تم تجاوز الحد المسموح به لإنشاء الحجوزات مؤقتاً (الحد الأقصى 5 حجوزات خلال 10 دقائق). يرجى الانتظار قليلاً قبل المحاولة مجدداً.');
            }
            transaction.set(rateLimitDocRef, {
                target: rateLimitTargetId,
                count,
                attempts: count,
                firstAttemptAt,
                lastAttemptAt: nowMs,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
    }
    // 3. Vehicle ID Extraction & Validation
    const vehicleId = String(data?.vehicleId || '').trim();
    if (!vehicleId) {
        throw new functions.https.HttpsError('invalid-argument', 'يرجى تحديد السيارة المطلوبة للحجز.');
    }
    // 4. Server-Side Date & Time Validation (Requirement 5, 6, 7)
    const rawPickup = String(data?.pickupDate || data?.startDate || '').trim();
    const rawReturn = String(data?.returnDate || data?.endDate || '').trim();
    const pickupTime = String(data?.pickupTime || '10:00').trim();
    const returnTime = String(data?.returnTime || '10:00').trim();
    // Validate format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(rawPickup) || !dateRegex.test(rawReturn)) {
        throw new functions.https.HttpsError('invalid-argument', 'صيغة التاريخ غير صالحة. يرجى استخدام تنسيق (YYYY-MM-DD).');
    }
    // Validate time format HH:MM
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(pickupTime) || !timeRegex.test(returnTime)) {
        throw new functions.https.HttpsError('invalid-argument', 'صيغة الوقت غير صالحة. يرجى استخدام تنسيق (HH:MM).');
    }
    // Parse timestamps
    const pickupDateTime = new Date(`${rawPickup}T${pickupTime}:00Z`).getTime();
    const returnDateTime = new Date(`${rawReturn}T${returnTime}:00Z`).getTime();
    if (isNaN(pickupDateTime) || isNaN(returnDateTime)) {
        throw new functions.https.HttpsError('invalid-argument', 'تاريخ أو توقيت الحجز غير صالح.');
    }
    // Requirement 6: Prevent startDate >= endDate
    if (returnDateTime <= pickupDateTime) {
        throw new functions.https.HttpsError('invalid-argument', 'تاريخ وتوقيت إعادة السيارة يجب أن يكون لاحقاً لتاريخ وتوقيت الاستلام.');
    }
    // Requirement 7: Reasonable Date Boundaries
    const nowMs = Date.now();
    const pastToleranceMs = 24 * 60 * 60 * 1000; // 24-hour buffer for timezones
    if (pickupDateTime < nowMs - pastToleranceMs && !isStaff) {
        throw new functions.https.HttpsError('invalid-argument', 'لا يمكن إنشاء حجز لتاريخ سابق أو منتهي.');
    }
    const maxAdvanceBookingMs = 365 * 24 * 60 * 60 * 1000; // Max 1 year in advance
    if (pickupDateTime > nowMs + maxAdvanceBookingMs) {
        throw new functions.https.HttpsError('invalid-argument', 'لا يمكن الحجز لفترة تتجاوز سنة واحدة مقدماً.');
    }
    const durationMs = returnDateTime - pickupDateTime;
    const calculatedDays = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
    if (calculatedDays > 90 && !isStaff) {
        throw new functions.https.HttpsError('invalid-argument', 'أقصى مدة للحجز الإلكتروني التلقائي هي 90 يوماً. للحجوزات طويلة الأجل يرجى التواصل مباشرة مع الإدارة.');
    }
    // Optional Contact Details with sanitization (Minimal Client Inputs)
    const customerName = String(data?.customerName || context.auth?.token?.name || 'مستأجر').trim().slice(0, 100);
    const customerPhone = String(data?.customerPhone || '').trim().slice(0, 30);
    const customerWhatsApp = String(data?.customerWhatsApp || customerPhone).trim().slice(0, 30);
    const customerNationalId = String(data?.customerNationalId || '').trim().slice(0, 50);
    const customerLicenseNumber = String(data?.customerLicenseNumber || '').trim().slice(0, 50);
    const customerAddress = String(data?.customerAddress || '').trim().slice(0, 200);
    const notes = String(data?.notes || '').trim().slice(0, 500);
    const withDriver = Boolean(data?.withDriver);
    const deliveryLocation = String(data?.deliveryLocation || '').trim().slice(0, 150);
    // 5. Pre-resolve vehicle document across collection and default fleet catalogue
    const resolvedVehicle = await resolveVehicleDocument(vehicleId);
    if (!resolvedVehicle) {
        throw new functions.https.HttpsError('not-found', 'السيارة المطلوبة غير موجودة في أسطول الشركة.');
    }
    const vehicleRef = resolvedVehicle.ref;
    const canonicalVehicleId = resolvedVehicle.data.id || vehicleRef.id;
    // 6. Atomic Transaction: Concurrency Lock, Availability & Double Booking Prevention, Pricing & Writing
    try {
        return await db.runTransaction(async (transaction) => {
            // 6a. ALL READS FIRST (Firestore requires all transaction reads before any writes)
            const vehicleDoc = await transaction.get(vehicleRef);
            const lockRef = vehicleRef.collection('_internal').doc('bookingLock');
            await transaction.get(lockRef);
            let activeBookingsSnap;
            try {
                const activeBookingsQuery = db.collection('bookings')
                    .where('vehicleId', '==', canonicalVehicleId)
                    .where('status', 'in', ['confirmed', 'rented']);
                activeBookingsSnap = await transaction.get(activeBookingsQuery);
            }
            catch (queryErr) {
                console.error('[createBookingSecure] activeBookingsQuery failed:', {
                    errorCode: queryErr?.code,
                    errorMessage: queryErr?.message,
                    details: queryErr?.details,
                    canonicalVehicleId,
                    stack: queryErr?.stack,
                });
                const errString = `${queryErr?.message || ''} ${queryErr?.code || ''} ${queryErr?.details || ''}`.toLowerCase();
                if (errString.includes('index') ||
                    errString.includes('failed_precondition') ||
                    errString.includes('requires an index') ||
                    queryErr?.code === 9 ||
                    queryErr?.code === 'FAILED_PRECONDITION') {
                    console.error('[createBookingSecure] Throwing failed-precondition: Firestore composite index is missing or building', {
                        errorCode: queryErr?.code,
                        errorMessage: queryErr?.message,
                    });
                    throw new functions.https.HttpsError('failed-precondition', 'فهرس قاعدة البيانات لقائمة الحجوزات النشطة (bookings: vehicleId, status) غير جاهز أو قيد الإنشاء حالياً في Firebase. يرجى المحاولة بعد قليل.');
                }
                throw queryErr;
            }
            const settingsRef = db.collection('settings').doc('global');
            const settingsDoc = await transaction.get(settingsRef);
            const counterRef = db.collection('settings').doc('bookingCounter');
            const counterDoc = await transaction.get(counterRef);
            // 6b. Process Read Data & Business Validations
            if (!vehicleDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'السيارة المطلوبة غير موجودة في أسطول الشركة.');
            }
            const vehicleData = vehicleDoc.data();
            if (vehicleData.isDeleted === true) {
                throw new functions.https.HttpsError('not-found', 'هذه السيارة غير متاحة في الأسطول.');
            }
            if (vehicleData.status === 'maintenance' || vehicleData.status === 'inactive') {
                throw new functions.https.HttpsError('failed-precondition', 'عذراً، السيارة غير متاحة حالياً بسبب أعمال الصيانة الدورية أو الإيقاف الفني.');
            }
            // Double Booking Prevention via Active Bookings
            const conflictingDoc = activeBookingsSnap.docs.find((doc) => {
                const b = doc.data();
                if (b.isDeleted === true || b.status === 'cancelled' || b.status === 'rejected') {
                    return false;
                }
                const bPickupTime = b.pickupTime || '10:00';
                const bReturnTime = b.returnTime || '10:00';
                const bPickupMs = new Date(`${b.pickupDate}T${bPickupTime}:00Z`).getTime();
                const bReturnMs = new Date(`${b.returnDate}T${bReturnTime}:00Z`).getTime();
                if (isNaN(bPickupMs) || isNaN(bReturnMs)) {
                    return (rawPickup <= b.returnDate && rawReturn >= b.pickupDate);
                }
                // Interval intersection condition: A_start < B_end && A_end > B_start
                return (pickupDateTime < bReturnMs && returnDateTime > bPickupMs);
            });
            if (conflictingDoc) {
                const conflict = conflictingDoc.data();
                throw new functions.https.HttpsError('already-exists', `عذراً، هذه السيارة محجوزة مسبقاً في الفترة المطلوبة (من ${conflict.pickupDate} إلى ${conflict.returnDate}). يرجى اختيار سيارة أخرى أو تغيير التواريخ.`);
            }
            // Server-Authoritative Price Calculation
            const settingsData = settingsDoc.exists ? settingsDoc.data() : null;
            const officialDailyPrice = Number(vehicleData.dailyPrice) || 0;
            const isUserLoggedIn = Boolean(context.auth && context.auth.uid);
            const calculatedPricing = calculateRentalPriceServer(officialDailyPrice, calculatedDays, settingsData, isUserLoggedIn, canonicalVehicleId);
            let driverFee = 0;
            if (withDriver) {
                const dailyDriverRate = Number(settingsData?.driverDailyRate ?? 40);
                driverFee = dailyDriverRate * calculatedDays;
            }
            const finalTotalPrice = calculatedPricing.totalPrice + driverFee;
            // Sequential Booking Number Generation (SHK-2026-XXXXXX)
            let nextCount = 1;
            if (counterDoc.exists) {
                nextCount = (counterDoc.data()?.lastNumber || 0) + 1;
            }
            const currentYear = new Date().getFullYear();
            const formattedNumber = `SHK-${currentYear}-${String(nextCount).padStart(6, '0')}`;
            const newBookingRef = db.collection('bookings').doc();
            // 6c. ALL WRITES AFTER READS
            transaction.set(lockRef, {
                lockedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastBookingBy: customerId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            transaction.set(counterRef, {
                lastNumber: nextCount,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            const bookingPayload = {
                id: newBookingRef.id,
                bookingNumber: formattedNumber,
                vehicleId: canonicalVehicleId,
                vehicleName: `${vehicleData.brand} ${vehicleData.model} (${vehicleData.year})`,
                vehicleCategory: vehicleData.category || 'medium',
                customerId,
                customerEmail,
                customerName,
                customerPhone,
                customerWhatsApp: customerWhatsApp || customerPhone,
                customerNationalId,
                customerAddress,
                customerLicenseNumber,
                pickupDate: rawPickup,
                pickupTime,
                returnDate: rawReturn,
                returnTime,
                rentalDays: calculatedDays,
                dailyPrice: officialDailyPrice,
                basePrice: calculatedPricing.basePrice,
                discountAmount: calculatedPricing.discountAmount,
                insuranceAmount: calculatedPricing.insuranceAmount,
                driverFee,
                withDriver,
                deliveryLocation,
                totalPrice: finalTotalPrice,
                paidAmount: 0,
                remainingAmount: finalTotalPrice,
                status: 'new',
                paymentStatus: 'unpaid',
                notes,
                isDeleted: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            transaction.set(newBookingRef, bookingPayload);
            // Notification for staff dashboard
            const notificationRef = db.collection('notifications').doc();
            transaction.set(notificationRef, {
                id: notificationRef.id,
                type: 'new_booking',
                title: 'طلب حجز جديد عبر الموقع',
                message: `تم إنشاء حجز برقم ${formattedNumber} للعميل ${customerName} على ${vehicleData.brand} ${vehicleData.model} بمبلغ ${finalTotalPrice}$`,
                bookingId: newBookingRef.id,
                vehicleId: canonicalVehicleId,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Immutable audit log record with unified identity schema
            const auditRef = db.collection('auditLogs').doc();
            const actorType = isStaff ? 'staff' : (callerUid ? 'customer' : 'guest');
            transaction.set(auditRef, {
                id: auditRef.id,
                user: customerEmail || callerUid,
                userId: callerUid,
                actorUid: callerUid || null,
                actorEmail: customerEmail || null,
                actorType,
                customerProvidedName: customerName || null,
                action: 'BOOKING_CREATED_SECURE',
                entity: 'bookings',
                entityId: newBookingRef.id,
                details: `حجز مؤمن ${formattedNumber} لـ ${vehicleData.brand} ${vehicleData.model} (${rawPickup} إلى ${rawReturn}) بمبلغ ${finalTotalPrice}$`,
                timestamp: new Date().toISOString(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return {
                success: true,
                bookingId: newBookingRef.id,
                bookingNumber: formattedNumber,
                booking: {
                    ...bookingPayload,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
                message: 'تم استلام وتأكيد طلب الحجز بنجاح.',
            };
        });
    }
    catch (txErr) {
        console.error('[createBookingSecure] Execution failed with error:', {
            errorCode: txErr?.code,
            errorMessage: txErr?.message,
            details: txErr?.details,
            stack: txErr?.stack,
        });
        if (txErr instanceof functions.https.HttpsError) {
            throw txErr;
        }
        const errString = `${txErr?.message || ''} ${txErr?.code || ''} ${txErr?.details || ''}`.toLowerCase();
        if (errString.includes('index') ||
            errString.includes('failed_precondition') ||
            errString.includes('requires an index') ||
            txErr?.code === 9 ||
            txErr?.code === 'FAILED_PRECONDITION') {
            throw new functions.https.HttpsError('failed-precondition', 'فهرس قاعدة البيانات لقائمة الحجوزات النشطة (bookings: vehicleId, status) غير جاهز أو قيد الإنشاء حالياً في Firebase. يرجى المحاولة بعد قليل.');
        }
        console.error('خطأ أثناء معالجة الحجز السحابي:', txErr);
        throw new functions.https.HttpsError('internal', 'حدث خطأ داخلي غير متوقع. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.');
    }
});
/**
 * دالة داخلية مشتركة لتغيير حالة الحجز مع فحص التعارض والتسجيل في سجل التدقيق وتحديث حالة السيارة.
 * تُستخدم بواسطة updateBookingStatusSecure وبواسطة معالج Telegram Webhook.
 */
async function applyBookingStatusChange(bookingId, newStatus, actorLabel, actorInfo) {
    const validStatuses = ['new', 'reviewing', 'confirmed', 'rented', 'completed', 'cancelled', 'rejected'];
    if (!validStatuses.includes(newStatus)) {
        return { success: false, message: 'حالة الحجز المطلوبة غير صحيحة.' };
    }
    const targetBookingRef = await resolveBookingDocument(bookingId);
    if (!targetBookingRef) {
        return { success: false, message: 'الحجز المطلوب غير موجود.' };
    }
    // Pre-fetch booking doc once to resolve vehicleRef properly before transaction
    const preBookingSnap = await targetBookingRef.get();
    if (!preBookingSnap.exists) {
        return { success: false, message: 'الحجز المطلوب غير موجود.' };
    }
    const preBookingData = preBookingSnap.data();
    let preResolvedVehicleRef = null;
    if (preBookingData.vehicleId) {
        const vRes = await resolveVehicleDocument(String(preBookingData.vehicleId).trim());
        if (vRes) {
            preResolvedVehicleRef = vRes.ref;
        }
    }
    try {
        return await db.runTransaction(async (transaction) => {
            // 1. ALL READS FIRST (Firestore requires all reads before any writes in transactions)
            const bookingDoc = await transaction.get(targetBookingRef);
            if (!bookingDoc.exists) {
                return { success: false, message: 'الحجز المطلوب غير موجود.' };
            }
            const bData = bookingDoc.data();
            // Read vehicle document if vehicleId is present
            let vehicleDoc = null;
            if (preResolvedVehicleRef) {
                vehicleDoc = await transaction.get(preResolvedVehicleRef);
            }
            // Mandatory double-booking conflict check when confirming or renting
            if (newStatus === 'confirmed' || newStatus === 'rented') {
                const targetVehicleId = bData.vehicleId || (preResolvedVehicleRef ? preResolvedVehicleRef.id : null);
                if (targetVehicleId) {
                    const activeBookingsQuery = db.collection('bookings')
                        .where('vehicleId', '==', targetVehicleId)
                        .where('status', 'in', ['confirmed', 'rented']);
                    const activeSnap = await transaction.get(activeBookingsQuery);
                    const currentPickup = bData.pickupDate;
                    const currentReturn = bData.returnDate;
                    const currentPickupTime = bData.pickupTime || '10:00';
                    const currentReturnTime = bData.returnTime || '10:00';
                    const curPickupMs = new Date(`${currentPickup}T${currentPickupTime}:00Z`).getTime();
                    const curReturnMs = new Date(`${currentReturn}T${currentReturnTime}:00Z`).getTime();
                    const conflictingDoc = activeSnap.docs.find((doc) => {
                        if (doc.id === targetBookingRef.id)
                            return false;
                        const b = doc.data();
                        if (b.isDeleted === true || b.status === 'cancelled' || b.status === 'rejected') {
                            return false;
                        }
                        const bPickupTime = b.pickupTime || '10:00';
                        const bReturnTime = b.returnTime || '10:00';
                        const bPickupMs = new Date(`${b.pickupDate}T${bPickupTime}:00Z`).getTime();
                        const bReturnMs = new Date(`${b.returnDate}T${bReturnTime}:00Z`).getTime();
                        if (isNaN(curPickupMs) || isNaN(curReturnMs) || isNaN(bPickupMs) || isNaN(bReturnMs)) {
                            return (currentPickup <= b.returnDate && currentReturn >= b.pickupDate);
                        }
                        // Interval intersection condition: A_start < B_end && A_end > B_start
                        return (curPickupMs < bReturnMs && curReturnMs > bPickupMs);
                    });
                    if (conflictingDoc) {
                        return {
                            success: false,
                            message: 'تعذر تأكيد هذا الحجز لوجود حجز آخر مؤكد بالفعل على نفس السيارة بفترة متداخلة. يرجى رفض هذا الطلب أو التواصل مع العميل لتغيير التواريخ.',
                        };
                    }
                }
            }
            // 2. ALL WRITES AFTER READS
            // When status changes to rented: update vehicle status to rented
            if (newStatus === 'rented' && preResolvedVehicleRef && vehicleDoc && vehicleDoc.exists) {
                transaction.update(preResolvedVehicleRef, {
                    status: 'rented',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            // When status changes to completed, cancelled, or rejected: return vehicle status to available if rented
            if ((newStatus === 'completed' || newStatus === 'cancelled' || newStatus === 'rejected') && preResolvedVehicleRef && vehicleDoc && vehicleDoc.exists) {
                if (vehicleDoc.data()?.status === 'rented') {
                    transaction.update(preResolvedVehicleRef, {
                        status: 'available',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
            // Update ONLY status and updatedAt - totalAmount, pricing and ownership remain IMMUTABLE
            transaction.update(targetBookingRef, {
                status: newStatus,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Audit log with unified identity schema
            const auditRef = db.collection('auditLogs').doc();
            const resolvedActorUid = actorInfo && 'actorUid' in actorInfo
                ? (actorInfo.actorUid ?? null)
                : (actorLabel.includes('@') ? null : (actorLabel || null));
            const resolvedActorEmail = actorInfo?.actorEmail ?? (actorLabel.includes('@') ? actorLabel : null);
            const resolvedActorType = actorInfo?.actorType ?? 'staff';
            transaction.set(auditRef, {
                id: auditRef.id,
                user: actorLabel,
                userId: resolvedActorUid || (actorInfo?.telegramUserId ? `telegram:${actorInfo.telegramUserId}` : (actorLabel.includes('@') ? actorLabel : 'staff')),
                actorUid: resolvedActorUid,
                actorEmail: resolvedActorEmail,
                actorType: resolvedActorType,
                telegramUserId: actorInfo?.telegramUserId ?? null,
                ...(actorInfo?.telegramName ? { telegramName: actorInfo.telegramName } : {}),
                action: 'BOOKING_STATUS_UPDATED',
                entity: 'bookings',
                entityId: targetBookingRef.id,
                details: `تحديث حالة الحجز ${bData.bookingNumber || targetBookingRef.id} من ${bData.status} إلى ${newStatus} بواسطة ${actorLabel}`,
                timestamp: new Date().toISOString(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return {
                success: true,
                bookingId: targetBookingRef.id,
                oldStatus: bData.status,
                newStatus,
                message: `تم تحديث حالة الحجز إلى "${newStatus}" بنجاح.`,
            };
        });
    }
    catch (err) {
        console.error('[applyBookingStatusChange] Error during status change transaction:', err);
        return {
            success: false,
            message: err?.message || 'حدث خطأ داخلي أثناء تحديث حالة الحجز.',
        };
    }
}
/**
 * Cloud Function: updateBookingStatusSecure (region: asia-south1)
 * Enforces server-side authority for booking lifecycle status transitions.
 * Prevents unauthorized status tampering, totalAmount changes, or ownership violations.
 */
exports.updateBookingStatusSecure = functions
    .region(FUNCTION_REGION)
    .runWith({ enforceAppCheck: true })
    .https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لتحديث حالة الحجز.');
    }
    const callerUid = context.auth.uid;
    const isStaff = isCallerStaff(context.auth?.token) || (await isCallerStaffAsync(callerUid, context.auth?.token));
    const bookingId = String(data?.bookingId || '').trim();
    const bookingNumber = String(data?.bookingNumber || '').trim();
    const newStatus = String(data?.status || '').trim();
    if (!bookingId || !newStatus) {
        throw new functions.https.HttpsError('invalid-argument', 'معرف الحجز والحالة الجديدة مطلوبان.');
    }
    const validStatuses = ['new', 'reviewing', 'confirmed', 'rented', 'completed', 'cancelled', 'rejected'];
    if (!validStatuses.includes(newStatus)) {
        throw new functions.https.HttpsError('invalid-argument', 'حالة الحجز المطلوبة غير صحيحة.');
    }
    // Resilient resolution: find document by ID, bookingNumber, or internal id field across legacy formats
    const targetBookingRef = await resolveBookingDocument(bookingId, bookingNumber);
    if (!targetBookingRef) {
        console.error('[updateBookingStatusSecure] booking not found', {
            callerUid,
            isStaff,
            receivedBookingId: bookingId,
            receivedBookingNumber: bookingNumber,
            newStatus,
        });
        throw new functions.https.HttpsError('not-found', 'الحجز المطلوب غير موجود.');
    }
    // Pre-fetch booking doc to verify ownership and authorization rules
    const preBookingSnap = await targetBookingRef.get();
    if (!preBookingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'الحجز المطلوب غير موجود.');
    }
    const bData = preBookingSnap.data();
    const currentStatus = String(bData.status || 'new').toLowerCase().trim();
    // Booking State Machine validation: Enforce allowed state transitions
    const allowedNextStatuses = exports.ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStatuses.includes(newStatus)) {
        throw new functions.https.HttpsError('failed-precondition', `تحويل حالة الحجز من "${currentStatus}" إلى "${newStatus}" غير مسموح به وفق دورة حياة الحجوزات المعتمدة.`);
    }
    const isOwner = bData.customerId === callerUid ||
        bData.userId === callerUid ||
        (Boolean(bData.customerEmail) &&
            String(bData.customerEmail).toLowerCase().trim() ===
                String(context.auth?.token?.email || '').toLowerCase().trim());
    // Authorization & Status Transition Rules
    if (!isStaff) {
        // Customer can ONLY update their OWN booking
        if (!isOwner) {
            throw new functions.https.HttpsError('permission-denied', 'غير مصرح لك بتعديل حجز لا يخص حسابك (Ownership Bypass Rejected).');
        }
        // Customer can ONLY cancel pending bookings
        if (newStatus !== 'cancelled') {
            throw new functions.https.HttpsError('permission-denied', 'لا يملك العميل صلاحية تغيير الحالة إلى غير "ملغي" (Unauthorized Status Change Rejected).');
        }
    }
    const actorLabel = context.auth?.token?.email || callerUid;
    const result = await applyBookingStatusChange(targetBookingRef.id, newStatus, actorLabel, {
        actorUid: callerUid,
        actorEmail: context.auth?.token?.email || null,
        actorType: isStaff ? 'staff' : 'customer',
    });
    if (!result.success) {
        if (result.message.includes('تعذر تأكيد هذا الحجز لوجود حجز آخر')) {
            throw new functions.https.HttpsError('already-exists', result.message);
        }
        if (result.message.includes('غير موجود')) {
            throw new functions.https.HttpsError('not-found', result.message);
        }
        throw new functions.https.HttpsError('failed-precondition', result.message);
    }
    return result;
});
/**
 * 2. Cloud Function: sendBookingNotification (region: asia-south1)
 *
 * Enforces strict Server Authority & Security:
 * 1. Requires valid Firebase Authentication (context.auth.uid).
 * 2. Accepts ONLY bookingId from client. Deliberately ignores any client-sent customerName,
 *    carName, totalAmount, or status to prevent spoofing and data tampering.
 * 3. Enforces Authorization:
 *    - Staff (admin, employee) can trigger notifications for any booking.
 *    - Authenticated customers can ONLY trigger notifications for their OWN booking (customerId === callerUid).
 *    - Unauthorized access to other customers' bookings is blocked with 'permission-denied'.
 * 4. Reads authoritative data directly from Firestore:
 *    - Booking document (bookings/{bookingId})
 *    - Vehicle document (vehicles/{vehicleId}) for verified vehicle identity
 *    - Customer profile (users/{customerId}) for verified customer name
 * 5. Extracts authoritative financial total, status, customerName, and vehicleName from Firestore.
 * 6. Sanitizes all strings before insertion into notifications or audit logs.
 * 7. Enforces rate limiting (15-second debounce + maximum 5 notifications per 10 minutes per booking).
 */
exports.sendBookingNotification = functions
    .region(FUNCTION_REGION)
    .runWith({ enforceAppCheck: true })
    .https.onCall(async (data, context) => {
    // 1. Authentication Check
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً لإرسال إشعار الحجز.');
    }
    const callerUid = context.auth.uid;
    const callerEmail = (context.auth.token?.email || '').toLowerCase().trim();
    // 2. Validate bookingId input (the ONLY trusted identifier from the client)
    const rawBookingId = data?.bookingId;
    if (!rawBookingId || typeof rawBookingId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'معرف الحجز (bookingId) مطلوب ويجب أن يكون نصاً صالحاً.');
    }
    const cleanBookingId = sanitizeString(rawBookingId, 64);
    if (!cleanBookingId || !/^[a-zA-Z0-9_-]+$/.test(cleanBookingId)) {
        throw new functions.https.HttpsError('invalid-argument', 'معرف الحجز يحتوي على رموز غير مسموح بها أو غير صالح.');
    }
    // 3. Read booking document from Firestore (Authoritative Source of Truth via resilient resolution)
    const bookingRef = await resolveBookingDocument(cleanBookingId, data?.bookingNumber);
    if (!bookingRef) {
        throw new functions.https.HttpsError('not-found', 'الحجز المطلوب غير موجود في سجلات الشركة.');
    }
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'الحجز المطلوب غير موجود في سجلات الشركة.');
    }
    const bData = bookingDoc.data();
    if (bData.isDeleted === true) {
        throw new functions.https.HttpsError('not-found', 'هذا الحجز ملغي أو محذوف من النظام.');
    }
    // 4. Authorization Check
    // Determine if caller is staff (admin/employee) strictly via Firebase Auth Custom Claims or the booking owner
    const isStaff = isCallerStaff(context.auth.token) || (await isCallerStaffAsync(callerUid, context.auth.token));
    const isAdmin = isCallerAdmin(context.auth.token);
    const isOwner = bData.customerId === callerUid;
    if (!isStaff && !isOwner) {
        // Block customer trying to access or notify another person's booking
        throw new functions.https.HttpsError('permission-denied', 'غير مصرح لك بإرسال إشعار لحجز لا يخص حسابك الشخصي (Ownership Verification Failed).');
    }
    // 5. Rate Limiting (Prevents spam and notification flooding)
    if (!isAdmin) {
        const nowMs = Date.now();
        const rateLimitRef = db.collection('rateLimits').doc(`notif_bk_${cleanBookingId}`);
        await db.runTransaction(async (t) => {
            const rlDoc = await t.get(rateLimitRef);
            if (rlDoc.exists) {
                const rlData = rlDoc.data();
                const lastSentMs = Number(rlData.lastSentMs) || 0;
                const windowStartMs = Number(rlData.windowStartMs) || 0;
                const count = Number(rlData.count) || 0;
                // 15 seconds debounce
                if (nowMs - lastSentMs < 15000) {
                    throw new functions.https.HttpsError('resource-exhausted', 'تم إرسال إشعار لهذا الحجز مؤخراً. يرجى الانتظار 15 ثانية على الأقل قبل إعادة الإرسال.');
                }
                // Maximum 5 notifications per 10 minutes per booking
                const tenMinutesMs = 10 * 60 * 1000;
                if (nowMs - windowStartMs < tenMinutesMs) {
                    if (count >= 5) {
                        throw new functions.https.HttpsError('resource-exhausted', 'تم بلوغ الحد الأقصى لإرسال الإشعارات لهذا الحجز (5 إشعارات خلال 10 دقائق). يرجى المحاولة لاحقاً.');
                    }
                    t.update(rateLimitRef, {
                        lastSentMs: nowMs,
                        count: count + 1,
                        lastCallerUid: callerUid,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
                else {
                    t.set(rateLimitRef, {
                        windowStartMs: nowMs,
                        lastSentMs: nowMs,
                        count: 1,
                        lastCallerUid: callerUid,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
            else {
                t.set(rateLimitRef, {
                    windowStartMs: nowMs,
                    lastSentMs: nowMs,
                    count: 1,
                    lastCallerUid: callerUid,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        });
    }
    // 6. Extract Authoritative Server-Side Data (Ignoring client values completely)
    // - Authoritative Status
    const authoritativeStatus = typeof bData.status === 'string' ? bData.status : 'new';
    const statusLabelsArabic = {
        new: 'حجز جديد',
        reviewing: 'قيد المراجعة',
        confirmed: 'مؤكد',
        rented: 'جاري التأجير',
        completed: 'مكتمل وتم التسليم',
        cancelled: 'ملغي',
        rejected: 'مرفوض',
    };
    const safeStatusLabel = statusLabelsArabic[authoritativeStatus] || authoritativeStatus;
    // - Authoritative Total Amount (Financial protection: completely ignores any client totalAmount)
    const rawTotal = bData.totalPrice ?? bData.totalAmount ?? 0;
    const authoritativeTotalAmount = typeof rawTotal === 'number' && !isNaN(rawTotal)
        ? Math.max(0, Math.round(rawTotal * 100) / 100)
        : 0;
    // - Authoritative Vehicle Data (Fetched from vehicles collection or trusted booking record)
    let authoritativeVehicleName = '';
    if (bData.vehicleId) {
        try {
            const vDoc = await db.collection('vehicles').doc(bData.vehicleId).get();
            if (vDoc.exists) {
                const vData = vDoc.data();
                authoritativeVehicleName = `${vData.brand || ''} ${vData.model || ''} (${vData.year || ''})`.trim();
            }
        }
        catch (vErr) {
            console.warn('Error reading vehicle document for notification:', vErr);
        }
    }
    if (!authoritativeVehicleName) {
        authoritativeVehicleName = String(bData.vehicleName || 'مركبة').trim();
    }
    authoritativeVehicleName = sanitizeString(authoritativeVehicleName, 80) || 'مركبة';
    // - Authoritative Customer Data (Fetched from users collection or trusted booking record)
    let authoritativeCustomerName = '';
    if (bData.customerId) {
        try {
            const uDoc = await db.collection('users').doc(bData.customerId).get();
            if (uDoc.exists) {
                const uData = uDoc.data();
                authoritativeCustomerName = uData.displayName || uData.name || '';
            }
        }
        catch (uErr) {
            console.warn('Error reading user document for notification:', uErr);
        }
    }
    if (!authoritativeCustomerName) {
        authoritativeCustomerName = String(bData.customerName || 'العميل').trim();
    }
    authoritativeCustomerName = sanitizeString(authoritativeCustomerName, 80) || 'العميل';
    const authoritativeBookingNumber = sanitizeString(bData.bookingNumber || cleanBookingId, 40);
    // 7. Write Authoritative Notification to Firestore
    const notificationRef = db.collection('notifications').doc();
    const notificationData = {
        id: notificationRef.id,
        type: 'booking_status_change',
        title: `إشعار الحجز #${authoritativeBookingNumber}: ${authoritativeVehicleName}`,
        message: `تم تحديث الحجز #${authoritativeBookingNumber} (${authoritativeVehicleName}) للعميل ${authoritativeCustomerName}. الحالة: ${safeStatusLabel}، القيمة الإجمالية المعتمدة: ${authoritativeTotalAmount}$.`,
        bookingId: cleanBookingId,
        bookingNumber: authoritativeBookingNumber,
        vehicleId: bData.vehicleId || '',
        customerId: bData.customerId || '',
        customerName: authoritativeCustomerName,
        vehicleName: authoritativeVehicleName,
        status: authoritativeStatus,
        statusLabel: safeStatusLabel,
        totalAmount: authoritativeTotalAmount,
        recipientRole: isStaff ? 'all' : 'admin',
        triggeredBy: callerUid,
        triggeredByRole: isStaff ? 'staff' : 'customer',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await notificationRef.set(notificationData);
    // 8. Log Immutable Security Audit Record with unified identity schema
    const auditRef = db.collection('auditLogs').doc();
    await auditRef.set({
        id: auditRef.id,
        userId: callerUid,
        user: callerEmail || callerUid,
        actorUid: callerUid,
        actorEmail: callerEmail || null,
        actorType: isStaff ? 'staff' : 'customer',
        action: 'BOOKING_NOTIFICATION_SENT_SECURE',
        entity: 'bookings',
        entityId: cleanBookingId,
        details: `إرسال إشعار موثق من السيرفر للحجز ${authoritativeBookingNumber} (العميل: ${authoritativeCustomerName}, المركبة: ${authoritativeVehicleName}, المبلغ المعتمد: ${authoritativeTotalAmount}$, الحالة: ${authoritativeStatus})`,
        timestamp: new Date().toISOString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        success: true,
        notificationId: notificationRef.id,
        bookingId: cleanBookingId,
        bookingNumber: authoritativeBookingNumber,
        customerName: authoritativeCustomerName,
        vehicleName: authoritativeVehicleName,
        status: authoritativeStatus,
        statusLabel: safeStatusLabel,
        totalAmount: authoritativeTotalAmount,
        message: `تم إرسال إشعار الحجز بنجاح بناءً على بيانات الخادم الموثوقة (الحالة: ${safeStatusLabel}، الإجمالي: ${authoritativeTotalAmount}$).`,
    };
});
/**
 * 3. Cloud Function: generateRentalContractPdf (region: asia-south1)
 * Verifies caller authorization (contract owner or staff) and produces dynamic verified contract metadata.
 */
exports.generateRentalContractPdf = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب.');
    }
    const { contractId, bookingId } = data || {};
    const targetId = contractId || bookingId;
    if (!targetId || typeof targetId !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'معرف العقد أو الحجز مطلوب.');
    }
    // Check authorization via Custom Claims or fallback
    const isStaff = isCallerStaff(context.auth.token) || (await isCallerStaffAsync(context.auth.uid, context.auth.token));
    let bookingData = null;
    let contractData = null;
    if (contractId) {
        const contractDoc = await db.collection('contracts').doc(contractId).get();
        if (contractDoc.exists) {
            contractData = contractDoc.data();
        }
    }
    const resolvedBookingId = bookingId || contractData?.bookingId || targetId;
    if (resolvedBookingId) {
        const bookingRef = await resolveBookingDocument(resolvedBookingId);
        if (bookingRef) {
            const bookingDoc = await bookingRef.get();
            if (bookingDoc.exists) {
                bookingData = bookingDoc.data();
            }
        }
    }
    if (!isStaff) {
        const isOwner = (contractData && contractData.customerId === context.auth.uid) ||
            (bookingData && bookingData.customerId === context.auth.uid);
        if (!isOwner) {
            throw new functions.https.HttpsError('permission-denied', 'غير مصرح لك بالوصول إلى هذا العقد.');
        }
    }
    const contractNumber = contractData?.contractNumber || `SHK-CTR-${targetId.slice(-6).toUpperCase()}`;
    const verificationCode = Buffer.from(`${targetId}_${context.auth.uid}`).toString('base64').slice(0, 16);
    return {
        success: true,
        contractId: contractId || targetId,
        bookingId: resolvedBookingId,
        contractNumber,
        verificationCode,
        status: 'generated',
        customerName: bookingData?.customerName || contractData?.customerName || 'المستأجر',
        vehicleName: bookingData?.vehicleName || contractData?.vehicleName || 'المركبة',
        totalPrice: bookingData?.totalPrice || contractData?.totalAmount || 0,
        generatedAt: new Date().toISOString(),
        message: 'تم التحقق من بيانات العقد وإنشاء الوثيقة بنجاح.'
    };
});
/**
 * 4. Cloud Function: calculateDynamicPricing (region: asia-south1)
 * Strictly verifies authentication status dynamically rather than hardcoding true.
 */
exports.calculateDynamicPricing = functions
    .region(FUNCTION_REGION)
    .runWith({ enforceAppCheck: true })
    .https.onCall(async (data, context) => {
    const { days, vehicleId } = data || {};
    const cleanVehicleId = String(vehicleId || '').trim();
    let officialDailyPrice = 0;
    if (cleanVehicleId) {
        const resolved = await resolveVehicleDocument(cleanVehicleId);
        if (!resolved) {
            throw new functions.https.HttpsError('not-found', 'السيارة المطلوبة لحساب السعر غير موجودة.');
        }
        officialDailyPrice = Number(resolved.data.dailyPrice) || 0;
    }
    else {
        throw new functions.https.HttpsError('invalid-argument', 'معرف السيارة (vehicleId) مطلوب لحساب التسعير الديناميكي.');
    }
    const settingsDoc = await db.collection('settings').doc('global').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : null;
    const isUserLoggedIn = Boolean(context.auth && context.auth.uid);
    const result = calculateRentalPriceServer(officialDailyPrice, Number(days) || 1, settings, isUserLoggedIn, cleanVehicleId);
    return {
        success: true,
        pricing: result,
    };
});
/**
 * 5. Cloud Function: verifyCustomerIdentity (region: asia-south1)
 * Performs schema validation and format verification on Syrian National IDs, phone numbers, and documents.
 *
 * SECURITY RULES ENFORCED (Phase 6):
 * - Format validation alone DOES NOT equal real identity verification.
 * - Without a certified external KYC provider or physical branch inspection, users CANNOT be auto-marked 'verified'.
 * - Default status upon valid format is 'manual_review'.
 * - Administrative status changes ('verified', 'rejected', 'manual_review') are Server-Authoritative and
 *   STRICTLY restricted to staff/admins via Firebase Auth Custom Claims (isCallerStaff).
 * - Regular users cannot verify themselves or other users.
 */
exports.verifyCustomerIdentity = functions
    .region(FUNCTION_REGION)
    .runWith({ enforceAppCheck: true })
    .https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب.');
    }
    const action = typeof data?.action === 'string' ? data.action : '';
    // ---------------------------------------------------------------------------
    // Path A: Administrative Status Decision (Server-Authoritative)
    // ---------------------------------------------------------------------------
    if (action === 'set_status' || action === 'review_decision') {
        if (!isCallerStaff(context.auth.token)) {
            throw new functions.https.HttpsError('permission-denied', 'تعديل حالة توثيق هوية العملاء مقتصر حصراً على موظفي وإدارة شركة شاكر عبر الصلاحيات المعتمدة.');
        }
        const targetUserId = sanitizeString(data?.targetUserId || data?.targetCustomerId || data?.userId, 128);
        const newStatus = typeof data?.status === 'string' ? data.status.toLowerCase() : '';
        const validStatuses = ['pending', 'manual_review', 'verified', 'rejected'];
        if (!targetUserId) {
            throw new functions.https.HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
        }
        if (!validStatuses.includes(newStatus)) {
            throw new functions.https.HttpsError('invalid-argument', `حالة التحقق غير صالحة. الحالات المقبولة: ${validStatuses.join(', ')}`);
        }
        const isVerified = newStatus === 'verified';
        const nowIso = new Date().toISOString();
        const updatePayload = {
            verificationStatus: newStatus,
            verified: isVerified,
            verifiedAt: isVerified ? nowIso : null,
            verifiedBy: context.auth.uid,
            updatedAt: nowIso,
        };
        if (data?.notes) {
            updatePayload.verificationNotes = sanitizeString(data.notes, 255);
        }
        // Update user document if it exists
        const userDocRef = db.collection('users').doc(targetUserId);
        const userSnap = await userDocRef.get();
        if (userSnap.exists) {
            await userDocRef.set(updatePayload, { merge: true });
        }
        // Update customer document if it exists
        const custDocRef = db.collection('customers').doc(targetUserId);
        const custSnap = await custDocRef.get();
        if (custSnap.exists) {
            await custDocRef.set(updatePayload, { merge: true });
        }
        // Record administrative audit trail with unified identity schema
        await db.collection('auditLogs').add({
            action: 'CUSTOMER_VERIFICATION_STATUS_CHANGED',
            actorUid: context.auth.uid,
            actorEmail: context.auth.token?.email || null,
            actorType: 'staff',
            targetUserId,
            newStatus,
            isVerified,
            timestamp: nowIso,
            ip: context.rawRequest?.ip || 'server',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            success: true,
            action: 'status_updated',
            targetUserId,
            verificationStatus: newStatus,
            verified: isVerified,
            verifiedAt: isVerified ? nowIso : undefined,
            verifiedBy: context.auth.uid,
            message: `تم تحديث حالة التحقق للعميل إلى [${newStatus}] بنجاح واعتمادها في السجل السحابي.`,
        };
    }
    // ---------------------------------------------------------------------------
    // Path B: Format Validation / Document Intake (Client-side / Self-Service)
    // ---------------------------------------------------------------------------
    // For non-staff, ALWAYS enforce context.auth.uid (Never trust client-supplied userId)
    const effectiveUserId = isCallerStaff(context.auth.token)
        ? (sanitizeString(data?.userId, 128) || context.auth.uid)
        : context.auth.uid;
    const { nationalId, phone, fileUrl, documentType } = data || {};
    const cleanId = String(nationalId || '').trim().replace(/\D/g, '');
    const cleanPhone = String(phone || '').trim().replace(/[^\d+]/g, '');
    // Format checks:
    // - Syrian National ID: 10 or 11 digits
    const hasNationalId = cleanId.length > 0;
    const isValidNationalId = hasNationalId ? (cleanId.length === 11 || cleanId.length === 10) : true;
    // - Syrian Phone: typically +963 or 09, 9 to 15 digits
    const hasPhone = cleanPhone.length > 0;
    const isValidPhone = hasPhone ? (cleanPhone.length >= 9 && cleanPhone.length <= 15) : true;
    // Document URL check
    const hasDocument = Boolean(fileUrl && typeof fileUrl === 'string');
    const formatValid = (hasNationalId ? isValidNationalId : true) &&
        (hasPhone ? isValidPhone : true) &&
        (hasNationalId || hasPhone || hasDocument);
    // CRITICAL SECURITY MANDATE:
    // Format validation or document presence NEVER equals verified identity!
    // Identity status is ALWAYS 'manual_review' (or 'rejected' if invalid format)
    const verificationStatus = formatValid ? 'manual_review' : 'rejected';
    const verified = false;
    // Persist the status in user doc as pending manual review
    try {
        const userDocRef = db.collection('users').doc(effectiveUserId);
        const userSnap = await userDocRef.get();
        if (userSnap.exists) {
            await userDocRef.set({
                verificationStatus,
                verified: false,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        }
    }
    catch (err) {
        // Non-fatal if firestore user write fails in dev/offline
    }
    return {
        success: true,
        formatValid,
        verified, // ALWAYS false here - requires manual review or certified KYC
        verificationStatus,
        requiresManualReview: true,
        details: {
            nationalIdValid: hasNationalId ? isValidNationalId : undefined,
            phoneValid: hasPhone ? isValidPhone : undefined,
            documentReceived: hasDocument,
            documentType: sanitizeString(documentType, 50) || undefined,
            requiresManualReview: true,
        },
        message: formatValid
            ? 'تم فحص صيغة البيانات والمستندات بنجاح. الطلب الآن قيد التدقيق الإداري اليدوي (Manual Review) من قبل فريق العمل. لا يُعتبر الحساب موثقاً حتى اعتماده رسمياً.'
            : 'صيغة الرقم الوطني أو رقم الهاتف غير مطابقة للمعايير المعتمدة.',
    };
});
/**
 * 6. Cloud Function: syncFleetMaintenance (region: asia-south1)
 */
exports.syncFleetMaintenance = functions.region(FUNCTION_REGION).https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب.');
    }
    if (!isCallerStaff(context.auth.token)) {
        throw new functions.https.HttpsError('permission-denied', 'مقتصر على الموظفين والإدارة.');
    }
    const vehiclesSnapshot = await db.collection('vehicles').where('isDeleted', '==', false).get();
    let alertsCount = 0;
    for (const doc of vehiclesSnapshot.docs) {
        const v = doc.data();
        let currentMileage = Number(v.currentMileage || 0);
        let lastOilChangeMileage = Number(v.lastOilChangeMileage || 0);
        try {
            const internalSnap = await doc.ref.collection('internal').doc('details').get();
            if (internalSnap.exists) {
                const iData = internalSnap.data();
                if (iData?.currentMileage != null)
                    currentMileage = Number(iData.currentMileage);
                if (iData?.lastOilChangeMileage != null)
                    lastOilChangeMileage = Number(iData.lastOilChangeMileage);
            }
        }
        catch { }
        const kmSinceOil = currentMileage - lastOilChangeMileage;
        if (kmSinceOil >= 4500) {
            alertsCount++;
        }
    }
    return {
        success: true,
        totalVehiclesScanned: vehiclesSnapshot.size,
        urgentMaintenanceCount: alertsCount,
        syncedAt: new Date().toISOString(),
    };
});
/**
 * 7. Scheduled Function: Daily check for overdue rentals & upcoming oil changes (region: asia-south1)
 */
exports.checkMaintenanceAndRentals = functions.region(FUNCTION_REGION).pubsub
    .schedule('every 24 hours')
    .onRun(async () => {
    const vehiclesSnapshot = await db.collection('vehicles').where('isDeleted', '==', false).get();
    for (const doc of vehiclesSnapshot.docs) {
        const v = doc.data();
        let currentMileage = Number(v.currentMileage || 0);
        let lastOilChangeMileage = Number(v.lastOilChangeMileage || 0);
        try {
            const internalSnap = await doc.ref.collection('internal').doc('details').get();
            if (internalSnap.exists) {
                const iData = internalSnap.data();
                if (iData?.currentMileage != null)
                    currentMileage = Number(iData.currentMileage);
                if (iData?.lastOilChangeMileage != null)
                    lastOilChangeMileage = Number(iData.lastOilChangeMileage);
            }
        }
        catch { }
        const kmSinceOil = currentMileage - lastOilChangeMileage;
        if (kmSinceOil >= 4500) {
            await db.collection('notifications').add({
                type: 'oil_change_reminder',
                title: `تنبيه صيانة الزيت: ${v.brand} ${v.model}`,
                message: `السيارة قطعت ${kmSinceOil} كم منذ آخر تغيير زيت (الحد الأقصى 5,000 كم).`,
                vehicleId: doc.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });
        }
    }
    return null;
});
/**
 * 8. Cloud Function: cleanupSeedData (region: asia-south1)
 * Securely deletes identified dummy seed customers and bookings from Firestore database
 */
exports.cleanupSeedData = functions.region(FUNCTION_REGION).https.onCall(async (_data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب.');
    }
    const isAdmin = isCallerAdmin(context.auth.token);
    if (!isAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'غير مصرح لك بتنفيذ هذه العملية. هذه العملية مقتصرة على الإدارة (Admin) فقط.');
    }
    const seedCustomerIds = ['cust-101', 'cust-102', 'cust-103'];
    const seedBookingIds = ['book-2026-001', 'book-2026-002'];
    let deletedCustomers = 0;
    let deletedBookings = 0;
    for (const cid of seedCustomerIds) {
        try {
            const docRef = db.collection('customers').doc(cid);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                await docRef.delete();
                deletedCustomers++;
            }
        }
        catch (e) {
            console.warn(`Error deleting seed customer ${cid}:`, e);
        }
    }
    for (const bid of seedBookingIds) {
        try {
            const docRef = db.collection('bookings').doc(bid);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                await docRef.delete();
                deletedBookings++;
            }
        }
        catch (e) {
            console.warn(`Error deleting seed booking ${bid}:`, e);
        }
    }
    return {
        success: true,
        deletedCustomers,
        deletedBookings,
        message: `تم حذف البيانات التجريبية بنجاح (${deletedCustomers} عملاء و ${deletedBookings} حجوزات).`,
    };
});
/**
 * 9. Cloud Function: setUserRole (region: asia-south1)
 * Sets Firebase Auth Custom Claims as the SOLE authority for user roles.
 * Modifying user roles is STRICTLY restricted to Admins (verified via Auth Token Custom Claims).
 * Completely removes any self-bootstrap or unauthenticated role assignment.
 */
exports.setUserRole = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لإجراء هذا الطلب.');
    }
    const { targetUid, newRole } = data || {};
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }
    const cleanTargetUid = targetUid.trim();
    const callerUid = context.auth.uid;
    const callerToken = context.auth.token;
    const isCallerAdminUser = isCallerAdmin(callerToken);
    const isCallerSuperAdminUser = isCallerSuperAdmin(callerToken);
    // STRICT AUTHORIZATION: ONLY an existing Admin or Super Admin (verified via Custom Claims) can modify roles.
    // NO self-bootstrap, NO database absence backdoor.
    if (!isCallerAdminUser && !isCallerSuperAdminUser) {
        throw new functions.https.HttpsError('permission-denied', 'غير مصرح لك بتعديل الصلاحيات. تعديل الصلاحيات مقتصر حصراً على مدراء النظام (Admin/Super Admin) الموثقين عبر مطالبات الأمان (Custom Claims).');
    }
    // Super Admin designation is restricted and cannot be granted via standard setUserRole
    if (newRole === 'super_admin' || newRole === 'superAdmin') {
        throw new functions.https.HttpsError('invalid-argument', 'لا يمكن منح صلاحية Super Admin عبر واجهة تعديل الأدوار العادية. هذا المنصب مخصص حصرياً عبر بروتوكول التهيئة الأولية للمشروع.');
    }
    // Protect designated root Super Admin from role demotion by regular admins
    if (cleanTargetUid === constants_1.DESIGNATED_SUPER_ADMIN_UID && !isCallerSuperAdminUser) {
        throw new functions.https.HttpsError('permission-denied', 'لا يمكن لمدير عادي تعديل صلاحيات حساب المدير العام الرئيسي (Super Admin).');
    }
    const validRoles = ['customer', 'employee', 'admin'];
    if (!validRoles.includes(newRole)) {
        throw new functions.https.HttpsError('invalid-argument', 'الدور المحدد غير صالح. الأدوار المعتمدة: customer, employee, admin.');
    }
    // 1. Set Custom User Claims on Firebase Authentication user account (the SOLE source of authority)
    try {
        await admin.auth().setCustomUserClaims(cleanTargetUid, {
            role: newRole,
            admin: newRole === 'admin',
            employee: newRole === 'employee' || newRole === 'admin',
            super_admin: false,
        });
    }
    catch (authErr) {
        console.error('فشل تعيين مطالبات التوثيق للمستخدم:', authErr);
        throw new functions.https.HttpsError('internal', 'حدث خطأ داخلي غير متوقع. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.');
    }
    // 2. Synchronize display role in Firestore users/{targetUid} document (for UI display metadata ONLY - grants NO privileges)
    try {
        const userRef = db.collection('users').doc(cleanTargetUid);
        await userRef.set({
            role: newRole,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (dbErr) {
        console.warn('Failed to update display metadata in users doc:', dbErr);
    }
    // 3. Write immutable audit log with unified identity schema
    try {
        await db.collection('auditLogs').add({
            action: 'ROLE_MODIFIED',
            actorUid: callerUid,
            actorEmail: callerToken?.email || null,
            actorType: 'staff',
            performedBy: callerUid,
            targetUser: cleanTargetUid,
            newRole,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
    }
    return {
        success: true,
        targetUid: cleanTargetUid,
        newRole,
        message: `تم تحديث صلاحيات المستخدم بنجاح إلى "${newRole}".`,
    };
});
/**
 * 10. Cloud Function: bootstrapInitialAdmin (region: asia-south1)
 * Secure, deliberate one-time bootstrap process for the FIRST system Super Admin.
 *
 * Strict Security Rules:
 * 1. Target account is strictly and exclusively qEGp4XPEsZdaPTb8sGOR06sJj4A2.
 * 2. Caller MUST be authenticated and their UID MUST match qEGp4XPEsZdaPTb8sGOR06sJj4A2.
 * 3. Caller MUST provide the correct bootstrap secret matching the server-side environment secret.
 * 4. NO fallback secrets: ADMIN_BOOTSTRAP_SECRET must be configured via Cloud Secret Manager / Server Environment.
 * 5. ATOMIC CONCURRENCY CONTROL: Uses Firestore Transaction to enforce State Lifecycle:
 *    UNINITIALIZED -> IN_PROGRESS -> COMPLETED
 * 6. Permanent lock: Once COMPLETED, no transition back to any other state is possible.
 * 7. Failure-safe: If setCustomUserClaims succeeds but writing COMPLETED fails, the function
 *    does NOT return success:true and locks the process to prevent any other UID from bootstrapping.
 */
exports.bootstrapInitialAdmin = functions
    .region(FUNCTION_REGION)
    .runWith({
    secrets: ['ADMIN_BOOTSTRAP_SECRET'],
})
    .https.onCall(async (data, context) => {
    // 1. Strict Authentication Check
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لإجراء عملية تهيئة المدير العام.');
    }
    const callerUid = context.auth.uid;
    // 2. Strict Target Identity Enforcement (Requirements 1, 7, 8, 19)
    // ONLY the designated Super Admin UID can initiate or receive Super Admin bootstrap
    if (callerUid !== constants_1.DESIGNATED_SUPER_ADMIN_UID) {
        throw new functions.https.HttpsError('permission-denied', 'هذا الحساب غير مصرح له بتلقي صلاحية المدير العام (Super Admin). عملية التهيئة محصورة حصراً بالمعرف المحدد للنظام.');
    }
    const providedSecret = String(data?.bootstrapSecret || '').trim();
    // 3. Mandatory server-side secret validation from Cloud Secret Manager / Server Environment
    // CRITICAL: NO hardcoded fallback string or default secret allowed under any circumstance!
    const serverBootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!serverBootstrapSecret || typeof serverBootstrapSecret !== 'string' || !serverBootstrapSecret.trim()) {
        throw new functions.https.HttpsError('failed-precondition', 'خادم النظام غير مهيأ بمفتاح أمان التهيئة الأولية (ADMIN_BOOTSTRAP_SECRET غير معرف في بيئة Cloud Secret Manager / Environment).');
    }
    // 4. Exact secret match required
    if (!providedSecret || providedSecret !== serverBootstrapSecret.trim()) {
        throw new functions.https.HttpsError('permission-denied', 'مفتاح التهيئة الإداري غير صحيح أو غير مصرح به.');
    }
    const bootstrapRef = db.collection('system_config').doc('security_bootstrap');
    // 4. ATOMIC TRANSACTION: State Lifecycle (UNINITIALIZED -> IN_PROGRESS -> COMPLETED)
    // Concurrency control: Only ONE request can transition to IN_PROGRESS.
    // Permanent lock: Once COMPLETED, no transition to any other state is allowed.
    await db.runTransaction(async (transaction) => {
        const bootstrapDoc = await transaction.get(bootstrapRef);
        if (bootstrapDoc.exists) {
            const docData = bootstrapDoc.data();
            const currentStatus = docData?.status;
            const isAlreadyBootstrapped = docData?.isBootstrapped === true;
            // Terminal lock check: If already COMPLETED, permanently reject (Requirements 9 & 20E)
            if (currentStatus === 'COMPLETED' || isAlreadyBootstrapped) {
                throw new functions.https.HttpsError('failed-precondition', 'تمت تهيئة حساب المدير العام (Super Admin) مسبقاً بنجاح. تم إغلاق مسار التهيئة الأولية نهائياً وبشكل دائم.');
            }
            // Active lock check: If already IN_PROGRESS, reject concurrent or duplicate attempts
            if (currentStatus === 'IN_PROGRESS') {
                throw new functions.https.HttpsError('failed-precondition', 'عملية تهيئة المدير العام قيد التنفيذ أو تم قفلها مسبقاً لمنع التضارب وإنشاء أكثر من حساب.');
            }
        }
        // Check if any other Super Admin or Admin already exists in Firestore users
        const adminQuery = db.collection('users')
            .where('role', 'in', ['super_admin', 'superAdmin', 'admin'])
            .limit(5);
        const adminSnapshot = await transaction.get(adminQuery);
        const hasOtherAdmin = adminSnapshot.docs.some(doc => doc.id !== constants_1.DESIGNATED_SUPER_ADMIN_UID);
        if (hasOtherAdmin) {
            transaction.set(bootstrapRef, {
                isBootstrapped: true,
                status: 'COMPLETED',
                reason: 'Existing administrator already present in database',
                lockedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            throw new functions.https.HttpsError('failed-precondition', 'يوجد بالفعل مدير نظام معتمد في قاعدة البيانات. تم قفل مسار التهيئة الأولية بشكل دائم.');
        }
        // Atomically advance state: UNINITIALIZED -> IN_PROGRESS
        transaction.set(bootstrapRef, {
            isBootstrapped: false,
            status: 'IN_PROGRESS',
            lockedByUid: constants_1.DESIGNATED_SUPER_ADMIN_UID,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    // 6. Set Firebase Auth Custom Claims on DESIGNATED_SUPER_ADMIN_UID (the SOLE source of authority)
    try {
        await admin.auth().setCustomUserClaims(constants_1.DESIGNATED_SUPER_ADMIN_UID, {
            role: 'super_admin',
            super_admin: true,
            admin: true,
            employee: true,
        });
    }
    catch (authErr) {
        console.error('CRITICAL: Failed to mint Super Admin custom claims:', authErr);
        // Requirement 14: Log error server-side only, do not reset lock to allow other users
        throw new functions.https.HttpsError('internal', 'فشل تعيين مطالبات التوثيق للمدير العام على خادم المصادقة.');
    }
    // 7. PERMANENT COMMIT: Advance state from IN_PROGRESS -> COMPLETED
    try {
        await bootstrapRef.set({
            isBootstrapped: true,
            status: 'COMPLETED',
            superAdminUid: constants_1.DESIGNATED_SUPER_ADMIN_UID,
            bootstrappedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (firestoreErr) {
        console.error('CRITICAL: Failed to write COMPLETED status to bootstrap document after claims were minted:', firestoreErr);
        // Requirement 14:
        // If claims minted but writing COMPLETED failed:
        // - Do NOT return success: true
        // - Log error server-side only
        // - Do NOT allow another user to execute Bootstrap (status remains IN_PROGRESS)
        throw new functions.https.HttpsError('internal', 'فشل تسجيل اكتمال حالة التهيئة في قاعدة البيانات بعد تعيين الصلاحيات بنجاح.');
    }
    // 8. Synchronize display role metadata in Firestore users/{DESIGNATED_SUPER_ADMIN_UID} (Display metadata only)
    try {
        await db.collection('users').doc(constants_1.DESIGNATED_SUPER_ADMIN_UID).set({
            role: 'super_admin',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (dbErr) {
        console.warn('Failed to update users doc display metadata:', dbErr);
    }
    // 9. Write immutable audit log with unified identity schema
    try {
        await db.collection('auditLogs').add({
            action: 'INITIAL_SUPER_ADMIN_BOOTSTRAPPED',
            actorUid: callerUid,
            actorEmail: context.auth.token?.email || null,
            actorType: 'staff',
            performedBy: callerUid,
            targetUser: constants_1.DESIGNATED_SUPER_ADMIN_UID,
            newRole: 'super_admin',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            details: 'First system Super Admin initialized via atomic server-side bootstrap with Secret Manager protection.',
        });
    }
    catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
    }
    return {
        success: true,
        adminUid: constants_1.DESIGNATED_SUPER_ADMIN_UID,
        role: 'super_admin',
        message: 'تمت تهيئة حساب المدير العام (Super Admin) الأول بنجاح وتعيين Custom Claims. تم إغلاق مسار التهيئة نهائياً وبشكل دائم.',
    };
});
/**
 * 11. Cloud Function: syncMyRole (region: asia-south1)
 * Ensures caller's Custom Claims are minted in Firebase Authentication.
 *
 * Strict Security Rules:
 * 1. If caller token already has a custom claims role, returns it directly.
 * 2. If caller token has NO custom claims (e.g. newly registered user), mints STRICTLY 'customer' claims.
 * 3. NEVER reads users/{uid}.role or any database field to grant admin or employee privileges.
 * 4. Custom Claims in Firebase Authentication are the SOLE source of authority.
 */
exports.syncMyRole = functions.region(FUNCTION_REGION).https.onCall(async (_data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب.');
    }
    const uid = context.auth.uid;
    const token = context.auth.token;
    // If token already has role custom claims, return it directly
    if (token && typeof token.role === 'string') {
        return {
            success: true,
            role: token.role,
            alreadyMinted: true,
        };
    }
    if (token && (token.super_admin === true || token.superAdmin === true || token.owner === true)) {
        return {
            success: true,
            role: 'super_admin',
            alreadyMinted: true,
        };
    }
    if (token && token.admin === true) {
        return {
            success: true,
            role: 'admin',
            alreadyMinted: true,
        };
    }
    if (token && (token.employee === true || token.staff === true)) {
        return {
            success: true,
            role: 'employee',
            alreadyMinted: true,
        };
    }
    // Default role for any unassigned user is strictly 'customer'
    // NEVER trust Firestore users collection, email, or any unverified metadata to grant elevated roles
    const defaultRole = 'customer';
    try {
        await admin.auth().setCustomUserClaims(uid, {
            role: defaultRole,
            admin: false,
            employee: false,
            super_admin: false,
        });
    }
    catch (claimErr) {
        console.error('Failed to mint default customer claims during syncMyRole:', claimErr);
        throw new functions.https.HttpsError('internal', 'فشل تعيين مطالبات التوثيق الأساسية.');
    }
    return {
        success: true,
        role: defaultRole,
        alreadyMinted: false,
    };
});
/**
 * 11. Cloud Function: toggleUserAccountStatus (region: asia-south1)
 * Enables or disables a user account in Firebase Auth and Firestore.
 */
exports.toggleUserAccountStatus = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لإجراء هذا الطلب.');
    }
    const { targetUid, disabled } = data || {};
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }
    const cleanTargetUid = targetUid.trim();
    const callerUid = context.auth.uid;
    const callerToken = context.auth.token;
    const isCallerAdminUser = isCallerAdmin(callerToken);
    const isCallerSuperAdminUser = isCallerSuperAdmin(callerToken);
    // STRICT AUTHORIZATION: ONLY Admin or Super Admin
    if (!isCallerAdminUser && !isCallerSuperAdminUser) {
        throw new functions.https.HttpsError('permission-denied', 'غير مصرح لك بتعديل حالة الحساب. العملية مقتصرة على مدراء النظام (Admin/Super Admin).');
    }
    // Prevent disabling own account
    if (cleanTargetUid === callerUid) {
        throw new functions.https.HttpsError('failed-precondition', 'لا يمكنك تعطيل حسابك الخاص.');
    }
    // Protect designated root Super Admin from being disabled by regular admins
    if (cleanTargetUid === constants_1.DESIGNATED_SUPER_ADMIN_UID && !isCallerSuperAdminUser) {
        throw new functions.https.HttpsError('permission-denied', 'لا يمكن لمدير عادي تعطيل حساب المدير العام الرئيسي (Super Admin).');
    }
    const isDisabled = Boolean(disabled);
    // 1. Update status in Firebase Authentication
    try {
        await admin.auth().updateUser(cleanTargetUid, { disabled: isDisabled });
    }
    catch (authErr) {
        console.error('فشل تحديث حالة الحساب في نظام التوثيق:', authErr);
        throw new functions.https.HttpsError('internal', 'حدث خطأ داخلي غير متوقع. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.');
    }
    // 2. Synchronize status in Firestore users collection
    try {
        await db.collection('users').doc(cleanTargetUid).set({
            accountDisabled: isDisabled,
            disabled: isDisabled,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (dbErr) {
        console.warn('Failed to sync disabled state in firestore:', dbErr);
    }
    // 3. Audit log with unified identity schema
    try {
        await db.collection('auditLogs').add({
            action: isDisabled ? 'USER_ACCOUNT_DISABLED' : 'USER_ACCOUNT_ENABLED',
            actorUid: callerUid,
            actorEmail: callerToken?.email || null,
            actorType: 'staff',
            performedBy: callerUid,
            targetUser: cleanTargetUid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
    }
    return { success: true, disabled: isDisabled, targetUid: cleanTargetUid };
});
/**
 * 12. Cloud Function: deleteUserAccount (region: asia-south1)
 * Permanently deletes a user account from Firebase Auth and Firestore users collection.
 * Restricted strictly to Super Admins.
 */
exports.deleteUserAccount = functions.region(FUNCTION_REGION).https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لإجراء هذا الطلب.');
    }
    const { targetUid } = data || {};
    if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
        throw new functions.https.HttpsError('invalid-argument', 'معرف المستخدم المستهدف مطلوب.');
    }
    const cleanTargetUid = targetUid.trim();
    const callerUid = context.auth.uid;
    const callerToken = context.auth.token;
    const isCallerSuperAdminUser = isCallerSuperAdmin(callerToken);
    // STRICT AUTHORIZATION: Super Admin ONLY
    if (!isCallerSuperAdminUser) {
        throw new functions.https.HttpsError('permission-denied', 'غير مصرح لك بحذف المستخدمين. حذف الحسابات نهائياً مقتصر حصراً على المدير العام للمنظومة (Super Admin).');
    }
    // Prevent self deletion
    if (cleanTargetUid === callerUid) {
        throw new functions.https.HttpsError('failed-precondition', 'لا يمكنك حذف حسابك الخاص.');
    }
    // Protect designated root Super Admin under any circumstance
    if (cleanTargetUid === constants_1.DESIGNATED_SUPER_ADMIN_UID) {
        throw new functions.https.HttpsError('permission-denied', 'لا يمكن حذف حساب المدير العام الرئيسي للنظام نهائياً تحت أي ظرف.');
    }
    // 1. Delete user from Firebase Authentication
    try {
        await admin.auth().deleteUser(cleanTargetUid);
    }
    catch (authErr) {
        console.error('فشل حذف الحساب من نظام التوثيق:', authErr);
        if (authErr.code !== 'auth/user-not-found') {
            throw new functions.https.HttpsError('internal', 'حدث خطأ داخلي غير متوقع. يرجى المحاولة لاحقاً أو التواصل مع الدعم الفني.');
        }
    }
    // 2. Delete user document from Firestore users collection
    try {
        await db.collection('users').doc(cleanTargetUid).delete();
    }
    catch (dbErr) {
        console.warn('Failed to delete user doc in firestore:', dbErr);
    }
    // 3. Write immutable audit log with unified identity schema
    try {
        await db.collection('auditLogs').add({
            action: 'USER_ACCOUNT_DELETED',
            actorUid: callerUid,
            actorEmail: callerToken?.email || null,
            actorType: 'staff',
            performedBy: callerUid,
            targetUser: cleanTargetUid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
    }
    return { success: true, targetUid: cleanTargetUid };
});
/**
 * -----------------------------------------------------------------------------
 * SERVER-AUTHORITATIVE BRUTE-FORCE RATE LIMITING FUNCTIONS
 * Stored in rateLimits/{email_key} via Admin SDK (locked by firestore.rules)
 * -----------------------------------------------------------------------------
 */
function getEmailRateLimitKey(email) {
    const clean = (email || '').toLowerCase().trim();
    return Buffer.from(clean).toString('hex') || 'unknown';
}
function getIpRateLimitKey(ip) {
    const clean = (ip || 'unknown-ip').trim().replace(/[\.:]/g, '_').replace(/[^a-zA-Z0-9_-]/g, '_');
    return clean || 'unknown-ip';
}
/**
 * 13. Function: checkLoginAllowed
 * Pre-login rate limit verification.
 * Protected with enforceAppCheck to mitigate automated brute-force attempts from outside the verified app.
 * Throws HttpsError('resource-exhausted') if account is temporarily locked.
 */
exports.checkLoginAllowed = functions
    .region(FUNCTION_REGION)
    .runWith({ enforceAppCheck: true })
    .https.onCall(async (data, context) => {
    if (!context.app) {
        throw new functions.https.HttpsError('failed-precondition', 'الطلب يفتقر إلى التحقق الأمني من التطبيق (App Check verification required).');
    }
    const email = String(data?.email || '').toLowerCase().trim();
    if (!email) {
        return { allowed: true };
    }
    const emailKey = getEmailRateLimitKey(email);
    const docRef = db.collection('rateLimits').doc(emailKey);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        const limitData = docSnap.data();
        const now = Date.now();
        const lockedUntil = Number(limitData?.lockedUntil || 0);
        if (lockedUntil > now) {
            const waitSeconds = Math.ceil((lockedUntil - now) / 1000);
            throw new functions.https.HttpsError('resource-exhausted', `تم تجميد محاولات الدخول مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار ${waitSeconds} ثانية قبل المحاولة مجدداً.`);
        }
    }
    return { allowed: true };
});
/**
 * 14. Function: recordFailedLogin
 * Increments failed attempt counter in a 15-minute sliding window.
 * Protected with enforceAppCheck to mitigate DoS / lock-out abuse against arbitrary accounts.
 * Lockouts:
 *  - >= 10 attempts: 2 minutes lockout (120 seconds)
 *  - >= 5 attempts: 30 seconds lockout
 */
exports.recordFailedLogin = functions
    .region(FUNCTION_REGION)
    .runWith({ enforceAppCheck: true })
    .https.onCall(async (data, context) => {
    if (!context.app) {
        throw new functions.https.HttpsError('failed-precondition', 'الطلب يفتقر إلى التحقق الأمني من التطبيق (App Check verification required).');
    }
    const email = String(data?.email || '').toLowerCase().trim();
    if (!email) {
        return { success: false, message: 'Invalid email' };
    }
    const callerIp = String(context.rawRequest?.ip || 'unknown-ip');
    const ipKey = getIpRateLimitKey(callerIp);
    const ipDocRef = db.collection('rateLimits_ip').doc(ipKey);
    const IP_WINDOW_MS = 15 * 60 * 1000;
    const now = Date.now();
    await db.runTransaction(async (transaction) => {
        const ipSnap = await transaction.get(ipDocRef);
        let ipAttempts = 1;
        let firstAttemptAt = now;
        if (ipSnap.exists) {
            const ipData = ipSnap.data();
            const prevFirst = Number(ipData?.firstAttemptAt || now);
            if (now - prevFirst < IP_WINDOW_MS) {
                ipAttempts = Number(ipData?.attempts || 0) + 1;
                firstAttemptAt = prevFirst;
            }
            else {
                ipAttempts = 1;
                firstAttemptAt = now;
            }
        }
        else {
            ipAttempts = 1;
            firstAttemptAt = now;
        }
        if (ipAttempts > 20) {
            throw new functions.https.HttpsError('resource-exhausted', 'تم رصد نشاط غير اعتيادي، يرجى المحاولة لاحقاً.');
        }
        transaction.set(ipDocRef, {
            ip: callerIp,
            attempts: ipAttempts,
            firstAttemptAt,
            lastAttemptAt: now,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    const emailKey = getEmailRateLimitKey(email);
    const docRef = db.collection('rateLimits').doc(emailKey);
    const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
    let attempts = 1;
    let lockedUntil = 0;
    await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(docRef);
        let firstAttemptAt = now;
        if (docSnap.exists) {
            const prevData = docSnap.data();
            const prevFirst = Number(prevData?.firstAttemptAt || now);
            if (now - prevFirst < WINDOW_MS) {
                attempts = Number(prevData?.attempts || 0) + 1;
                firstAttemptAt = prevFirst;
            }
            else {
                attempts = 1;
                firstAttemptAt = now;
            }
        }
        else {
            attempts = 1;
            firstAttemptAt = now;
        }
        if (attempts >= 10) {
            lockedUntil = now + 120 * 1000; // 2 minutes
        }
        else if (attempts >= 5) {
            lockedUntil = now + 30 * 1000; // 30 seconds
        }
        else {
            lockedUntil = 0;
        }
        transaction.set(docRef, {
            email,
            attempts,
            firstAttemptAt,
            lastAttemptAt: now,
            lockedUntil,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    const isLocked = lockedUntil > now;
    const waitSeconds = isLocked ? Math.ceil((lockedUntil - now) / 1000) : 0;
    return {
        success: true,
        attempts,
        locked: isLocked,
        waitSeconds,
    };
});
/**
 * 15. Function: resetLoginAttempts
 * Clears failed attempt tracking upon successful authentication.
 * STRICT SECURITY:
 *  - Requires valid authentication (context.auth).
 *  - Only resets the counter for the authenticated user's verified token email (context.auth.token.email).
 *  - Rejects with permission-denied if caller attempts to reset another user's email.
 */
exports.resetLoginAttempts = functions
    .region(FUNCTION_REGION)
    .runWith({ enforceAppCheck: true })
    .https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لإجراء هذه العملية (Authentication required).');
    }
    const authenticatedEmail = String(context.auth.token?.email || '').toLowerCase().trim();
    if (!authenticatedEmail) {
        throw new functions.https.HttpsError('permission-denied', 'لا يوجد بريد إلكتروني مرتبط بجلسة المستخدم الحالية.');
    }
    const suppliedEmail = data?.email ? String(data.email).toLowerCase().trim() : '';
    if (suppliedEmail && suppliedEmail !== authenticatedEmail) {
        throw new functions.https.HttpsError('permission-denied', 'غير مصرح بتصفير محاولات تسجيل الدخول لبريد إلكتروني آخر (Email mismatch rejected).');
    }
    const targetEmail = authenticatedEmail;
    const emailKey = getEmailRateLimitKey(targetEmail);
    try {
        await db.collection('rateLimits').doc(emailKey).delete();
    }
    catch (delErr) {
        console.warn('Failed to delete rate limit document:', delErr);
    }
    return { success: true };
});
/**
 * 16. Blocking Function: enforceLoginLockout (GCIP v2)
 * Triggered right before a user signs in via Firebase Authentication.
 * Reads rateLimits/{emailKey} to enforce server-authoritative lockout if active.
 */
exports.enforceLoginLockout = (0, identity_1.beforeUserSignedIn)({ region: FUNCTION_REGION }, async (event) => {
    const email = event.data?.email || '';
    if (!email) {
        return;
    }
    const emailKey = getEmailRateLimitKey(email);
    const docRef = db.collection('rateLimits').doc(emailKey);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        const limitData = docSnap.data();
        const now = Date.now();
        const lockedUntil = Number(limitData?.lockedUntil || 0);
        if (lockedUntil > now) {
            const waitSeconds = Math.ceil((lockedUntil - now) / 1000);
            throw new identity_1.HttpsError('permission-denied', `تم تجميد محاولات الدخول مؤقتاً لكثرة المحاولات الخاطئة. يرجى الانتظار ${waitSeconds} ثانية قبل المحاولة مجدداً.`);
        }
    }
    return;
});
var validateUploadedFileSignature_1 = require("./validateUploadedFileSignature");
Object.defineProperty(exports, "validateUploadedFileSignature", { enumerable: true, get: function () { return validateUploadedFileSignature_1.validateUploadedFileSignature; } });
var sendTelegramBookingAlert_1 = require("./sendTelegramBookingAlert");
Object.defineProperty(exports, "sendTelegramBookingAlert", { enumerable: true, get: function () { return sendTelegramBookingAlert_1.sendTelegramBookingAlert; } });
var telegramWebhook_1 = require("./telegramWebhook");
Object.defineProperty(exports, "telegramWebhook", { enumerable: true, get: function () { return telegramWebhook_1.telegramWebhook; } });
//# sourceMappingURL=index.js.map