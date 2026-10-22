import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { isCallerAdmin, assertNotRevoked } from './authz';
import { calculateRentalPriceServer } from './pricingServer';
import { resolveVehicleDocument } from './bookingHelpers';

const db = getFirestore(getApp(), DATABASE_ID);

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

    const canonicalVehicleId = resolved.data.id || resolved.ref.id;
    const docId = resolved.ref.id;
    const dataId = resolved.data.id;

    const officialDailyPrice = Number(resolved.data.dailyPrice) || 0;
    const settingsDoc = await db.collection('settings').doc('global').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : null;
    const isUserLoggedIn = Boolean(request.auth && request.auth.uid);

    const result = calculateRentalPriceServer(
      officialDailyPrice,
      Number(days) || 1,
      settings,
      isUserLoggedIn,
      canonicalVehicleId,
      Boolean(withDriver),
      docId,
      dataId
    );

    return {
      success: true,
      pricing: result,
    };
  }
);

/**
 * Cloud Function: updateSettingsSecure (region: asia-south1)
 * Server-authoritative settings update with rigorous bounds validation.
 * Validates: insurance (0-5000), discount (0-25%), driver fee (0-1000), monthly rates (0-100000),
 * cancellationLeadHours (0-720), phone formats, and logs immutable audit.
 */
export const updateSettingsSecure = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
  },
  async (request) => {
    await assertNotRevoked(request);

    const callerToken = request.auth!.token;
    if (!isCallerAdmin(callerToken)) {
      throw new HttpsError('permission-denied', 'تعديل إعدادات النظام مقتصر حصراً على مدراء النظام (Admin).');
    }

    const incomingSettings = request.data || {};
    const updates: Record<string, any> = {};

    // Validate insurance values (0-5000)
    if (incomingSettings.insurance1to2Days !== undefined) {
      const ins1 = Number(incomingSettings.insurance1to2Days);
      if (isNaN(ins1) || ins1 < 0 || ins1 > 5000) {
        throw new HttpsError('invalid-argument', 'قيمة تأمين 1-2 يوم يجب أن تكون رقماً بين 0 و 5000.');
      }
      updates.insurance1to2Days = ins1;
      updates.insuranceShortTerm = ins1;
    }

    if (incomingSettings.insuranceAbove2Days !== undefined) {
      const ins2 = Number(incomingSettings.insuranceAbove2Days);
      if (isNaN(ins2) || ins2 < 0 || ins2 > 5000) {
        throw new HttpsError('invalid-argument', 'قيمة تأمين أكثر من يومين يجب أن تكون رقماً بين 0 و 5000.');
      }
      updates.insuranceAbove2Days = ins2;
      updates.insuranceLongTerm = ins2;
    }

    // Validate driver rate (0-1000)
    if (incomingSettings.driverDailyRate !== undefined) {
      const driverRate = Number(incomingSettings.driverDailyRate);
      if (isNaN(driverRate) || driverRate < 0 || driverRate > 1000) {
        throw new HttpsError('invalid-argument', 'أجرة السائق اليومية يجب أن تكون رقماً بين 0 و 1000.');
      }
      updates.driverDailyRate = driverRate;
    }

    // Validate monthly rates (0-100000)
    if (incomingSettings.monthlyRateLight !== undefined) {
      const rate = Number(incomingSettings.monthlyRateLight);
      if (isNaN(rate) || rate < 0 || rate > 100000) {
        throw new HttpsError('invalid-argument', 'السعر الشهري للسيدان الاقتصادي يجب أن يكون رقماً بين 0 و 100000.');
      }
      updates.monthlyRateLight = rate;
    }

    if (incomingSettings.monthlyRateMedium !== undefined) {
      const rate = Number(incomingSettings.monthlyRateMedium);
      if (isNaN(rate) || rate < 0 || rate > 100000) {
        throw new HttpsError('invalid-argument', 'السعر الشهري للسيدان المتوسط يجب أن يكون رقماً بين 0 و 100000.');
      }
      updates.monthlyRateMedium = rate;
    }

    if (incomingSettings.monthlyRateJeep !== undefined) {
      const rate = Number(incomingSettings.monthlyRateJeep);
      if (isNaN(rate) || rate < 0 || rate > 100000) {
        throw new HttpsError('invalid-argument', 'السعر الشهري للجيب يجب أن يكون رقماً بين 0 و 100000.');
      }
      updates.monthlyRateJeep = rate;
    }

    // Validate discount config (0-25%)
    if (incomingSettings.discountConfig !== undefined) {
      const cfg = incomingSettings.discountConfig;
      if (typeof cfg === 'object' && cfg !== null) {
        const pct = Number(cfg.percentage ?? 0);
        if (isNaN(pct) || pct < 0 || pct > 25) {
          throw new HttpsError('invalid-argument', 'نسبة خصم الأعضاء يجب أن تكون بين 0% و 25%.');
        }
        updates.discountConfig = {
          enabled: Boolean(cfg.enabled),
          percentage: pct,
          scope: cfg.scope === 'specific' ? 'specific' : 'all',
          vehicleIds: Array.isArray(cfg.vehicleIds) ? cfg.vehicleIds.slice(0, 200).map((id: any) => String(id).trim()) : [],
          title: String(cfg.title || 'خصم خاص للأعضاء').slice(0, 100),
        };
      }
    }

    // Other non-financial settings
    if (incomingSettings.companyName) updates.companyName = String(incomingSettings.companyName).slice(0, 100);
    if (incomingSettings.companyNameEn) updates.companyNameEn = String(incomingSettings.companyNameEn).slice(0, 100);
    const PHONE_REGEX = /^((\+?963\s?9\d{8})|(09\d{8})|(\+?[1-9]\d{6,14}))$/;

    if (incomingSettings.companyPhone !== undefined) {
      const phoneStr = String(incomingSettings.companyPhone || '').trim();
      if (phoneStr) {
        const digitsOnly = phoneStr.replace(/[\s\-\(\)]/g, '');
        if (!PHONE_REGEX.test(digitsOnly)) {
          throw new HttpsError('invalid-argument', 'صيغة هاتف الشركة غير صالحة. يرجى إدخال رقم صحيح مع الرمز الدولي أو المحلي.');
        }
      }
      updates.companyPhone = phoneStr.slice(0, 30);
    }

    if (incomingSettings.whatsappNumber !== undefined) {
      const waStr = String(incomingSettings.whatsappNumber || '').trim();
      if (waStr) {
        const digitsOnly = waStr.replace(/[\s\-\(\)]/g, '');
        if (!PHONE_REGEX.test(digitsOnly)) {
          throw new HttpsError('invalid-argument', 'صيغة رقم واتساب غير صالحة. يرجى إدخال رقم صحيح مع الرمز الدولي أو المحلي.');
        }
      }
      updates.whatsappNumber = waStr.slice(0, 30);
    }

    if (incomingSettings.address !== undefined) updates.address = String(incomingSettings.address).slice(0, 200);
    if (incomingSettings.rentalTerms !== undefined) updates.rentalTerms = String(incomingSettings.rentalTerms).slice(0, 3000);

    if (incomingSettings.cancellationLeadHours !== undefined) {
      const lead = Number(incomingSettings.cancellationLeadHours);
      if (isNaN(lead) || lead < 0 || lead > 720) {
        throw new HttpsError('invalid-argument', 'مهلة الإلغاء بالساعات يجب أن تكون رقماً بين 0 و 720 ساعة (30 يوماً).');
      }
      updates.cancellationLeadHours = lead;
    }

    updates.updatedAt = FieldValue.serverTimestamp();

    // Persist to single authoritative document: settings/global
    const settingsRef = db.collection('settings').doc('global');
    await settingsRef.set(updates, { merge: true });

    // Record immutable audit log
    const auditRef = db.collection('auditLogs').doc();
    await auditRef.set({
      id: auditRef.id,
      user: request.auth!.token.email || request.auth!.uid,
      userId: request.auth!.uid,
      actorUid: request.auth!.uid,
      actorEmail: request.auth!.token.email || null,
      actorType: 'staff',
      action: 'SETTINGS_UPDATED_SECURE',
      entity: 'settings',
      entityId: 'global',
      details: 'تحديث إعدادات المنظومة العامة والمالية عبر معالج الإعدادات الآمن',
      timestamp: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      message: 'تم تحديث إعدادات النظام وتوثيقها في سجل التدقيق بنجاح.',
    };
  }
);
