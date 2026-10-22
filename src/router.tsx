import { useEffect, useState, useCallback } from 'react';

/**
 * Minimal dependency-free client router built on the History API.
 * Every "page" of the app has its own URL (e.g. /cars/ID, /login, /profile, /dashboard).
 */

const NAV_EVENT = 'shaker:navigate';
// Number of in-app pushes so goBack() never leaves the site when a page was opened directly by URL.
let inAppDepth = 0;

export interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
}

export function navigate(to: string, options: NavigateOptions = {}): void {
  if (typeof window === 'undefined') return;
  const current = window.location.pathname + window.location.search;
  if (to !== current) {
    if (options.replace) {
      window.history.replaceState(null, '', to);
    } else {
      window.history.pushState(null, '', to);
      inAppDepth += 1;
    }
  }
  window.dispatchEvent(new Event(NAV_EVENT));
  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

export function goBack(fallback = '/'): void {
  if (typeof window !== 'undefined' && inAppDepth > 0) {
    inAppDepth -= 1;
    window.history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

export interface LocationState {
  pathname: string;
  search: string;
}

function readLocation(): LocationState {
  if (typeof window === 'undefined') return { pathname: '/', search: '' };
  const raw = window.location.pathname.replace(/\/+$/, '');
  return { pathname: raw === '' ? '/' : raw, search: window.location.search };
}

export function useLocation(): LocationState {
  const [loc, setLoc] = useState<LocationState>(readLocation);

  useEffect(() => {
    const update = () => {
      const next = readLocation();
      setLoc((prev) => (prev.pathname === next.pathname && prev.search === next.search ? prev : next));
    };
    window.addEventListener('popstate', update);
    window.addEventListener(NAV_EVENT, update);
    update();
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAV_EVENT, update);
    };
  }, []);

  return loc;
}

export function useNavigate() {
  return useCallback((to: string, options?: NavigateOptions) => navigate(to, options), []);
}

/** Match a pattern like "/cars/:id" against a pathname. Returns params or null. */
export function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = pathname.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) {
      try {
        params[p[i].slice(1)] = decodeURIComponent(s[i]);
      } catch {
        params[p[i].slice(1)] = s[i];
      }
    } else if (p[i] !== s[i]) {
      return null;
    }
  }
  return params;
}

export const routes = {
  home: '/',
  cars: '/cars',
  car: (id: string) => `/cars/${encodeURIComponent(id)}`,
  book: (id: string) => `/cars/${encodeURIComponent(id)}/book`,
  login: '/login',
  register: '/register',
  profile: '/profile',
  about: '/about',
  contact: '/contact',
  dashboard: '/dashboard',
  adminDashboard: '/admin/dashboard',
  adminLogin: '/admin/login',
} as const;
