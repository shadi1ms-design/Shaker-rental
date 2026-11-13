// keep in sync with functions/src/verificationStatus.ts
export function isUserVerified(userData?: { verified?: unknown; verificationStatus?: unknown } | null): boolean {
  return userData?.verified === true || userData?.verificationStatus === 'verified';
}

export type VerificationAccountState = 'verified' | 'pending_review' | 'rejected' | 'unverified';

/**
 * تحديد حالة توثيق الحساب الموحّدة على الواجهة بالاعتماد على طلب التوثيق أولًا ثم حقول المستخدم.
 */
export function getVerificationState(
  user?: { verified?: unknown; verificationStatus?: unknown } | null,
  req?: { status?: unknown } | null
): VerificationAccountState {
  if (req) {
    if (req.status === 'verified') return 'verified';
    if (req.status === 'pending_review') return 'pending_review';
    if (req.status === 'rejected') return 'rejected';
    return 'unverified';
  }

  if (isUserVerified(user)) return 'verified';
  if (user?.verificationStatus === 'pending_review') return 'pending_review';
  if (user?.verificationStatus === 'rejected') return 'rejected';
  return 'unverified';
}

