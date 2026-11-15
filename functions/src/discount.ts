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
 * Authoritative server-side member discount resolver (identical to src/shared/discount.ts).
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
