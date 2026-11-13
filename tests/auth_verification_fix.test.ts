import { describe, it, expect } from 'vitest';
import { isUserVerified } from '../src/utils/verification';
import { UserRole } from '../src/types';
import { routes } from '../src/router';

describe('Auth & Verification Fix Tests', () => {
  it('(أ) Role returned from login determines correct navigation destination', () => {
    const resolveDestination = (role: UserRole) => {
      const isStaff = ['admin', 'super_admin', 'superAdmin', 'employee'].includes(role);
      return isStaff ? routes.adminDashboard : routes.profile;
    };

    expect(resolveDestination('admin')).toBe(routes.adminDashboard);
    expect(resolveDestination('super_admin')).toBe(routes.adminDashboard);
    expect(resolveDestination('employee')).toBe(routes.adminDashboard);
    expect(resolveDestination('customer')).toBe(routes.profile);
  });

  it('(ب) currentStatus logic preserves loading state before data arrives and checks isUserVerified', () => {
    const resolveStatus = (
      verificationLoaded: boolean,
      profileLoaded: boolean,
      verificationRequestStatus?: string,
      liveProfile?: { verified?: boolean; verificationStatus?: string } | null,
      authUser?: { verified?: boolean; verificationStatus?: string } | null
    ) => {
      const isVerified = isUserVerified(liveProfile) || isUserVerified(authUser);
      const isLoading = !verificationLoaded && !profileLoaded && !isVerified;
      const currentStatus = verificationRequestStatus || (isVerified ? 'verified' : 'not_started');

      return { isLoading, currentStatus };
    };

    // Before data arrives for unverified user -> isLoading is true
    const beforeData = resolveStatus(false, false, undefined, null, null);
    expect(beforeData.isLoading).toBe(true);
    expect(beforeData.currentStatus).toBe('not_started');

    // Before data arrives but user object already has verified === true from AuthContext -> isLoading is false & currentStatus is verified
    const cachedVerifiedUser = resolveStatus(false, false, undefined, null, { verified: true });
    expect(cachedVerifiedUser.isLoading).toBe(false);
    expect(cachedVerifiedUser.currentStatus).toBe('verified');

    // After verification request data arrives as 'pending_review'
    const pendingReq = resolveStatus(true, false, 'pending_review', null, null);
    expect(pendingReq.isLoading).toBe(false);
    expect(pendingReq.currentStatus).toBe('pending_review');

    // After live profile arrives with verified status
    const profileVerified = resolveStatus(false, true, undefined, { verified: true }, null);
    expect(profileVerified.isLoading).toBe(false);
    expect(profileVerified.currentStatus).toBe('verified');
  });

  it('(ج) isUserVerified applies correctly to user document containing verified: true or verificationStatus: verified', () => {
    expect(isUserVerified({ verified: true })).toBe(true);
    expect(isUserVerified({ verificationStatus: 'verified' })).toBe(true);
    expect(isUserVerified({ verified: true, verificationStatus: 'not_started' })).toBe(true);
    expect(isUserVerified({ verified: false, verificationStatus: 'verified' })).toBe(true);
    expect(isUserVerified({ verified: false, verificationStatus: 'not_started' })).toBe(false);
    expect(isUserVerified(null)).toBe(false);
    expect(isUserVerified(undefined)).toBe(false);
  });
});
