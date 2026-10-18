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
});
