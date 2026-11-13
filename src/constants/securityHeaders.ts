/**
 * Unified Security Headers Configuration
 * Single source of truth for HTTP Security Headers and Content-Security-Policy.
 * Imported and applied by server.ts in Cloud Run / Express production environment.
 */

// Baseline CSP policy enforced in production
export const LEGACY_CONTENT_SECURITY_POLICY =
  "default-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.google.com/recaptcha/ https://www.google.com/recaptcha/enterprise/ https://www.recaptcha.net https://apis.google.com https://www.gstatic.com https://cloudfunctions.net https://*.cloudfunctions.net https://firebasestorage.googleapis.com https://content-firebaseappcheck.googleapis.com https://firebaseappcheck.googleapis.com https://firebaseinstallations.googleapis.com https://*.run.app https://storage.googleapis.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com; frame-src 'self' https://*.firebaseapp.com https://*.google.com https://www.google.com;";

// Tightened Strict CSP Policy (currently active as Content-Security-Policy-Report-Only)
export const STRICT_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "script-src 'self' https://apis.google.com https://www.gstatic.com https://www.google.com https://www.recaptcha.net https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://storage.googleapis.com https://lh3.googleusercontent.com",
  "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com https://fcm.googleapis.com https://content-firebaseappcheck.googleapis.com https://firebaseappcheck.googleapis.com https://www.google.com/recaptcha/ https://www.google.com/recaptcha/enterprise/ https://www.recaptcha.net https://apis.google.com https://www.gstatic.com https://asia-south1-shaker-rentalcars.cloudfunctions.net https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com",
  "frame-src 'self' https://shaker-rentalcars.firebaseapp.com https://www.google.com https://www.recaptcha.net",
  "upgrade-insecure-requests",
].join('; ');

// Initial safer HSTS header for testing domain setup without locking all subdomains prematurely
export const HSTS_HEADER_INITIAL = 'max-age=604800'; // 1 week initial trial
export const HSTS_HEADER_STRICT = 'max-age=31536000; includeSubDomains; preload';

export const COMMON_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Strict-Transport-Security': HSTS_HEADER_INITIAL,
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Content-Security-Policy': LEGACY_CONTENT_SECURITY_POLICY,
  'Content-Security-Policy-Report-Only': STRICT_CONTENT_SECURITY_POLICY,
};
