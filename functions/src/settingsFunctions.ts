import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { isCallerAdmin } from './authz';
import { calculateRentalPriceServer } from './pricingServer';
import { resolveVehicleDocument } from './bookingHelpers';

const db = getFirestore(admin.app(), DATABASE_ID);

/**
 * Cloud Function: calculateDynamicPricing (region: asia-south1)
 * Calculates authoritative pricing on the server for a given vehicle and rental days.
 */
export const calculateDynamicPricing = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    const { days, vehicleId, withDriver = false } = request.data || {};
    const cleanVehicleId = String(vehicleId || '').trim();

    if (!cleanVehicleId) {
      throw new HttpsError('invalid-argument', 'معرف السيارة (vehicleId) مطلوب لحساب التسعير الديناميكي.');
    }

    const resolved = await resolveVehicleDocument(db, cleanVehicleId);
    if (!resolved) {
      throw new HttpsError('not-found', 'السيارة المطلوبة لحساب السعر غير موجودة.');
    }

    const officialDailyPrice = Number(resolved.data.dailyPrice) || 0;
    const settingsDoc = await db.collection('settings').doc('global').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : null;
    const isUserLoggedIn = Boolean(request.auth && request.auth.uid);

    const result = calculateRentalPriceServer(
      officialDailyPrice,
      Number(days) || 1,
      settings,
      isUserLoggedIn,
      cleanVehicleId,
      Boolean(withDriver)
    );

    return {
      success: true,
      pricing: result,
    };
  }
);

/**
 * Cloud Function: updateSettingsSecure (region: asia-south1)
 * Server-authoritative settings update with rigorous bounds validation (Requirement 3).
 * Validates: insurance >= 0, discount 0-25%, driver fee >= 0, and logs immutable audit.
 */
export const updateSettingsSecure = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'تسجيل الدخول مطلوب لتعديل إعدادات النظام.');
    }

    const callerToken = request.auth.token;
    if (!isCallerAdmin(callerToken)) {
      throw new HttpsError('permission-denied', 'تعديل إعدادات النظام مقتصر حصراً على مدراء النظام (Admin).');
    }

    const incomingSettings = request.data || {};
    const updates: Record<string, any> = {};

    // Validate insurance values (>= 0)
    if (incomingSettings.insurance1to2Days !== undefined) {
      const ins1 = Number(incomingSettings.insurance1to2Days);
      if (isNaN(ins1) || ins1 < 0) {
        throw new HttpsError('invalid-argument', 'قيمة تأمين 1-2 يوم يجب أن تكون رقماً موجباً أو صفراً.');
      }
      updates.insurance1to2Days = ins1;
      updates.insuranceShortTerm = ins1;
    }

    if (incomingSettings.insuranceAbove2Days !== undefined) {
      const ins2 = Number(incomingSettings.insuranceAbove2Days);
      if (isNaN(ins2) || ins2 < 0) {
        throw new HttpsError('invalid-argument', 'قيمة تأمين أكثر من يومين يجب أن تكون رقماً موجباً أو صفراً.');
      }
      updates.insuranceAbove2Days = ins2;
      updates.insuranceLongTerm = ins2;
    }

    // Validate driver rate (>= 0)
    if (incomingSettings.driverDailyRate !== undefined) {
      const driverRate = Number(incomingSettings.driverDailyRate);
      if (isNaN(driverRate) || driverRate < 0) {
        throw new HttpsError('invalid-argument', 'أجرة السائق اليومية يجب أن تكون رقماً موجباً أو صفراً.');
      }
      updates.driverDailyRate = driverRate;
    }

    // Validate oil change interval (>= 1000)
    if (incomingSettings.oilChangeIntervalKm !== undefined) {
      const oilKm = Number(incomingSettings.oilChangeIntervalKm);
      if (isNaN(oilKm) || oilKm < 1000) {
        throw new HttpsError('invalid-argument', 'مسافة دورة تغيير الزيت يجب أن تكون 1,000 كم على الأقل.');
      }
      updates.oilChangeIntervalKm = oilKm;
    }

    // Validate discount config (0-25%)
    if (incomingSettings.discountConfig !== undefined) {
      const cfg = incomingSettings.discountConfig;
      if (typeof cfg === 'object' && cfg !== null) {
        const pct = Number(cfg.percentage || 0);
        if (isNaN(pct) || pct < 0 || pct > 25) {
          throw new HttpsError('invalid-argument', 'نسبة خصم الأعضاء يجب أن تكون بين 0% و 25%.');
        }
        updates.discountConfig = {
          enabled: Boolean(cfg.enabled),
          percentage: pct,
          scope: cfg.scope === 'specific' ? 'specific' : 'all',
          vehicleIds: Array.isArray(cfg.vehicleIds) ? cfg.vehicleIds.map((id: any) => String(id).trim()) : [],
          title: String(cfg.title || 'خصم خاص للأعضاء').slice(0, 100),
        };
      }
    }

    // Other non-financial settings
    if (incomingSettings.companyName) updates.companyName = String(incomingSettings.companyName).slice(0, 100);
    if (incomingSettings.companyNameEn) updates.companyNameEn = String(incomingSettings.companyNameEn).slice(0, 100);
    if (incomingSettings.companyPhone) updates.companyPhone = String(incomingSettings.companyPhone).slice(0, 30);
    if (incomingSettings.whatsappNumber) updates.whatsappNumber = String(incomingSettings.whatsappNumber).slice(0, 30);
    if (incomingSettings.address) updates.address = String(incomingSettings.address).slice(0, 200);
    if (incomingSettings.rentalTerms) updates.rentalTerms = String(incomingSettings.rentalTerms).slice(0, 3000);
    if (incomingSettings.cancellationLeadHours !== undefined) {
      const lead = Number(incomingSettings.cancellationLeadHours);
      if (!isNaN(lead) && lead >= 0) updates.cancellationLeadHours = lead;
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    // Persist to single authoritative document: settings/global
    const settingsRef = db.collection('settings').doc('global');
    await settingsRef.set(updates, { merge: true });

    // Record immutable audit log
    const auditRef = db.collection('auditLogs').doc();
    await auditRef.set({
      id: auditRef.id,
      user: request.auth.token.email || request.auth.uid,
      userId: request.auth.uid,
      actorUid: request.auth.uid,
      actorEmail: request.auth.token.email || null,
      actorType: 'staff',
      action: 'SETTINGS_UPDATED_SECURE',
      entity: 'settings',
      entityId: 'global',
      details: 'تحديث إعدادات المنظومة العامة والمالية عبر معالج الإعدادات الآمن',
      timestamp: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      message: 'تم تحديث إعدادات النظام وتوثيقها في سجل التدقيق بنجاح.',
    };
  }
);
