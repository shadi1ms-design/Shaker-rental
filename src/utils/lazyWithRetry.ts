import React, { ComponentType, LazyExoticComponent } from 'react';
import { resolveRoute, type RouteName } from '../router';

const RELOAD_STORAGE_KEY = 'shaker_chunk_reload_ts';
const RELOAD_COOLDOWN_MS = 10_000;

export function isDynamicImportError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Unable to preload CSS')
  );
}

/**
 * Wraps React.lazy with automatic retry on transient network/Vite module graph
 * errors, and triggers a single page reload if a chunk hash becomes stale.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retries = 2,
  intervalMs = 400,
): LazyExoticComponent<T> {
  return React.lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs * (attempt + 1)));
        }
      }
    }

    if (typeof window !== 'undefined' && isDynamicImportError(lastError)) {
      try {
        const lastReload = Number(sessionStorage.getItem(RELOAD_STORAGE_KEY) || '0');
        const now = Date.now();
        if (now - lastReload > RELOAD_COOLDOWN_MS) {
          sessionStorage.setItem(RELOAD_STORAGE_KEY, String(now));
          window.location.reload();
          // Return a never-resolving promise while the browser reloads
          return new Promise<{ default: T }>(() => {});
        }
      } catch {
        // Ignore sessionStorage errors in restricted environments
      }
    }

    throw lastError;
  });
}

/**
 * Centralized route -> dynamic import() map used by both React.lazy (lazyWithRetry)
 * and Link route prefetching.
 */
export const ROUTE_IMPORTERS = {
  cars: () => import('../pages/CatalogPage').then((m) => ({ default: m.CatalogPage })),
  car: () =>
    Promise.all([
      import('../pages/CarDetailsPage').then((m) => ({ default: m.CarDetailsPage })),
      import('../components/CarDetailsView').catch(() => null),
    ]).then(([page]) => page),
  book: () => import('../pages/BookingPage').then((m) => ({ default: m.BookingPage })),
  contact: () => import('../pages/ContactPage').then((m) => ({ default: m.ContactRoutePage })),
  login: () => import('../pages/AuthPage').then((m) => ({ default: m.AuthPage })),
  register: () => import('../pages/AuthPage').then((m) => ({ default: m.AuthPage })),
  profile: () => import('../pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
  verifyContract: () =>
    import('../pages/VerifyContractPage').then((m) => ({ default: m.VerifyContractPage })),
  admin: () => import('../pages/AdminPage').then((m) => ({ default: m.AdminPage })),
  notFound: () => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
} as const;

const prefetchedRoutes = new Set<RouteName>();

/**
 * Prefetches the lazy page bundle corresponding to the given internal URL path.
 * Errors are silently ignored.
 */
export function prefetchRoute(to: string): void {
  if (!to) return;
  try {
    const pathname = to.split(/[?#]/)[0] || '/';
    const resolved = resolveRoute(pathname);
    if (prefetchedRoutes.has(resolved.name)) return;
    const importer = ROUTE_IMPORTERS[resolved.name as keyof typeof ROUTE_IMPORTERS];
    if (!importer) return;
    prefetchedRoutes.add(resolved.name);
    void importer().catch(() => {
      prefetchedRoutes.delete(resolved.name);
    });
  } catch {
    // Ignore prefetch errors
  }
}
