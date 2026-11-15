import { useEffect, useState, useCallback, useMemo } from 'react';

/**
 * Minimal dependency-free client router built on the History API.
 * Every "page" of the app has its own URL (e.g. /cars/ID, /login, /profile, /dashboard).
 */

const NAV_EVENT = 'shaker:navigate';
const SCROLL_STORAGE_KEY = 'shaker_scroll_positions_v1';
const MAX_SAVED_SCROLL_ENTRIES = 50;

// Number of in-app pushes so goBack() never leaves the site when a page was opened directly by URL.
let inAppDepth = 0;

/* -------------------------------------------------------------------------- */
/*  Scroll Restoration Helpers                                                */
/* -------------------------------------------------------------------------- */

const memoryScrollMap = new Map<string, number>();

function generateNavKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readScrollStore(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(SCROLL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, number>;
    }
  } catch {
    // Ignore storage quota or private mode failures
  }
  return {};
}

function writeScrollStore(store: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = Object.keys(store);
    if (keys.length > MAX_SAVED_SCROLL_ENTRIES) {
      const trimmed: Record<string, number> = {};
      for (const k of keys.slice(keys.length - MAX_SAVED_SCROLL_ENTRIES)) {
        trimmed[k] = store[k];
      }
      window.sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(trimmed));
      return;
    }
    window.sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors
  }
}

function getOrAssignCurrentNavKey(): string {
  if (typeof window === 'undefined') return 'ssr';
  const currentState = (window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {}) as Record<string, unknown>;
  if (typeof currentState.__shakerNavKey === 'string' && currentState.__shakerNavKey) {
    return currentState.__shakerNavKey;
  }
  const key = generateNavKey();
  try {
    window.history.replaceState({ ...currentState, __shakerNavKey: key }, '', window.location.href);
  } catch {
    // Ignore history API restrictions in unusual environments
  }
  return key;
}

function saveScrollPosition(navKey: string, y: number): void {
  if (typeof window === 'undefined' || !navKey) return;
  const safeY = Math.max(0, Math.round(y));
  memoryScrollMap.set(navKey, safeY);
  const store = readScrollStore();
  store[navKey] = safeY;
  writeScrollStore(store);
}

function getSavedScrollPosition(navKey: string | undefined): number | null {
  if (!navKey) return null;
  if (memoryScrollMap.has(navKey)) {
    return memoryScrollMap.get(navKey) ?? null;
  }
  const store = readScrollStore();
  const value = store[navKey];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scrollToHashTarget(hash: string): boolean {
  if (typeof document === 'undefined' || !hash || !hash.startsWith('#')) return false;
  const targetId = decodeURIComponent(hash.slice(1));
  if (!targetId) return false;
  const el = document.getElementById(targetId);
  if (!el) return false;
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
  return true;
}

const SCROLL_RESTORE_MAX_WAIT_MS = 600;
let cancelPendingScrollRestore: (() => void) | null = null;

function canScrollToY(targetY: number): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (targetY <= 0) return true;
  const scrollHeight = Math.max(
    document.body?.scrollHeight ?? 0,
    document.documentElement?.scrollHeight ?? 0
  );
  const maxReachableY = Math.max(0, scrollHeight - window.innerHeight);
  return maxReachableY + 4 >= targetY;
}

function restoreScrollWhenReady(savedY: number | null, hash: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (cancelPendingScrollRestore) {
    cancelPendingScrollRestore();
    cancelPendingScrollRestore = null;
  }

  const targetY = savedY !== null && savedY > 0 ? savedY : 0;

  // Immediate fast path when scrolling to top and no hash
  if (!hash && targetY === 0) {
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let finished = false;
  let rafId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let observer: ResizeObserver | null = null;

  const cleanup = () => {
    finished = true;
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (cancelPendingScrollRestore === cleanup) {
      cancelPendingScrollRestore = null;
    }
  };

  cancelPendingScrollRestore = cleanup;

  const attemptRestore = (): boolean => {
    if (finished) return true;

    if (hash && scrollToHashTarget(hash)) {
      cleanup();
      return true;
    }

    if (!hash && canScrollToY(targetY)) {
      window.scrollTo({ top: targetY, behavior: 'auto' });
      cleanup();
      return true;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - startTime >= SCROLL_RESTORE_MAX_WAIT_MS) {
      // Budget exhausted: restore if reachable, otherwise leave cleanly at top of page
      if (!hash && canScrollToY(targetY)) {
        window.scrollTo({ top: targetY, behavior: 'auto' });
      } else if (!hash) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      cleanup();
      return true;
    }

    return false;
  };

  const tick = () => {
    if (!attemptRestore()) {
      rafId = window.requestAnimationFrame(tick);
    }
  };

  if (typeof ResizeObserver !== 'undefined') {
    try {
      observer = new ResizeObserver(() => {
        attemptRestore();
      });
      const mainEl = document.getElementById('main-content');
      if (mainEl) observer.observe(mainEl);
      if (document.body) observer.observe(document.body);
    } catch {
      // Ignore ResizeObserver setup issues
    }
  }

  timeoutId = setTimeout(() => {
    if (!finished) {
      if (!hash && canScrollToY(targetY)) {
        window.scrollTo({ top: targetY, behavior: 'auto' });
      } else if (!hash) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
      cleanup();
    }
  }, SCROLL_RESTORE_MAX_WAIT_MS);

  rafId = window.requestAnimationFrame(tick);
}

let routerListenersInitialized = false;

function ensureRouterScrollListeners(): void {
  if (typeof window === 'undefined' || routerListenersInitialized) return;
  routerListenersInitialized = true;

  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
  }

  let activeNavKey = getOrAssignCurrentNavKey();
  let scrollSaveTimer: ReturnType<typeof setTimeout> | null = null;

  const persistCurrentScroll = () => {
    saveScrollPosition(activeNavKey, window.scrollY);
  };

  window.addEventListener(
    'scroll',
    () => {
      if (scrollSaveTimer) clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(persistCurrentScroll, 80);
    },
    { passive: true }
  );

  window.addEventListener('pagehide', persistCurrentScroll);

  window.addEventListener(NAV_EVENT, () => {
    activeNavKey = getOrAssignCurrentNavKey();
  });

  window.addEventListener('popstate', () => {
    if (scrollSaveTimer) {
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = null;
    }
    const poppedState = (window.history.state && typeof window.history.state === 'object'
      ? window.history.state
      : {}) as Record<string, unknown>;
    const poppedKey =
      typeof poppedState.__shakerNavKey === 'string' ? poppedState.__shakerNavKey : getOrAssignCurrentNavKey();
    activeNavKey = poppedKey;

    const hash = window.location.hash;
    const savedY = getSavedScrollPosition(poppedKey);

    restoreScrollWhenReady(savedY, hash);
  });
}

if (typeof window !== 'undefined') {
  ensureRouterScrollListeners();
}

export interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
}

export function navigate(to: string, options: NavigateOptions = {}): void {
  if (typeof window === 'undefined') return;
  ensureRouterScrollListeners();
  if (cancelPendingScrollRestore) {
    cancelPendingScrollRestore();
    cancelPendingScrollRestore = null;
  }

  const currentKey = getOrAssignCurrentNavKey();
  saveScrollPosition(currentKey, window.scrollY);

  const current = window.location.pathname + window.location.search + window.location.hash;
  if (to !== current) {
    const nextState = options.replace
      ? { ...(window.history.state || {}), __shakerNavKey: currentKey }
      : { __shakerNavKey: generateNavKey() };

    if (options.replace) {
      window.history.replaceState(nextState, '', to);
    } else {
      window.history.pushState(nextState, '', to);
      inAppDepth += 1;
    }
  }

  window.dispatchEvent(new Event(NAV_EVENT));

  const hashIdx = to.indexOf('#');
  const hash = hashIdx >= 0 ? to.slice(hashIdx) : '';
  if (hash) {
    window.requestAnimationFrame(() => {
      setTimeout(() => scrollToHashTarget(hash), 60);
    });
  } else if (options.scroll !== false) {
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

export function useSearchParams(): [
  URLSearchParams,
  (
    updater: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
    options?: NavigateOptions
  ) => void,
] {
  const { pathname, search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const setSearchParams = useCallback(
    (
      updater: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
      options: NavigateOptions = { replace: true, scroll: false }
    ) => {
      const currentLoc = readLocation();
      const currentParams = new URLSearchParams(currentLoc.search);
      const nextParams =
        typeof updater === 'function' ? updater(new URLSearchParams(currentParams)) : updater;
      const qs = nextParams.toString();
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const targetPathname = currentLoc.pathname || pathname;
      const nextUrl = qs ? `${targetPathname}?${qs}${hash}` : `${targetPathname}${hash}`;
      navigate(nextUrl, {
        replace: options.replace ?? true,
        scroll: options.scroll ?? false,
      });
    },
    [pathname]
  );

  return [params, setSearchParams];
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
  contact: '/contact',
  dashboard: '/dashboard',
  verifyContract: '/verify-contract',
  adminDashboard: '/admin/dashboard',
} as const;

/** Reads and validates an internal ?redirect= target to avoid open redirects or auth loops. */
export function getSafeRedirectTarget(search?: string): string | null {
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  if (!query) return null;
  const raw = new URLSearchParams(query).get('redirect');
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /[\x00-\x1f\x7f]/.test(trimmed)
  ) {
    return null;
  }
  const pathOnly = trimmed.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (pathOnly === routes.login || pathOnly === routes.register || pathOnly === '/admin/login') {
    return null;
  }
  return trimmed;
}

/* -------------------------------------------------------------------------- */
/*  Route table & redirects: single source of truth                           */
/* -------------------------------------------------------------------------- */

export type RouteName =
  | 'home'
  | 'cars'
  | 'car'
  | 'book'
  | 'contact'
  | 'login'
  | 'register'
  | 'profile'
  | 'dashboard'
  | 'admin'
  | 'verifyContract'
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

export const REDIRECTS: Record<string, string> = {
  '/about': routes.contact,
  '/catalog': routes.cars,
  '/admin/login': routes.login,
};

export function resolveRedirect(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return REDIRECTS[normalized] ?? null;
}

// Order matters: first match wins.
const ROUTE_TABLE: RouteDef[] = [
  { name: 'home', patterns: ['/'] },
  { name: 'cars', patterns: ['/cars'] },
  { name: 'car', patterns: ['/cars/:id'] },
  { name: 'book', patterns: ['/cars/:id/book'] },
  { name: 'contact', patterns: ['/contact'] },
  { name: 'login', patterns: ['/login'] },
  { name: 'register', patterns: ['/register'] },
  { name: 'profile', patterns: ['/profile'] },
  { name: 'dashboard', patterns: ['/dashboard'] },
  { name: 'verifyContract', patterns: ['/verify-contract'] },
  { name: 'admin', patterns: ['/admin', '/admin/*'] },
];

export function resolveRoute(pathname: string): ResolvedRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const effectivePath = REDIRECTS[normalized] ?? normalized;

  for (const def of ROUTE_TABLE) {
    for (const pattern of def.patterns) {
      if (pattern.endsWith('/*')) {
        const base = pattern.slice(0, -2);
        if (effectivePath === base || effectivePath.startsWith(`${base}/`)) {
          return { name: def.name, params: {} };
        }
        continue;
      }
      const params = pattern === '/' ? (effectivePath === '/' ? {} : null) : matchPath(pattern, effectivePath);
      if (params) return { name: def.name, params };
    }
  }
  return { name: 'notFound', params: {} };
}

/** Returns clean canonical pathname (without query, hash, or legacy aliases) from the route table. */
export function getCanonicalPath(route: ResolvedRoute): string {
  switch (route.name) {
    case 'home':
      return routes.home;
    case 'cars':
      return routes.cars;
    case 'car':
      return route.params.id ? routes.car(route.params.id) : routes.cars;
    case 'book':
      return route.params.id ? routes.book(route.params.id) : routes.cars;
    case 'contact':
      return routes.contact;
    case 'login':
      return routes.login;
    case 'register':
      return routes.register;
    case 'profile':
      return routes.profile;
    case 'dashboard':
      return routes.dashboard;
    case 'verifyContract':
      return routes.verifyContract;
    case 'admin':
      return routes.adminDashboard;
    default:
      return routes.home;
  }
}

/** React hook: the route for the current URL (performs client-side replace redirect on legacy paths). */
export function useRoute(): ResolvedRoute & { pathname: string } {
  const { pathname, search } = useLocation();
  const redirectTarget = resolveRedirect(pathname);

  useEffect(() => {
    if (redirectTarget) {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      navigate(`${redirectTarget}${search}${hash}`, { replace: true, scroll: false });
    }
  }, [redirectTarget, search]);

  const route = resolveRoute(pathname);
  return { ...route, pathname: redirectTarget ?? pathname };
}

/**
 * Coarse "section" used by the menus (GlobalMenu / Navbar) to highlight the active item.
 * Car details and booking pages belong to the catalog section.
 */
export function getMenuSection(name: RouteName): RouteName {
  switch (name) {
    case 'cars':
    case 'car':
    case 'book':
      return 'cars';
    default:
      return name;
  }
}

/** Scroll to the #about-us section on the home page. */
export function goToAboutSection(): void {
  navigate(`${routes.home}#about-us`, { scroll: false });
}
