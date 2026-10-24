/**
 * Unified Backend Security & Authority Constants
 * Source of truth for designated root system identifiers and cloud environment.
 */

// Set in functions/.env (not committed): DESIGNATED_SUPER_ADMIN_UID=<uid>
export const DESIGNATED_SUPER_ADMIN_UID = (process.env.DESIGNATED_SUPER_ADMIN_UID || '').trim();

export const FUNCTION_REGION = 'asia-south1';

export const DATABASE_ID = 'ai-studio-shakercarrental-8ca1f5c8-9251-4c7d-b28c-5a1ee6a1a1e1';

export const DEFAULT_STORAGE_BUCKET = 'shaker-rentalcars.firebasestorage.app';

export const STORAGE_TRIGGER_REGION = 'us-east1';

/**
 * Image quality validation thresholds — keep in sync with src/constants/limits.ts
 */
export const MIN_LAPLACIAN_BLUR_SCORE = 80;
export const MIN_IMAGE_BRIGHTNESS = 35;
export const MAX_IMAGE_BRIGHTNESS = 230;
