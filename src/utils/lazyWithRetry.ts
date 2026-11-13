import React, { ComponentType, LazyExoticComponent } from 'react';

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
