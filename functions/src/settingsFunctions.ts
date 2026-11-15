import { HttpsError } from 'firebase-functions/v2/https';
import { getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { FUNCTION_REGION, DATABASE_ID } from './constants';
import { secureCall } from './secureCall';
import { writeAuditAsync, computeSettingsDiff } from './audit';
import { calculateRentalPriceServer } from './pricingServer';
import { resolveVehicleDocument } from './bookingHelpers';
import { formatAndValidatePhone } from './phoneValidation';

const db = getFirestore(getApp(), DATABASE_ID);

export { computeSettingsDiff };


/**
 * Cloud Function: calculateDynamicPricing (region: asia-south1)
 * Calculates authoritative pricing on the server for a given vehicle and rental days.
 */
export const calculateDynamicPricing = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'public',
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
 * cancellationLeadHours (0-720), phone formats, and logs immutable audit with field-level diff.
 */
export const updateSettingsSecure = secureCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    role: 'admin',
    requireMfa: true,
    dbOverride: db,
    permissionDeniedMessage: 'تعديل إعدادات النظام مقتصر حصراً على مدراء النظام (Admin).',
  },
  async (request) => {
    const incomingSettings = request.data || {};
    const updates: Record<string, any> = {};

    // Validate insurance values (0-5000)
    // Accept either canonical or legacy input, but write ONLY canonical names (insuranceShortTerm, insuranceLongTerm)
    const rawShortTerm = incomingSettings.insuranceShortTerm !== undefined
      ? incomingSettings.insuranceShortTerm
      : incomingSettings.insurance1to2Days;

    if (rawShortTerm !== undefined) {
      const ins1 = Number(rawShortTerm);
      if (isNaN(ins1) || ins1 < 0 || ins1 > 5000) {
        throw new HttpsError('invalid-argument', 'قيمة تأمين الحجوزات القصيرة (insuranceShortTerm) يجب أن تكون رقماً بين 0 و 5000.');
      }
      updates.insuranceShortTerm = ins1;
    }

    const rawLongTerm = incomingSettings.insuranceLongTerm !== undefined
      ? incomingSettings.insuranceLongTerm
      : incomingSettings.insuranceAbove2Days;

    if (rawLongTerm !== undefined) {
      const ins2 = Number(rawLongTerm);
      if (isNaN(ins2) || ins2 < 0 || ins2 > 5000) {
        throw new HttpsError('invalid-argument', 'قيمة تأمين الحجوزات الطويلة (insuranceLongTerm) يجب أن تكون رقماً بين 0 و 5000.');
      }
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
        throw new HttpsError('invalid-argument', 'السعر الشهري لسيدان (اقتصادي) يجب أن يكون رقماً بين 0 و 100000.');
      }
      updates.monthlyRateLight = rate;
    }

    if (incomingSettings.monthlyRateMedium !== undefined) {
      const rate = Number(incomingSettings.monthlyRateMedium);
      if (isNaN(rate) || rate < 0 || rate > 100000) {
        throw new HttpsError('invalid-argument', 'السعر الشهري لسيدان يجب أن يكون رقماً بين 0 و 100000.');
      }
      updates.monthlyRateMedium = rate;
    }

    if (incomingSettings.monthlyRateJeep !== undefined) {
      const rate = Number(incomingSettings.monthlyRateJeep);
      if (isNaN(rate) || rate < 0 || rate > 100000) {
        throw new HttpsError('invalid-argument', 'السعر الشهري لـ SUV يجب أن يكون رقماً بين 0 و 100000.');
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
        const requestedScope = cfg.scope ?? 'all';
        if (requestedScope !== 'all' && requestedScope !== 'specific') {
          throw new HttpsError('invalid-argument', 'نطاق تطبيق الخصم يجب أن يكون إما "all" أو "specific".');
        }
        updates.discountConfig = {
          enabled: Boolean(cfg.enabled),
          percentage: pct,
          scope: requestedScope,
          vehicleIds: Array.isArray(cfg.vehicleIds) ? cfg.vehicleIds.slice(0, 200).map((id: any) => String(id).trim()) : [],
          title: String(cfg.title || 'خصم خاص للأعضاء').slice(0, 100),
        };
      }
    }

    // Other non-financial settings
    if (incomingSettings.companyName !== undefined) {
      const nameStr = String(incomingSettings.companyName || '').trim();
      if (!nameStr) {
        throw new HttpsError('invalid-argument', 'اسم الشركة بالعربية مطلوب ولا يمكن تركه فارغاً.');
      }
      updates.companyName = nameStr.slice(0, 100);
    }

    if (incomingSettings.companyNameEn !== undefined) {
      updates.companyNameEn = String(incomingSettings.companyNameEn || '').trim().slice(0, 100);
    }
    if (incomingSettings.companyPhone !== undefined) {
      const phoneStr = String(incomingSettings.companyPhone || '').trim();
      if (phoneStr) {
        try {
          updates.companyPhone = formatAndValidatePhone(phoneStr);
        } catch (phoneErr: any) {
          throw new HttpsError('invalid-argument', phoneErr?.message || 'صيغة هاتف الشركة غير صالحة.');
        }
      } else {
        updates.companyPhone = '';
      }
    }

    if (incomingSettings.whatsappNumber !== undefined) {
      const waStr = String(incomingSettings.whatsappNumber || '').trim();
      if (waStr) {
        try {
          updates.whatsappNumber = formatAndValidatePhone(waStr);
        } catch (waErr: any) {
          throw new HttpsError('invalid-argument', waErr?.message || 'صيغة رقم واتساب غير صالحة.');
        }
      } else {
        updates.whatsappNumber = '';
      }
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

    // Persist to single authoritative document: settings/global (capture previous snapshot for audit diff)
    const settingsRef = db.collection('settings').doc('global');
    const existingSettingsSnap = await settingsRef.get();
    const previousSettings = existingSettingsSnap.exists ? existingSettingsSnap.data() : null;
    const changes = computeSettingsDiff(previousSettings, updates);

    updates.updatedAt = FieldValue.serverTimestamp();
    await settingsRef.set(updates, { merge: true });

    // Record immutable audit log via unified writeAuditAsync only when at least one field changed
    const changedKeys = Object.keys(changes);
    if (changedKeys.length > 0) {
      await writeAuditAsync(db, {
        actorUid: request.auth.uid,
        actorEmail: request.auth.token.email || null,
        actorRole: String(request.auth.token.role || 'admin'),
        actorType: 'staff',
        action: 'SETTINGS_UPDATED_SECURE',
        entity: 'settings',
        entityId: 'global',
        entityName: 'global',
        details: 'تحديث إعدادات المنظومة العامة والمالية عبر معالج الإعدادات الآمن',
        metadata: {
          changes,
          updatedFields: changedKeys,
        },
      });
    }

    return {
      success: true,
      message: 'تم تحديث إعدادات النظام وتوثيقها في سجل التدقيق بنجاح.',
    };
  }
);
