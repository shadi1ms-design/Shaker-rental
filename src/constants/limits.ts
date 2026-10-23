/**
 * Shaker Car Rental — System Constants & Security Limits
 */

/** Required identity documents for verified customer status (Driver License + National ID / Passport) */
export const REQUIRED_VERIFICATION_DOCS_COUNT = 2;

/** Legacy fallback constant */
export const MAX_VERIFICATION_DOCUMENTS = 2;

/** Minimum acceptable image dimensions for OCR and visual verification */
export const MIN_DOC_IMAGE_WIDTH = 1280;
export const MIN_DOC_IMAGE_HEIGHT = 720;

/** Max document image file size (10MB) */
export const MAX_DOC_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Max verification attempts allowed within 30 days window */
export const MAX_VERIFICATION_ATTEMPTS_30_DAYS = 5;

/** Blur score threshold (Laplacian variance): scores below this are considered blurry */
export const MIN_LAPLACIAN_BLUR_SCORE = 80;

/** Brightness bounds: 0-255 scale */
export const MIN_IMAGE_BRIGHTNESS = 35;
export const MAX_IMAGE_BRIGHTNESS = 230;

/** Single-use upload session nonce validity in seconds (5 minutes) */
export const VERIFICATION_SESSION_TTL_SECONDS = 300;

/** Admin signed document URL lifetime in seconds (60 seconds) */
export const VERIFICATION_SIGNED_URL_TTL_SECONDS = 60;
