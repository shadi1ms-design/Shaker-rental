export function isUserVerified(userData?: { verified?: unknown; verificationStatus?: unknown } | null): boolean {
  return userData?.verified === true || userData?.verificationStatus === 'verified';
}
