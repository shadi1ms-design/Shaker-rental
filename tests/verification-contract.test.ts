import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Static contract + invariant checks (no emulator needed). They exist because the first
 * implementation shipped with client/server field-name mismatches that no test caught.
 */
const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const server = read('functions/src/verifyCustomerIdentity.ts');
const client = read('src/services/functionsService.ts');

/** Extracts the keys of the params object literal of a functionsService method. */
function clientKeys(method: string): string[] {
  const start = client.indexOf(`public async ${method}(`);
  expect(start).toBeGreaterThan(-1);
  const open = client.indexOf('{', start);
  let depth = 0;
  let i = open;
  for (; i < client.length; i++) {
    if (client[i] === '{') depth++;
    if (client[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = client.slice(open + 1, i);
  const keys: string[] = [];
  // top-level keys only (depth 0 inside the literal)
  let d = 0;
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(\w+)\??:/);
    if (m && d === 0) keys.push(m[1]);
    d += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
  }
  return keys;
}

describe('verification client ↔ server contract', () => {
  const methods = [
    'submitVerificationDocument',
    'submitVerificationRequest',
    'reviewVerification',
    'revokeVerification',
    'getVerificationDocumentUrl',
  ];

  for (const method of methods) {
    it(`server reads every field that ${method} sends`, () => {
      const keys = clientKeys(method);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(server, `server never reads data.${key} (sent by ${method})`).toMatch(
          new RegExp(`data\\.${key}\\b|data\\?\\.${key}\\b`)
        );
      }
    });
  }

  it('getVerificationDocumentUrl response carries the "url" field the admin UI reads', () => {
    expect(server).toMatch(/url: signedUrl/);
  });

  it('initiateVerificationSession returns sessionId and nonce the profile UI reads', () => {
    expect(server).toMatch(/sessionId: nonce/);
  });

  it('never queries auditLogs with an inequality filter (would need an undeployed composite index)', () => {
    expect(server).not.toMatch(/where\('timestamp',\s*'>='/);
  });

  it('review/approve is gated on a submitted (pending_review) request', () => {
    expect(server).toMatch(/reqData\.status !== 'pending_review'/);
  });

  it('uploads can never be attached to a locked request', () => {
    expect(server).toMatch(/lockStatus === 'pending_review' \|\| lockStatus === 'verified'/);
    expect(server).toMatch(/cur\?\.status === 'pending_review' \|\| cur\?\.status === 'verified'/);
  });
});

describe('security rules invariants (static)', () => {
  const storage = read('storage.rules');
  const firestore = read('firestore.rules');

  it('verification buckets are closed to every client', () => {
    expect(storage).toMatch(/match \/verification_pending\/\{allPaths=\*\*\} \{\s*allow read, write: if false;/);
    expect(storage).toMatch(/match \/verification_vault\/\{allPaths=\*\*\} \{\s*allow read, write: if false;/);
  });

  it('no storage rule lets an owner or employee delete/create user document paths', () => {
    const legacy = storage.slice(storage.indexOf('LEGACY CUSTOMER DOCUMENT PATHS'), storage.indexOf('DIGITAL CONTRACTS'));
    expect(legacy).toMatch(/allow write: if false;/);
    expect(legacy).not.toMatch(/request\.auth\.uid == userId[^;]*;\s*\n?\s*allow (delete|create)/);
    expect(legacy).not.toMatch(/isEmployee\(\)/);
  });

  it('legacy files collections are frozen for clients', () => {
    expect(firestore).not.toMatch(/match \/files\/\{fileId\} \{[^}]*allow (create|update|delete): if (?!false)/);
    expect(firestore.match(/allow write: if false;/g)!.length).toBeGreaterThan(3);
  });
});

describe('booking is NOT gated on account verification', () => {
  it('createBookingSecure does not require a verified account or gate deliveryLocation on verification', () => {
    const booking = read('functions/src/bookingFunctions.ts');
    expect(booking).not.toMatch(/Verified Account Requirement/);
    expect(booking).not.toMatch(/'ver'\s*\+/);
    expect(booking).not.toMatch(/!customerVerified/);
    expect(booking).not.toMatch(/isUserVerified/);
    expect(booking).not.toContain('خدمة التسليم أينما كنت للحسابات الموثقة فقط');
    expect(booking).toContain('String(data.deliveryLocation || \'\').trim().slice(0, 150)');
  });

  it('BookingView does not block submission or deliveryLocation on verification', () => {
    const modal = read('src/components/BookingView.tsx');
    expect(modal).not.toMatch(/setIsUserVerified|useState<boolean \| null>\(null\)/);
    expect(modal).not.toMatch(/isUserVerified/);
    expect(modal).not.toMatch(/onOpenProfile/);
    expect(modal).not.toContain('للموثقين فقط');
    expect(modal).not.toContain('وثّق حسابك');

    const btn = modal.match(/<button[^>]*id="booking-step2-submit-btn"[^>]*>/)?.[0] ?? '';
    expect(btn).toContain('disabled=');
    expect(btn).not.toMatch(/verif/i);

    const deliveryBlock = modal.slice(
      modal.indexOf('id="booking-delivery-location"'),
      modal.indexOf('id="booking-delivery-location"') + 350
    );
    expect(deliveryBlock).not.toContain('disabled');
  });

  it('Admin booking views do not display or pass verificationStatus badges', () => {
    const bookingsTable = read('src/components/admin/bookings/BookingsTable.tsx');
    const detailsModal = read('src/components/admin/AdminBookingDetailsModal.tsx');
    const adminBookings = read('src/components/admin/AdminBookings.tsx');

    expect(bookingsTable).not.toContain('verificationStatus');
    expect(bookingsTable).not.toContain('vStatus');
    expect(bookingsTable).not.toContain('مرفوض الهوية');

    expect(detailsModal).not.toContain('verificationStatus');
    expect(detailsModal).not.toContain('هوية موثقة');
    expect(detailsModal).not.toContain('قيد التدقيق اليدوي');

    expect(adminBookings).not.toContain('verificationStatus');
  });
});

import { cleanupStaffVerificationOnPromotion, VERIFICATION_FIELDS_TO_REMOVE } from '../functions/src/userManagement';
import { shouldApplyChanges, hasAnyVerificationField } from '../scripts/cleanup_staff_verification_fields';

describe('staff vs customer verification separation invariants', () => {
  it('verifyCustomerIdentity enforces customer-only caller and target guards', () => {
    expect(server).toMatch(/isCallerStaff/);
    expect(server).toMatch(/assertCallerIsCustomer/);
    expect(server).toMatch(/assertTargetIsCustomer/);

    // Ensure initiateVerificationSession, submitVerificationDocument, submitVerificationRequest call assertCallerIsCustomer
    const initSection = server.slice(server.indexOf('export const initiateVerificationSession'), server.indexOf('export const submitVerificationDocument'));
    const docSection = server.slice(server.indexOf('export const submitVerificationDocument'), server.indexOf('export const submitVerificationRequest'));
    const reqSection = server.slice(server.indexOf('export const submitVerificationRequest'), server.indexOf('export const reviewVerification'));
    expect(initSection).toContain('assertCallerIsCustomer');
    expect(docSection).toContain('assertCallerIsCustomer');
    expect(reqSection).toContain('assertCallerIsCustomer');

    // Ensure reviewVerification and revokeVerification call assertTargetIsCustomer
    const reviewSection = server.slice(server.indexOf('export const reviewVerification'), server.indexOf('export const revokeVerification'));
    const revokeSection = server.slice(server.indexOf('export const revokeVerification'), server.indexOf('export const getVerificationDocumentUrl'));
    expect(reviewSection).toContain('assertTargetIsCustomer');
    expect(revokeSection).toContain('assertTargetIsCustomer');
  });

  it('ProfileView restricts customer verification/booking listeners strictly to customer role and drops customerAreaOpen', () => {
    const profileView = read('src/components/ProfileView.tsx');
    expect(profileView).toContain("const shouldLoadCustomerData = role === 'customer';");
    expect(profileView).not.toContain('customerAreaOpen');
  });

  it('storage.rules and firestore.rules block archive and restrict verificationRequests reads from non-admin staff', () => {
    const storage = read('storage.rules');
    const firestore = read('firestore.rules');
    expect(storage).toMatch(/match \/verification_archive\/\{allPaths=\*\*\} \{\s*allow read, write: if false;/);
    expect(firestore).toMatch(/match \/verificationRequestsArchive\/\{archiveId\} \{\s*allow read, write: if false;/);
    expect(firestore).toContain('isAdmin() || (isSignedIn() && !isEmployee() && request.auth.uid == userId)');
  });

  it('cleanupStaffVerificationOnPromotion deletes verification fields from users/customers and archives verificationRequests without touching Storage', async () => {
    const store: Record<string, Record<string, any>> = {
      'users/u-1': { uid: 'u-1', role: 'employee', verified: true, verificationStatus: 'verified' },
      'customers/u-1': { id: 'u-1', verified: true, verificationStatus: 'verified' },
      'verificationRequests/u-1': {
        userId: 'u-1',
        status: 'verified',
        docs: { driver_license: { storagePath: 'verification_vault/u-1/driver_license.jpg' } },
      },
    };
    const deletedDocs: string[] = [];

    const docRef = (col: string, id: string) => ({
      path: `${col}/${id}`,
      get: async () => ({
        exists: Boolean(store[`${col}/${id}`]),
        data: () => store[`${col}/${id}`],
      }),
      set: async (data: Record<string, any>, _opts?: any) => {
        store[`${col}/${id}`] = { ...(store[`${col}/${id}`] || {}), ...data };
      },
    });

    const mockDb = {
      collection: (col: string) => ({
        doc: (id: string) => docRef(col, id),
      }),
      runTransaction: async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: any) => ref.get(),
          set: (ref: any, data: Record<string, any>) => {
            store[ref.path] = data;
          },
          delete: (ref: any) => {
            delete store[ref.path];
            deletedDocs.push(ref.path);
          },
        };
        return fn(tx);
      },
    };

    const res = await cleanupStaffVerificationOnPromotion(mockDb, {
      targetUid: 'u-1',
      callerUid: 'super-1',
      previousRole: 'customer',
      newRole: 'employee',
      nowIso: '2026-11-13T10:00:00.000Z',
    });

    expect(res.verificationFieldsCleaned).toBe(true);
    expect(res.archivedVerificationRequestId).toMatch(/^u-1_\d+$/);
    expect(deletedDocs).toEqual(['verificationRequests/u-1']);
    expect(store['verificationRequests/u-1']).toBeUndefined();

    const archiveDoc = store[`verificationRequestsArchive/${res.archivedVerificationRequestId}`];
    expect(archiveDoc).toBeDefined();
    expect(archiveDoc.archived).toBe(true);
    expect(archiveDoc.archivedReason).toBe('promoted_to_staff');
    expect(archiveDoc.previousRole).toBe('customer');
    expect(archiveDoc.newRole).toBe('employee');
    expect(archiveDoc.docs.driver_license.storagePath).toBe('verification_vault/u-1/driver_license.jpg');

    for (const field of VERIFICATION_FIELDS_TO_REMOVE) {
      expect(store['users/u-1'][field]).toBeDefined();
      expect(store['customers/u-1'][field]).toBeDefined();
    }
  });

  it('cleanup_staff_verification_fields script defaults to dry-run and applies only with --apply', () => {
    expect(shouldApplyChanges(['node', 'script.ts'])).toBe(false);
    expect(shouldApplyChanges(['node', 'script.ts', '--dry-run'])).toBe(false);
    expect(shouldApplyChanges(['node', 'script.ts', '--apply'])).toBe(true);

    expect(hasAnyVerificationField({ role: 'employee' })).toBe(false);
    expect(hasAnyVerificationField({ role: 'employee', verified: false })).toBe(true);
    expect(hasAnyVerificationField({ role: 'admin', verificationStatus: 'not_started' })).toBe(true);
  });
});
