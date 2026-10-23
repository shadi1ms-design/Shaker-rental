import { Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/** Rate-limit documents expire automatically (Firestore TTL policy on `expiresAt`, see firestore.indexes.json). */
export const RATE_LIMIT_DOC_TTL_MS = 24 * 60 * 60 * 1000;

export function ttlTimestamp(fromMs = Date.now()): Timestamp {
  return Timestamp.fromMillis(fromMs + RATE_LIMIT_DOC_TTL_MS);
}

export function sanitizeRateLimitKey(raw: string): string {
  const clean = (raw || 'unknown').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return clean || 'unknown';
}

/**
 * Fixed-window counter. Throws HttpsError('resource-exhausted') once `max` attempts are used within `windowMs`.
 */
export async function consumeRateLimit(
  db: Firestore,
  docId: string,
  max: number,
  windowMs: number,
  message: string
): Promise<void> {
  const ref = db.collection('rateLimits').doc(docId);
  const nowMs = Date.now();
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    let count = 1;
    let windowStart = nowMs;
    if (snap.exists) {
      const d = snap.data()!;
      const prev = Number(d.windowStartMs || 0);
      if (nowMs - prev < windowMs) {
        count = Number(d.count || 0) + 1;
        windowStart = prev;
      }
    }
    if (count > max) throw new HttpsError('resource-exhausted', message);
    t.set(ref, {
      count,
      windowStartMs: windowStart,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: ttlTimestamp(nowMs),
    }, { merge: true });
  });
}
