import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { isUserVerified as serverIsUserVerified } from '../functions/src/verificationStatus';
import {
  isUserVerified as clientIsUserVerified,
  getVerificationState,
} from '../src/utils/verification';

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

  describe('getVerificationState', () => {
    it('1) returns "verified" when verification request status is verified', () => {
      expect(getVerificationState({ verified: false, verificationStatus: 'not_started' }, { status: 'verified' })).toBe('verified');
      expect(getVerificationState(null, { status: 'verified' })).toBe('verified');
    });

    it('2) returns "pending_review" when verification request status is pending_review', () => {
      expect(getVerificationState({ verified: false }, { status: 'pending_review' })).toBe('pending_review');
      expect(getVerificationState(undefined, { status: 'pending_review' })).toBe('pending_review');
    });

    it('3) returns "rejected" when verification request status is rejected', () => {
      expect(getVerificationState({ verified: true }, { status: 'rejected' })).toBe('rejected');
      expect(getVerificationState(null, { status: 'rejected' })).toBe('rejected');
    });

    it('4) returns "unverified" when request status is not_started even with a legacy verified user', () => {
      expect(
        getVerificationState(
          { verified: true, verificationStatus: 'verified' },
          { status: 'not_started' }
        )
      ).toBe('unverified');
      expect(getVerificationState({ verified: true }, { status: 'unsubmitted' })).toBe('unverified');
    });

    it('5) returns "verified" when no request exists and user has verified === true or verificationStatus === "verified"', () => {
      expect(getVerificationState({ verified: true }, null)).toBe('verified');
      expect(getVerificationState({ verificationStatus: 'verified' }, undefined)).toBe('verified');
    });

    it('6) returns "unverified" when no request exists and user has no verification fields (or null/undefined)', () => {
      expect(getVerificationState({}, null)).toBe('unverified');
      expect(getVerificationState(null, null)).toBe('unverified');
      expect(getVerificationState(undefined, undefined)).toBe('unverified');
    });

    it('7) falls back to user.verificationStatus for pending_review and rejected when no request exists', () => {
      expect(getVerificationState({ verificationStatus: 'pending_review' }, null)).toBe('pending_review');
      expect(getVerificationState({ verificationStatus: 'rejected' }, undefined)).toBe('rejected');
      expect(getVerificationState({ verificationStatus: 'not_started' }, null)).toBe('unverified');
    });
  });
});

describe('bookingFunctions.ts transaction order & pattern check', () => {
  const root = path.resolve(__dirname, '..');
  const bookingCode = fs.readFileSync(path.join(root, 'functions/src/bookingFunctions.ts'), 'utf8');

  it('ensures all transaction.get occur before any transaction.set/update/delete', () => {
    const startMarker = 'return await db.runTransaction(async (transaction) => {';
    const endMarker = 'writeAudit(db, transaction';

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
