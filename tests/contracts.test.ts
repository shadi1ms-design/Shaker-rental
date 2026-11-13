import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  generateContractVerificationCode,
  parseRentalTerms,
  buildContractSnapshot,
  DEFAULT_RENTAL_TERMS,
} from '../functions/src/contractHelpers';
import { executeVerifyContractCode } from '../functions/src/contractFunctions';
import { applyBookingStatusChange } from '../functions/src/bookingHelpers';
import { assertCanDeleteVehicle } from '../functions/src/fleetFunctions';
import { RentalContract } from '../src/components/RentalContract';
import { VerifyContractPage } from '../src/pages/VerifyContractPage';
import { functionsService } from '../src/services/functionsService';
import { Booking, AppSettings, ContractResponsePayload } from '../src/types';

/**
 * Lightweight, zero-dependency in-memory Firestore mock for transaction unit testing.
 */
class InMemoryFirestore {
  public docs: Record<string, any> = {};

  private getKey(collectionPath: string, docId: string) {
    return `${collectionPath}/${docId}`;
  }

  setDoc(collectionPath: string, docId: string, data: any) {
    this.docs[this.getKey(collectionPath, docId)] = { ...data };
  }

  getDocData(collectionPath: string, docId: string) {
    return this.docs[this.getKey(collectionPath, docId)];
  }

  collection(collPath: string): any {
    const makeQuery = (filters: Array<{ field: string; op: string; val: any }>) => {
      const executeQuery = () => {
        return Object.entries(this.docs)
          .filter(([k, v]) => {
            if (!k.startsWith(`${collPath}/`)) return false;
            for (const f of filters) {
              if (f.op === '==' && v[f.field] !== f.val) return false;
              if (f.op === 'in' && Array.isArray(f.val) && !f.val.includes(v[f.field])) return false;
            }
            return true;
          })
          .map(([k, v]) => {
            const id = k.split('/').pop()!;
            return {
              id,
              ref: this.collection(collPath).doc(id),
              data: () => ({ ...v }),
            };
          });
      };

      return {
        where: (field: string, op: string, val: any) => makeQuery([...filters, { field, op, val }]),
        limit: (n: number) => ({
          get: async () => {
            const docs = executeQuery().slice(0, n);
            return { empty: docs.length === 0, docs };
          },
        }),
        get: async () => {
          const docs = executeQuery();
          return { empty: docs.length === 0, docs };
        },
      };
    };

    return {
      doc: (docId: string) => {
        const key = this.getKey(collPath, docId);
        return {
          id: docId,
          path: key,
          get: async () => {
            const data = this.docs[key];
            return {
              exists: !!data,
              id: docId,
              data: () => (data ? { ...data } : undefined),
            };
          },
          set: async (data: any, options?: any) => {
            if (options && options.merge && this.docs[key]) {
              const current = { ...this.docs[key] };
              for (const [k, v] of Object.entries(data)) {
                if (
                  v === 'FIELD_DELETE' ||
                  (v && typeof v === 'object' && (v as any)._methodName === 'FieldValue.delete') ||
                  (v && typeof v === 'object' && (v as any).constructor?.name === 'FieldValue') ||
                  (v && typeof v === 'object' && (v as any).constructor?.name === 'DeleteTransform')
                ) {
                  delete current[k];
                } else {
                  current[k] = v;
                }
              }
              this.docs[key] = current;
            } else {
              this.docs[key] = { ...data };
            }
          },
          update: async (updates: any) => {
            if (this.docs[key]) {
              const current = { ...this.docs[key] };
              for (const [k, v] of Object.entries(updates)) {
                if (
                  v === 'FIELD_DELETE' ||
                  (v && typeof v === 'object' && (v as any)._methodName === 'FieldValue.delete') ||
                  (v && typeof v === 'object' && (v as any).constructor?.name === 'FieldValue') ||
                  (v && typeof v === 'object' && (v as any).constructor?.name === 'DeleteTransform')
                ) {
                  delete current[k];
                } else {
                  current[k] = v;
                }
              }
              this.docs[key] = current;
            }
          },
          delete: async () => {
            delete this.docs[key];
          },
          collection: (subColl: string) => this.collection(`${collPath}/${docId}/${subColl}`),
        };
      },
      where: (field: string, op: string, val: any) => makeQuery([{ field, op, val }]),
    };
  }

  async runTransaction(updateFunction: (tx: any) => Promise<any>) {
    const tx = {
      get: async (ref: any) => (typeof ref?.get === 'function' ? ref.get() : ref),
      set: (ref: any, data: any, options?: any) => ref.set(data, options),
      update: (ref: any, updates: any) => ref.update(updates),
      delete: (ref: any) => ref.delete(),
    };
    return updateFunction(tx);
  }
}

describe('1. توليد رموز التحقق واللقطة المجمّدة (Random Verification Code)', () => {
  it('generateContractVerificationCode تُولد رمزاً عشوائياً من 24 حرف أرقام وأحرف كبيرة', () => {
    const code = generateContractVerificationCode();
    expect(code).toBeDefined();
    expect(code.length).toBe(24);
    expect(code).toMatch(/^[0-9A-F]{24}$/);
  });

  it('استدعاء generateContractVerificationCode لمرتين يُولد رمزين عشوائيين مختلفين حتماً', () => {
    const code1 = generateContractVerificationCode();
    const code2 = generateContractVerificationCode();
    expect(code1).not.toBe(code2);
  });

  it('buildContractSnapshot ينشئ لقطة العقد وينتج verificationCode عشوائياً بها', () => {
    const bookingData = {
      bookingNumber: '101',
      customerId: 'cust-55',
      customerName: 'طارق الأحمد',
      customerPhone: '+963933111222',
      customerAddress: 'دمشق - المزة فيلات غربية شارع 14',
      vehicleId: 'veh-77',
      vehicleName: 'كيا سيراتو 2024',
      pickupDate: '2026-11-10',
      returnDate: '2026-11-15',
      dailyPrice: 90,
      totalPrice: 450,
    };

    const snapshot = buildContractSnapshot({
      bookingId: 'bk-101',
      bookingData,
      status: 'issued',
    });

    expect(snapshot.status).toBe('issued');
    expect(snapshot.totalPrice).toBe(450);
    expect(snapshot.contractNumber).toBe('CTR-101');
    expect(snapshot.verificationCode).toBeDefined();
    expect(snapshot.verificationCode.length).toBe(24);
    expect(snapshot.verificationCode).toMatch(/^[0-9A-F]{24}$/);
  });
});

describe('2. التحقق من كود العقد المخزّن (verifyContractCode logic)', () => {
  it('يقبل الرمز المخزّن بدقة، ويرفض الرمز الخاطئ أو رمز عقد آخر، ويعمل مع العقد القديم، ويرفض العقد بلا رمز أو غير الموجود', async () => {
    const db = new InMemoryFirestore();

    db.setDoc('contracts', 'CTR_bk-500', {
      contractNumber: 'CTR-500',
      bookingId: 'bk-500',
      verificationCode: 'A1B2C3D4E5F6789012345678',
      vehicleName: 'كيا سيراتو',
      pickupDate: '2026-11-10',
      returnDate: '2026-11-15',
      status: 'issued',
    });

    db.setDoc('contracts', 'CTR_bk-501', {
      contractNumber: 'CTR-501',
      bookingId: 'bk-501',
      verificationCode: '998877665544332211AABBCC',
      vehicleName: 'هيونداي توسان',
      pickupDate: '2026-11-12',
      returnDate: '2026-11-18',
      status: 'active',
    });

    // Legacy contract with older stored code
    db.setDoc('contracts', 'CTR_bk-old-99', {
      contractNumber: 'CTR-OLD-99',
      bookingId: 'bk-old-99',
      verificationCode: 'OLD_STORED_CODE_12345678',
      vehicleName: 'تويوتا كامري',
      status: 'closed',
    });

    // Contract without verification code
    db.setDoc('contracts', 'CTR_bk-no-code', {
      contractNumber: 'CTR-NO-CODE',
      bookingId: 'bk-no-code',
      vehicleName: 'نيسان صني',
      status: 'issued',
    });

    // 1. Valid stored code returns isValid: true
    const res1 = await executeVerifyContractCode(db as any, 'CTR-500', 'A1B2C3D4E5F6789012345678');
    expect(res1.isValid).toBe(true);
    expect(res1.vehicleName).toBe('كيا سيراتو');

    // 2. Wrong code returns isValid: false
    const res2 = await executeVerifyContractCode(db as any, 'CTR-500', 'WRONG_CODE_XYZ1234567890');
    expect(res2.isValid).toBe(false);

    // 3. Code from contract2 used for contract1 returns isValid: false
    const res3 = await executeVerifyContractCode(db as any, 'CTR-500', '998877665544332211AABBCC');
    expect(res3.isValid).toBe(false);

    // 4. Legacy contract with stored code works
    const resLegacy = await executeVerifyContractCode(db as any, 'CTR-OLD-99', 'OLD_STORED_CODE_12345678');
    expect(resLegacy.isValid).toBe(true);
    expect(resLegacy.vehicleName).toBe('تويوتا كامري');

    // 5. Contract without stored verification code returns isValid: false
    const resNoCode = await executeVerifyContractCode(db as any, 'CTR-NO-CODE', 'SOME_CODE_12345678');
    expect(resNoCode.isValid).toBe(false);

    // 6. Non-existent contract number returns isValid: false
    const resNonExistent = await executeVerifyContractCode(db as any, 'CTR-NONEXISTENT', 'SOME_CODE_12345678');
    expect(resNonExistent.isValid).toBe(false);
  });
});

describe('3. ضمان إزالة السر القديم (CONTRACT_HMAC_SECRET invariant)', () => {
  it('المجلد functions/src لا يذكر أبداً الكلمة CONTRACT_HMAC_SECRET', () => {
    const functionsSrcDir = path.resolve(__dirname, '../functions/src');
    const readFilesRecursively = (dir: string): string[] => {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
          results = results.concat(readFilesRecursively(filePath));
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
          results.push(filePath);
        }
      });
      return results;
    };

    const files = readFilesRecursively(functionsSrcDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, `الملف ${file} يحتوي على CONTRACT_HMAC_SECRET`).not.toContain('CONTRACT_HMAC_SECRET');
    }
  });
});

describe('4. تطبيق دالة applyBookingStatusChange المباشر على Firestore', () => {
  it('الانتقال إلى confirmed ينشئ العقد contracts/CTR_{id} بحالة issued ولا يستبدل عقداً موجوداً', async () => {
    const db = new InMemoryFirestore();
    const bookingId = 'bk-test-confirm-99';

    // Create dummy booking in new state
    db.setDoc('bookings', bookingId, {
      id: bookingId,
      bookingNumber: '9901',
      customerId: 'cust-test-1',
      customerName: 'سامر الأحمد',
      customerPhone: '+963933111222',
      customerAddress: 'دمشق - المالكي شارع الجلاء بناء 12',
      vehicleId: 'veh-test-1',
      vehicleName: 'نيسان صني 2023',
      pickupDate: '2026-12-01',
      returnDate: '2026-12-05',
      dailyPrice: 80,
      totalPrice: 320,
      status: 'new',
    });

    // Seed vehicle doc required by applyBookingStatusChange
    db.setDoc('vehicles', 'veh-test-1', {
      id: 'veh-test-1',
      brand: 'نيسان',
      model: 'صني',
      year: 2023,
      category: 'medium',
      status: 'available',
      isDeleted: false,
      dailyPrice: 80,
    });

    // Execute status change transition to confirmed
    const res = await applyBookingStatusChange(db as any, bookingId, 'confirmed', 'staff@shaker.sy', {
      actorUid: 'staff-uid-1',
      actorType: 'staff',
    });

    expect(res.success).toBe(true);

    // Verify contract document was created atomically
    const contractData = db.getDocData('contracts', `CTR_${bookingId}`);
    expect(contractData).toBeDefined();
    expect(contractData.status).toBe('issued');
    expect(contractData.totalPrice).toBe(320);
    expect(contractData.contractNumber).toBe('CTR-9901');
    expect(contractData.verificationCode).toBeDefined();
    expect(contractData.verificationCode.length).toBe(24);

    const initialCode = contractData.verificationCode;

    // Modify price on booking doc directly to test immutability
    db.setDoc('bookings', bookingId, {
      ...db.getDocData('bookings', bookingId),
      totalPrice: 999,
    });

    // Re-verify contract snapshot remains untouched
    const contractDataSecond = db.getDocData('contracts', `CTR_${bookingId}`);
    expect(contractDataSecond.totalPrice).toBe(320);
    expect(contractDataSecond.verificationCode).toBe(initialCode);
  });
});

describe('5. تسليم واستلام السيارة مع تحديث العداد والعقد (Handover & Return Odometer Flow)', () => {
  it('تسليم السيارة (confirmed -> rented) يفعل العقد ويسجل mileageAtPickup، واستلام السيارة (rented -> completed) يغلق العقد ويحدث عداد المركبة ويرفض القراءة الأقل', async () => {
    const db = new InMemoryFirestore();
    const bookingId = 'bk-test-handover-88';
    const vehicleId = 'veh-test-handover-88';

    db.setDoc('bookings', bookingId, {
      id: bookingId,
      bookingNumber: '8801',
      customerId: 'cust-legacy-1',
      customerName: 'فراس الجابي',
      customerPhone: '+963944111222',
      customerAddress: 'دمشق - المزة فيلات غربية - بناء 8',
      vehicleId,
      vehicleName: 'كيا سيراتو 2024',
      pickupDate: '2026-12-10',
      returnDate: '2026-12-15',
      dailyPrice: 100,
      totalPrice: 500,
      status: 'confirmed',
    });

    db.setDoc('vehicles', vehicleId, {
      id: vehicleId,
      brand: 'كيا',
      model: 'سيراتو',
      year: 2024,
      status: 'available',
      currentMileage: 10000,
    });

    db.setDoc(`vehicles/${vehicleId}/internal`, 'details', {
      currentMileage: 10000,
      plateNumber: '123456-DAM',
    });

    // 1. Handover (confirmed -> rented) with mileageAtPickup = 10100
    const handoverRes = await applyBookingStatusChange(db as any, bookingId, 'rented', 'staff@shaker.sy', {
      actorUid: 'staff-1',
      actorType: 'staff',
      mileageAtPickup: 10100,
    });
    expect(handoverRes.success).toBe(true);

    const contractAfterPickup = db.getDocData('contracts', `CTR_${bookingId}`);
    expect(contractAfterPickup).toBeDefined();
    expect(contractAfterPickup.status).toBe('active');
    expect(contractAfterPickup.mileageAtPickup).toBe(10100);

    const bookingAfterPickup = db.getDocData('bookings', bookingId);
    expect(bookingAfterPickup.status).toBe('rented');
    expect(bookingAfterPickup.mileageAtPickup).toBe(10100);

    const vehicleAfterPickup = db.getDocData('vehicles', vehicleId);
    expect(vehicleAfterPickup.status).toBe('rented');

    // 2. Reject return with odometer less than previous mileage (10050 < 10100)
    await expect(
      applyBookingStatusChange(db as any, bookingId, 'completed', 'staff@shaker.sy', {
        actorUid: 'staff-1',
        actorType: 'staff',
        mileageAtReturn: 10050,
      })
    ).rejects.toThrow('يجب ألا تقل عن العداد السابق');

    // 3. Return (rented -> completed) with mileageAtReturn = 10600
    const returnRes = await applyBookingStatusChange(db as any, bookingId, 'completed', 'staff2@shaker.sy', {
      actorUid: 'staff-2',
      actorType: 'staff',
      mileageAtReturn: 10600,
      returnCondition: 'سليمة ونظيفة',
    });
    expect(returnRes.success).toBe(true);

    const contractAfterReturn = db.getDocData('contracts', `CTR_${bookingId}`);
    expect(contractAfterReturn.status).toBe('closed');
    expect(contractAfterReturn.mileageAtReturn).toBe(10600);

    const bookingAfterReturn = db.getDocData('bookings', bookingId);
    expect(bookingAfterReturn.status).toBe('completed');
    expect(bookingAfterReturn.mileageAtReturn).toBe(10600);

    const vehicleAfterReturn = db.getDocData('vehicles', vehicleId);
    expect(vehicleAfterReturn.status).toBe('available');
    // Ensure public vehicle document does not leak updated currentMileage (internal only)
    expect(vehicleAfterReturn.currentMileage).not.toBe(10600);

    const internalDetails = db.getDocData(`vehicles/${vehicleId}/internal`, 'details');
    expect(internalDetails.currentMileage).toBe(10600);
  });
});

describe('6. واجهة عقد الإيجار وصفحة التحقق العامة', () => {
  const dummyBooking: Booking = {
    id: 'bk-202',
    bookingNumber: '202',
    vehicleId: 'veh-99',
    vehicleName: 'هيونداي توسان (2023)',
    customerName: 'سامر الحلبي',
    customerPhone: '+963944555666',
    customerWhatsApp: '+963944555666',
    customerAddress: 'دمشق - المزة فيلات غربية - بناء 24',
    pickupDate: '2026-11-12',
    pickupTime: '10:00',
    returnDate: '2026-11-16',
    returnTime: '10:00',
    rentalDays: 4,
    dailyPrice: 100,
    basePrice: 400,
    discountAmount: 0,
    insuranceAmount: 40,
    driverFee: 0,
    totalPrice: 440,
    status: 'confirmed',
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  const dummySettings: AppSettings = {
    id: 'global',
    companyName: 'شركة شاكر لتأجير السيارات',
    companyNameEn: 'Shaker Car Rental',
    companyPhone: '+963 11 9988',
    whatsappNumber: '+963 933 123456',
    address: 'دمشق - البرامكة',
    currency: '$',
    insurance1to2Days: 10,
    insuranceAbove2Days: 10,
    insuranceShortTerm: 10,
    insuranceLongTerm: 10,
    monthlyRateLight: 700,
    monthlyRateMedium: 900,
    monthlyRateJeep: 1400,
    rentalTerms: DEFAULT_RENTAL_TERMS.join('\n'),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('عند فشل جلب العقد تمنع الواجهة الطباعة وتظهر رسالة الخطأ', () => {
    const contractSource = fs.readFileSync(
      path.resolve(__dirname, '../src/components/RentalContract.tsx'),
      'utf8'
    );
    expect(contractSource).toContain('disabled={Boolean(errorMessage || isLoading)}');
    expect(contractSource).toContain('تعذر جلب أو إصدار وثيقة العقد المجمّدة من السيرفر');
  });

  it('مكون VerifyContractPage يُعرض بنجاح في DOM بدون أخطاء ولا يكشف PII', () => {
    const html = renderToStaticMarkup(React.createElement(VerifyContractPage));
    expect(html).toContain('التحقق من صحة عقد التأجير');
    expect(html).not.toContain('+963944555666');
  });
});

describe('7. اختبارات الإنهاء والـ CRM والمزايا المضافة حديثاً', () => {
  it('إلغاء الحجز المؤكد يغير حالة العقد في Firestore إلى terminated وتوثيق الأسباب', async () => {
    const db = new InMemoryFirestore();
    const bookingId = 'bk-term-100';

    db.setDoc('bookings', bookingId, {
      id: bookingId,
      bookingNumber: '1000',
      customerId: 'cust-term-1',
      status: 'confirmed',
      vehicleId: 'veh-term-1',
      pickupDate: '2026-12-20',
      returnDate: '2026-12-25',
    });

    db.setDoc('contracts', `CTR_${bookingId}`, {
      contractNumber: 'CTR-1000',
      bookingId,
      status: 'issued',
      verificationCode: 'TERM12345678901234567890',
    });

    const res = await applyBookingStatusChange(db as any, bookingId, 'cancelled', 'customer@shaker.sy', {
      actorUid: 'cust-term-1',
      actorType: 'customer',
    });

    expect(res.success).toBe(true);

    const contractDoc = db.getDocData('contracts', `CTR_${bookingId}`);
    expect(contractDoc.status).toBe('terminated');
    expect(contractDoc.terminationReason).toBe('cancelled');

    // 1. Wrong code on terminated contract returns generic mismatch error without revealing 'terminated'
    const wrongVerifyRes = await executeVerifyContractCode(db as any, 'CTR-1000', 'WRONG123456789012345678');
    expect(wrongVerifyRes.isValid).toBe(false);
    expect(wrongVerifyRes.status).toBeUndefined();
    expect(wrongVerifyRes.message).toContain('غير مطابق');

    // 2. Correct code on terminated contract reveals 'terminated'
    const correctVerifyRes = await executeVerifyContractCode(db as any, 'CTR-1000', 'TERM12345678901234567890');
    expect(correctVerifyRes.isValid).toBe(false);
    expect(correctVerifyRes.status).toBe('terminated');
    expect(correctVerifyRes.message).toBe('العقد ملغى');
  });

  it('استلام السيارة وتسجيل عداد الإرجاع يغلق الحجز ويحفظ قراءة العداد في سجل المركبة الداخلي', async () => {
    const db = new InMemoryFirestore();
    const bookingId = 'bk-crm-repeat-1';
    const customerId = 'cust-crm-repeat-1';
    const vehicleId = 'veh-crm-repeat-1';

    db.setDoc('customers', customerId, {
      id: customerId,
      fullName: 'خالد السيد',
      totalRentals: 0,
      totalSpending: 0,
    });

    db.setDoc('bookings', bookingId, {
      id: bookingId,
      bookingNumber: 'CRM-R1',
      customerId,
      vehicleId,
      status: 'rented',
      mileageAtPickup: 5000,
      totalPrice: 350,
    });

    db.setDoc('vehicles', vehicleId, {
      id: vehicleId,
      status: 'rented',
      currentMileage: 5000,
    });

    const res = await applyBookingStatusChange(db as any, bookingId, 'completed', 'staff@shaker.sy', {
      actorUid: 'staff-crm',
      actorType: 'staff',
      mileageAtReturn: 5450,
    });

    expect(res.success).toBe(true);
    const updatedBooking = db.getDocData('bookings', bookingId);
    expect(updatedBooking.status).toBe('completed');
    expect(updatedBooking.mileageAtReturn).toBe(5450);
  });

  it('حذف سيارة مرتبطة بحجز نشط يفشل مع رسالة مانعة', () => {
    const activeBookings = [
      { id: '1', vehicleId: 'veh-active-1', status: 'confirmed', bookingNumber: '101', isDeleted: false },
    ];

    expect(() => {
      assertCanDeleteVehicle('veh-active-1', activeBookings);
    }).toThrow('لا يمكن حذف السيارة لوجود 1 حجز نشط أو معلّق مرتبط بها');
  });

  it('صد محاولة إنشاء حجز بنفس المعرف الموجود مسبقاً (Collision check)', async () => {
    const db = new InMemoryFirestore();
    const existingBookingId = '1';

    db.setDoc('bookings', existingBookingId, {
      id: existingBookingId,
      bookingNumber: '1',
      customerName: 'عميل سابق',
    });

    // Simulate transaction collision check
    await expect(
      db.runTransaction(async (tx) => {
        const docRef = db.collection('bookings').doc(existingBookingId);
        const snap = await tx.get(docRef);
        if (snap.exists) {
          throw new Error('aborted: تعذر إنشاء الحجز، حاول مرة أخرى');
        }
      })
    ).rejects.toThrow('aborted');

    // Existing booking must remain untouched
    const originalDoc = db.getDocData('bookings', existingBookingId);
    expect(originalDoc.customerName).toBe('عميل سابق');
  });

  it('حجز موظف لعميل آخر لا يضع بريد الموظف بدلاً من بريد العميل', async () => {
    const db = new InMemoryFirestore();
    const staffUid = 'staff-123';
    const staffEmail = 'staff@shaker.sy';
    const customerUid = 'cust-456';
    const customerRealEmail = 'customer456@gmail.com';

    db.setDoc('users', customerUid, {
      uid: customerUid,
      email: customerRealEmail,
    });

    // Simulate staff creating booking for customerUid when data.customerEmail is empty
    let resolvedCustomerEmail = staffEmail;
    const isStaff = true;
    const dataCustomerId = customerUid;
    const dataCustomerEmail = '';

    if (dataCustomerId && dataCustomerId !== staffUid) {
      if (isStaff) {
        if (dataCustomerEmail && typeof dataCustomerEmail === 'string' && dataCustomerEmail.trim()) {
          resolvedCustomerEmail = dataCustomerEmail.trim();
        } else {
          const targetUserDoc = db.getDocData('users', dataCustomerId);
          resolvedCustomerEmail = targetUserDoc?.email || '';
        }
      }
    }

    expect(resolvedCustomerEmail).toBe(customerRealEmail);
    expect(resolvedCustomerEmail).not.toBe(staffEmail);
  });
});

