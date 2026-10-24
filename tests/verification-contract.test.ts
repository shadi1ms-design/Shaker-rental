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
  it('createBookingSecure does not require a verified account', () => {
    const booking = read('functions/src/bookingFunctions.ts');
    expect(booking).not.toMatch(/Verified Account Requirement/);
    expect(booking).not.toMatch(/'ver'\s*\+/);
    const gates = booking.match(/[^\n]*!customerVerified[^\n]*/g) ?? [];
    expect(gates.length).toBe(1);
    expect(gates[0]).toMatch(/deliveryLocation/);
  });

  it('BookingModal does not block submission on verification', () => {
    const modal = read('src/components/BookingModal.tsx');
    expect(modal).not.toMatch(/setIsUserVerified|useState<boolean \| null>\(null\)/);
    const btn = modal.match(/<button[^>]*id="booking-step2-submit-btn"[^>]*>/)?.[0] ?? '';
    expect(btn).toContain('disabled=');
    expect(btn).not.toMatch(/verif/i);
  });
});
