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

/* -------------------------------------------------------------------------- */
/*  Route table: the single source of truth for "which page is this URL?"     */
/* -------------------------------------------------------------------------- */

export type RouteName =
  | 'home'
  | 'cars'
  | 'car'
  | 'book'
  | 'about'
  | 'login'
  | 'register'
  | 'profile'
  | 'dashboard'
  | 'admin'
  | 'notFound';

export interface ResolvedRoute {
  name: RouteName;
  params: Record<string, string>;
}

interface RouteDef {
  name: RouteName;
  /** Patterns such as "/cars/:id". A trailing "/*" matches any sub-path. */
  patterns: string[];
}

// Order matters: first match wins.
const ROUTE_TABLE: RouteDef[] = [
  { name: 'home', patterns: ['/'] },
  { name: 'cars', patterns: ['/cars', '/catalog'] },
  { name: 'car', patterns: ['/cars/:id'] },
  { name: 'book', patterns: ['/cars/:id/book'] },
  { name: 'about', patterns: ['/about', '/contact'] },
  { name: 'login', patterns: ['/login'] },
  { name: 'register', patterns: ['/register'] },
  { name: 'profile', patterns: ['/profile'] },
  { name: 'dashboard', patterns: ['/dashboard'] },
  { name: 'admin', patterns: ['/admin', '/admin/*'] },
];

export function resolveRoute(pathname: string): ResolvedRoute {
  for (const def of ROUTE_TABLE) {
    for (const pattern of def.patterns) {
      if (pattern.endsWith('/*')) {
        const base = pattern.slice(0, -2);
        if (pathname === base || pathname.startsWith(`${base}/`)) {
          return { name: def.name, params: {} };
        }
        continue;
      }
      const params = pattern === '/' ? (pathname === '/' ? {} : null) : matchPath(pattern, pathname);
      if (params) return { name: def.name, params };
    }
  }
  return { name: 'notFound', params: {} };
}

/** React hook: the route for the current URL. */
export function useRoute(): ResolvedRoute & { pathname: string } {
  const { pathname } = useLocation();
  const route = resolveRoute(pathname);
  return { ...route, pathname };
}

/**
 * Coarse "section" used by the menus (GlobalMenu / Navbar) to highlight the active item.
 * Car details and booking pages belong to the catalog section.
 */
export function getMenuSection(name: RouteName): string {
  switch (name) {
    case 'cars':
    case 'car':
    case 'book':
      return 'cars';
    case 'about':
      return 'contact';
    default:
      return name;
  }
}

/** Handles the string "views" emitted by the menus, Navbar and Footer. */
export function navigateToView(view: string): void {
  if (view === 'aboutus') goToAboutUs();
  else if (view === 'cars' || view === 'catalog') navigate(routes.cars);
  else if (view === 'contact' || view === 'about') navigate(routes.about);
  else if (view === 'admin') navigate(routes.dashboard);
  else navigate(routes.home);
}

/** "من نحن" (☰ menu): go to the home page and scroll to the company footer section. */
export function goToAboutUs(): void {
  const alreadyHome = window.location.pathname.replace(/\/+$/, '') === '';
  navigate(routes.home, { scroll: false });
  let tries = 0;
  const scrollWhenReady = () => {
    const el = document.getElementById('about-us');
    if (el) {
      el.scrollIntoView({ behavior: alreadyHome ? 'smooth' : 'auto', block: 'start' });
    } else if (tries++ < 30) {
      setTimeout(scrollWhenReady, 50);
    }
  };
  setTimeout(scrollWhenReady, 80);
}
