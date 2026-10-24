import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { isUserVerified as serverIsUserVerified } from '../functions/src/verificationStatus';
import { isUserVerified as clientIsUserVerified } from '../src/utils/verification';

describe('verification-status unit tests', () => {
  const testFunctions = [
    { name: 'server isUserVerified', fn: serverIsUserVerified },
    { name: 'client isUserVerified', fn: clientIsUserVerified },
  ];

  for (const { name, fn } of testFunctions) {
    describe(name, () => {
      it('returns true when verified === true', () => {
        expect(fn({ verified: true })).toBe(true);
      });

      it('returns true when verificationStatus === "verified"', () => {
        expect(fn({ verificationStatus: 'verified' })).toBe(true);
      });

      it('returns false for null and undefined and empty object', () => {
        expect(fn(null)).toBe(false);
        expect(fn(undefined)).toBe(false);
        expect(fn({})).toBe(false);
      });

      it('returns false for string "true" in verified property', () => {
        expect(fn({ verified: 'true' })).toBe(false);
      });

      it('returns false for unverified status values', () => {
        const statuses = ['not_started', 'pending_review', 'rejected', 'manual_review', 'unverified'];
        for (const st of statuses) {
          expect(fn({ verificationStatus: st })).toBe(false);
          expect(fn({ verified: false, verificationStatus: st })).toBe(false);
        }
      });
    });
  }
});

describe('bookingFunctions.ts transaction order & pattern check', () => {
  const root = path.resolve(__dirname, '..');
  const bookingCode = fs.readFileSync(path.join(root, 'functions/src/bookingFunctions.ts'), 'utf8');

  it('ensures all transaction.get occur before any transaction.set/update/delete', () => {
    const startMarker = 'return await db.runTransaction(async (transaction) => {';
    const endMarker = 'transaction.set(auditRef';

    const startIndex = bookingCode.indexOf(startMarker);
    expect(startIndex).toBeGreaterThan(-1);

    const endIndex = bookingCode.indexOf(endMarker, startIndex);
    expect(endIndex).toBeGreaterThan(-1);

    const slice = bookingCode.slice(startIndex, endIndex);

    // Find indices of all gets and all sets/updates/deletes inside the transaction
    const getMatches = Array.from(slice.matchAll(/transaction\.get\(/g));
    const writeMatches = Array.from(slice.matchAll(/transaction\.(set|update|delete)\(/g));

    expect(getMatches.length).toBeGreaterThan(0);
    expect(writeMatches.length).toBeGreaterThan(0);

    const lastGetIndex = Math.max(...getMatches.map((m) => m.index ?? 0));
    const firstWriteIndex = Math.min(...writeMatches.map((m) => m.index ?? Infinity));

    expect(lastGetIndex).toBeLessThan(firstWriteIndex);
  });

  it('ensures bookingFunctions.ts does not contain the "ver" + pattern', () => {
    expect(bookingCode).not.toMatch(/'ver'\s*\+/);
  });
});
