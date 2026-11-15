import { useCallback } from 'react';
import { navigate, routes } from '../router';
import { buildCatalogUrl, parseCatalogParams } from '../utils/catalogQuery';

/** Navigates to the fleet catalog while preserving any active date/filter query parameters. */
export function useBrowseFleet() {
  return useCallback(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const parsed = parseCatalogParams(window.location.search);
      if (parsed.from && parsed.to) {
        navigate(buildCatalogUrl({ from: parsed.from, to: parsed.to }));
        return;
      }
    }
    navigate(routes.cars);
  }, []);
}
