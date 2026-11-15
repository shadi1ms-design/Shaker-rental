export type DiscountScope = 'all' | 'specific';

export interface DiscountConfigLike {
  enabled?: boolean;
  percentage?: number;
  scope?: string | null;
  vehicleIds?: readonly string[] | null;
  title?: string;
}

export interface ResolveMemberDiscountParams {
  vehicleId?: string | null;
  vehicleDocId?: string | null;
  vehicleDataId?: string | null;
  isUserLoggedIn: boolean;
}

export interface ResolvedMemberDiscount {
  eligible: boolean;
  applied: boolean;
  percentage: number;
}

export function normalizeDiscountPercentage(rawPercentage: unknown): number {
  const numeric = Number(rawPercentage) || 0;
  return Math.min(25, Math.max(0, Math.round(numeric)));
}

/**
 * Single authoritative resolver for member discount eligibility and application.
 * Shared strictly in semantics between frontend pricing and Cloud Functions.
 *
 * Fail-closed rules:
 * - Requires config.enabled === true
 * - Clamps percentage to [0..25] via Math.round; rejects <= 0
 * - Accepts ONLY scope === 'all' or scope === 'specific' (with non-empty matching vehicleIds)
 * - Unknown scope values fail closed (eligible: false, applied: false, percentage: 0)
 */
export function resolveMemberDiscount(
  config: DiscountConfigLike | null | undefined,
  params: ResolveMemberDiscountParams
): ResolvedMemberDiscount {
  if (!config || config.enabled !== true) {
    return { eligible: false, applied: false, percentage: 0 };
  }

  const safePercentage = normalizeDiscountPercentage(config.percentage);
  if (safePercentage <= 0) {
    return { eligible: false, applied: false, percentage: 0 };
  }

  const scope = config.scope;
  let isScopeMatched = false;

  if (scope === 'all') {
    isScopeMatched = true;
  } else if (scope === 'specific') {
    const candidateIds = new Set<string>();
    if (params.vehicleId && String(params.vehicleId).trim()) {
      candidateIds.add(String(params.vehicleId).trim());
    }
    if (params.vehicleDocId && String(params.vehicleDocId).trim()) {
      candidateIds.add(String(params.vehicleDocId).trim());
    }
    if (params.vehicleDataId && String(params.vehicleDataId).trim()) {
      candidateIds.add(String(params.vehicleDataId).trim());
    }

    if (
      Array.isArray(config.vehicleIds) &&
      config.vehicleIds.length > 0 &&
      candidateIds.size > 0
    ) {
      isScopeMatched = config.vehicleIds.some((id) => {
        const cleanId = typeof id === 'string' || typeof id === 'number' ? String(id).trim() : '';
        return cleanId !== '' && candidateIds.has(cleanId);
      });
    }
  } else {
    // Any unknown/legacy scope must fail closed (no discount)
    isScopeMatched = false;
  }

  if (!isScopeMatched) {
    return { eligible: false, applied: false, percentage: 0 };
  }

  return {
    eligible: true,
    applied: Boolean(params.isUserLoggedIn),
    percentage: safePercentage,
  };
}

/**
 * Formats a saved booking/contract discount consistently across customer and admin views.
 * - When `discountPercentage` is stored (> 0), renders: "خصم عضو X% (-$Y من $Z إيجار)".
 * - For legacy bookings without `discountPercentage`, renders only the discount amount ("خصم مطبق (-$Y)") without inventing a percentage.
 */
export function formatSavedBookingDiscountLabel(params: {
  discountAmount?: number | null;
  discountPercentage?: number | null;
  discountBase?: number | null;
  basePrice?: number | null;
  currency?: string;
}): string | null {
  const amount = Number(params.discountAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const currency = params.currency || '$';
  const formattedAmount = `${currency}${amount.toLocaleString('en-US')}`;

  if (
    typeof params.discountPercentage === 'number' &&
    Number.isFinite(params.discountPercentage) &&
    params.discountPercentage > 0
  ) {
    const pct = Math.round(params.discountPercentage);
    const baseVal =
      typeof params.discountBase === 'number' &&
      Number.isFinite(params.discountBase) &&
      params.discountBase > 0
        ? params.discountBase
        : typeof params.basePrice === 'number' &&
          Number.isFinite(params.basePrice) &&
          params.basePrice > 0
        ? params.basePrice
        : null;

    if (baseVal !== null) {
      const formattedBase = `${currency}${baseVal.toLocaleString('en-US')}`;
      return `خصم عضو ${pct}% (-${formattedAmount} من ${formattedBase} إيجار)`;
    }
    return `خصم عضو ${pct}% (-${formattedAmount})`;
  }

  return `خصم مطبق (-${formattedAmount})`;
}
