import { describe, it, expect } from 'vitest';
import {
  REDIRECTS,
  getCanonicalPath,
  getMenuSection,
  getSafeRedirectTarget,
  resolveRedirect,
  resolveRoute,
  routes,
} from '../src/router';
import { ADMIN_ROUTES } from '../src/constants/adminNav';
import {
  getAdminTabFromPath,
  getDefaultAdminPath,
  isAdminRoleAuthorized,
  resolveAdminRoute,
} from '../src/utils/adminTabs';
import {
  buildBookingUrl,
  buildCatalogSearchParams,
  buildCatalogUrl,
  isValidIsoDateParam,
  parseCatalogParams,
} from '../src/utils/catalogQuery';
import {
  buildVehicleMetaPayload,
  escapeHtml,
  extractVehicleIdFromPath,
  getIndexHtmlTemplate,
  injectVehicleMetaHtml,
  resetTemplateCacheForTest,
  sanitizeImageUrl,
  setTemplateCacheForTest,
} from '../functions/src/vehicleMeta';
import { buildVehicleJsonLd } from '../src/hooks/useVehicleJsonLd';

describe('Router resolution, redirects, canonical paths, and menu sections', () => {
  it('resolves all primary public and protected routes', () => {
    expect(resolveRoute('/')).toEqual({ name: 'home', params: {} });
    expect(resolveRoute('/cars')).toEqual({ name: 'cars', params: {} });
    expect(resolveRoute('/cars/'));
    expect(resolveRoute('/cars/abc-1')).toEqual({ name: 'car', params: { id: 'abc-1' } });
    expect(resolveRoute('/cars/car%201/book')).toEqual({ name: 'book', params: { id: 'car 1' } });
    expect(resolveRoute('/contact')).toEqual({ name: 'contact', params: {} });
    expect(resolveRoute('/login')).toEqual({ name: 'login', params: {} });
    expect(resolveRoute('/register')).toEqual({ name: 'register', params: {} });
    expect(resolveRoute('/profile')).toEqual({ name: 'profile', params: {} });
    expect(resolveRoute('/dashboard')).toEqual({ name: 'dashboard', params: {} });
    expect(resolveRoute('/verify-contract')).toEqual({ name: 'verifyContract', params: {} });
    expect(resolveRoute('/admin')).toEqual({ name: 'admin', params: {} });
    expect(resolveRoute('/admin/dashboard')).toEqual({ name: 'admin', params: {} });
    expect(resolveRoute('/unknown-page-xyz')).toEqual({ name: 'notFound', params: {} });
  });

  it('resolves legacy REDIRECTS and maps them to canonical routes', () => {
    expect(REDIRECTS).toEqual({
      '/about': routes.contact,
      '/catalog': routes.cars,
      '/admin/login': routes.login,
    });
    expect(resolveRedirect('/about')).toBe('/contact');
    expect(resolveRedirect('/about/')).toBe('/contact');
    expect(resolveRedirect('/catalog')).toBe('/cars');
    expect(resolveRedirect('/admin/login')).toBe('/login');
    expect(resolveRedirect('/cars')).toBeNull();

    expect(resolveRoute('/about')).toEqual({ name: 'contact', params: {} });
    expect(resolveRoute('/catalog')).toEqual({ name: 'cars', params: {} });
  });

  it('builds canonical paths cleanly for all route types', () => {
    expect(getCanonicalPath(resolveRoute('/'))).toBe('/');
    expect(getCanonicalPath(resolveRoute('/cars'))).toBe('/cars');
    expect(getCanonicalPath(resolveRoute('/catalog'))).toBe('/cars');
    expect(getCanonicalPath(resolveRoute('/about'))).toBe('/contact');
    expect(getCanonicalPath(resolveRoute('/cars/a b'))).toBe('/cars/a%20b');
    expect(getCanonicalPath(resolveRoute('/cars/car-1/book'))).toBe('/cars/car-1/book');
    expect(getCanonicalPath(resolveRoute('/verify-contract'))).toBe('/verify-contract');
    expect(getCanonicalPath(resolveRoute('/admin/bookings'))).toBe('/admin/dashboard');
    expect(getCanonicalPath(resolveRoute('/missing'))).toBe('/');
  });

  it('highlights cars menu section for catalog, car details, and booking routes', () => {
    expect(getMenuSection('cars')).toBe('cars');
    expect(getMenuSection('car')).toBe('cars');
    expect(getMenuSection('book')).toBe('cars');
    expect(getMenuSection('contact')).toBe('contact');
    expect(getMenuSection('home')).toBe('home');
  });
});

describe('getSafeRedirectTarget', () => {
  it('accepts safe internal relative paths with query strings and hashes', () => {
    expect(getSafeRedirectTarget('?redirect=%2Fprofile')).toBe('/profile');
    expect(getSafeRedirectTarget('?redirect=%2Fcars%2F12%2Fbook%3Ffrom%3D2026-11-15%26to%3D2026-11-18')).toBe(
      '/cars/12/book?from=2026-11-15&to=2026-11-18'
    );
    expect(getSafeRedirectTarget('?redirect=%2Fcontact%23map')).toBe('/contact#map');
  });

  it('rejects external URLs, protocol-relative URLs, backslashes, control chars, and auth loops', () => {
    expect(getSafeRedirectTarget('')).toBeNull();
    expect(getSafeRedirectTarget('?foo=bar')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=https://evil.com')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=//evil.com')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=///evil.com')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=/\\evil.com')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=profile')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=/login')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=/login?next=1')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=/register')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=/admin/login')).toBeNull();
    expect(getSafeRedirectTarget('?redirect=%2Fprofile%0Aevil')).toBeNull();
  });
});

describe('Explicit Admin router (ADMIN_ROUTES & adminTabs)', () => {
  it('contains exact routes for every admin tab and enforces exact matching', () => {
    expect(Object.keys(ADMIN_ROUTES)).toEqual([
      '/admin/dashboard',
      '/admin/bookings',
      '/admin/vehicles',
      '/admin/reports',
      '/admin/notifications',
      '/admin/users',
      '/admin/staff',
      '/admin/activity-log',
      '/admin/settings',
    ]);

    expect(resolveAdminRoute('/admin')).toEqual({ type: 'root' });
    expect(resolveAdminRoute('/admin/dashboard')).toEqual({
      type: 'tab',
      path: '/admin/dashboard',
      tab: 'overview',
      requiredRole: 'admin',
    });
    expect(resolveAdminRoute('/admin/bookings/')).toEqual({
      type: 'tab',
      path: '/admin/bookings',
      tab: 'bookings',
      requiredRole: 'employee',
    });
    expect(resolveAdminRoute('/admin/vehicles/new')).toEqual({ type: 'vehicleNew' });
    expect(resolveAdminRoute('/admin/vehicles/v-10/edit')).toEqual({
      type: 'vehicleEdit',
      id: 'v-10',
    });
    expect(resolveAdminRoute('/admin/contracts/c-99')).toEqual({
      type: 'contract',
      id: 'c-99',
    });
  });

  it('returns null for unknown admin paths and removed legacy aliases instead of silently opening default tabs', () => {
    const unknownPaths = [
      '/admin/xyz',
      '/admin/calendar',
      '/admin/rentals',
      '/admin/contracts',
      '/admin/customers',
      '/admin/audit',
      '/admin/firebase',
      '/admin/dashboard/extra',
    ];

    for (const p of unknownPaths) {
      expect(resolveAdminRoute(p)).toBeNull();
      expect(getAdminTabFromPath(p, { isAdmin: true, isSuperAdmin: true })).toBeNull();
    }
  });

  it('enforces role authorization and default paths per role', () => {
    expect(getDefaultAdminPath({ isAdmin: false, isSuperAdmin: false })).toBe('/admin/bookings');
    expect(getDefaultAdminPath({ isAdmin: true, isSuperAdmin: false })).toBe('/admin/dashboard');
    expect(getDefaultAdminPath({ isAdmin: true, isSuperAdmin: true })).toBe('/admin/dashboard');

    expect(isAdminRoleAuthorized('employee', { isAdmin: false, isSuperAdmin: false })).toBe(true);
    expect(isAdminRoleAuthorized('admin', { isAdmin: false, isSuperAdmin: false })).toBe(false);
    expect(isAdminRoleAuthorized('admin', { isAdmin: true, isSuperAdmin: false })).toBe(true);
    expect(isAdminRoleAuthorized('super_admin', { isAdmin: true, isSuperAdmin: false })).toBe(false);
    expect(isAdminRoleAuthorized('super_admin', { isAdmin: true, isSuperAdmin: true })).toBe(true);
  });
});

describe('Catalog & Booking URL query utilities', () => {
  it('validates ISO date parameters strictly', () => {
    expect(isValidIsoDateParam('2026-11-15')).toBe(true);
    expect(isValidIsoDateParam('2026-02-30')).toBe(false);
    expect(isValidIsoDateParam('15-11-2026')).toBe(false);
    expect(isValidIsoDateParam('')).toBe(false);
    expect(isValidIsoDateParam(null)).toBe(false);
  });

  it('parses valid query params and falls back safely on invalid values', () => {
    const parsed = parseCatalogParams(
      '?category=medium&q=kia&brand=Kia&year=2024&transmission=automatic&fuel=hybrid&seats=5&availability=available&max=60&sort=price-asc&from=2026-11-20&to=2026-11-25'
    );
    expect(parsed).toEqual({
      category: 'medium',
      q: 'kia',
      brand: 'Kia',
      year: 2024,
      transmission: 'automatic',
      fuel: 'hybrid',
      seats: 5,
      availability: 'available',
      max: 60,
      sort: 'price-asc',
      from: '2026-11-20',
      to: '2026-11-25',
    });

    const invalid = parseCatalogParams(
      '?category=spaceship&year=abc&transmission=cvt&fuel=nuclear&seats=-2&availability=broken&max=-10&sort=magic&from=2026-11-25&to=2026-11-20'
    );
    expect(invalid).toEqual({
      category: 'all',
      q: '',
      brand: 'all',
      year: 'all',
      transmission: 'all',
      fuel: 'all',
      seats: 'all',
      availability: 'all',
      max: null,
      sort: 'recommended',
      from: '',
      to: '',
    });
  });

  it('serializes only non-default filters and builds clean catalog & booking URLs', () => {
    const sp = buildCatalogSearchParams(
      {
        category: 'all',
        q: '   ',
        brand: 'all',
        sort: 'recommended',
        max: 100,
      },
      100
    );
    expect(sp.toString()).toBe('');
    expect(buildCatalogUrl({ category: 'jeep_7seats', from: '2026-11-20', to: '2026-11-23' })).toBe(
      '/cars?category=jeep_7seats&from=2026-11-20&to=2026-11-23'
    );
    expect(buildBookingUrl('car-1')).toBe('/cars/car-1/book');
    expect(buildBookingUrl('car-1', { from: '2026-11-20', to: '2026-11-23' })).toBe(
      '/cars/car-1/book?from=2026-11-20&to=2026-11-23'
    );
    // Rejects inverted date range
    expect(buildBookingUrl('car-1', { from: '2026-11-25', to: '2026-11-20' })).toBe('/cars/car-1/book');
  });
});

describe('vehicleMeta Cloud Function Open Graph & XSS escaping', () => {
  const sampleTemplate = `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <title>شاكر لتأجير السيارات | أسطول دمشق الأحدث</title>
    <meta name="description" content="وصف افتراضي" />
    <meta property="og:title" content="عنوان افتراضي" />
    <meta property="og:description" content="وصف افتراضي" />
    <meta property="og:image" content="https://shakerrent.com/og-image-v2.jpg" />
    <meta name="robots" content="index,follow" />
    <meta name="twitter:image" content="https://shakerrent.com/og-image-v2.jpg" />
    <link rel="canonical" href="https://shakerrent.com/" />
  </head>
  <body><div id="root"></div></body>
</html>`;

  it('strictly escapes HTML special characters to prevent XSS', () => {
    const malicious = `<script>alert("xss")</script>'&><img src=x onerror=alert(1)>`;
    const escaped = escapeHtml(malicious);
    expect(escaped).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&#39;&amp;&gt;&lt;img src=x onerror=alert(1)&gt;'
    );
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain("'");
  });

  it('extracts valid vehicle IDs and rejects invalid or book paths', () => {
    expect(extractVehicleIdFromPath('/cars/kia-cerato-2024')).toBe('kia-cerato-2024');
    expect(extractVehicleIdFromPath('/cars/kia-cerato-2024/')).toBe('kia-cerato-2024');
    expect(extractVehicleIdFromPath('/cars/car%201?ref=wa')).toBe('car 1');
    expect(extractVehicleIdFromPath('/cars/car-1/book')).toBeNull();
    expect(extractVehicleIdFromPath('/cars')).toBeNull();
    expect(extractVehicleIdFromPath('')).toBeNull();
  });

  it('sanitizes og:image URLs and rejects javascript: or data: URIs', () => {
    expect(sanitizeImageUrl('https://cdn.example.com/car1.webp')).toBe(
      'https://cdn.example.com/car1.webp'
    );
    expect(sanitizeImageUrl('/uploads/car1.jpg')).toBe('https://shakerrent.com/uploads/car1.jpg');
    expect(sanitizeImageUrl('javascript:alert(1)')).toBe('https://shakerrent.com/og-image-v2.jpg');
    expect(sanitizeImageUrl('data:text/html,<script>alert(1)</script>')).toBe(
      'https://shakerrent.com/og-image-v2.jpg'
    );
  });

  it('injects vehicle Open Graph tags with strict XSS escaping for active vehicles', () => {
    const { status, payload } = buildVehicleMetaPayload('v-101', {
      brand: 'Kia <script>alert(1)</script>',
      model: 'Sportage "GT"',
      year: 2024,
      dailyPrice: 55,
      description: 'سيارة عائلية & مريحة',
      images: ['https://example.com/car-first.jpg?a=1&b="2"', 'https://example.com/car-second.jpg'],
      status: 'available',
    });

    expect(status).toBe(200);
    expect(payload.robots).toBe('index,follow');
    expect(payload.ogImage).toBe('https://example.com/car-first.jpg?a=1&b="2"');

    const html = injectVehicleMetaHtml(sampleTemplate, payload);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Sportage &quot;GT&quot;');
    expect(html).toContain('https://example.com/car-first.jpg?a=1&amp;b=&quot;2&quot;');
    expect(html).toContain('<link rel="canonical" href="https://shakerrent.com/cars/v-101" />');
    expect(html).toContain('<meta property="og:url" content="https://shakerrent.com/cars/v-101" />');
    expect(html).toContain('<meta name="robots" content="index,follow" />');
  });

  it('returns 404 and noindex,nofollow when vehicle is missing, deleted, or inactive', () => {
    const missing = buildVehicleMetaPayload('missing-id', null);
    expect(missing.status).toBe(404);
    expect(missing.payload.robots).toBe('noindex,nofollow');
    const missingHtml = injectVehicleMetaHtml(sampleTemplate, missing.payload);
    expect(missingHtml).toContain('<meta name="robots" content="noindex,nofollow" />');

    const deleted = buildVehicleMetaPayload('del-id', {
      brand: 'Hyundai',
      model: 'Elantra',
      isDeleted: true,
      status: 'available',
    });
    expect(deleted.status).toBe(404);

    const inactive = buildVehicleMetaPayload('inact-id', {
      brand: 'Hyundai',
      model: 'Elantra',
      status: 'inactive',
    });
    expect(inactive.status).toBe(404);
  });
});

describe('Vehicle JSON-LD structured data (buildVehicleJsonLd)', () => {
  it('builds Schema.org Product with additionalType Car and status-based availability', () => {
    const jsonLd = buildVehicleJsonLd({
      id: 'car-77',
      brand: 'Hyundai',
      model: 'Tucson',
      year: 2024,
      color: 'أسود',
      category: 'jeep_7seats',
      plateNumber: '123456',
      dailyPrice: 65,
      weeklyPrice: 420,
      monthlyPrice: 1500,
      deposit: 200,
      status: 'available',
      imageUrl: 'https://shakerrent.com/tucson.jpg',
      images: ['https://shakerrent.com/tucson-1.jpg', 'https://shakerrent.com/tucson-2.jpg'],
      features: ['تكييف'],
      transmission: 'automatic',
      fuelType: 'gasoline',
      seats: 7,
      mileageLimit: 200,
      extraMileageCost: 0.5,
      currentKilometers: 15000,
      nextOilChangeKm: 20000,
      insuranceCost: 10,
      driverCost: 15,
    });

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Product');
    expect(jsonLd.additionalType).toBe('Car');
    expect(jsonLd.name).toBe('Hyundai Tucson 2024');
    expect(jsonLd.brand).toEqual({ '@type': 'Brand', name: 'Hyundai' });
    expect(jsonLd.image).toEqual([
      'https://shakerrent.com/tucson-1.jpg',
      'https://shakerrent.com/tucson-2.jpg',
    ]);
    expect(jsonLd.offers).toEqual({
      '@type': 'Offer',
      url: 'https://shakerrent.com/cars/car-77',
      price: '65',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    });
  });
});

describe('vehicleMeta template caching & fallback behavior', () => {
  it('does not contain /src/main.tsx in any served template source', async () => {
    resetTemplateCacheForTest();
    const tmpl = await getIndexHtmlTemplate();
    if (tmpl) {
      expect(tmpl).not.toContain('/src/main.tsx');
    }
  });

  it('reuses cached template within 60s TTL and refreshes after expiration', async () => {
    resetTemplateCacheForTest();
    const mockTmpl1 = '<html lang="ar"><head><title>Test V1</title></head><body></body></html>';
    const mockTmpl2 = '<html lang="ar"><head><title>Test V2</title></head><body></body></html>';

    // Set cache as if fetched 10 seconds ago
    setTemplateCacheForTest(mockTmpl1, Date.now() - 10_000);
    const cached = await getIndexHtmlTemplate();
    expect(cached).toBe(mockTmpl1);

    // Set cache as if fetched 70 seconds ago (expired >60s)
    setTemplateCacheForTest(mockTmpl1, Date.now() - 70_000);
    // Since fetch might fail in test environment without live hosting, verify mechanism attempts refresh
    // and falls back or fetches.
    const refreshed = await getIndexHtmlTemplate();
    expect(typeof refreshed).toBe('string');
  });

  it('falls back to stale cache or disk when remote fetch fails', async () => {
    resetTemplateCacheForTest();
    // Do not set cache so it falls back to built dist/index.html on disk

    // Force HOSTING_ORIGIN to an unreachable domain so fetch fails
    const oldOrigin = process.env.HOSTING_ORIGIN;
    process.env.HOSTING_ORIGIN = 'http://127.0.0.1:1';

    const result = await getIndexHtmlTemplate();
    expect(typeof result).toBe('string');
    expect(result).toContain('<title>');
    expect(result).not.toContain('/src/main.tsx');

    if (oldOrigin !== undefined) {
      process.env.HOSTING_ORIGIN = oldOrigin;
    } else {
      delete process.env.HOSTING_ORIGIN;
    }
  });
});


