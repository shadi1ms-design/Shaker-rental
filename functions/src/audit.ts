import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore, Transaction, DocumentReference } from 'firebase-admin/firestore';

export type AuditActorType = 'customer' | 'staff' | 'system';
export type AuditEntity =
  | 'booking'
  | 'vehicle'
  | 'user'
  | 'contract'
  | 'settings'
  | 'verification'
  | 'auth'
  | 'system'
  | 'system_config';

export interface AuditEntryInput {
  actorUid?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  actorType?: AuditActorType;
  action: string;
  entity: AuditEntity;
  entityId?: string;
  entityName?: string;
  targetUserId?: string;
  details: string | Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export function buildAuditDocumentData(id: string, entry: AuditEntryInput): Record<string, unknown> {
  const serverTime = FieldValue.serverTimestamp();
  return {
    id,
    actorUid: entry.actorUid || 'system',
    actorEmail: entry.actorEmail || 'system@shaker.sy',
    actorRole: entry.actorRole || 'system',
    actorType: entry.actorType || 'system',
    action: entry.action,
    entity: entry.entity,
    entityType: entry.entity, // legacy compatibility
    entityId: entry.entityId || '',
    entityName: entry.entityName || '',
    ...(entry.targetUserId ? { targetUserId: entry.targetUserId } : {}),
    details: entry.details,
    metadata: entry.metadata || {},
    ipAddress: entry.ipAddress || '',
    createdAt: serverTime,
    timestamp: serverTime,
    user: entry.actorEmail || entry.actorUid || 'system', // legacy compatibility
    userId: entry.actorUid || 'system', // legacy compatibility
  };
}

/**
 * Unified server-side audit logger for Cloud Functions (transactional or fire-and-forget).
 * Always writes `FieldValue.serverTimestamp()` for `createdAt` and `timestamp`,
 * and standardizes field names while retaining legacy aliases for backward compatibility.
 */
export function writeAudit(
  db: Firestore,
  txOrBatch: Transaction | null | undefined,
  entry: AuditEntryInput
): DocumentReference {
  const auditRef = db.collection('auditLogs').doc();
  const docData = buildAuditDocumentData(auditRef.id, entry);

  if (txOrBatch) {
    txOrBatch.set(auditRef, docData);
  } else {
    auditRef.set(docData).catch((err) => {
      console.warn('[Audit Log Error]', err);
    });
  }

  return auditRef;
}

/**
 * Async version for use outside a transaction.
 */
export async function writeAuditAsync(
  db: Firestore,
  entry: AuditEntryInput
): Promise<DocumentReference> {
  const auditRef = db.collection('auditLogs').doc();
  const docData = buildAuditDocumentData(auditRef.id, entry);

  await auditRef.set(docData);
  return auditRef;
}

export type SettingsFieldDiffEntry =
  | { from: unknown; to: unknown }
  | { changed: true; fromLength: number; toLength: number };

/**
 * Computes field-by-field diff between an existing document snapshot data and incoming updates.
 * Ignores internal timestamps like `updatedAt`.
 * For `rentalTerms` (and any string field longer than 200 chars), records `{ changed: true, fromLength, toLength }`
 * instead of storing raw `from` / `to` strings.
 */
export function computeSettingsDiff(
  previousSettings: Record<string, unknown> | null | undefined,
  updates: Record<string, unknown>
): Record<string, SettingsFieldDiffEntry> {
  const prev = previousSettings || {};
  const changes: Record<string, SettingsFieldDiffEntry> = {};

  for (const [key, newVal] of Object.entries(updates)) {
    if (key === 'updatedAt') continue;
    const oldVal = prev[key] ?? null;
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      const isLongTextField =
        key === 'rentalTerms' ||
        (typeof oldVal === 'string' && oldVal.length > 200) ||
        (typeof newVal === 'string' && newVal.length > 200);

      if (isLongTextField) {
        changes[key] = {
          changed: true,
          fromLength: typeof oldVal === 'string' ? oldVal.length : 0,
          toLength: typeof newVal === 'string' ? newVal.length : 0,
        };
      } else {
        changes[key] = {
          from: oldVal,
          to: newVal,
        };
      }
    }
  }

  return changes;
}


