import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!hasEmulator)('Firestore Security Rules TDD Suite', () => {
  beforeAll(async () => {
    const rules = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: 'ai-studio-shakercarrental-8ca1f5c8-9251-4c7d-b28c-5a1ee6a1a1e1',
      firestore: {
        rules,
      },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv?.clearFirestore();
  });

  it('should prevent unauthenticated users from reading private user documents', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const userDoc = unauthDb.collection('users').doc('user-123');
    await expect(userDoc.get()).rejects.toThrow();
  });

  it('should allow customer to read their own user document but block reading another user', async () => {
    const customerContext = testEnv.authenticatedContext('cust-123', { role: 'customer' });
    const db = customerContext.firestore();

    const ownDoc = db.collection('users').doc('cust-123');
    const otherDoc = db.collection('users').doc('cust-456');

    // Own doc read permitted
    await expect(ownDoc.get()).resolves.toBeDefined();

    // Other doc read rejected
    await expect(otherDoc.get()).rejects.toThrow();
  });

  it('should block customer from self-assigning admin or verified status on creation', async () => {
    const customerContext = testEnv.authenticatedContext('cust-123', { role: 'customer' });
    const db = customerContext.firestore();

    const maliciousSelfDoc = db.collection('users').doc('cust-123');

    // Attempting to set verified = true or role = admin
    await expect(
      maliciousSelfDoc.set({
        uid: 'cust-123',
        name: 'Attacker',
        role: 'admin',
        verified: true,
      })
    ).rejects.toThrow();
  });

  it('should block hard deletion of bookings by any client role', async () => {
    const adminContext = testEnv.authenticatedContext('admin-123', { role: 'admin', admin: true });
    const db = adminContext.firestore();

    const bookingDoc = db.collection('bookings').doc('bk-999');
    await expect(bookingDoc.delete()).rejects.toThrow();
  });

  it('should block vehicle creation containing plateNumber in public vehicles document', async () => {
    const adminContext = testEnv.authenticatedContext('admin-123', { role: 'admin', admin: true });
    const db = adminContext.firestore();

    const vehicleDoc = db.collection('vehicles').doc('veh-101');
    await expect(
      vehicleDoc.set({
        brand: 'Hyundai',
        model: 'Elantra',
        year: 2024,
        plateNumber: '123456-DAM', // Forbidden in top-level public doc
      })
    ).rejects.toThrow();
  });

  it('should block direct vehicle creation even by admin (must use Cloud Functions)', async () => {
    const adminContext = testEnv.authenticatedContext('admin-123', { role: 'admin', admin: true });
    const db = adminContext.firestore();

    const vehicleDoc = db.collection('vehicles').doc('veh-999');
    await expect(
      vehicleDoc.set({
        brand: 'Kia',
        model: 'Sportage',
        year: 2024,
        category: 'jeep_7seats',
        dailyPrice: 80,
      })
    ).rejects.toThrow();
  });

  it('should reject employee and allow admin on vehicles/{vehicleId}/internal/{docId}', async () => {
    const employeeContext = testEnv.authenticatedContext('emp-123', { role: 'employee', employee: true });
    const empDb = employeeContext.firestore();
    const internalDocEmp = empDb.collection('vehicles').doc('veh-101').collection('internal').doc('details');

    // Employee cannot read or write internal subcollection
    await expect(internalDocEmp.get()).rejects.toThrow();
    await expect(internalDocEmp.set({ plateNumber: '123456', currentMileage: 25000 })).rejects.toThrow();

    const adminContext = testEnv.authenticatedContext('admin-123', { role: 'admin', admin: true });
    const adminDb = adminContext.firestore();
    const internalDocAdmin = adminDb.collection('vehicles').doc('veh-101').collection('internal').doc('details');

    // Admin is allowed to read and write internal subcollection
    await expect(internalDocAdmin.set({ plateNumber: '123456', currentMileage: 25000 })).resolves.toBeUndefined();
    await expect(internalDocAdmin.get()).resolves.toBeDefined();
  });

  it('should allow customer to read own verificationRequest but block client write', async () => {
    const customerContext = testEnv.authenticatedContext('cust-123', { role: 'customer' });
    const db = customerContext.firestore();

    const ownReq = db.collection('verificationRequests').doc('cust-123');
    // Read allowed
    await expect(ownReq.get()).resolves.toBeDefined();

    // Client write strictly forbidden
    await expect(
      ownReq.set({
        status: 'verified',
        identityDocType: 'national_id',
      })
    ).rejects.toThrow();
  });

  it('should block customer from reading another user verificationRequest', async () => {
    const customerContext = testEnv.authenticatedContext('cust-123', { role: 'customer' });
    const db = customerContext.firestore();

    const otherReq = db.collection('verificationRequests').doc('cust-456');
    await expect(otherReq.get()).rejects.toThrow();
  });

  it('should allow admin to read all verificationRequests and block client writes by any staff/admin', async () => {
    const adminContext = testEnv.authenticatedContext('admin-123', { role: 'admin', admin: true });
    const db = adminContext.firestore();

    const anyReq = db.collection('verificationRequests').doc('cust-789');
    await expect(anyReq.get()).resolves.toBeDefined();
    await expect(anyReq.set({ status: 'verified' })).rejects.toThrow();

    const empContext = testEnv.authenticatedContext('emp-123', { role: 'employee', employee: true });
    const empDb = empContext.firestore();
    const empOwnReq = empDb.collection('verificationRequests').doc('emp-123');
    await expect(empOwnReq.get()).rejects.toThrow();
    await expect(empOwnReq.set({ status: 'pending_review' })).rejects.toThrow();
  });

  it('should block customer from deleting files', async () => {
    const customerContext = testEnv.authenticatedContext('cust-123', { role: 'customer' });
    const db = customerContext.firestore();

    const fileDoc = db.collection('files').doc('file-abc');
    await expect(fileDoc.delete()).rejects.toThrow();
  });

  it('should block employee from reading frozen customer files', async () => {
    const employeeContext = testEnv.authenticatedContext('emp-123', { role: 'employee' });
    const db = employeeContext.firestore();

    const topFile = db.collection('files').doc('file-abc');
    await expect(topFile.get()).rejects.toThrow();

    const userFile = db.collection('users').doc('cust-123').collection('files').doc('file-abc');
    await expect(userFile.get()).rejects.toThrow();
  });

  it('should block customer/owner from reading, writing, or deleting in legacy files', async () => {
    const customerContext = testEnv.authenticatedContext('cust-123', { role: 'customer' });
    const db = customerContext.firestore();

    const topFile = db.collection('files').doc('file-abc');
    await expect(topFile.get()).rejects.toThrow();
    await expect(topFile.set({ id: 'file-abc', userId: 'cust-123', fileName: 'test.jpg' })).rejects.toThrow();
    await expect(topFile.delete()).rejects.toThrow();

    const ownSubFile = db.collection('users').doc('cust-123').collection('files').doc('file-abc');
    await expect(ownSubFile.get()).rejects.toThrow();
    await expect(ownSubFile.set({ id: 'file-abc', userId: 'cust-123', fileName: 'test.jpg' })).rejects.toThrow();
    await expect(ownSubFile.delete()).rejects.toThrow();
  });

  it('should block unauthenticated visitors from reading or writing files and verificationRequests', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    const topFile = unauthDb.collection('files').doc('file-abc');
    await expect(topFile.get()).rejects.toThrow();
    await expect(topFile.set({ id: 'file-abc', fileName: 'test.jpg' })).rejects.toThrow();

    const userFile = unauthDb.collection('users').doc('cust-123').collection('files').doc('file-abc');
    await expect(userFile.get()).rejects.toThrow();

    const verReq = unauthDb.collection('verificationRequests').doc('cust-123');
    await expect(verReq.get()).rejects.toThrow();
    await expect(verReq.set({ status: 'verified' })).rejects.toThrow();
  });

  it('should restrict vehicle internal document read and write to admin only', async () => {
    const customerDb = testEnv.authenticatedContext('cust-123', { role: 'customer' }).firestore();
    const employeeDb = testEnv.authenticatedContext('emp-123', { role: 'employee', employee: true }).firestore();
    const adminDb = testEnv.authenticatedContext('admin-123', { role: 'admin', admin: true }).firestore();

    const customerInternal = customerDb.collection('vehicles').doc('veh-100').collection('internal').doc('details');
    const employeeInternal = employeeDb.collection('vehicles').doc('veh-100').collection('internal').doc('details');
    const adminInternal = adminDb.collection('vehicles').doc('veh-100').collection('internal').doc('details');

    // Customer & employee blocked from read and write
    await expect(customerInternal.get()).rejects.toThrow();
    await expect(customerInternal.set({ plateNumber: '123' })).rejects.toThrow();
    await expect(employeeInternal.get()).rejects.toThrow();
    await expect(employeeInternal.set({ plateNumber: '123' })).rejects.toThrow();

    // Admin allowed to read and write
    await expect(adminInternal.get()).resolves.toBeDefined();
    await expect(adminInternal.set({ plateNumber: '123-DAM' })).resolves.toBeUndefined();
  });

  it('should block customer and admin from writing directly to contracts collection (allow write: if false)', async () => {
    const customerDb = testEnv.authenticatedContext('cust-123', { role: 'customer' }).firestore();
    const adminDb = testEnv.authenticatedContext('admin-123', { role: 'admin', admin: true }).firestore();

    const customerContract = customerDb.collection('contracts').doc('CTR_1');
    const adminContract = adminDb.collection('contracts').doc('CTR_1');

    // Customer write and update blocked
    await expect(customerContract.set({ contractNumber: 'CTR-1' })).rejects.toThrow();
    await expect(customerContract.update({ status: 'active' })).rejects.toThrow();

    // Admin direct client write and update blocked (functions only)
    await expect(adminContract.set({ contractNumber: 'CTR-1' })).rejects.toThrow();
    await expect(adminContract.update({ status: 'active' })).rejects.toThrow();
    await expect(adminContract.delete()).rejects.toThrow();
  });

  it('should enforce size constraints on users collection (address <= 300, name <= 100, displayName <= 100, empty/missing allowed)', async () => {
    const customerContext = testEnv.authenticatedContext('cust-size-1', { role: 'customer' });
    const db = customerContext.firestore();
    const userRef = db.collection('users').doc('cust-size-1');

    // 1. address = 300 chars (accepted)
    await expect(
      userRef.set({
        id: 'cust-size-1',
        uid: 'cust-size-1',
        address: 'A'.repeat(300),
      })
    ).resolves.toBeUndefined();

    // 2. address = 301 chars (rejected)
    const userRef2 = db.collection('users').doc('cust-size-2');
    const customer2 = testEnv.authenticatedContext('cust-size-2', { role: 'customer' }).firestore();
    await expect(
      customer2.collection('users').doc('cust-size-2').set({
        id: 'cust-size-2',
        uid: 'cust-size-2',
        address: 'A'.repeat(301),
      })
    ).rejects.toThrow();

    // 3. address = "" (accepted)
    const userRef3 = db.collection('users').doc('cust-size-3');
    const customer3 = testEnv.authenticatedContext('cust-size-3', { role: 'customer' }).firestore();
    await expect(
      customer3.collection('users').doc('cust-size-3').set({
        id: 'cust-size-3',
        uid: 'cust-size-3',
        address: '',
      })
    ).resolves.toBeUndefined();

    // 4. name > 100 chars (rejected)
    await expect(
      userRef.update({
        name: 'B'.repeat(101),
      })
    ).rejects.toThrow();

    // 5. displayName > 100 chars (rejected)
    await expect(
      userRef.update({
        displayName: 'C'.repeat(101),
      })
    ).rejects.toThrow();

    // 6. name & displayName <= 100 chars (accepted)
    await expect(
      userRef.update({
        name: 'B'.repeat(100),
        displayName: 'C'.repeat(100),
      })
    ).resolves.toBeUndefined();
  });

  it('should prevent employee from updating restricted CRM customer fields (totalSpending, totalRentals, nationalId, licenseNumber, notes, tags) while allowing safe fields', async () => {
    // Setup existing customer via admin
    const adminDb = testEnv.authenticatedContext('admin-1', { role: 'admin' }).firestore();
    const custRef = adminDb.collection('customers').doc('cust-crm-1');
    await custRef.set({
      id: 'cust-crm-1',
      fullName: 'أحمد محمود',
      phone: '+963911223344',
      totalRentals: 2,
      totalSpending: 250,
      nationalId: '01020304050',
      licenseNumber: 'LIC-9988',
      notes: 'ملاحظة أولية',
      tags: ['vip'],
    });

    const empDb = testEnv.authenticatedContext('emp-1', { role: 'employee' }).firestore();
    const empCustRef = empDb.collection('customers').doc('cust-crm-1');

    // Safe update by employee (phone / address / fullName) permitted
    await expect(
      empCustRef.update({
        phone: '+963955667788',
        address: 'دمشق - الميدان',
      })
    ).resolves.toBeUndefined();

    // Restricted fields rejected for employee
    await expect(empCustRef.update({ totalSpending: 500 })).rejects.toThrow();
    await expect(empCustRef.update({ totalRentals: 5 })).rejects.toThrow();
    await expect(empCustRef.update({ nationalId: '12345678901' })).rejects.toThrow();
    await expect(empCustRef.update({ licenseNumber: 'LIC-0000' })).rejects.toThrow();
    await expect(empCustRef.update({ notes: 'تعديل موظف' })).rejects.toThrow();
    await expect(empCustRef.update({ tags: ['blacklist'] })).rejects.toThrow();

    // Admin can update them
    await expect(
      custRef.update({
        notes: 'ملاحظة المدير مقبولة',
        tags: ['regular'],
      })
    ).resolves.toBeUndefined();
  });
});

